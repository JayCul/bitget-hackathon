import demo from "@/data/demo/board.json";
import type { Board } from "./prequel/types";

/** A board produced by the real pipeline (as of 10 Aug 2026) and saved for the landing preview and replay demo. */
export const DEMO_BOARD = demo as unknown as Board;

const NAMES: Record<string, RegExp> = {
  NVDA: /nvidia|\bnvda\b/i,
  AMD: /\bamd\b|advanced micro/i,
  AVGO: /broadcom|\bavgo\b/i,
  MU: /micron|\bmu\b/i,
  TSM: /tsmc|taiwan semi/i,
};

/** Does a news title mention the company? Used only to choose which recorded news appear in the log. */
export function mentions(ticker: string, title: string) {
  return (NAMES[ticker] ?? new RegExp(`\\b${ticker}\\b`, "i")).test(title);
}
