import { explain, modelName } from "@desk/llm";
import type { Plan } from "@/lib/plan";
import { REGIME_LABEL } from "@/lib/regime";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SYSTEM = `You explain an execution plan that code has already computed. Never recalculate, never invent numbers.
Only use figures that appear in the facts. Write exactly two short sentences in plain English for a salaried investor.
No em dashes. No advice beyond the plan.`;

const WAT = (t: number) =>
  new Date(t).toLocaleString("en-GB", { timeZone: "Africa/Lagos", weekday: "short", hour: "2-digit", minute: "2-digit" });

/** LLM explains the computed plan in two sentences. */
export async function POST(req: Request) {
  const { plan } = (await req.json().catch(() => ({}))) as { plan?: Plan };
  if (!plan?.rows) return Response.json({ error: "Plan required" }, { status: 400 });

  const facts = [
    `Buying everything when the money lands (${WAT(plan.input.start)} WAT) costs about ${plan.baseline.bps?.toFixed(1) ?? "unknown"} bps (${plan.baseline.legs.map((l) => `${l.ticker}: ${l.regime ? REGIME_LABEL[l.regime] : "unmeasured"}`).join(", ")}).`,
    `The plan costs about ${plan.totals.bps.toFixed(1)} bps, saving ${plan.savedUsd !== null ? `$${plan.savedUsd.toFixed(2)}` : "an unknown amount"}.`,
    `Orders: ${plan.rows.map((r) => `${r.ticker} ${WAT(r.t)} WAT (${REGIME_LABEL[r.regime]}, ${r.bps.toFixed(1)} bps)`).join("; ")}.`,
    "Costs come from Bitget order books sampled every 10 minutes: spreads are wider when the US market is closed because market makers cannot hedge.",
  ].join("\n");

  try {
    const text = await explain({ system: SYSTEM, user: facts, tier: "fast" });
    return Response.json({ text, model: modelName("fast") });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
