"use client";
import { DataTag } from "@desk/ui";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ngnFmt, usd2 } from "@/lib/format";
import { landed, useLanded, type Setup } from "@/lib/store";
import { SystemLabel, useCountUp } from "./system";

const ASSETS = [
  { ticker: "NVDA", name: "Nvidia" },
  { ticker: "AAPL", name: "Apple" },
  { ticker: "SPY", name: "S&P 500 ETF" },
  { ticker: "QQQ", name: "Nasdaq 100 ETF" },
  { ticker: "TSLA", name: "Tesla" },
  { ticker: "MSFT", name: "Microsoft" },
];

const digits = (s: string) => Number(s.replace(/[^\d.]/g, "")) || 0;

/** Deterministic payday arithmetic. The LLM never touches this. */
export function investableOf(s: Setup) {
  const ngn = Math.max(0, s.salaryNgn - s.billsNgn - s.bufferNgn);
  return { ngn, usd: s.ngnPerUsd ? ngn / s.ngnPerUsd : 0 };
}

/** Large editorial money input. */
export function PaydayInput({
  label,
  value,
  onChange,
  prefix = "₦",
  placeholder,
  hint,
  autoFocus,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  placeholder: string;
  hint?: ReactNode;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);
  return (
    <label className="group flex flex-col gap-3 border-b border-white/10 pb-4 transition-colors focus-within:border-accent/70">
      <SystemLabel>{label}</SystemLabel>
      <span className="flex items-baseline gap-2">
        <span className="text-[clamp(2rem,7vw,3.6rem)] leading-none font-medium tracking-[-0.04em] text-muted/70">{prefix}</span>
        <input
          ref={ref}
          inputMode="decimal"
          value={value ? value.toLocaleString("en-US") : ""}
          onChange={(e) => onChange(digits(e.target.value))}
          placeholder={placeholder}
          aria-label={label}
          className="w-full min-w-0 bg-transparent text-[clamp(2rem,7vw,3.6rem)] leading-none font-medium tracking-[-0.04em] text-fg tabular-nums outline-none placeholder:text-white/15"
        />
      </span>
      {hint ? <span className="text-xs leading-relaxed text-muted">{hint}</span> : null}
    </label>
  );
}

function Formula({ s }: { s: Setup }) {
  const inv = investableOf(s);
  const shown = useCountUp(inv.ngn, { ms: 700 });
  const row = (sign: string, label: string, v: number, strong?: boolean) => (
    <div className={`flex items-baseline justify-between gap-4 py-2 ${strong ? "border-t border-white/15 pt-4" : ""}`}>
      <span className={`font-mono text-[12px] tracking-[0.14em] uppercase ${strong ? "text-accent" : "text-muted"}`}>
        <span className="inline-block w-4">{sign}</span>
        {label}
      </span>
      <span className={`font-mono tabular-nums ${strong ? "text-2xl text-accent" : "text-base"}`}>{ngnFmt(v)}</span>
    </div>
  );
  return (
    <div className="flex flex-col" aria-live="polite">
      {row("", "Salary", s.salaryNgn)}
      {row("−", "Bills", s.billsNgn)}
      {row("−", "Safety buffer", s.bufferNgn)}
      {row("=", "Investable", shown, true)}
      <div className="mt-2 self-end">
        <DataTag kind="COMPUTED" />
      </div>
    </div>
  );
}

/** The cinematic reveal: the investable naira figure, then dollars at the rate the user entered. */
export function InvestableReveal({ s }: { s: Setup }) {
  const inv = investableOf(s);
  const ngn = useCountUp(inv.ngn, { ms: 1100 });
  const usd = useCountUp(inv.usd, { ms: 1300 });
  return (
    <div className="flex flex-col gap-4">
      <div className="text-figure font-medium tabular-nums">{ngnFmt(ngn)}</div>
      <div className="flex items-center gap-3">
        <SystemLabel accent>Investable</SystemLabel>
        <DataTag kind="COMPUTED" />
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-x-10 gap-y-4 border-t border-white/10 pt-5">
        <div>
          <div className="font-mono text-4xl tracking-tight text-accent tabular-nums">{s.ngnPerUsd ? usd2(usd) : "$ ?"}</div>
          <SystemLabel>In dollars</SystemLabel>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-lg tabular-nums">{s.ngnPerUsd ? `₦${s.ngnPerUsd.toLocaleString("en-US")} / USD` : "no rate yet"}</span>
          <span className="flex items-center gap-2">
            <SystemLabel>Rate</SystemLabel>
            <DataTag kind="ENTERED" />
          </span>
        </div>
      </div>
    </div>
  );
}

function Step({ i, children, title, kicker }: { i: number; children: ReactNode; title: ReactNode; kicker: string }) {
  return (
    <section className="fade-in flex flex-col gap-10" aria-label={kicker}>
      <div className="flex flex-col gap-4">
        <SystemLabel accent>
          {String(i).padStart(2, "0")} / 04 · {kicker}
        </SystemLabel>
        <h1 className="text-statement max-w-3xl font-medium">{title}</h1>
      </div>
      {children}
    </section>
  );
}

function Next({ children, disabled, onClick, ghost }: { children: ReactNode; disabled?: boolean; onClick: () => void; ghost?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-14 rounded-full px-8 text-[15px] font-medium transition-all disabled:opacity-30 ${
        ghost ? "border border-white/15 text-fg hover:border-white/40" : "bg-fg text-black hover:bg-accent-2 hover:shadow-[0_0_40px_-8px_var(--color-accent)]"
      }`}
    >
      {children}
    </button>
  );
}

export function SetupSequence({ onBuild, busy }: { onBuild: () => void; busy: boolean }) {
  const { setup: s } = useLanded();
  const [step, setStep] = useState(1);
  const inv = investableOf(s);
  const now = new Date();

  return (
    <div className="flex flex-col gap-12">
      {step === 1 ? (
        <Step i={1} kicker="Payday" title={<>Let&apos;s see what actually landed.</>}>
          <div className="flex items-center gap-4 border-y border-white/[0.07] py-4 font-mono text-[12px]">
            <span className="size-2 rounded-full bg-accent shadow-[0_0_12px_var(--color-accent)]" />
            <span className="text-muted">CREDIT ALERT</span>
            <span>NGN 850,000.00</span>
            <span className="hidden text-muted sm:inline">SALARY SEPT 2026</span>
            <span className="ml-auto">
              <DataTag kind="DEMO" />
            </span>
          </div>
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr]">
            <PaydayInput label="Salary" value={s.salaryNgn} onChange={(v) => landed.setSetup({ salaryNgn: v })} placeholder="850,000" autoFocus />
            <div className="flex flex-col gap-3 border-b border-white/10 pb-4">
              <SystemLabel>Payday</SystemLabel>
              <span className="text-[clamp(1.6rem,4vw,2.4rem)] leading-none font-medium tracking-[-0.03em]">
                Today, {now.toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="text-xs text-muted">WAT. Your plan starts from now.</span>
            </div>
          </div>
          <div>
            <Next disabled={!s.salaryNgn} onClick={() => setStep(2)}>
              Continue
            </Next>
          </div>
        </Step>
      ) : step === 2 ? (
        <Step i={2} kicker="Untouched" title="Now decide what deserves it.">
          <div className="grid gap-12 md:grid-cols-[1.3fr_1fr]">
            <div className="flex flex-col gap-10">
              <PaydayInput label="Bills before next payday" value={s.billsNgn} onChange={(v) => landed.setSetup({ billsNgn: v })} placeholder="280,000" autoFocus />
              <PaydayInput label="Safety buffer" value={s.bufferNgn} onChange={(v) => landed.setSetup({ bufferNgn: v })} placeholder="150,000" />
            </div>
            <Formula s={s} />
          </div>
          <div className="flex gap-3">
            <Next ghost onClick={() => setStep(1)}>
              Back
            </Next>
            <Next disabled={inv.ngn <= 0} onClick={() => setStep(3)}>
              Continue
            </Next>
          </div>
        </Step>
      ) : step === 3 ? (
        <Step i={3} kicker="Investable" title="This is what can work for you.">
          <div className="grid gap-12 md:grid-cols-[1.5fr_1fr] md:items-end">
            <InvestableReveal s={s} />
            <PaydayInput
              label="Your rate, ₦ per $1"
              value={s.ngnPerUsd ?? 0}
              onChange={(v) => landed.setSetup({ ngnPerUsd: v || null })}
              placeholder="1,480"
              autoFocus
              hint="Bitget has no naira market, so Landed uses the rate you get. It is never guessed."
            />
          </div>
          <div className="flex gap-3">
            <Next ghost onClick={() => setStep(2)}>
              Back
            </Next>
            <Next disabled={!s.ngnPerUsd || inv.usd < 10} onClick={() => setStep(4)}>
              Continue
            </Next>
          </div>
        </Step>
      ) : (
        <Step i={4} kicker="Basket" title="Where should it go?">
          <ul className="flex flex-col border-t border-white/[0.07]">
            {ASSETS.map((a) => {
              const on = s.basket.includes(a.ticker);
              return (
                <li key={a.ticker}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => landed.setSetup({ basket: on ? s.basket.filter((t) => t !== a.ticker) : [...s.basket, a.ticker] })}
                    className="group flex w-full items-center gap-5 border-b border-white/[0.07] py-5 text-left"
                  >
                    <span className={`size-2.5 rounded-full border transition-colors ${on ? "border-accent-2 bg-accent" : "border-white/30"}`} />
                    <span className={`font-mono text-2xl tracking-tight transition-colors md:text-3xl ${on ? "text-fg" : "text-muted/60 group-hover:text-muted"}`}>
                      r{a.ticker}
                    </span>
                    <span className="text-sm text-muted">{a.name}</span>
                    <span className="ml-auto font-mono text-sm text-muted tabular-nums">
                      {on && s.basket.length ? usd2(inv.usd / s.basket.length) : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="grid gap-8 sm:grid-cols-2">
            <div className="flex flex-col gap-3">
              <SystemLabel>Orders per asset</SystemLabel>
              <div className="flex gap-2" role="radiogroup" aria-label="Orders per asset">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    role="radio"
                    aria-checked={s.tranchesPerAsset === n}
                    onClick={() => landed.setSetup({ tranchesPerAsset: n })}
                    className={`size-12 rounded-full border font-mono transition-colors ${s.tranchesPerAsset === n ? "border-accent bg-accent text-black" : "border-white/15 text-muted hover:text-fg"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <SystemLabel>Window</SystemLabel>
              <div className="flex gap-2" role="radiogroup" aria-label="Execution window">
                {([
                  [24, "Next 24 hours"],
                  [168, "Payday week"],
                ] as const).map(([h, l]) => (
                  <button
                    key={h}
                    role="radio"
                    aria-checked={s.windowHours === h}
                    onClick={() => landed.setSetup({ windowHours: h })}
                    className={`h-12 rounded-full border px-5 text-sm transition-colors ${s.windowHours === h ? "border-accent bg-accent text-black" : "border-white/15 text-muted hover:text-fg"}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Next ghost onClick={() => setStep(3)}>
              Back
            </Next>
            <Next disabled={!s.basket.length || busy} onClick={onBuild}>
              {busy ? "Reading the order books..." : "Build my plan"}
            </Next>
          </div>
        </Step>
      )}
    </div>
  );
}
