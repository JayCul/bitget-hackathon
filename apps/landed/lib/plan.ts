// Deterministic tranche scheduling into the lowest expected-cost hours of a window.
import type { CostFn } from "./costs";
import type { Regime } from "./regime";

const HOUR = 3_600_000;
export const MIN_ORDER_USD = 10; // Bitget rToken min_order_amount (verified)

export type PlanInput = {
  start: number; // ms, when the money is available
  windowHours: number;
  assets: { ticker: string; usd: number }[];
  tranchesPerAsset: number;
};

export type PlanRow = { t: number; ticker: string; usd: number; bps: number; costUsd: number; regime: Regime };

export type Leg = { ticker: string; usd: number; bps: number | null; costUsd: number | null; regime: Regime | null };

export type Plan = {
  input: PlanInput;
  rows: PlanRow[];
  /** buy everything at `start` */
  baseline: { legs: Leg[]; bps: number | null; costUsd: number | null };
  totals: { usd: number; bps: number; costUsd: number };
  savedUsd: number | null;
  savedBps: number | null;
  unplanned: { ticker: string; reason: string }[];
};

const weighted = (legs: { usd: number; bps: number }[]) => {
  const usd = legs.reduce((s, l) => s + l.usd, 0);
  return usd ? legs.reduce((s, l) => s + l.usd * l.bps, 0) / usd : 0;
};

/** Candidate slot times: `start` itself, then each top of the hour inside the window. */
export function slots(start: number, windowHours: number): number[] {
  const out = [start];
  const firstHour = Math.ceil(start / HOUR) * HOUR;
  for (let t = firstHour === start ? start + HOUR : firstHour; t < start + windowHours * HOUR; t += HOUR) out.push(t);
  return out;
}

export function planExecution(input: PlanInput, cost: CostFn): Plan {
  const rows: PlanRow[] = [];
  const unplanned: Plan["unplanned"] = [];
  const candidates = slots(input.start, input.windowHours);

  for (const a of input.assets) {
    const n = Math.max(1, Math.min(input.tranchesPerAsset, Math.floor(a.usd / MIN_ORDER_USD)));
    if (a.usd < MIN_ORDER_USD) {
      unplanned.push({ ticker: a.ticker, reason: `Below the $${MIN_ORDER_USD} minimum order` });
      continue;
    }
    const size = a.usd / n;
    const priced = candidates
      .map((t) => ({ t, c: cost(a.ticker, t, size) }))
      .filter((x): x is { t: number; c: NonNullable<ReturnType<CostFn>> } => x.c !== null)
      .sort((x, y) => x.c.bps - y.c.bps || x.t - y.t);
    if (priced.length < n) {
      unplanned.push({ ticker: a.ticker, reason: "Not enough measured hours in this window" });
      continue;
    }
    // Take the cheapest hours, spreading tranches apart: skip an hour within `gap` of one already chosen
    // unless nothing else at that cost level remains.
    const gap = Math.max(1, Math.floor(input.windowHours / (n * 3))) * HOUR;
    const chosen: typeof priced = [];
    for (const p of priced) {
      if (chosen.length === n) break;
      if (chosen.every((c) => Math.abs(c.t - p.t) >= gap)) chosen.push(p);
    }
    for (const p of priced) {
      if (chosen.length === n) break;
      if (!chosen.includes(p)) chosen.push(p);
    }
    for (const p of chosen) {
      rows.push({ t: p.t, ticker: a.ticker, usd: size, bps: p.c.bps, costUsd: (size * p.c.bps) / 1e4, regime: p.c.regime });
    }
  }
  rows.sort((x, y) => x.t - y.t || x.ticker.localeCompare(y.ticker));

  const legs: Leg[] = input.assets.map((a) => {
    const c = cost(a.ticker, input.start, a.usd);
    return { ticker: a.ticker, usd: a.usd, bps: c?.bps ?? null, costUsd: c ? (a.usd * c.bps) / 1e4 : null, regime: c?.regime ?? null };
  });
  const complete = legs.every((l) => l.bps !== null);
  const baseline = {
    legs,
    bps: complete ? weighted(legs as { usd: number; bps: number }[]) : null,
    costUsd: complete ? legs.reduce((s, l) => s + (l.costUsd ?? 0), 0) : null,
  };
  const totals = {
    usd: rows.reduce((s, r) => s + r.usd, 0),
    bps: weighted(rows),
    costUsd: rows.reduce((s, r) => s + r.costUsd, 0),
  };
  const comparable = complete && unplanned.length === 0;
  return {
    input,
    rows,
    baseline,
    totals,
    savedUsd: comparable ? baseline.costUsd! - totals.costUsd : null,
    savedBps: comparable ? baseline.bps! - totals.bps : null,
    unplanned,
  };
}
