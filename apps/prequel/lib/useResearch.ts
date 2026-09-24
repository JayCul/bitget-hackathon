"use client";
import type { ResearchStep } from "@desk/ui";
import { useCallback, useRef, useState } from "react";
import { STEPS } from "./prequel/steps";
import type { Board, ResearchEvent, Thesis } from "./prequel/types";

const initial = (): ResearchStep[] => STEPS.map((s) => ({ ...s, state: "pending" as const }));

export function useResearch(onBoard: (b: Board) => void) {
  const [steps, setSteps] = useState<ResearchStep[]>(initial);
  const [status, setStatus] = useState<"idle" | "running" | "error">("idle");
  const [error, setError] = useState<{ stage: string; message: string } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const abort = useRef<AbortController | null>(null);

  const run = useCallback(
    async (thesis: Thesis) => {
      abort.current?.abort();
      const ctl = new AbortController();
      abort.current = ctl;
      setSteps(initial());
      setError(null);
      setStatus("running");
      const started = performance.now();
      const tick = setInterval(() => setElapsed((performance.now() - started) / 1000), 100);
      try {
        const res = await fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(thesis),
          signal: ctl.signal,
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({ error: res.statusText }));
          throw Object.assign(new Error(body.error ?? "Request failed"), { stage: "request" });
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            const ev = JSON.parse(line) as ResearchEvent;
            if (ev.kind === "step") {
              setSteps((s) => s.map((x) => (x.id === ev.id ? { ...x, state: ev.state, note: ev.note } : x)));
            } else if (ev.kind === "error") {
              setError({ stage: ev.stage, message: ev.message });
              setStatus("error");
            } else if (ev.kind === "board") {
              setStatus("idle");
              onBoard(ev.board);
            }
          }
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError({ stage: (e as { stage?: string }).stage ?? "network", message: (e as Error).message });
        setStatus("error");
      } finally {
        clearInterval(tick);
        setElapsed((performance.now() - started) / 1000);
      }
    },
    [onBoard],
  );

  const reset = useCallback(() => {
    abort.current?.abort();
    setStatus("idle");
    setError(null);
    setSteps(initial());
  }, []);

  return { steps, status, error, elapsed, run, reset };
}
