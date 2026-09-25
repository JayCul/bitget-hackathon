// Cost model built only from sampled Bitget order books (scripts/sample-spreads.mjs).
// cost(asset, regime, usd) = median measured cost of a market buy of that size, in bps vs mid.
import { median } from "@desk/market-data";
import { regimeAt, type Regime } from "./regime";

export type Sample = {
  t: number;
  symbol: string;
  spreadBps: number;
  buyCostBps: Record<string, number | null>;
  depthAsk25Usd?: number;
  error?: string;
};

export type RegimeStats = {
  n: number;
  spreadBps: number;
  /** [order size USD, median buy cost bps], ascending by size */
  points: [number, number][];
  depthAsk25Usd: number | null;
};

export type CostModel = {
  assets: Record<string, Partial<Record<Regime, RegimeStats>>>;
  samples: number;
  from: number | null;
  to: number | null;
};

export const MIN_SAMPLES = 3;
const MAX_EXTRAPOLATE = 5; // allow up to 5x the largest sampled size

export const tickerOf = (symbol: string) => symbol.replace(/^R/, "").replace(/\/USDT$/, "");

export function buildCostModel(samples: Sample[]): CostModel {
  const ok = samples.filter((s) => !s.error && Number.isFinite(s.spreadBps));
  const groups = new Map<string, Sample[]>();
  for (const s of ok) {
    const key = `${tickerOf(s.symbol)}|${regimeAt(s.t)}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  const assets: CostModel["assets"] = {};
  for (const [key, list] of groups) {
    if (list.length < MIN_SAMPLES) continue;
    const [ticker, regime] = key.split("|") as [string, Regime];
    const sizes = [...new Set(list.flatMap((s) => Object.keys(s.buyCostBps).map(Number)))].sort((a, b) => a - b);
    const points: [number, number][] = [];
    for (const size of sizes) {
      const vals = list.map((s) => s.buyCostBps[String(size)]).filter((v): v is number => typeof v === "number");
      // A size the book could not fill in most samples is not offered.
      if (vals.length * 2 < list.length) continue;
      points.push([size, median(vals)!]);
    }
    if (!points.length) continue;
    const depths = list.map((s) => s.depthAsk25Usd).filter((v): v is number => typeof v === "number");
    (assets[ticker] ??= {})[regime] = {
      n: list.length,
      spreadBps: median(list.map((s) => s.spreadBps))!,
      points,
      depthAsk25Usd: median(depths),
    };
  }
  const ts = ok.map((s) => s.t);
  return { assets, samples: ok.length, from: ts.length ? Math.min(...ts) : null, to: ts.length ? Math.max(...ts) : null };
}

/** Median cost in bps to buy `usd` in a regime, interpolated in log size. null when not measured. */
export function costBps(model: CostModel, ticker: string, regime: Regime, usd: number): number | null {
  const stats = model.assets[ticker]?.[regime];
  if (!stats) return null;
  const pts = stats.points;
  const first = pts[0]!;
  const last = pts.at(-1)!;
  if (usd <= first[0]) return first[1];
  if (usd >= last[0]) {
    if (usd > last[0] * MAX_EXTRAPOLATE) return null;
    // Beyond the sampled book: square-root growth of the last measured cost.
    return last[1] * Math.sqrt(usd / last[0]);
  }
  for (let i = 1; i < pts.length; i++) {
    const [s1, c1] = pts[i]!;
    const [s0, c0] = pts[i - 1]!;
    if (usd <= s1) {
      const f = (Math.log(usd) - Math.log(s0)) / (Math.log(s1) - Math.log(s0));
      return c0 + f * (c1 - c0);
    }
  }
  return last[1];
}

export type CostFn = (ticker: string, t: number, usd: number) => { bps: number; regime: Regime } | null;

export function costFn(model: CostModel): CostFn {
  return (ticker, t, usd) => {
    const regime = regimeAt(t);
    const bps = costBps(model, ticker, regime, usd);
    return bps === null ? null : { bps, regime };
  };
}
