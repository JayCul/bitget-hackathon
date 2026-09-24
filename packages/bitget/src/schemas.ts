// Row schemas taken from real responses captured in docs/raw (24 Sep 2026).
// Only fields we use are declared; everything else passes through.
import { z } from "zod";

const num = z.coerce.number();

export const Kline = z.looseObject({
  date: z.string(),
  time: z.number(),
  open: num,
  high: num,
  low: num,
  close: num,
  volume: num,
});
export type Kline = z.infer<typeof Kline>;

export const SpotTicker = z.looseObject({
  symbol: z.string(),
  timestamp: z.string(),
  last: num,
  bid: num,
  ask: num,
  bid_volume: num.nullable(),
  ask_volume: num.nullable(),
  vwap: num.nullable(),
  volume: num.nullable(),
});
export type SpotTicker = z.infer<typeof SpotTicker>;

export const OrderBook = z.looseObject({
  symbol: z.string(),
  timestamp: z.string(),
  bids: z.array(z.tuple([num, num])),
  asks: z.array(z.tuple([num, num])),
});
export type OrderBook = z.infer<typeof OrderBook>;

export const Market = z.looseObject({
  exchange: z.string(),
  symbol: z.string(),
  base: z.string(),
  quote: z.string(),
  market_type: z.string(),
  is_rwa: z.boolean(),
  category: z.string().nullable(),
  min_order_amount: z.string().nullable(),
  status: z.string(),
  launch_time: z.string().nullable(),
});
export type Market = z.infer<typeof Market>;

export const EquityQuote = z.looseObject({
  symbol: z.string(),
  last_price: num,
  prev_close: num.nullable(),
  change_percent: num.nullable(),
  total_market_cap: num.nullable(),
});
export type EquityQuote = z.infer<typeof EquityQuote>;

export const EarningsCalendarRow = z.looseObject({
  symbol: z.string(),
  period_ending: z.string(),
  fiscal_year: z.string(),
  report_type_name: z.string(),
  /** actual results-briefing date, when known */
  perf_brief_dsclsr_date: z.string().nullable().optional(),
  /** report filing date */
  perf_report_dsclsr_date: z.string().nullable(),
  /** scheduled briefing date (forecast) */
  perf_briefing_fore_dsclsr_date: z.string().nullable(),
  /** "盘后" = after close, "盘前" = before open */
  is_trading_time: z.string().nullable(),
});
export type EarningsCalendarRow = z.infer<typeof EarningsCalendarRow>;

export const PriceTargetRow = z.looseObject({
  published_date: z.string(),
  symbol: z.string(),
  analyst_firm: z.string().nullable(),
  price_target: num.nullable(),
  price_target_previous: num.nullable(),
  rating_current: z.string().nullable(),
  rating_previous: z.string().nullable(),
  action: z.string().nullable(),
  time: z.number(),
});
export type PriceTargetRow = z.infer<typeof PriceTargetRow>;

export const ConsensusRow = z.looseObject({
  symbol: z.string(),
  fore_indicator_name: z.string(),
  report_period_scraped: z.string().nullable(),
  fiscal_year: z.number().nullable(),
  fore_mean: num.nullable(),
  fore_org_num: num.nullable(),
  data_source: z.string().nullable().optional(),
  scraped_date: z.string(),
});
export type ConsensusRow = z.infer<typeof ConsensusRow>;

export const IncomeRow = z.looseObject({
  period_ending: z.string(),
  fiscal_period: z.string(),
  fiscal_year: z.number(),
  symbol: z.string(),
  revenue: num.nullable(),
  total_dlt_earnings_common_ps: num.nullable(),
  announcement_date: z.string().nullable(),
});
export type IncomeRow = z.infer<typeof IncomeRow>;

export const NewsRow = z.looseObject({
  title: z.string(),
  content: z.string().nullable(),
  labels: z.unknown(),
  language: z.string().nullable(),
  published_at: z.string(),
  date: z.string(),
});
export type NewsRow = z.infer<typeof NewsRow>;
