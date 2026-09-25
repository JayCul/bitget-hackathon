// Market state for a US-stock rToken at an instant. rTokens trade 24/7, but market makers can only
// hedge while the underlying trades, so liquidity follows the US calendar.
import { isTradingDay, nyOffsetHours } from "@desk/market-data";

export type Regime = "session" | "extended" | "overnight" | "weekend";

export const REGIME_LABEL: Record<Regime, string> = {
  session: "US session",
  extended: "Pre/post market",
  overnight: "Overnight",
  weekend: "Weekend or holiday",
};

const HOUR = 3_600_000;

/** New York wall-clock parts for an instant. */
export function nyParts(t: number) {
  const utcDate = new Date(t).toISOString().slice(0, 10);
  const ny = new Date(t + nyOffsetHours(utcDate) * HOUR);
  return { date: ny.toISOString().slice(0, 10), dow: ny.getUTCDay(), minutes: ny.getUTCHours() * 60 + ny.getUTCMinutes() };
}

export function regimeAt(t: number): Regime {
  const { date, dow, minutes } = nyParts(t);
  const eightPm = 20 * 60;
  if (dow === 6) return "weekend";
  if (dow === 0) return minutes >= eightPm ? "overnight" : "weekend";
  if (dow === 5 && minutes >= eightPm) return "weekend";
  if (!isTradingDay(date)) return minutes >= eightPm ? "overnight" : "weekend";
  if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) return "session";
  if ((minutes >= 4 * 60 && minutes < 9 * 60 + 30) || (minutes >= 16 * 60 && minutes < eightPm)) return "extended";
  return "overnight";
}
