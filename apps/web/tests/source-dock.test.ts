/**
 * SourceDock pure helpers (CSE-017, ADR-0056): modality inference (with honest refusal before
 * upload) and the canonicalization narrative built from the pipeline's OWN registration summary.
 */
import { afterEach, describe, expect, test } from "vitest";
import { describeLayers, inferModality } from "../src/components/SourceDock";
import { attachSource, teachSource, type RegisteredSourceView } from "../src/api";

describe("inferModality", () => {
  test("maps supported extensions to their modality + binary flag", () => {
    expect(inferModality("chapter.pdf")).toMatchObject({ modality: "pdf", binary: true });
    expect(inferModality("notes.md")).toMatchObject({ modality: "markdown", binary: false });
    expect(inferModality("readme.txt")).toMatchObject({ modality: "text", binary: false });
    expect(inferModality("main.rs")).toMatchObject({ modality: "code", binary: false });
    expect(inferModality("lecture.vtt")).toMatchObject({ modality: "video", binary: false });
    expect(inferModality("analysis.ipynb")).toMatchObject({ modality: "notebook", binary: false });
    expect(inferModality("data.csv")).toMatchObject({ modality: "dataset", binary: false });
    expect(inferModality("page.html")).toMatchObject({ modality: "web", binary: false });
  });

  test("refuses unadaptered modalities BEFORE upload with a nearest-path note (honest refusal)", () => {
    const epub = inferModality("book.epub");
    expect(epub.modality).toBeNull();
    expect(epub.note).toMatch(/PDF/i);
    expect(inferModality("deck.pptx").modality).toBeNull();
    expect(inferModality("talk.mp3").note).toMatch(/transcript/i);
    expect(inferModality("mystery.xyz").modality).toBeNull(); // unknown ⇒ refused, not a 422 later
  });
});

describe("describeLayers", () => {
  const base: RegisteredSourceView = {
    source_id: "src-1",
    source_version_id: "srcv-1",
    modality: "pdf",
    title: "Backprop.pdf",
    content_hash: "abc",
    content_ref: "gateway://x",
    layers_available: ["structural", "semantic", "visual"],
    degraded_layers: [],
    usable: true,
  };

  test("narrates built layers in plain language and reports usability", () => {
    const d = describeLayers(base);
    expect(d.built.length).toBe(3);
    expect(d.built[0]).toMatch(/structure/i);
    expect(d.degraded).toHaveLength(0);
    expect(d.verdict).toMatch(/ready to teach/i);
  });

  test("flags degraded layers honestly and separates them from built ones", () => {
    const d = describeLayers({ ...base, degraded_layers: ["visual"] });
    expect(d.built.some((l) => /layout/i.test(l))).toBe(false); // visual is degraded, not built
    expect(d.degraded).toHaveLength(1);
    expect(d.degraded[0]).toMatch(/partial/i);
  });

  test("an unusable source says so, never pretends", () => {
    expect(describeLayers({ ...base, usable: false }).verdict).toMatch(/not yet usable/i);
  });
});

// ── Regression: the consent step must never fail silently ────────────────────────────────────
// Before this, `attachSource`/`teachSource` were called as `.catch(() => {})` and the dock closed
// regardless, so an upload that never reached the surface was indistinguishable from one that did:
// "I uploaded a document and nothing rendered." Both now throw the gateway's own message.
describe("attach/teach failure surfacing", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  const stub = (init: { ok: boolean; status: number; body: string }) => {
    globalThis.fetch = (async () => ({
      ok: init.ok,
      status: init.status,
      text: async () => init.body,
      json: async () => JSON.parse(init.body),
    })) as unknown as typeof fetch;
  };

  test("attachSource throws the gateway message on a non-OK response", async () => {
    stub({ ok: false, status: 404, body: "surface not found" });
    await expect(attachSource("srf-1", "srcv-1")).rejects.toThrow(/surface not found/);
  });

  test("attachSource throws on a non-JSON error body instead of an opaque parse error", async () => {
    // A cold-start gateway returns an HTML 502; res.json() used to throw before status was read.
    stub({ ok: false, status: 502, body: "<html>Bad Gateway</html>" });
    await expect(attachSource("srf-1", "srcv-1")).rejects.toThrow(/Bad Gateway/);
  });

  test("attachSource throws when the gateway answers ok:false", async () => {
    stub({ ok: true, status: 200, body: '{"ok":false}' });
    await expect(attachSource("srf-1", "srcv-1")).rejects.toThrow(/could not be bound/i);
  });

  test("teachSource throws when no timeline could be built", async () => {
    stub({ ok: true, status: 200, body: '{"ok":false}' });
    await expect(teachSource("srf-1", "srcv-1")).rejects.toThrow(/no timeline/i);
  });

  test("both resolve true on a healthy response", async () => {
    stub({ ok: true, status: 200, body: '{"ok":true}' });
    await expect(attachSource("srf-1", "srcv-1")).resolves.toBe(true);
    await expect(teachSource("srf-1", "srcv-1")).resolves.toBe(true);
  });
});
