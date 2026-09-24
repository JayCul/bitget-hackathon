// Deterministic pre-filter: narrows the candidate pool to events of the right type and direction,
// so the LLM chooses among a short, relevant list and cannot pick a beat for a miss scenario.
import type { Candidate, CandidateType } from "./types";

export type AnalogDirection = "positive" | "negative" | "any";
export type AnalogFilter = { type: CandidateType; direction: AnalogDirection };

export const SHORTLIST_MAX = 15;

/** Sign of an event: earnings = revenue surprise, analyst = net raises/upgrades vs cuts/downgrades, gap = gap. */
export function eventSign(c: Candidate): number | null {
  const f = c.facts;
  if (c.type === "earnings") return typeof f.revenue_surprise === "number" ? Math.sign(f.revenue_surprise) : null;
  if (c.type === "gap") return typeof f.gap === "number" ? Math.sign(f.gap) : null;
  const n = (k: string) => (typeof f[k] === "number" ? (f[k] as number) : 0);
  const score = n("target_raises") + n("upgrades") - n("target_cuts") - n("downgrades");
  return score === 0 && n("initiations") > 0 ? 1 : Math.sign(score);
}

const REACTION_FLAGS = ["earnings_reaction", "post_earnings"];

export function shortlist(candidates: Candidate[], filter: AnalogFilter, ticker: string, max = SHORTLIST_MAX): Candidate[] {
  const want = filter.direction === "positive" ? 1 : filter.direction === "negative" ? -1 : null;
  return candidates
    .filter((c) => c.type === filter.type)
    .filter((c) => (want === null ? true : eventSign(c) === want))
    .sort((a, b) => {
      const own = Number(b.ticker === ticker) - Number(a.ticker === ticker);
      if (own) return own;
      const reactA = Number(a.flags.some((f) => REACTION_FLAGS.includes(f)));
      const reactB = Number(b.flags.some((f) => REACTION_FLAGS.includes(f)));
      if (reactA !== reactB) return reactA - reactB;
      return b.date.localeCompare(a.date);
    })
    .slice(0, max);
}
