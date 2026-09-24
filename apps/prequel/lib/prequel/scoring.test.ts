import { describe, expect, it } from "vitest";
import { analogAgrees, describeTripwire, evidenceBalance, modelConviction } from "./scoring";
import type { Headline } from "./types";

const outcome = (ret5d: number | null, excluded?: string) => ({
  candidate: { id: "x", ticker: "NVDA", date: "2026-06-01", timing: "after_close" as const, type: "earnings" as const, summary: "", facts: {}, source: "", flags: [] },
  ret: ret5d === null ? null : { eventDate: "", baseDate: "", baseClose: 1, ret1d: 0, ret5d, path: [] },
  excluded,
});

const h = (id: string, side: "RED" | "GREEN", rets: (number | null)[]): Headline => ({
  id,
  side,
  headline: "",
  window: "",
  windowDays: 10,
  modelEstimate: 0.3,
  tripwire: { type: "news", keywords: [], description: "", label: "" },
  analogQuery: "",
  analogFilter: { type: "earnings", direction: "any" },
  analogs: { reason: "", droppedIds: [], stats: { n: 0, positive: 0, negative: 0, median1d: null, median5d: null }, outcomes: rets.map((r) => outcome(r)) },
});

describe("evidenceBalance", () => {
  it("counts complete analogs per side and applies the formula", () => {
    const b = evidenceBalance([h("R1", "RED", [0.1, -0.1, null]), h("R2", "RED", []), h("G1", "GREEN", [0.02, 0.03, 0.04, 0.05, 0.06, 0.07])]);
    expect(b.red).toBe(2);
    expect(b.green).toBe(6);
    expect(b.balance).toBeCloseTo(1 - 4 / 8);
    expect(b.redSupported).toBe(1);
    expect(b.greenSupported).toBe(1);
    expect(b.warning).toBe(true);
  });

  it("is null with no evidence", () => {
    expect(evidenceBalance([h("R1", "RED", [])]).balance).toBeNull();
  });
});

describe("modelConviction", () => {
  it("counts agreeing analogs and weights fired tripwires", () => {
    const hs = [h("R1", "RED", [-0.05, 0.02]), h("G1", "GREEN", [0.03, 0.01, -0.02])];
    const c = modelConviction(hs, "long");
    expect(c.redPoints).toBe(1);
    expect(c.greenPoints).toBe(2);
    expect(c.green).toBeCloseTo(2 / 3);
    const fired = modelConviction(hs, "long", ["R1"]);
    expect(fired.redPoints).toBe(6);
    expect(fired.firedRed).toBe(1);
  });

  it("flips agreement for short theses", () => {
    expect(analogAgrees("GREEN", "short", -0.03)).toBe(true);
    expect(analogAgrees("RED", "short", 0.03)).toBe(true);
    expect(analogAgrees("RED", "long", 0)).toBe(false);
  });
});

describe("describeTripwire", () => {
  it("computes price levels from the observed reference", () => {
    const d = describeTripwire({ type: "price", op: "close_below", pct: -0.08 }, "NVDA", 200);
    expect(d.level).toBeCloseTo(184);
    expect(d.label).toContain("$184.00");
  });
});
