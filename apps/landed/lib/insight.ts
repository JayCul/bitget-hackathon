// Pure helpers the client uses to plan and explain, from measured inputs only.
import { costBps, costFn, type CostFn } from "./costs";
import { planExecution, slots, type Plan, type PlanInput } from "./plan";
import { regimeAt, type Regime } from "./regime";
import type { MarketBundle } from "./types";

/** Cost function with an optional uniform stress multiplier (what-if: liquidity worsens). */
export function stressedCost(bundle: MarketBundle, stress = 1): CostFn {
  const base = costFn(bundle.model);
  return (ticker, t, usd) => {
    const c = base(ticker, t, usd);
    return c ? { ...c, bps: c.bps * stress } : null;
  };
}

export function makePlan(bundle: MarketBundle, input: PlanInput, stress = 1): Plan {
  return planExecution(input, stressedCost(bundle, stress));
}

export type TerrainPoint = { t: number; regime: Regime; bps: number | null };

/** Average measured cost across the basket for each hourly slot of the window (null = not measured). */
export function terrain(bundle: MarketBundle, input: PlanInput, stress = 1): TerrainPoint[] {
  const cost = stressedCost(bundle, stress);
  return slots(input.start, input.windowHours).map((t) => {
    const vals = input.assets
      .map((a) => cost(a.ticker, t, a.usd / Math.max(1, input.tranchesPerAsset))?.bps)
      .filter((v): v is number => typeof v === "number");
    return { t, regime: regimeAt(t), bps: vals.length === input.assets.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null };
  });
}

export type DepthLevel = "HIGH" | "MEDIUM" | "LOW";

/** Depth within 25 bps relative to the order: 20x or more HIGH, 5x MEDIUM, less LOW. */
export function depthLevel(depthUsd: number | null | undefined, orderUsd: number): DepthLevel | null {
  if (depthUsd == null || !orderUsd) return null;
  const k = depthUsd / orderUsd;
  return k >= 20 ? "HIGH" : k >= 5 ? "MEDIUM" : "LOW";
}

export type Signals = {
  spreadBps: number | null; // sampled median in this market state
  depthUsd: number | null; // sampled median, within 25 bps
  depth: DepthLevel | null;
  volBps: number | null; // median hourly range in this state (Bitget 1h)
  costBps: number | null;
  samples: number;
};

export function signals(bundle: MarketBundle, ticker: string, regime: Regime, usd: number, stress = 1): Signals {
  const st = bundle.model.assets[ticker]?.[regime];
  const c = costBps(bundle.model, ticker, regime, usd);
  return {
    spreadBps: st?.spreadBps ?? null,
    depthUsd: st?.depthAsk25Usd ?? null,
    depth: depthLevel(st?.depthAsk25Usd, usd),
    volBps: bundle.vol[ticker]?.[regime] ?? null,
    costBps: c === null ? null : c * stress,
    samples: st?.n ?? 0,
  };
}

/** Cost per hour across the window for one asset at a given order size. */
export function assetTrace(bundle: MarketBundle, ticker: string, input: PlanInput, usd: number, stress = 1) {
  const cost = stressedCost(bundle, stress);
  return slots(input.start, input.windowHours).map((t) => ({ t, bps: cost(ticker, t, usd)?.bps ?? null }));
}
