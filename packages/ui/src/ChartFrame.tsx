"use client";
import { useInView } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { DataTag, type DataKind } from "./DataTag";

/**
 * Titled container for a chart. Children render only once in view so Recharts
 * draws on scroll. Always carries a data tag and a caption.
 */
export function ChartFrame({
  title,
  kind,
  source,
  caption,
  height = 180,
  children,
  className = "",
}: {
  title: string;
  kind: DataKind;
  source?: string;
  caption?: string;
  height?: number;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  return (
    <figure ref={ref} className={`flex flex-col gap-3 ${className}`}>
      <figcaption className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-muted">{title}</span>
        <DataTag kind={kind} source={source} />
      </figcaption>
      <div style={{ height }} className={inView ? "fade-in" : "opacity-0"}>
        {inView ? children : null}
      </div>
      {caption ? <p className="text-xs text-muted">{caption}</p> : null}
    </figure>
  );
}
