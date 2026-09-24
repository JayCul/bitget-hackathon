# Prequel + Landed: Product Spec

Bitget AI Base Camp Hackathon S2, AI Trading Desk track
Built by Justin Nnaka, Master's student at Miva Open University
Submission deadline: 27 Sep 2026, 23:59 UTC+8 (16:59 Lagos time)

Two independent entries, one per sub-theme. **Prequel is the flagship. Landed is the second submission.**

| | Prequel | Landed |
|---|---|---|
| Sub-theme | Decision Stress Testing | Execution Assistance |
| Tagline | Know what would change your mind before you trade. | Your salary landed. Don't waste the spread. |
| User moment | The minute before you open a position | Payday, when the credit alert arrives |
| Build priority | 1st: complete, then freeze | 2nd: built only on verified data |

**Prize logic:** each entry can win a Theme prize. The University Special Prize is a separate judging layer. An entry that wins a main-track prize (Grand, Theme or Open) can't also win the University prize, so for each entry it only matters if that entry misses a main-track prize. Fan Favorite stacks with everything.

---

## 1. Prequel (flagship)

### Name

**Prequel.** You get the story before the story.

Alternatives: **Tripwire**, **Both Sides**.

### Thesis (pain point)

Traders open positions with a story but no exit plan. When news hits, they react emotionally because they never decided in advance what would prove them wrong or right. Prequel makes that decision explicit before the trade, and backs it with historical evidence.

### Target user

Retail traders who hold US stocks for days to weeks and trade around news and earnings, but have no research team to red-team their ideas.

### Core loop

Thesis goes in. Prequel writes the scenarios, pulls historical analogs, and records your pre-commitments. Then a tripwire fires and it reminds you what you said you'd do.

### Core capabilities

1. **Thesis input.** Ticker, direction, horizon, size, and a free-text thesis.
2. **Headline war-game.** The LLM writes 5 Red headlines (events that would kill the thesis) and 5 Green headlines (events that would confirm it). Each one must be specific, dated or date-bounded, and falsifiable, and both sides are held to the same evidence standard. Each headline carries:
   - a **tripwire**: a price level, news keyword or entity, earnings metric vs consensus, analyst target change, or sentiment threshold
   - an **analog query**: which past event type to look up
   - a **model estimate** of likelihood, always labelled "AI estimate, not a calibrated probability" and shown as secondary information
3. **Historical analogs (the centerpiece).** For each scenario, the LLM only identifies which past events match, for example past earnings where data center revenue missed consensus. Code then computes the numbers from K-lines:
   - the analogs found (dates, events)
   - positive vs negative outcomes (e.g. 6/10 vs 4/10)
   - median +1d and +5d returns
   - a small distribution chart

   The LLM never produces a return number. This is what the sub-theme asks for: "input trade idea, retrieve historical distribution, preset stress tests."
4. **Evidence Balance and Model Conviction** (shown separately):
   - **Evidence Balance** asks how balanced the research is. It counts evidence items per side, where an evidence item is a retrieved data point attached to a scenario (an analog event, fundamental metric, analyst data point or news item). It also counts historical support, meaning scenarios with at least one analog (e.g. Red 4/5, Green 3/5). Balance % = `1 - |R - G| / (R + G)`. Below 70% triggers a warning that the research is one-sided.
   - **Model Conviction** asks what the evidence currently suggests, as a Green vs Red split derived from the analog outcomes and the tripwires that have fired, clearly labelled.
5. **Pre-commitment.** For each headline, the user writes what they'll do if it fires (exit, trim, add, hold). It's saved before the trade.
6. **Replay mode (first-class, and what the demo uses).** A recorded, timestamped news and price sequence plays through the tripwire matcher, so the demo is the same every time:
   ```
   09:30  Thesis created
   09:42  New headline arrives
   09:42  Tripwire matched: RED #2 fired
          "You said you'd trim 50%."
   ```
7. **Live mode (optional).** Only if the data sources are verified to work: poll quotes, news and sentiment, then run the same matcher.
8. **Post-mortem (stretch).** Compares which headlines came true against what the user did.

### Requirements

- Data: bitget-mcp-server (`https://agent.bitget.com/mcp`, HTTP transport, no API key) for quotes, K-lines, earnings calendar, analyst targets and fundamentals. Agent Hub `bitget-signal` skills (`news-briefing`, `sentiment-analyst`, `macro-analyst`, `technical-analysis`) for news and sentiment.
- `news-briefing` may be crypto-focused. Verify it first, and use Chainbase AgentKey or a free company-news API as the fallback.
- LLM: Qwen via hackathon credits. Headline generation and analog matching return strict JSON validated by schema.
- Frontend: desktop-first, with a two-column Red/Green board, analog distribution charts, and an event timeline.

### Demo script (90 seconds)

The user types "Long NVDA into earnings, 3 weeks." Prequel shows the Red and Green boards, and one Red scenario expands to 10 historical analogs with median +1d and +5d moves. The user sets their commitments. Replay mode then fires a Red tripwire, and the alert reads: "You said you'd trim 50%."

---

## 2. Landed (second submission)

### Name

**Landed.** When pay arrives, Nigerians say "alert don land."

Alternatives: **Alert**, **Payday Pilot**.

### Positioning

**Landed turns one payday allocation into a liquidity-aware rToken execution plan.** Execution optimization is the product. The salary is only the input that sets the order size and the timing window.

### Thesis (pain point)

Salaried investors buy their whole allocation in one order at a random moment, often during thin 24/7 liquidity, and quietly lose money to spread and slippage. Nobody shows them the cost or a better schedule.

### Target user

Salaried professionals in emerging markets who buy US stock rTokens with their pay and can't trade during US hours (14:30 to 21:00 WAT) because they're at work.

### Core capabilities

1. **Order input.** The allocation amount (optionally derived from salary minus bills due before the next payday minus a buffer, in code), the basket (e.g. AAPL, NVDA, SPY), the number of tranches, and the execution window (e.g. 24h or the payday week).
2. **Market microstructure panel.** Per asset: spread (bps), depth (USD), volatility. Built **only from verified Bitget data fields**.
3. **Execution plan (the hero).** Deterministic code schedules the tranches into the lowest-expected-cost windows. Output per row: time (WAT), asset, amount, expected cost (bps).
4. **"Why these windows?"** The LLM explains the deterministic result in plain language and answers what-ifs ("what if I buy everything now?") using the computed costs.
5. **Simulated execution.** After the human confirms, fills are simulated against historical or live market data and produce an execution report. Real Bitget paper trading is an optional extra, never a dependency.
6. **Historical execution replay (validation).** Run the same budget across 6+ historical periods, comparing a baseline (a single order at the start of the window) with the Landed tranche plan, in average execution cost (bps) and USD. Labelled "Backtested / historical replay, not live savings."

### Data fallback

If rToken order book depth or spread data isn't available, don't simulate it. Rebuild the cost model from whatever is verified (for example the high-low range or volatility per hour from K-lines as a slippage proxy), and label the proxy clearly in the UI and the submission.

### Requirements

- Market data: bitget-mcp-server, with every field verified before it's used.
- Optional execution: Agent Hub with `--paper-trading`, which requires a dedicated Bitget Demo API key.
- LLM: Qwen via credits for explanation and what-if Q&A. All cost and schedule maths is in code.
- Frontend: mobile-first, with three screens: Order, Plan, Replay report.

### Demo script (90 seconds)

The credit alert lands and shows a $5,000 allocation. The microstructure panel appears, then a 4-tranche plan with the expected cost per row. "Why these windows?" explains the choice. The user confirms, the simulated fills produce an execution report, and the replay panel shows the baseline cost vs Landed's in bps.

---

## 3. Submission mapping

| Form field | Prequel | Landed |
|---|---|---|
| Thesis | No pre-committed exit logic, so traders react emotionally | One-shot buys in thin 24/7 liquidity waste spread |
| Target user | Retail swing traders around news and earnings | Salaried EM investors buying rTokens with their pay |
| Validation | Analog distributions per scenario and tripwire hit rate on replayed theses (observed, replay) | Baseline vs plan cost in bps over 6+ periods (backtested, historical replay) |
| Role of LLM | Qwen: headline generation, analog event matching, news-to-tripwire matching. No return maths | Qwen: plan explanation and what-if Q&A. No cost maths |
| University | Miva Open University | Miva Open University |
| X post | #BitgetHackathon, @Bitget_AI, retweet the announcement, 60s demo clip | Same |

Byline for READMEs and posts: "Built by Justin Nnaka, Master's student at Miva Open University." Let the product lead, and use the university as credibility, not the pitch.
