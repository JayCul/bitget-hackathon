import "server-only";
import { structured } from "@desk/llm";
import { z } from "zod";
import type { Headline } from "../prequel/types";
import type { NewsMatch, Recording } from "./types";

const Out = z.object({
  matches: z.array(z.object({ headline_id: z.string(), news_id: z.string(), confidence: z.number().min(0).max(1) })),
});

const SYSTEM = `You check whether recorded news items report that a scenario has happened.
Match a news item to a scenario only if the item reports the event as having occurred.
Previews, expectations, opinions, and "could"/"may" pieces do not count.
Return JSON only: {"matches":[{"headline_id":"R1","news_id":"n3","confidence":0.0-1.0}]}. An empty list is valid.`;

/** Cheap-model matcher: returns headline id + news id + confidence. Code decides what fires. */
export async function matchNews(headlines: Headline[], rec: Recording): Promise<NewsMatch[]> {
  const scenarios = headlines.filter((h) => h.tripwire.type === "news");
  const news = rec.events.filter((e) => e.kind === "news");
  if (!scenarios.length || !news.length) return [];

  const user = [
    `Ticker: ${rec.ticker}`,
    "Scenarios:",
    ...scenarios.map((h) => {
      const tw = h.tripwire as Extract<Headline["tripwire"], { type: "news" }>;
      return `${h.id}: ${h.headline} | watch for: ${tw.description} | keywords: ${tw.keywords.join(", ")}`;
    }),
    "News:",
    ...news.map((n) => `${n.id} | ${new Date(n.at).toISOString().slice(0, 10)} | ${n.title} | ${n.excerpt.slice(0, 110)}`),
  ].join("\n");

  const out = await structured({ schema: Out, system: SYSTEM, user, tier: "main", temperature: 0 });
  const validH = new Set(scenarios.map((h) => h.id));
  const validN = new Set(news.map((n) => n.id));
  return out.matches
    .filter((m) => validH.has(m.headline_id) && validN.has(m.news_id))
    .map((m) => ({ headlineId: m.headline_id, newsId: m.news_id, confidence: m.confidence }));
}
