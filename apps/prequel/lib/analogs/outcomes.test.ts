import { describe, expect, it } from "vitest";
import type { DailyBar } from "@desk/market-data";
import { computeOutcomes } from "./outcomes";
import type { Candidate } from "./types";

const closes = [100, 110, 105, 100, 120, 90, 95, 99];
const dates = ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07", "2026-08-10", "2026-08-11", "2026-08-12"];
const bars: DailyBar[] = dates.map((date, i) => ({ date, open: closes[i]!, high: closes[i]!, low: closes[i]!, close: closes[i]!, volume: 1 }));

const cand = (id: string, date: string): Candidate => ({
  id,
  ticker: "AMD",
  date,
  timing: "after_close",
  type: "earnings",
  summary: "",
  facts: {},
  source: "",
  flags: [],
});

describe("computeOutcomes", () => {
  const universe = {
    bars: { AMD: bars },
    candidates: [cand("a", "2026-08-03"), cand("b", "2026-08-07"), cand("c", "2026-08-04")],
  };

  it("computes returns from bars for known ids and reports the rest", () => {
    const r = computeOutcomes(["a", "b", "zzz", "a"], universe);
    expect(r.unknownIds).toEqual(["zzz"]);
    expect(r.outcomes).toHaveLength(2);
    const a = r.outcomes.find((o) => o.candidate.id === "a")!;
    expect(a.ret!.ret1d).toBeCloseTo(0.1);
    expect(a.ret!.ret5d).toBeCloseTo(-0.1);
    const b = r.outcomes.find((o) => o.candidate.id === "b")!;
    expect(b.excluded).toMatch(/Fewer than 5 sessions/);
    expect(r.stats.n).toBe(1);
    expect(r.stats.negative).toBe(1);
  });
});
