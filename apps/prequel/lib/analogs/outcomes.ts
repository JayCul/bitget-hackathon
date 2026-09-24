import { analogStats, eventReturn, type AnalogStats } from "@desk/market-data";
import type { AnalogOutcome, Candidate, Universe } from "./types";

/**
 * Deterministic outcomes for selected analog ids. The LLM supplies ids only; every number here
 * comes from observed bars. Unknown ids and incomplete windows are reported, not dropped silently.
 */
export function computeOutcomes(
  ids: string[],
  universe: Pick<Universe, "bars" | "candidates">,
): { outcomes: AnalogOutcome[]; stats: AnalogStats; unknownIds: string[] } {
  const byId = new Map<string, Candidate>(universe.candidates.map((c) => [c.id, c]));
  const unknownIds: string[] = [];
  const outcomes: AnalogOutcome[] = [];
  for (const id of new Set(ids)) {
    const candidate = byId.get(id);
    if (!candidate) {
      unknownIds.push(id);
      continue;
    }
    const bars = universe.bars[candidate.ticker] ?? [];
    const ret = eventReturn(bars, candidate.date, candidate.timing);
    const excluded = !ret
      ? "No price bar at or before the event"
      : ret.ret5d === null
        ? "Fewer than 5 sessions of data after the event"
        : undefined;
    outcomes.push({ candidate, ret, excluded });
  }
  outcomes.sort((a, b) => a.candidate.date.localeCompare(b.candidate.date));
  const stats = analogStats(outcomes.flatMap((o) => (o.ret && !o.excluded ? [o.ret] : [])));
  return { outcomes, stats, unknownIds };
}
