/**
 * SourceDock pure helpers (CSE-017, ADR-0056): modality inference (with honest refusal before
 * upload) and the canonicalization narrative built from the pipeline's OWN registration summary.
 */
import { describe, expect, test } from "vitest";
import { describeLayers, inferModality } from "../src/components/SourceDock";
import type { RegisteredSourceView } from "../src/api";

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
