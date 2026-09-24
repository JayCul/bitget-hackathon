import type { ReactNode } from "react";

export type TimelineItem = {
  id: string;
  time: string;
  title: ReactNode;
  detail?: ReactNode;
  aside?: ReactNode;
  highlight?: boolean;
};

/**
 * Vertical (Landed plan, Prequel event log) or horizontal (Prequel tripwires) sequence.
 * Highlighted items get the amber dot; the rest stay muted.
 */
export function Timeline({
  items,
  orientation = "vertical",
  label,
  className = "",
}: {
  items: TimelineItem[];
  orientation?: "vertical" | "horizontal";
  label: string;
  className?: string;
}) {
  const horizontal = orientation === "horizontal";
  return (
    <ol
      aria-label={label}
      className={`relative ${horizontal ? "flex gap-6 overflow-x-auto pb-2" : "flex flex-col"} ${className}`}
    >
      {items.map((item, i) => (
        <li
          key={item.id}
          style={{ ["--d" as string]: `${Math.min(i, 10) * 50}ms` }}
          className={`rise group ${
            horizontal
              ? "relative min-w-[200px] shrink-0 border-t border-line pt-4"
              : "relative grid grid-cols-[72px_16px_1fr] gap-x-3 pb-6 last:pb-0"
          }`}
        >
          {horizontal ? (
            <>
              <span
                aria-hidden
                className={`absolute -top-[5px] left-0 size-[9px] rounded-full ${item.highlight ? "bg-accent" : "border border-line-strong bg-bg"}`}
              />
              <div className="font-mono text-xs text-muted">{item.time}</div>
              <div className="mt-1">{item.title}</div>
              {item.detail ? <div className="mt-1 text-[13px] text-muted">{item.detail}</div> : null}
              {item.aside ? <div className="mt-3">{item.aside}</div> : null}
            </>
          ) : (
            <>
              <div className="pt-0.5 text-right font-mono text-xs text-muted">{item.time}</div>
              <div className="relative flex justify-center">
                <span aria-hidden className="absolute top-3 bottom-[-12px] w-px bg-line group-last:hidden" />
                <span
                  aria-hidden
                  className={`relative mt-1.5 size-[9px] rounded-full ${item.highlight ? "bg-accent shadow-[0_0_12px_var(--color-accent)]" : "border border-line-strong bg-bg"}`}
                />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div>{item.title}</div>
                  {item.detail ? <div className="mt-0.5 text-[13px] text-muted">{item.detail}</div> : null}
                </div>
                {item.aside}
              </div>
            </>
          )}
        </li>
      ))}
    </ol>
  );
}
