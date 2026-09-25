"use client";
import { ChartFrame, DataTag, ResearchLoader } from "@desk/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BacktestResult } from "@/lib/backtest";
import { bps, usdCents, watDay } from "@/lib/format";
import { allocate, investable } from "@/lib/money";
import { useLanded } from "@/lib/store";

type Result = BacktestResult & {
  failures: { ticker: string; message: string }[];
  model: { samples: number; from: number | null; to: number | null };
  input: { windowHours: number; tranchesPerAsset: number; assets: { ticker: string; usd: number }[]; anchor: number; periods: number };
};

const FALLBACK = { windowHours: 24, tranchesPerAsset: 2, assets: [{ ticker: "NVDA", usd: 200 }, { ticker: "AAPL", usd: 200 }, { ticker: "SPY", usd: 150 }] };

function Big({ label, value, tag, accent }: { label: string; value: string; tag: React.ReactNode; accent?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs text-muted">{label}</span>
      <span className={`font-mono text-2xl tracking-tight tabular-nums ${accent ? "text-accent" : ""}`}>{value}</span>
      {tag}
    </div>
  );
}

export function ReplayView() {
  const { plan, setup } = useLanded();
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const input = plan
    ? { windowHours: plan.plan.input.windowHours, tranchesPerAsset: plan.plan.input.tranchesPerAsset, assets: plan.plan.input.assets }
    : setup.ngnPerUsd && setup.salaryNgn
      ? {
          windowHours: setup.windowHours,
          tranchesPerAsset: setup.tranchesPerAsset,
          assets: allocate(investable(setup.salaryNgn, setup.bills, setup.ngnPerUsd).investableUsd, setup.basket.map((t) => ({ ticker: t, weight: 1 }))),
        }
      : FALLBACK;
  const anchor = plan?.plan.input.start;
  const key = JSON.stringify(input) + anchor;

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    setRes(null);
    setErr(null);
    fetch("/api/replay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, anchor, periods: 8 }) })
      .then(async (r) => ({ ok: r.ok, body: await r.json() }))
      .then(({ ok, body }) => !cancelled && (ok ? setRes(body) : setErr(body.error ?? "Replay failed")))
      .catch((e) => !cancelled && setErr(String(e)));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, hydrated]);

  const header = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">Replay</span>
        <DataTag kind="BACKTESTED" />
      </div>
      <h1 className="text-title font-medium">Did the plan actually help?</h1>
      <p className="text-sm leading-relaxed text-muted">
        The same budget and plan rules, run on each of the last 8 weeks at the same weekday and time.
        {plan ? "" : " Using your setup or a sample basket until you build a plan."}
      </p>
    </div>
  );

  if (!res) {
    return (
      <div className="flex flex-col gap-10">
        {header}
        <ResearchLoader
          title="Replaying past weeks"
          steps={[
            { id: "bars", label: "Loading hourly prices for each week", call: "Bitget crypto_spot_kline · rToken 1h", state: err ? "failed" : "running" },
            { id: "cost", label: "Costing each plan from sampled order books", call: "Code", state: "pending" },
          ]}
        />
        {err ? <p className="text-sm text-red">{err}</p> : null}
      </div>
    );
  }

  const a = res.avg;
  const chart = res.periods.map((p) => ({
    label: watDay(p.start),
    cost: p.costSavedBps,
    price: p.priceEffectBps,
  }));

  return (
    <div className="flex flex-col gap-10">
      {header}
      {a ? (
        <>
          <div className="grid grid-cols-3 gap-4 border-y border-line py-5">
            <Big label="Buy at payday" value={bps(a.baselineBps)} tag={<DataTag kind="BACKTESTED" />} />
            <Big label="Landed" value={bps(a.planBps)} tag={<DataTag kind="BACKTESTED" />} accent />
            <Big label="Difference" value={bps(a.costSavedBps)} tag={<span className="font-mono text-[11px] text-muted">{usdCents(a.costSavedUsd)} per payday</span>} accent />
          </div>
          <ChartFrame
            title="Per week: cost saved vs price effect of waiting"
            kind="BACKTESTED"
            source="Bitget 1h bars + sampled books"
            height={220}
            caption="Backtested historical replay. Not live savings."
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2}>
                <XAxis dataKey="label" stroke="var(--color-line-strong)" fontSize={10} fontFamily="var(--font-mono)" tickLine={false} interval={0} angle={0} />
                <YAxis stroke="var(--color-line-strong)" fontSize={10} fontFamily="var(--font-mono)" tickLine={false} width={40} />
                <ReferenceLine y={0} stroke="var(--color-line-strong)" />
                <Bar dataKey="cost" name="Cost saved (bps)" fill="var(--color-accent)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="price" name="Price effect (bps)" radius={[2, 2, 0, 0]}>
                  {chart.map((c, i) => (
                    <Cell key={i} fill={c.price >= 0 ? "rgba(242,242,242,0.55)" : "rgba(138,138,138,0.35)"} />
                  ))}
                </Bar>
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="rounded-md border border-line-strong bg-raised-2 px-3 py-2 font-mono text-[11px] leading-5">
                        <div>{String(label)}</div>
                        <div className="text-accent">cost saved {bps(payload[0]?.value as number)}</div>
                        <div>price effect {bps(payload[1]?.value as number)}</div>
                      </div>
                    ) : null
                  }
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
          <div className="flex gap-5 text-xs text-muted">
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-sm bg-accent" /> Cost saved (spread and slippage)
            </span>
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-sm bg-fg/55" /> Price effect of waiting
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-line pt-5">
            <Big label="Avg price effect of waiting" value={bps(a.priceEffectBps)} tag={<DataTag kind="BACKTESTED" />} />
            <Big label="Weeks replayed" value={`${res.periods.length}/${res.input.periods}`} tag={<DataTag kind="COMPUTED" />} />
          </div>
          <p className="text-[13px] leading-relaxed text-muted">
            Cost saved uses median costs measured from {res.model.samples} Bitget order-book samples, applied to each past hour by its market
            state. Price effect compares the hourly price at each planned order with the price when the money landed, from Bitget 1h bars.
            Price effect is timing luck, positive or negative, and is shown separately so it is not mistaken for skill.
          </p>
        </>
      ) : (
        <p className="rounded-md border border-dashed border-line-strong p-4 text-sm text-muted">
          No week could be replayed yet. {res.skipped[0]?.reason ?? ""}
        </p>
      )}
      {res.skipped.length ? (
        <p className="font-mono text-[11px] text-muted">
          Skipped: {res.skipped.map((s) => `${watDay(s.start)} (${s.reason})`).join(" · ")}
        </p>
      ) : null}
      <Link href="/plan" className="inline-flex h-11 items-center self-start rounded-md border border-line-strong px-5 text-[15px] hover:border-accent/60">
        Back to my plan
      </Link>
    </div>
  );
}
