// Historical execution replay: the same budget and plan rules across past windows.
// Cost saved uses the sampled cost model (ESTIMATED). Price effect of waiting uses real Bitget 1h
// bars (BACKTESTED). They are reported separately because timing noise can outweigh the saving.
import type { CostFn } from "./costs";
import { planExecution, type Plan, type PlanInput } from "./plan";

const HOUR = 3_600_000;
const WEEK = 7 * 24 * HOUR;

export type Bar = { t: number; open: number; high: number; low: number; close: number };

export type PeriodResult = {
  start: number;
  baselineBps: number;
  planBps: number;
  costSavedBps: number;
  costSavedUsd: number;
  /** positive = the plan's fills were cheaper than buying at the start */
  priceEffectBps: number;
  priceEffectUsd: number;
  orders: number;
};

export type BacktestResult = {
  periods: PeriodResult[];
  skipped: { start: number; reason: string }[];
  avg: { baselineBps: number; planBps: number; costSavedBps: number; costSavedUsd: number; priceEffectBps: number; priceEffectUsd: number } | null;
};

/** Typical price of the 1h bar containing t. */
export function priceAt(bars: Bar[], t: number): number | null {
  let lo = 0;
  let hi = bars.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const b = bars[mid]!;
    if (t < b.t) hi = mid - 1;
    else if (t >= b.t + HOUR) lo = mid + 1;
    else return (b.high + b.low + b.close) / 3;
  }
  return null;
}

export function periodStarts(anchor: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => anchor - (i + 1) * WEEK).reverse();
}

export function backtest(
  input: Omit<PlanInput, "start">,
  starts: number[],
  cost: CostFn,
  bars: Record<string, Bar[]>,
): BacktestResult {
  const periods: PeriodResult[] = [];
  const skipped: BacktestResult["skipped"] = [];
  for (const start of starts) {
    const plan: Plan = planExecution({ ...input, start }, cost);
    if (plan.savedBps === null || plan.baseline.bps === null) {
      skipped.push({ start, reason: plan.unplanned[0]?.reason ?? "Cost not measured for this window" });
      continue;
    }
    let priceEffectUsd = 0;
    let missing = false;
    for (const r of plan.rows) {
      const p0 = priceAt(bars[r.ticker] ?? [], start);
      const p1 = priceAt(bars[r.ticker] ?? [], r.t);
      if (!p0 || !p1) {
        missing = true;
        break;
      }
      // Buying r.usd at p1 instead of p0: extra shares, valued at p0.
      priceEffectUsd += r.usd * (p0 / p1 - 1);
    }
    if (missing) {
      skipped.push({ start, reason: "Missing Bitget 1h bars in this window" });
      continue;
    }
    const usd = plan.totals.usd;
    periods.push({
      start,
      baselineBps: plan.baseline.bps,
      planBps: plan.totals.bps,
      costSavedBps: plan.savedBps,
      costSavedUsd: plan.savedUsd!,
      priceEffectBps: (priceEffectUsd / usd) * 1e4,
      priceEffectUsd,
      orders: plan.rows.length,
    });
  }
  const avg = (f: (p: PeriodResult) => number) => periods.reduce((s, p) => s + f(p), 0) / periods.length;
  return {
    periods,
    skipped,
    avg: periods.length
      ? {
          baselineBps: avg((p) => p.baselineBps),
          planBps: avg((p) => p.planBps),
          costSavedBps: avg((p) => p.costSavedBps),
          costSavedUsd: avg((p) => p.costSavedUsd),
          priceEffectBps: avg((p) => p.priceEffectBps),
          priceEffectUsd: avg((p) => p.priceEffectUsd),
        }
      : null,
  };
}
