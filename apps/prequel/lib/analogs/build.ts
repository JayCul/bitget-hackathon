// Pure candidate builders. Inputs are verified Bitget rows; outputs carry pre-event facts only.
import type { ConsensusRow, EarningsCalendarRow, IncomeRow, PriceTargetRow } from "@desk/bitget";
import { closeToClose, median, type DailyBar } from "@desk/market-data";
import { analystAction, earningsTiming, quarterLabel, ratingBucket, RATING_LABEL } from "./normalize";
import type { Candidate } from "./types";

const DAY = 86_400_000;
const inWindow = (d: string, from: string, to: string) => d >= from && d <= to;
const daysBetween = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / DAY;
const money = (x: number) =>
  x >= 1e9 ? `$${(x / 1e9).toFixed(2)}B` : x >= 1e6 ? `$${(x / 1e6).toFixed(0)}M` : `$${x.toFixed(0)}`;
const signed = (x: number, digits = 1) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(digits)}%`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Consensus label month for a fiscal period end. Periods ending in the first week belong to the prior month. */
export function consensusMonthLabel(periodEnding: string): string {
  const d = new Date(`${periodEnding}T00:00:00Z`);
  if (d.getUTCDate() <= 7) d.setUTCDate(0);
  return `${MONTHS[d.getUTCMonth()]}${d.getUTCFullYear()}`;
}

// ---------- earnings ----------

export function buildEarningsCandidates(
  ticker: string,
  calendar: EarningsCalendarRow[],
  income: IncomeRow[],
  consensus: ConsensusRow[],
  window: { from: string; to: string },
): Candidate[] {
  // Two calendar rows can describe one quarter (forecast + actual). Group by fiscal year + report type.
  const groups = new Map<string, EarningsCalendarRow[]>();
  for (const row of calendar) {
    const key = `${row.fiscal_year}|${row.report_type_name}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const out: Candidate[] = [];
  for (const rows of groups.values()) {
    const pick = (f: (r: EarningsCalendarRow) => string | null | undefined) =>
      rows.map(f).find((v): v is string => Boolean(v));
    const date =
      pick((r) => r.perf_brief_dsclsr_date) ??
      pick((r) => r.perf_report_dsclsr_date) ??
      pick((r) => r.perf_briefing_fore_dsclsr_date);
    if (!date || !inWindow(date, window.from, window.to)) continue;

    const first = rows[0]!;
    const q = quarterLabel(first.report_type_name) ?? first.report_type_name;
    const periodEnding = rows.map((r) => r.period_ending).sort().at(-1)!;
    const timing = earningsTiming(pick((r) => r.is_trading_time));
    const flags: string[] = [];
    if (!timing) flags.push("timing_unknown");

    // Actual single-quarter revenue for this period.
    const actual = income.find(
      (r) => quarterLabel(r.fiscal_period) && daysBetween(r.period_ending, periodEnding) <= 10 && r.revenue != null,
    );
    // Year-ago quarter, for growth.
    const yearAgo = actual
      ? income.find(
          (r) =>
            r.fiscal_period === actual.fiscal_period &&
            Math.abs(daysBetween(r.period_ending, actual.period_ending) - 364) <= 10 &&
            r.revenue != null,
        )
      : undefined;
    // Latest revenue consensus scraped before the report for this quarter.
    const label = `CurrentQtr.(${consensusMonthLabel(periodEnding)})`;
    const cons = consensus
      .filter((c) => c.fore_indicator_name === "Revenue" && c.report_period_scraped === label && c.scraped_date < date)
      .sort((a, b) => a.scraped_date.localeCompare(b.scraped_date))
      .at(-1);

    const revenue = actual?.revenue ?? null;
    const consensusRevenue = cons?.fore_mean ?? null;
    const surprise = revenue != null && consensusRevenue ? closeToClose(consensusRevenue, revenue) : null;
    const yoy = revenue != null && yearAgo?.revenue ? closeToClose(yearAgo.revenue, revenue) : null;

    const parts = [`${ticker} ${q} FY${first.fiscal_year} earnings, ${timing === "before_open" ? "before the open" : "after the close"}.`];
    if (revenue != null && consensusRevenue != null && surprise != null) {
      parts.push(`Revenue ${money(revenue)} vs consensus ${money(consensusRevenue)} (${surprise >= 0 ? "beat" : "miss"} ${signed(surprise)}).`);
    } else if (revenue != null) {
      parts.push(`Revenue ${money(revenue)}; pre-report consensus unavailable.`);
    } else {
      parts.push("Reported figures unavailable in source.");
    }
    if (yoy != null) parts.push(`Revenue growth ${signed(yoy, 0)} YoY.`);

    out.push({
      id: `${ticker}:earnings:${date}`,
      ticker,
      date,
      timing: timing ?? "after_close",
      type: "earnings",
      summary: parts.join(" "),
      facts: {
        quarter: `${q} FY${first.fiscal_year}`,
        period_ending: periodEnding,
        revenue,
        consensus_revenue: consensusRevenue,
        revenue_surprise: surprise,
        revenue_yoy: yoy,
        consensus_scraped: cons?.scraped_date ?? null,
      },
      source: "Bitget equity_calendar, equity_fundamental_income, equity_estimates_consensus",
      flags,
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ---------- earnings date alignment ----------

export const ALIGN_MIN_VOLUME_RATIO = 1.2;

/**
 * Bitget calendar dates were observed to run 1-2 sessions early (docs/tools.md). Align each earnings
 * event to its reaction session: the highest-volume session among the 3 after the calendar date,
 * measured against the median of the 10 sessions before the calendar date. Volume only, never
 * price direction, so alignment cannot bias outcomes. Below the ratio floor the calendar date stays
 * and the event is flagged unverified.
 */
export function alignEarningsDates(candidates: Candidate[], bars: DailyBar[]): Candidate[] {
  return candidates.map((c) => {
    if (c.type !== "earnings") return c;
    const i = bars.findIndex((b) => b.date > c.date); // first session after the calendar date
    const before = bars.filter((b) => b.date <= c.date).slice(-10);
    const baseline = median(before.map((b) => b.volume));
    const window = i >= 0 ? bars.slice(i, i + 3) : [];
    if (!baseline || window.length === 0 || before.length < 2) {
      return { ...c, flags: [...c.flags, "date_unverified"], facts: { ...c.facts, calendar_date: c.date } };
    }
    const thin = before.length < 5 ? ["thin_volume_baseline"] : [];
    let best = 0;
    for (let k = 1; k < window.length; k++) if (window[k]!.volume > window[best]!.volume) best = k;
    const reaction = window[best]!;
    const ratio = reaction.volume / baseline;
    if (ratio < ALIGN_MIN_VOLUME_RATIO) {
      return {
        ...c,
        flags: [...c.flags, ...thin, "date_unverified"],
        facts: { ...c.facts, calendar_date: c.date, reaction_volume_ratio: ratio },
      };
    }
    // After-close releases react the next session; before-open releases react the same session.
    const date = c.timing === "before_open" ? reaction.date : bars[i + best - 1]!.date;
    return {
      ...c,
      id: `${c.ticker}:earnings:${date}`,
      date,
      flags: [...c.flags, ...thin, ...(date === c.date ? [] : ["date_aligned"])],
      facts: { ...c.facts, calendar_date: c.date, reaction_session: reaction.date, reaction_volume_ratio: ratio },
    };
  });
}

/** First session that trades on an earnings release. */
export function reactionSession(c: Candidate, bars: DailyBar[]): string | undefined {
  if (c.timing === "before_open") return bars.find((b) => b.date >= c.date)?.date;
  return bars.find((b) => b.date > c.date)?.date;
}

// ---------- analyst revisions ----------

export function buildAnalystCandidates(
  ticker: string,
  rows: PriceTargetRow[],
  window: { from: string; to: string },
  earningsDates: string[],
): Candidate[] {
  const byDate = new Map<string, PriceTargetRow[]>();
  for (const r of rows) {
    if (!inWindow(r.published_date, window.from, window.to)) continue;
    byDate.set(r.published_date, [...(byDate.get(r.published_date) ?? []), r]);
  }

  const out: Candidate[] = [];
  for (const [date, notes] of byDate) {
    let upgrades = 0;
    let downgrades = 0;
    let initiations = 0;
    let raises = 0;
    let cuts = 0;
    const changes: number[] = [];
    const highlights: string[] = [];
    for (const n of notes) {
      const action = analystAction(n.action);
      const bucket = ratingBucket(n.rating_current);
      const rating = bucket ? RATING_LABEL[bucket] : null;
      if (action === "upgrade") upgrades++;
      if (action === "downgrade") downgrades++;
      if (action === "initiate") initiations++;
      if (n.price_target != null && n.price_target_previous) {
        const c = closeToClose(n.price_target_previous, n.price_target);
        changes.push(c);
        if (c > 0) raises++;
        if (c < 0) cuts++;
      }
      if (action && action !== "maintain" && n.analyst_firm) {
        highlights.push(`${n.analyst_firm} ${action}${rating ? ` to ${rating}` : ""}${n.price_target ? `, PT $${n.price_target}` : ""}`);
      }
    }
    if (upgrades + downgrades + initiations + raises + cuts === 0) continue;

    const med = median(changes);
    const flags: string[] = [];
    // Revisions within 3 days after earnings are reactions to the report, not independent events.
    if (earningsDates.some((e) => date >= e && daysBetween(date, e) <= 3)) flags.push("post_earnings");

    const parts = [`${ticker}: ${notes.length} analyst note${notes.length > 1 ? "s" : ""}.`];
    if (raises || cuts) parts.push(`${raises} target raise${raises === 1 ? "" : "s"}, ${cuts} cut${cuts === 1 ? "" : "s"}${med != null ? `, median target change ${signed(med)}` : ""}.`);
    if (upgrades || downgrades) parts.push(`${upgrades} upgrade${upgrades === 1 ? "" : "s"}, ${downgrades} downgrade${downgrades === 1 ? "" : "s"}.`);
    if (initiations) parts.push(`${initiations} initiation${initiations === 1 ? "" : "s"}.`);
    if (highlights.length) parts.push(highlights.slice(0, 3).join("; ") + ".");

    out.push({
      id: `${ticker}:analyst:${date}`,
      ticker,
      date,
      timing: "before_open",
      type: "analyst",
      summary: parts.join(" "),
      facts: { notes: notes.length, upgrades, downgrades, initiations, target_raises: raises, target_cuts: cuts, median_target_change: med },
      source: "Bitget equity_estimates_price_target",
      flags,
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ---------- gap days ----------

export function buildGapCandidates(
  ticker: string,
  bars: DailyBar[],
  minAbsGap: number,
  reactionSessions: string[],
): Candidate[] {
  const out: Candidate[] = [];
  for (let k = 1; k < bars.length; k++) {
    const prev = bars[k - 1]!;
    const cur = bars[k]!;
    const gap = closeToClose(prev.close, cur.open);
    if (Math.abs(gap) < minAbsGap) continue;
    const flags: string[] = [];
    if (reactionSessions.includes(cur.date)) flags.push("earnings_reaction");
    out.push({
      id: `${ticker}:gap:${cur.date}`,
      ticker,
      date: cur.date,
      timing: "at_open",
      type: "gap",
      summary: `${ticker} opened ${gap >= 0 ? "up" : "down"} ${signed(gap)} vs the prior close${flags.length ? " (earnings reaction)" : ""}.`,
      facts: { gap, prior_close: prev.close, open: cur.open },
      source: "Bitget rToken 1h K-lines, US session",
      flags,
    });
  }
  return out;
}
