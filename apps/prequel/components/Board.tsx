"use client";
import { DataTag, Sheet, StatusPill, pct, usd, type Status } from "@desk/ui";
import { useMemo, useState } from "react";
import { COMMITMENT_LABEL, type Board as BoardT, type Headline, type Side } from "@/lib/prequel/types";
import { actions } from "@/lib/store";
import { AnalogPanel } from "./AnalogPanel";
import { BoardMetrics } from "./BoardMetrics";
import { CommitmentControl } from "./Commitment";

const COLUMN: Record<Side, { title: string; sub: string }> = {
  RED: { title: "What breaks it?", sub: "Events that would invalidate the thesis" },
  GREEN: { title: "What confirms it?", sub: "Events that would confirm the thesis" },
};

export function HeadlineRow({
  h,
  index,
  onOpen,
  status,
}: {
  h: Headline;
  index: number;
  onOpen?: () => void;
  status?: Status;
}) {
  const s = h.analogs?.stats;
  const Tag = onOpen ? "button" : "div";
  return (
    <Tag
      type={onOpen ? "button" : undefined}
      onClick={onOpen}
      style={{ ["--d" as string]: `${100 + index * 60}ms` }}
      aria-label={onOpen ? `${h.id}: ${h.headline}. Open analogs and commitment` : undefined}
      className={`rise group relative grid w-full grid-cols-[2px_1fr] gap-x-4 border-t border-line py-5 text-left ${onOpen ? "cursor-pointer transition-colors hover:bg-white/[0.015]" : ""}`}
    >
      <span aria-hidden className={`h-full min-h-10 w-[2px] rounded-full ${h.side === "RED" ? "bg-red" : "bg-green"}`} />
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <span className="font-mono text-xs text-muted">{h.id.replace(/(\D)(\d)/, "$1 0$2").replace("R ", "RED ").replace("G ", "GREEN ")}</span>
          <div className="flex items-center gap-2">
            {status ? <StatusPill status={status} /> : null}
            {h.commitment ? (
              <span className="rounded-full border border-accent/40 px-2 py-px font-mono text-[10px] text-accent">
                {COMMITMENT_LABEL[h.commitment.action]}
              </span>
            ) : null}
          </div>
        </div>
        <p className="text-[15px] leading-snug text-fg md:text-base">{h.headline}</p>
        <p className="font-mono text-[11px] leading-5 text-muted">
          {h.tripwire.label} · {h.window}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            {s && s.n > 0 ? (
              <>
                <span className="font-mono text-fg">{s.n}</span> analog{s.n === 1 ? "" : "s"} · median +5d{" "}
                <span className="font-mono text-fg">{s.median5d != null ? pct(s.median5d) : "n/a"}</span>
                <DataTag kind="COMPUTED" />
              </>
            ) : (
              <span>No analog in window</span>
            )}
          </span>
          <span className="flex items-center gap-1.5">
            AI est. <span className="font-mono">{Math.round(h.modelEstimate * 100)}%</span>
            <DataTag kind="AI ESTIMATE" />
          </span>
        </div>
      </div>
      {onOpen ? (
        <span aria-hidden className="absolute top-5 right-0 translate-x-2 text-muted opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100">
          →
        </span>
      ) : null}
    </Tag>
  );
}

export function Column({
  side,
  headlines,
  onOpen,
  statuses,
}: {
  side: Side;
  headlines: Headline[];
  onOpen?: (h: Headline) => void;
  statuses?: Record<string, Status>;
}) {
  return (
    <section aria-label={COLUMN[side].title} className="min-w-0">
      <header className="mb-2 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-medium tracking-tight md:text-2xl">{COLUMN[side].title}</h2>
          <p className="mt-1 text-[13px] text-muted">{COLUMN[side].sub}</p>
        </div>
        <span className={`mb-1 h-5 w-[2px] ${side === "RED" ? "bg-red" : "bg-green"}`} aria-hidden />
      </header>
      {headlines.map((h, i) => (
        <HeadlineRow key={h.id} h={h} index={i} onOpen={onOpen ? () => onOpen(h) : undefined} status={statuses?.[h.id]} />
      ))}
    </section>
  );
}

export function BoardHeader({ board }: { board: BoardT }) {
  const t = board.thesis;
  const c = board.context;
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs text-muted">{t.mode === "replay" ? `As of ${t.asOf}` : `Live · ${t.asOf}`}</span>
          {t.mode === "replay" ? <StatusPill status="REPLAY" /> : <StatusPill status="LIVE" />}
          {board.recorded ? <DataTag kind="DEMO REPLAY" /> : null}
        </div>
        <h1 className="text-title font-medium">
          <span className="font-mono">{t.ticker}</span>{" "}
          <span className="text-muted">
            {t.direction === "long" ? "Long" : "Short"} · {t.horizonDays / 7} weeks · {usd(t.sizeUsd)}
          </span>
        </h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-muted">{t.text}</p>
      </div>
      <dl className="grid grid-cols-3 gap-6 lg:gap-10">
        <div className="flex flex-col gap-1.5">
          <dt className="text-xs text-muted">Reference close</dt>
          <dd className="font-mono text-xl tabular-nums">${c.refPrice.toFixed(2)}</dd>
          <dd>
            <DataTag kind="OBSERVED" source={`Bitget r${t.ticker} · ${c.refDate}`} />
          </dd>
        </div>
        <div className="flex flex-col gap-1.5">
          <dt className="text-xs text-muted">Last 20 sessions</dt>
          <dd className="font-mono text-xl tabular-nums">{c.ret20d != null ? pct(c.ret20d) : "n/a"}</dd>
          <dd>
            <DataTag kind="COMPUTED" />
          </dd>
        </div>
        <div className="flex flex-col gap-1.5">
          <dt className="text-xs text-muted">Next earnings</dt>
          <dd className="font-mono text-xl tabular-nums">{c.nextEarnings ? c.nextEarnings.date.slice(5) : "none"}</dd>
          <dd>
            <DataTag kind="OBSERVED" source="Bitget calendar, scheduled" />
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function SourcesNote({ board }: { board: BoardT }) {
  return (
    <details className="group border-t border-line pt-5 text-[13px] text-muted">
      <summary className="cursor-pointer list-none font-mono text-[11px] tracking-[0.14em] uppercase hover:text-fg">
        Sources and coverage <span className="inline-block transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="mt-4 grid gap-3 leading-relaxed md:grid-cols-2">
        <p>
          Prices: {board.universe.barsSource}. Window {board.universe.window.from} to {board.universe.window.to}.
        </p>
        <p>
          Analog pool: {board.universe.candidates} past events across {board.universe.tickers.join(", ")}. Earnings dates aligned to the
          peak-volume session (Bitget calendar runs one session early).
        </p>
        <p>
          Headlines and analog selection: {board.model} via Groq. All returns, counts and balances are computed in code. Generated{" "}
          {new Date(board.generatedAt).toLocaleString("en-GB")}.
        </p>
        {board.failures.length ? (
          <div>
            <p className="text-fg">Unavailable from source:</p>
            <ul className="mt-1 list-inside list-disc">
              {board.failures.map((f) => (
                <li key={`${f.ticker}-${f.what}`}>
                  {f.ticker} {f.what}: {f.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
  );
}

/** The signature screen. Interactive unless `readOnly` (used for the landing preview). */
export function Board({ board, readOnly }: { board: BoardT; readOnly?: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [mobileSide, setMobileSide] = useState<Side>("RED");
  const open = useMemo(() => board.headlines.find((h) => h.id === openId) ?? null, [board, openId]);
  const side = (s: Side) => board.headlines.filter((h) => h.side === s);

  return (
    <div className="flex flex-col gap-12">
      <BoardHeader board={board} />
      <BoardMetrics board={board} />

      <div className="md:hidden">
        <div role="tablist" aria-label="Side" className="grid grid-cols-2 rounded-md border border-line bg-raised p-1">
          {(["RED", "GREEN"] as const).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={mobileSide === s}
              onClick={() => setMobileSide(s)}
              className={`flex h-10 items-center justify-center gap-2 rounded-[5px] text-sm ${mobileSide === s ? "bg-raised-2 text-fg" : "text-muted"}`}
            >
              <span aria-hidden className={`h-3 w-[2px] ${s === "RED" ? "bg-red" : "bg-green"}`} />
              {s === "RED" ? "Breaks it" : "Confirms it"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-12 md:grid-cols-2 md:gap-10 lg:gap-16">
        {(["RED", "GREEN"] as const).map((s) => (
          <div key={s} className={mobileSide === s ? "" : "hidden md:block"}>
            <Column side={s} headlines={side(s)} onOpen={(h) => setOpenId(h.id)} />
          </div>
        ))}
      </div>

      <SourcesNote board={board} />

      <Sheet
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        width={620}
        title={
          open ? (
            <span className="flex items-center gap-2">
              <span aria-hidden className={`h-4 w-[2px] ${open.side === "RED" ? "bg-red" : "bg-green"}`} />
              <span className="font-mono text-xs text-muted">{open.id}</span>
              <span>{open.side === "RED" ? "Breaks the thesis" : "Confirms the thesis"}</span>
            </span>
          ) : null
        }
      >
        {open ? (
          <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-3">
              <p className="text-xl leading-snug font-medium tracking-tight">{open.headline}</p>
              <div className="flex flex-col gap-1.5 rounded-md border border-line bg-bg p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted">Tripwire · {open.tripwire.type}</span>
                  <DataTag kind={open.tripwire.level !== undefined ? "COMPUTED" : "AI ESTIMATE"} />
                </div>
                <p className="font-mono text-[13px]">{open.tripwire.label}</p>
                <p className="text-xs text-muted">
                  Window: {open.window} ({open.windowDays} days from {board.thesis.asOf})
                </p>
              </div>
              <p className="flex items-center gap-2 text-xs text-muted">
                AI estimate {Math.round(open.modelEstimate * 100)}%. Not a calibrated probability.
                <DataTag kind="AI ESTIMATE" />
              </p>
            </div>

            <AnalogPanel h={open} barsSource={board.universe.barsSource} />

            <section className="flex flex-col gap-4 border-t border-line pt-8">
              <div>
                <h3 className="text-sm font-medium">If this happens</h3>
                <p className="mt-1 text-[13px] text-muted">Decide now, while you are calm. Prequel will remind you. It never trades.</p>
              </div>
              <CommitmentControl
                side={open.side}
                value={open.commitment}
                readOnly={readOnly}
                onLock={(c) => actions.setCommitment(board.id, open.id, c)}
                onUnlock={() => actions.setCommitment(board.id, open.id, undefined)}
              />
            </section>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
