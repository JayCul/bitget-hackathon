import { appendFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Plan } from "@/lib/plan";
import { liveCost, liveSnapshots } from "@/lib/server";
import type { ExecutionReport, Fill } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Simulated execution. No order is sent anywhere. Each tranche is filled against Bitget's live
 * order book at confirmation time; later windows would fill against the book at that hour.
 * The report is appended to logs/landed-sim.jsonl (a temp dir when the filesystem is read-only).
 */
export async function POST(req: Request) {
  const { plan } = (await req.json().catch(() => ({}))) as { plan?: Plan };
  if (!plan?.rows?.length) return Response.json({ error: "Plan required" }, { status: 400 });

  const tickers = [...new Set(plan.rows.map((r) => r.ticker))];
  const snaps = await liveSnapshots(tickers);
  const byTicker = Object.fromEntries(tickers.map((t, i) => [t, snaps[i]!]));

  const fills: Fill[] = plan.rows.map((r) => {
    const s = byTicker[r.ticker];
    if (!s?.ok) return { t: r.t, ticker: r.ticker, usd: r.usd, plannedBps: r.bps, simBps: null, simPrice: null, qty: null, note: s?.ok === false ? s.message : "No book" };
    const w = liveCost(s.snap, r.usd);
    if (!w) return { t: r.t, ticker: r.ticker, usd: r.usd, plannedBps: r.bps, simBps: null, simPrice: null, qty: null, note: "Book too thin" };
    return { t: r.t, ticker: r.ticker, usd: r.usd, plannedBps: r.bps, simBps: w.costBps, simPrice: w.avgPrice, qty: w.qty };
  });

  const simOk = fills.every((f) => f.simBps !== null);
  const report: ExecutionReport = {
    id: `sim-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    fills,
    totals: {
      usd: fills.reduce((s, f) => s + f.usd, 0),
      plannedCostUsd: fills.reduce((s, f) => s + (f.usd * f.plannedBps) / 1e4, 0),
      simCostUsd: simOk ? fills.reduce((s, f) => s + (f.usd * (f.simBps ?? 0)) / 1e4, 0) : null,
    },
    method: "Simulated: each order walked against Bitget's live rToken order book at confirmation. Nothing was executed.",
  };

  const line = JSON.stringify({ ...report, plan: { input: plan.input, totals: plan.totals, baseline: plan.baseline } }) + "\n";
  for (const dir of [path.join(process.cwd(), "..", "..", "logs"), path.join(tmpdir(), "landed-logs")]) {
    try {
      await mkdir(dir, { recursive: true });
      await appendFile(path.join(dir, "landed-sim.jsonl"), line);
      break;
    } catch {
      // read-only filesystem: try the next location
    }
  }
  return Response.json(report);
}
