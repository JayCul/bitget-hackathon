import "server-only";
import type { DailyBar } from "@desk/market-data";
import { calendarRows } from "../analogs/load";
import type { MarketContext } from "./types";

function stdev(xs: number[]) {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

/** Observed reference price and simple stats from session bars before asOf. */
export function contextFromBars(bars: DailyBar[]): Omit<MarketContext, "nextEarnings"> | null {
  const last = bars.at(-1);
  if (!last) return null;
  const window = bars.slice(-21);
  const rets = window.slice(1).map((b, i) => b.close / window[i]!.close - 1);
  return {
    refPrice: last.close,
    refDate: last.date,
    ret20d: window.length >= 21 ? last.close / window[0]!.close - 1 : null,
    vol20d: rets.length >= 10 ? stdev(rets) * Math.sqrt(252) : null,
    sessions: bars.length,
  };
}

/** Next scheduled earnings date on or after asOf, from the Bitget calendar (scheduled, not aligned). */
export async function nextEarnings(ticker: string, asOf: string): Promise<MarketContext["nextEarnings"]> {
  const cal = await calendarRows(ticker);
  const dates = cal.rows
    .flatMap((r) => [r.perf_brief_dsclsr_date, r.perf_report_dsclsr_date, r.perf_briefing_fore_dsclsr_date])
    .filter((d): d is string => Boolean(d) && (d as string) >= asOf)
    .sort();
  return dates[0] ? { date: dates[0], source: "Bitget equity_calendar (scheduled; observed to run 1 session early)" } : null;
}
