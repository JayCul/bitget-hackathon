"use client";
import { animate, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { DataTag, type DataKind } from "./DataTag";

type Props = {
  label: string;
  value: number | null;
  format?: (n: number) => string;
  kind: DataKind;
  source?: string;
  emphasis?: boolean;
  unavailable?: string;
  className?: string;
};

/** Value + label + exactly one data tag. Counts up once when scrolled into view. */
export function Metric({ label, value, format = String, kind, source, emphasis, unavailable, className = "" }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState<number | null>(reduce ? value : value === null ? null : 0);

  useEffect(() => {
    if (value === null) return setShown(null);
    if (reduce || !inView) {
      if (reduce) setShown(value);
      return;
    }
    const c = animate(0, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1], onUpdate: setShown });
    return () => c.stop();
  }, [value, inView, reduce]);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[13px] text-muted">{label}</span>
      <span
        ref={ref}
        className={`font-mono tabular-nums tracking-tight ${emphasis ? "text-3xl text-accent" : "text-2xl text-fg"}`}
      >
        {value === null ? <span className="text-base text-muted">{unavailable ?? "Unavailable"}</span> : format(shown ?? 0)}
      </span>
      <DataTag kind={kind} source={source} className="self-start" />
    </div>
  );
}
