"use client";
import { DataTag } from "@desk/ui";
import { useMemo, useState, useEffect } from "react";
import { bps, usd2, usdCents } from "@/lib/format";
import { DEMO_PAYDAY } from "@/lib/demo";
import { makePlan } from "@/lib/insight";
import type { MarketBundle } from "@/lib/types";
import { ExecutionTimeline } from "./ExecutionTimeline";
import { SystemLabel } from "./system";


export function DemoPlan({ bundle }: { bundle: MarketBundle }) {
  // Start from the moment the page is viewed, so the plan is always forward-looking.
  const [start, setStart] = useState<number | null>(null);
  useEffect(() => setStart(Date.now()), []);
  const usd = (DEMO_PAYDAY.salary - DEMO_PAYDAY.bills - DEMO_PAYDAY.buffer) / DEMO_PAYDAY.rate;
  const plan = useMemo(
    () =>
      start === null
        ? null
        : makePlan(bundle, {
            start,
            windowHours: 168,
            tranchesPerAsset: 2,
            assets: bundle.tickers.map((t) => ({ ticker: t, usd: usd / bundle.tickers.length })),
          }),
    [bundle, start, usd],
  );
  if (!plan) return <div className="h-72" />;
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {[
          ["Investing", usd2(plan.input.assets.reduce((s, a) => s + a.usd, 0)), <DataTag key="t" kind="DEMO" />],
          ["All at once", bps(plan.baseline.bps), <DataTag key="t" kind="ESTIMATED" />],
          ["Landed", bps(plan.totals.bps), <DataTag key="t" kind="ESTIMATED" />],
          ["You keep", plan.savedUsd !== null ? usdCents(plan.savedUsd) : "n/a", <DataTag key="t" kind="ESTIMATED" />],
        ].map(([l, v, tag], i) => (
          <div key={i} className="flex flex-col items-start gap-2">
            <SystemLabel>{l}</SystemLabel>
            <span className={`font-mono text-2xl tracking-tight tabular-nums ${i >= 2 ? "text-accent" : ""}`}>{v}</span>
            {tag}
          </div>
        ))}
      </div>
      <ExecutionTimeline plan={plan} bundle={bundle} interactive />
    </div>
  );
}
