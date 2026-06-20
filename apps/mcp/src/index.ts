/**
 * COS MCP Server — stdio entry point.
 *
 * Protocol: JSON-RPC 2.0 over stdio (MCP wire format).
 * Configuration: COS_API_URL env var (default: http://localhost:8787).
 *
 * §2 law proof: the only COS package imported is @inevitable/sdk.
 *   - No @inevitable/protocols, @inevitable/kernel, @inevitable/events, etc.
 *   - A process restart of this app requires zero changes to any substrate package.
 *
 * ADR-0022 D4: env-var configuration; D3: inline JSON-RPC 2.0, no external MCP SDK.
 */
import { CosClient } from "@inevitable/sdk";
import { RpcRouter } from "./rpc.js";
import { buildToolHandlers, TOOLS } from "./tools.js";

const apiUrl = process.env["COS_API_URL"] ?? "http://localhost:8787";

const client = new CosClient({ baseUrl: apiUrl });
const handlers = buildToolHandlers(client);

const router = new RpcRouter();

// MCP initialize — return server capabilities.
router.register("initialize", () => ({
  protocolVersion: "2024-11-05",
  capabilities: { tools: {} },
  serverInfo: { name: "cos-mcp", version: "0.1.0" },
}));

// MCP tools/list — advertise available tools.
router.register("tools/list", () => ({ tools: TOOLS }));

// MCP tools/call — dispatch to the matching tool handler.
router.register("tools/call", async (params: unknown) => {
  const p = params as { name: string; arguments?: unknown };
  const handler = handlers[p.name];
  if (!handler) {
    throw new Error(`Unknown tool: ${p.name}`);
  }
  return handler(p.arguments ?? {});
});

// Start listening on stdio.
router.listenStdio();

process.stderr.write(`[cos-mcp] Connected to COS gateway at ${apiUrl}\n`);
