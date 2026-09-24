import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ConsensusRow, EarningsCalendarRow, IncomeRow, PriceTargetRow } from "@desk/bitget";
import type { DailyBar } from "@desk/market-data";
import {
  alignEarningsDates,
  buildAnalystCandidates,
  buildEarningsCandidates,
  buildGapCandidates,
  consensusMonthLabel,
  reactionSession,
} from "./build";
import type { Candidate } from "./types";

const window = { from: "2026-04-22", to: "2026-09-24" };

const cal = (p: Partial<EarningsCalendarRow>): EarningsCalendarRow => ({
  symbol: "AMD",
  period_ending: "2026-06-27",
  fiscal_year: "2026",
  report_type_name: "二季报",
  perf_brief_dsclsr_date: null,
  perf_report_dsclsr_date: null,
  perf_briefing_fore_dsclsr_date: null,
  is_trading_time: "盘后",
  ...p,
});

const inc = (p: Partial<IncomeRow>): IncomeRow => ({
  period_ending: "2026-06-27",
  fiscal_period: "二季报",
  fiscal_year: 2026,
  symbol: "AMD",
  revenue: null,
  total_dlt_earnings_common_ps: null,
  announcement_date: null,
  ...p,
});

const cons = (p: Partial<ConsensusRow>): ConsensusRow => ({
  symbol: "AMD",
  fore_indicator_name: "Revenue",
  report_period_scraped: "CurrentQtr.(Jun2026)",
  fiscal_year: 2026,
  fore_mean: null,
  fore_org_num: 40,
  scraped_date: "2026-08-02",
  ...p,
});

describe("consensusMonthLabel", () => {
  it("maps fiscal period ends to consensus labels", () => {
    expect(consensusMonthLabel("2026-06-27")).toBe("Jun2026");
    expect(consensusMonthLabel("2026-05-02")).toBe("Apr2026"); // first-week end belongs to prior month
    expect(consensusMonthLabel("2026-01-31")).toBe("Jan2026");
  });
});

describe("buildEarningsCandidates", () => {
  it("merges duplicate calendar rows and computes revenue surprise and growth", () => {
    const [c, ...rest] = buildEarningsCandidates(
      "AMD",
      [
        cal({ period_ending: "2026-06-27", perf_briefing_fore_dsclsr_date: "2026-08-03" }),
        cal({ period_ending: "2026-06-26", perf_report_dsclsr_date: "2026-08-04", perf_briefing_fore_dsclsr_date: "2026-08-03" }),
      ],
      [inc({ revenue: 12_000_000_000 }), inc({ period_ending: "2025-06-27", fiscal_year: 2025, revenue: 7_685_000_000 })],
      [cons({ fore_mean: 11_310_000_000 }), cons({ fore_mean: 99, scraped_date: "2026-09-01" })],
      window,
    );
    expect(rest).toHaveLength(0);
    expect(c!.date).toBe("2026-08-04"); // filing date beats scheduled date
    expect(c!.timing).toBe("after_close");
    expect(c!.facts.revenue_surprise).toBeCloseTo(12 / 11.31 - 1);
    expect(c!.facts.revenue_yoy).toBeCloseTo(12 / 7.685 - 1);
    expect(c!.summary).toContain("beat");
    expect(c!.summary).not.toMatch(/return|rose|fell|closed/i);
  });

  it("says so when figures are missing and drops events outside the window", () => {
    const out = buildEarningsCandidates(
      "AMD",
      [cal({ perf_report_dsclsr_date: "2026-08-04" }), cal({ report_type_name: "一季报", perf_report_dsclsr_date: "2026-03-01" })],
      [],
      [],
      window,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.facts.revenue_surprise).toBeNull();
    expect(out[0]!.summary).toContain("unavailable");
  });
});

describe("buildAnalystCandidates", () => {
  const pt = (p: Partial<PriceTargetRow>): PriceTargetRow => ({
    published_date: "2026-08-27",
    symbol: "NVDA",
    analyst_firm: "Firm",
    price_target: null,
    price_target_previous: null,
    rating_current: "买入",
    rating_previous: null,
    action: "维持",
    time: 0,
    ...p,
  });

  it("groups by day, counts raises and upgrades, flags post-earnings reactions", () => {
    const out = buildAnalystCandidates(
      "NVDA",
      [
        pt({ price_target: 300, price_target_previous: 250 }),
        pt({ price_target: 240, price_target_previous: 250 }),
        pt({ action: "调高评级", analyst_firm: "Piper", price_target: 320, price_target_previous: 280 }),
        pt({ published_date: "2026-07-01" }), // maintain without change: not an event
      ],
      window,
      ["2026-08-25"],
    );
    expect(out).toHaveLength(1);
    const c = out[0]!;
    expect(c.facts.target_raises).toBe(2);
    expect(c.facts.target_cuts).toBe(1);
    expect(c.facts.upgrades).toBe(1);
    expect(c.facts.median_target_change).toBeCloseTo(320 / 280 - 1); // median of +20%, -4%, +14.3%
    expect(c.flags).toContain("post_earnings");
    expect(c.summary).toContain("Piper upgrade to Buy");
  });

  it("builds events from the recorded NVDA response", () => {
    const raw = JSON.parse(readFileSync(path.join(__dirname, "../../../../docs/raw/pt-nvda.json"), "utf8"));
    const out = buildAnalystCandidates("NVDA", raw.structuredContent.data.results, window, []);
    expect(out.length).toBeGreaterThan(5);
    for (const c of out) expect(c.date >= window.from && c.date <= window.to).toBe(true);
  });
});

describe("alignEarningsDates", () => {
  // 12 quiet sessions at volume 100, then a spike two sessions after the calendar date.
  const days = ["08-10", "08-11", "08-12", "08-13", "08-14", "08-17", "08-18", "08-19", "08-20", "08-21", "08-24", "08-25", "08-26", "08-27", "08-28"];
  const bars: DailyBar[] = days.map((d) => ({ date: `2026-${d}`, open: 1, high: 1, low: 1, close: 1, volume: d === "08-27" ? 280 : 100 }));
  const earnings = (timing: "after_close" | "before_open"): Candidate => ({
    id: "NVDA:earnings:2026-08-25",
    ticker: "NVDA",
    date: "2026-08-25",
    timing,
    type: "earnings",
    summary: "",
    facts: {},
    source: "",
    flags: [],
  });

  it("moves an after-close release to the session before the volume spike", () => {
    const [c] = alignEarningsDates([earnings("after_close")], bars);
    expect(c!.date).toBe("2026-08-26");
    expect(c!.id).toBe("NVDA:earnings:2026-08-26");
    expect(c!.flags).toContain("date_aligned");
    expect(c!.facts.calendar_date).toBe("2026-08-25");
    expect(c!.facts.reaction_volume_ratio).toBeCloseTo(2.8);
    expect(reactionSession(c!, bars)).toBe("2026-08-27");
  });

  it("puts a before-open release on the spike session", () => {
    const [c] = alignEarningsDates([earnings("before_open")], bars);
    expect(c!.date).toBe("2026-08-27");
  });

  it("keeps the calendar date and flags it when there is no spike", () => {
    const flat = bars.map((b) => ({ ...b, volume: 100 }));
    const [c] = alignEarningsDates([earnings("after_close")], flat);
    expect(c!.date).toBe("2026-08-25");
    expect(c!.flags).toContain("date_unverified");
  });
});

describe("buildGapCandidates", () => {
  const b = (date: string, open: number, close: number): DailyBar => ({ date, open, close, high: Math.max(open, close), low: Math.min(open, close), volume: 1 });
  it("finds gaps and flags the post-earnings session", () => {
    const bars = [b("2026-08-25", 100, 100), b("2026-08-26", 94, 95), b("2026-08-27", 95.5, 96), b("2026-08-28", 101, 101)];
    const out = buildGapCandidates("NVDA", bars, 0.04, ["2026-08-26"]);
    expect(out.map((c) => c.date)).toEqual(["2026-08-26", "2026-08-28"]);
    expect(out[0]!.flags).toEqual(["earnings_reaction"]);
    expect(out[0]!.timing).toBe("at_open");
    expect(out[1]!.flags).toEqual([]);
  });
});
