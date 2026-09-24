// Minimal MCP client for probing bitget-mcp-server. Usage:
//   node scripts/mcp-probe.mjs list
//   node scripts/mcp-probe.mjs call <toolName> '<jsonArgs>'
const URL_ = process.env.BITGET_MCP_URL ?? "https://agent.bitget.com/mcp";
let session;
let id = 0;

async function rpc(method, params, notify = false) {
  const body = { jsonrpc: "2.0", method, params };
  if (!notify) body.id = ++id;
  const res = await fetch(URL_, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(session ? { "mcp-session-id": session } : {}),
    },
    body: JSON.stringify(body),
  });
  session = res.headers.get("mcp-session-id") ?? session;
  if (notify) return null;
  const text = await res.text();
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("text/event-stream")) {
    const datas = text.split("\n").filter((l) => l.startsWith("data:")).map((l) => JSON.parse(l.slice(5)));
    return datas.find((d) => d.id === body.id) ?? datas.at(-1);
  }
  return JSON.parse(text);
}

await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "probe", version: "0.1" } });
await rpc("notifications/initialized", {}, true);

const [cmd, name, args] = process.argv.slice(2);
if (cmd === "list") {
  const r = await rpc("tools/list", {});
  console.log(JSON.stringify(r.result ?? r, null, 2));
} else if (cmd === "call") {
  const r = await rpc("tools/call", { name, arguments: JSON.parse(args ?? "{}") });
  console.log(JSON.stringify(r.result ?? r, null, 2));
}
