import { describe, expect, it } from "vitest";
import { analogStats, eventReturn, gapDays, median } from "./historical-returns";
import type { DailyBar } from "./types";

const bar = (date: string, close: number, open = close): DailyBar => ({
  date,
  open,
  high: Math.max(open, close),
  low: Math.min(open, close),
  close,
  volume: 1,
});

// Mon 2024-01-01 .. with a weekend gap
const bars: DailyBar[] = [
  bar("2024-01-02", 100),
  bar("2024-01-03", 110, 105),
  bar("2024-01-04", 99),
  bar("2024-01-05", 100),
  bar("2024-01-08", 120, 118),
  bar("2024-01-09", 90),
  bar("2024-01-10", 105),
  bar("2024-01-11", 108),
];

describe("eventReturn", () => {
  it("after_close anchors on the event-date close", () => {
    const r = eventReturn(bars, "2024-01-02", "after_close")!;
    expect(r.baseDate).toBe("2024-01-02");
    expect(r.ret1d).toBeCloseTo(0.1);
    expect(r.ret5d).toBeCloseTo(-0.1); // 2024-01-09 close 90
    expect(r.path).toHaveLength(6);
  });

  it("before_open anchors on the prior session close", () => {
    const r = eventReturn(bars, "2024-01-03", "before_open")!;
    expect(r.baseDate).toBe("2024-01-02");
    expect(r.ret1d).toBeCloseTo(0.1);
  });

  it("weekend event anchors on Friday close", () => {
    const r = eventReturn(bars, "2024-01-06", "after_close")!;
    expect(r.baseDate).toBe("2024-01-05");
    expect(r.ret1d).toBeCloseTo(0.2);
  });

  it("returns null windows past the end of data", () => {
    const r = eventReturn(bars, "2024-01-09", "after_close")!;
    expect(r.ret1d).toBeCloseTo(105 / 90 - 1);
    expect(r.ret5d).toBeNull();
  });

  it("returns null when the event predates the series", () => {
    expect(eventReturn(bars, "2023-12-01", "before_open")).toBeNull();
  });
});

describe("analogStats", () => {
  it("counts only complete windows and takes medians", () => {
    const rs = ["2024-01-02", "2024-01-03", "2024-01-09"].map((d) => eventReturn(bars, d, "after_close")!);
    const s = analogStats(rs);
    expect(s.n).toBe(2);
    expect(s.positive + s.negative).toBe(2);
    expect(s.median1d).toBeCloseTo((0.1 + (99 / 110 - 1)) / 2);
  });
});

describe("median", () => {
  it("handles odd, even and empty", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("gapDays", () => {
  it("finds opens that gap from the prior close", () => {
    const g = gapDays(bars, 0.15);
    expect(g.map((x) => x.date)).toEqual(["2024-01-08", "2024-01-09", "2024-01-10"]);
    expect(g[0]!.gap).toBeCloseTo(0.18);
  });
});
