import { loadUniverse } from "@/lib/analogs/load";
import { universeFor } from "@/lib/analogs/peers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Inspection route: candidate events and bar coverage for a ticker and its peers. */
export async function GET(req: Request) {
  const ticker = new URL(req.url).searchParams.get("ticker") ?? "NVDA";
  const started = Date.now();
  const u = await loadUniverse(universeFor(ticker));
  const count = (type: string) => u.candidates.filter((c) => c.type === type).length;
  return Response.json({
    ms: Date.now() - started,
    tickers: u.tickers,
    window: u.window,
    barsSource: u.barsSource,
    coverage: Object.fromEntries(Object.entries(u.bars).map(([t, b]) => [t, { sessions: b.length, from: b[0]?.date, to: b.at(-1)?.date }])),
    counts: { earnings: count("earnings"), analyst: count("analyst"), gap: count("gap") },
    failures: u.failures,
    candidates: u.candidates,
  });
}
