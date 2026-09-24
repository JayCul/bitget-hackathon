import { doQuery } from "./query";
import * as S from "./schemas";

export * from "./schemas";
export { BitgetMcpError } from "./mcp";
export { doQuery, unwrap, type QueryResult } from "./query";

/** rToken spot symbol for a US ticker on Bitget, e.g. NVDA -> RNVDA/USDT (verified naming). */
export const rTokenSymbol = (ticker: string) => `R${ticker.toUpperCase()}/USDT`;

export const bitget = {
  rTokenMarket: (ticker: string) =>
    doQuery("crypto_market", { symbol: rTokenSymbol(ticker), is_rwa: true, market_type: "spot" }, S.Market),

  spotTicker: (symbol: string) => doQuery("crypto_spot_ticker", { symbol, exchange: "bitget" }, S.SpotTicker),

  orderBook: (symbol: string, limit = 50) =>
    doQuery("crypto_spot_order_book", { symbol, exchange: "bitget", limit }, S.OrderBook),

  /** interval "1h" and "1d" verified. start/end in ms. Max 1000 rows per call. */
  spotKlines: (symbol: string, interval: string, opts: { start?: number; end?: number; limit?: number } = {}) =>
    doQuery(
      "crypto_spot_kline",
      {
        symbol,
        exchange: "bitget",
        interval,
        limit: opts.limit ?? 1000,
        ...(opts.start ? { start_time: opts.start } : {}),
        ...(opts.end ? { end_time: opts.end } : {}),
      },
      S.Kline,
    ),

  equityQuote: (symbol: string) => doQuery("equity_price_quote", { symbol }, S.EquityQuote),
  earningsCalendar: (symbol: string) => doQuery("equity_calendar", { symbol }, S.EarningsCalendarRow),
  priceTargets: (symbol: string, limit = 1000) =>
    doQuery("equity_estimates_price_target", { symbol, limit }, S.PriceTargetRow),
  consensus: (symbol: string) => doQuery("equity_estimates_consensus", { symbol }, S.ConsensusRow),
  income: (symbol: string, limit = 16) => doQuery("equity_fundamental_income", { symbol, limit }, S.IncomeRow),

  /** label 2 = Stocks. start/end accept ISO strings. History starts ~Apr 2026. No ticker filter. */
  stockNews: (opts: { start?: string; end?: string; pageSize?: number; page?: number } = {}) =>
    doQuery(
      "news_label_search",
      {
        label: 2,
        page_size: opts.pageSize ?? 100,
        page: opts.page ?? 1,
        ...(opts.start ? { start_time: opts.start } : {}),
        ...(opts.end ? { end_time: opts.end } : {}),
      },
      S.NewsRow,
    ),
};
