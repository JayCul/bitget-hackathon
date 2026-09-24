// Deterministic board metrics. Every figure the Board shows as COMPUTED comes from here.
import type { Direction, Headline, Side, TripwireCondition } from "./types";

export const BALANCE_WARNING = 0.7;

/** Evidence item = an analog event with a complete +5d window attached to a scenario. */
export function evidenceCount(h: Headline): number {
  return h.analogs?.outcomes.filter((o) => o.ret && !o.excluded).length ?? 0;
}

export type EvidenceBalance = {
  red: number;
  green: number;
  /** 1 - |R - G| / (R + G); null when there is no evidence at all */
  balance: number | null;
  redSupported: number; // scenarios with at least one analog
  greenSupported: number;
  warning: boolean;
};

export function evidenceBalance(headlines: Headline[]): EvidenceBalance {
  const side = (s: Side) => headlines.filter((h) => h.side === s);
  const red = side("RED").reduce((n, h) => n + evidenceCount(h), 0);
  const green = side("GREEN").reduce((n, h) => n + evidenceCount(h), 0);
  const balance = red + green === 0 ? null : 1 - Math.abs(red - green) / (red + green);
  return {
    red,
    green,
    balance,
    redSupported: side("RED").filter((h) => evidenceCount(h) > 0).length,
    greenSupported: side("GREEN").filter((h) => evidenceCount(h) > 0).length,
    warning: balance === null || balance < BALANCE_WARNING,
  };
}

/** Did an analog's +5d move go the way this scenario implies for the thesis? */
export function analogAgrees(side: Side, direction: Direction, ret5d: number): boolean {
  const thesisFavorable = direction === "long" ? ret5d > 0 : ret5d < 0;
  return side === "GREEN" ? thesisFavorable : !thesisFavorable && ret5d !== 0;
}

export const FIRED_WEIGHT = 5;

export type Conviction = {
  greenPoints: number;
  redPoints: number;
  /** green share, 0..1; null when there are no points */
  green: number | null;
  firedGreen: number;
  firedRed: number;
};

/**
 * Green vs Red split. Points per side = analogs whose +5d move agreed with that side's scenario
 * + FIRED_WEIGHT per fired tripwire on that side. Shown with this formula in the UI.
 */
export function modelConviction(headlines: Headline[], direction: Direction, firedIds: string[] = []): Conviction {
  let greenPoints = 0;
  let redPoints = 0;
  for (const h of headlines) {
    const agree =
      h.analogs?.outcomes.filter((o) => o.ret?.ret5d != null && !o.excluded && analogAgrees(h.side, direction, o.ret.ret5d))
        .length ?? 0;
    const fired = firedIds.includes(h.id) ? FIRED_WEIGHT : 0;
    if (h.side === "GREEN") greenPoints += agree + fired;
    else redPoints += agree + fired;
  }
  const total = greenPoints + redPoints;
  return {
    greenPoints,
    redPoints,
    green: total === 0 ? null : greenPoints / total,
    firedGreen: headlines.filter((h) => h.side === "GREEN" && firedIds.includes(h.id)).length,
    firedRed: headlines.filter((h) => h.side === "RED" && firedIds.includes(h.id)).length,
  };
}

const pctText = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;

/** Human label and computed level for a tripwire. Price levels come from the observed reference price. */
export function describeTripwire(c: TripwireCondition, ticker: string, refPrice: number): { label: string; level?: number } {
  switch (c.type) {
    case "price": {
      const level = refPrice * (1 + c.pct);
      return {
        label: `${ticker} closes ${c.op === "close_below" ? "below" : "above"} $${level.toFixed(2)} (${pctText(c.pct)} from $${refPrice.toFixed(2)})`,
        level,
      };
    }
    case "earnings":
      return { label: `Revenue surprise ${c.op === "below" ? "below" : "above"} ${pctText(c.pct)} vs consensus` };
    case "analyst":
      return { label: `${c.minCount}+ analyst ${c.direction}${c.minCount > 1 ? "s" : ""} within ${c.withinDays} days` };
    case "news":
      return { label: `News: ${c.description}` };
  }
}
