# Verified capabilities

Verified 24 Sep 2026 against `https://agent.bitget.com/mcp` (bitget-mcp-server 4.0.5, HTTP, no key).
Probe script: `scripts/mcp-probe.mjs`. Full raw responses: `docs/raw/*.json`.

Network note: this network (Lagos ISP) blocks Bitget at DNS and TCP level. Local dev needs a VPN. Vercel functions are unaffected.

## Transport

The server exposes 2 meta-tools, not one tool per dataset:

| Tool | Args | Purpose |
|---|---|---|
| `guide` | `category?`, `subcategory?`, `keyword?` | List categories (`crypto`, `equity`, `etf`, `news`, `sentiment`) or entries in one |
| `do_query` | `entry_id`, `params` | Run one catalog entry |

Every `do_query` result lives in `structuredContent`:

```json
{ "success": true, "status_code": 200, "data": { "id": "...", "results": [ ... ], "provider": "...", "warnings": [], "extra": {} }, "error": null }
```

- `status_code: 204` with `data: ""` means no data. Treat it as "unavailable", not an error.
- Param validation errors come back as `success: false` with `error` text (e.g. `report_type` enum is in Chinese).
- Timestamps in params are **milliseconds**.

Per-entry docs: `https://agent.bitget.com/docs/<category>/<entry_id>`.

## Prequel

| Need | Entry | Status | Notes |
|---|---|---|---|
| Daily K-lines, 3y, US stocks | `equity_price_historical` | **BROKEN** | Returns 204 for NVDA, AAPL, SPY with any param combo (none, ms range, recent 30d) |
| Daily K-lines via rToken | `crypto_spot_kline` `RNVDA/USDT` `1d` | Partial | Only ~90 days (first bar 2026-06-26). Irregular bar boundaries (mix of 00:00 and 16:00 UTC) |
| Daily via stock perp | `crypto_futures_kline` `NVDA/USDT` binance `1d` | Partial | Only ~90 days |
| Quote | `equity_price_quote` | OK | `last_price, open, high, low, close, volume, prev_close, change_percent, total_market_cap, pb` |
| Earnings calendar | `equity_calendar` | OK, dates only | NVDA: 82 rows, 65 report dates 2010-08-29 to 2026-08-25. `perf_report_dsclsr_date`, `is_trading_time` (盘后 = after close). **No actual or consensus values** |
| Actual EPS/revenue | `equity_fundamental_income` | OK | `revenue, total_basic_earning_common_ps, total_dlt_earnings_common_ps, announcement_date`. `report_type` enum: 一季报, 中报, 三季报, 年报 etc. (cumulative, not single-quarter for 中报/三季报) |
| Consensus | `equity_estimates_consensus` | Sparse | Yahoo scrapes, EPS + Revenue only, ~1 snapshot per quarter since 2018 (`scraped_date`, `report_period_scraped` like "CurrentQtr.(Jul2025)", `fore_mean`) |
| Analyst target history | `equity_estimates_price_target` | **OK, rich** | NVDA: 972 rows 2016-09-19 to 2026-09-09. `published_date, analyst_firm, price_target, price_target_previous, rating_current, action` |
| US equity news | `news_label_search` `label=2` (Stocks) | OK, recent only | `title, content (HTML), labels, published_at, date`. Up to 1000/page. History starts ~Apr 2026 (0 rows for Oct 2025). No ticker filter, only label + time range |
| Sentiment | `sentiment_market_fear_greed` | Not yet probed | |

Agent Hub `@bitget-ai/bitget-signal` 1.2.0 (inspected from npm tarball, not installed): `news-briefing` is crypto/macro RSS aggregation via a separate MCP (`datahub.noxiaohao.com`), keyword filter only, no equity-ticker news. Not needed given `news_label_search`.

## Landed

| Check | Result |
|---|---|
| 1. rToken availability | OK. `crypto_market {is_rwa:true, category:"stock", market_type:"spot"}` lists Bitget spot rTokens as `R<TICKER>/USDT` (e.g. `RNVDA/USDT`, base `rNVDA`, `min_order_amount: 10`, `price_precision: 2`, launched 2026-04-23) |
| 2. Order book depth | OK, **live snapshot only**. `crypto_spot_order_book {symbol:"RNVDA/USDT", exchange:"bitget", limit:50}` returns `bids/asks: [[price, qty], ...]`, 50 levels |
| 3. Bid/ask spread | OK, **live only**. `crypto_spot_ticker` returns `bid, ask, bid_volume, ask_volume, last, vwap, volume` (provider ccxt). Sample: bid 222.65 / ask 222.75 = ~4.5 bps |
| 4. Historical timestamps | OK. K-line rows have `date` (ISO UTC) and `time` (ms) |
| 5. Hourly granularity | OK. `crypto_spot_kline {interval:"1h", limit:1000}` returns 1000 bars (~42 days). `start_time` paging reaches back to launch (Apr 2026), with early gaps |
| 6. Weekend data | OK. Bars on Sat/Sun at every hour, with low volume (e.g. 3 to 5 units/h vs thousands on weekdays). 1 gap in 1000 bars |

No historical order book or historical spread. The Landed cost model must use the spec's fallback: an hourly high-low range and volume proxy from K-lines for history, and the live book and spread only for "now".

## Sample: hourly rToken K-line row

```json
{"date":"2026-09-24T09:00:00Z","open":222.7167,"high":222.95,"low":222.3642,"close":222.7952,"volume":44105,"exchange":"bitget","symbol":"RNVDAUSDT","interval":"1h","time":1790240400000}
```

## Sample: price target row

```json
{"published_date":"2026-09-09","symbol":"NVDA","analyst_firm":"Piper Sandler","price_target":300,"price_target_previous":null,"rating_current":"增持","action":"首次覆盖","time":1788912000000}
```
