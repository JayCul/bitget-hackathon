import type { DailyBar, EventReturn, EventTiming } from "@desk/market-data";

export type CandidateType = "earnings" | "analyst" | "gap";

/**
 * A past event that could serve as a historical analog.
 * `summary` and `facts` contain only what was known when the event hit. Never the price reaction,
 * so the LLM cannot select analogs by outcome.
 */
export type Candidate = {
  id: string;
  ticker: string;
  date: string;
  timing: EventTiming;
  type: CandidateType;
  summary: string;
  facts: Record<string, string | number | null>;
  source: string;
  flags: string[];
};

export type SourceFailure = { ticker: string; what: string; message: string };

export type Universe = {
  tickers: string[];
  window: { from: string; to: string };
  bars: Record<string, DailyBar[]>;
  candidates: Candidate[];
  failures: SourceFailure[];
  barsSource: string;
  builtAt: string;
};

export type AnalogOutcome = { candidate: Candidate; ret: EventReturn | null; excluded?: string };
