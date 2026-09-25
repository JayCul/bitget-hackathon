// Headless Edge screenshots via the DevTools protocol, for visual checks when no browser window is visible.
// Usage: node scripts/shoot.mjs <outDir> <baseUrl>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const out = process.argv[2] ?? "shots";
const base = process.argv[3] ?? "http://localhost:3001";
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const port = 9333;
mkdirSync(out, { recursive: true });

const proc = spawn(EDGE, [
  "--headless=new",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${path.join(tmpdir(), "prequel-shoot-" + Date.now())}`,
  "--no-first-run",
  "--hide-scrollbars",
  "about:blank",
]);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let target;
for (let i = 0; i < 40 && !target; i++) {
  await wait(250);
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    target = list.find((t) => t.type === "page");
  } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
const send = (method, params = {}) =>
  new Promise((r) => {
    const i = ++id;
    pending.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const evaluate = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;

async function size(w, h) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
}
async function go(url) {
  await send("Page.navigate", { url: base + url });
  await wait(3500);
}
async function shot(name, full = false) {
  let clip;
  if (full) {
    const h = await evaluate("document.documentElement.scrollHeight");
    const w = await evaluate("window.innerWidth");
    clip = { x: 0, y: 0, width: w, height: Math.min(h, 6000), scale: 1 };
  }
  const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: full, ...(clip ? { clip } : {}) });
  writeFileSync(path.join(out, `${name}.png`), Buffer.from(r.result.data, "base64"));
  console.log("saved", name);
}

await send("Page.enable");
await send("Runtime.enable");

const steps = JSON.parse(process.env.SHOTS_FILE ? (await import("node:fs")).readFileSync(process.env.SHOTS_FILE, "utf8") : (process.env.SHOTS ?? "[]"));
for (const s of steps) {
  if (s.size) await size(s.size[0], s.size[1]);
  if (s.go) await go(s.go);
  if (s.eval) console.log("eval:", JSON.stringify(await evaluate(s.eval))?.slice(0, 300));
  if (s.wait) await wait(s.wait);
  if (s.shot) await shot(s.shot, s.full);
}
ws.close();
proc.kill();
process.exit(0);
