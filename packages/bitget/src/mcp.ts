// Minimal streamable-HTTP MCP client for bitget-mcp-server.
// The server exposes two meta-tools: `guide` and `do_query`. See docs/tools.md.

const DEFAULT_URL = "https://agent.bitget.com/mcp";

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id?: number;
  result?: { structuredContent?: unknown; isError?: boolean; content?: unknown };
  error?: { code: number; message: string };
};

export class BitgetMcpError extends Error {
  constructor(
    message: string,
    readonly entryId?: string,
  ) {
    super(message);
    this.name = "BitgetMcpError";
  }
}

let sessionId: string | undefined;
let initializing: Promise<void> | undefined;
let nextId = 0;

function url() {
  return process.env.BITGET_MCP_URL ?? DEFAULT_URL;
}

async function post(body: object): Promise<Response> {
  return fetch(url(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
}

async function parse(res: Response, id: number): Promise<JsonRpcResponse> {
  const text = await res.text();
  if (!res.ok) throw new BitgetMcpError(`MCP HTTP ${res.status}: ${text.slice(0, 200)}`);
  if ((res.headers.get("content-type") ?? "").includes("text/event-stream")) {
    const messages = text
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => JSON.parse(l.slice(5)) as JsonRpcResponse);
    const match = messages.find((m) => m.id === id);
    if (!match) throw new BitgetMcpError("MCP stream ended without a response");
    return match;
  }
  return JSON.parse(text) as JsonRpcResponse;
}

async function initialize() {
  sessionId = undefined;
  const id = ++nextId;
  const res = await post({
    jsonrpc: "2.0",
    id,
    method: "initialize",
    params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "desk", version: "0.1" } },
  });
  sessionId = res.headers.get("mcp-session-id") ?? undefined;
  await parse(res, id);
  await post({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });
}

async function ensureSession() {
  if (sessionId) return;
  initializing ??= initialize().finally(() => {
    initializing = undefined;
  });
  await initializing;
}

export async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  await ensureSession();
  for (let attempt = 0; attempt < 2; attempt++) {
    const id = ++nextId;
    const res = await post({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } });
    // Expired session: re-initialize once.
    if ((res.status === 404 || res.status === 400) && attempt === 0) {
      sessionId = undefined;
      await ensureSession();
      continue;
    }
    const msg = await parse(res, id);
    if (msg.error) throw new BitgetMcpError(msg.error.message);
    if (msg.result?.isError) throw new BitgetMcpError(JSON.stringify(msg.result.content).slice(0, 300));
    return msg.result?.structuredContent;
  }
  throw new BitgetMcpError("MCP session could not be re-established");
}
