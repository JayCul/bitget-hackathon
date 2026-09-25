"use client";
// Hero backdrop: a monochrome particle ribbon that swells where liquidity is deep and pinches where it is
// thin, with a few amber execution points riding it. Decorative only: no numbers are drawn from it.
// Draws a static frame under reduced motion and pauses when off-screen.
import { useEffect, useRef } from "react";

const N = 5200;

type P = { u: number; v: number; s: number; a: number };

export function LiquidityWave() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Deterministic pseudo-random so the ribbon looks the same on every load.
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const pts: P[] = Array.from({ length: N }, () => ({ u: rnd(), v: (rnd() + rnd() + rnd()) / 3 - 0.5, s: 0.4 + rnd() * 1.1, a: rnd() }));
    const execs = [0.34, 0.47, 0.71, 0.83];

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    // Ribbon centre line and thickness along u in [0, 1], at time t.
    const centre = (u: number, t: number) =>
      h * (0.44 + 0.13 * Math.sin(u * 5.2 + t * 0.18) + 0.06 * Math.sin(u * 11.3 - t * 0.11));
    const thick = (u: number, t: number) => {
      // Deep sessions swell, thin hours pinch: a smooth day/night rhythm across the width.
      const rhythm = 0.5 + 0.5 * Math.sin(u * Math.PI * 4.2 - 1.2 + t * 0.05);
      return h * (0.035 + 0.2 * Math.pow(rhythm, 1.6));
    };

    let raf = 0;
    let visible = true;
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = reduce ? 0 : (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        const u = (p.u + t * 0.004 * (0.6 + p.a)) % 1;
        const x = u * w * 1.1 - w * 0.05;
        const y = centre(u, t) + p.v * thick(u, t) * 2.2 + Math.sin(t * 0.6 + p.a * 20) * 1.2;
        const edge = 1 - Math.min(1, Math.abs(p.v) * 2.4);
        const fade = Math.min(1, u * 6, (1 - u) * 6);
        ctx.fillStyle = `rgba(245,245,245,${(0.1 + 0.55 * edge) * fade * (0.35 + 0.65 * p.a)})`;
        ctx.fillRect(x, y, p.s, p.s);
      }
      for (const e of execs) {
        const u = e;
        const x = u * w * 1.1 - w * 0.05;
        const y = centre(u, t);
        const g = ctx.createRadialGradient(x, y, 0, x, y, 26);
        g.addColorStop(0, "rgba(255,184,92,0.55)");
        g.addColorStop(1, "rgba(232,163,74,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#FFB85C";
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduce && visible) raf = requestAnimationFrame(frame);
    };
    frame(performance.now());

    const io = new IntersectionObserver(([e]) => {
      visible = Boolean(e?.isIntersecting);
      cancelAnimationFrame(raf);
      if (visible && !reduce) raf = requestAnimationFrame(frame);
    });
    io.observe(canvas);
    const onResize = () => {
      resize();
      frame(performance.now());
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full" />;
}
