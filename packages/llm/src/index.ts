// Any OpenAI-compatible endpoint (Groq by default, DashScope works too). Server-side only.
// The LLM identifies, generates and explains. It never produces a number the UI shows as data.
import OpenAI from "openai";
import { z } from "zod";

export class LlmError extends Error {
  constructor(
    message: string,
    readonly raw?: string,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

let client: OpenAI | undefined;

function getClient() {
  const apiKey = process.env.LLM_API_KEY;
  const baseURL = process.env.LLM_BASE_URL;
  if (!apiKey || !baseURL) throw new LlmError("LLM_API_KEY and LLM_BASE_URL must be set");
  client ??= new OpenAI({ apiKey, baseURL });
  return client;
}

export type ModelTier = "main" | "fast";

export function modelName(tier: ModelTier = "main") {
  const main = process.env.LLM_MODEL ?? "qwen/qwen3.8-27b";
  return tier === "fast" ? (process.env.LLM_MODEL_FAST ?? main) : main;
}

/** Keep reasoning short on reasoning models; these calls classify and generate, they don't need long chains. */
function reasoningParams(model: string): { reasoning_effort?: "low" } {
  return model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {};
}

/** Qwen3-family models may emit a reasoning block before the answer. */
function stripThinking(text: string) {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

function extractJson(text: string): unknown {
  const clean = stripThinking(text);
  const fenced = clean.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced?.[1] ?? clean).trim();
  return JSON.parse(body);
}

/**
 * Ask for JSON, validate with Zod, retry once with the validation error on failure.
 */
export async function structured<T>(opts: {
  schema: z.ZodType<T>;
  system: string;
  user: string;
  tier?: ModelTier;
  temperature?: number;
}): Promise<T> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: opts.system },
    { role: "user", content: opts.user },
  ];
  let lastError = "";
  let lastRaw = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const model = modelName(opts.tier);
    const res = await getClient().chat.completions.create({
      model,
      messages,
      temperature: opts.temperature ?? 0.4,
      response_format: { type: "json_object" },
      ...reasoningParams(model),
    });
    lastRaw = res.choices[0]?.message.content ?? "";
    let parsed: unknown;
    try {
      parsed = extractJson(lastRaw);
    } catch {
      lastError = "Response was not valid JSON.";
      messages.push({ role: "assistant", content: lastRaw }, { role: "user", content: `${lastError} Return JSON only.` });
      continue;
    }
    const result = opts.schema.safeParse(parsed);
    if (result.success) return result.data;
    lastError = z.prettifyError(result.error);
    messages.push(
      { role: "assistant", content: lastRaw },
      { role: "user", content: `Your JSON failed validation:\n${lastError}\nReturn corrected JSON only.` },
    );
  }
  throw new LlmError(`LLM output failed schema validation twice: ${lastError}`, lastRaw);
}

/** Plain-text explanation. Used only to explain numbers computed elsewhere. */
export async function explain(opts: { system: string; user: string; tier?: ModelTier }): Promise<string> {
  const model = modelName(opts.tier);
  const res = await getClient().chat.completions.create({
    model,
    ...reasoningParams(model),
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    temperature: 0.3,
  });
  return stripThinking(res.choices[0]?.message.content ?? "");
}
