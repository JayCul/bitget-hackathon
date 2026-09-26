// Exit 0 when the sampled books cover what the Landed demo needs: US session and pre/post-market,
// at least 3 good samples each, for rNVDA, rAAPL and rSPY. Prints coverage either way.
// Usage: node scripts/landed-ready.mjs [--bitget]   (--bitget: exit 0 as soon as any good sample is newer than 10 min)
import { readFileSync } from "node:fs";
import path from "node:path";

const file = path.join(import.meta.dirname, "..", "apps", "landed", "data", "samples", "spreads.jsonl");
const rows = readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const ok = rows.filter((r) => !r.error);

if (process.argv.includes("--bitget")) {
  const fresh = ok.some((r) => Date.now() - r.t < 10 * 60_000);
  console.log(fresh ? "Bitget data is back: fresh order-book samples are arriving." : "still down");
  process.exit(fresh ? 0 : 1);
}

// New York time is UTC-4 until 1 Nov 2026 (this script only needs this week).
function regime(t) {
  const ny = new Date(t - 4 * 3_600_000);
  const dow = ny.getUTCDay();
  const m = ny.getUTCHours() * 60 + ny.getUTCMinutes();
  if (dow === 6) return "weekend";
  if (dow === 0) return m >= 1200 ? "overnight" : "weekend";
  if (dow === 5 && m >= 1200) return "weekend";
  if (m >= 570 && m < 960) return "session";
  if ((m >= 240 && m < 570) || (m >= 960 && m < 1200)) return "extended";
  return "overnight";
}

const need = ["RNVDA/USDT", "RAAPL/USDT", "RSPY/USDT"];
const cov = {};
for (const s of need) cov[s] = { session: 0, extended: 0 };
for (const r of ok) if (cov[r.symbol] && regime(r.t) in cov[r.symbol]) cov[r.symbol][regime(r.t)]++;
const ready = need.every((s) => cov[s].session >= 3 && cov[s].extended >= 3);
console.log(ready ? "Landed is ready: US session and pre/post-market are measured." : "not ready", JSON.stringify(cov));
process.exit(ready ? 0 : 1);
