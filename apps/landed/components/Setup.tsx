"use client";
import { Button, DataTag } from "@desk/ui";
import { useState, type ReactNode } from "react";
import { ngnFmt, usd2 } from "@/lib/format";
import { allocate, investable } from "@/lib/money";
import { landed, useLanded, type Setup as SetupT } from "@/lib/store";

const ASSETS = [
  { ticker: "NVDA", name: "Nvidia" },
  { ticker: "AAPL", name: "Apple" },
  { ticker: "SPY", name: "S&P 500 ETF" },
  { ticker: "QQQ", name: "Nasdaq 100 ETF" },
  { ticker: "TSLA", name: "Tesla" },
  { ticker: "MSFT", name: "Microsoft" },
];

const num = (s: string) => Number(s.replace(/[^\d.]/g, "")) || 0;

/** Simulated bank credit alert, the demo's opening moment. */
export function AlertCard({ onPlan }: { onPlan: (ngn: number) => void }) {
  const amount = 850_000;
  const now = new Date();
  return (
    <div className="rise flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">Simulated bank alert</span>
        <span className="font-mono text-[11px] text-muted">{now.toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit" })} WAT</span>
      </div>
      <div className="rounded-md border border-line bg-raised p-5 shadow-[0_20px_60px_-30px_rgba(232,163,74,0.35)]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Credit Alert</span>
          <span className="rounded-sm bg-accent-dim px-1.5 py-px font-mono text-[10px] text-accent">CR</span>
        </div>
        <dl className="mt-4 grid grid-cols-[88px_1fr] gap-y-1.5 font-mono text-[13px]">
          <dt className="text-muted">Acct</dt>
          <dd>******4821</dd>
          <dt className="text-muted">Amt</dt>
          <dd className="text-accent">NGN {amount.toLocaleString("en-US")}.00</dd>
          <dt className="text-muted">Desc</dt>
          <dd>SALARY SEPT 2026</dd>
        </dl>
      </div>
      <div className="flex flex-col gap-3">
        <h1 className="text-title font-medium">Alert don land.</h1>
        <p className="text-muted">Before you buy anything, see what the timing will cost you.</p>
      </div>
      <Button onClick={() => onPlan(amount)}>Build my plan</Button>
    </div>
  );
}

function Step({ n, of, title, children }: { n: number; of: number; title: string; children: ReactNode }) {
  return (
    <section className="fade-in flex flex-col gap-6" aria-label={title}>
      <div className="flex items-center gap-2">
        {Array.from({ length: of }, (_, i) => (
          <span key={i} aria-hidden className={`h-[3px] flex-1 rounded-full ${i < n ? "bg-accent" : "bg-line-strong"}`} />
        ))}
      </div>
      <h1 className="text-title font-medium">{title}</h1>
      {children}
    </section>
  );
}

const field = "h-14 w-full rounded-md border border-line bg-raised px-4 font-mono text-2xl text-fg outline-none focus:border-accent/60";

export function SetupFlow({ onDone, busy }: { onDone: (s: SetupT, assets: { ticker: string; usd: number }[]) => void; busy: boolean }) {
  const { setup } = useLanded();
  const [step, setStep] = useState(1);
  const inv = investable(setup.salaryNgn, setup.bills, setup.ngnPerUsd ?? 0);
  const rateOk = (setup.ngnPerUsd ?? 0) > 0;
  const assets = allocate(inv.investableUsd, setup.basket.map((t) => ({ ticker: t, weight: 1 })));

  return (
    <div className="flex flex-col gap-8">
      <div className="sticky top-14 z-10 -mx-4 flex items-end justify-between gap-4 border-b border-line bg-bg/90 px-4 py-4 backdrop-blur-md md:-mx-6 md:px-6">
        <div>
          <div className="text-xs text-muted">Investable</div>
          <div className="font-mono text-3xl tracking-tight text-accent tabular-nums">{rateOk ? usd2(inv.investableUsd) : "$ ?"}</div>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <DataTag kind="COMPUTED" />
          <span className="font-mono text-[11px] text-muted">
            {ngnFmt(inv.investableNgn)} at {rateOk ? `₦${setup.ngnPerUsd!.toLocaleString("en-US")}/$` : "your rate"}
          </span>
        </div>
      </div>

      {step === 1 ? (
        <Step n={1} of={3} title="How much landed?">
          <label className="flex flex-col gap-2">
            <span className="text-sm text-muted">Salary received (₦)</span>
            <input
              inputMode="numeric"
              className={field}
              value={setup.salaryNgn ? setup.salaryNgn.toLocaleString("en-US") : ""}
              onChange={(e) => landed.setSetup({ salaryNgn: num(e.target.value) })}
              placeholder="850,000"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-muted">Your rate: ₦ per $1</span>
            <input
              inputMode="decimal"
              className={`${field} text-xl`}
              value={setup.ngnPerUsd ?? ""}
              onChange={(e) => landed.setSetup({ ngnPerUsd: num(e.target.value) || null })}
              placeholder="the rate your bank or P2P gives you"
            />
            <span className="text-xs leading-relaxed text-muted">
              Bitget has no naira market, so Landed uses the rate you enter. It is never guessed.
            </span>
          </label>
          <Button disabled={!setup.salaryNgn || !rateOk} onClick={() => setStep(2)}>
            Continue
          </Button>
        </Step>
      ) : step === 2 ? (
        <Step n={2} of={3} title="What stays untouched?">
          <p className="-mt-2 text-sm text-muted">Bills due before next payday, and a buffer. Only what is left gets invested.</p>
          <ul className="flex flex-col">
            {setup.bills.map((b) => (
              <li key={b.id} className="grid grid-cols-[1fr_150px] items-center gap-3 border-t border-line py-3 first:border-t-0">
                <input
                  aria-label="Bill name"
                  value={b.label}
                  onChange={(e) => landed.setSetup({ bills: setup.bills.map((x) => (x.id === b.id ? { ...x, label: e.target.value } : x)) })}
                  className="bg-transparent text-[15px] outline-none"
                />
                <input
                  aria-label={`${b.label} amount in naira`}
                  inputMode="numeric"
                  value={b.ngn ? b.ngn.toLocaleString("en-US") : ""}
                  placeholder="₦0"
                  onChange={(e) => landed.setSetup({ bills: setup.bills.map((x) => (x.id === b.id ? { ...x, ngn: num(e.target.value) } : x)) })}
                  className="h-11 rounded-md border border-line bg-raised px-3 text-right font-mono outline-none focus:border-accent/60"
                />
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="self-start text-sm text-muted underline underline-offset-4 hover:text-fg"
            onClick={() => landed.setSetup({ bills: [...setup.bills, { id: `b${Date.now()}`, label: "Other", ngn: 0 }] })}
          >
            Add a line
          </button>
          <div className="flex justify-between border-t border-line pt-4 font-mono text-sm">
            <span className="text-muted">Untouched</span>
            <span>{ngnFmt(inv.untouchedNgn)}</span>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button className="flex-1" disabled={inv.investableUsd < 10} onClick={() => setStep(3)}>
              Continue
            </Button>
          </div>
        </Step>
      ) : (
        <Step n={3} of={3} title="Where should the rest go?">
          <div className="grid grid-cols-2 gap-2">
            {ASSETS.map((a) => {
              const on = setup.basket.includes(a.ticker);
              return (
                <button
                  key={a.ticker}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    landed.setSetup({ basket: on ? setup.basket.filter((t) => t !== a.ticker) : [...setup.basket, a.ticker].slice(0, 6) })
                  }
                  className={`flex flex-col items-start gap-0.5 rounded-md border px-4 py-3 text-left transition-colors ${on ? "border-accent/60 bg-accent-dim/40" : "border-line hover:border-line-strong"}`}
                >
                  <span className="font-mono">r{a.ticker}</span>
                  <span className="text-xs text-muted">{a.name}</span>
                </button>
              );
            })}
          </div>
          {assets.length ? (
            <p className="font-mono text-xs text-muted">
              Equal split: {assets.map((a) => `r${a.ticker} ${usd2(a.usd)}`).join(" · ")}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm text-muted">Orders per asset</span>
              <select
                value={setup.tranchesPerAsset}
                onChange={(e) => landed.setSetup({ tranchesPerAsset: Number(e.target.value) })}
                className="h-11 rounded-md border border-line bg-raised px-3 font-mono outline-none"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm text-muted">Window</span>
              <select
                value={setup.windowHours}
                onChange={(e) => landed.setSetup({ windowHours: Number(e.target.value) as 24 | 168 })}
                className="h-11 rounded-md border border-line bg-raised px-3 outline-none"
              >
                <option value={24}>Next 24 hours</option>
                <option value={168}>Payday week</option>
              </select>
            </label>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button className="flex-1" disabled={!assets.length || busy} onClick={() => onDone(setup, assets)}>
              {busy ? "Reading the order books..." : "Build my plan"}
            </Button>
          </div>
        </Step>
      )}
    </div>
  );
}
