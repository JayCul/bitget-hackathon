import { z } from "zod";
import { buildBundle } from "@/lib/bundle";
import { ASSETS } from "@/lib/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const Q = z.array(z.enum(ASSETS)).min(1).max(6);

/** Sampled cost model, volatility and live books for the requested rTokens. */
export async function GET(req: Request) {
  const parsed = Q.safeParse((new URL(req.url).searchParams.get("tickers") ?? "").split(",").filter(Boolean));
  if (!parsed.success) return Response.json({ error: `tickers must be some of ${ASSETS.join(", ")}` }, { status: 400 });
  return Response.json(await buildBundle(parsed.data));
}
