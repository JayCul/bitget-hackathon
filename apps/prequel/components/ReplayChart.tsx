"use client";
import { useMemo } from "react";
import { Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { Headline } from "@/lib/prequel/types";
import type { Fire, Recording } from "@/lib/replay/types";

const fmtDay = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function ReplayChart({
  rec,
  now,
  headlines,
  fires,
}: {
  rec: Recording;
  now: number;
  headlines: Headline[];
  fires: Fire[];
}) {
  const start = rec.hourly[0]?.t ?? 0;
  const end = rec.hourly.at(-1)?.t ?? 1;
  const data = useMemo(() => rec.hourly.map((p) => ({ t: p.t, c: p.c })), [rec]);
  const visible = useMemo(() => data.map((d) => ({ t: d.t, c: d.t <= now ? d.c : null })), [data, now]);
  const levels = headlines.filter((h) => h.tripwire.type === "price" && h.tripwire.level !== undefined);
  const prices = data.map((d) => d.c);
  const lo = Math.min(...prices, ...levels.map((h) => h.tripwire.level!));
  const hi = Math.max(...prices, ...levels.map((h) => h.tripwire.level!));
  const pad = (hi - lo) * 0.08;
  const earnings = rec.events.find((e) => e.kind === "earnings");
  const shown = fires.filter((f) => f.at <= now);
  const priceAt = (t: number) => {
    let c = data[0]?.c ?? 0;
    for (const d of data) {
      if (d.t > t) break;
      c = d.c;
    }
    return c;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={visible} margin={{ top: 16, right: 64, bottom: 0, left: 0 }}>
        <XAxis
          dataKey="t"
          type="number"
          domain={[start, end]}
          tickFormatter={fmtDay}
          stroke="var(--color-line-strong)"
          fontSize={11}
          fontFamily="var(--font-mono)"
          tickLine={false}
          minTickGap={48}
        />
        <YAxis
          domain={[lo - pad, hi + pad]}
          stroke="var(--color-line-strong)"
          fontSize={11}
          fontFamily="var(--font-mono)"
          tickLine={false}
          width={52}
          tickFormatter={(v: number) => `$${v.toFixed(0)}`}
        />
        {levels.map((h) => (
          <ReferenceLine
            key={h.id}
            y={h.tripwire.level}
            stroke={h.side === "RED" ? "var(--color-red)" : "var(--color-green)"}
            strokeOpacity={0.6}
            strokeDasharray="4 4"
            label={{ value: `${h.id} $${h.tripwire.level!.toFixed(0)}`, position: "right", fill: "var(--color-muted)", fontSize: 10, fontFamily: "var(--font-mono)" }}
          />
        ))}
        {earnings ? (
          <ReferenceLine
            x={earnings.at}
            stroke="var(--color-line-strong)"
            strokeDasharray="2 3"
            label={{ value: "Earnings", position: "insideTopLeft", fill: "var(--color-muted)", fontSize: 10 }}
          />
        ) : null}
        <ReferenceLine x={Math.min(now, end)} stroke="var(--color-accent)" strokeOpacity={now >= start ? 0.5 : 0} />
        <Line dataKey="c" stroke="var(--color-fg)" strokeWidth={1.4} dot={false} isAnimationActive={false} connectNulls={false} />
        {shown.map((f) => (
          <ReferenceDot key={f.headlineId} x={f.at} y={priceAt(f.at)} r={5} fill="var(--color-accent)" stroke="var(--color-bg)" strokeWidth={2} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
