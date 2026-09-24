// Bitget returns analyst and calendar vocabularies in Chinese. Map them to English in code.

export type RatingBucket = "strong_buy" | "buy" | "hold" | "sell";

const RATING: Record<string, RatingBucket> = {
  强力买进: "strong_buy",
  买入: "buy",
  增持: "buy",
  跑赢大盘: "buy",
  积极: "buy",
  持有: "hold",
  中性: "hold",
  持股观望: "hold",
  减持: "sell",
  卖出: "sell",
  逊于大盘: "sell",
};

export const RATING_LABEL: Record<RatingBucket, string> = {
  strong_buy: "Strong Buy",
  buy: "Buy",
  hold: "Hold",
  sell: "Sell",
};

export function ratingBucket(raw: string | null | undefined): RatingBucket | null {
  return raw ? (RATING[raw] ?? null) : null;
}

export type AnalystAction = "upgrade" | "downgrade" | "initiate" | "maintain";

const ACTION: Record<string, AnalystAction> = {
  调高评级: "upgrade",
  下调评级: "downgrade",
  首次覆盖: "initiate",
  假设: "initiate",
  维持: "maintain",
  重申: "maintain",
};

export function analystAction(raw: string | null | undefined): AnalystAction | null {
  return raw ? (ACTION[raw] ?? null) : null;
}

/** 盘后 after close, 盘前 before open. Anything else is unknown. */
export function earningsTiming(raw: string | null | undefined): "after_close" | "before_open" | null {
  if (raw === "盘后") return "after_close";
  if (raw === "盘前") return "before_open";
  return null;
}

const QUARTER: Record<string, string> = { 一季报: "Q1", 二季报: "Q2", 三季报: "Q3", 四季报: "Q4" };

/** Single-quarter report types only. Cumulative ones (中报, 年报, 三季报(累计)) return null. */
export function quarterLabel(reportType: string): string | null {
  return QUARTER[reportType] ?? null;
}
