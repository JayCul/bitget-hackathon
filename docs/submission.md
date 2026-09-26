# Submission drafts

Form: https://docs.google.com/forms/d/e/1FAIpQLScojKm9H2xDNFL3ijcDcKxwG-_PvkmyimiAB-SEFOx_WsqGNA/viewform
Deadline: 8 October 2026, 23:59 (UTC+8). Submit **two responses**, one per project ("A team may enter up to two different themes with two independent projects").
Every figure below is a real output from the repo.

## Same in both responses

| Field | Answer |
|---|---|
| Team Name | Justin Nnaka (or the project name) |
| Team Lead Bitget UID | yours |
| Team Lead Email | yours |
| Team Lead Contact | your Telegram or X handle |
| Member Background | Student |
| University Name | Miva Open University |
| Apply for Demo Day | your choice |
| How did you hear about this event? | your answer |
| Competition Track | AI Trading Desk |
| Did this team participate in S1? | your answer |
| Kimi K3 credits / Playbook review | your choice |

---

## Response 1: Prequel

**Competition Sub-theme:** Decision Stress Testing
**Project Name:** Prequel

**One-line Project Summary** (117 characters)
> Stress-tests a trade before you open it: 5 ways it breaks, 5 ways it's confirmed, each tested on real Bitget history.

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

**5. Take on AI trading**
AI is good at imagining what could happen and bad at arithmetic it can't show. Prequel splits the work: the model writes the scenarios and picks which past events look alike, and code computes every number and labels its source. The human decides before the event, and the machine reminds them afterwards. No orders are placed.

### Submission Material Links
```
Live demo: https://prequel-bitget.vercel.app
Code: https://github.com/JayCul/bitget-hackathon (apps/prequel, README inside)
Run records:
- Recorded replay (real Bitget prices, earnings, analyst notes, news, 10 to 31 Aug 2026): https://github.com/JayCul/bitget-hackathon/blob/main/apps/prequel/data/replays/NVDA-2026-08-10.json
- Full pipeline output for the demo thesis (headlines, analogs, outcomes): https://github.com/JayCul/bitget-hackathon/blob/main/apps/prequel/data/demo/board.json
- Verified Bitget API notes: https://github.com/JayCul/bitget-hackathon/blob/main/docs/tools.md
Demo video: [your Prequel YouTube link]
```

### Role of the LLM/AI
Groq-hosted open models (openai/gpt-oss-120b; Qwen3 supported through configuration). Three calls:
1. Headline war-game: 5 Red and 5 Green scenarios with tripwires, as strict JSON validated by Zod with one retry and sign checks.
2. Analog matching: code shortlists past events by type and direction, and the model ranks event ids from each shortlist.
3. News matching in replay: the model returns a headline id, a news id and a confidence. Code decides what fires, at 0.7 or above.
All numbers (returns, counts, medians, balance, conviction, price levels) are computed in code. The model never produces a figure the UI shows as data, and reasons containing figures are withheld.

**X Project Post URL:** [your Prequel post URL]

---

## Response 2: Landed

**Competition Sub-theme:** Execution Assistance
**Project Name:** Landed

**One-line Project Summary** (109 characters)
> Plans your payday rToken buys on measured Bitget order books, so you stop overpaying for spread and slippage.

### Project Description

**1. Thesis**
Salaried investors buy their whole allocation in one order the moment the credit alert lands, usually early in the morning, before Wall Street opens. What that buy costs depends on which rToken and how big the order is, and nobody shows them. Landed measures it from real Bitget order books and turns one payday allocation into an execution plan that splits orders and only uses hours it has actually measured.

**2. Target user**
Salaried professionals in emerging markets who buy US stock rTokens with their pay and can't trade during US hours (14:30 to 21:00 WAT) because they're at work.

**3. Validation data**
- Bitget has no spread history, so Landed records its own: 136 live order-book samples of rNVDA, rAAPL, rSPY, rQQQ, rTSLA and rMSFT, taken every 5 minutes during New York overnight hours on 25 Sep 2026 (OBSERVED).
- Spreads differ about 6x between rTokens at the same hour: median rTSLA 1.6 bps, rNVDA 1.8, rQQQ 6.0, rSPY 7.3, rAAPL 9.5, rMSFT 9.8 (OBSERVED).
- Order size matters as much as the asset. rAAPL had a median of only $4,687 of depth within 25 bps of mid. Walking the real book, a $500 buy cost 5.0 bps and a $10,000 buy cost 25.1 bps, five times more per dollar (OBSERVED). rNVDA: 1.7 bps at $500, 3.7 bps at $10,000.
- Splitting a $10,000 rAAPL buy into $500 tranches keeps each order near the top of the book: about 20 bps, roughly $20, kept on that one order (ESTIMATED from the measured book).
- Not yet tested: whether US-session hours are cheaper. Bitget's data API returned 503 on every query from 08:48 WAT on 25 Sep through the end of that day's US session. The planner only uses measured hours, shows the rest as not measured, and never guesses.
- The historical replay (8 past paydays, Bitget 1h bars) reports the price effect of waiting separately from execution cost, because it is timing luck (BACKTESTED, not live savings).

**4. Progress**
Complete and deployed. Payday setup (salary, bills, buffer, your own naira rate), a deterministic plan on an execution timeline, per-window spread, depth and volatility, an AI explanation, a what-if instrument (invest more, wait, liquidity worsens, split more), confirmation with simulated fills against Bitget's live order book logged to landed-sim.jsonl, and an 8-week historical replay. The order-book sampler and its dataset are in the repo, so measurement can extend to every market state. 55 unit tests.

**5. Take on AI trading**
The most useful AI for an everyday investor may not predict prices at all. It can show the cost they already pay and never see. Landed measures that cost from real order books, lets code make the plan, and uses AI only to explain it. Nothing executes until the person confirms, and in this build nothing is ever sent to an exchange.

### Submission Material Links
```
Live demo: https://landed-bitget.vercel.app
Code: https://github.com/JayCul/bitget-hackathon (apps/landed, README inside)
Run records:
- Order-book samples (the measured dataset): https://github.com/JayCul/bitget-hackathon/blob/main/apps/landed/data/samples/spreads.jsonl
- Simulated execution log: https://github.com/JayCul/bitget-hackathon/blob/main/docs/run-records/landed-sim.jsonl
- Sampler: https://github.com/JayCul/bitget-hackathon/blob/main/scripts/sample-spreads.mjs
Demo video: https://youtu.be/PC2k0zH3MRs
```

### Role of the LLM/AI
Groq-hosted openai/gpt-oss-20b. One call: explain the already-computed plan in two sentences, given only the computed facts. Investable amount, schedule, costs, savings and replay figures are all deterministic code with unit tests. The model never recalculates.

**X Project Post URL:** [your Landed post URL]
