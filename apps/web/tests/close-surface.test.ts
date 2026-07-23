/**
 * closeSurface (ADR-0055 D4) — the web's session-close, the trigger for intelligence distillation
 * (episodes / deltas / the next resume card). It must POST the `close` command with `keepalive` so
 * it survives page dismissal, and must never throw into a leaving page.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { closeSurface } from "../src/api";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("closeSurface", () => {
  test("POSTs a keepalive close command for the surface", () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    closeSurface("srf-42", "learner-left");

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("/api/surface/srf-42/command");
    expect(calls[0]!.init.method).toBe("POST");
    expect(calls[0]!.init.keepalive).toBe(true);
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      type: "close",
      reason: "learner-left",
    });
  });

  test("never throws into a leaving page, even if fetch rejects synchronously", () => {
    vi.stubGlobal("fetch", () => {
      throw new Error("network down");
    });
    expect(() => closeSurface("srf-1", "learner-left")).not.toThrow();
  });
});
