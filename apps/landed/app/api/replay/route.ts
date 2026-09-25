import { z } from "zod";
import { backtest, periodStarts } from "@/lib/backtest";
import { costFn } from "@/lib/costs";
import { ASSETS, hourlyBars, loadModel } from "@/lib/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  anchor: z.number().optional(),
  periods: z.number().int().min(6).max(12).default(8),
  windowHours: z.number().int().min(1).max(168),
  tranchesPerAsset: z.number().int().min(1).max(6),
  assets: z
    .array(z.object({ ticker: z.enum(ASSETS), usd: z.number().positive().max(1_000_000) }))
    .min(1)
    .max(6),
});

/** Same budget and plan rules across past weekly windows. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  const { anchor = Date.now(), periods, ...input } = parsed.data;

  const starts = periodStarts(anchor, periods);
  const from = starts[0]! - 3_600_000;
  const to = starts.at(-1)! + input.windowHours * 3_600_000 + 3_600_000;
  const [model, ...bars] = await Promise.all([loadModel(), ...input.assets.map((a) => hourlyBars(a.ticker, from, to))]);
  const barsBy = Object.fromEntries(input.assets.map((a, i) => [a.ticker, bars[i]!.bars]));
  const failures = input.assets.flatMap((a, i) => (bars[i]!.failure ? [{ ticker: a.ticker, message: bars[i]!.failure! }] : []));

  const result = backtest(input, starts, costFn(model), barsBy);
  // Measured median spread per asset and market state, so the page can split out spread cost.
  const spreads = Object.fromEntries(
    input.assets.map((a) => [
      a.ticker,
      Object.fromEntries(Object.entries(model.assets[a.ticker] ?? {}).map(([r, st]) => [r, st!.spreadBps])),
    ]),
  );
  return Response.json({
    ...result,
    spreads,
    failures,
    model: { samples: model.samples, from: model.from, to: model.to },
    input: { ...input, anchor, periods },
  });
}
