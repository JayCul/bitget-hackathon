# Prequel

**Know what would change your mind before you trade.**

Prequel stress-tests a trade thesis before you open the position. Bitget AI Base Camp Hackathon S2, AI Trading Desk track, Decision Stress Testing.

Built by Justin Nnaka, Master's student at Miva Open University.

Live: https://prequel-bitget.vercel.app · Demo video: https://youtu.be/UeaHtyQtUbI

## The problem

Traders open positions with a story but no exit plan. When news hits, they react emotionally, because they never decided in advance what would prove them wrong or right.

## What it does

1. **Thesis.** Ticker, direction, horizon, size and a sentence of reasoning.
2. **Headline war-game.** The LLM writes 5 Red headlines that would break the thesis and 5 Green headlines that would confirm it, held to the same standard. Each has a machine-checkable tripwire: a price move from the reference close, revenue surprise vs consensus, a count of analyst revisions, or a news event.
3. **Historical analogs.** Code builds past events from Bitget data (earnings, analyst revisions, opening gaps) across the ticker and 13 semiconductor peers. Code shortlists by type and direction, and the LLM ranks ids from each shortlist. Code then computes the outcomes: count up and down, median +1d and +5d returns, price paths.
4. **Evidence Balance and Model Conviction**, computed in code, shown separately.
5. **Pre-commitment.** For each headline: trim 50%, exit, hold or add. Locked before the event.
6. **Replay.** A recorded Bitget sequence (NVDA, 10 to 31 August 2026: hourly prices, the earnings report, analyst notes, 73 stock news items) plays through the tripwires. Price, earnings and analyst tripwires are checked in code; news tripwires use an LLM match returning an id and a confidence. When one fires: "You said you'd trim 50%." A post-mortem closes the replay.

In replay mode nothing after the as-of date is visible: bars are cut, events must precede it, and only analogs with a complete +5 session outcome count as evidence.

## Where the numbers come from

All market data is from `bitget-mcp-server` (`https://agent.bitget.com/mcp`, verified schemas in `docs/tools.md`):

| Data | Bitget entry |
|---|---|
| Daily session bars | `crypto_spot_kline` on rToken `R<TICKER>/USDT`, 1h, aggregated to 09:30 to 16:00 ET |
| Earnings dates | `equity_calendar` (dates run one session early; realigned to the peak-volume session, shown in the UI) |
| Revenue and consensus | `equity_fundamental_income`, `equity_estimates_consensus` |
| Analyst targets | `equity_estimates_price_target` |
| News | `news_label_search` label Stocks |

Every figure is tagged OBSERVED, COMPUTED, AI ESTIMATE or DEMO REPLAY.

## Role of the LLM

Groq, `openai/gpt-oss-120b` for headlines, analog ranking and news matching (Qwen3 on Groq is supported by setting `LLM_MODEL`). Outputs are JSON validated with Zod, retried once. The LLM never produces a return, count or balance; reasons that contain figures are withheld.

## Run

```bash
pnpm install
pnpm dev:prequel       # http://localhost:3001
pnpm test              # unit tests for returns, analogs, scoring, replay
```

Env (repo root `.env.local`): `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_MODEL_FAST`. No Bitget key is needed.

Deploy on Vercel with Root Directory `apps/prequel`. Functions are pinned to Singapore (`vercel.json`).

## Safety

Prequel observes and reminds. It never places an order.
