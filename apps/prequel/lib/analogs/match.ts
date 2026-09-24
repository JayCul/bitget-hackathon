import "server-only";
import { structured } from "@desk/llm";
import { z } from "zod";
import type { Candidate, CandidateType } from "./types";

export type AnalogQuery = {
  headlineId: string;
  headline: string;
  analogQuery: string;
  /** which candidate types can match; routes the query so the prompt stays small */
  types: CandidateType[];
};

const MAX_PER_QUERY = 10;

const Selection = z.object({
  matches: z.array(
    z.object({
      headline_id: z.string(),
      ids: z.array(z.string()).max(MAX_PER_QUERY * 3),
      // Shown numbers come from code only, so the AI's reason may not contain digits.
      reason: z.string().refine((s) => !/\d/.test(s), "reason must not contain numbers"),
    }),
  ),
});

const SYSTEM = `You match trade scenarios to past market events.
Candidates are lines of: id|date|ticker|description|flags. Queries are lines of: headline_id: what to look for.
For each query, return ids of candidates that are the same kind of event, up to ${MAX_PER_QUERY}.
- Use ids exactly as given. Never invent ids.
- Match on substance: direction (beat vs miss, raise vs cut, up vs down gap) and type.
- Descriptions contain no price outcomes. Do not guess outcomes.
- Prefer the thesis ticker, then peers. "rx" flag = reaction to another event, "pe" = right after earnings.
- An empty list is valid. Do not pad.
- reason: one short sentence, no numbers or percentages (the app shows computed figures separately).
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
  byHeadline: Record<string, { ids: string[]; reason: string; droppedIds: string[] }>;
  calls: number;
};

/**
 * The LLM identifies analogs by short id. Code maps ids back, validates them, caps counts, and
 * drops a gap-day candidate when the earnings event it reacts to is also selected.
 * Queries are grouped by allowed types; one sequential call per group keeps each prompt small.
 */
export async function matchAnalogs(ticker: string, queries: AnalogQuery[], candidates: Candidate[]): Promise<MatchResult> {
  const groups = new Map<string, AnalogQuery[]>();
  for (const q of queries) {
    const key = [...new Set(q.types)].sort().join(",");
    groups.set(key, [...(groups.get(key) ?? []), q]);
  }

  const byHeadline: MatchResult["byHeadline"] = {};
  let calls = 0;
  for (const [key, qs] of groups) {
    const types = key.split(",") as CandidateType[];
    const pool = candidates.filter((c) => types.includes(c.type));
    const shortToFull = new Map<string, Candidate>();
    const counters: Partial<Record<CandidateType, number>> = {};
    const lines = pool.map((c) => {
      const n = (counters[c.type] = (counters[c.type] ?? 0) + 1);
      const sid = `${PREFIX[c.type]}${n}`;
      shortToFull.set(sid, c);
      return `${sid}|${compact(c)}`;
    });

    const user = [
      `Thesis ticker: ${ticker}`,
      "Candidates:",
      ...lines,
      "Queries:",
      ...qs.map((q) => `${q.headlineId}: ${q.analogQuery} (scenario: ${q.headline})`),
    ].join("\n");

    const out = pool.length
      ? await structured({ schema: Selection, system: SYSTEM, user, temperature: 0.1 })
      : { matches: [] };
    if (pool.length) calls++;

    for (const q of qs) {
      const m = out.matches.find((x) => x.headline_id === q.headlineId);
      const raw = [...new Set(m?.ids ?? [])];
      const droppedIds = raw.filter((id) => !shortToFull.has(id));
      const chosen = raw.flatMap((id) => shortToFull.get(id) ?? []);
      const earningsTickers = new Set(chosen.filter((c) => c.type === "earnings").map((c) => c.ticker));
      const ids = chosen
        .filter((c) => !(c.type === "gap" && c.flags.includes("earnings_reaction") && earningsTickers.has(c.ticker)))
        .map((c) => c.id)
        .slice(0, MAX_PER_QUERY);
      byHeadline[q.headlineId] = { ids, reason: m?.reason ?? "", droppedIds };
    }
  }
  return { byHeadline, calls };
}
