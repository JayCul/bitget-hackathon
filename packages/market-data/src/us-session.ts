// US regular-session daily bars built from 24/7 hourly bars (Bitget rTokens trade around the clock).
import type { DailyBar } from "./types";

/** NYSE full-day closures. Extend as needed; only dates inside the data window matter. */
export const NYSE_HOLIDAYS = new Set([
  "2026-01-01",
  "2026-01-19",
  "2026-02-16",
  "2026-04-03",
  "2026-05-25",
  "2026-06-19",
  "2026-07-03",
  "2026-09-07",
  "2026-11-26",
  "2026-12-25",
]);

export type HourlyBar = { time: number; open: number; high: number; low: number; close: number; volume: number };

const HOUR = 3_600_000;

/** nth Sunday of a month (UTC date number), month 0-based. */
function nthSunday(year: number, month: number, n: number) {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return 1 + ((7 - first) % 7) + (n - 1) * 7;
}

/** New York UTC offset in hours on a calendar date: -4 during DST, else -5. */
export function nyOffsetHours(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const start = Date.UTC(y, 2, nthSunday(y, 2, 2));
  const end = Date.UTC(y, 10, nthSunday(y, 10, 1));
  const t = Date.UTC(y, m - 1, d);
  return t >= start && t < end ? -4 : -5;
}

export function isTradingDay(date: string): boolean {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return dow !== 0 && dow !== 6 && !NYSE_HOLIDAYS.has(date);
}

/** UTC ms of the 09:30 open and 16:00 close for a trading date. */
export function sessionWindow(date: string): { open: number; close: number } {
  const midnight = Date.parse(`${date}T00:00:00Z`);
  const off = nyOffsetHours(date);
  return { open: midnight + (9.5 - off) * HOUR, close: midnight + (16 - off) * HOUR };
}

export type SessionBuildResult = { bars: DailyBar[]; skipped: { date: string; hours: number }[] };

/**
 * Aggregate hourly bars into one bar per US trading day.
 * Hourly bars are UTC-hour aligned, so the first included bar starts at floor(open), 30 minutes
 * before the bell. A day needs at least `minHours` of the 7 session hours or it is skipped.
 */
export function sessionBarsFromHourly(hourly: HourlyBar[], minHours = 5): SessionBuildResult {
  const byDate = new Map<string, HourlyBar[]>();
  for (const h of hourly) {
    const date = new Date(h.time).toISOString().slice(0, 10);
    // Session hours never cross UTC midnight (13:00-20:00 or 14:00-21:00 UTC).
    if (!isTradingDay(date)) continue;
    const { open, close } = sessionWindow(date);
    const from = Math.floor(open / HOUR) * HOUR;
    if (h.time < from || h.time >= close) continue;
    let list = byDate.get(date);
    if (!list) byDate.set(date, (list = []));
    list.push(h);
  }

  const bars: DailyBar[] = [];
  const skipped: SessionBuildResult["skipped"] = [];
  for (const date of [...byDate.keys()].sort()) {
    const hs = byDate.get(date)!.sort((a, b) => a.time - b.time);
    if (hs.length < minHours) {
      skipped.push({ date, hours: hs.length });
      continue;
    }
    bars.push({
      date,
      open: hs[0]!.open,
      close: hs.at(-1)!.close,
      high: Math.max(...hs.map((h) => h.high)),
      low: Math.min(...hs.map((h) => h.low)),
      volume: hs.reduce((s, h) => s + h.volume, 0),
    });
  }
  return { bars, skipped };
}
