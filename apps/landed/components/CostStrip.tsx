"use client";
// Signature visual: a time axis across the execution window. Band height = sampled cost of the market
// state at that hour (taller = more expensive). Amber points = planned orders; the hollow point = the alert.
import type { Plan } from "@/lib/plan";
import { regimeAt, REGIME_LABEL, type Regime } from "@/lib/regime";
import { watTime, watDay } from "@/lib/format";
import type { MicroRow } from "@/lib/types";

const HOUR = 3_600_000;

export function CostStrip({ plan, micro, height = 150 }: { plan: Plan; micro: MicroRow[]; height?: number }) {
  const start = plan.input.start;
  const end = start + plan.input.windowHours * HOUR;
  const W = 640;
  const H = height;
  const pad = { l: 8, r: 8, t: 18, b: 30 };
  const x = (t: number) => pad.l + ((t - start) / (end - start)) * (W - pad.l - pad.r);

  // Average sampled cost per regime across the basket, at tranche size.
  const cost: Partial<Record<Regime, number>> = {};
  for (const r of ["session", "extended", "overnight", "weekend"] as Regime[]) {
    const vals = micro.map((m) => m.sampled[r]?.costBps).filter((v): v is number => typeof v === "number");
    if (vals.length) cost[r] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  const max = Math.max(1, ...Object.values(cost));
  const bandH = (r: Regime) => (cost[r] === undefined ? 0 : 8 + ((H - pad.t - pad.b - 8) * cost[r]!) / max);

  // Contiguous segments of the same regime, hour by hour.
  const segs: { from: number; to: number; r: Regime }[] = [];
  for (let t = Math.floor(start / HOUR) * HOUR; t < end; t += HOUR) {
    const r = regimeAt(t + HOUR / 2);
    const a = Math.max(t, start);
    const b = Math.min(t + HOUR, end);
    const last = segs.at(-1);
    if (last && last.r === r && last.to === a) last.to = b;
    else segs.push({ from: a, to: b, r });
  }
  const baseY = H - pad.b;
  const bestBps = Math.min(...plan.rows.map((r) => r.bps));
  const ticks = plan.input.windowHours <= 24 ? 6 : 7;

  return (
    <figure className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Measured cost by hour across the window, with planned orders">
        {segs.map((s, i) => {
          const h = bandH(s.r);
          return (
            <g key={i}>
              <rect
                x={x(s.from)}
                y={baseY - (h || 4)}
                width={Math.max(1, x(s.to) - x(s.from) - 1)}
                height={h || 4}
                fill={h ? "var(--color-accent)" : "none"}
                fillOpacity={h ? 0.06 + (0.1 * (cost[s.r] ?? 0)) / max : 0}
                stroke={h ? "none" : "var(--color-line-strong)"}
                strokeDasharray={h ? undefined : "2 3"}
              />
              {x(s.to) - x(s.from) > 70 ? (
                <text x={x(s.from) + 4} y={baseY - (h || 4) - 5} fontSize="9" fontFamily="var(--font-mono)" fill="var(--color-muted)">
                  {REGIME_LABEL[s.r]}
                  {cost[s.r] !== undefined ? ` · ${cost[s.r]!.toFixed(1)}` : " · not measured"}
                </text>
              ) : null}
            </g>
          );
        })}
        <line x1={pad.l} x2={W - pad.r} y1={baseY} y2={baseY} stroke="var(--color-line-strong)" />
        {Array.from({ length: ticks + 1 }, (_, i) => start + ((end - start) * i) / ticks).map((t, i) => (
          <text key={i} x={x(t)} y={H - 10} fontSize="9.5" textAnchor={i === 0 ? "start" : i === ticks ? "end" : "middle"} fontFamily="var(--font-mono)" fill="var(--color-muted)">
            {plan.input.windowHours <= 24 ? watTime(t) : watDay(t)}
          </text>
        ))}
        {/* the alert: buy-everything-now baseline */}
        <circle cx={x(start)} cy={baseY} r="5" fill="var(--color-bg)" stroke="var(--color-muted)" strokeWidth="1.5" />
        {/* the split: one line from the alert to each order */}
        {plan.rows.map((r, i) => (
          <path
            key={`p${i}`}
            d={`M${x(start)} ${baseY} C ${x(start) + 30} ${baseY - 40}, ${x(r.t) - 30} ${baseY - 40}, ${x(r.t)} ${baseY}`}
            fill="none"
            stroke="var(--color-accent)"
            strokeOpacity="0.35"
            strokeWidth="1"
          />
        ))}
        {plan.rows.map((r, i) => (
          <circle
            key={`o${i}`}
            cx={x(r.t)}
            cy={baseY}
            r={r.bps <= bestBps + 0.05 ? 5 : 4}
            fill={r.bps <= bestBps + 0.05 ? "var(--color-accent)" : "var(--color-muted)"}
            stroke="var(--color-bg)"
            strokeWidth="1.5"
          />
        ))}
      </svg>
      <figcaption className="text-xs text-muted">
        Band height: median measured cost per market state at your order size (bps, taller costs more). Hollow point: the alert. Amber: cheapest
        orders.
      </figcaption>
    </figure>
  );
}
