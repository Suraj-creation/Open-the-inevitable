/**
 * "Teach this source" (R2c, ADR-0057 D3): the document becomes the timeline. `curriculumFor` derives
 * the teaching order from the source's own structure (L1 headings here, since the deterministic
 * gateway builds no L2), and `POST /api/surface/:id/teach-source` runs a source-fed ask over it.
 */
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type AddressInfo } from "node:net";
import { type Server } from "node:http";
import { NullVoiceRuntime } from "@inevitable/adapters";
import { SourceHub } from "../src/sources";
import { SurfaceHost } from "../src/host";
import { createGatewayServer } from "../src/server";

beforeAll(() => {
  delete process.env["GEMINI_API_KEY"]; // hermetic
});

const DOC = [
  "# Backpropagation",
  "",
  "The algorithm that trains neural networks by propagating error gradients backward.",
  "",
  "## The forward pass",
  "",
  "Inputs flow through the network to produce a prediction.",
  "",
  "## The backward pass",
  "",
  "The chain rule distributes the loss gradient to every weight.",
].join("\n");

describe("curriculumFor — the document's own teaching order (R2c)", () => {
  test("derives a linear reading-order curriculum from L1 headings", async () => {
    const hub = new SourceHub();
    const reg = await hub.register({ content: DOC, modality: "markdown", title: "Backprop" });
    expect(reg.ok).toBe(true);
    if (!reg.ok) return;

    const curriculum = hub.curriculumFor(reg.value.source_version_id);
    expect(curriculum).not.toBeNull();
    const titles = curriculum!.concepts.map((c) => c.title);
    expect(titles).toEqual(["Backpropagation", "The forward pass", "The backward pass"]);
    // Reading order: each section depends on the previous one; the entry is the first heading.
    expect(curriculum!.entry).toBe(curriculum!.concepts[0]!.id);
    expect(curriculum!.concepts[0]!.prerequisites).toEqual([]);
    expect(curriculum!.concepts[1]!.prerequisites).toEqual([curriculum!.concepts[0]!.id]);
    expect(curriculum!.concepts[2]!.prerequisites).toEqual([curriculum!.concepts[1]!.id]);
  });

  test("a source with no headings has no teachable structure (caller stays in goal-mode)", async () => {
    const hub = new SourceHub();
    const reg = await hub.register({
      content: "Just a paragraph, no headings at all.",
      modality: "text",
      title: "Flat",
    });
    expect(reg.ok).toBe(true);
    if (!reg.ok) return;
    expect(hub.curriculumFor(reg.value.source_version_id)).toBeNull();
  });
});

let active: Server | null = null;
afterEach(async () => {
  if (active) await new Promise<void>((resolve) => active!.close(() => resolve()));
  active = null;
});

describe("POST /api/surface/:id/teach-source (R2c)", () => {
  test("teaches from a bound source; the timeline is the document's sections", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cos-teach-"));
    try {
      const host = new SurfaceHost({ persistDir: dir, voiceRuntime: new NullVoiceRuntime() });
      const server = createGatewayServer(host);
      active = server;
      const base = await new Promise<string>((resolve) => {
        server.listen(0, () => {
          const { port } = server.address() as AddressInfo;
          resolve(`http://127.0.0.1:${port}`);
        });
      });

      const reg = await fetch(`${base}/api/sources?modality=markdown&title=Backprop`, {
        method: "POST",
        headers: { "Content-Type": "text/markdown" },
        body: DOC,
      });
      const { source } = (await reg.json()) as { source: { source_version_id: string } };

      const created = await fetch(`${base}/api/surface`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: "Teach me Backprop", seed: "teach-src-1" }),
      });
      const { surface_id: id } = (await created.json()) as { surface_id: string };
      await fetch(`${base}/api/surface/${id}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_version_id: source.source_version_id }),
      });

      const taught = await fetch(`${base}/api/surface/${id}/teach-source`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(taught.status).toBe(200);

      const stateRes = await fetch(`${base}/api/surface/${id}/state`);
      const { state } = (await stateRes.json()) as {
        state: {
          timeline: { nodes: { title: string }[] } | null;
          viewport_plans?: unknown[];
          latest_directive?: { focus?: { source_anchor_ref?: string | null } } | null;
        };
      };
      const nodeTitles = state.timeline?.nodes.map((n) => n.title) ?? [];
      // The document's sections became the timeline (the document IS the timeline).
      expect(nodeTitles).toContain("Backpropagation");
      expect(nodeTitles.length).toBeGreaterThanOrEqual(3);
      // R2a–R2e wired end-to-end: the frame is projected FROM the source (a viewport plan exists)
      // and the Director points at the source region (its focus anchor is populated, not null).
      expect((state.viewport_plans ?? []).length).toBeGreaterThan(0);
      expect(state.latest_directive?.focus?.source_anchor_ref).toBeTruthy();
    } finally {
      if (active) await new Promise<void>((resolve) => active!.close(() => resolve()));
      active = null;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
