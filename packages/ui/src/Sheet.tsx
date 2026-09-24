"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Bottom sheet under 768px, right side panel above. Esc and backdrop close it; focus moves in and returns. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  width = 520,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  width?: number;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  // Portal to <body> so ancestor stacking contexts (animations, transforms) cannot trap the panel under the header.
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div aria-hidden className="fade-in absolute inset-0 bg-black/60" onClick={() => close.current()} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ ["--sheet-w" as string]: `${width}px` }}
        className="sheet-panel absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-md border-t border-line bg-raised outline-none md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[var(--sheet-w)] md:max-w-full md:rounded-none md:border-t-0 md:border-l"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-raised/95 px-6 py-4 backdrop-blur-sm">
          <h2 id={titleId} className="text-base font-medium">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => close.current()}
            aria-label="Close panel"
            className="grid size-8 place-items-center rounded-md text-muted hover:text-fg"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
