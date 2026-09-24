import { z } from "zod";
import { loadUniverse } from "@/lib/analogs/load";
import { matchAnalogs } from "@/lib/analogs/match";
import { computeOutcomes } from "@/lib/analogs/outcomes";
import { universeFor } from "@/lib/analogs/peers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  ticker: z.string().min(1).max(10),
  queries: z
    .array(
      z.object({
        headlineId: z.string(),
        headline: z.string(),
        analogQuery: z.string(),
        types: z.array(z.enum(["earnings", "analyst", "gap"])).min(1),
      }),
    )
    .min(1)
    .max(10),
});

/** LLM picks analog ids; code computes every number. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  const { ticker, queries } = parsed.data;

  const t0 = Date.now();
  const universe = await loadUniverse(universeFor(ticker));
  const t1 = Date.now();
  let match;
  try {
    match = await matchAnalogs(ticker.toUpperCase(), queries, universe.candidates);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e), stage: "llm_match" }, { status: 502 });
  }
  const t2 = Date.now();

  const results = Object.fromEntries(
    Object.entries(match.byHeadline).map(([id, m]) => [id, { ...m, ...computeOutcomes(m.ids, universe) }]),
  );
  return Response.json({
    timings: { loadMs: t1 - t0, llmMs: t2 - t1 },
    model: process.env.LLM_MODEL,
    llmCalls: match.calls,
    window: universe.window,
    barsSource: universe.barsSource,
    failures: universe.failures,
    results,
  });
}
