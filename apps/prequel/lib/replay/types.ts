import type { DailyBar } from "@desk/market-data";

export type AnalystNote = {
  firm: string | null;
  action: "upgrade" | "downgrade" | "initiate" | "maintain" | null;
  rating: string | null;
  target: number | null;
  previousTarget: number | null;
};

export type ReplayEvent =
  | { kind: "session_close"; at: number; date: string; close: number }
  | {
      kind: "earnings";
      at: number;
      date: string;
      summary: string;
      revenue: number | null;
      consensus: number | null;
      surprise: number | null;
      calendarDate: string | null;
    }
  | { kind: "analyst"; at: number; date: string; notes: AnalystNote[] }
  | { kind: "news"; at: number; id: string; title: string; excerpt: string };

/** A recorded, timestamped sequence of real data for one ticker and window. */
export type Recording = {
  ticker: string;
  start: string; // asOf
  end: string;
  recordedAt: string;
  sources: string[];
  hourly: { t: number; c: number }[];
  sessions: DailyBar[];
  events: ReplayEvent[];
};

export type NewsMatch = { headlineId: string; newsId: string; confidence: number };

export type Fire = {
  headlineId: string;
  at: number;
  /** what fired it, computed in code */
  detail: string;
  eventKind: ReplayEvent["kind"];
  newsId?: string;
};

export type TripwireState = "WAITING" | "ARMED" | "FIRED" | "EXPIRED";
