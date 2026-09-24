/** One daily bar. `date` is the exchange trading date, YYYY-MM-DD. */
export type DailyBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type DailySeries = {
  symbol: string;
  bars: DailyBar[]; // ascending by date
  source: string; // shown in the UI next to the OBSERVED tag
  fetchedAt: string; // ISO
};

export interface DailyPriceProvider {
  readonly name: string;
  daily(symbol: string): Promise<DailySeries>;
}

/**
 * When the event hit the tape relative to the session on its date.
 * after_close: the event-date close is the last pre-event price.
 * before_open: the previous session's close is the last pre-event price.
 */
export type EventTiming = "after_close" | "before_open";
