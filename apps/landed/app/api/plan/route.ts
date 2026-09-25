import { z } from "zod";
import { costBps, costFn } from "@/lib/costs";
import { planExecution } from "@/lib/plan";
import type { Regime } from "@/lib/regime";
import { ASSETS, liveCost, liveSnapshots, loadModel } from "@/lib/server";
import type { MicroRow, PlanResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const Body = z.object({
  start: z.number().optional(),
  windowHours: z.number().int().min(1).max(168),
  tranchesPerAsset: z.number().int().min(1).max(6),
  assets: z
    .array(z.object({ ticker: z.enum(ASSETS), usd: z.number().positive().max(1_000_000) }))
    .min(1)
    .max(6),
});

const REGIMES: Regime[] = ["session", "extended", "overnight", "weekend"];

/** Deterministic plan from sampled costs, plus the live book for "buy now". */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  const input = { ...parsed.data, start: parsed.data.start ?? Date.now() };

  const [model, snaps] = await Promise.all([loadModel(), liveSnapshots(input.assets.map((a) => a.ticker))]);
  const plan = planExecution(input, costFn(model));

  const micro: MicroRow[] = input.assets.map((a, i) => {
    const s = snaps[i]!;
    const tranche = a.usd / input.tranchesPerAsset;
    const sampled: MicroRow["sampled"] = {};
    for (const r of REGIMES) {
      const st = model.assets[a.ticker]?.[r];
      if (st) sampled[r] = { n: st.n, spreadBps: st.spreadBps, costBps: costBps(model, a.ticker, r, tranche) };
    }
    return {
      ticker: a.ticker,
      live: s.ok
        ? {
            ok: true,
            at: s.snap.at,
            regime: s.snap.regime,
            mid: s.snap.mid,
            spreadBps: s.snap.spreadBps,
            depthAsk25Usd: s.snap.depthAsk25Usd,
            buyNowBps: liveCost(s.snap, a.usd)?.costBps ?? null,
          }
        : { ok: false, message: s.message },
      sampled,
    };
  });

  const liveNow = input.assets.map((a, i) => {
    const s = snaps[i]!;
    if (!s.ok) return { ticker: a.ticker, usd: a.usd, bps: null, costUsd: null, message: s.message };
    const w = liveCost(s.snap, a.usd);
    return w
      ? { ticker: a.ticker, usd: a.usd, bps: w.costBps, costUsd: (a.usd * w.costBps) / 1e4 }
      : { ticker: a.ticker, usd: a.usd, bps: null, costUsd: null, message: "Book too thin for this size" };
  });

  const body: PlanResponse = {
    plan,
    micro,
    liveNow,
    model: { samples: model.samples, from: model.from, to: model.to },
    generatedAt: new Date().toISOString(),
  };
  return Response.json(body);
}
