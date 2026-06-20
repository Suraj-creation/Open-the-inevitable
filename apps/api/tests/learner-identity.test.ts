/**
 * Durable learner identity & resume-by-learner (P2.2, DPS-003 / ADR-0010): learners are first-class,
 * durable, and own surfaces over time — replacing the hardcoded demo learner. A known learnerId reuses
 * the same identity (cid + trust) across a restart, and a learner's surfaces are discoverable.
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
  delete process.env["GEMINI_API_KEY"];
});

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "cos-learner-"));
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

interface Created {
  surface_id: string;
  learner_id: string;
}
async function create(base: string, body: Record<string, unknown>): Promise<Created> {
  const res = await fetch(`${base}/api/surface`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as Created;
}

interface LearnerView {
  ok: boolean;
  learner: { learner_id: string; cid: string; trust_level: number };
  surfaces: { surfaceId: string; goal: string }[];
}
async function getLearner(base: string, learnerId: string): Promise<LearnerView> {
  const res = await fetch(`${base}/api/learner/${learnerId}`);
  return (await res.json()) as LearnerView;
}

describe("Durable learner identity & resume-by-learner (P2.2)", () => {
  test("surfaces without a learnerId get distinct durable learners that own their surface", async () => {
    const base = await boot();
    const a = await create(base, { goal: "Teach me Neural Networks", seed: "li-a1" });
    const b = await create(base, { goal: "Teach me Photosynthesis", seed: "li-a2" });

    expect(a.learner_id).toBeTruthy();
    expect(a.learner_id).not.toBe(b.learner_id); // distinct learners

    const la = await getLearner(base, a.learner_id);
    const lb = await getLearner(base, b.learner_id);
    expect(la.learner.cid).not.toBe(lb.learner.cid); // distinct cognitive identities
    expect(la.surfaces.map((s) => s.surfaceId)).toEqual([a.surface_id]);
    expect(lb.surfaces.map((s) => s.surfaceId)).toEqual([b.surface_id]);
  });

  test("a known learnerId reuses the same identity across a restart and accrues surfaces", async () => {
    const base1 = await boot();
    const first = await create(base1, { goal: "Teach me Neural Networks", seed: "li-b1" });
    const before = await getLearner(base1, first.learner_id);
    const cid = before.learner.cid;
    const trust = before.learner.trust_level;

    await new Promise<void>((resolve) => active!.close(() => resolve()));
    active = null;

    // Restart: a fresh gateway over the same dir. Returning with the learnerId reuses the identity.
    const base2 = await boot();
    const second = await create(base2, {
      goal: "Teach me Photosynthesis",
      seed: "li-b2",
      learnerId: first.learner_id,
    });
    expect(second.learner_id).toBe(first.learner_id); // same durable learner across processes

    const after = await getLearner(base2, first.learner_id);
    expect(after.learner.cid).toBe(cid); // same cognitive identity
    expect(after.learner.trust_level).toBe(trust); // trust is durable, not re-negotiated
    // The learner now owns BOTH surfaces (resume-by-learner lists them).
    expect(after.surfaces.map((s) => s.surfaceId).sort()).toEqual(
      [first.surface_id, second.surface_id].sort(),
    );

    // The first surface still rehydrates live after restart (its learner record loaded for resume).
    const stateRes = await fetch(`${base2}/api/surface/${first.surface_id}/state`);
    const stateJson = (await stateRes.json()) as {
      ok: boolean;
      state: { blocks: unknown[] } | null;
    };
    expect(stateJson.state).not.toBeNull();
  });

  test("an unknown learnerId is never claimed — a fresh learner is minted instead", async () => {
    const base = await boot();
    const created = await create(base, {
      goal: "Teach me Neural Networks",
      seed: "li-c1",
      learnerId: "lnr-does-not-exist",
    });
    expect(created.learner_id).not.toBe("lnr-does-not-exist");
    // The bogus id resolves to nothing; the minted one resolves to a real learner.
    expect((await fetch(`${base}/api/learner/lnr-does-not-exist`)).status).toBe(404);
    const minted = await getLearner(base, created.learner_id);
    expect(minted.ok).toBe(true);
  });
});
