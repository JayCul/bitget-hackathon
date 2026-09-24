import "server-only";
import { structured } from "@desk/llm";
import { z } from "zod";
import { shortlist, type AnalogFilter } from "./shortlist";
import type { Candidate, CandidateType } from "./types";

export type AnalogQuery = {
  headlineId: string;
  headline: string;
  analogQuery: string;
  filter: AnalogFilter;
};

const MAX_PER_QUERY = 10;

const MIN_PER_QUERY = 5;

const Selection = z.object({
  matches: z.array(z.object({ headline_id: z.string(), ids: z.array(z.string()).max(40), reason: z.string() })),
});

/** Per-call schema: every query with a non-empty shortlist must get at least min(5, n) ids. */
function selectionFor(sizes: Record<string, number>) {
  return Selection.superRefine((o, ctx) => {
    for (const [id, n] of Object.entries(sizes)) {
      const need = Math.min(MIN_PER_QUERY, n);
      const got = o.matches.find((m) => m.headline_id === id)?.ids.length ?? 0;
      if (got < need) ctx.addIssue({ code: "custom", message: `${id} needs at least ${need} ids from its list, got ${got}` });
    }
  });
}

const SYSTEM = `You match trade scenarios to past market events.
Each query comes with its own short list of candidate events (id|date|ticker|description|flags), already filtered by code to the right type and direction.
For each query, rank the ids from THAT query's list by how closely they resemble the scenario and return the best ${MIN_PER_QUERY} to ${MAX_PER_QUERY} (all of them if the list is shorter than ${MIN_PER_QUERY}).
- Peers count: an event on another semiconductor stock is a valid analog.
- Only use ids listed under that query. Never invent ids.
- Descriptions contain no price outcomes. Do not guess outcomes.
- Prefer the thesis ticker, then close peers. "rx" = reaction to another event, "pe" = right after earnings.
- reason: one short sentence, no numbers or percentages.
JSON only: {"matches":[{"headline_id":"...","ids":["..."],"reason":"..."}]}`;

const PREFIX: Record<CandidateType, string> = { earnings: "e", analyst: "a", gap: "g" };
const FLAG: Record<string, string> = { earnings_reaction: "rx", post_earnings: "pe" };

/** Short, outcome-free description for the prompt. */
function compact(c: Candidate): string {
  const f = c.facts;
  const pct = (x: unknown) => (typeof x === "number" ? `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%` : "n/a");
  let d: string;
  if (c.type === "earnings") {
    d = `earnings ${f.quarter}; rev surprise ${pct(f.revenue_surprise)}; rev YoY ${pct(f.revenue_yoy)}`;
  } else if (c.type === "analyst") {
    const parts = [`${f.target_raises} raise ${f.target_cuts} cut`];
    if (typeof f.median_target_change === "number") parts.push(`med PT ${pct(f.median_target_change)}`);
    if (f.upgrades) parts.push(`${f.upgrades} upgrade`);
    if (f.downgrades) parts.push(`${f.downgrades} downgrade`);
    if (f.initiations) parts.push(`${f.initiations} init`);
    d = parts.join(", ");
  } else {
    d = `open gap ${pct(f.gap)}`;
  }
  const flags = c.flags.map((x) => FLAG[x]).filter(Boolean);
  return `${c.date}|${c.ticker}|${d}${flags.length ? `|${flags.join(",")}` : ""}`;
}

export type MatchResult = {
  byHeadline: Record<string, { ids: string[]; reason: string; droppedIds: string[]; shortlisted: number }>;
  calls: number;
};

/**
 * Code shortlists candidates per query (type + direction). The LLM picks ids from each shortlist.
 * Code validates ids against that query's shortlist, caps counts, and drops a gap-day candidate when
 * the earnings event it reacts to is also selected. One call for all queries.
 */
export async function matchAnalogs(ticker: string, queries: AnalogQuery[], candidates: Candidate[]): Promise<MatchResult> {
  const sidOf = new Map<string, string>();
  const bySid = new Map<string, Candidate>();
  const counters: Partial<Record<CandidateType, number>> = {};
  const sid = (c: Candidate) => {
    let s = sidOf.get(c.id);
    if (!s) {
      const n = (counters[c.type] = (counters[c.type] ?? 0) + 1);
      s = `${PREFIX[c.type]}${n}`;
      sidOf.set(c.id, s);
      bySid.set(s, c);
    }
    return s;
  };

  const lists = queries.map((q) => ({ q, items: shortlist(candidates, q.filter, ticker) }));
  const user = [
    `Thesis ticker: ${ticker}`,
    ...lists.flatMap(({ q, items }) => [
      "",
      `Query ${q.headlineId}: ${q.analogQuery} (scenario: ${q.headline})`,
      ...(items.length ? items.map((c) => `${sid(c)}|${compact(c)}`) : ["(no candidates)"]),
    ]),
  ].join("\n");

  const needsLlm = lists.some((l) => l.items.length > 0);
  const sizes = Object.fromEntries(lists.filter((l) => l.items.length).map((l) => [l.q.headlineId, l.items.length]));
  const out = needsLlm ? await structured({ schema: selectionFor(sizes), system: SYSTEM, user, temperature: 0.1 }) : { matches: [] };

  const byHeadline: MatchResult["byHeadline"] = {};
  for (const { q, items } of lists) {
    const allowed = new Set(items.map((c) => sidOf.get(c.id)!));
    const m = out.matches.find((x) => x.headline_id === q.headlineId);
    const raw = [...new Set(m?.ids ?? [])];
    const droppedIds = raw.filter((id) => !allowed.has(id));
    const chosen = raw.filter((id) => allowed.has(id)).map((id) => bySid.get(id)!);
    const earningsTickers = new Set(chosen.filter((c) => c.type === "earnings").map((c) => c.ticker));
    const ids = chosen
      .filter((c) => !(c.type === "gap" && c.flags.includes("earnings_reaction") && earningsTickers.has(c.ticker)))
      .map((c) => c.id)
      .slice(0, MAX_PER_QUERY);
    // Shown numbers come from code only: a reason that contains figures is withheld, ids are kept.
    const reason = m?.reason && !/\d/.test(m.reason) ? m.reason : "";
    byHeadline[q.headlineId] = { ids, reason, droppedIds, shortlisted: items.length };
  }
  return { byHeadline, calls: needsLlm ? 1 : 0 };
}
