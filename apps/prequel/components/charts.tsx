"use client";
import { pct } from "@desk/ui";
import { Bar, BarChart, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalogView } from "@/lib/prequel/types";
import { median } from "@desk/market-data";

const axis = { stroke: "var(--color-line-strong)", fontSize: 11, fontFamily: "var(--font-mono)", tickLine: false } as const;

function TooltipBox({ lines }: { lines: string[] }) {
  return (
    <div className="rounded-md border border-line-strong bg-raised-2 px-3 py-2 font-mono text-[11px] leading-5 text-fg shadow-lg">
      {lines.map((l) => (
        <div key={l}>{l}</div>
      ))}
    </div>
  );
}

/** Each analog's close path from its base, as % change, over the +5 session window. */
export function AnalogPaths({ analogs }: { analogs: AnalogView[] }) {
  const usable = analogs.filter((a) => a.ret && !a.excluded && a.ret.path.length >= 2);
  const maxLen = Math.max(0, ...usable.map((a) => a.ret!.path.length));
  const rows = Array.from({ length: maxLen }, (_, i) => {
    const row: Record<string, number | null> = { x: i };
    const vals: number[] = [];
    for (const a of usable) {
      const p = a.ret!.path[i];
      const v = p ? p.close / a.ret!.baseClose - 1 : null;
      row[a.candidate.id] = v;
      if (v !== null) vals.push(v);
    }
    row.median = median(vals);
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <XAxis dataKey="x" {...axis} tickFormatter={(x: number) => (x === 0 ? "base" : `+${x}`)} />
        <YAxis {...axis} width={48} tickFormatter={(v: number) => pct(v, 0)} />
        <ReferenceLine y={0} stroke="var(--color-line-strong)" />
        {usable.map((a) => (
          <Line
            key={a.candidate.id}
            dataKey={a.candidate.id}
            stroke="var(--color-cool)"
            strokeOpacity={0.45}
            strokeWidth={1}
            dot={false}
            connectNulls
            animationDuration={900}
            isAnimationActive
          />
        ))}
        <Line dataKey="median" stroke="var(--color-accent)" strokeWidth={2} dot={false} animationDuration={1200} />
        <Tooltip
          cursor={{ stroke: "var(--color-line-strong)" }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipBox
                lines={[
                  label === 0 ? "Base close" : `Session +${label}`,
                  `Median ${typeof payload.find((p) => p.dataKey === "median")?.value === "number" ? pct(payload.find((p) => p.dataKey === "median")!.value as number) : "n/a"}`,
                ]}
              />
            ) : null
          }
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** +5d outcome per analog, sorted, with the median marked. */
export function OutcomeBars({ analogs, field = "ret5d" }: { analogs: AnalogView[]; field?: "ret1d" | "ret5d" }) {
  const rows = analogs
    .filter((a) => a.ret && !a.excluded && a.ret[field] !== null)
    .map((a) => ({ id: a.candidate.id, label: `${a.candidate.ticker} ${a.candidate.date.slice(5)}`, v: a.ret![field] as number }))
    .sort((a, b) => a.v - b.v);
  const med = median(rows.map((r) => r.v));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <XAxis dataKey="label" hide />
        <YAxis {...axis} width={48} tickFormatter={(v: number) => pct(v, 0)} />
        <ReferenceLine y={0} stroke="var(--color-line-strong)" />
        {med !== null ? <ReferenceLine y={med} stroke="var(--color-accent)" strokeDasharray="4 3" /> : null}
        <Bar dataKey="v" radius={[2, 2, 2, 2]} animationDuration={800}>
          {rows.map((r) => (
            <Cell key={r.id} fill={r.v >= 0 ? "rgba(242,242,242,0.75)" : "rgba(138,138,138,0.45)"} />
          ))}
        </Bar>
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          content={({ active, payload }) =>
            active && payload?.[0] ? (
              <TooltipBox lines={[String(payload[0].payload.label), `${field === "ret5d" ? "+5d" : "+1d"} ${pct(payload[0].value as number)}`]} />
            ) : null
          }
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Tiny inline path for a row. */
export function Spark({ path, base }: { path: { close: number }[]; base: number }) {
  if (path.length < 2) return null;
  const vals = path.map((p) => p.close / base - 1);
  const min = Math.min(0, ...vals);
  const max = Math.max(0, ...vals);
  const span = max - min || 1;
  const w = 56;
  const h = 18;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - ((v - min) / span) * h}`).join(" ");
  const zero = h - ((0 - min) / span) * h;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="shrink-0">
      <line x1="0" x2={w} y1={zero} y2={zero} stroke="var(--color-line-strong)" strokeWidth="1" />
      <polyline points={pts} fill="none" stroke={vals.at(-1)! >= 0 ? "var(--color-fg)" : "var(--color-muted)"} strokeWidth="1.3" />
    </svg>
  );
}
