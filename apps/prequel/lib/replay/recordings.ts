import "server-only";
import nvdaAug from "@/data/replays/NVDA-2026-08-10.json";
import { cached } from "../cache";
import { record } from "./record";
import type { Recording } from "./types";

/** Recorded windows shipped with the app. Real Bitget data captured once and committed. */
const SHIPPED: Record<string, Recording> = {
  "NVDA:2026-08-10": nvdaAug as Recording,
};

/** Shipped recording if present, otherwise record the same window live from Bitget (cached). */
export async function getRecording(ticker: string, start: string, days: number): Promise<{ rec: Recording; shipped: boolean }> {
  const shipped = SHIPPED[`${ticker}:${start}`];
  if (shipped) return { rec: shipped, shipped: true };
  const rec = await cached(`recording:${ticker}:${start}:${days}`, 7 * 86_400_000, async () => ({
    ok: true,
    value: await record(ticker, start, days),
  }));
  return { rec, shipped: false };
}
