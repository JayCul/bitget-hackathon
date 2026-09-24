"use client";
// Per-viewer persistence for theses, commitments and replay decisions. localStorage only:
// reads and writes are guarded, and the app works (without memory) when storage is unavailable.
import { useSyncExternalStore } from "react";
import type { Board, Commitment } from "./prequel/types";

export type Decision = { headlineId: string; choice: "followed" | "changed"; at: string; note?: string };

type State = {
  boards: Board[];
  activeId: string | null;
  decisions: Record<string, Decision[]>; // by board id
};

const KEY = "prequel.v1";
const empty: State = { boards: [], activeId: null, decisions: {} };
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
    // storage blocked or corrupt: start empty
  }
}

function save(next: State) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // quota or blocked: keep in memory
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  load();
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore(): State {
  return useSyncExternalStore(
    subscribe,
    () => {
      load();
      return state;
    },
    () => empty,
  );
}

/** Direct read, for mount-time decisions (the hydration render sees the empty server snapshot). */
export function peekActiveId(): string | null {
  load();
  return state.boards.some((b) => b.id === state.activeId) ? state.activeId : null;
}

export function useActiveBoard(): Board | null {
  const s = useStore();
  return s.boards.find((b) => b.id === s.activeId) ?? null;
}

export const actions = {
  addBoard(board: Board) {
    load();
    save({ ...state, boards: [board, ...state.boards.filter((b) => b.id !== board.id)].slice(0, 12), activeId: board.id });
  },
  setActive(id: string) {
    load();
    save({ ...state, activeId: id });
  },
  removeBoard(id: string) {
    load();
    const boards = state.boards.filter((b) => b.id !== id);
    save({ ...state, boards, activeId: state.activeId === id ? (boards[0]?.id ?? null) : state.activeId });
  },
  setCommitment(boardId: string, headlineId: string, commitment: Commitment | undefined) {
    load();
    save({
      ...state,
      boards: state.boards.map((b) =>
        b.id !== boardId
          ? b
          : { ...b, headlines: b.headlines.map((h) => (h.id === headlineId ? { ...h, commitment } : h)) },
      ),
    });
  },
  recordDecision(boardId: string, d: Decision) {
    load();
    const list = (state.decisions[boardId] ?? []).filter((x) => x.headlineId !== d.headlineId);
    save({ ...state, decisions: { ...state.decisions, [boardId]: [...list, d] } });
  },
  clearDecisions(boardId: string) {
    load();
    const { [boardId]: _, ...rest } = state.decisions;
    save({ ...state, decisions: rest });
  },
};
