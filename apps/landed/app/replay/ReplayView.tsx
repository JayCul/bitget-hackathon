"use client";
import { DataTag } from "@desk/ui";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { investableOf } from "@/components/SetupSequence";
import { SystemLabel } from "@/components/system";
import type { BacktestResult, PeriodResult } from "@/lib/backtest";
import { bps, usdCents, wat, watDay } from "@/lib/format";
import { allocate } from "@/lib/money";
import { regimeAt, REGIME_LABEL, type Regime } from "@/lib/regime";
import { paydayStart } from "@/lib/payday";
import { useLanded } from "@/lib/store";

type Result = BacktestResult & {
  failures: { ticker: string; message: string }[];
  spreads: Record<string, Partial<Record<Regime, number>>>;
  model: { samples: number; from: number | null; to: number | null };
  input: { windowHours: number; tranchesPerAsset: number; assets: { ticker: string; usd: number }[]; anchor: number; periods: number };
};

const H = 3_600_000;
const SAMPLE = { windowHours: 168, tranchesPerAsset: 2, assets: [{ ticker: "NVDA", usd: 95 }, { ticker: "AAPL", usd: 95 }, { ticker: "SPY", usd: 95 }] };

/** Weighted half-spread share of a set of legs, from measured medians. */
function spreadCost(legs: { ticker: string; usd: number; regime: string }[], spreads: Result["spreads"]) {
  let usd = 0;
  let acc = 0;
  for (const l of legs) {
    const s = spreads[l.ticker]?.[l.regime as Regime];
    if (s === undefined) return null;
    usd += l.usd;
    acc += (l.usd * s) / 2;
  }
  return usd ? acc / usd : null;
}

/** One past week as an execution line: market-state bands, the lump-sum point, the plan's windows. */
function WeekLine({ p, hours }: { p: PeriodResult; hours: number }) {
  const W = 700;
  const x = (t: number) => 8 + ((t - p.start) / (hours * H)) * (W - 16);
  const bands: { a: number; b: number; r: Regime }[] = [];
  for (let t = p.start; t < p.start + hours * H; t += H) {
    const r = regimeAt(t + H / 2);
    const last = bands.at(-1);
    if (last && last.r === r) last.b = t + H;
    else bands.push({ a: t, b: t + H, r });
  }
  const shade: Record<Regime, number> = { session: 0.02, extended: 0.05, overnight: 0.09, weekend: 0.13 };
  const times = [...new Set(p.rows.map((r) => r.t))];
  return (
    <svg viewBox={`0 0 ${W} 34`} className="h-8 w-full" aria-label={`Week of ${watDay(p.start)}: lump sum at the start, plan windows later`}>
      {bands.map((b, i) => (
        <rect key={i} x={x(b.a)} y="6" width={Math.max(0.5, x(b.b) - x(b.a))} height="22" fill="#F5F5F5" fillOpacity={shade[b.r]} />
      ))}
      <line x1="8" x2={W - 8} y1="17" y2="17" stroke="#F5F5F5" strokeOpacity="0.15" />
      <line x1={x(p.start)} x2={x(Math.max(...times))} y1="17" y2="17" stroke="#E8A34A" strokeOpacity="0.7" className="draw" style={{ ["--len" as string]: 700 }} />
      <circle cx={x(p.start)} cy="17" r="4.5" fill="#050505" stroke="#8A8A8A" strokeWidth="1.5" />
      {times.map((t) => (
        <circle key={t} cx={x(t)} cy="17" r="4" fill="#E8A34A" stroke="#050505" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

export function ReplayView() {
  const { setup } = useLanded();
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const mine = setup.ngnPerUsd && setup.salaryNgn && setup.basket.length;
  const input = useMemo(
    () =>
      mine
        ? {
            windowHours: setup.windowHours,
            tranchesPerAsset: setup.tranchesPerAsset,
            assets: allocate(investableOf(setup).usd, setup.basket.map((t) => ({ ticker: t, weight: 1 }))),
          }
        : SAMPLE,
    [mine, setup],
  );

  useEffect(() => {
    if (!hydrated) return;
    let off = false;
    setRes(null);
    setErr(null);
    fetch("/api/replay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, periods: 8, anchor: paydayStart(setup.payday) }) })
      .then(async (r) => ({ ok: r.ok, body: await r.json() }))
      .then(({ ok, body }) => !off && (ok ? setRes(body) : setErr(body.error ?? "Replay failed")))
      .catch((e) => !off && setErr(String(e)));
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, hydrated, setup.payday]);

  const stats = useMemo(() => {
    if (!res?.periods.length) return null;
    const lumpSpread = res.periods.map((p) => spreadCost(p.baselineLegs, res.spreads));
    const planSpread = res.periods.map((p) => spreadCost(p.rows, res.spreads));
    const avg = (xs: (number | null)[]) => (xs.every((x) => x !== null) ? xs.reduce((s, x) => s + x!, 0) / xs.length : null);
    const allRows = res.periods.flatMap((p) => p.rows);
    const worst = allRows.reduce((a, r) => (r.bps > a.bps ? r : a), allRows[0]!);
    const best = allRows.reduce((a, r) => (r.bps < a.bps ? r : a), allRows[0]!);
    return { lumpSpread: avg(lumpSpread), planSpread: avg(planSpread), worst, best };
  }, [res]);

  return (
    <div className="flex flex-col gap-16 md:gap-20">
      <header className="fade-in flex flex-col gap-6">
        <SystemLabel accent>History · backtested</SystemLabel>
        <h1 className="text-statement max-w-4xl font-medium">
          Would this have <span className="font-serif font-normal italic">helped?</span>
        </h1>
        <p className="max-w-xl text-[17px] leading-relaxed text-muted">
          Replay historical execution windows. The same budget and the same rules, run on each of the last 8 weeks at this weekday and time.
          {mine ? "" : " Using a sample basket until you set up your payday."}
        </p>
      </header>

      {!res ? (
        <div className="flex flex-col gap-3 font-mono text-sm text-muted">
          <span className="pulse-dot">{err ? `Replay unavailable: ${err}` : "Replaying past weeks on Bitget 1h bars..."}</span>
        </div>
      ) : !res.avg || !stats ? (
        <p className="border-l-2 border-white/15 pl-5 text-muted">No week could be replayed yet. {res.skipped[0]?.reason ?? ""}</p>
      ) : (
        <>
          <section aria-label="Lump sum vs Landed" className="grid gap-px overflow-hidden rounded-sm border border-white/[0.07] bg-white/[0.07] md:grid-cols-2">
            {[
              { k: "Lump sum", sub: "Everything at payday", cost: res.avg.baselineBps, spread: stats.lumpSpread, tranches: res.input.assets.length, hot: false },
              { k: "Landed plan", sub: "Tranches in measured windows", cost: res.avg.planBps, spread: stats.planSpread, tranches: res.periods[0]!.orders, hot: true },
            ].map((c) => (
              <div key={c.k} className="flex flex-col gap-8 bg-bg p-6 md:p-10">
                <div className="flex items-baseline justify-between">
                  <SystemLabel accent={c.hot}>{c.k}</SystemLabel>
                  <span className="text-xs text-muted">{c.sub}</span>
                </div>
                <div>
                  <div className={`font-mono text-5xl tracking-tight tabular-nums md:text-6xl ${c.hot ? "text-accent" : ""}`}>{bps(c.cost)}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <SystemLabel>Estimated execution cost</SystemLabel>
                    <DataTag kind="BACKTESTED" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 font-mono text-sm">
                  <div>
                    <SystemLabel>Spread cost</SystemLabel>
                    <div className="mt-1 tabular-nums">{bps(c.spread)}</div>
                  </div>
                  <div>
                    <SystemLabel>Orders</SystemLabel>
                    <div className="mt-1 tabular-nums">{c.tranches}</div>
                  </div>
                </div>
              </div>
            ))}
          </section>

          <section aria-label="Summary" className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <div className="flex flex-col items-start gap-2">
              <SystemLabel>Kept per payday</SystemLabel>
              <span className="font-mono text-2xl text-accent tabular-nums">{usdCents(res.avg.costSavedUsd)}</span>
              <DataTag kind="ESTIMATED" />
            </div>
            <div className="flex flex-col items-start gap-2">
              <SystemLabel>Price effect of waiting</SystemLabel>
              <span className="font-mono text-2xl tabular-nums">{bps(res.avg.priceEffectBps)}</span>
              <DataTag kind="BACKTESTED" source="Bitget 1h" />
            </div>
            <div className="flex flex-col items-start gap-2">
              <SystemLabel>Best window</SystemLabel>
              <span className="font-mono text-2xl tabular-nums">{bps(stats.best.bps)}</span>
              <span className="text-[11px] text-muted">
                r{stats.best.ticker} · {REGIME_LABEL[stats.best.regime as Regime]}
              </span>
            </div>
            <div className="flex flex-col items-start gap-2">
              <SystemLabel>Worst window used</SystemLabel>
              <span className="font-mono text-2xl tabular-nums">{bps(stats.worst.bps)}</span>
              <span className="text-[11px] text-muted">
                r{stats.worst.ticker} · {REGIME_LABEL[stats.worst.regime as Regime]}
              </span>
            </div>
          </section>

          <section aria-label="Past weeks" className="flex flex-col gap-2">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <SystemLabel>Each past payday, through real market conditions</SystemLabel>
              <span className="flex items-center gap-4 font-mono text-[10px] text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full border border-muted" /> lump sum
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-accent" /> Landed windows
                </span>
                <span>darker band = thinner market</span>
              </span>
            </div>
            {res.periods.map((p, i) => (
              <div key={p.start} className="reveal grid grid-cols-[72px_1fr] items-center gap-3 border-t border-white/[0.06] py-3 md:grid-cols-[110px_1fr_170px]" style={{ ["--d" as string]: `${i * 60}ms` }}>
                <span className="font-mono text-[11px] text-muted">{wat(p.start, { day: "numeric", month: "short" })}</span>
                <WeekLine p={p} hours={res.input.windowHours} />
                <span className="col-span-2 flex justify-between font-mono text-[11px] tabular-nums md:col-span-1 md:flex-col md:items-end">
                  <span className="text-accent">kept {bps(p.costSavedBps)}</span>
                  <span className="text-muted">price {bps(p.priceEffectBps)}</span>
                </span>
              </div>
            ))}
          </section>

          <p className="max-w-3xl border-l-2 border-accent/50 pl-5 text-[15px] leading-relaxed text-muted">
            Backtested historical replay. Not live savings. Costs are medians measured from {res.model.samples} Bitget order-book samples, applied
            to each past hour by its market state. Price effect compares the hourly price at each window with the price at payday, from Bitget 1h
            bars. It is timing luck, positive or negative, and is kept apart so it is never mistaken for skill.
          </p>
          {res.skipped.length ? <p className="font-mono text-[11px] text-muted">Skipped: {res.skipped.map((s) => `${watDay(s.start)} (${s.reason})`).join(" · ")}</p> : null}
        </>
      )}

      <Link href="/plan" className="self-start rounded-full bg-fg px-7 py-3.5 text-[15px] font-medium text-black hover:bg-accent-2">
        Build my plan
      </Link>
    </div>
  );
}
