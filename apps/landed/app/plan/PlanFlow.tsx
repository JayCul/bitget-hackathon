"use client";
import { useState } from "react";
import { PlanStage } from "@/components/PlanStage";
import { SetupSequence, investableOf } from "@/components/SetupSequence";
import { SystemLabel } from "@/components/system";
import { allocate } from "@/lib/money";
import type { PlanInput } from "@/lib/plan";
import { peek } from "@/lib/store";
import type { MarketBundle } from "@/lib/types";

export function PlanFlow() {
  const [ready, setReady] = useState<{ bundle: MarketBundle; base: PlanInput } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function build() {
    const s = peek().setup;
    const usd = investableOf(s).usd;
    const assets = allocate(usd, s.basket.map((t) => ({ ticker: t, weight: 1 })));
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/market?tickers=${s.basket.join(",")}`);
      const bundle = await res.json();
      if (!res.ok) throw new Error(bundle.error ?? res.statusText);
      setReady({ bundle, base: { start: Date.now(), windowHours: s.windowHours, tranchesPerAsset: s.tranchesPerAsset, assets } });
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (ready) return <PlanStage bundle={ready.bundle} base={ready.base} onRestart={() => setReady(null)} />;
  return (
    <>
      <SetupSequence busy={busy} onBuild={build} />
      {error ? (
        <p role="alert" className="mt-6 font-mono text-sm text-red">
          <SystemLabel className="!text-red">Market data unavailable</SystemLabel> {error}
        </p>
      ) : null}
    </>
  );
}
