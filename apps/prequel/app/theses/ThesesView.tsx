"use client";
import { Button, DisplayHeading, ResearchLoader } from "@desk/ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DataTag } from "@desk/ui";
import { Board, HeadlineRow } from "@/components/Board";
import { DEMO_BOARD } from "@/lib/demo";
import { STEPS } from "@/lib/prequel/steps";
import { SectionLabel } from "@/components/Shell";
import { ThesisForm } from "@/components/ThesisForm";
import type { Board as BoardT } from "@/lib/prequel/types";
import { actions, peekActiveId, useActiveBoard, useStore } from "@/lib/store";
import { useResearch } from "@/lib/useResearch";

type View = "form" | "research" | "board";

export function ThesesView() {
  const store = useStore();
  const active = useActiveBoard();
  const [view, setView] = useState<View>("form");
  // Show the active board on arrival if there is one.
  useEffect(() => {
    if (peekActiveId()) setView("board");
  }, []);

  const onBoard = useCallback((b: BoardT) => {
    actions.addBoard(b);
    setView("board");
    window.scrollTo({ top: 0 });
  }, []);
  const r = useResearch(onBoard);

  return (
    <>
      {view === "form" ? (
        <div key="form" className="fade-in flex flex-col gap-12">
          <div className="flex flex-col gap-5">
            <SectionLabel>New thesis</SectionLabel>
            <DisplayHeading lines={["What's the trade?"]} size="title" />
            <p className="max-w-xl text-muted">
              Prequel writes what would break it and what would confirm it, checks each against real past events, and records what you
              will do before any of it happens.
            </p>
          </div>
          <div className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
            <div className="flex min-w-0 flex-col gap-12">
              <ThesisForm
                busy={r.status === "running"}
                onSubmit={(t) => {
                  setView("research");
                  void r.run(t);
                }}
              />
              {store.boards.length ? <SavedTheses onOpen={() => setView("board")} /> : null}
            </div>
            <FormAside />
          </div>
        </div>
      ) : view === "research" ? (
        <div
          key="research"
          className="fade-in flex min-h-[60vh] flex-col items-start justify-center gap-10"
        >
          <DisplayHeading lines={["Stress-testing", "the thesis."]} size="title" />
          <ResearchLoader steps={r.steps} title={`Pipeline · ${r.elapsed.toFixed(1)}s`} />
          {r.status === "error" && r.error ? (
            <div role="alert" className="flex max-w-xl flex-col gap-4 rounded-md border border-red/40 p-5">
              <p className="text-sm">
                <span className="font-mono text-xs text-red uppercase">{r.error.stage} failed</span>
                <br />
                {r.error.message}
              </p>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setView("form")}>
                  Back to the form
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : active ? (
        <div key={`board-${active.id}`} className="fade-in flex flex-col gap-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionLabel>Board</SectionLabel>
            <div className="flex flex-wrap gap-3">
              <Button variant="ghost" onClick={() => setView("form")}>
                New thesis
              </Button>
              {active.thesis.mode === "replay" ? (
                <Link
                  href="/replay"
                  className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 text-[15px] font-medium text-black transition-shadow hover:shadow-[0_0_0_1px_var(--color-accent),0_0_24px_-4px_var(--color-accent)]"
                >
                  Run the replay →
                </Link>
              ) : null}
            </div>
          </div>
          <Board board={active} />
          <CommitmentNudge />
        </div>
      ) : (
        <div key="empty">
          <Button onClick={() => setView("form")}>Start a thesis</Button>
        </div>
      )}
    </>
  );
}

function FormAside() {
  const sample = DEMO_BOARD.headlines.find((h) => h.side === "RED" && (h.analogs?.stats.n ?? 0) > 0) ?? DEMO_BOARD.headlines[0]!;
  return (
    <aside aria-label="What happens next" className="flex flex-col gap-10 lg:sticky lg:top-24 lg:self-start">
      <div className="flex flex-col gap-4">
        <SectionLabel>What happens next</SectionLabel>
        <ol className="flex flex-col">
          {STEPS.map((s, i) => (
            <li key={s.id} className="grid grid-cols-[28px_1fr] gap-2 border-t border-line py-3 first:border-t-0">
              <span className="font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <div className="text-sm">{s.label}</div>
                <div className="font-mono text-[11px] text-muted">{s.call}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <SectionLabel>You get ten of these</SectionLabel>
          <DataTag kind="DEMO REPLAY" />
        </div>
        <div className="rounded-md border border-line bg-raised/60 px-4 pb-1">
          <HeadlineRow h={sample} index={0} />
        </div>
        <p className="text-[13px] leading-relaxed text-muted">
          Each scenario gets a checkable tripwire, real past events that resemble it, and a place to lock what you will do.
        </p>
      </div>
    </aside>
  );
}

function CommitmentNudge() {
  const b = useActiveBoard();
  if (!b) return null;
  const locked = b.headlines.filter((h) => h.commitment).length;
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
      <p className="text-sm text-muted">
        <span className="font-mono text-fg">{locked}/10</span> commitments locked.{" "}
        {locked < 10 ? "Open a row to decide what you'll do if it happens." : "Every scenario has a plan."}
      </p>
    </div>
  );
}

function SavedTheses({ onOpen }: { onOpen: () => void }) {
  const { boards, activeId } = useStore();
  return (
    <section aria-label="Saved theses" className="flex max-w-3xl flex-col gap-3 border-t border-line pt-8">
      <SectionLabel>Saved on this device</SectionLabel>
      <ul className="flex flex-col">
        {boards.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-4 border-t border-line py-3 first:border-t-0">
            <button
              type="button"
              onClick={() => {
                actions.setActive(b.id);
                onOpen();
              }}
              className="flex min-w-0 items-center gap-3 text-left hover:text-fg"
            >
              <span className="font-mono">{b.thesis.ticker}</span>
              <span className="truncate text-sm text-muted">
                {b.thesis.direction} · {b.thesis.mode === "replay" ? `replay ${b.thesis.asOf}` : `live ${b.thesis.asOf}`} ·{" "}
                {b.headlines.filter((h) => h.commitment).length}/10 committed
              </span>
              {b.id === activeId ? <span className="font-mono text-[10px] text-accent">ACTIVE</span> : null}
            </button>
            <button
              type="button"
              aria-label={`Delete ${b.thesis.ticker} thesis`}
              onClick={() => actions.removeBoard(b.id)}
              className="text-xs text-muted hover:text-fg"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
