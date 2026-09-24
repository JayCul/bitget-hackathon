// Shared between server and client. No server imports here.
import type { AnalogStats, EventReturn } from "@desk/market-data";
import type { AnalogFilter } from "../analogs/shortlist";
import type { Candidate } from "../analogs/types";

export type Direction = "long" | "short";
export type Side = "RED" | "GREEN";
export type Mode = "live" | "replay";

export type Thesis = {
  ticker: string;
  direction: Direction;
  horizonDays: number;
  sizeUsd: number;
  text: string;
  /** YYYY-MM-DD. Live mode: today. Replay mode: the recorded start date; nothing after it is used. */
  asOf: string;
  mode: Mode;
};

/** Machine-checkable conditions. Sentiment is not offered: Bitget has no verified per-ticker sentiment. */
export type TripwireCondition =
  | { type: "price"; op: "close_below" | "close_above"; pct: number }
  | { type: "earnings"; metric: "revenue_surprise"; op: "below" | "above"; pct: number }
  | { type: "analyst"; direction: "cut" | "raise" | "downgrade" | "upgrade"; minCount: number; withinDays: number }
  | { type: "news"; keywords: string[]; description: string };

export type Tripwire = TripwireCondition & {
  /** human-readable condition, generated in code */
  label: string;
  /** price tripwires: level computed from the observed reference price */
  level?: number;
};

export type Commitment = {
  action: "trim50" | "exit" | "hold" | "add";
  note?: string;
  lockedAt: string;
};

export type AnalogView = {
  candidate: Candidate;
  ret: EventReturn | null;
  excluded?: string;
};

export type HeadlineAnalogs = {
  reason: string;
  outcomes: AnalogView[];
  stats: AnalogStats;
  /** LLM ids that did not exist, reported for transparency */
  droppedIds: string[];
};

export type Headline = {
  id: string; // R1..R5, G1..G5
  side: Side;
  headline: string;
  window: string;
  windowDays: number;
  modelEstimate: number;
  tripwire: Tripwire;
  analogQuery: string;
  analogFilter: AnalogFilter;
  analogs: HeadlineAnalogs | null;
  commitment?: Commitment;
};

export type MarketContext = {
  refPrice: number;
  refDate: string;
  ret20d: number | null;
  vol20d: number | null;
  nextEarnings: { date: string; source: string } | null;
  sessions: number;
};

export type Board = {
  id: string;
  thesis: Thesis;
  context: MarketContext;
  headlines: Headline[];
  universe: { tickers: string[]; window: { from: string; to: string }; candidates: number; barsSource: string };
  failures: { ticker: string; what: string; message: string }[];
  model: string;
  generatedAt: string;
  recorded?: boolean;
};

export type ResearchEvent =
  | { kind: "step"; id: string; state: "running" | "done" | "failed"; note?: string }
  | { kind: "board"; board: Board }
  | { kind: "error"; message: string; stage: string };

export const COMMITMENT_LABEL: Record<Commitment["action"], string> = {
  trim50: "Trim 50%",
  exit: "Exit",
  hold: "Hold",
  add: "Add",
};
