import { describe, expect, it } from "vitest";
import { backtest, periodStarts, priceAt, type Bar } from "./backtest";
import { depthUsd, spreadBps, walkBuy, type Level } from "./book";
import { buildCostModel, costBps, costFn, type Sample } from "./costs";
import { allocate, investable } from "./money";
import { planExecution, slots } from "./plan";
import { regimeAt } from "./regime";

const at = (iso: string) => Date.parse(iso);

describe("regimeAt", () => {
  it("classifies US market states in New York time (EDT in September)", () => {
    expect(regimeAt(at("2026-09-24T14:00:00Z"))).toBe("session"); // Thu 10:00 ET
    expect(regimeAt(at("2026-09-24T12:00:00Z"))).toBe("extended"); // 08:00 ET
    expect(regimeAt(at("2026-09-24T21:00:00Z"))).toBe("extended"); // 17:00 ET
    expect(regimeAt(at("2026-09-25T05:00:00Z"))).toBe("overnight"); // Fri 01:00 ET
    expect(regimeAt(at("2026-09-26T15:00:00Z"))).toBe("weekend"); // Sat
    expect(regimeAt(at("2026-09-25T23:00:00Z"))).toBe("extended"); // Fri 19:00 ET
  });

  it("treats Friday after 20:00 ET, Sunday before 20:00 ET and holidays as weekend", () => {
    expect(regimeAt(at("2026-09-26T00:30:00Z"))).toBe("weekend"); // Fri 20:30 ET
    expect(regimeAt(at("2026-09-27T23:30:00Z"))).toBe("weekend"); // Sun 19:30 ET
    expect(regimeAt(at("2026-09-28T00:30:00Z"))).toBe("overnight"); // Sun 20:30 ET
    expect(regimeAt(at("2026-09-07T15:00:00Z"))).toBe("weekend"); // Labor Day
  });
});

const sample = (iso: string, symbol: string, spread: number, costs: Record<string, number | null>): Sample => ({
  t: at(iso),
  symbol,
  spreadBps: spread,
  buyCostBps: costs,
});

const samples: Sample[] = [
  // session (Thu 10:00-10:20 ET)
  ...[0, 10, 20].map((m) => sample(`2026-09-24T14:${String(m).padStart(2, "0")}:00Z`, "RAAPL/USDT", 2, { 500: 1, 2000: 1.5, 10000: 3 })),
  // overnight (Fri 01:00 ET)
  ...[0, 10, 20].map((m) => sample(`2026-09-25T05:${String(m).padStart(2, "0")}:00Z`, "RAAPL/USDT", 12, { 500: 7, 2000: 10, 10000: null })),
  sample("2026-09-25T05:30:00Z", "RAAPL/USDT", 12, { 500: 8, 2000: 11, 10000: 25 }),
  { t: at("2026-09-25T05:40:00Z"), symbol: "RAAPL/USDT", spreadBps: NaN, buyCostBps: {}, error: "empty" },
];

describe("cost model", () => {
  const model = buildCostModel(samples);

  it("groups samples by asset and regime with medians", () => {
    const s = model.assets.AAPL!.session!;
    expect(s.n).toBe(3);
    expect(s.spreadBps).toBe(2);
    expect(s.points).toEqual([
      [500, 1],
      [2000, 1.5],
      [10000, 3],
    ]);
    expect(model.samples).toBe(7);
  });

  it("drops sizes the book could not fill in most samples", () => {
    expect(model.assets.AAPL!.overnight!.points.map((p) => p[0])).toEqual([500, 2000]);
  });

  it("interpolates in log size and refuses unmeasured regimes", () => {
    expect(costBps(model, "AAPL", "session", 300)).toBe(1);
    expect(costBps(model, "AAPL", "session", 1000)).toBeCloseTo(1 + 0.5 * (Math.log(1000 / 500) / Math.log(4)));
    expect(costBps(model, "AAPL", "session", 40000)).toBeCloseTo(3 * 2);
    expect(costBps(model, "AAPL", "session", 60000)).toBeNull();
    expect(costBps(model, "AAPL", "weekend", 500)).toBeNull();
    expect(costBps(model, "NVDA", "session", 500)).toBeNull();
  });
});

describe("planExecution", () => {
  const model = buildCostModel(samples);
  const cost = costFn(model);
  // Alert lands Fri 25 Sep 08:00 WAT = 07:00Z = 03:00 ET (overnight). Window 24h covers Friday's session.
  const start = at("2026-09-25T07:00:00Z");

  it("moves tranches from overnight into the US session and reports the saving", () => {
    const p = planExecution({ start, windowHours: 24, assets: [{ ticker: "AAPL", usd: 1000 }], tranchesPerAsset: 2 }, cost);
    expect(p.rows).toHaveLength(2);
    for (const r of p.rows) expect(r.regime).toBe("session");
    expect(p.rows.every((r) => r.usd === 500)).toBe(true);
    expect(p.baseline.legs[0]!.regime).toBe("overnight");
    expect(p.savedBps!).toBeGreaterThan(0);
    expect(p.totals.costUsd).toBeCloseTo(1000 * 1 * 1e-4);
    // tranches are spread apart, not stacked in adjacent hours
    expect(Math.abs(p.rows[1]!.t - p.rows[0]!.t)).toBeGreaterThanOrEqual(3_600_000 * 4);
  });

  it("reports what it cannot plan instead of guessing", () => {
    const p = planExecution({ start, windowHours: 24, assets: [{ ticker: "NVDA", usd: 1000 }, { ticker: "AAPL", usd: 5 }], tranchesPerAsset: 2 }, cost);
    expect(p.unplanned.map((u) => u.ticker).sort()).toEqual(["AAPL", "NVDA"]);
    expect(p.savedBps).toBeNull();
  });

  it("caps tranches so each order meets the minimum", () => {
    const p = planExecution({ start, windowHours: 24, assets: [{ ticker: "AAPL", usd: 25 }], tranchesPerAsset: 4 }, cost);
    expect(p.rows).toHaveLength(2);
  });

  it("builds hourly slots from the start", () => {
    const s = slots(at("2026-09-25T07:20:00Z"), 3);
    expect(s.map((t) => new Date(t).toISOString().slice(11, 16))).toEqual(["07:20", "08:00", "09:00", "10:00"]);
  });
});

describe("backtest", () => {
  const model = buildCostModel(samples);
  const cost = costFn(model);
  const bars: Bar[] = [];
  // flat price 100 overnight, 99 during the session, hourly from Thu 00Z to Sat 00Z
  for (let t = at("2026-09-17T00:00:00Z"); t < at("2026-09-26T00:00:00Z"); t += 3_600_000) {
    const h = new Date(t).getUTCHours();
    const p = h >= 13 && h < 20 ? 99 : 100;
    bars.push({ t, open: p, high: p, low: p, close: p });
  }

  it("separates cost saved from the price effect of waiting", () => {
    const starts = periodStarts(at("2026-09-25T07:00:00Z"), 1);
    const r = backtest({ windowHours: 24, assets: [{ ticker: "AAPL", usd: 1000 }], tranchesPerAsset: 2 }, starts, cost, { AAPL: bars });
    expect(r.periods).toHaveLength(1);
    const p = r.periods[0]!;
    expect(p.costSavedBps).toBeGreaterThan(0);
    expect(p.priceEffectBps).toBeCloseTo((100 / 99 - 1) * 1e4);
    expect(r.avg!.costSavedUsd).toBeCloseTo(p.costSavedUsd);
  });

  it("skips windows without bars", () => {
    const r = backtest({ windowHours: 24, assets: [{ ticker: "AAPL", usd: 1000 }], tranchesPerAsset: 2 }, [at("2026-09-18T07:00:00Z")], cost, { AAPL: [] });
    expect(r.periods).toHaveLength(0);
    expect(r.skipped[0]!.reason).toMatch(/Missing/);
  });

  it("finds the bar containing a time", () => {
    expect(priceAt(bars, at("2026-09-24T14:30:00Z"))).toBe(99);
    expect(priceAt(bars, at("2030-01-01T00:00:00Z"))).toBeNull();
  });
});

describe("book", () => {
  const bids: Level[] = [
    [99, 10],
    [98, 10],
  ];
  const asks: Level[] = [
    [101, 1],
    [102, 10],
  ];
  it("walks the asks", () => {
    const w = walkBuy(asks, bids, 101 + 204)!;
    expect(w.qty).toBeCloseTo(3);
    expect(w.costBps).toBeCloseTo(((305 / 3 - 100) / 100) * 1e4);
    expect(walkBuy(asks, bids, 1e6)).toBeNull();
    expect(spreadBps(bids, asks)).toBeCloseTo(200);
    expect(depthUsd(asks, 100, 150)).toBeCloseTo(101);
  });
});

describe("money", () => {
  it("computes investable USD at the user's rate", () => {
    const r = investable(850_000, [
      { id: "a", label: "Rent", ngn: 200_000 },
      { id: "b", label: "Buffer", ngn: 150_000 },
    ], 1500);
    expect(r.investableNgn).toBe(500_000);
    expect(r.investableUsd).toBeCloseTo(333.33, 2);
  });
  it("allocates by weight", () => {
    expect(allocate(300, [{ ticker: "A", weight: 2 }, { ticker: "B", weight: 1 }])).toEqual([
      { ticker: "A", usd: 200 },
      { ticker: "B", usd: 100 },
    ]);
  });
});
