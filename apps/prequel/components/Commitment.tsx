"use client";
import { Button } from "@desk/ui";
import { useEffect, useState } from "react";
import { COMMITMENT_LABEL, type Commitment, type Side } from "@/lib/prequel/types";

const ORDER: Commitment["action"][] = ["trim50", "exit", "hold", "add"];

export function CommitmentControl({
  side,
  value,
  onLock,
  onUnlock,
  readOnly,
}: {
  side: Side;
  value?: Commitment;
  onLock: (c: Commitment) => void;
  onUnlock: () => void;
  readOnly?: boolean;
}) {
  const [draft, setDraft] = useState<Commitment["action"] | null>(value?.action ?? null);
  const [note, setNote] = useState(value?.note ?? "");
  useEffect(() => {
    setDraft(value?.action ?? null);
    setNote(value?.note ?? "");
  }, [value]);

  if (value) {
    return (
        <div
          className="rise flex flex-col gap-3 rounded-md border border-accent/30 bg-accent-dim/40 p-4"
        >
          <div className="flex items-center gap-2 text-accent">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <rect x="2.5" y="6" width="9" height="6.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" />
              <path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" fill="none" stroke="currentColor" strokeWidth="1.3" />
            </svg>
            <span className="text-sm font-medium">Commitment locked. Saved before the event.</span>
          </div>
          <div className="text-2xl font-medium tracking-tight">{COMMITMENT_LABEL[value.action]}</div>
          {value.note ? <p className="text-sm text-muted">&ldquo;{value.note}&rdquo;</p> : null}
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-muted">Locked {new Date(value.lockedAt).toLocaleString("en-GB")}</span>
            {readOnly ? null : (
              <button type="button" onClick={onUnlock} className="text-xs text-muted underline underline-offset-4 hover:text-fg">
                Edit
              </button>
            )}
          </div>
        </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="What you'll do if this fires" className="grid grid-cols-4 gap-1 rounded-md border border-line bg-bg p-1">
        {ORDER.map((a) => {
          const on = draft === a;
          return (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={readOnly}
              onClick={() => setDraft(a)}
              className={`h-10 rounded-[5px] text-sm transition-colors ${on ? "bg-raised-2 text-fg shadow-[inset_0_0_0_1px_var(--color-accent)]" : "text-muted hover:text-fg"}`}
            >
              {COMMITMENT_LABEL[a]}
            </button>
          );
        })}
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={140}
        disabled={readOnly}
        aria-label="Optional note"
        placeholder={side === "RED" ? "Optional: why, e.g. thesis broken if data center misses" : "Optional: e.g. add only below my entry"}
        className="h-11 rounded-md border border-line bg-bg px-3 text-sm outline-none placeholder:text-muted/60 focus:border-accent/60"
      />
      <Button
        disabled={!draft || readOnly}
        onClick={() => draft && onLock({ action: draft, note: note.trim() || undefined, lockedAt: new Date().toISOString() })}
      >
        Lock commitment
      </Button>
    </div>
  );
}
