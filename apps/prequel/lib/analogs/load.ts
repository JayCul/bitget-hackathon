import "server-only";
import { bitget, rTokenSymbol, type Kline, type QueryResult } from "@desk/bitget";
import { sessionBarsFromHourly, type DailyBar } from "@desk/market-data";
import { cached, pool } from "../cache";
import {
  alignEarningsDates,
  buildAnalystCandidates,
  buildEarningsCandidates,
  buildGapCandidates,
  reactionSession,
} from "./build";
import type { Candidate, SourceFailure, Universe } from "./types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const PAGE = 40 * DAY; // < 1000 hourly bars per request
const TTL_BARS = 6 * HOUR;
const TTL_FUNDAMENTALS = 24 * HOUR;
export const GAP_THRESHOLD = 0.04;

type Loaded<T> = { rows: T[]; failure?: string };

async function source<T>(key: string, ttl: number, q: () => Promise<QueryResult<T>>): Promise<Loaded<T>> {
  const r = await cached(key, ttl, async () => {
    const res = await q();
    return { ok: res.ok, value: res };
  });
  return r.ok ? { rows: r.rows } : { rows: [], failure: r.message };
}

/** All hourly bars for an rToken since launch, fetched in 40-day windows. */
async function hourly(ticker: string, from: number, to: number): Promise<Loaded<Kline>> {
  const symbol = rTokenSymbol(ticker);
  const windows: [number, number][] = [];
  for (let s = from; s < to; s += PAGE) windows.push([s, Math.min(s + PAGE - HOUR, to)]);
  const pages = await pool(windows, 2, ([s, e]) =>
    // Closed windows never change; cache them for a long time. The open window refreshes.
    source(`kline:${symbol}:1h:${s}:${e}`, e < to - DAY ? 30 * DAY : TTL_BARS, () =>
      bitget.spotKlines(symbol, "1h", { start: s, end: e, limit: 1000 }),
    ),
  );
  const failures = pages.filter((p) => p.failure && !p.failure.includes("no data"));
  const seen = new Set<number>();
  const rows = pages
    .flatMap((p) => p.rows)
    .filter((k) => (seen.has(k.time) ? false : (seen.add(k.time), true)))
    .sort((a, b) => a.time - b.time);
  return { rows, failure: failures.length ? failures.map((f) => f.failure).join("; ") : undefined };
}

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

async function loadTicker(ticker: string, now: number) {
  const failures: SourceFailure[] = [];
  const fail = (what: string, message?: string) => message && failures.push({ ticker, what, message });

  const market = await source(`market:${ticker}`, TTL_FUNDAMENTALS, () => bitget.rTokenMarket(ticker));
  const launch = Number(market.rows.find((m) => m.exchange === "bitget")?.launch_time);
  if (!launch) {
    fail("rToken market", market.failure ?? `No Bitget rToken for ${ticker}`);
    return { ticker, bars: [] as DailyBar[], candidates: [] as Candidate[], failures, from: null as string | null };
  }

  const [h, calendar, income, consensus, targets] = await Promise.all([
    hourly(ticker, Math.floor(launch / HOUR) * HOUR, Math.floor(now / HOUR) * HOUR),
    source(`calendar:${ticker}`, TTL_FUNDAMENTALS, () => bitget.earningsCalendar(ticker)),
    source(`income:${ticker}`, TTL_FUNDAMENTALS, () => bitget.income(ticker, 16)),
    source(`consensus:${ticker}`, TTL_FUNDAMENTALS, () => bitget.consensus(ticker)),
    source(`targets:${ticker}`, TTL_FUNDAMENTALS, () => bitget.priceTargets(ticker, 1000)),
  ]);
  fail("1h K-lines", h.failure);
  fail("earnings calendar", calendar.failure);
  fail("income statement", income.failure);
  fail("consensus", consensus.failure);
  fail("price targets", targets.failure);

  const { bars } = sessionBarsFromHourly(h.rows);
  const from = bars[0]?.date ?? isoDate(launch);
  const window = { from, to: isoDate(now) };

  const earnings = alignEarningsDates(
    buildEarningsCandidates(ticker, calendar.rows, income.rows, consensus.rows, window),
    bars,
  );
  const earningsDates = earnings.map((e) => e.date);
  const reactions = earnings.map((e) => reactionSession(e, bars)).filter((d): d is string => Boolean(d));
  const candidates = [
    ...earnings,
    ...buildAnalystCandidates(ticker, targets.rows, window, earningsDates),
    ...buildGapCandidates(ticker, bars, GAP_THRESHOLD, reactions),
  ];
  return { ticker, bars, candidates, failures, from };
}

/** Hourly rToken bars for a window (cached pages). */
export async function hourlyBars(ticker: string, from: number, to: number) {
  return hourly(ticker, Math.floor(from / HOUR) * HOUR, Math.floor(to / HOUR) * HOUR);
}

/** Raw analyst price-target rows (cached). */
export function priceTargetRows(ticker: string) {
  return source(`targets:${ticker}`, TTL_FUNDAMENTALS, () => bitget.priceTargets(ticker, 1000));
}

/** Raw earnings calendar rows (cached), for scheduled upcoming dates. */
export function calendarRows(ticker: string) {
  return source(`calendar:${ticker}`, TTL_FUNDAMENTALS, () => bitget.earningsCalendar(ticker));
}

/**
 * Point-in-time view: nothing on or after `asOf` is visible. Bars are cut at the last session
 * before asOf, candidates must precede asOf, and earnings events whose date alignment relied on a
 * reaction session at or after asOf are dropped.
 */
export function asOfUniverse(u: Universe, asOf: string): Universe {
  const bars = Object.fromEntries(Object.entries(u.bars).map(([t, b]) => [t, b.filter((x) => x.date < asOf)]));
  const candidates = u.candidates.filter((c) => {
    if (c.date >= asOf) return false;
    const reaction = c.facts.reaction_session;
    return !(c.type === "earnings" && typeof reaction === "string" && reaction >= asOf);
  });
  return { ...u, bars, candidates, window: { from: u.window.from, to: asOf } };
}

/** Load bars and candidate events for a ticker and its peers. Failures are returned, never hidden. */
export async function loadUniverse(tickers: string[], now = Date.now()): Promise<Universe> {
  const results = await pool(tickers, 3, (t) => loadTicker(t, now));
  const froms = results.map((r) => r.from).filter((x): x is string => Boolean(x)).sort();
  return {
    tickers,
    window: { from: froms[0] ?? isoDate(now), to: isoDate(now) },
    bars: Object.fromEntries(results.map((r) => [r.ticker, r.bars])),
    candidates: results.flatMap((r) => r.candidates).sort((a, b) => a.date.localeCompare(b.date)),
    failures: results.flatMap((r) => r.failures),
    barsSource: "Bitget rToken 1h K-lines, aggregated to US session (09:30-16:00 ET)",
    builtAt: new Date(now).toISOString(),
  };
}
