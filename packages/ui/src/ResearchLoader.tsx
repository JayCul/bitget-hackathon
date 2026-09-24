export type ResearchStep = {
  id: string;
  label: string;
  /** the real call this step is tied to, shown in mono */
  call: string;
  state: "pending" | "running" | "done" | "failed";
  note?: string;
};

/** Pipeline progress driven by real call states. Never animates ahead of actual work. */
export function ResearchLoader({ steps, title = "Researching" }: { steps: ResearchStep[]; title?: string }) {
  return (
    <div aria-live="polite" className="flex w-full max-w-xl flex-col gap-5">
      <p className="font-mono text-[13px] text-muted">{title}</p>
      <ol className="flex flex-col gap-4">
        {steps.map((s) => (
          <li key={s.id} className="grid grid-cols-[20px_1fr] items-start gap-3">
            <span aria-hidden className="mt-1 grid size-4 place-items-center">
              {s.state === "done" ? (
                <svg key="d" className="pop" width="14" height="14" viewBox="0 0 14 14">
                  <path d="M2 7.5l3 3 7-7" fill="none" stroke="var(--color-accent)" strokeWidth="1.6" />
                </svg>
              ) : s.state === "running" ? (
                <span key="r" className="pulse-dot size-2 rounded-full bg-accent" />
              ) : s.state === "failed" ? (
                <span key="f" className="font-mono text-xs text-red">×</span>
              ) : (
                <span key="p" className="size-2 rounded-full border border-line-strong" />
              )}
            </span>
            <div className={s.state === "pending" ? "text-muted" : "text-fg"}>
              <div className="text-[15px]">
                {s.label}
                <span className="sr-only"> ({s.state})</span>
              </div>
              <div className="font-mono text-[11px] text-muted">
                {s.call}
                {s.note ? <span className={s.state === "failed" ? "text-red" : "text-fg/80"}> · {s.note}</span> : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
