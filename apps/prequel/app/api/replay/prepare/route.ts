import { modelName } from "@desk/llm";
import type { Board } from "@/lib/prequel/types";
import { evaluate } from "@/lib/replay/engine";
import { matchNews } from "@/lib/replay/news-match";
import { getRecording } from "@/lib/replay/recordings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Loads the recorded sequence for a replay-mode board, runs the cheap news matcher once, then
 * evaluates every tripwire in code. The client only plays the result back.
 */
export async function POST(req: Request) {
  const board = (await req.json().catch(() => null)) as Board | null;
  if (!board?.thesis || !Array.isArray(board.headlines)) return Response.json({ error: "Board required" }, { status: 400 });
  if (board.thesis.mode !== "replay") {
    return Response.json({ error: "Replay needs a board created in Demo replay mode (as of a recorded date)." }, { status: 400 });
  }
  const { ticker, asOf, horizonDays } = board.thesis;
  let rec, shipped;
  try {
    ({ rec, shipped } = await getRecording(ticker, asOf, horizonDays));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e), stage: "record" }, { status: 502 });
  }
  let matches: Awaited<ReturnType<typeof matchNews>> = [];
  let newsError: string | null = null;
  try {
    matches = await matchNews(board.headlines, rec);
  } catch (e) {
    newsError = e instanceof Error ? e.message : String(e);
  }
  const fires = evaluate(board.headlines, rec, matches);
  return Response.json({ recording: rec, shipped, matches, fires, newsModel: modelName("main"), newsError });
}
