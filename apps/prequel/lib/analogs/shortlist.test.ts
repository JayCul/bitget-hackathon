import { describe, expect, it } from "vitest";
import { eventSign, shortlist } from "./shortlist";
import type { Candidate } from "./types";

const c = (id: string, type: Candidate["type"], ticker: string, date: string, facts: Candidate["facts"], flags: string[] = []): Candidate => ({
  id,
  ticker,
  date,
  timing: "after_close",
  type,
  summary: "",
  facts,
  source: "",
  flags,
});

const pool = [
  c("e1", "earnings", "MU", "2026-06-24", { revenue_surprise: 0.18 }),
  c("e2", "earnings", "NVDA", "2026-05-20", { revenue_surprise: 0.03 }),
  c("e3", "earnings", "TXN", "2026-07-22", { revenue_surprise: -0.01 }),
  c("e4", "earnings", "AMD", "2026-08-04", { revenue_surprise: null }),
  c("a1", "analyst", "NVDA", "2026-07-01", { target_raises: 0, target_cuts: 2, upgrades: 0, downgrades: 0, initiations: 0 }),
  c("a2", "analyst", "AMD", "2026-07-02", { target_raises: 0, target_cuts: 0, upgrades: 0, downgrades: 0, initiations: 1 }),
  c("g1", "gap", "NVDA", "2026-06-01", { gap: -0.05 }, ["earnings_reaction"]),
  c("g2", "gap", "AMD", "2026-06-02", { gap: -0.06 }),
  c("g3", "gap", "NVDA", "2026-06-03", { gap: -0.04 }),
];

describe("eventSign", () => {
  it("reads direction per type", () => {
    expect(eventSign(pool[0]!)).toBe(1);
    expect(eventSign(pool[3]!)).toBeNull();
    expect(eventSign(pool[4]!)).toBe(-1);
    expect(eventSign(pool[5]!)).toBe(1); // initiation counts as positive
  });
});

describe("shortlist", () => {
  it("filters by type and direction, own ticker first, then most recent", () => {
    expect(shortlist(pool, { type: "earnings", direction: "positive" }, "NVDA").map((x) => x.id)).toEqual(["e2", "e1"]);
    expect(shortlist(pool, { type: "earnings", direction: "negative" }, "NVDA").map((x) => x.id)).toEqual(["e3"]);
    expect(shortlist(pool, { type: "earnings", direction: "any" }, "NVDA")).toHaveLength(4);
  });

  it("puts independent events before reactions", () => {
    expect(shortlist(pool, { type: "gap", direction: "negative" }, "NVDA").map((x) => x.id)).toEqual(["g3", "g1", "g2"]);
  });

  it("caps the list", () => {
    expect(shortlist(pool, { type: "gap", direction: "any" }, "NVDA", 2)).toHaveLength(2);
  });
});
