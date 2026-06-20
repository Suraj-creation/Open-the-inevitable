/**
 * §2 Law verification: apps/mcp must NOT import from any substrate package.
 * This test file only uses @inevitable/sdk (via tools.ts) and Node.js builtins.
 *
 * Substrate packages that must NOT appear here or in apps/mcp/src/*:
 *   @inevitable/protocols, @inevitable/kernel, @inevitable/events, @inevitable/runtime,
 *   @inevitable/memory, @inevitable/orchestration, @inevitable/governance, @inevitable/surface
 */
import { describe, expect, it, vi } from "vitest";
import { RpcRouter } from "../src/rpc.js";

describe("RpcRouter (§2 law: zero substrate imports in apps/mcp)", () => {
  it("dispatches a registered method and returns result", async () => {
    const router = new RpcRouter();
    router.register("ping", () => ({ pong: true }));

    const response = await router.dispatch(
      JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
    );
    expect(response).toEqual({ jsonrpc: "2.0", id: 1, result: { pong: true } });
  });

  it("returns method-not-found for unregistered method", async () => {
    const router = new RpcRouter();
    const response = await router.dispatch(
      JSON.stringify({ jsonrpc: "2.0", id: 2, method: "unknown" }),
    );
    expect(response?.error?.code).toBe(-32601);
    expect(response?.error?.message).toContain("unknown");
  });

  it("returns parse-error for invalid JSON", async () => {
    const router = new RpcRouter();
    const response = await router.dispatch("{bad json");
    expect(response?.error?.code).toBe(-32700);
  });

  it("returns null for notifications (id null)", async () => {
    const router = new RpcRouter();
    const handler = vi.fn().mockResolvedValue(undefined);
    router.register("notifications/initialized", handler);

    const response = await router.dispatch(
      JSON.stringify({ jsonrpc: "2.0", id: null, method: "notifications/initialized" }),
    );
    expect(response).toBeNull();
  });

  it("returns null for notifications (id absent)", async () => {
    const router = new RpcRouter();
    const response = await router.dispatch(
      JSON.stringify({ jsonrpc: "2.0", method: "unknown_notification" }),
    );
    expect(response).toBeNull();
  });

  it("wraps handler errors in a JSON-RPC error response", async () => {
    const router = new RpcRouter();
    router.register("bad", () => {
      throw new Error("something went wrong");
    });

    const response = await router.dispatch(
      JSON.stringify({ jsonrpc: "2.0", id: 3, method: "bad" }),
    );
    expect(response?.error?.code).toBe(-32000);
    expect(response?.error?.message).toBe("something went wrong");
  });

  it("calls the handler with params", async () => {
    const router = new RpcRouter();
    const handler = vi.fn().mockResolvedValue({ ok: true });
    router.register("echo", handler);

    await router.dispatch(
      JSON.stringify({ jsonrpc: "2.0", id: 4, method: "echo", params: { x: 42 } }),
    );
    expect(handler).toHaveBeenCalledWith({ x: 42 });
  });

  it("supports async handlers", async () => {
    const router = new RpcRouter();
    router.register("slow", async () => {
      await Promise.resolve();
      return "done";
    });

    const response = await router.dispatch(
      JSON.stringify({ jsonrpc: "2.0", id: 5, method: "slow" }),
    );
    expect(response?.result).toBe("done");
  });
});
