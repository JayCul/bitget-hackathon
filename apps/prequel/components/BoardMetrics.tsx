"use client";
import { DataTag } from "@desk/ui";
import { BALANCE_WARNING, FIRED_WEIGHT, evidenceBalance, modelConviction } from "@/lib/prequel/scoring";
import type { Board } from "@/lib/prequel/types";

function Block({ title, children, tag }: { title: string; children: React.ReactNode; tag: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 border-t border-line pt-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-muted">{title}</span>
        {tag}
      </div>
      {children}
    </div>
  );
}

export function BoardMetrics({ board, firedIds = [] }: { board: Board; firedIds?: string[] }) {
  const eb = evidenceBalance(board.headlines);
  const mc = modelConviction(board.headlines, board.thesis.direction, firedIds);
  const lopsided = eb.red < eb.green ? "Red" : "Green";

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <Block title="Evidence Balance" tag={<DataTag kind="COMPUTED" />}>
        <div className="flex items-baseline gap-4">
          <span className={`font-mono text-4xl tracking-tight tabular-nums ${eb.warning ? "text-accent" : "text-fg"}`}>
            {eb.balance === null ? "n/a" : `${Math.round(eb.balance * 100)}%`}
          </span>
          <span className="font-mono text-[13px] text-muted">
            R {eb.red} · G {eb.green} evidence items
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["RED", "GREEN"] as const).map((s) => {
            const n = s === "RED" ? eb.redSupported : eb.greenSupported;
            return (
              <div key={s} className="flex items-center gap-2">
                <span aria-hidden className={`h-3 w-[2px] ${s === "RED" ? "bg-red" : "bg-green"}`} />
                <span className="text-[13px] text-muted">
                  {s === "RED" ? "Red" : "Green"} with analogs <span className="font-mono text-fg">{n}/5</span>
                </span>
              </div>
            );
          })}
        </div>
        {eb.warning ? (
          <p className="text-[13px] leading-relaxed text-accent">
            {eb.balance === null
              ? "No historical evidence found yet."
              : `Below ${Math.round(BALANCE_WARNING * 100)}%: the research is one-sided. The ${lopsided} side has less evidence behind it.`}
          </p>
        ) : (
          <p className="text-[13px] text-muted">Both sides are backed by a similar amount of evidence.</p>
        )}
      </Block>

      <Block title="Model Conviction" tag={<DataTag kind="COMPUTED" />}>
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-4xl tracking-tight tabular-nums">
            {mc.green === null ? "n/a" : `${Math.round(mc.green * 100)}%`}
          </span>
          <span className="text-[13px] text-muted">toward Green</span>
        </div>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-raised-2" role="img" aria-label={`Green ${mc.greenPoints} points, Red ${mc.redPoints} points`}>
          <div className="h-full bg-green/70 transition-[width] duration-700 ease-out" style={{ width: `${(mc.green ?? 0.5) * 100}%` }} />
          <div className="h-full flex-1 bg-red/60" />
        </div>
        <p className="text-[13px] leading-relaxed text-muted">
          Green {mc.greenPoints} pts · Red {mc.redPoints} pts. A point is an analog whose +5d move agreed with its scenario; a fired tripwire adds{" "}
          {FIRED_WEIGHT}.{firedIds.length ? ` Fired so far: ${mc.firedGreen} Green, ${mc.firedRed} Red.` : ""}
        </p>
      </Block>
    </div>
  );
}
