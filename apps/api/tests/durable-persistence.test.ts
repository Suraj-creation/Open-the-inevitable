/**
 * Durable persistence (P1, ADR-0008 / DPS-001): a surface driven on one gateway process is
 * reconstructed byte-identically on a *fresh* gateway over the same directory — the substrate has a
 * persistent existence independent of the process. Narration audio (out-of-band) survives too.
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
  // Hermetic + deterministic: never let an ambient Gemini key turn these into live network calls.
  delete process.env["GEMINI_API_KEY"];
});

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "cos-persist-"));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

let active: Server | null = null;
afterEach(async () => {
  if (active) await new Promise<void>((resolve) => active!.close(() => resolve()));
  active = null;
});

/** Boot a gateway over a host pinned to the shared persistence dir (a "process"). */
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

interface StateShape {
  blocks: { block_type: string }[];
  frames: { status: string }[];
  narration: { voice: { content_ref: string } | null }[];
  timeline: unknown;
}

async function getState(base: string, id: string): Promise<StateShape | null> {
  const res = await fetch(`${base}/api/surface/${id}/state`);
  const json = (await res.json()) as { state: StateShape | null };
  return json.state;
}

describe("Durable persistence — cross-process surface recovery (P1)", () => {
  test("a fresh gateway reconstructs a persisted surface byte-identically; audio survives", async () => {
    // --- Process 1: create + drive a surface, then "crash" (close the server). ---
    const base1 = await boot();
    const created = await fetch(`${base1}/api/surface`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: "Teach me Neural Networks", seed: "durable-1" }),
    });
    const { surface_id: id } = (await created.json()) as { surface_id: string };

    const asked = await fetch(`${base1}/api/surface/${id}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "ask", goal: "Teach me Neural Networks" }),
    });
    expect(asked.status).toBe(200);

    const before = await getState(base1, id);
    expect(before).not.toBeNull();
    // The product surface teaches via a composed Cognitive Frame (UCS, ADR-0030).
    expect(before!.frames.some((f) => f.status === "composed")).toBe(true);

    // A narration segment with out-of-band audio (NullVoiceRuntime → deterministic silent WAV).
    const voiced = before!.narration.find((seg) => seg.voice !== null);
    expect(voiced).toBeDefined();

    await new Promise<void>((resolve) => active!.close(() => resolve()));
    active = null;

    // --- Process 2: a brand-new host over the SAME dir reconstructs the surface from disk. ---
    const base2 = await boot();
    const after = await getState(base2, id);

    // Byte-identical reconstruction: the durable log folds to exactly the pre-restart state.
    expect(after).toEqual(before);

    // Out-of-band audio resolves on the restarted process (FileMediaStore reads it from disk).
    const audio = await fetch(`${base2}${voiced!.voice!.content_ref}`);
    expect(audio.status).toBe(200);
    const bytes = new Uint8Array(await audio.arrayBuffer());
    expect(bytes.byteLength).toBeGreaterThan(0);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("RIFF"); // a real WAV survived
  });

  test("missing world/memory snapshots fall back to read-only restore (DPS-002 failure mode)", async () => {
    const base1 = await boot();
    const created = await fetch(`${base1}/api/surface`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: "Teach me Photosynthesis", seed: "durable-2" }),
    });
    const { surface_id: id } = (await created.json()) as { surface_id: string };
    await fetch(`${base1}/api/surface/${id}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "ask", goal: "Teach me Photosynthesis" }),
    });
    await new Promise<void>((resolve) => active!.close(() => resolve()));
    active = null;

    // Simulate a surface persisted before continuity (or lost snapshots): the event log survives but
    // the world/memory snapshots are gone, so a live session cannot be rehydrated.
    rmSync(join(dir, "surfaces", id, "world.json"), { force: true });
    rmSync(join(dir, "surfaces", id, "memory.json"), { force: true });

    const base2 = await boot();
    // History is still served read-side from the durable event log...
    const after = await getState(base2, id);
    expect(after!.blocks.length).toBeGreaterThan(0);
    // ...but a live command is rejected with a typed signal (cannot rehydrate without snapshots).
    const reask = await fetch(`${base2}/api/surface/${id}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "ask", goal: "Teach me Photosynthesis" }),
    });
    expect(reask.status).toBe(422);
    const json = (await reask.json()) as { ok: boolean; error: { code: string } };
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("E_SURFACE_GATEWAY");
  });
});
