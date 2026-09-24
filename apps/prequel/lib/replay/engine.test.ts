import { describe, expect, it } from "vitest";
import type { Headline, Tripwire } from "../prequel/types";
import { evaluate, stateAt } from "./engine";
import type { Recording } from "./types";

const at = (iso: string) => Date.parse(iso);

const rec: Recording = {
  ticker: "NVDA",
  start: "2026-08-10",
  end: "2026-08-31",
  recordedAt: "",
  sources: [],
  hourly: [],
  sessions: [],
  events: [
    { kind: "session_close", at: at("2026-08-10T20:00:00Z"), date: "2026-08-10", close: 220 },
    { kind: "session_close", at: at("2026-08-11T20:00:00Z"), date: "2026-08-11", close: 205 },
    { kind: "analyst", at: at("2026-08-12T12:00:00Z"), date: "2026-08-12", notes: [{ firm: "A", action: "maintain", rating: null, target: 200, previousTarget: 250 }] },
    { kind: "analyst", at: at("2026-08-14T12:00:00Z"), date: "2026-08-14", notes: [{ firm: "B", action: "downgrade", rating: null, target: 210, previousTarget: 240 }] },
    { kind: "earnings", at: at("2026-08-26T20:05:00Z"), date: "2026-08-26", summary: "", revenue: 96, consensus: 92, surprise: 96 / 92 - 1, calendarDate: "2026-08-25" },
    { kind: "news", at: at("2026-08-27T09:14:00Z"), id: "n1", title: "Nvidia beats", excerpt: "" },
  ],
};

const hl = (id: string, tw: Tripwire, windowDays = 21): Headline => ({
  id,
  side: id.startsWith("R") ? "RED" : "GREEN",
  headline: "",
  window: "",
  windowDays,
  modelEstimate: 0.3,
  tripwire: tw,
  analogQuery: "",
  analogFilter: { type: "gap", direction: "any" },
  analogs: null,
});

describe("evaluate", () => {
  const hs = [
    hl("R1", { type: "price", op: "close_below", pct: -0.08, level: 206, label: "" }),
    hl("R2", { type: "analyst", direction: "cut", minCount: 2, withinDays: 7, label: "" }),
    hl("R3", { type: "analyst", direction: "downgrade", minCount: 1, withinDays: 7, label: "" }, 3),
    hl("G1", { type: "earnings", metric: "revenue_surprise", op: "above", pct: 0.02, label: "" }),
    hl("G2", { type: "news", keywords: ["beat"], description: "beat", label: "" }),
    hl("G3", { type: "price", op: "close_above", pct: 0.1, level: 250, label: "" }),
  ];
  const fires = evaluate(hs, rec, [
    { headlineId: "G2", newsId: "n1", confidence: 0.9 },
    { headlineId: "R2", newsId: "n1", confidence: 0.95 }, // wrong type: ignored
  ]);
  const byId = Object.fromEntries(fires.map((f) => [f.headlineId, f]));

  it("fires price tripwires on session closes", () => {
    expect(byId.R1!.at).toBe(at("2026-08-11T20:00:00Z"));
    expect(byId.R1!.detail).toContain("$205.00");
  });

  it("counts analyst notes over a rolling window", () => {
    expect(byId.R2!.at).toBe(at("2026-08-14T12:00:00Z"));
    expect(byId.R2!.detail).toContain("2 analyst cuts");
  });

  it("respects the headline window", () => {
    expect(byId.R3).toBeUndefined(); // downgrade on day 4, window 3 days
  });

  it("checks earnings surprise and news matches", () => {
    expect(byId.G1!.detail).toContain("+4.3%");
    expect(byId.G2!.newsId).toBe("n1");
    expect(byId.G3).toBeUndefined();
  });

  it("reports states over time", () => {
    const g3 = hs[5]!;
    expect(stateAt(g3, rec, fires, at("2026-08-09T00:00:00Z"))).toBe("WAITING");
    expect(stateAt(g3, rec, fires, at("2026-08-20T00:00:00Z"))).toBe("ARMED");
    expect(stateAt(g3, rec, fires, at("2026-09-01T00:00:00Z"))).toBe("EXPIRED");
    expect(stateAt(hs[0]!, rec, fires, at("2026-08-12T00:00:00Z"))).toBe("FIRED");
  });
});
