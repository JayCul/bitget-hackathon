import type { Plan } from "./plan";
import type { Regime } from "./regime";

export type MicroRow = {
  ticker: string;
  live:
    | { ok: true; at: string; regime: Regime; mid: number; spreadBps: number; depthAsk25Usd: number; buyNowBps: number | null }
    | { ok: false; message: string };
  /** sampled medians per regime */
  sampled: Partial<Record<Regime, { n: number; spreadBps: number; costBps: number | null }>>;
};

export type PlanResponse = {
  plan: Plan;
  micro: MicroRow[];
  /** buying everything now against the live book, per asset */
  liveNow: { ticker: string; usd: number; bps: number | null; costUsd: number | null; message?: string }[];
  model: { samples: number; from: number | null; to: number | null };
  generatedAt: string;
};

export type Fill = {
  t: number;
  ticker: string;
  usd: number;
  plannedBps: number;
  simBps: number | null;
  simPrice: number | null;
  qty: number | null;
  note?: string;
};

export type ExecutionReport = {
  id: string;
  createdAt: string;
  fills: Fill[];
  totals: { usd: number; plannedCostUsd: number; simCostUsd: number | null };
  method: string;
};
