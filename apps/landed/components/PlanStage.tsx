"use client";
import { DataTag } from "@desk/ui";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { walkBuy } from "@/lib/book";
import { bps, usd2, usdCents, watTime } from "@/lib/format";
import { makePlan } from "@/lib/insight";
import type { Plan, PlanInput } from "@/lib/plan";
import type { ExecutionReport, MarketBundle } from "@/lib/types";
import { ExecutionTimeline, type Status } from "./ExecutionTimeline";
import { SystemLabel, useCountUp } from "./system";

const H = 3_600_000;

function Figure({ label, value, tag, accent }: { label: string; value: React.ReactNode; tag: React.ReactNode; accent?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-2">
      <SystemLabel>{label}</SystemLabel>
      <span className={`truncate font-mono text-2xl tracking-tight tabular-nums md:text-3xl ${accent ? "text-accent" : ""}`}>{value}</span>
      {tag}
    </div>
  );
}

function Keep({ usd }: { usd: number | null }) {
  const v = useCountUp(usd ?? 0, { ms: 900 });
  return <>{usd === null ? "n/a" : usdCents(v)}</>;
}

/** AI explains the computed plan; it never changes a number. */
function AIExplanation({ plan }: { plan: Plan }) {
  const [out, setOut] = useState<{ text: string; model: string } | { error: string } | null>(null);
  useEffect(() => {
    let off = false;
    fetch("/api/explain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) })
      .then((r) => r.json())
      .then((j) => !off && setOut(j.error ? { error: j.error } : j))
      .catch((e) => !off && setOut({ error: String(e) }));
    return () => {
      off = true;
    };
    // Explains the plan as built; what-if variations are shown in numbers, not re-explained.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <section aria-label="AI explanation" className="grid gap-4 border-l-2 border-accent/60 pl-5 md:grid-cols-[180px_1fr] md:gap-8 md:pl-6">
      <div className="flex flex-col gap-1">
        <SystemLabel accent>AI explanation</SystemLabel>
        <span className="font-mono text-[10px] text-muted">{out && "model" in out ? out.model : "Groq"}</span>
      </div>
      <p className="font-serif text-[1.45rem] leading-snug text-fg/90 italic md:text-[1.7rem]">
        {!out ? <span className="pulse-dot text-muted">Reading the plan...</span> : "error" in out ? <span className="text-base text-muted not-italic">Explanation unavailable right now.</span> : out.text}
      </p>
    </section>
  );
}

type Scenario = { extra: number; wait: number; stress: number; tranches: number };

function Control({
  q,
  value,
  options,
  onChange,
}: {
  q: string;
  value: number;
  options: { v: number; label: string }[];
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-white/[0.07] pt-4">
      <span className="text-[15px] tracking-tight">{q}</span>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={q}>
        {options.map((o) => (
          <button
            key={o.v}
            role="radio"
            aria-checked={value === o.v}
            onClick={() => onChange(o.v)}
            className={`h-9 rounded-full px-3.5 font-mono text-xs transition-colors ${value === o.v ? "bg-fg text-black" : "border border-white/12 text-muted hover:text-fg"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PlanStage({ bundle, base, onRestart }: { bundle: MarketBundle; base: PlanInput; onRestart: () => void }) {
  const [sc, setSc] = useState<Scenario>({ extra: 0, wait: 0, stress: 1, tranches: base.tranchesPerAsset });
  const [status, setStatus] = useState<Status>("PLANNED");
  const [report, setReport] = useState<ExecutionReport | null>(null);
  const [busy, setBusy] = useState(false);

  const basePlan = useMemo(() => makePlan(bundle, base), [bundle, base]);
  const input: PlanInput = useMemo(
    () => ({
      ...base,
      start: base.start + sc.wait * H,
      tranchesPerAsset: sc.tranches,
      assets: base.assets.map((a) => ({ ...a, usd: a.usd * (1 + sc.extra) })),
    }),
    [base, sc],
  );
  const plan = useMemo(() => makePlan(bundle, input, sc.stress), [bundle, input, sc.stress]);
  const changed = sc.extra !== 0 || sc.wait !== 0 || sc.stress !== 1 || sc.tranches !== base.tranchesPerAsset;
  const windows = new Set(plan.rows.map((r) => r.t)).size;

  const nowCost = useMemo(() => {
    let usd = 0;
    let cost = 0;
    for (const a of input.assets) {
      const b = bundle.live[a.ticker];
      if (!b?.ok) return null;
      const w = walkBuy(b.asks, b.bids, a.usd);
      if (!w) return null;
      usd += a.usd;
      cost += (a.usd * w.costBps) / 1e4;
    }
    return { bps: (cost / usd) * 1e4, usd: cost };
  }, [bundle, input.assets]);

  async function confirm() {
    setBusy(true);
    try {
      const r = await fetch("/api/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
      setReport(await r.json());
      setStatus("READY");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-16 md:gap-20">
      <header className="fade-in flex flex-col gap-8">
        <SystemLabel accent>Plan · built {watTime(Date.parse(bundle.generatedAt))} WAT</SystemLabel>
        <h1 className="text-statement max-w-4xl font-medium">
          {windows > 1 ? (
            <>
              {windows} windows. <span className="font-serif font-normal text-muted italic">Not everything at once.</span>
            </>
          ) : (
            <>Your plan.</>
          )}
        </h1>
        <div className="grid grid-cols-2 gap-6 border-y border-white/[0.07] py-6 md:grid-cols-4">
          <Figure label="Investing" value={usd2(plan.totals.usd || input.assets.reduce((s, a) => s + a.usd, 0))} tag={<DataTag kind="COMPUTED" />} />
          <Figure label="All at once" value={bps(plan.baseline.bps)} tag={<DataTag kind="ESTIMATED" />} />
          <Figure label="Landed" value={bps(plan.totals.bps)} tag={<DataTag kind="ESTIMATED" />} accent />
          <Figure label="You keep" value={<Keep usd={plan.savedUsd} />} tag={<DataTag kind="ESTIMATED" />} accent />
        </div>
        <p className="-mt-4 font-mono text-[11px] text-muted md:text-right">
          Kept in spread and slippage vs buying everything at payday. Price moves are separate: see History.
        </p>
      </header>

      <section aria-label="Execution timeline" className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <SystemLabel>Execution timeline · WAT</SystemLabel>
          <span className="flex items-center gap-2">
            <SystemLabel accent={status === "READY"} className={status === "READY" ? "!text-exec" : ""}>
              {status}
            </SystemLabel>
            {changed ? <DataTag kind="ESTIMATED" source="what-if" /> : null}
          </span>
        </div>
        <ExecutionTimeline key={JSON.stringify(sc)} plan={plan} bundle={bundle} stress={sc.stress} status={status} />
        {plan.unplanned.length ? (
          <p className="font-mono text-[11px] text-muted">{plan.unplanned.map((u) => `r${u.ticker}: ${u.reason}`).join(" · ")}</p>
        ) : null}
      </section>

      <AIExplanation plan={basePlan} />

      <section aria-label="What if" className="grid gap-10 md:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col gap-4">
          <SystemLabel>What if</SystemLabel>
          <h2 className="text-3xl font-medium tracking-[-0.03em] md:text-4xl">Change a variable. Watch the plan respond.</h2>
          <div className="mt-2 grid grid-cols-2 gap-4 font-mono text-sm">
            <div>
              <SystemLabel>Your plan</SystemLabel>
              <div className="mt-1 tabular-nums">{bps(basePlan.totals.bps)}</div>
            </div>
            <div>
              <SystemLabel accent>This scenario</SystemLabel>
              <div className="mt-1 text-accent tabular-nums">{bps(plan.totals.bps)}</div>
            </div>
            <div>
              <SystemLabel>Buy all now</SystemLabel>
              <div className="mt-1 tabular-nums">{nowCost ? bps(nowCost.bps) : "n/a"}</div>
              <DataTag kind="OBSERVED" source="live book" />
            </div>
            <div>
              <SystemLabel>Scenario keeps</SystemLabel>
              <div className="mt-1 tabular-nums">{plan.savedUsd !== null ? usdCents(plan.savedUsd) : "n/a"}</div>
            </div>
          </div>
          {changed ? (
            <button type="button" onClick={() => setSc({ extra: 0, wait: 0, stress: 1, tranches: base.tranchesPerAsset })} className="self-start text-sm text-muted underline underline-offset-4 hover:text-fg">
              Back to my plan
            </button>
          ) : null}
        </div>
        <div className="flex flex-col gap-5">
          <Control q="What if I invest more?" value={sc.extra} onChange={(extra) => setSc({ ...sc, extra })} options={[{ v: 0, label: "as planned" }, { v: 0.5, label: "+50%" }, { v: 1, label: "2x" }, { v: 3, label: "4x" }]} />
          <Control q="What if I wait?" value={sc.wait} onChange={(wait) => setSc({ ...sc, wait })} options={[{ v: 0, label: "start now" }, { v: 6, label: "+6h" }, { v: 12, label: "+12h" }, { v: 24, label: "+1 day" }]} />
          <Control q="What if liquidity worsens?" value={sc.stress} onChange={(stress) => setSc({ ...sc, stress })} options={[{ v: 1, label: "as measured" }, { v: 1.5, label: "1.5x costs" }, { v: 2, label: "2x costs" }, { v: 3, label: "3x costs" }]} />
          <Control q="What if I split it more?" value={sc.tranches} onChange={(tranches) => setSc({ ...sc, tranches })} options={[1, 2, 3, 4, 6].map((n) => ({ v: n, label: `${n} per asset` }))} />
        </div>
      </section>

      <section aria-label="Review" className="grid gap-10 border-t border-white/[0.07] pt-12 md:grid-cols-[1.2fr_1fr] md:items-end">
        <div className="flex flex-col gap-4">
          <SystemLabel>Review plan</SystemLabel>
          <h2 className="text-statement font-medium">
            Nothing happens <span className="font-serif font-normal text-muted italic">until you confirm.</span>
          </h2>
        </div>
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4 font-mono">
            <div>
              <SystemLabel>Tranches</SystemLabel>
              <div className="mt-1 text-3xl tabular-nums">{plan.rows.length}</div>
            </div>
            <div>
              <SystemLabel>Total</SystemLabel>
              <div className="mt-1 text-3xl tabular-nums">{usd2(plan.totals.usd)}</div>
            </div>
          </div>
          {status === "PLANNED" ? (
            <button
              type="button"
              disabled={!plan.rows.length || busy}
              onClick={confirm}
              className="h-16 rounded-full bg-fg text-[16px] font-medium text-black transition-all hover:bg-accent-2 hover:shadow-[0_0_48px_-8px_var(--color-accent)] disabled:opacity-30"
            >
              {busy ? "Simulating against the live book..." : "Confirm plan"}
            </button>
          ) : (
            <div className="pop flex h-16 items-center justify-center gap-3 rounded-full border border-exec/50 text-exec">
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                <path d="M3.5 9.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="1.8" />
              </svg>
              Ready. Simulated, nothing was sent.
            </div>
          )}
          <p className="text-sm text-muted">You remain in control of every order. Execution here is simulated against Bitget&apos;s live order book.</p>
        </div>
      </section>

      {report ? (
        <section aria-label="Simulated fills" className="fade-in flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <SystemLabel>Simulated fills · against the live book now</SystemLabel>
            <DataTag kind="SIMULATED" />
          </div>
          <ul className="flex flex-col">
            {report.fills.map((f, i) => (
              <li key={i} className="rise grid grid-cols-[1fr_auto] gap-4 border-t border-white/[0.07] py-3 font-mono text-sm" style={{ ["--d" as string]: `${i * 50}ms` }}>
                <span>
                  r{f.ticker} {usd2(f.usd)} <span className="text-muted">· window {watTime(f.t)}</span>
                  <span className="block text-[11px] text-muted">{f.qty !== null ? `${f.qty.toFixed(4)} @ ${usd2(f.simPrice!)}` : f.note}</span>
                </span>
                <span className="text-right tabular-nums">
                  {bps(f.simBps)}
                  <span className="block text-[11px] text-muted">plan {bps(f.plannedBps)}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">
            {report.method} Logged as {report.id}.
          </p>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-6 border-t border-white/[0.07] pt-8 text-sm">
        <Link href="/replay" className="rounded-full border border-white/15 px-5 py-3 hover:border-accent/60">
          Would this have helped? →
        </Link>
        <button type="button" onClick={onRestart} className="text-muted underline underline-offset-4 hover:text-fg">
          Start a new payday
        </button>
      </div>
    </div>
  );
}
