# Landed

**Your salary landed. Don't waste the spread.**

Landed turns one payday allocation into a liquidity-aware execution plan for Bitget US-stock rTokens. Bitget AI Base Camp Hackathon S2, AI Trading Desk track, Execution Assistance.

Built by Justin Nnaka, Master's student at Miva Open University.

Live: https://landed-bitget.vercel.app · Demo video: https://youtu.be/PC2k0zH3MRs

## The problem

Salaried investors in emerging markets buy their whole allocation in one order, the moment the credit alert lands. For a Lagos payday that is usually 08:00 to 10:00 WAT: 03:00 to 05:00 in New York, when the US market is closed. rTokens trade 24/7, but market makers can only hedge while the underlying trades, so spreads widen and books thin outside US hours. Nobody shows the investor that cost, or a better schedule.

## What it does

1. **Setup.** How much landed (₦), what stays untouched (bills and a buffer), and where the rest goes (a basket of rTokens). The FX rate is the user's own: Bitget has no naira market, so Landed never guesses one.
2. **Plan.** A deterministic scheduler (`lib/plan.ts`) places each tranche in the cheapest measured hours of the window. Every row shows the time in WAT, asset, amount and expected cost in bps.
3. **Why this plan?** The LLM explains the computed plan in two sentences. It never changes a number.
4. **What if I buy now?** Buying everything now against the live order book, compared with the plan.
5. **Confirm, then simulate.** Each order is walked against Bitget's live order book. Nothing is sent to an exchange. Reports are appended to `logs/landed-sim.jsonl`.
6. **Replay.** The same budget and rules on each of the last 8 weeks, separating **cost saved** from the **price effect of waiting**, which is timing luck and can go either way. Labelled "Backtested historical replay. Not live savings."

## Where the numbers come from

| Figure | Source | Tag |
|---|---|---|
| Live spread, depth within 25 bps, buy-now cost | Bitget `crypto_spot_order_book` (live) | OBSERVED |
| Cost per market state and order size | Bitget order books sampled every 5 minutes by `scripts/sample-spreads.mjs`, medians per state | OBSERVED (sampled) |
| Plan cost, baseline cost, saving | Code, from the sampled medians | ESTIMATED |
| Price effect of waiting | Bitget rToken 1h K-lines | BACKTESTED |
| Investable USD | Code, from the user's inputs and rate | COMPUTED |

Bitget offers no historical spreads or order books (see `docs/tools.md`), so Landed records them. Market states are defined in New York time: US session (09:30 to 16:00), pre/post market (04:00 to 09:30, 16:00 to 20:00), overnight, and weekend or holiday. A state with fewer than 3 samples is never used for planning.

The K-line `volume` field for rTokens tracks the underlying US stock's volume, not Bitget's own book, so Landed does not use it as a liquidity measure.

## Data status at submission

The shipped dataset holds 136 order-book samples from New York overnight hours on 25 Sep 2026. Bitget's data API returned 503 on every query from 08:48 WAT that day through the end of the US session, so pre-market, US-session and weekend books were not measured before the deadline. What the samples show:

- Median spread by rToken at the same hour: rTSLA 1.6 bps, rNVDA 1.8, rQQQ 6.0, rSPY 7.3, rAAPL 9.5, rMSFT 9.8.
- Order size: rAAPL had about $4.7k of depth within 25 bps; a $500 buy cost 5.0 bps and a $10,000 buy 25.1 bps.

The planner only uses measured hours and marks the rest as not measured. Run `node scripts/sample-spreads.mjs` across a US session to extend the model.

## Role of the LLM

Groq, `openai/gpt-oss-20b` (configurable). One call: explain the already-computed plan in two sentences. All cost, schedule and replay maths is in code with unit tests (`lib/landed.test.ts`).

## Run

```bash
pnpm install
pnpm dev:landed        # http://localhost:3002
node scripts/sample-spreads.mjs 5 60   # keep sampling order books
```

Env (repo root `.env.local`): `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_MODEL_FAST`. No Bitget key is needed.

Deploy on Vercel with Root Directory `apps/landed`. Functions are pinned to Singapore (`vercel.json`).

## Safety

No live orders, ever. There is no exchange key in this project.
