/**
 * Minimal JSON-RPC 2.0 stdio router for the COS MCP server.
 *
 * ADR-0022 D3: no @modelcontextprotocol/sdk external dep — we implement the
 * handful of methods MCP needs (~60 lines) over the wire format directly.
 *
 * §2 law: this file imports only @inevitable/sdk (not substrate packages).
 */

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export type MethodHandler = (params: unknown) => Promise<unknown> | unknown;

export class RpcRouter {
  private readonly handlers = new Map<string, MethodHandler>();

  register(method: string, handler: MethodHandler): this {
    this.handlers.set(method, handler);
    return this;
  }

  async dispatch(raw: string): Promise<JsonRpcResponse | null> {
    let req: JsonRpcRequest;
    try {
      req = JSON.parse(raw) as JsonRpcRequest;
    } catch {
      return {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      };
    }

    // MCP notifications (id absent or null) — no response per spec.
    if (req.id === undefined || req.id === null) {
      const handler = this.handlers.get(req.method);
      if (handler) await Promise.resolve(handler(req.params ?? {})).catch(() => undefined);
      return null;
    }

    const handler = this.handlers.get(req.method);
    if (!handler) {
      return {
        jsonrpc: "2.0",
        id: req.id,
        error: { code: -32601, message: `Method not found: ${req.method}` },
      };
    }

    try {
      const result = await handler(req.params ?? {});
      return { jsonrpc: "2.0", id: req.id, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        jsonrpc: "2.0",
        id: req.id,
        error: { code: -32000, message },
      };
    }
  }

  /** Read newline-delimited JSON-RPC from stdin, write responses to stdout. */
  listenStdio(
    stdin: NodeJS.ReadableStream = process.stdin,
    stdout: NodeJS.WritableStream = process.stdout,
  ): void {
    let buffer = "";
    stdin.setEncoding("utf8");
    stdin.on("data", async (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const response = await this.dispatch(trimmed);
        if (response !== null) {
          stdout.write(JSON.stringify(response) + "\n");
        }
      }
    });
  }
}
