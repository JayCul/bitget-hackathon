"use client";
import { useEffect, useState } from "react";
import { PlanView } from "@/components/PlanView";
import { AlertCard, SetupFlow } from "@/components/Setup";
import type { PlanResponse } from "@/lib/types";
import { landed, peek, useLanded } from "@/lib/store";

type View = "alert" | "setup" | "plan";

export function PlanFlow() {
  const { plan } = useLanded();
  const [view, setView] = useState<View>("alert");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Returning visitors land on their last plan.
  useEffect(() => {
    if (peek().plan) setView("plan");
  }, []);

  async function build(windowHours: number, tranchesPerAsset: number, assets: { ticker: string; usd: number }[]) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ windowHours, tranchesPerAsset, assets }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      landed.setPlan(body as PlanResponse);
      setView("plan");
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (view === "plan" && plan) {
    return (
      <PlanView
        key={plan.generatedAt}
        data={plan}
        onReset={() => {
          landed.setPlan(null);
          setView("setup");
        }}
      />
    );
  }
  if (view === "alert") {
    return (
      <AlertCard
        onPlan={(ngn) => {
          if (!peek().setup.salaryNgn) landed.setSetup({ salaryNgn: ngn });
          setView("setup");
        }}
      />
    );
  }
  return (
    <>
      <SetupFlow busy={busy} onDone={(s, assets) => build(s.windowHours, s.tranchesPerAsset, assets)} />
      {error ? (
        <p role="alert" className="mt-4 text-sm text-red">
          {error}
        </p>
      ) : null}
    </>
  );
}
