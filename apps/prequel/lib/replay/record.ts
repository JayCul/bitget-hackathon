import "server-only";
import { bitget } from "@desk/bitget";
import { sessionBarsFromHourly, sessionWindow } from "@desk/market-data";
import { hourlyBars, loadUniverse, priceTargetRows } from "../analogs/load";
import { analystAction, ratingBucket, RATING_LABEL } from "../analogs/normalize";
import type { Recording, ReplayEvent } from "./types";

const DAY = 86_400_000;
const MIN = 60_000;

function stripHtml(s: string) {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

/**
 * Record a real, timestamped sequence for [start, start + days] from Bitget:
 * hourly rToken prices, session closes, the aligned earnings event, analyst notes and stock news.
 */
export async function record(ticker: string, start: string, days: number): Promise<Recording> {
  const end = addDays(start, days);
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${end}T23:59:59Z`);
  const sources: string[] = [];

  // Prices
  const h = await hourlyBars(ticker, from, to);
  if (!h.rows.length) throw new Error(`No hourly bars for ${ticker} in ${start}..${end}: ${h.failure ?? "empty"}`);
  sources.push(`Bitget crypto_spot_kline R${ticker}/USDT 1h (${h.rows.length} bars)`);
  const { bars: sessions } = sessionBarsFromHourly(h.rows);
  const events: ReplayEvent[] = sessions.map((b) => ({
    kind: "session_close",
    at: sessionWindow(b.date).close,
    date: b.date,
    close: b.close,
  }));

  // Earnings, aligned (see build.ts)
  const universe = await loadUniverse([ticker]);
  for (const c of universe.candidates) {
    if (c.type !== "earnings" || c.date < start || c.date > end) continue;
    const w = sessionWindow(c.date);
    events.push({
      kind: "earnings",
      at: c.timing === "before_open" ? w.open - 30 * MIN : w.close + 5 * MIN,
      date: c.date,
      summary: c.summary,
      revenue: typeof c.facts.revenue === "number" ? c.facts.revenue : null,
      consensus: typeof c.facts.consensus_revenue === "number" ? c.facts.consensus_revenue : null,
      surprise: typeof c.facts.revenue_surprise === "number" ? c.facts.revenue_surprise : null,
      calendarDate: typeof c.facts.calendar_date === "string" ? c.facts.calendar_date : null,
    });
  }
  sources.push("Bitget equity_calendar + equity_fundamental_income + equity_estimates_consensus (earnings date aligned by volume)");

  // Analyst notes. The source gives dates only; notes are placed one hour before the open.
  const targets = await priceTargetRows(ticker);
  const byDate = new Map<string, typeof targets.rows>();
  for (const r of targets.rows) {
    if (r.published_date < start || r.published_date > end) continue;
    byDate.set(r.published_date, [...(byDate.get(r.published_date) ?? []), r]);
  }
  for (const [date, rows] of byDate) {
    events.push({
      kind: "analyst",
      at: sessionWindow(date).open - 60 * MIN,
      date,
      notes: rows.map((r) => {
        const b = ratingBucket(r.rating_current);
        return {
          firm: r.analyst_firm,
          action: analystAction(r.action),
          rating: b ? RATING_LABEL[b] : null,
          target: r.price_target,
          previousTarget: r.price_target_previous,
        };
      }),
    });
  }
  sources.push("Bitget equity_estimates_price_target (date-level; placed pre-market)");

  // Stock news (label 2), all items in the window.
  const news = await bitget.stockNews({ start: `${start}T00:00:00Z`, end: `${end}T23:59:59Z`, pageSize: 1000 });
  if (news.ok) {
    news.rows.forEach((n, i) => {
      events.push({
        kind: "news",
        at: Date.parse(n.date.endsWith("Z") ? n.date : `${n.date}Z`),
        id: `n${i + 1}`,
        title: stripHtml(n.title),
        excerpt: stripHtml(n.content ?? "").slice(0, 240),
      });
    });
    sources.push(`Bitget news_label_search label=Stocks (${news.rows.length} items)`);
  } else {
    sources.push(`Bitget news_label_search unavailable: ${news.message}`);
  }

  return {
    ticker,
    start,
    end,
    recordedAt: new Date().toISOString(),
    sources,
    hourly: h.rows.filter((k) => k.time >= from && k.time <= to).map((k) => ({ t: k.time, c: k.close })),
    sessions,
    events: events.sort((a, b) => a.at - b.at),
  };
}
