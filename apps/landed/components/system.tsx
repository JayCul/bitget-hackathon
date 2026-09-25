"use client";
// Small system primitives shared by every Landed screen.
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Instrument-style label: tiny mono caps. */
export function SystemLabel({ children, className = "", accent }: { children: ReactNode; className?: string; accent?: boolean }) {
  return (
    <span className={`font-mono text-[10.5px] tracking-[0.18em] uppercase ${accent ? "text-accent" : "text-muted"} ${className}`}>{children}</span>
  );
}

/** Fixed, nearly invisible backdrop: measurement grid, coordinate ticks and one slow warm glow. */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="backdrop-grid absolute inset-0" />
      <div className="backdrop-glow absolute -top-[30%] right-[-20%] size-[1100px] rounded-full" />
      <div className="absolute inset-y-0 left-[8%] w-px bg-white/[0.035]" />
      <div className="absolute inset-y-0 right-[8%] w-px bg-white/[0.035]" />
      <div className="absolute top-[18%] right-[8%] left-[8%] h-px bg-white/[0.03]" />
    </div>
  );
}

/** Marks <html> so .reveal elements animate in; without JS they simply show. */
export function RevealRoot() {
  useEffect(() => {
    document.documentElement.classList.add("js");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    const scan = () => document.querySelectorAll(".reveal:not(.in)").forEach((el) => io.observe(el));
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}

/**
 * Counts from `from` to `to`. Timer-driven (not animation-frame) so it always lands on the final
 * value, and instant under reduced motion.
 */
export function useCountUp(to: number, { from = 0, ms = 900 }: { from?: number; ms?: number } = {}) {
  const [v, setV] = useState(to);
  const prev = useRef(from);
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const start = prev.current;
    prev.current = to;
    if (reduce || start === to) return setV(to);
    const t0 = performance.now();
    const id = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setV(start + (to - start) * e);
      if (k >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [to, ms]);
  return v;
}
