"use client";
import { Button, DataTag, Sheet, Timeline, type TimelineItem } from "@desk/ui";
import { useEffect, useState } from "react";
import { bps, usd2, usdCents, wat, watDay, watTime } from "@/lib/format";
import { REGIME_LABEL, type Regime } from "@/lib/regime";
import type { ExecutionReport, PlanResponse } from "@/lib/types";
import { CostStrip } from "./CostStrip";

const REGIMES: Regime[] = ["session", "extended", "overnight", "weekend"];

function Stat({ label, value, tag, accent }: { label: string; value: string; tag: React.ReactNode; accent?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <span className={`truncate font-mono text-xl tabular-nums ${accent ? "text-accent" : ""}`}>{value}</span>
      {tag}
    </div>
  );
}

export function Micro({ data }: { data: PlanResponse }) {
  return (
    <section aria-label="Market microstructure" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Market right now</h2>
        <DataTag kind="OBSERVED" source="Bitget order book" />
      </div>
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <table className="w-full min-w-[440px] text-left text-[13px]">
          <thead className="font-mono text-[10px] tracking-wider text-muted uppercase">
            <tr className="border-b border-line">
              <th className="py-2 font-normal">Asset</th>
              <th className="py-2 font-normal">Spread</th>
              <th className="py-2 font-normal">Depth ±25bp</th>
              <th className="py-2 font-normal">Buy all now</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {data.micro.map((m) => (
              <tr key={m.ticker} className="border-b border-line last:border-b-0">
                <td className="py-2.5">r{m.ticker}</td>
                {m.live.ok ? (
                  <>
                    <td>{bps(m.live.spreadBps)}</td>
                    <td>{usd2(m.live.depthAsk25Usd).replace(".00", "")}</td>
                    <td>{bps(m.live.buyNowBps)}</td>
                  </>
                ) : (
                  <td colSpan={3} className="text-muted">
                    Unavailable: {m.live.message}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between pt-2">
        <h3 className="text-sm font-medium">Measured by market state</h3>
        <DataTag kind="OBSERVED" source={`${data.model.samples} book samples`} />
      </div>
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <table className="w-full min-w-[440px] text-left text-[13px]">
          <thead className="font-mono text-[10px] tracking-wider text-muted uppercase">
            <tr className="border-b border-line">
              <th className="py-2 font-normal">Asset</th>
              {REGIMES.map((r) => (
                <th key={r} className="py-2 font-normal">
                  {REGIME_LABEL[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {data.micro.map((m) => (
              <tr key={m.ticker} className="border-b border-line last:border-b-0">
                <td className="py-2.5">r{m.ticker}</td>
                {REGIMES.map((r) => (
                  <td key={r} className={m.sampled[r] ? "" : "text-muted/60"}>
                    {m.sampled[r] ? bps(m.sampled[r]!.costBps) : "not yet"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs leading-relaxed text-muted">
        Median cost to buy one order of your size, walking real Bitget order books sampled every 5 minutes
        {data.model.from ? ` since ${watDay(data.model.from)}` : ""}. States with fewer than 3 samples are not used.
      </p>
    </section>
  );
}

/** The signature screen. `demo` renders read-only for the landing preview. */
export function PlanView({ data, demo, onReset }: { data: PlanResponse; demo?: boolean; onReset?: () => void }) {
  const p = data.plan;
  const [why, setWhy] = useState<{ text: string; model: string } | null>(null);
  const [whyErr, setWhyErr] = useState<string | null>(null);
  const [whatIf, setWhatIf] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [report, setReport] = useState<ExecutionReport | null>(null);
  const [executing, setExecuting] = useState(false);
  const best = p.rows.length ? Math.min(...p.rows.map((r) => r.bps)) : 0;

  useEffect(() => {
    if (demo || !p.rows.length) return;
    let cancelled = false;
    fetch("/api/explain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: p }) })
      .then((r) => r.json())
      .then((j) => !cancelled && (j.error ? setWhyErr(j.error) : setWhy(j)))
      .catch((e) => !cancelled && setWhyErr(String(e)));
    return () => {
      cancelled = true;
    };
  }, [p, demo]);

  const items: TimelineItem[] = p.rows.map((r, i) => ({
    id: `${r.ticker}-${r.t}-${i}`,
    time: watTime(r.t),
    highlight: r.bps <= best + 0.05,
    title: (
      <span className="flex items-baseline gap-2">
        <span className="font-mono">r{r.ticker}</span>
        <span className="font-mono text-muted">{usd2(r.usd)}</span>
      </span>
    ),
    detail: `${wat(r.t, { weekday: "short", day: "numeric", month: "short" })} · ${REGIME_LABEL[r.regime]}`,
    aside: (
      <span className="flex flex-col items-end gap-1">
        <span className={`font-mono text-sm tabular-nums ${r.bps <= best + 0.05 ? "text-accent" : ""}`}>{bps(r.bps)}</span>
        <DataTag kind="ESTIMATED" />
      </span>
    ),
  }));

  async function execute() {
    setExecuting(true);
    try {
      const res = await fetch("/api/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: p }) });
      setReport(await res.json());
    } finally {
      setExecuting(false);
    }
  }

  const liveNowTotal = data.liveNow.every((l) => l.costUsd !== null) ? data.liveNow.reduce((s, l) => s + (l.costUsd ?? 0), 0) : null;
  const liveNowBps = liveNowTotal !== null && p.totals.usd ? (liveNowTotal / data.liveNow.reduce((s, l) => s + l.usd, 0)) * 1e4 : null;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">Plan</span>
          {demo ? <DataTag kind="DEMO REPLAY" /> : <span className="font-mono text-[11px] text-muted">Built {watTime(Date.parse(data.generatedAt))} WAT</span>}
        </div>
        <div className="grid grid-cols-3 gap-4 border-y border-line py-5">
          <Stat label="Investing" value={usd2(p.totals.usd || p.input.assets.reduce((s, a) => s + a.usd, 0))} tag={<DataTag kind="COMPUTED" />} />
          <Stat label="Orders" value={String(p.rows.length)} tag={<DataTag kind="COMPUTED" />} />
          <Stat label="Window" value={p.input.windowHours === 24 ? "24 h" : "7 days"} tag={<span className="font-mono text-[10px] text-muted">from {watTime(p.input.start)} WAT</span>} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Buy all at alert" value={bps(p.baseline.bps)} tag={<DataTag kind="ESTIMATED" />} />
          <Stat label="Landed plan" value={bps(p.totals.bps)} tag={<DataTag kind="ESTIMATED" />} accent />
          <Stat label="You keep" value={p.savedUsd !== null ? usdCents(p.savedUsd) : "n/a"} tag={<DataTag kind="ESTIMATED" />} accent />
        </div>
      </header>

      {p.rows.length ? <CostStrip plan={p} micro={data.micro} /> : null}

      <section aria-label="Orders" className="flex flex-col gap-4">
        <h2 className="text-sm font-medium">Orders, in West Africa Time</h2>
        {p.rows.length ? (
          <Timeline items={items} label="Planned orders" />
        ) : (
          <p className="rounded-md border border-dashed border-line-strong p-4 text-sm text-muted">
            No order could be planned yet: the cost of these hours has not been measured.
          </p>
        )}
        {p.unplanned.length ? (
          <ul className="text-[13px] text-muted">
            {p.unplanned.map((u) => (
              <li key={u.ticker}>
                r{u.ticker}: {u.reason}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {!demo ? (
        <section className="flex flex-col gap-3 rounded-md border border-line bg-raised/60 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Why this plan?</h2>
            <span className="font-mono text-[10px] text-muted">{why ? `AI · ${why.model}` : "AI"}</span>
          </div>
          <p className="text-[15px] leading-relaxed">
            {why ? why.text : whyErr ? <span className="text-muted">Explanation unavailable: {whyErr.slice(0, 120)}</span> : <span className="pulse-dot text-muted">Writing...</span>}
          </p>
          <p className="text-[11px] text-muted">Written from the computed plan. The AI does not change any number.</p>
        </section>
      ) : null}

      {!demo ? (
        <div className="sticky bottom-4 z-20 flex gap-3">
          <Button variant="ghost" className="flex-1 bg-bg/90 backdrop-blur-md" onClick={() => setWhatIf(true)}>
            What if I buy now?
          </Button>
          <Button className="flex-1" disabled={!p.rows.length} onClick={() => setConfirm(true)}>
            Confirm plan
          </Button>
        </div>
      ) : null}

      <Micro data={data} />

      {!demo && onReset ? (
        <button type="button" onClick={onReset} className="self-start text-sm text-muted underline underline-offset-4 hover:text-fg">
          Start over
        </button>
      ) : null}

      <Sheet open={whatIf} onClose={() => setWhatIf(false)} title="What if I buy now?">
        <div className="flex flex-col gap-6">
          <table className="w-full text-left text-sm">
            <tbody className="font-mono tabular-nums">
              <tr className="border-b border-line">
                <td className="py-3 font-sans">
                  Buy everything now
                  <div className="mt-1">
                    <DataTag kind="OBSERVED" source="live order book" />
                  </div>
                </td>
                <td className="text-right">{bps(liveNowBps)}</td>
                <td className="text-right">{liveNowTotal !== null ? usdCents(liveNowTotal) : "n/a"}</td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-3 font-sans">
                  Buy everything at the alert
                  <div className="mt-1">
                    <DataTag kind="ESTIMATED" source="sampled books" />
                  </div>
                </td>
                <td className="text-right">{bps(p.baseline.bps)}</td>
                <td className="text-right">{p.baseline.costUsd !== null ? usdCents(p.baseline.costUsd) : "n/a"}</td>
              </tr>
              <tr>
                <td className="py-3 font-sans text-accent">
                  Landed plan
                  <div className="mt-1">
                    <DataTag kind="ESTIMATED" source="sampled books" />
                  </div>
                </td>
                <td className="text-right text-accent">{bps(p.totals.bps)}</td>
                <td className="text-right text-accent">{usdCents(p.totals.costUsd)}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-[13px] leading-relaxed text-muted">
            Cost means spread plus slippage against the mid price, for these order sizes. It does not include where the price moves while you
            wait, which can go either way. The Replay tab measures that on past weeks.
          </p>
        </div>
      </Sheet>

      <Sheet
        open={confirm}
        onClose={() => {
          setConfirm(false);
          setReport(null);
        }}
        title={report ? "Execution report" : "Ready to execute?"}
      >
        {!report ? (
          <div className="flex flex-col gap-6">
            <p className="text-2xl font-medium tracking-tight">
              {p.rows.length} orders, {usd2(p.totals.usd)}, simulated execution.
            </p>
            <p className="text-sm leading-relaxed text-muted">
              Nothing is sent to an exchange. Each order is filled against Bitget&apos;s live order book right now to show what it would cost.
            </p>
            <Button disabled={executing} onClick={execute}>
              {executing ? "Filling against the live book..." : "Confirm and simulate"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="pop flex items-center gap-3 text-accent">
              <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
                <circle cx="14" cy="14" r="13" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 14.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
              <span className="text-lg font-medium">Simulated. Nothing was executed.</span>
            </div>
            <ul className="flex flex-col">
              {report.fills.map((f, i) => (
                <li key={i} className="rise grid grid-cols-[1fr_auto] gap-2 border-t border-line py-3 first:border-t-0" style={{ ["--d" as string]: `${i * 60}ms` }}>
                  <div>
                    <div className="font-mono text-sm">
                      r{f.ticker} <span className="text-muted">{usd2(f.usd)}</span>
                    </div>
                    <div className="text-xs text-muted">
                      Planned {watTime(f.t)} WAT · {f.qty !== null ? `${f.qty.toFixed(4)} @ ${usd2(f.simPrice!)}` : f.note}
                    </div>
                  </div>
                  <div className="text-right font-mono text-xs leading-5 tabular-nums">
                    <div>
                      <span className="text-muted">plan </span>
                      {bps(f.plannedBps)}
                    </div>
                    <div>
                      <span className="text-muted">book now </span>
                      {bps(f.simBps)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-2 gap-4 border-t border-line pt-4">
              <Stat label="Planned cost" value={usdCents(report.totals.plannedCostUsd)} tag={<DataTag kind="ESTIMATED" />} />
              <Stat label="Against the book now" value={report.totals.simCostUsd !== null ? usdCents(report.totals.simCostUsd) : "n/a"} tag={<DataTag kind="OBSERVED" source="live book" />} />
            </div>
            <p className="text-xs leading-relaxed text-muted">{report.method} Logged as {report.id}.</p>
          </div>
        )}
      </Sheet>
    </div>
  );
}
