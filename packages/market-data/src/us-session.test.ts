import { describe, expect, it } from "vitest";
import { isTradingDay, nyOffsetHours, sessionBarsFromHourly, sessionWindow, type HourlyBar } from "./us-session";

const H = 3_600_000;
const hour = (iso: string, close: number): HourlyBar => ({
  time: Date.parse(iso),
  open: close - 1,
  high: close + 1,
  low: close - 2,
  close,
  volume: 10,
});

describe("calendar", () => {
  it("knows DST boundaries for 2026", () => {
    expect(nyOffsetHours("2026-03-07")).toBe(-5);
    expect(nyOffsetHours("2026-03-09")).toBe(-4);
    expect(nyOffsetHours("2026-10-30")).toBe(-4);
    expect(nyOffsetHours("2026-11-02")).toBe(-5);
  });

  it("skips weekends and holidays", () => {
    expect(isTradingDay("2026-09-05")).toBe(false); // Saturday
    expect(isTradingDay("2026-09-07")).toBe(false); // Labor Day
    expect(isTradingDay("2026-09-08")).toBe(true);
  });

  it("puts the summer session at 13:30-20:00 UTC", () => {
    const w = sessionWindow("2026-08-25");
    expect(new Date(w.open).toISOString()).toBe("2026-08-25T13:30:00.000Z");
    expect(new Date(w.close).toISOString()).toBe("2026-08-25T20:00:00.000Z");
  });
});

describe("sessionBarsFromHourly", () => {
  const day = "2026-08-25";
  const start = Date.parse(`${day}T11:00:00Z`);
  // 11:00 .. 22:00 UTC, closes 100..111
  const hourly = Array.from({ length: 12 }, (_, i) => hour(new Date(start + i * H).toISOString(), 100 + i));

  it("aggregates only session hours 13:00-19:00 UTC", () => {
    const { bars } = sessionBarsFromHourly(hourly);
    expect(bars).toHaveLength(1);
    const b = bars[0]!;
    expect(b.date).toBe(day);
    expect(b.open).toBe(101); // 13:00 bar open = close 102 - 1
    expect(b.close).toBe(108); // 19:00 bar
    expect(b.high).toBe(109);
    expect(b.low).toBe(100);
    expect(b.volume).toBe(70);
  });

  it("skips thin days and weekend hours", () => {
    const thin = hourly.slice(2, 5); // 3 session hours
    const weekend = [hour("2026-08-29T15:00:00Z", 1)];
    const r = sessionBarsFromHourly([...thin, ...weekend]);
    expect(r.bars).toHaveLength(0);
    expect(r.skipped).toEqual([{ date: day, hours: 3 }]);
  });
});
