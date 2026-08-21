/**
 * POST /api/surface/:id/harness-explain (opt-in, spec 11) — the dedicated Cognitive Harness route.
 * Hermetic: with no GEMINI_API_KEY the host resolves the null model, whose output does not satisfy the
 * harness's structured-section contract, so the route degrades to a typed 422 (visible degradation,
 * never a silent stub). This proves the route is wired without a live model call.
 */
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createGatewayServer } from "../src/server";

beforeAll(() => {
  delete process.env["GEMINI_API_KEY"];
});

let active: Server | null = null;
afterEach(async () => {
  if (active) await new Promise<void>((resolve) => active!.close(() => resolve()));
  active = null;
});

function start(): Promise<string> {
  const server = createGatewayServer();
  active = server;
  return new Promise((resolve) => {
    server.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

describe("POST /api/surface/:id/harness-explain (opt-in, spec 11)", () => {
  test("route is wired and degrades visibly (422) with no real model", async () => {
    const base = await start();
    const enter = await fetch(`${base}/api/surface`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: "Teach me Photosynthesis" }),
    });
    const entered = (await enter.json()) as { surface_id: string };

    const res = await fetch(`${base}/api/surface/${entered.surface_id}/harness-explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concept: "photosynthesis", title: "Photosynthesis" }),
    });

    expect(res.status).toBe(422); // route exists (not 404) and degrades visibly
    const body = (await res.json()) as { ok: boolean; error?: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("E_FACULTY_OUTPUT_MALFORMED");
  });

  test("harness-feedback route is wired; feedback with no prior explanation is a visible no-op", async () => {
    const base = await start();
    const enter = await fetch(`${base}/api/surface`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: "Teach me Photosynthesis" }),
    });
    const entered = (await enter.json()) as { surface_id: string };

    const res = await fetch(`${base}/api/surface/${entered.surface_id}/harness-feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: 0.9 }),
    });

    expect(res.status).toBe(200); // route exists and returns a valid outcome
    const body = (await res.json()) as { ok: boolean; accepted: boolean; strategy: string | null };
    expect(body.ok).toBe(true);
    expect(body.accepted).toBe(false); // no prior explanation offline → visible no-op
    expect(body.strategy).toBeNull();
  });
});
