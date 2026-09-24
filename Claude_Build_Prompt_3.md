# Prompt for Claude: build Prequel and Landed

Paste everything below into Claude Code, running at the root of an empty repo, with `Landed_and_Prequel_Spec.md` in the same folder.

---

You're my build partner for the Bitget AI Base Camp Hackathon S2 (AI Trading Desk track). I'm Justin Nnaka, a frontend developer and a Master's student at Miva Open University. The hard deadline is **27 Sep 2026, 23:59 UTC+8 (16:59 Lagos time)**. I have a day job, so my build time is evenings plus the weekend.

We're building two **independent** products, each submitted separately. The full spec is in `Landed_and_Prequel_Spec.md`, so read it first and treat it as the source of truth.

- **Prequel** (flagship, Decision Stress Testing): 5 Red and 5 Green headlines per thesis, historical analogs computed in code, pre-commitments, and tripwires in replay mode.
- **Landed** (second, Execution Assistance): turns one payday allocation into a liquidity-aware rToken execution plan, with simulated fills and a historical execution replay.

## CRITICAL: never infer or invent Bitget API capabilities

Before implementing any feature that depends on Bitget data, discover the actual tool and inspect its real response schema.

If a required capability doesn't exist:
1. stop that feature,
2. report the exact missing capability,
3. propose the smallest workaround that keeps the evidence real,
4. never fabricate data or an API response.

A working smaller product beats a bigger one built on assumed APIs.

## Build order

1. **Verify every external capability.**
   - Connect to bitget-mcp-server (`https://agent.bitget.com/mcp`, HTTP transport, no key) and list its tools.
   - Install Agent Hub with `npx @bitget-ai/bitget-agent-installer upgrade-all --target all` and inspect `bgc` and the `bitget-signal` skills.
   - Save the exact tool names, params and a real sample response for each to `docs/tools.md`.
   - Answer these, then report back to me:
     - Prequel: daily K-lines with at least 3 years of history for US stocks. Earnings calendar with actual vs consensus. Analyst target history. Does `news-briefing` return US equity news or crypto only?
     - Landed: do NOT implement the liquidity profiler until you've verified the exact returned schema for (1) rToken symbol availability, (2) order book depth, (3) bid/ask spread, (4) historical timestamps, (5) hourly granularity, (6) weekend data.
2. **Build Prequel.**
3. **Produce a complete Prequel demo:** deployed URL, replay mode working, and a recorded 90s video.
4. **Freeze Prequel.** From then on, bug fixes only.
5. **Build Landed**, using only verified market-data capabilities. Use the documented proxy fallback where data is missing.
6. **Produce a complete Landed demo.**
7. **Polish both.**

## Stack

- One pnpm monorepo with `apps/prequel`, `apps/landed`, `packages/ui`, `packages/bitget` (a typed client built from the verified schemas) and `packages/llm`.
- Next.js (App Router) + TypeScript strict + Tailwind. All Bitget and LLM calls happen server-side, and keys never reach the browser.
- LLM: an OpenAI-compatible client pointed at Qwen (Alibaba Cloud DashScope), with `LLM_BASE_URL`, `LLM_API_KEY` and `LLM_MODEL` in env. Structured calls use JSON output validated with Zod, with one retry on a schema failure.
- Charts: Recharts or lightweight-charts.
- Each app runs standalone with its own README, because they're separate submissions.
- Deploy to Vercel early, so a demo URL always exists.

## Non-negotiable rules

- **No live orders, ever.** Landed's MVP uses simulated execution. If optional Bitget paper trading gets added, run Agent Hub with `--paper-trading` using a dedicated **Demo API key** from env. Fail closed at startup unless the credentials are explicitly marked as Demo. Never use production credentials.
- **Numbers come from code, never the LLM.** Analog returns, hit counts, evidence balance, spreads, expected costs and replay results are all deterministic functions with unit tests.
- **The LLM identifies, generates and explains. The human decides.** Every action needs an explicit confirm.
- **Label every number** as observed, estimated, backtested or AI estimate.
- **No fabricated data.** When a call fails, show the failure. Replay data is recorded from real sources and marked "Replay."
- Secrets go in `.env.local`, with `.env.example` committed.

## Prequel spec for the build

1. Thesis form: ticker, direction, horizon, size, text.
2. Headline generation, using this system prompt:

   > You're a neutral trading analyst. Given a thesis, write exactly 5 RED headlines (events that would invalidate it) and 5 GREEN headlines (events that would confirm it) within the stated horizon. Every headline has to be specific, dated or date-bounded, and falsifiable. Apply the same evidence standard and tone to both sides, and don't make GREEN more persuasive than RED. For each, return: `side`, `headline`, `window`, `model_estimate` (0-1, your rough likelihood; it isn't a calibrated probability), `tripwire` {`type`: price|news|earnings|analyst|sentiment, `condition` as machine-checkable params}, and `analog_query` (the type of past event to look up). Return JSON only.

3. Analog engine (the centerpiece):
   - Code gathers candidate past events for the ticker or sector (earnings dates with actual vs consensus, big analyst revisions, large gap days).
   - The LLM picks which candidates match each `analog_query` and returns event IDs only.
   - Code computes the outcome count and median +1d and +5d returns from K-lines, and renders a distribution chart.
4. Evidence Balance: count evidence items per side, where an evidence item is a retrieved data point attached to a scenario. Also count scenarios with at least one analog per side. Balance % = `1 - |R - G| / (R + G)`, with a warning below 70%.
5. Model Conviction: a Green vs Red split from analog outcomes and fired tripwires. Show it separately from Balance.
6. Show `model_estimate` as secondary, always labelled "AI estimate, not a calibrated probability."
7. A pre-commitment field on each headline, saved before the trade.
8. **Replay mode first.** A recorded, timestamped news and price sequence runs through the matcher. Price and earnings tripwires are checked in code, and news goes through a cheap LLM matcher that returns headline id + confidence. Fired events go to the timeline with a toast: "You said you'd X." The demo always uses replay mode.
9. Live mode is optional: only if step 1 verified the sources, and it reuses the same matcher.
10. Stretch goal: a post-mortem view.

## Landed spec for the build

1. Order screen: allocation (with an optional salary, bills and buffer helper done in code), basket, tranche count, execution window.
2. Microstructure panel: spread, depth and volatility per asset, from verified fields only. If depth or spread is missing, use a clearly labelled proxy from K-lines (e.g. the hourly high-low range) and say so in the UI.
3. `planExecution()`: deterministic tranche scheduling into the lowest-expected-cost windows, with tests. Output rows show time (WAT), asset, amount and expected cost (bps).
4. "Why these windows?" and what-if chat: the LLM explains the computed plan and never recalculates it.
5. Confirm, then simulate fills against market data, then produce an execution report written to `logs/landed-sim.jsonl`.
6. Historical execution replay: the same budget across 6+ historical periods, comparing a baseline (a single order at the start of the window) with the plan, as average bps and USD. Labelled "Backtested / historical replay, not live savings."
7. A simulated "credit alert" opening for the demo.

## Schedule (Lagos time)

- **Thu 24, evening:** capability verification and report, scaffold, Vercel shells.
- **Fri 25, evening:** Prequel steps 1 to 7.
- **Sat 26, morning:** Prequel steps 8 and 9, the demo video, then freeze.
- **Sat 26, afternoon to night:** Landed steps 1 to 5.
- **Sun 27, morning:** Landed steps 6 and 7, polish, READMEs, X posts.
- **Sun 27, 15:00 WAT:** submit Prequel first, then Landed. That leaves a 2-hour buffer.

If time runs short, cut in this order: Prequel post-mortem, Prequel live mode, Landed what-if chat, then Landed as a whole. Never cut Prequel's analogs or replay mode.

## Submission support (last step)

For each app, draft the Google Form answers from real results in the repo:

1. Project Description in the 6 parts (Thesis, Target User, Validation Data with labelled metrics, Progress, Deliverables, Take on AI Trading).
2. Role of LLM: which Qwen model, which calls, and what they do. Say plainly that all numbers are computed in code.
3. University Name: Miva Open University.
4. An X post under 280 characters with `#BitgetHackathon` and `@Bitget_AI`, and a reminder to retweet the official announcement.

## How to talk to me

Be brief and technically specific. Don't use em dashes in anything you write for me, including UI copy and READMEs. At the end of each session, tell me what works, what's broken, and the next 3 tasks.
