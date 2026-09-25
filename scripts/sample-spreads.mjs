// Records live Bitget rToken spreads and order-book depth every N minutes, because Bitget offers no
// spread history. Output: apps/landed/data/samples/spreads.jsonl (one line per symbol per sample).
// Usage: node scripts/sample-spreads.mjs [minutes=10] [hours=60]
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const EVERY_MIN = Number(process.argv[2] ?? 10);
const HOURS = Number(process.argv[3] ?? 60);
const SYMBOLS = ["RNVDA/USDT", "RAAPL/USDT", "RSPY/USDT", "RQQQ/USDT", "RTSLA/USDT", "RMSFT/USDT"];
const SIZES_USD = [500, 2000, 10000];
const URL_ = "https://agent.bitget.com/mcp";
const OUT = path.join(import.meta.dirname, "..", "apps", "landed", "data", "samples", "spreads.jsonl");
mkdirSync(path.dirname(OUT), { recursive: true });

let session;
let id = 0;
async function rpc(method, params, notify = false) {
  const body = { jsonrpc: "2.0", method, params };
  if (!notify) body.id = ++id;
  const res = await fetch(URL_, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...(session ? { "mcp-session-id": session } : {}) },
    body: JSON.stringify(body),
  });
  session = res.headers.get("mcp-session-id") ?? session;
  if (notify) return null;
  const text = await res.text();
  const lines = text.split("\n").filter((l) => l.startsWith("data:")).map((l) => JSON.parse(l.slice(5)));
  return (lines.find((d) => d.id === body.id) ?? JSON.parse(text)).result?.structuredContent;
}
async function init() {
  session = undefined;
  await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "sampler", version: "0.1" } });
  await rpc("notifications/initialized", {}, true);
}
const query = (entry_id, params) => rpc("tools/call", { name: "do_query", arguments: { entry_id, params } });

/** Cost in bps vs mid of a market buy of `usd`, walking the asks. null if the book is too thin. */
function walk(asks, mid, usd) {
  let left = usd;
  let qty = 0;
  for (const [p, q] of asks) {
    const take = Math.min(left, p * q);
    qty += take / p;
    left -= take;
    if (left <= 1e-9) break;
  }
  if (left > 1e-9) return null;
  return ((usd / qty - mid) / mid) * 1e4;
}

async function sampleOnce() {
  const t = Date.now();
  for (const symbol of SYMBOLS) {
    try {
      const [tk, bk] = await Promise.all([
        query("crypto_spot_ticker", { symbol, exchange: "bitget" }),
        query("crypto_spot_order_book", { symbol, exchange: "bitget", limit: 50 }),
      ]);
      const r = tk?.data?.results;
      const b = bk?.data?.results;
      if (!r || !b?.asks?.length || !b?.bids?.length) throw new Error("empty");
      const bid = Number(b.bids[0][0]);
      const ask = Number(b.asks[0][0]);
      const mid = (bid + ask) / 2;
      const within = (side, bps) =>
        side.filter(([p]) => Math.abs(p - mid) / mid <= bps / 1e4).reduce((s, [p, q]) => s + p * q, 0);
      const row = {
        t,
        symbol,
        bookTs: b.timestamp,
        bid,
        ask,
        spreadBps: ((ask - bid) / mid) * 1e4,
        tickerBid: r.bid,
        tickerAsk: r.ask,
        depthAsk25Usd: Math.round(within(b.asks, 25)),
        depthBid25Usd: Math.round(within(b.bids, 25)),
        buyCostBps: Object.fromEntries(SIZES_USD.map((s) => [s, walk(b.asks, mid, s)])),
      };
      appendFileSync(OUT, JSON.stringify(row) + "\n");
    } catch (e) {
      appendFileSync(OUT, JSON.stringify({ t, symbol, error: String(e?.message ?? e) }) + "\n");
      await init().catch(() => {});
    }
  }
  console.log(new Date(t).toISOString(), "sampled", SYMBOLS.length);
}

await init();
const until = Date.now() + HOURS * 3_600_000;
while (Date.now() < until) {
  await sampleOnce();
  await new Promise((r) => setTimeout(r, EVERY_MIN * 60_000));
}
