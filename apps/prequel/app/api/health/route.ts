import { bitget } from "@desk/bitget";

export const dynamic = "force-dynamic";

/** Proves the server can reach Bitget. Returns the source result verbatim, including failures. */
export async function GET() {
  const started = Date.now();
  const r = await bitget.spotTicker("RNVDA/USDT");
  return Response.json({
    bitget: r.ok ? { ok: true, bid: r.rows[0]?.bid, ask: r.rows[0]?.ask, at: r.rows[0]?.timestamp } : r,
    llmConfigured: Boolean(process.env.LLM_API_KEY && process.env.LLM_BASE_URL),
    ms: Date.now() - started,
  });
}
