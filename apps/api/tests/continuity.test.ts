/**
 * Cognitive continuity / live rehydration (P2.1, DPS-002 / ADR-0009): after a restart a persisted
 * surface comes back **live** — a new `ask` is accepted and appends fresh cognition, with prior state
 * intact and no id collisions. This completes the write-continuity DPS-001 deferred.
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type AddressInfo } from "node:net";
import { type Server } from "node:http";
import { NullVoiceRuntime } from "@inevitable/adapters";
import { SurfaceHost } from "../src/host";
import { createGatewayServer } from "../src/server";

beforeAll(() => {
  delete process.env["GEMINI_API_KEY"]; // hermetic + deterministic
});

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "cos-continuity-"));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

let active: Server | null = null;
afterEach(async () => {
  if (active) await new Promise<void>((resolve) => active!.close(() => resolve()));
  active = null;
});

function boot(): Promise<string> {
  const host = new SurfaceHost({ persistDir: dir, voiceRuntime: new NullVoiceRuntime() });
  const server = createGatewayServer(host);
  active = server;
  return new Promise((resolve) => {
    server.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

async function createSurface(base: string, goal: string, seed: string): Promise<string> {
  const res = await fetch(`${base}/api/surface`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goal, seed }),
  });
  return ((await res.json()) as { surface_id: string }).surface_id;
}

function command(base: string, id: string, cmd: Record<string, unknown>): Promise<Response> {
  return fetch(`${base}/api/surface/${id}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
}

async function blocks(
  base: string,
  id: string,
): Promise<{ block_id: string; block_type: string }[]> {
  const res = await fetch(`${base}/api/surface/${id}/state`);
  const json = (await res.json()) as {
    state: { blocks: { block_id: string; block_type: string }[] };
  };
  return json.state.blocks;
}

describe("Cognitive continuity — live rehydration after restart (P2.1)", () => {
  test("a new ask on a restored surface appends fresh cognition; prior state intact; ids unique", async () => {
    // --- Process 1: drive a surface, then crash. ---
    const base1 = await boot();
    const id = await createSurface(base1, "Teach me Neural Networks", "cont-1");
    expect(
      (await command(base1, id, { type: "ask", goal: "Teach me Neural Networks" })).status,
    ).toBe(200);
    const before = await blocks(base1, id);
    expect(before.some((b) => b.block_type === "explanation")).toBe(true);
    await new Promise<void>((resolve) => active!.close(() => resolve()));
    active = null;

    // --- Process 2: the surface returns LIVE — a new ask is accepted (not rejected read-only). ---
    const base2 = await boot();
    const reask = await command(base2, id, { type: "ask", goal: "Teach me Neural Networks" });
    expect(reask.status).toBe(200);
    expect(((await reask.json()) as { ok: boolean }).ok).toBe(true);

    const after = await blocks(base2, id);
    // Prior cognition is preserved AND new cognition was appended.
    expect(after.length).toBeGreaterThan(before.length);
    // Every block id is unique — the resumed session's crypto ids never collide with the recorded ones.
    const ids = after.map((b) => b.block_id);
    expect(new Set(ids).size).toBe(ids.length);
    // The originally-generated blocks survive into the resumed surface.
    const beforeIds = new Set(before.map((b) => b.block_id));
    expect(after.filter((b) => beforeIds.has(b.block_id)).length).toBe(before.length);
  });

  test("expand also works live on a restored surface", async () => {
    const base1 = await boot();
    const id = await createSurface(base1, "Teach me Photosynthesis", "cont-2");
    await command(base1, id, { type: "ask", goal: "Teach me Photosynthesis" });
    const before = await blocks(base1, id);
    const explanation = before.find((b) => b.block_type === "explanation");
    expect(explanation).toBeDefined();
    await new Promise<void>((resolve) => active!.close(() => resolve()));
    active = null;

    const base2 = await boot();
    const expanded = await command(base2, id, {
      type: "expand",
      block_id: explanation!.block_id,
      layer: 1,
    });
    expect(expanded.status).toBe(200);
    expect(((await expanded.json()) as { ok: boolean }).ok).toBe(true);
  });
});
