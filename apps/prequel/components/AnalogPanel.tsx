"use client";
import { ChartFrame, DataTag, pct } from "@desk/ui";
import type { AnalogView, Headline } from "@/lib/prequel/types";
import { AnalogPaths, OutcomeBars, Spark } from "./charts";

const FLAG_TEXT: Record<string, string> = {
  date_aligned: "Date aligned by volume",
  date_unverified: "Date unverified",
  thin_volume_baseline: "Thin volume baseline",
  earnings_reaction: "Earnings reaction",
  post_earnings: "After earnings",
  timing_unknown: "Timing unknown",
};

const TYPE_TEXT = { earnings: "Earnings", analyst: "Analyst", gap: "Gap" } as const;

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <span className="font-mono text-xl tabular-nums">{value}</span>
      {sub ? <span className="font-mono text-[11px] text-muted">{sub}</span> : null}
    </div>
  );
}

function AnalogRow({ a }: { a: AnalogView }) {
  const r = a.ret;
  return (
    <li className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-line py-3 first:border-t-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="font-mono text-muted">{a.candidate.date}</span>
          <span className="font-mono">{a.candidate.ticker}</span>
          <span className="text-muted">{TYPE_TEXT[a.candidate.type]}</span>
          {a.candidate.flags.map((f) => (
            <span key={f} className="rounded-sm border border-line px-1.5 font-mono text-[10px] text-muted">
              {FLAG_TEXT[f] ?? f}
            </span>
          ))}
        </div>
        <p className="mt-1 text-[13px] leading-snug text-muted">{a.candidate.summary}</p>
        {a.excluded ? <p className="mt-1 text-xs text-accent">Excluded: {a.excluded}</p> : null}
      </div>
      <div className="flex items-center gap-3 self-center">
        {r && !a.excluded ? <Spark path={r.path} base={r.baseClose} /> : null}
        <div className="w-[108px] text-right font-mono text-xs leading-5 tabular-nums">
          <div>
            <span className="text-muted">+1d </span>
            {r?.ret1d != null ? pct(r.ret1d) : "n/a"}
          </div>
          <div>
            <span className="text-muted">+5d </span>
            {r?.ret5d != null ? pct(r.ret5d) : "n/a"}
          </div>
        </div>
      </div>
    </li>
  );
}

export function AnalogPanel({ h, barsSource }: { h: Headline; barsSource: string }) {
  const a = h.analogs;
  if (!a) {
    return <p className="text-sm text-muted">Analog matching did not run for this scenario.</p>;
  }
  const s = a.stats;
  const outcomes = a.outcomes;
  return (
    <section aria-labelledby={`analogs-${h.id}`} className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h3 id={`analogs-${h.id}`} className="text-sm font-medium">
          Historical analogs
        </h3>
        <div className="flex gap-1.5">
          <DataTag kind="OBSERVED" source="Bitget" />
          <DataTag kind="COMPUTED" />
        </div>
      </div>

      {s.n === 0 ? (
        <div className="rounded-md border border-dashed border-line-strong p-5 text-sm leading-relaxed text-muted">
          No past event in the data window matches this scenario with a complete +5 session outcome.
          {outcomes.length ? ` ${outcomes.length} matched but lacked enough sessions after the event.` : ""} This is shown as missing
          evidence, not as zero risk.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <Stat label="Analogs" value={String(s.n)} sub={`${s.positive} up · ${s.negative} down`} />
            <Stat label="Up after 5d" value={`${s.positive}/${s.n}`} />
            <Stat label="Median +1d" value={s.median1d != null ? pct(s.median1d) : "n/a"} />
            <Stat label="Median +5d" value={s.median5d != null ? pct(s.median5d) : "n/a"} />
          </div>
          <ChartFrame title="Price path after each analog" kind="COMPUTED" height={180} caption="Grey: each analog, from its last pre-event close. Amber: median.">
            <AnalogPaths analogs={outcomes} />
          </ChartFrame>
          <ChartFrame title="+5 session outcome per analog" kind="COMPUTED" height={130} caption="Sorted. Dashed line: median.">
            <OutcomeBars analogs={outcomes} />
          </ChartFrame>
        </>
      )}

      {outcomes.length ? <ul className="flex flex-col">{outcomes.map((o) => <AnalogRow key={o.candidate.id} a={o} />)}</ul> : null}

      <p className="font-mono text-[11px] leading-5 text-muted">
        Prices: {barsSource}. Returns are close-to-close from the last close before the event reached the market (gap days: from the open).
      </p>

      <div className="flex flex-col gap-2 rounded-md border border-line bg-bg p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">Why these events</span>
          <DataTag kind="AI ESTIMATE" />
        </div>
        <p className="text-[13px] leading-relaxed">{a.reason || "The model gave no reason without figures, so none is shown."}</p>
        <p className="font-mono text-[11px] text-muted">Asked for: {h.analogQuery}</p>
        {a.droppedIds.length ? (
          <p className="font-mono text-[11px] text-muted">Ignored {a.droppedIds.length} id(s) that do not exist in the data.</p>
        ) : null}
      </div>
    </section>
  );
}
