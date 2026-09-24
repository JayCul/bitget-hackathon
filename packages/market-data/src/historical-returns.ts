import type { DailyBar, EventTiming } from "./types";

export type EventReturn = {
  eventDate: string;
  baseDate: string;
  baseClose: number;
  /** close-to-close, as a fraction (0.05 = +5%). null when the window runs past available data. */
  ret1d: number | null;
  ret5d: number | null;
  /** closes from base through +5 sessions, for the price-path sparkline */
  path: { date: string; close: number }[];
};

/** Index of the last bar strictly before `date`, or the bar on `date` when inclusive. -1 if none. */
function anchorIndex(bars: DailyBar[], date: string, inclusive: boolean): number {
  let lo = 0;
  let hi = bars.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const d = bars[mid]!.date;
    if (d < date || (inclusive && d === date)) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

export function closeToClose(base: number, target: number): number {
  return (target - base) / base;
}

/**
 * Close-to-close returns +1 and +5 sessions after an event.
 * Base = last close before the event reached the market (see EventTiming).
 * Returns null when there is no base bar (event predates the series).
 */
export function eventReturn(bars: DailyBar[], eventDate: string, timing: EventTiming): EventReturn | null {
  if (timing === "at_open") {
    // Base is the open of the event session; +1d is that session's close, +5d four sessions later.
    const i = bars.findIndex((b) => b.date === eventDate);
    if (i < 0) return null;
    const base = bars[i]!;
    const b1 = bars[i];
    const b5 = bars[i + 4];
    return {
      eventDate,
      baseDate: base.date,
      baseClose: base.open,
      ret1d: b1 ? closeToClose(base.open, b1.close) : null,
      ret5d: b5 ? closeToClose(base.open, b5.close) : null,
      path: [{ date: base.date, close: base.open }, ...bars.slice(i, i + 5).map((b) => ({ date: b.date, close: b.close }))],
    };
  }
  const i = anchorIndex(bars, eventDate, timing === "after_close");
  if (i < 0) return null;
  const base = bars[i]!;
  // An event on a non-trading date anchors to the prior close under either timing, which is correct.
  const b1 = bars[i + 1];
  const b5 = bars[i + 5];
  const path = bars.slice(i, i + 6).map((b) => ({ date: b.date, close: b.close }));
  return {
    eventDate,
    baseDate: base.date,
    baseClose: base.close,
    ret1d: b1 ? closeToClose(base.close, b1.close) : null,
    ret5d: b5 ? closeToClose(base.close, b5.close) : null,
    path,
  };
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export type AnalogStats = {
  n: number;
  positive: number; // count of ret5d > 0
  negative: number; // count of ret5d < 0
  median1d: number | null;
  median5d: number | null;
};

/** Aggregate over analogs with a complete +5d window. Flat (0) outcomes count as neither. */
export function analogStats(returns: EventReturn[]): AnalogStats {
  const complete = returns.filter((r) => r.ret1d !== null && r.ret5d !== null);
  const r1 = complete.map((r) => r.ret1d as number);
  const r5 = complete.map((r) => r.ret5d as number);
  return {
    n: complete.length,
    positive: r5.filter((x) => x > 0).length,
    negative: r5.filter((x) => x < 0).length,
    median1d: median(r1),
    median5d: median(r5),
  };
}

/** Largest absolute open-vs-previous-close gaps, as candidate "big gap day" events. */
export function gapDays(bars: DailyBar[], minAbsGap: number): { date: string; gap: number }[] {
  const out: { date: string; gap: number }[] = [];
  for (let k = 1; k < bars.length; k++) {
    const prev = bars[k - 1]!;
    const cur = bars[k]!;
    const gap = closeToClose(prev.close, cur.open);
    if (Math.abs(gap) >= minAbsGap) out.push({ date: cur.date, gap });
  }
  return out;
}
