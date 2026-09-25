import Link from "next/link";
import { DataTag } from "@desk/ui";
import { DemoPlan } from "@/components/DemoPlan";
import { DEMO_PAYDAY } from "@/lib/demo";
import { LiquidityWave } from "@/components/LiquidityWave";
import { SiteNav } from "@/components/nav";
import { SystemLabel } from "@/components/system";
import { buildBundle } from "@/lib/bundle";
import { cached } from "@/lib/cache";
import { costBps } from "@/lib/costs";
import { bps, ngnFmt, watTime } from "@/lib/format";
import { REGIME_LABEL, type Regime } from "@/lib/regime";
import type { MarketBundle } from "@/lib/types";

export const dynamic = "force-dynamic";

const TICKERS = ["NVDA", "AAPL", "SPY"];
const REGIMES: Regime[] = ["session", "extended", "overnight", "weekend"];

async function bundle(): Promise<MarketBundle | null> {
  try {
    return await cached("landing-bundle", 60_000, async () => ({ ok: true, value: await buildBundle(TICKERS) }));
  } catch {
    return null;
  }
}

const pill = "inline-flex h-11 items-center gap-2 rounded-full px-6 text-[14px] font-medium transition-all";

function Statement({ n, title, children, aside }: { n: string; title: React.ReactNode; children: React.ReactNode; aside: React.ReactNode }) {
  return (
    <div className="reveal grid gap-10 border-t border-white/[0.07] py-20 md:grid-cols-[88px_1.2fr_1fr] md:gap-12 md:py-28">
      <SystemLabel accent>{n}</SystemLabel>
      <div className="flex flex-col gap-6">
        <h2 className="text-statement font-medium">{title}</h2>
        <p className="max-w-md text-[17px] leading-relaxed text-muted">{children}</p>
      </div>
      <div className="self-end">{aside}</div>
    </div>
  );
}

export default async function Landing() {
  const b = await bundle();
  const live = b ? TICKERS.map((t) => ({ t, l: b.live[t] })) : [];
  const stamp = b ? watTime(Date.parse(b.generatedAt)) : null;
  const tranche = (DEMO_PAYDAY.salary - DEMO_PAYDAY.bills - DEMO_PAYDAY.buffer) / DEMO_PAYDAY.rate / TICKERS.length / 2;
  const regimeCost = REGIMES.map((r) => {
    const vals = b ? TICKERS.map((t) => costBps(b.model, t, r, tranche)).filter((v): v is number => v !== null) : [];
    return { r, bps: vals.length === TICKERS.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null };
  });
  const maxCost = Math.max(1, ...regimeCost.map((x) => x.bps ?? 0));

  return (
    <>
      <SiteNav />
      <main>
        {/* HERO */}
        <section className="relative flex min-h-[100svh] flex-col overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[78%]">
            <LiquidityWave />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-transparent to-bg" />
          </div>
          <div className="relative mx-auto mt-auto flex w-full max-w-[1320px] flex-col items-center px-5 pb-10 text-center md:px-10">
            <span className="rise mb-7 inline-flex items-center gap-2 rounded-full border border-white/12 bg-bg/60 px-3.5 py-1.5 backdrop-blur-sm">
              <span className="size-1.5 rounded-full bg-accent" />
              <SystemLabel className="!text-fg/80">Payday → Execution</SystemLabel>
            </span>
            <h1 className="text-hero font-medium">
              <span className="rise block" style={{ ["--d" as string]: "80ms" }}>
                Your salary landed.
              </span>
              <span className="rise block" style={{ ["--d" as string]: "160ms" }}>
                Don&apos;t waste the <span className="font-serif font-normal text-accent italic">spread.</span>
              </span>
            </h1>
            <p className="rise mt-7 max-w-md text-[17px] leading-relaxed text-muted" style={{ ["--d" as string]: "240ms" }}>
              Turn payday into a deliberate execution plan, timed to when the market is deep.
            </p>
            <div className="rise mt-9 flex flex-wrap justify-center gap-3" style={{ ["--d" as string]: "320ms" }}>
              <Link href="/plan" className={`${pill} bg-fg text-black hover:bg-accent-2 hover:shadow-[0_0_40px_-8px_var(--color-accent)]`}>
                Build my plan
              </Link>
              <a href="#how" className={`${pill} border border-white/15 text-fg hover:border-white/40`}>
                See how it works
              </a>
            </div>
            <div className="mt-16 grid w-full grid-cols-1 gap-3 border-t border-white/[0.07] pt-5 font-mono text-[12px] sm:grid-cols-3 md:text-[13px]">
              {live.length ? (
                live.map(({ t, l }) => (
                  <div key={t} className="flex items-center justify-center gap-2 sm:justify-start">
                    <span className="text-muted">r{t}</span>
                    <span>{l?.ok ? `${l.spreadBps.toFixed(1)} bps spread` : "unavailable"}</span>
                    <span className="text-muted">{l?.ok ? REGIME_LABEL[l.regime].toLowerCase() : ""}</span>
                  </div>
                ))
              ) : (
                <span className="text-muted">Live order books unavailable right now.</span>
              )}
            </div>
            {stamp ? (
              <div className="mt-3 flex w-full items-center justify-between">
                <SystemLabel>Live Bitget rToken order books · {stamp} WAT</SystemLabel>
                <DataTag kind="OBSERVED" />
              </div>
            ) : null}
          </div>
        </section>

        {/* STORY */}
        <section id="how" aria-label="How it works" className="mx-auto max-w-[1320px] px-5 md:px-10">
          <Statement
            n="01"
            title="Your salary landed."
            aside={
              <div className="flex flex-col gap-3">
                <div className="relative h-10 rounded-sm border border-white/10">
                  {/* WAT day: US regular session is 14:30 to 21:00 WAT while New York is on daylight time */}
                  <div className="absolute inset-y-0 left-[60.4%] w-[27.1%] bg-accent/25" />
                  <div className="absolute inset-y-0 left-[37.5%] w-px bg-fg" />
                </div>
                <div className="flex justify-between font-mono text-[10px] text-muted">
                  <span>00:00</span>
                  <span>09:00 alert</span>
                  <span>14:30 to 21:00 US session</span>
                  <span>24:00</span>
                </div>
              </div>
            }
          >
            The alert usually arrives in the morning. Wall Street opens hours later. rTokens still trade in between, but the market makers behind
            them cannot hedge until New York wakes up.
          </Statement>

          <Statement
            n="02"
            title={
              <>
                Now decide what <span className="font-serif font-normal italic">deserves</span> it.
              </>
            }
            aside={
              <div className="flex flex-col font-mono text-sm">
                {[
                  ["", "Salary", DEMO_PAYDAY.salary],
                  ["−", "Bills", DEMO_PAYDAY.bills],
                  ["−", "Safety buffer", DEMO_PAYDAY.buffer],
                ].map(([s, l, v]) => (
                  <div key={l as string} className="flex justify-between border-b border-white/[0.06] py-2.5">
                    <span className="text-muted">
                      <span className="inline-block w-4">{s}</span>
                      {l}
                    </span>
                    <span className="tabular-nums">{ngnFmt(v as number)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-3 text-lg text-accent">
                  <span>= Investable</span>
                  <span className="tabular-nums">{ngnFmt(DEMO_PAYDAY.salary - DEMO_PAYDAY.bills - DEMO_PAYDAY.buffer)}</span>
                </div>
                <DataTag kind="DEMO" className="self-end" />
              </div>
            }
          >
            Bills and a safety buffer come off first, in code. What remains is what gets a plan.
          </Statement>

          <Statement
            n="03"
            title="Don't execute everything at once."
            aside={
              <svg viewBox="0 0 400 120" className="h-auto w-full" aria-label="One amount split into separate orders">
                <line x1="10" x2="150" y1="60" y2="60" stroke="#E8A34A" strokeWidth="2" />
                {[18, 46, 74, 102].map((y, i) => (
                  <g key={y}>
                    <path d={`M150 60 C 220 60, 230 ${y}, 290 ${y}`} fill="none" stroke="#F5F5F5" strokeOpacity={i === 1 ? 0.8 : 0.3} />
                    <line x1="290" x2="390" y1={y} y2={y} stroke="#F5F5F5" strokeOpacity="0.08" />
                    <circle cx={300 + i * 22} cy={y} r="4" fill={i === 1 ? "#E8A34A" : "#F5F5F5"} fillOpacity={i === 1 ? 1 : 0.5} />
                  </g>
                ))}
                <circle cx="10" cy="60" r="5" fill="#FFB85C" />
              </svg>
            }
          >
            One order at the worst hour pays the widest spread on all of it. Split into tranches, each can wait for a better window.
          </Statement>

          <Statement
            n="04"
            title={
              <>
                Let <span className="font-serif font-normal italic">liquidity</span> decide when.
              </>
            }
            aside={
              <div className="flex flex-col gap-4">
                {regimeCost.map(({ r, bps: v }) => (
                  <div key={r} className="grid grid-cols-[130px_1fr_70px] items-center gap-3 font-mono text-[12px]">
                    <span className="text-muted">{REGIME_LABEL[r]}</span>
                    <span className="h-[3px] rounded-full bg-white/[0.06]">
                      {v !== null ? <span className="block h-full rounded-full bg-accent" style={{ width: `${(v / maxCost) * 100}%` }} /> : null}
                    </span>
                    <span className="text-right tabular-nums">{v !== null ? bps(v) : "measuring"}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <SystemLabel>Median cost, rNVDA rAAPL rSPY</SystemLabel>
                  <DataTag kind="OBSERVED" source={`${b?.model.samples ?? 0} book samples`} />
                </div>
              </div>
            }
          >
            Landed samples Bitget&apos;s order books around the clock and measures what each hour really costs. Your orders go where you keep more.
          </Statement>
        </section>

        {/* REAL PLAN */}
        <section aria-labelledby="real" className="border-t border-white/[0.07]">
          <div className="reveal mx-auto flex max-w-[1320px] flex-col gap-12 px-5 py-24 md:px-10">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="flex flex-col gap-4">
                <SystemLabel accent>A real plan, live</SystemLabel>
                <h2 id="real" className="text-statement font-medium">
                  {ngnFmt(DEMO_PAYDAY.salary - DEMO_PAYDAY.bills - DEMO_PAYDAY.buffer)}, <span className="font-serif font-normal text-muted italic">planned this week.</span>
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-muted">
                Sample payday, real measured costs. Computed in your browser from Bitget order-book samples. Select a window to see why.
              </p>
            </div>
            {b ? <DemoPlan bundle={b} /> : <p className="text-muted">Market data is unavailable right now.</p>}
          </div>
        </section>

        {/* CONTROL */}
        <section className="border-t border-white/[0.07]">
          <div className="reveal mx-auto flex max-w-[1320px] flex-col items-start gap-10 px-5 py-28 md:px-10">
            <h2 className="text-hero max-w-5xl font-medium">
              Nothing happens <span className="font-serif font-normal text-muted italic">until you confirm.</span>
            </h2>
            <div className="grid w-full gap-8 md:grid-cols-3">
              {[
                ["Measured, not assumed", "Every cost comes from real Bitget order books. Hours that were never measured are never used."],
                ["Code plans, AI explains", "A deterministic scheduler picks the windows. The AI only puts the result into words."],
                ["Simulated, never sent", "Confirming simulates fills against the live book. No order ever reaches an exchange."],
              ].map(([t, d]) => (
                <div key={t} className="flex flex-col gap-3 border-t border-white/[0.07] pt-5">
                  <h3 className="text-lg font-medium tracking-tight">{t}</h3>
                  <p className="text-[15px] leading-relaxed text-muted">{d}</p>
                </div>
              ))}
            </div>
            <Link href="/plan" className={`${pill} h-14 bg-fg px-8 text-[15px] text-black hover:bg-accent-2 hover:shadow-[0_0_40px_-8px_var(--color-accent)]`}>
              Build my plan
            </Link>
          </div>
        </section>
      </main>
      <footer className="border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-2 px-5 py-8 font-mono text-[11px] text-muted md:flex-row md:justify-between md:px-10">
          <span>Built by Justin Nnaka, Master&apos;s student at Miva Open University.</span>
          <span>Data: Bitget · Simulated execution only · Not investment advice</span>
        </div>
      </footer>
    </>
  );
}
