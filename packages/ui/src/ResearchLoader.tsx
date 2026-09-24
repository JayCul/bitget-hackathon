"use client";
import { AnimatePresence, motion } from "framer-motion";

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
      <p className="text-[13px] text-muted">{title}</p>
      <ol className="flex flex-col gap-3">
        {steps.map((s) => (
          <li key={s.id} className="grid grid-cols-[20px_1fr] items-start gap-3">
            <span aria-hidden className="mt-1 grid size-4 place-items-center">
              <AnimatePresence mode="wait" initial={false}>
                {s.state === "done" ? (
                  <motion.svg key="d" width="14" height="14" viewBox="0 0 14 14" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                    <path d="M2 7.5l3 3 7-7" fill="none" stroke="var(--color-accent)" strokeWidth="1.6" />
                  </motion.svg>
                ) : s.state === "running" ? (
                  <motion.span key="r" className="size-2 rounded-full bg-accent" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.1, repeat: Infinity }} />
                ) : s.state === "failed" ? (
                  <span key="f" className="font-mono text-xs text-red">×</span>
                ) : (
                  <span key="p" className="size-2 rounded-full border border-line-strong" />
                )}
              </AnimatePresence>
            </span>
            <div className={s.state === "pending" ? "text-muted" : "text-fg"}>
              <div className="text-[15px]">{s.label}</div>
              <div className="font-mono text-[11px] text-muted">
                {s.call}
                {s.note ? ` · ${s.note}` : ""}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
