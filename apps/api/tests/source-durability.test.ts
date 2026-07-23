/**
 * Durable source plane (ADR-0055 D1/D2): the source substrate — registered versions + canonical
 * bytes, the knowledge commons, consent envelopes, and the redaction set — survives a gateway
 * restart. A registered source serves identical bytes under its ORIGINAL id after a restart; a
 * contribution's commons entry persists; and a consent revocation's withholding survives a deploy
 * (the content route still answers 410 Gone, never a 404). This closes the audit's "volatility gap"
 * (the source plane was process-lifetime; a restart forgot a learner's revocation).
 */
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type AddressInfo } from "node:net";
import { type Server } from "node:http";
import { NullVoiceRuntime } from "@inevitable/adapters";
import { SurfaceHost } from "../src/host";
import { createGatewayServer } from "../src/server";

beforeAll(() => {
  delete process.env["GEMINI_API_KEY"]; // hermetic: never a live network call
});

let active: Server | null = null;
afterEach(async () => {
  if (active) await new Promise<void>((resolve) => active!.close(() => resolve()));
  active = null;
});

/** Boot a gateway over a host pinned to `dir` (a "process"); awaits the durable-plane rehydrate. */
function boot(dir: string): Promise<string> {
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

async function stop(): Promise<void> {
  if (active) await new Promise<void>((resolve) => active!.close(() => resolve()));
  active = null;
}

interface RegisteredSource {
  source_id: string;
  source_version_id: string;
  content_hash: string;
}

describe("Durable source plane — cross-process recovery (ADR-0055)", () => {
  test("a registered source serves identical bytes under its original id after restart", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cos-src-"));
    try {
      const body = "# Backprop\n\nThe chain rule, applied backwards through the network.";

      // --- Process 1: register a markdown source. ---
      const base1 = await boot(dir);
      const reg = await fetch(`${base1}/api/sources?modality=markdown&title=Backprop`, {
        method: "POST",
        headers: { "Content-Type": "text/markdown" },
        body,
      });
      expect(reg.status).toBe(201);
      const { source: source1 } = (await reg.json()) as { source: RegisteredSource };
      await stop();

      // --- Process 2: a fresh gateway over the same dir rehydrated the source plane. ---
      const base2 = await boot(dir);
      const content = await fetch(`${base2}/api/sources/${source1.source_version_id}/content`);
      expect(content.status).toBe(200);
      expect(content.headers.get("X-Content-Hash")).toBe(source1.content_hash);
      expect(await content.text()).toBe(body);

      // The rehydrated version is attachable (registered() resolves it) — the Living Reference and
      // Fuse gate work again. Create a fresh surface and bind it.
      const created = await fetch(`${base2}/api/surface`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: "Teach me Backprop", seed: "src-durable-1" }),
      });
      const { surface_id: id } = (await created.json()) as { surface_id: string };
      const attach = await fetch(`${base2}/api/surface/${id}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_version_id: source1.source_version_id }),
      });
      expect(attach.status).toBe(200);
    } finally {
      await stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a contribution's commons entry persists, and a revocation's redaction survives restart", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cos-src-"));
    try {
      // --- Process 1: author a creation, complete it, contribute it into the commons. ---
      const base1 = await boot(dir);
      const created = await fetch(`${base1}/api/surface`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: "Teach me Essays", seed: "src-durable-2" }),
      });
      const { surface_id: id } = (await created.json()) as { surface_id: string };

      const start = await fetch(`${base1}/api/surface/${id}/creation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "essay", title: "My take on gradient descent" }),
      });
      const { creation } = (await start.json()) as { creation: { creation_id: string } };
      const cid = creation.creation_id;

      await fetch(`${base1}/api/surface/${id}/creation/${cid}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: "Gradient descent walks downhill on the loss surface." }),
      });
      const contribute = await fetch(`${base1}/api/surface/${id}/creation/${cid}/contribute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: true }),
      });
      expect(contribute.status).toBe(200);
      const { source: contributed } = (await contribute.json()) as { source: RegisteredSource };
      const contributedId = contributed.source_version_id;

      const commons1 = await (await fetch(`${base1}/api/sources/commons`)).json();
      expect((commons1 as { commons: unknown[] }).commons.length).toBeGreaterThan(0);
      await stop();

      // --- Process 2: the commons + the contributed source survived the restart. ---
      const base2 = await boot(dir);
      const commons2 = (await (await fetch(`${base2}/api/sources/commons`)).json()) as {
        commons: { source_version_id: string }[];
      };
      expect(commons2.commons.some((e) => e.source_version_id === contributedId)).toBe(true);
      expect((await fetch(`${base2}/api/sources/${contributedId}/content`)).status).toBe(200);

      // Revoke consent (the rehydrated surface is live). The redaction cascades.
      const revoke = await fetch(`${base2}/api/surface/${id}/creation/${cid}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(revoke.status).toBe(200);
      expect((await fetch(`${base2}/api/sources/${contributedId}/content`)).status).toBe(410);
      await stop();

      // --- Process 3: the revocation survived the restart — still 410, still delisted. ---
      const base3 = await boot(dir);
      expect((await fetch(`${base3}/api/sources/${contributedId}/content`)).status).toBe(410);
      const commons3 = (await (await fetch(`${base3}/api/sources/commons`)).json()) as {
        commons: { source_version_id: string }[];
      };
      expect(commons3.commons.some((e) => e.source_version_id === contributedId)).toBe(false);
    } finally {
      await stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
