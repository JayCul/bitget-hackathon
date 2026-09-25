import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

// Memory + disk cache for source responses. Only successful results are stored.
// Disk lives in the OS temp dir so it also works on Vercel's writable /tmp.
const DIR = path.join(tmpdir(), "landed-cache");
const memory = new Map<string, { at: number; value: unknown }>();

function file(key: string) {
  return path.join(DIR, createHash("sha1").update(key).digest("hex") + ".json");
}

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<{ ok: boolean; value: T }>): Promise<T> {
  const now = Date.now();
  const hit = memory.get(key);
  if (hit && now - hit.at < ttlMs) return hit.value as T;
  try {
    const disk = JSON.parse(await readFile(file(key), "utf8")) as { at: number; value: T };
    if (now - disk.at < ttlMs) {
      memory.set(key, disk);
      return disk.value;
    }
  } catch {
    // miss
  }
  const { ok, value } = await load();
  if (ok) {
    const entry = { at: now, value };
    memory.set(key, entry);
    await mkdir(DIR, { recursive: true }).catch(() => {});
    await writeFile(file(key), JSON.stringify(entry)).catch(() => {});
  }
  return value;
}

/** Run async jobs with at most `n` in flight. */
export async function pool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}
