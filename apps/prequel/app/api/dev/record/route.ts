import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { record } from "@/lib/replay/record";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Dev only: capture a real replay window from Bitget and write it into data/replays. */
export async function GET(req: Request) {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  const q = new URL(req.url).searchParams;
  const ticker = (q.get("ticker") ?? "NVDA").toUpperCase();
  const start = q.get("start") ?? "2026-08-10";
  const days = Number(q.get("days") ?? 21);
  const rec = await record(ticker, start, days);
  const dir = path.join(process.cwd(), "data", "replays");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${ticker}-${start}.json`);
  await writeFile(file, JSON.stringify(rec));
  const counts = rec.events.reduce<Record<string, number>>((m, e) => ((m[e.kind] = (m[e.kind] ?? 0) + 1), m), {});
  return Response.json({ file, counts, sources: rec.sources, hourly: rec.hourly.length, sessions: rec.sessions.length });
}
