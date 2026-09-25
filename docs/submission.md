# Submission drafts

Bitget AI Base Camp Hackathon S2, AI Trading Desk track. Two separate entries.
Figures below are real outputs from the repo. Landed figures in [BRACKETS] are filled once the order-book sampler has covered the US session (scheduled 15:47 WAT, 25 Sep).

---

## Prequel (Decision Stress Testing)

**Project name:** Prequel
**Live demo:** https://prequel-bitget.vercel.app
**Code:** https://github.com/JayCul/bitget-hackathon (apps/prequel)

### Project Description

**1. Thesis**
Traders open positions with a story but no exit plan. When news hits, they react emotionally because they never decided in advance what would prove them wrong or right. Prequel makes that decision explicit before the trade and backs every scenario with historical evidence.

**2. Target user**
Retail traders who hold US stocks for days to weeks, trade around news and earnings, and have no research team to red-team their ideas. Prequel works on the US stocks Bitget lists as rTokens.

**3. Validation data** (all from Bitget via bitget-mcp-server; labels as shown in the app)
- Demo thesis: long NVDA into Q2 FY27 earnings, 3 weeks, as of 10 Aug 2026. Only data before that date is used.
- Analog pool: 269 past events (earnings, analyst revisions, opening gaps) across NVDA and 13 semiconductor peers, built from Bitget rToken 1h bars aggregated to US sessions (COMPUTED).
- 45 historical analogs with complete +5 session outcomes attached to 9 of 10 scenarios. Evidence Balance 89% (Red 20, Green 25 evidence items) (COMPUTED).
- Finding: past semiconductor revenue beats of 2% or more were followed by a median +5 session move of -1.5% (2 up, 3 down) (COMPUTED). In the replay, NVDA beat revenue consensus by 4.5% and still finished the window down 1.4% (OBSERVED, DEMO REPLAY).
- Replay: 527 hourly bars, 16 session closes, the earnings report, 6 days of analyst notes and 73 stock news items from 10 to 31 Aug 2026 played through all 10 tripwires. 1 fired (Green 01, revenue surprise +4.5% vs a +2% threshold, 26 Aug 16:05 ET), 9 expired (DEMO REPLAY).
- Data finding: Bitget's earnings calendar dates run one session early. Volume confirmed it in 9 of 9 checkable events, and Prequel realigns each event to its peak-volume session.

**4. Progress**
Complete and deployed. Thesis input, 5 Red and 5 Green headlines with machine-checkable tripwires, historical analogs with price paths and outcome distributions, Evidence Balance and Model Conviction, locked pre-commitments, a recorded replay with tripwire alerts ("You said you'd add"), and a post-mortem. 55 unit tests cover returns, analogs, scoring and the replay engine.

**5. Deliverables**
Live app (prequel-bitget.vercel.app), open-source code with README, verified Bitget API notes (docs/tools.md), demo video.

**6. Take on AI trading**
AI is good at imagining what could happen and bad at arithmetic it can't show. Prequel splits the work: the model writes the scenarios and picks which past events look alike, and code computes every number and labels its source. The human decides before the event, and the machine reminds them afterwards. No orders are placed.

### Role of LLM
Groq-hosted open models (openai/gpt-oss-120b; Qwen3 supported through configuration). Three calls:
1. Headline war-game: 5 Red and 5 Green scenarios with tripwires, as strict JSON validated by Zod with one retry and sign checks.
2. Analog matching: code shortlists past events by type and direction, and the model ranks event ids from each shortlist.
3. News matching in replay: the model returns a headline id, a news id and a confidence. Code decides what fires, at 0.7 or above.
All numbers (returns, counts, medians, balance, conviction, price levels) are computed in code. The model never produces a figure the UI shows as data, and reasons containing figures are withheld.

### University name
Miva Open University

### X post (Prequel)
> Before you trade, ask what would change your mind. Prequel writes 5 ways your thesis breaks and 5 ways it's confirmed, tests each on real past events from Bitget data, and reminds you of your plan when one fires. @Bitget_AI #BitgetHackathon https://prequel-bitget.vercel.app

---

## Landed (Execution Assistance)

**Project name:** Landed
**Live demo:** https://landed-bitget.vercel.app
**Code:** https://github.com/JayCul/bitget-hackathon (apps/landed)

### Project Description

**1. Thesis**
Salaried investors buy their whole allocation in one order the moment the credit alert lands. For a Lagos payday that is around 09:00 WAT, when the US market is closed. rTokens trade 24/7, but market makers can only hedge while Wall Street is open, so spreads widen and books thin out. Landed turns one payday allocation into a liquidity-aware execution plan.

**2. Target user**
Salaried professionals in emerging markets who buy US stock rTokens with their pay and can't trade during US hours (14:30 to 21:00 WAT) because they're at work.

**3. Validation data**
- Bitget has no spread history, so Landed records its own: live rToken order books for NVDA, AAPL, SPY, QQQ, TSLA and MSFT sampled every 5 minutes, [LANDED_SAMPLES] samples so far (OBSERVED).
- Measured median spread by market state, overnight vs US session: [LANDED_SPREADS] (OBSERVED, sampled books).
- Payday at 09:00 WAT, NVDA, AAPL and SPY in 2 tranches each: buying everything at the alert costs [LANDED_BASELINE_BPS]; the Landed plan costs [LANDED_PLAN_BPS] (ESTIMATED).
- Historical replay over 8 past paydays: average [LANDED_SAVED_BPS] kept per payday ([LANDED_SAVED_USD]), with the price effect of waiting reported separately at [LANDED_PRICE_EFFECT] because it is timing luck (BACKTESTED, Bitget 1h bars; not live savings).

**4. Progress**
Complete and deployed. Payday setup (salary, bills, buffer, your own naira rate), deterministic plan with an execution timeline, per-window spread, depth and volatility, an AI explanation, a what-if instrument (invest more, wait, liquidity worsens, split more), confirmation with simulated fills against Bitget's live order book logged to landed-sim.jsonl, and an 8-week historical replay.

**5. Deliverables**
Live app (landed-bitget.vercel.app), open-source code with README, the order-book sampler and its dataset, demo video.

**6. Take on AI trading**
The most useful AI for an everyday investor may not predict prices at all. It can show the cost they already pay and never see. Landed measures that cost from real order books, lets code make the plan, and uses AI only to explain it. Nothing executes until the person confirms, and in this build nothing is ever sent to an exchange.

### Role of LLM
Groq-hosted openai/gpt-oss-20b. One call: explain the already-computed plan in two sentences, given only the computed facts. Investable amount, schedule, costs, savings and replay figures are all deterministic code with unit tests. The model never recalculates.

### University name
Miva Open University

### X post (Landed)
> Your salary landed. Don't waste the spread. Buying rTokens the moment the alert hits pays overnight spreads. Landed measures Bitget order books around the clock and times your payday buys to the hours where you keep more. @Bitget_AI #BitgetHackathon https://landed-bitget.vercel.app

---

**Reminder for Fan Favorite:** repost the official @Bitget_AI hackathon announcement from the same account, and attach the 60 second demo clip to each post.
