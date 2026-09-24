import "server-only";
import { structured } from "@desk/llm";
import { z } from "zod";
import { describeTripwire } from "./scoring";
import type { Headline, MarketContext, Thesis, TripwireCondition } from "./types";

const TripwireOut = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("price"),
    condition: z.object({ op: z.enum(["close_below", "close_above"]), pct: z.number().min(-0.5).max(0.5) }),
  }),
  z.object({
    type: z.literal("earnings"),
    condition: z.object({
      metric: z.literal("revenue_surprise"),
      op: z.enum(["below", "above"]),
      pct: z.number().min(-0.5).max(0.5),
    }),
  }),
  z.object({
    type: z.literal("analyst"),
    condition: z.object({
      direction: z.enum(["cut", "raise", "downgrade", "upgrade"]),
      min_count: z.number().int().min(1).max(10),
      within_days: z.number().int().min(1).max(30),
    }),
  }),
  z.object({
    type: z.literal("news"),
    condition: z.object({ keywords: z.array(z.string()).min(1).max(6), description: z.string().min(5) }),
  }),
]);

const HeadlineOut = z.object({
  side: z.enum(["RED", "GREEN"]),
  headline: z.string().min(10),
  window: z.string(),
  window_days: z.number().int().min(1).max(90),
  model_estimate: z.number().min(0).max(1),
  tripwire: TripwireOut,
  analog_query: z.string().min(5),
  analog_filter: z.object({
    // News and price scenarios compare with gap days (documented in the prompt); map stray values instead of failing.
    type: z.preprocess((v) => (v === "earnings" || v === "analyst" ? v : "gap"), z.enum(["earnings", "analyst", "gap"])),
    direction: z.preprocess((v) => (v === "positive" || v === "negative" ? v : "any"), z.enum(["positive", "negative", "any"])),
  }),
});

const Output = z
  .object({ headlines: z.array(HeadlineOut).length(10) })
  .refine((o) => o.headlines.filter((h) => h.side === "RED").length === 5, "Need exactly 5 RED and 5 GREEN headlines")
  .refine(
    (o) =>
      o.headlines.every((h) => {
        const t = h.tripwire;
        if (t.type === "price") return t.condition.op === "close_below" ? t.condition.pct < 0 : t.condition.pct > 0;
        if (t.type === "earnings") return t.condition.op === "below" ? t.condition.pct <= 0.01 : t.condition.pct >= -0.01;
        return true;
      }),
    "Sign error: close_below needs a negative pct, close_above a positive pct; a revenue 'below' tripwire should use a negative or near-zero pct",
  );

// The spec's system prompt, extended with the verified tripwire vocabulary.
const SYSTEM = `You're a neutral trading analyst. Given a thesis, write exactly 5 RED headlines (events that would invalidate it) and 5 GREEN headlines (events that would confirm it) within the stated horizon. Every headline has to be specific, dated or date-bounded, and falsifiable. Apply the same evidence standard and tone to both sides, and don't make GREEN more persuasive than RED.

For each, return:
- side: "RED" or "GREEN"
- headline: one sentence, like a news headline
- window: short text, e.g. "by Aug 28" or "next 10 sessions"
- window_days: integer days from the as-of date, no more than the horizon
- model_estimate: 0-1, your rough likelihood (it isn't a calibrated probability)
- tripwire: {type, condition} using ONLY these machine-checkable types:
  - price: {"op":"close_below"|"close_above","pct":-0.08}  pct is the move from the reference price as a fraction
  - earnings: {"metric":"revenue_surprise","op":"below"|"above","pct":0.02}  reported revenue vs consensus, as a fraction
  - analyst: {"direction":"cut"|"raise"|"downgrade"|"upgrade","min_count":2,"within_days":7}  price-target or rating changes
  - news: {"keywords":["..."],"description":"..."}  a news event a reader could recognise
  Only use earnings if an earnings date falls inside the horizon.
- analog_query: plain English, the type of past event to look up, e.g. "semiconductor earnings where revenue missed consensus"
- analog_filter: {"type":"earnings"|"analyst"|"gap","direction":"positive"|"negative"|"any"} the past event kind to compare with. earnings positive = revenue beat, negative = miss. analyst positive = target raises or upgrades, negative = cuts or downgrades. gap positive = opened up, negative = opened down. News and price scenarios usually compare best with gaps in the same direction.

Rules for tripwires:
- The headline must state exactly what its tripwire checks. No moving averages, no "N consecutive days", no conditions the tripwire can't test.
- Never write dollar prices or price levels in a headline. For price tripwires, state the % move from the reference close; the app computes and shows the level.
- An earnings tripwire checks reported quarterly revenue vs consensus only. Do not write guidance, margin or EPS headlines with it; use a news tripwire for those.
- Signs: a revenue miss is a negative surprise (e.g. miss by more than 2% = {"op":"below","pct":-0.02}); a beat is positive. A price drop is a negative pct.
- RED price tripwires on a long thesis use close_below with a negative pct; GREEN use close_above with a positive pct. Reverse for a short thesis.
Use a mix of tripwire types on both sides. Do not use sentiment. Return JSON only: {"headlines":[...]}`;

export async function generateHeadlines(thesis: Thesis, ctx: MarketContext): Promise<Headline[]> {
  const user = [
    `As-of date: ${thesis.asOf}`,
    `Ticker: ${thesis.ticker}`,
    `Direction: ${thesis.direction}`,
    `Horizon: ${thesis.horizonDays} days (until about ${addDays(thesis.asOf, thesis.horizonDays)})`,
    `Position size: $${thesis.sizeUsd.toLocaleString("en-US")}`,
    `Thesis: ${thesis.text}`,
    `Reference price: $${ctx.refPrice.toFixed(2)} (close ${ctx.refDate})`,
    ctx.ret20d != null ? `Last 20 sessions: ${(ctx.ret20d * 100).toFixed(1)}%` : "",
    ctx.vol20d != null ? `Annualised volatility (20 sessions): ${(ctx.vol20d * 100).toFixed(0)}%` : "",
    ctx.nextEarnings ? `Next earnings (scheduled): ${ctx.nextEarnings.date}` : "No earnings date inside the horizon is known.",
  ]
    .filter(Boolean)
    .join("\n");

  const out = await structured({ schema: Output, system: SYSTEM, user, temperature: 0.5 });

  const counters = { RED: 0, GREEN: 0 };
  return out.headlines
    .sort((a, b) => (a.side === b.side ? 0 : a.side === "RED" ? -1 : 1))
    .map((h) => {
      const n = ++counters[h.side];
      const condition = toCondition(h.tripwire);
      const { label, level } = describeTripwire(condition, thesis.ticker, ctx.refPrice);
      return {
        id: `${h.side === "RED" ? "R" : "G"}${n}`,
        side: h.side,
        headline: h.headline,
        window: condition.type === "earnings" ? `through earnings, by ${fmtDay(addDays(thesis.asOf, thesis.horizonDays))}` : h.window,
        // Earnings is a single dated event and calendar dates run early, so it stays armed for the full horizon.
        windowDays: condition.type === "earnings" ? thesis.horizonDays : Math.min(h.window_days, thesis.horizonDays),
        modelEstimate: h.model_estimate,
        tripwire: { ...condition, label, ...(level !== undefined ? { level } : {}) },
        analogQuery: h.analog_query,
        analogFilter: h.analog_filter,
        analogs: null,
      };
    });
}

function toCondition(t: z.infer<typeof TripwireOut>): TripwireCondition {
  switch (t.type) {
    case "price":
      return { type: "price", op: t.condition.op, pct: t.condition.pct };
    case "earnings":
      return { type: "earnings", metric: "revenue_surprise", op: t.condition.op, pct: t.condition.pct };
    case "analyst":
      return {
        type: "analyst",
        direction: t.condition.direction,
        minCount: t.condition.min_count,
        withinDays: t.condition.within_days,
      };
    case "news":
      return { type: "news", keywords: t.condition.keywords, description: t.condition.description };
  }
}

function fmtDay(d: string) {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
