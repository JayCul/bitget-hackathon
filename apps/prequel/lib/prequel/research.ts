import "server-only";
import { modelName } from "@desk/llm";
import { eventReturn } from "@desk/market-data";
import { asOfUniverse, loadUniverse } from "../analogs/load";
import { matchAnalogs } from "../analogs/match";
import { computeOutcomes } from "../analogs/outcomes";
import { universeFor } from "../analogs/peers";
import { contextFromBars, nextEarnings } from "./context";
import { addDays, generateHeadlines } from "./headlines";
import type { Board, ResearchEvent, Thesis } from "./types";

/** Runs the pipeline, yielding progress only when real work finishes. */
export async function* research(thesis: Thesis): AsyncGenerator<ResearchEvent> {
  const ticker = thesis.ticker.toUpperCase();
  const t = { ...thesis, ticker };

  // 1. The thesis ticker's own bars.
  yield { kind: "step", id: "prices", state: "running" };
  const own = asOfUniverse(await loadUniverse([ticker]), t.asOf);
  const ownBars = own.bars[ticker] ?? [];
  const base = contextFromBars(ownBars);
  if (!base) {
    const why = own.failures.map((f) => `${f.what}: ${f.message}`).join("; ") || `No session bars before ${t.asOf}`;
    yield { kind: "step", id: "prices", state: "failed", note: why };
    yield { kind: "error", stage: "prices", message: `No Bitget price history for ${ticker}. ${why}` };
    return;
  }
  yield { kind: "step", id: "prices", state: "done", note: `${base.sessions} sessions · ref $${base.refPrice.toFixed(2)}` };

  // 2. Peers and candidate events.
  yield { kind: "step", id: "events", state: "running" };
  const [full, earnings] = await Promise.all([loadUniverse(universeFor(ticker)), nextEarnings(ticker, t.asOf)]);
  const cut = asOfUniverse(full, t.asOf);
  // Only events with a complete +5 session outcome before asOf can serve as evidence.
  const universe = {
    ...cut,
    candidates: cut.candidates.filter((c) => eventReturn(cut.bars[c.ticker] ?? [], c.date, c.timing)?.ret5d != null),
  };
  const horizonEnd = addDays(t.asOf, t.horizonDays);
  const context = { ...base, nextEarnings: earnings && earnings.date <= horizonEnd ? earnings : null };
  yield {
    kind: "step",
    id: "events",
    state: "done",
    note: `${universe.candidates.length} events · ${universe.tickers.length} tickers`,
  };

  // 3. Headlines.
  yield { kind: "step", id: "headlines", state: "running", note: modelName("main") };
  let headlines;
  try {
    headlines = await generateHeadlines(t, context);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    yield { kind: "step", id: "headlines", state: "failed", note: message.slice(0, 120) };
    yield { kind: "error", stage: "headlines", message };
    return;
  }
  yield { kind: "step", id: "headlines", state: "done", note: `${headlines.length} scenarios` };

  // 4. Analog matching.
  yield { kind: "step", id: "analogs", state: "running", note: modelName("main") };
  let match;
  try {
    match = await matchAnalogs(
      ticker,
      headlines.map((h) => ({ headlineId: h.id, headline: h.headline, analogQuery: h.analogQuery, filter: h.analogFilter })),
      universe.candidates,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    yield { kind: "step", id: "analogs", state: "failed", note: message.slice(0, 120) };
    yield { kind: "error", stage: "analogs", message };
    return;
  }
  const matched = Object.values(match.byHeadline).reduce((n, m) => n + m.ids.length, 0);
  yield { kind: "step", id: "analogs", state: "done", note: `${matched} analogs selected` };

  // 5. Outcomes, in code.
  yield { kind: "step", id: "outcomes", state: "running" };
  for (const h of headlines) {
    const m = match.byHeadline[h.id];
    if (!m) continue;
    const r = computeOutcomes(m.ids, universe);
    h.analogs = { reason: m.reason, outcomes: r.outcomes, stats: r.stats, droppedIds: [...m.droppedIds, ...r.unknownIds] };
  }
  const complete = headlines.reduce((n, h) => n + (h.analogs?.stats.n ?? 0), 0);
  yield { kind: "step", id: "outcomes", state: "done", note: `${complete} complete windows` };

  const board: Board = {
    id: `${ticker}-${t.asOf}-${Date.now().toString(36)}`,
    thesis: t,
    context,
    headlines,
    universe: {
      tickers: universe.tickers,
      window: universe.window,
      candidates: universe.candidates.length,
      barsSource: universe.barsSource,
    },
    failures: universe.failures,
    model: modelName("main"),
    generatedAt: new Date().toISOString(),
  };
  yield { kind: "board", board };
}
