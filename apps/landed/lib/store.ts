"use client";
// Per-viewer memory of the payday setup and the last confirmed plan. localStorage only, fully guarded.
import { useSyncExternalStore } from "react";
import type { ExecutionReport } from "./types";

export type Setup = {
  salaryNgn: number;
  billsNgn: number;
  bufferNgn: number;
  ngnPerUsd: number | null;
  basket: string[];
  tranchesPerAsset: number;
  windowHours: 24 | 168;
  /** when the plan starts: now, or the next weekday morning at 09:00 WAT (when salary alerts land) */
  payday: "now" | "morning";
};

export type LastPlan = { input: { windowHours: number; tranchesPerAsset: number; assets: { ticker: string; usd: number }[]; start: number } };

export type State = { setup: Setup; last: LastPlan | null; report: ExecutionReport | null };

export const DEFAULT_SETUP: Setup = {
  salaryNgn: 0,
  billsNgn: 0,
  bufferNgn: 0,
  ngnPerUsd: null,
  basket: ["NVDA", "AAPL", "SPY"],
  tranchesPerAsset: 2,
  windowHours: 168,
  payday: "morning",
};

const KEY = "landed.v2";
const empty: State = { setup: DEFAULT_SETUP, last: null, report: null };
let state: State = empty;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as State;
      state = { ...empty, ...s, setup: { ...DEFAULT_SETUP, ...s.setup } };
    }
  } catch {
    // storage unavailable: stay in memory
  }
}

function save(next: State) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

export function useLanded(): State {
  return useSyncExternalStore(
    (l) => {
      load();
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => {
      load();
      return state;
    },
    () => empty,
  );
}

export function peek(): State {
  load();
  return state;
}

export const landed = {
  setSetup(patch: Partial<Setup>) {
    load();
    save({ ...state, setup: { ...state.setup, ...patch } });
  },
  setLast(last: LastPlan | null) {
    load();
    save({ ...state, last });
  },
  setReport(report: ExecutionReport | null) {
    load();
    save({ ...state, report });
  },
};
