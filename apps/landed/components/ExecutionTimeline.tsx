"use client";
import { DataTag } from "@desk/ui";
import { useMemo, useState } from "react";
import { bps, usd2, wat, watDay, watTime } from "@/lib/format";
import { assetTrace, signals, terrain, type TerrainPoint } from "@/lib/insight";
import type { Plan, PlanInput, PlanRow } from "@/lib/plan";
import { REGIME_LABEL, type Regime } from "@/lib/regime";
import type { MarketBundle } from "@/lib/types";
import { SystemLabel } from "./system";

export type Status = "PLANNED" | "READY";

export type Window = { id: string; index: number; t: number; rows: PlanRow[]; usd: number; bps: number; regime: Regime; best: boolean };

export function windowsOf(plan: Plan): Window[] {
  const by = new Map<number, PlanRow[]>();
  for (const r of plan.rows) by.set(r.t, [...(by.get(r.t) ?? []), r]);
  const list = [...by.entries()].sort((a, b) => a[0] - b[0]);
  const costs = list.map(([, rows]) => rows.reduce((s, r) => s + r.usd * r.bps, 0) / rows.reduce((s, r) => s + r.usd, 0));
  const min = Math.min(...costs);
  return list.map(([t, rows], i) => ({
    id: `w${i}`,
    index: i + 1,
    t,
    rows,
    usd: rows.reduce((s, r) => s + r.usd, 0),
    bps: costs[i]!,
    regime: rows[0]!.regime,
    best: costs[i]! <= min + 0.05,
  }));
}

const W = 1000;
const H = 330;
const PAD = { l: 44, r: 36 };
const AXIS = 222;

function Terrain({ pts, x, max }: { pts: TerrainPoint[]; x: (t: number) => number; max: number }) {
  const hour = 3_600_000;
  const y = (b: number) => AXIS - 14 - (b / max) * 118;
  const segs: { a: number; b: number; bps: number | null; regime: Regime }[] = pts.map((p, i) => ({
    a: x(p.t),
    b: x(pts[i + 1]?.t ?? p.t + hour),
    bps: p.bps,
    regime: p.regime,
  }));
  // Group regime runs for labels.
  const runs: { a: number; b: number; regime: Regime; measured: boolean }[] = [];
  for (const s of segs) {
    const last = runs.at(-1);
    if (last && last.regime === s.regime) last.b = s.b;
    else runs.push({ a: s.a, b: s.b, regime: s.regime, measured: s.bps !== null });
  }
  return (
    <g>
      {segs.map((s, i) =>
        s.bps === null ? (
          <line key={i} x1={s.a} x2={s.b} y1={AXIS - 14} y2={AXIS - 14} stroke="#F5F5F5" strokeOpacity="0.12" strokeDasharray="2 4" />
        ) : (
          <rect key={i} x={s.a} y={y(s.bps)} width={Math.max(0.5, s.b - s.a - 0.6)} height={AXIS - y(s.bps)} fill="#F5F5F5" fillOpacity={0.025 + (0.05 * s.bps) / max} />
        ),
      )}
      {segs.map((s, i) =>
        s.bps === null || i === 0 ? null : segs[i - 1]!.bps === null ? null : (
          <line key={`e${i}`} x1={s.a} x2={s.a} y1={y(segs[i - 1]!.bps!)} y2={y(s.bps)} stroke="#F5F5F5" strokeOpacity="0.18" />
        ),
      )}
      {segs.map((s, i) => (s.bps === null ? null : <line key={`t${i}`} x1={s.a} x2={s.b} y1={y(s.bps)} y2={y(s.bps)} stroke="#F5F5F5" strokeOpacity="0.28" />))}
      {runs.map((r, i) =>
        r.b - r.a > 88 ? (
          <text key={i} x={r.a + 6} y={36} fontSize="9" letterSpacing="1.4" fontFamily="var(--font-mono)" fill="#8A8A8A" fillOpacity={r.measured ? 0.9 : 0.5}>
            {REGIME_LABEL[r.regime].toUpperCase()}
            {r.measured ? "" : " · NOT MEASURED"}
          </text>
        ) : null,
      )}
    </g>
  );
}

/** Horizontal instrument (md and up). */
function Horizontal({
  plan,
  pts,
  wins,
  status,
  selected,
  onSelect,
}: {
  plan: Plan;
  pts: TerrainPoint[];
  wins: Window[];
  status: Status;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const start = plan.input.start;
  const end = start + plan.input.windowHours * 3_600_000;
  const x = (t: number) => PAD.l + ((t - start) / (end - start)) * (W - PAD.l - PAD.r);
  const max = Math.max(1, ...pts.map((p) => p.bps ?? 0), plan.baseline.bps ?? 0);
  const lastX = wins.length ? x(wins.at(-1)!.t) : x(start);
  const ticks = plan.input.windowHours <= 24 ? 8 : 7;
  const pathLen = Math.ceil(lastX - x(start)) + 4;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img" aria-label="Execution timeline across the window">
      <Terrain pts={pts} x={x} max={max} />
      {/* axis and time */}
      <line x1={PAD.l} x2={W - PAD.r} y1={AXIS} y2={AXIS} stroke="#F5F5F5" strokeOpacity="0.2" />
      {Array.from({ length: ticks + 1 }, (_, i) => start + ((end - start) * i) / ticks).map((t, i) => (
        <g key={i}>
          <line x1={x(t)} x2={x(t)} y1={AXIS} y2={AXIS + 5} stroke="#F5F5F5" strokeOpacity="0.25" />
          <text x={x(t)} y={H - 6} textAnchor={i === 0 ? "start" : i === ticks ? "end" : "middle"} fontSize="9.5" fontFamily="var(--font-mono)" fill="#8A8A8A">
            {plan.input.windowHours <= 24 ? watTime(t) : watDay(t)}
          </text>
        </g>
      ))}
      {/* execution path */}
      <line
        x1={x(start)}
        x2={lastX}
        y1={AXIS}
        y2={AXIS}
        stroke="#E8A34A"
        strokeWidth="1.6"
        className="draw"
        style={{ ["--len" as string]: pathLen, ["--d" as string]: "200ms" }}
      />
      {/* payday */}
      <circle cx={x(start)} cy={AXIS} r="22" fill="#E8A34A" fillOpacity="0.12" className="breathe" />
      <circle cx={x(start)} cy={AXIS} r="6" fill="#FFB85C" />
      <text x={x(start)} y={AXIS - 30} fontSize="9.5" letterSpacing="1.6" fontFamily="var(--font-mono)" fill="#F5F5F5">
        PAYDAY
      </text>
      <text x={x(start)} y={AXIS - 44} fontSize="9" fontFamily="var(--font-mono)" fill="#8A8A8A">
        {bps(plan.baseline.bps)} IF ALL NOW
      </text>
      {/* windows */}
      {wins.map((w, i) => {
        const cx = x(w.t);
        const level = i % 2;
        const ly = AXIS + 30 + level * 34;
        const sel = selected === w.id;
        const hot = w.best || sel;
        return (
          <g
            key={w.id}
            role="button"
            tabIndex={0}
            aria-label={`Window ${w.index}, ${watTime(w.t)} WAT, ${usd2(w.usd)}, ${w.bps.toFixed(1)} bps`}
            onClick={() => onSelect(w.id)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(w.id)}
            className="rise cursor-pointer outline-none"
            style={{ ["--d" as string]: `${900 + i * 140}ms` }}
          >
            <line x1={cx} x2={cx} y1={AXIS} y2={ly - 10} stroke={hot ? "#E8A34A" : "#F5F5F5"} strokeOpacity={hot ? 0.6 : 0.2} />
            {hot ? <circle cx={cx} cy={AXIS} r="13" fill="#E8A34A" fillOpacity={sel ? 0.22 : 0.12} /> : null}
            <circle cx={cx} cy={AXIS} r={hot ? 5 : 4} fill={status === "READY" ? "#70D6A3" : hot ? "#E8A34A" : "#050505"} stroke={hot ? "#FFB85C" : "#F5F5F5"} strokeOpacity={hot ? 1 : 0.5} />
            <text x={cx} y={ly} textAnchor="middle" fontSize="9" letterSpacing="1.3" fontFamily="var(--font-mono)" fill={hot ? "#E8A34A" : "#8A8A8A"}>
              {`W${String(w.index).padStart(2, "0")} · ${w.bps.toFixed(1)} BPS`}
            </text>
            <text x={cx} y={ly + 13} textAnchor="middle" fontSize="9.5" fontFamily="var(--font-mono)" fill={sel ? "#F5F5F5" : "#B5B5B5"}>
              {w.rows.map((r) => `r${r.ticker}`).join(" ")}
            </text>
            <rect x={cx - 34} y={AXIS - 16} width="68" height={ly - AXIS + 36} fill="transparent" />
          </g>
        );
      })}
    </svg>
  );
}

/** Vertical recomposition for phones: windows as events, skipped stretches summarized between them. */
function Vertical({
  plan,
  pts,
  wins,
  status,
  selected,
  onSelect,
}: {
  plan: Plan;
  pts: TerrainPoint[];
  wins: Window[];
  status: Status;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const gapBetween = (a: number, b: number) => {
    const inside = pts.filter((p) => p.t > a && p.t < b);
    if (!inside.length) return null;
    const measured = inside.filter((p) => p.bps !== null);
    const regimes = [...new Set(inside.map((p) => REGIME_LABEL[p.regime]))];
    return {
      hours: inside.length,
      label: regimes.slice(0, 2).join(", "),
      bps: measured.length ? measured.reduce((s, p) => s + p.bps!, 0) / measured.length : null,
    };
  };
  return (
    <ol className="relative flex flex-col" aria-label="Execution timeline">
      <span aria-hidden className="absolute top-3 bottom-3 left-[11px] w-px bg-gradient-to-b from-accent via-accent/40 to-transparent" />
      <li className="relative grid grid-cols-[24px_1fr] gap-4 pb-6">
        <span className="mt-1 grid size-6 place-items-center">
          <span className="size-3 rounded-full bg-accent-2 shadow-[0_0_18px_var(--color-accent)]" />
        </span>
        <div>
          <SystemLabel>Payday · {watTime(plan.input.start)} WAT</SystemLabel>
          <p className="mt-1 text-sm text-muted">All at once here would cost {bps(plan.baseline.bps)}.</p>
        </div>
      </li>
      {wins.map((w, i) => {
        const gap = gapBetween(i === 0 ? plan.input.start : wins[i - 1]!.t, w.t);
        const sel = selected === w.id;
        return (
          <li key={w.id} className="rise flex flex-col" style={{ ["--d" as string]: `${300 + i * 120}ms` }}>
            {gap ? (
              <div className="grid grid-cols-[24px_1fr] gap-4 pb-5">
                <span />
                <p className="font-mono text-[11px] text-muted/80">
                  skip {gap.hours}h · {gap.label} {gap.bps !== null ? `· ${gap.bps.toFixed(1)} bps` : "· not measured"}
                </p>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => onSelect(w.id)}
              aria-pressed={sel}
              className={`grid grid-cols-[24px_1fr] gap-4 pb-6 text-left ${sel ? "" : ""}`}
            >
              <span className="mt-1 grid size-6 place-items-center">
                <span
                  className={`size-3 rounded-full border ${status === "READY" ? "border-exec bg-exec" : w.best || sel ? "border-accent-2 bg-accent shadow-[0_0_14px_var(--color-accent)]" : "border-white/40 bg-bg"}`}
                />
              </span>
              <span className={`flex flex-col gap-1 border-b pb-5 ${sel ? "border-accent/50" : "border-white/[0.07]"}`}>
                <span className="flex items-baseline justify-between gap-3">
                  <SystemLabel accent={w.best}>
                    Window {String(w.index).padStart(2, "0")} · {status}
                  </SystemLabel>
                  <span className={`font-mono text-sm tabular-nums ${w.best ? "text-accent" : ""}`}>{bps(w.bps)}</span>
                </span>
                <span className="text-lg tracking-tight">{wat(w.t, { weekday: "short", hour: "2-digit", minute: "2-digit" })} WAT</span>
                <span className="font-mono text-[13px] text-muted">
                  {w.rows.map((r) => `r${r.ticker} ${usd2(r.usd)}`).join("  ·  ")}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Trace({ data, at }: { data: { t: number; bps: number | null }[]; at: number }) {
  const vals = data.map((d) => d.bps).filter((v): v is number => v !== null);
  if (vals.length < 2) return <p className="font-mono text-[11px] text-muted">Not enough measured hours to draw.</p>;
  const w = 320;
  const h = 56;
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const xs = (i: number) => (i / (data.length - 1)) * w;
  const ys = (v: number) => h - 6 - ((v - min) / (max - min || 1)) * (h - 12);
  let d = "";
  data.forEach((p, i) => {
    if (p.bps === null) return;
    d += `${d && data[i - 1]?.bps !== null ? "L" : "M"}${xs(i).toFixed(1)} ${ys(p.bps).toFixed(1)} `;
  });
  const idx = data.findIndex((p) => p.t === at);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-14 w-full" aria-hidden>
      <path d={d} fill="none" stroke="#F5F5F5" strokeOpacity="0.45" strokeWidth="1.2" className="draw" style={{ ["--len" as string]: 800 }} />
      {idx >= 0 && data[idx]!.bps !== null ? (
        <>
          <line x1={xs(idx)} x2={xs(idx)} y1="0" y2={h} stroke="#E8A34A" strokeOpacity="0.4" />
          <circle cx={xs(idx)} cy={ys(data[idx]!.bps!)} r="3.5" fill="#E8A34A" />
        </>
      ) : null}
    </svg>
  );
}

/** Spread, depth and volatility arranged around the execution point of the selected window. */
export function LiquiditySignal({ bundle, input, win, stress }: { bundle: MarketBundle; input: PlanInput; win: Window; stress: number }) {
  const [ticker, setTicker] = useState(win.rows[0]!.ticker);
  const row = win.rows.find((r) => r.ticker === ticker) ?? win.rows[0]!;
  const s = signals(bundle, row.ticker, row.regime, row.usd, stress);
  const trace = useMemo(() => assetTrace(bundle, row.ticker, input, row.usd, stress), [bundle, row.ticker, input, row.usd, stress]);
  const cell = (label: string, value: string, sub: string, tag: React.ReactNode) => (
    <div className="flex flex-col items-start gap-1">
      <SystemLabel>{label}</SystemLabel>
      <span className="font-mono text-xl tabular-nums">{value}</span>
      <span className="text-[11px] text-muted">{sub}</span>
      {tag}
    </div>
  );
  return (
    <section aria-label="Why this window" className="fade-in flex flex-col gap-6 border-t border-white/[0.07] pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SystemLabel accent>
          Window {String(win.index).padStart(2, "0")} · {REGIME_LABEL[row.regime]}
        </SystemLabel>
        {win.rows.length > 1 ? (
          <div className="flex gap-1">
            {win.rows.map((r) => (
              <button
                key={r.ticker}
                type="button"
                onClick={() => setTicker(r.ticker)}
                aria-pressed={r.ticker === ticker}
                className={`rounded-full px-3 py-1 font-mono text-xs ${r.ticker === ticker ? "bg-white/10 text-fg" : "text-muted hover:text-fg"}`}
              >
                r{r.ticker}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-4 gap-y-6">
        <div className="col-span-3 flex justify-center">
          {cell("Depth", s.depth ?? "n/a", s.depthUsd != null ? `${usd2(s.depthUsd).replace(".00", "")} within 25 bps` : "not measured", <DataTag kind="OBSERVED" source="sampled book" />)}
        </div>
        <div className="justify-self-end text-right">
          {cell("Spread", bps(s.spreadBps), `median of ${s.samples} samples`, <DataTag kind="OBSERVED" source="sampled book" />)}
        </div>
        <div className="flex flex-col items-center gap-2 px-2">
          <span className="relative grid size-20 place-items-center rounded-full border border-accent/40">
            <span className="absolute inset-2 rounded-full border border-white/10" />
            <span className="font-mono text-sm text-accent">{s.costBps !== null ? s.costBps.toFixed(1) : "n/a"}</span>
          </span>
          <SystemLabel>Execution</SystemLabel>
          <span className="font-mono text-[11px] text-muted">
            r{row.ticker} {usd2(row.usd)} · {watTime(win.t)}
          </span>
          <DataTag kind="ESTIMATED" />
        </div>
        <div>{cell("Volatility", s.volBps !== null ? `${s.volBps.toFixed(0)} bps/h` : "n/a", "median hourly range", <DataTag kind="OBSERVED" source="Bitget 1h" />)}</div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <SystemLabel>r{row.ticker} cost across the window</SystemLabel>
          <DataTag kind="ESTIMATED" />
        </div>
        <Trace data={trace} at={win.t} />
      </div>
    </section>
  );
}

export function ExecutionTimeline({
  plan,
  bundle,
  stress = 1,
  status = "PLANNED",
  interactive = true,
}: {
  plan: Plan;
  bundle: MarketBundle;
  stress?: number;
  status?: Status;
  interactive?: boolean;
}) {
  const pts = useMemo(() => terrain(bundle, plan.input, stress), [bundle, plan.input, stress]);
  const wins = useMemo(() => windowsOf(plan), [plan]);
  const [selected, setSelected] = useState<string | null>(null);
  const sel = wins.find((w) => w.id === selected) ?? null;
  const pick = (id: string) => interactive && setSelected((s) => (s === id ? null : id));

  if (!wins.length) {
    return (
      <div className="rounded-sm border border-dashed border-white/15 p-6">
        <SystemLabel>No window yet</SystemLabel>
        <p className="mt-2 text-sm text-muted">
          The cost of these hours has not been measured yet, so Landed will not guess. The sampler records Bitget order books every 5 minutes.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-8">
      <div className="hidden md:block" key={`h-${plan.totals.bps}-${wins.length}`}>
        <Horizontal plan={plan} pts={pts} wins={wins} status={status} selected={selected} onSelect={pick} />
      </div>
      <div className="md:hidden" key={`v-${plan.totals.bps}-${wins.length}`}>
        <Vertical plan={plan} pts={pts} wins={wins} status={status} selected={selected} onSelect={pick} />
      </div>
      {interactive ? (
        sel ? (
          <LiquiditySignal key={sel.id} bundle={bundle} input={plan.input} win={sel} stress={stress} />
        ) : (
          <p className="font-mono text-[11px] text-muted">Select a window to see why it was chosen.</p>
        )
      ) : null}
    </div>
  );
}
