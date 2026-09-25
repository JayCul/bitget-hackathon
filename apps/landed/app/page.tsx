import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { DataTag, DisplayHeading } from "@desk/ui";
import { HeroGraphic } from "@/components/HeroGraphic";
import { PlanView } from "@/components/PlanView";
import { Header, Label } from "@/components/Shell";
import type { PlanResponse } from "@/lib/types";

const primary =
  "inline-flex h-12 items-center justify-center gap-2 rounded-md bg-accent px-6 text-[15px] font-medium text-black transition-shadow hover:shadow-[0_0_0_1px_var(--color-accent),0_0_28px_-4px_var(--color-accent)]";

/** A plan produced by the real pipeline and saved for this preview (data/demo/plan.json). */
async function demoPlan(): Promise<PlanResponse | null> {
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), "data", "demo", "plan.json"), "utf8")) as PlanResponse;
  } catch {
    return null;
  }
}

const POINTS = [
  { k: "01", title: "Measured, not assumed", body: "Costs come from Bitget rToken order books, sampled every few minutes across the US session, overnight and the weekend." },
  { k: "02", title: "Code plans, AI explains", body: "A deterministic scheduler picks the cheapest hours. The AI only puts the result into words." },
  { k: "03", title: "You confirm every order", body: "The plan is a suggestion. Execution is simulated against the live book, and nothing is ever sent to an exchange." },
];

export default async function Landing() {
  const demo = await demoPlan();
  return (
    <>
      <Header wide />
      <main>
        <section className="mx-auto grid max-w-[1180px] items-center gap-10 px-4 pt-12 pb-16 md:px-6 lg:grid-cols-[1fr_1fr] lg:pt-20 lg:pb-24">
          <div className="flex flex-col gap-7">
            <Label>Execution assistance · Bitget rTokens</Label>
            <DisplayHeading lines={["Your salary landed.", <span key="2" className="text-accent">Don&apos;t waste the spread.</span>]} size="title" className="md:text-display" />
            <p className="max-w-md text-lg leading-relaxed text-muted">Landed turns a payday allocation into a liquidity-aware execution plan.</p>
            <div>
              <Link href="/plan" className={primary}>
                Build my plan <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
          <HeroGraphic />
        </section>

        <section aria-labelledby="preview" className="border-t border-line bg-raised/40">
          <div className="mx-auto flex max-w-[1180px] flex-col gap-10 px-4 py-16 md:px-6 lg:grid lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
              <Label>A real plan</Label>
              <h2 id="preview" className="text-title font-medium">
                Same money. Cheaper hours.
              </h2>
              <p className="max-w-md text-muted">
                rTokens trade around the clock, but market makers can only hedge while Wall Street is open. Outside those hours spreads widen and
                books thin out. Landed measures that and moves your orders to the hours where you keep more.
              </p>
              <DataTag kind="DEMO REPLAY" className="self-start" />
            </div>
            <div className="rounded-md border border-line bg-bg p-4 md:p-6">
              {demo ? (
                <PlanView data={demo} demo />
              ) : (
                <p className="text-sm text-muted">The preview plan is recorded once the order-book sampler has covered a full US session.</p>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby="control" className="border-t border-line">
          <div className="mx-auto flex max-w-[1180px] flex-col gap-12 px-4 py-20 md:px-6">
            <DisplayHeading as="h2" size="title" lines={["Nothing executes", <span key="2" className="text-muted">until you confirm.</span>]} />
            <ol className="grid gap-8 md:grid-cols-3">
              {POINTS.map((p) => (
                <li key={p.k} className="flex flex-col gap-3 border-t border-line pt-5">
                  <span className="font-mono text-xs text-accent">{p.k}</span>
                  <h3 className="text-lg font-medium tracking-tight">{p.title}</h3>
                  <p className="text-[15px] leading-relaxed text-muted">{p.body}</p>
                </li>
              ))}
            </ol>
            <div>
              <Link href="/plan" className={primary}>
                Build my plan <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-2 px-4 py-8 text-[13px] text-muted md:flex-row md:justify-between md:px-6">
          <span>Built by Justin Nnaka, Master&apos;s student at Miva Open University.</span>
          <span className="font-mono text-xs">Data: Bitget · Simulated execution only · Not investment advice</span>
        </div>
      </footer>
    </>
  );
}
