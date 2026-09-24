import { z } from "zod";
import { BitgetMcpError, callTool } from "./mcp";

const Envelope = z.object({
  success: z.boolean(),
  status_code: z.number().nullable(),
  data: z.unknown(),
  error: z.string().nullable(),
});

export type QueryResult<T> =
  | { ok: true; rows: T[] }
  | { ok: false; reason: "no_data" | "error"; message: string };

/**
 * Run a catalog entry through `do_query` and validate each row.
 * status_code 204 means the source has nothing for these params; callers render that as unavailable.
 */
export async function doQuery<T>(
  entryId: string,
  params: Record<string, unknown>,
  row: z.ZodType<T>,
): Promise<QueryResult<T>> {
  let raw: unknown;
  try {
    raw = await callTool("do_query", { entry_id: entryId, params });
  } catch (e) {
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : String(e) };
  }
  const env = Envelope.safeParse(raw);
  if (!env.success) return { ok: false, reason: "error", message: `Unexpected envelope from ${entryId}` };
  const { success, status_code, data, error } = env.data;
  if (!success) return { ok: false, reason: "error", message: error ?? JSON.stringify(data).slice(0, 300) };
  if (status_code === 204 || data === "") {
    return { ok: false, reason: "no_data", message: `${entryId} returned no data` };
  }

  const results = (data as { results?: unknown }).results;
  const list = Array.isArray(results) ? results : results == null ? [] : [results];
  const parsed = z.array(row).safeParse(list);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      reason: "error",
      message: `${entryId} schema mismatch at ${issue?.path.join(".") ?? "?"}: ${issue?.message ?? ""}`,
    };
  }
  return { ok: true, rows: parsed.data };
}

export function unwrap<T>(r: QueryResult<T>, entryId: string): T[] {
  if (!r.ok) throw new BitgetMcpError(r.message, entryId);
  return r.rows;
}
