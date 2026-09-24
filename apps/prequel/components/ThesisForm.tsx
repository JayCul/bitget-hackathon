"use client";
import { Button, DataTag } from "@desk/ui";
import { useState, type FormEvent } from "react";
import { EXAMPLE_THESIS, REPLAY_LABEL, REPLAY_START } from "@/lib/prequel/steps";
import type { Direction, Mode, Thesis } from "@/lib/prequel/types";

const SUGGESTED = ["NVDA", "AMD", "AVGO", "MU", "TSM"];
const HORIZONS = [7, 14, 21, 28];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line bg-raised p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`rounded-[5px] px-4 py-2 text-sm transition-colors ${on ? "bg-raised-2 text-fg shadow-[inset_0_0_0_1px_var(--color-line-strong)]" : "text-muted hover:text-fg"}`}
          >
            {o.label}
            {o.hint ? <span className="ml-2 font-mono text-[10px] text-muted">{o.hint}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="grid gap-3 border-t border-line py-6 md:grid-cols-[200px_1fr] md:gap-8">
      <label htmlFor={htmlFor} className="pt-2 text-sm text-muted">
        {label}
        {hint ? <span className="mt-1 block text-xs text-muted/70">{hint}</span> : null}
      </label>
      <div>{children}</div>
    </div>
  );
}

const input =
  "w-full rounded-md border border-line bg-raised px-4 h-12 text-[15px] text-fg placeholder:text-muted/60 outline-none transition-colors focus:border-accent/60";

export function ThesisForm({ onSubmit, busy }: { onSubmit: (t: Thesis) => void; busy: boolean }) {
  const [ticker, setTicker] = useState("");
  const [direction, setDirection] = useState<Direction>("long");
  const [horizon, setHorizon] = useState(21);
  const [size, setSize] = useState("10000");
  const [text, setText] = useState("");
  const [mode, setMode] = useState<Mode>("replay");
  const [error, setError] = useState<string | null>(null);

  function fillExample() {
    setTicker(EXAMPLE_THESIS.ticker);
    setDirection(EXAMPLE_THESIS.direction);
    setHorizon(EXAMPLE_THESIS.horizonDays);
    setSize(String(EXAMPLE_THESIS.sizeUsd));
    setText(EXAMPLE_THESIS.text);
    setMode("replay");
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const t = ticker.trim().toUpperCase();
    const s = Number(size.replace(/[^\d.]/g, ""));
    if (!/^[A-Z.]{1,10}$/.test(t)) return setError("Enter a US ticker, e.g. NVDA.");
    if (!s || s <= 0) return setError("Enter a position size in USD.");
    if (text.trim().length < 10) return setError("Write the thesis in a sentence or two.");
    setError(null);
    onSubmit({
      ticker: t,
      direction,
      horizonDays: horizon,
      sizeUsd: s,
      text: text.trim(),
      asOf: mode === "replay" ? REPLAY_START : today(),
      mode,
    });
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-3xl">
      <Field label="Ticker" htmlFor="ticker" hint="US stock with a Bitget rToken">
        <div className="flex flex-col gap-3">
          <input
            id="ticker"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="NVDA"
            autoComplete="off"
            spellCheck={false}
            className={`${input} max-w-[220px] font-mono text-lg tracking-wide uppercase`}
          />
          <div className="flex flex-wrap gap-2">
            {SUGGESTED.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setTicker(s)}
                className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${ticker === s ? "border-accent/60 text-accent" : "border-line text-muted hover:border-line-strong hover:text-fg"}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </Field>

      <Field label="Direction">
        <Segmented
          label="Direction"
          value={direction}
          onChange={setDirection}
          options={[
            { value: "long", label: "Long" },
            { value: "short", label: "Short" },
          ]}
        />
      </Field>

      <Field label="Horizon">
        <Segmented
          label="Horizon"
          value={horizon}
          onChange={setHorizon}
          options={HORIZONS.map((d) => ({ value: d, label: `${d / 7} wk` }))}
        />
      </Field>

      <Field label="Position" htmlFor="size" hint="USD">
        <input
          id="size"
          inputMode="decimal"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          className={`${input} max-w-[220px] font-mono`}
        />
      </Field>

      <Field label="Thesis" htmlFor="thesis" hint="Why you think it works">
        <textarea
          id="thesis"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={600}
          placeholder="Long NVDA into earnings. Hyperscaler capex should drive a data center beat."
          className={`${input} h-auto resize-none py-3 leading-relaxed`}
        />
        <button type="button" onClick={fillExample} className="mt-3 text-sm text-muted underline decoration-line-strong underline-offset-4 hover:text-fg">
          Use the NVDA example
        </button>
      </Field>

      <Field label="Data as of" hint="Replay mode hides everything after this date">
        <div className="flex flex-col gap-3">
          <Segmented
            label="Data as of"
            value={mode}
            onChange={setMode}
            options={[
              { value: "replay", label: `Demo replay · ${REPLAY_LABEL}` },
              { value: "live", label: "Live · today" },
            ]}
          />
          <p className="max-w-lg text-[13px] leading-relaxed text-muted">
            {mode === "replay" ? (
              <>
                Research uses only data before {REPLAY_LABEL}. Afterwards, a recorded Bitget sequence of prices, earnings, analyst notes and
                news plays through your tripwires. <DataTag kind="DEMO REPLAY" className="ml-1 align-middle" />
              </>
            ) : (
              <>Research uses everything up to today. Tripwires can be set, but there is no future data to replay yet.</>
            )}
          </p>
        </div>
      </Field>

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-8">
        <Button type="submit" disabled={busy}>
          Stress-test my thesis
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" fill="none" />
          </svg>
        </Button>
        {error ? (
          <p role="alert" className="text-sm text-red">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
