import "server-only";
import { median } from "@desk/market-data";
import { cached } from "./cache";
import type { CostModel } from "./costs";
import { regimeAt, type Regime } from "./regime";
import { hourlyBars, liveSnapshots, loadModel } from "./server";
import type { MarketBundle } from "./types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Median hourly high-low range (bps) per market state over the last 28 days of Bitget 1h bars. */
async function volatility(ticker: string): Promise<Partial<Record<Regime, number>>> {
  return cached(`vol:${ticker}`, HOUR, async () => {
    const now = Date.now();
    const { bars, failure } = await hourlyBars(ticker, now - 28 * DAY, now);
    const by: Partial<Record<Regime, number[]>> = {};
    for (const b of bars) {
      if (!b.close) continue;
      (by[regimeAt(b.t + HOUR / 2)] ??= []).push(((b.high - b.low) / b.close) * 1e4);
    }
    const out: Partial<Record<Regime, number>> = {};
    for (const [r, xs] of Object.entries(by) as [Regime, number[]][]) if (xs.length >= 10) out[r] = median(xs)!;
    return { ok: !failure && bars.length > 0, value: out };
  });
}

/** Everything the client needs to plan and stress-test deterministically. */
export async function buildBundle(tickers: string[]): Promise<MarketBundle> {
  const [model, snaps, vols] = await Promise.all([
    loadModel(),
    liveSnapshots(tickers),
    Promise.all(tickers.map((t) => volatility(t))),
  ]);
  const assets: CostModel["assets"] = {};
  for (const t of tickers) if (model.assets[t]) assets[t] = model.assets[t];
  return {
    tickers,
    model: { ...model, assets },
    vol: Object.fromEntries(tickers.map((t, i) => [t, vols[i]!])),
    live: Object.fromEntries(
      tickers.map((t, i) => {
        const s = snaps[i]!;
        return [
          t,
          s.ok
            ? {
                ok: true as const,
                at: s.snap.at,
                regime: s.snap.regime,
                mid: s.snap.mid,
                spreadBps: s.snap.spreadBps,
                depthAsk25Usd: s.snap.depthAsk25Usd,
                asks: s.snap.asks,
                bids: s.snap.bids,
              }
            : { ok: false as const, message: s.message },
        ];
      }),
    ),
    generatedAt: new Date().toISOString(),
  };
}
