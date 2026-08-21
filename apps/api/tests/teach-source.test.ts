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
import { SourceHub, isFrontMatterHeading } from "../src/sources";
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

describe("isFrontMatterHeading — the non-teaching structural pages (Slice 2)", () => {
  test("flags front-/back-matter, including open-ended families (case/punctuation-insensitive)", () => {
    for (const h of [
      "Contents",
      "Table of Contents",
      "Preface",
      "Preface to the Second Edition",
      "FOREWORD",
      "Acknowledgements",
      "Acknowledgments",
      "Copyright",
      "Dedication",
      "About the Author",
      "About the Authors",
      "List of Figures",
      "Index",
      "Bibliography",
      "References",
      "Glossary",
    ]) {
      expect(isFrontMatterHeading(h)).toBe(true);
    }
  });

  test("keeps real chapters and ambiguous-but-teachable headings", () => {
    for (const h of [
      "Introduction",
      "Chapter 1: Foundations",
      "Prologue",
      "Appendix A: Notation",
      "Summary",
      "Index Funds", // NOT the back-matter "Index"
      "Prefaces in Ancient Texts", // NOT "Preface ..."
      "Backpropagation",
    ]) {
      expect(isFrontMatterHeading(h)).toBe(false);
    }
  });
});

const BOOK = [
  "# Contents",
  "",
  "A listing of the chapters that follow.",
  "",
  "# Preface to the Second Edition",
  "",
  "Thanks for reading this revised edition.",
  "",
  "# Introduction",
  "",
  "This book teaches gradient methods from the ground up.",
  "",
  "# Chapter 1: Foundations",
  "",
  "A function's gradient points uphill; we descend against it.",
  "",
  "# Index",
  "",
  "gradient, loss, minimum.",
].join("\n");

describe("curriculumFor — starts at the first real chapter (Slice 2)", () => {
  test("skips front-/back-matter, entering at the first teachable heading with no prerequisites", async () => {
    const hub = new SourceHub();
    const reg = await hub.register({ content: BOOK, modality: "markdown", title: "Gradients" });
    expect(reg.ok).toBe(true);
    if (!reg.ok) return;

    const curriculum = hub.curriculumFor(reg.value.source_version_id);
    expect(curriculum).not.toBeNull();
    const titles = curriculum!.concepts.map((c) => c.title);
    // Contents / Preface / Index are gone; Introduction (ambiguous, kept) leads into Chapter 1.
    expect(titles).toEqual(["Introduction", "Chapter 1: Foundations"]);
    expect(titles).not.toContain("Contents");
    expect(titles).not.toContain("Index");
    // The entry is the first REAL chapter and depends on nothing (we start at chapter 1, not preface).
    expect(curriculum!.entry).toBe(curriculum!.concepts[0]!.id);
    expect(curriculum!.concepts[0]!.title).toBe("Introduction");
    expect(curriculum!.concepts[0]!.prerequisites).toEqual([]);
    expect(curriculum!.concepts[1]!.prerequisites).toEqual([curriculum!.concepts[0]!.id]);
  });
});

describe("unifiedCurriculumFor — all attached books as one non-redundant timeline (Slice 3)", () => {
  const BOOK_A = [
    "# Vectors",
    "",
    "A vector has magnitude and direction.",
    "",
    "# Dot Product",
    "",
    "The dot product measures alignment.",
    "",
    "# Cross Product",
    "",
    "The cross product yields a perpendicular vector.",
  ].join("\n");
  const BOOK_B = [
    "# Dot Product",
    "",
    "Another treatment of the dot product.",
    "",
    "# Eigenvalues",
    "",
    "An eigenvalue scales its eigenvector.",
  ].join("\n");

  test("dedups shared concepts, appends distinctive ones, records cross-book coverage", async () => {
    const hub = new SourceHub();
    const a = await hub.register({ content: BOOK_A, modality: "markdown", title: "Book A" });
    const b = await hub.register({ content: BOOK_B, modality: "markdown", title: "Book B" });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    const av = a.value.source_version_id;
    const bv = b.value.source_version_id;

    const unified = hub.unifiedCurriculumFor([av, bv]);
    expect(unified).not.toBeNull();
    const titles = unified!.concepts.map((c) => c.title);
    // Lead book's order first, then Book B's distinctive concept — each taught ONCE (no redundancy).
    expect(titles).toEqual(["Vectors", "Dot Product", "Cross Product", "Eigenvalues"]);
    expect(titles.filter((t) => t === "Dot Product")).toHaveLength(1);

    const dot = unified!.concepts.find((c) => c.title === "Dot Product")!;
    expect(dot.primarySourceVersionId).toBe(av); // taught from the first book to introduce it
    expect([...dot.coveredBy].sort()).toEqual([av, bv].sort()); // both books' matching chapter

    const eig = unified!.concepts.find((c) => c.title === "Eigenvalues")!;
    expect(eig.primarySourceVersionId).toBe(bv);
    expect(eig.coveredBy).toEqual([bv]); // unique to Book B — taught from it alone

    // One connected linear reading order across books; entry depends on nothing.
    expect(unified!.entry).toBe(unified!.concepts[0]!.id);
    expect(unified!.concepts[0]!.prerequisites).toEqual([]);
    for (let i = 1; i < unified!.concepts.length; i += 1) {
      expect(unified!.concepts[i]!.prerequisites).toEqual([unified!.concepts[i - 1]!.id]);
    }
    expect(unified!.sourceVersionIds).toEqual([av, bv]);
  });

  test("returns null when no attached book has teachable structure", async () => {
    const hub = new SourceHub();
    const flat = await hub.register({
      content: "No headings here.",
      modality: "text",
      title: "Flat",
    });
    expect(flat.ok).toBe(true);
    if (!flat.ok) return;
    expect(hub.unifiedCurriculumFor([flat.value.source_version_id])).toBeNull();
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

describe("POST /api/surface/:id/teach-source across multiple books (Slice 3)", () => {
  const BOOK_A = [
    "# Vectors",
    "",
    "A vector has magnitude and direction.",
    "",
    "# Dot Product",
    "",
    "The dot product measures alignment.",
  ].join("\n");
  const BOOK_B = [
    "# Dot Product",
    "",
    "Another treatment of the dot product.",
    "",
    "# Eigenvalues",
    "",
    "An eigenvalue scales its eigenvector.",
  ].join("\n");

  test("with no source named, teaches all attached books as one non-redundant timeline", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cos-teach-multi-"));
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

      const post = (path: string, body: string, ct = "application/json") =>
        fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": ct }, body });

      const regA = await post(
        "/api/sources?modality=markdown&title=BookA",
        BOOK_A,
        "text/markdown",
      );
      const regB = await post(
        "/api/sources?modality=markdown&title=BookB",
        BOOK_B,
        "text/markdown",
      );
      const { source: sa } = (await regA.json()) as { source: { source_version_id: string } };
      const { source: sb } = (await regB.json()) as { source: { source_version_id: string } };

      const created = await post(
        "/api/surface",
        JSON.stringify({ goal: "Teach me linear algebra", seed: "teach-multi-1" }),
      );
      const { surface_id: id } = (await created.json()) as { surface_id: string };
      for (const v of [sa.source_version_id, sb.source_version_id]) {
        await post(`/api/surface/${id}/sources`, JSON.stringify({ source_version_id: v }));
      }

      const taught = await post(`/api/surface/${id}/teach-source`, JSON.stringify({}));
      expect(taught.status).toBe(200);

      const stateRes = await fetch(`${base}/api/surface/${id}/state`);
      const { state } = (await stateRes.json()) as {
        state: { timeline: { nodes: { title: string }[] } | null };
      };
      const nodeTitles = state.timeline?.nodes.map((n) => n.title) ?? [];
      // The timeline spans BOTH books' distinctive concepts (cross-book coverage)...
      expect(nodeTitles).toContain("Vectors");
      expect(nodeTitles).toContain("Eigenvalues");
      // ...with the concept both books share taught exactly once (no redundancy).
      expect(nodeTitles.filter((t) => t === "Dot Product")).toHaveLength(1);
    } finally {
      if (active) await new Promise<void>((resolve) => active!.close(() => resolve()));
      active = null;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
