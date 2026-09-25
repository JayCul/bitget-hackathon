import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { bitget, rTokenSymbol } from "@desk/bitget";
import type { Bar } from "./backtest";
import { depthUsd, spreadBps, walkBuy, type Level } from "./book";
import { cached, pool } from "./cache";
import { buildCostModel, type CostModel, type Sample } from "./costs";
import { regimeAt, type Regime } from "./regime";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Assets with sampled order books (scripts/sample-spreads.mjs). */
export const ASSETS = ["NVDA", "AAPL", "SPY", "QQQ", "TSLA", "MSFT"] as const;

let model: { at: number; value: CostModel } | undefined;

/** Cost model from the sampled books shipped in data/samples. Reloaded at most once a minute. */
export async function loadModel(): Promise<CostModel> {
  if (model && Date.now() - model.at < 60_000) return model.value;
  const file = path.join(process.cwd(), "data", "samples", "spreads.jsonl");
  const text = await readFile(file, "utf8").catch(() => "");
  const samples = text
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l) as Sample;
      } catch {
        return null;
      }
    })
    .filter((s): s is Sample => s !== null);
  model = { at: Date.now(), value: buildCostModel(samples) };
  return model.value;
}

export type Snapshot = {
  ticker: string;
  symbol: string;
  at: string;
  regime: Regime;
  mid: number;
  spreadBps: number;
  depthAsk25Usd: number;
  depthBid25Usd: number;
  asks: Level[];
  bids: Level[];
};

export type SnapshotResult = { ok: true; snap: Snapshot } | { ok: false; ticker: string; message: string };

/** Live order book for an rToken. Not cached: this is the OBSERVED "now". */
export async function liveSnapshot(ticker: string): Promise<SnapshotResult> {
  const symbol = rTokenSymbol(ticker);
  const r = await bitget.orderBook(symbol, 50);
  if (!r.ok) return { ok: false, ticker, message: r.message };
  const b = r.rows[0];
  if (!b?.asks.length || !b.bids.length) return { ok: false, ticker, message: "Empty order book" };
  const m = (b.asks[0]![0] + b.bids[0]![0]) / 2;
  return {
    ok: true,
    snap: {
      ticker,
      symbol,
      at: b.timestamp,
      regime: regimeAt(Date.now()),
      mid: m,
      spreadBps: spreadBps(b.bids, b.asks),
      depthAsk25Usd: depthUsd(b.asks, m, 25),
      depthBid25Usd: depthUsd(b.bids, m, 25),
      asks: b.asks,
      bids: b.bids,
    },
  };
}

export function liveCost(snap: Snapshot, usd: number) {
  return walkBuy(snap.asks, snap.bids, usd);
}

/** Hourly rToken bars for [from, to], fetched in 40-day pages and cached. */
export async function hourlyBars(ticker: string, from: number, to: number): Promise<{ bars: Bar[]; failure?: string }> {
  const symbol = rTokenSymbol(ticker);
  const page = 40 * DAY;
  const start = Math.floor(from / HOUR) * HOUR;
  const end = Math.floor(to / HOUR) * HOUR;
  const windows: [number, number][] = [];
  for (let s = start; s < end; s += page) windows.push([s, Math.min(s + page - HOUR, end)]);
  const results = await pool(windows, 2, ([s, e]) =>
    cached(`kline:${symbol}:1h:${s}:${e}`, e < Date.now() - DAY ? 30 * DAY : HOUR, async () => {
      const r = await bitget.spotKlines(symbol, "1h", { start: s, end: e, limit: 1000 });
      return { ok: r.ok, value: r };
    }),
  );
  const failure = results.find((r) => !r.ok && r.reason === "error");
  const seen = new Set<number>();
  const bars = results
    .flatMap((r) => (r.ok ? r.rows : []))
    .filter((k) => (seen.has(k.time) ? false : (seen.add(k.time), true)))
    .map((k) => ({ t: k.time, open: k.open, high: k.high, low: k.low, close: k.close }))
    .sort((a, b) => a.t - b.t);
  return { bars, failure: failure && !failure.ok ? failure.message : undefined };
}

export async function liveSnapshots(tickers: string[]) {
  return pool(tickers, 3, (t) => liveSnapshot(t));
}
