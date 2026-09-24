// Pure tripwire evaluation over a recorded sequence. Price, earnings and analyst tripwires are
// checked here in code; news tripwires fire only from precomputed LLM matches (id + confidence).
import type { Headline } from "../prequel/types";
import type { Fire, NewsMatch, Recording, ReplayEvent, TripwireState } from "./types";

const DAY = 86_400_000;
export const NEWS_MIN_CONFIDENCE = 0.7;

export function startMs(rec: Recording) {
  return Date.parse(`${rec.start}T00:00:00Z`);
}

/** Last instant of the window: "by day N" includes all of day N. */
export function expiryMs(rec: Recording, h: Headline) {
  return startMs(rec) + (h.windowDays + 1) * DAY - 1;
}

const pct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;

function check(h: Headline, ev: ReplayEvent, rec: Recording, matches: NewsMatch[]): Omit<Fire, "headlineId" | "at" | "eventKind"> | null {
  const tw = h.tripwire;
  switch (tw.type) {
    case "price": {
      if (ev.kind !== "session_close" || tw.level === undefined) return null;
      const hit = tw.op === "close_below" ? ev.close < tw.level : ev.close > tw.level;
      return hit ? { detail: `Closed at $${ev.close.toFixed(2)}, ${tw.op === "close_below" ? "below" : "above"} $${tw.level.toFixed(2)}` } : null;
    }
    case "earnings": {
      if (ev.kind !== "earnings" || ev.surprise === null) return null;
      const hit = tw.op === "below" ? ev.surprise < tw.pct : ev.surprise > tw.pct;
      return hit ? { detail: `Revenue surprise ${pct(ev.surprise)} vs threshold ${pct(tw.pct)}` } : null;
    }
    case "analyst": {
      if (ev.kind !== "analyst") return null;
      const from = Math.max(startMs(rec), ev.at - tw.withinDays * DAY);
      const notes = rec.events.flatMap((e) => (e.kind === "analyst" && e.at >= from && e.at <= ev.at ? e.notes : []));
      const count = notes.filter((n) => {
        if (tw.direction === "upgrade" || tw.direction === "downgrade") return n.action === tw.direction;
        if (n.target === null || !n.previousTarget) return false;
        return tw.direction === "raise" ? n.target > n.previousTarget : n.target < n.previousTarget;
      }).length;
      return count >= tw.minCount ? { detail: `${count} analyst ${tw.direction}${count > 1 ? "s" : ""} within ${tw.withinDays} days` } : null;
    }
    case "news": {
      if (ev.kind !== "news") return null;
      const m = matches.find((x) => x.headlineId === h.id && x.newsId === ev.id && x.confidence >= NEWS_MIN_CONFIDENCE);
      return m ? { detail: `Matched news: "${ev.title}"`, newsId: ev.id } : null;
    }
  }
}

/** First fire per headline inside its window, in time order. */
export function evaluate(headlines: Headline[], rec: Recording, matches: NewsMatch[]): Fire[] {
  const fires: Fire[] = [];
  const events = [...rec.events].sort((a, b) => a.at - b.at);
  for (const h of headlines) {
    const end = expiryMs(rec, h);
    for (const ev of events) {
      if (ev.at < startMs(rec) || ev.at > end) continue;
      const hit = check(h, ev, rec, matches);
      if (hit) {
        fires.push({ headlineId: h.id, at: ev.at, eventKind: ev.kind, ...hit });
        break;
      }
    }
  }
  return fires.sort((a, b) => a.at - b.at);
}

export function stateAt(h: Headline, rec: Recording, fires: Fire[], now: number): TripwireState {
  const fire = fires.find((f) => f.headlineId === h.id);
  if (fire && fire.at <= now) return "FIRED";
  if (now < startMs(rec)) return "WAITING";
  if (now > expiryMs(rec, h)) return "EXPIRED";
  return "ARMED";
}
