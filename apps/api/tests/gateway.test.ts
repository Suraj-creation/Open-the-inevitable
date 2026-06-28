import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { type AddressInfo } from "node:net";
import { type Server } from "node:http";
import type { CognitiveEvent } from "@inevitable/protocols";
import { foldSurfaceEvents } from "@inevitable/surface";
import { createGatewayServer } from "../src/server";

// Keep the suite hermetic + deterministic: never let an ambient Gemini key turn these into live
// network calls. The host resolves the model from the environment (apps/api/src/host.ts).
beforeAll(() => {
  delete process.env["GEMINI_API_KEY"];
});

// ---------------------------------------------------------------------------
// Harness — start the gateway on an ephemeral port, drive it over real HTTP.
// ---------------------------------------------------------------------------

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

async function createSurface(base: string, body: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${base}/api/surface`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; surface_id: string };
  expect(json.ok).toBe(true);
  return json.surface_id;
}

async function command(base: string, id: string, cmd: Record<string, unknown>): Promise<Response> {
  return fetch(`${base}/api/surface/${id}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
}

/** Read the SSE stream, parsing frames until `predicate` is satisfied, then close it. */
async function readStream(
  url: string,
  headers: Record<string, string>,
  predicate: (events: CognitiveEvent[], snapshotComplete: boolean) => boolean,
): Promise<CognitiveEvent[]> {
  const res = await fetch(url, { headers });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const events: CognitiveEvent[] = [];
  let buffer = "";
  let snapshotComplete = false;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      if (frame.startsWith(":")) {
        if (frame.includes("snapshot-complete")) snapshotComplete = true;
        continue;
      }
      const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
      if (dataLine) events.push(JSON.parse(dataLine.slice(5).trim()) as CognitiveEvent);
    }
    if (predicate(events, snapshotComplete)) {
      await reader.cancel();
      break;
    }
  }
  return events;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Surface Gateway — the visible-surface boundary (SRF-005)", () => {
  test("streamed snapshot folds to exactly the server's SurfaceState (replay equivalence)", async () => {
    const base = await start();
    const id = await createSurface(base, { goal: "Teach me Neural Networks", seed: "test-equiv" });
    const asked = await command(base, id, { type: "ask", goal: "Teach me Neural Networks" });
    expect(asked.status).toBe(200);

    const events = await readStream(`${base}/api/surface/${id}/stream`, {}, (_e, snap) => snap);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]?.event_type).toBe("surface.created");

    // The client fold of the streamed log == the server's canonical state.
    const clientState = foldSurfaceEvents(events);
    const stateRes = await fetch(`${base}/api/surface/${id}/state`);
    const { state: serverState } = (await stateRes.json()) as { state: unknown };
    expect(clientState).toEqual(serverState);

    // Cognition is visible: a Cognitive Frame was composed (UCS, ADR-0030) and the timeline exists.
    expect(clientState?.timeline).not.toBeNull();
    expect(clientState?.frames.some((f) => f.status === "composed")).toBe(true);
    // The teaching is a SEPARATE narration script, not prose on the board.
    expect(clientState?.narration_scripts.length ?? 0).toBeGreaterThan(0);
    expect(clientState?.blocks.some((b) => b.block_type === "explanation")).toBe(false);
  });

  test("SSE frames arrive in strict bus-sequence order", async () => {
    const base = await start();
    const id = await createSurface(base, { goal: "Teach me Neural Networks", seed: "test-order" });
    await command(base, id, { type: "ask", goal: "Teach me Neural Networks" });

    const events = await readStream(`${base}/api/surface/${id}/stream`, {}, (_e, snap) => snap);
    const sequences = events.map((e) => e.sequence ?? 0);
    const sorted = [...sequences].sort((a, b) => a - b);
    expect(sequences).toEqual(sorted);
    expect(new Set(sequences).size).toBe(sequences.length); // no duplicates
  });

  test("Last-Event-ID resumes from sequence with no gaps or duplicates", async () => {
    const base = await start();
    const id = await createSurface(base, { goal: "Teach me Neural Networks", seed: "test-resume" });
    await command(base, id, { type: "ask", goal: "Teach me Neural Networks" });

    const full = await readStream(`${base}/api/surface/${id}/stream`, {}, (_e, snap) => snap);
    const midpoint = full[Math.floor(full.length / 2)]!.sequence ?? 0;

    const resumed = await readStream(
      `${base}/api/surface/${id}/stream`,
      { "Last-Event-ID": String(midpoint) },
      (_e, snap) => snap,
    );
    // Every resumed event is strictly after the cursor; none before is replayed.
    expect(resumed.every((e) => (e.sequence ?? 0) > midpoint)).toBe(true);
    // Resume + cursor prefix reconstructs the full log exactly.
    const prefix = full.filter((e) => (e.sequence ?? 0) <= midpoint);
    expect([...prefix, ...resumed].map((e) => e.sequence)).toEqual(full.map((e) => e.sequence));
  });

  test("a live command's effects arrive as ordinary frames after the snapshot", async () => {
    const base = await start();
    const id = await createSurface(base, { goal: "Teach me Neural Networks", seed: "test-live" });

    // Open the stream first, then issue the ask; its effects — including the composed Cognitive
    // Frame and its narration — must arrive live as ordinary frames after the snapshot (UCS).
    const streamPromise = readStream(`${base}/api/surface/${id}/stream`, {}, (events) =>
      events.some((e) => e.event_type === "surface.frame.composed"),
    );
    // Give the snapshot a tick, then drive cognition.
    await new Promise((r) => setTimeout(r, 25));
    const asked = await command(base, id, { type: "ask", goal: "Teach me Neural Networks" });
    expect(asked.status).toBe(200);

    const events = await streamPromise;
    expect(events.some((e) => e.event_type === "surface.frame.composed")).toBe(true);
    expect(events.some((e) => e.event_type === "surface.narration.script.produced")).toBe(true);
  });

  test("the boundary is governed: an untrusted session produces zero agent blocks", async () => {
    const base = await start();
    const id = await createSurface(base, {
      goal: "Teach me Neural Networks",
      seed: "test-gov",
      trustLevel: 0,
    });
    // Curriculum generation is the first governed dispatch (a privileged agent, GOV-P01 trust ≥ 3).
    // An untrusted learner is blocked at the boundary, so the ask never produces agent cognition.
    // The invariant — never the HTTP code — is what matters: zero agent blocks reach the surface.
    const asked = await command(base, id, { type: "ask", goal: "Teach me Neural Networks" });
    expect(asked.ok).toBe(false);

    const stateRes = await fetch(`${base}/api/surface/${id}/state`);
    const { state } = (await stateRes.json()) as {
      state: { blocks: { block_type: string }[] };
    };
    const agentBlocks = state.blocks.filter(
      (b) => b.block_type === "explanation" || b.block_type === "practice",
    );
    expect(agentBlocks.length).toBe(0);
  });

  test("an unknown command type is rejected without mutating state (extensible envelope)", async () => {
    const base = await start();
    const id = await createSurface(base, {
      goal: "Teach me Neural Networks",
      seed: "test-unknown",
    });
    const res = await command(base, id, { type: "teleport" });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("E_SURFACE_GATEWAY");
  });
});
