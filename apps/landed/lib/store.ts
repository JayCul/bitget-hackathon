"use client";
// Per-viewer memory of the setup and the last plan. localStorage only, fully guarded.
import { useSyncExternalStore } from "react";
import type { Bill } from "./money";
import type { ExecutionReport, PlanResponse } from "./types";

export type Setup = {
  salaryNgn: number;
  ngnPerUsd: number | null;
  bills: Bill[];
  basket: string[];
  tranchesPerAsset: number;
  windowHours: 24 | 168;
};

export type State = { setup: Setup; plan: PlanResponse | null; report: ExecutionReport | null };

export const DEFAULT_SETUP: Setup = {
  salaryNgn: 0,
  ngnPerUsd: null,
  bills: [
    { id: "rent", label: "Rent", ngn: 0 },
    { id: "transport", label: "Transport", ngn: 0 },
    { id: "food", label: "Food", ngn: 0 },
    { id: "family", label: "Family", ngn: 0 },
    { id: "buffer", label: "Buffer", ngn: 0 },
  ],
  basket: ["NVDA", "AAPL", "SPY"],
  tranchesPerAsset: 2,
  windowHours: 24,
};

const KEY = "landed.v1";
const empty: State = { setup: DEFAULT_SETUP, plan: null, report: null };
let state: State = empty;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...empty, ...(JSON.parse(raw) as State) };
  } catch {
    // unavailable: stay in memory
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
  setPlan(plan: PlanResponse | null) {
    load();
    save({ ...state, plan, report: null });
  },
  setReport(report: ExecutionReport | null) {
    load();
    save({ ...state, report });
  },
};
