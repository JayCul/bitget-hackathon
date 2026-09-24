import { z } from "zod";
import { research } from "@/lib/prequel/research";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ThesisIn = z.object({
  ticker: z.string().trim().min(1).max(10).regex(/^[A-Za-z.]+$/),
  direction: z.enum(["long", "short"]),
  horizonDays: z.number().int().min(3).max(60),
  sizeUsd: z.number().positive().max(10_000_000),
  text: z.string().trim().min(10).max(600),
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mode: z.enum(["live", "replay"]),
});

/** Streams NDJSON progress events, then the board. */
export async function POST(req: Request) {
  const parsed = ThesisIn.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of research(parsed.data)) controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        controller.enqueue(encoder.encode(JSON.stringify({ kind: "error", stage: "unknown", message }) + "\n"));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
