// Renders a time-driven page (window.__setT) to numbered JPEG frames with headless Edge.
// Usage: node scripts/render-frames.mjs <url> <outDir> <seconds> [fps=30] [--stills=1.2,4.5]
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const [url, out, secondsArg, fpsArg] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const stills = process.argv.find((a) => a.startsWith("--stills="))?.slice(9).split(",").map(Number);
const fps = Number(fpsArg ?? 30);
const seconds = Number(secondsArg);
mkdirSync(out, { recursive: true });

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const port = 9334;
const proc = spawn(EDGE, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(tmpdir(), "brag-render-" + Date.now())}`, "--no-first-run", "--hide-scrollbars", "about:blank"]);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 40 && !target; i++) {
  await wait(250);
  try {
    target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page");
  } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) (pending.get(msg.id)(msg), pending.delete(msg.id));
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url });
for (let i = 0; i < 60 && !(await ev("typeof window.__setT === 'function'")); i++) await wait(500);
await ev("document.fonts.ready.then(() => Promise.all([...document.images].map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; })))).then(() => 1)");
await wait(800);

const settle = "new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))";
async function frameAt(t, file, format = "jpeg") {
  await ev(`window.__setT(${t}); ${settle}`);
  // images that appear mid-video must be decoded before capture
  await ev("Promise.all([...document.images].map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; }))).then(() => 1)");
  const r = await send("Page.captureScreenshot", { format, ...(format === "jpeg" ? { quality: 92 } : {}) });
  writeFileSync(file, Buffer.from(r.result.data, "base64"));
}

if (stills) {
  for (const t of stills) await frameAt(t, path.join(out, `still-${t.toFixed(2)}.png`), "png");
  console.log("stills", stills.length);
} else {
  const n = Math.round(seconds * fps);
  for (let i = 0; i < n; i++) {
    await frameAt(i / fps, path.join(out, `f${String(i).padStart(5, "0")}.jpg`));
    if (i % 60 === 0) console.log("frame", i, "/", n);
  }
  console.log("done", n);
}
ws.close();
proc.kill();
process.exit(0);
