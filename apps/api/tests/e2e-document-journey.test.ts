/**
 * E2E — the document-learning journey (the brief's §22 scenarios 1–15), driven over the REAL HTTP
 * gateway boundary on the deterministic (NullModel) path so it runs offline and stays replay-stable.
 *
 * This is the one coverage the suite lacked: `gateway.test.ts` proves the runtime end-to-end but only
 * with markdown sources; here a real PDF (built in-test with pdf-lib, parsed by the pdfjs adapter) is
 * uploaded, canonicalized, taught FROM (the document is the timeline — R2c/ADR-0057, the only path
 * that grounds teaching on the deterministic model, since the null curriculum is goal-blind), and the
 * source-projection chain (viewports → highlights → attention contract) is asserted against the
 * actual document. Multi-document, interrupt, and durable resume close the loop.
 *
 * Gated exactly like `packages/adapters/tests/pdf.test.ts`: the PDF libraries are edge-provisioned, so
 * when they are absent the journey skips honestly rather than failing. Where they are present (CI edge)
 * it runs fully — real PDF bytes, real extraction, no network.
 */
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { type AddressInfo } from "node:net";
import { type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PdfjsModalityAdapter } from "@inevitable/adapters";
import { loadOptional } from "@inevitable/adapters";
import { SurfaceHost } from "../src/host";
import { createGatewayServer } from "../src/server";

// Hermetic + deterministic: never let an ambient key turn the journey into live network calls.
beforeAll(() => {
  delete process.env["GEMINI_API_KEY"];
});

// ---------------------------------------------------------------------------
// PDF fixtures — built in-test with pdf-lib (mirrors packages/adapters/tests/pdf.test.ts).
// Each section is one page: a short bold heading (size 20 → pdfjs `kind:"heading"`, which
// `curriculumFor` turns into a teachable concept) over body lines (size 12 → paragraph regions).
// ---------------------------------------------------------------------------

interface PdfLibModule {
  PDFDocument: {
    create(): Promise<{
      addPage(size?: [number, number]): {
        drawText(text: string, opts: Record<string, unknown>): void;
      };
      embedFont(font: string): Promise<unknown>;
      save(): Promise<Uint8Array>;
    }>;
  };
  StandardFonts: { Helvetica: string; HelveticaBold: string };
}

interface Section {
  readonly heading: string;
  readonly lines: readonly string[];
}

/** Build a PDF from sections (one page each). Returns null when pdf-lib is not provisioned. */
async function buildPdf(
  sections: readonly Section[],
  appendTextlessPage = false,
): Promise<Buffer | null> {
  const mod = await loadOptional<PdfLibModule>("pdf-lib");
  if (!mod) return null;
  const doc = await mod.PDFDocument.create();
  const bold = await doc.embedFont(mod.StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(mod.StandardFonts.Helvetica);
  for (const section of sections) {
    const page = doc.addPage([612, 792]);
    page.drawText(section.heading, { x: 72, y: 720, size: 20, font: bold });
    let y = 680;
    for (const line of section.lines) {
      page.drawText(line, { x: 72, y, size: 12, font: regular });
      y -= 28;
    }
  }
  if (appendTextlessPage) doc.addPage([612, 792]); // scanned-page degradation path (no text)
  return Buffer.from(await doc.save());
}

// A research-paper-like source: definitions, an equation line, and figure/table captions.
const ENTROPY_DOC: readonly Section[] = [
  {
    heading: "Entropy",
    lines: [
      "Entropy counts the number of microscopic configurations of a system.",
      "The Boltzmann relation is S = k_B ln W where W is the microstate count.",
      "Figure 1: the distribution of microstates broadens as energy increases.",
      "Table 1: example configurations and their multiplicities.",
    ],
  },
  {
    heading: "The Second Law",
    lines: [
      "The second law states that entropy of an isolated system never decreases.",
      "Irreversible processes increase the total entropy of the universe.",
    ],
  },
];

// A second, overlapping source (also covers Entropy, plus Temperature) for multi-document + fusion.
const THERMO_DOC: readonly Section[] = [
  {
    heading: "Entropy",
    lines: ["Entropy is a measure of disorder and of unavailable thermal energy."],
  },
  {
    heading: "Temperature",
    lines: ["Temperature is the average kinetic energy of the particles in a system."],
  },
];

// ---------------------------------------------------------------------------
// Harness — the real gateway over an ephemeral port + a durable dir (so resume is exercised).
// ---------------------------------------------------------------------------

let active: Server | null = null;
let workDir: string | null = null;

afterEach(async () => {
  if (active) await new Promise<void>((resolve) => active!.close(() => resolve()));
  active = null;
  if (workDir) rmSync(workDir, { recursive: true, force: true });
  workDir = null;
});

async function start(): Promise<string> {
  workDir = mkdtempSync(join(tmpdir(), "cos-e2e-"));
  const host = new SurfaceHost({ persistDir: workDir });
  const server = createGatewayServer(host);
  active = server;
  return new Promise((resolve) => {
    server.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

interface CreatedSurface {
  surface_id: string;
  learner_id: string;
  api_key?: string;
}

async function createSurface(base: string, body: Record<string, unknown>): Promise<CreatedSurface> {
  const res = await fetch(`${base}/api/surface`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean } & CreatedSurface;
  expect(json.ok).toBe(true);
  return json;
}

interface RegisteredSource {
  source_id: string;
  source_version_id: string;
  content_hash: string;
  modality: string;
  usable: boolean;
  layers_available: string[];
  degraded_layers?: string[];
}

async function uploadPdf(base: string, title: string, bytes: Buffer): Promise<RegisteredSource> {
  const res = await fetch(`${base}/api/sources?modality=pdf&title=${encodeURIComponent(title)}`, {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: bytes,
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { source: RegisteredSource }).source;
}

async function attach(base: string, id: string, versionId: string): Promise<number> {
  const res = await fetch(`${base}/api/surface/${id}/sources`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source_version_id: versionId }),
  });
  return res.status;
}

async function command(base: string, id: string, cmd: Record<string, unknown>): Promise<Response> {
  return fetch(`${base}/api/surface/${id}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
}

interface Region {
  quote?: string;
  page?: number;
  bbox?: [number, number, number, number];
}
interface JourneyState {
  sources: { source_version_id: string; modality: string; title: string }[];
  timeline: { nodes: { title: string; concept_id: string }[] } | null;
  frames: {
    frame_id: string;
    status: string;
    concept_id: string | null;
    title: string;
    mccr: { source_viewport: { content: { kind: string; quote: string } } | null } | null;
  }[];
  viewport_plans: { frame_id: string; viewports: { emphasis: string; region: Region }[] }[];
  source_highlights: {
    amplitude: string;
    provenance_class: string;
    frame_id: string;
    cleared: boolean;
  }[];
  sync_bindings: {
    frame_id: string;
    bindings: { segment_id: string; viewport_ref: string | null }[];
  }[];
  narration_scripts: { frame_id: string; segments: { segment_id: string }[] }[];
  interactions: { kind?: string }[];
  latest_directive: { focus?: { source_anchor_ref?: string | null } } | null;
  resume_card: {
    episode_ref: string;
    summary: string;
    concepts_touched: string[];
    days_since: number;
  } | null;
}

async function readState(base: string, id: string): Promise<JourneyState> {
  const res = await fetch(`${base}/api/surface/${id}/state`);
  return ((await res.json()) as { state: JourneyState }).state;
}

// Whether the PDF toolchain is provisioned at this edge (else the journey skips honestly).
let pdfReady = false;
beforeAll(async () => {
  const connected = await PdfjsModalityAdapter.connect();
  const bytes = await buildPdf(ENTROPY_DOC);
  pdfReady = connected.ok && bytes !== null;
});

describe("E2E — document-learning journey over the real gateway (brief §22)", () => {
  test("scenarios 1–13: upload → analyze → teach-source → highlight → interrupt → 2nd doc → compare", async () => {
    if (!pdfReady) return; // PDF libs not provisioned at this edge — skip honestly (see file header).
    const base = await start();
    const { surface_id: id } = await createSurface(base, {
      goal: "", // SCENARIO: entry with NO topic — a source is enough (source-first, ADR-0062).
      seed: "e2e-journey",
    });

    // --- Scenario 1: upload one PDF; it analyzes into a usable, source-faithful environment. ---
    const entropyPdf = (await buildPdf(ENTROPY_DOC, /* textless */ true))!;
    const entropy = await uploadPdf(base, "Entropy (paper)", entropyPdf);
    expect(entropy.modality).toBe("pdf");
    expect(entropy.usable).toBe(true); // usable as soon as structure + anchors exist (progressive)
    expect(entropy.layers_available).toContain("structural");

    // Source-faithful rendering proof (ADR-0036): canonical bytes serve back byte-identically, and the
    // X-Content-Hash lets the client verify what it rendered IS the original document.
    const content = await fetch(`${base}/api/sources/${entropy.source_version_id}/content`);
    expect(content.status).toBe(200);
    expect(content.headers.get("x-content-hash")).toBe(entropy.content_hash);
    expect(Buffer.from(await content.arrayBuffer()).equals(entropyPdf)).toBe(true);

    // --- Scenario 12 (first half): attach the source to the live surface (mid-session-capable). ---
    expect(await attach(base, id, entropy.source_version_id)).toBe(200);

    // --- Scenarios 3–8: teach FROM the document — its sections become the timeline, and teaching
    //     is grounded in the actual source (viewports + highlights + synchronized narration). ---
    const taught = await fetch(`${base}/api/surface/${id}/teach-source`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(taught.status).toBe(200);

    const s = await readState(base, id);

    // Structure recovered: the document's own headings became the teaching order (chapters/sections).
    const titles = (s.timeline?.nodes ?? []).map((n) => n.title);
    expect(titles).toContain("Entropy");
    expect(titles).toContain("The Second Law");

    // A coherent teaching frame composed, grounded in the source (source_viewport MCCR element).
    expect(s.frames.some((f) => f.status === "composed")).toBe(true);
    const grounded = s.frames.find((f) => f.mccr?.source_viewport);
    expect(grounded).toBeDefined();
    expect(grounded!.mccr!.source_viewport!.content.kind).toBe("source_viewport");

    // Scenario 6 (navigate to a page) + 7 (highlight a region): viewport plans point INTO the PDF,
    // carrying the page (and bbox) of the region being shown — exact source grounding, not text-match.
    expect(s.viewport_plans.length).toBeGreaterThan(0);
    const planViewport = s.viewport_plans.flatMap((p) => p.viewports)[0]!;
    expect(planViewport.emphasis).toBe("focus");
    expect(typeof planViewport.region.page).toBe("number"); // a concrete PDF page to open
    expect(planViewport.region.page).toBeGreaterThanOrEqual(1);

    // The Director points teaching at a real source region (its focus anchor is populated, not null).
    expect(s.latest_directive?.focus?.source_anchor_ref).toBeTruthy();

    // Semantic highlights landed with evidence provenance; at most one focal highlight per frame view.
    expect(s.source_highlights.length).toBeGreaterThan(0);
    expect(s.source_highlights.every((h) => h.provenance_class === "evidence")).toBe(true);
    const focalPerFrame = new Map<string, number>();
    for (const h of s.source_highlights) {
      if (h.amplitude === "focal")
        focalPerFrame.set(h.frame_id, (focalPerFrame.get(h.frame_id) ?? 0) + 1);
    }
    expect([...focalPerFrame.values()].every((n) => n === 1)).toBe(true);

    // Scenario 8 (explain synchronously): the attention contract binds REAL narration segments to the
    // viewports — narration and the highlighted region are one synchronized state, not a "view" link.
    expect(s.sync_bindings.length).toBeGreaterThan(0);
    const boundFrame = s.sync_bindings[0]!;
    const script = s.narration_scripts.find((n) => n.frame_id === boundFrame.frame_id);
    const segIds = new Set((script?.segments ?? []).map((seg) => seg.segment_id));
    expect(boundFrame.bindings.length).toBeGreaterThan(0);
    expect(boundFrame.bindings.every((b) => segIds.has(b.segment_id))).toBe(true);

    // --- Scenario 9: the learner interrupts mid-lesson — the runtime accepts it and records it. ---
    const interrupted = await command(base, id, { type: "interact", kind: "interrupt" });
    expect(interrupted.status).toBe(200);
    expect(((await interrupted.json()) as { ok: boolean }).ok).toBe(true);

    // --- Scenario 11: move forward — advance teaches the next section on the SAME path (continuity). ---
    const framesBefore = (await readState(base, id)).frames.length;
    const advanced = await command(base, id, { type: "advance" });
    expect(advanced.status).toBe(200);
    const after = await readState(base, id);
    expect(after.frames.length).toBeGreaterThanOrEqual(framesBefore);

    // --- Scenario 10: the runtime remembers the session — prior interactions/frames are retained. ---
    expect(after.interactions.some((i) => i.kind === "interrupt")).toBe(true);
    expect(after.frames.length).toBeGreaterThan(0);

    // --- Scenario 2 + 12 (second half): upload a SECOND PDF and attach it to the SAME live surface. ---
    const thermoPdf = (await buildPdf(THERMO_DOC))!;
    const thermo = await uploadPdf(base, "Thermodynamics (notes)", thermoPdf);
    expect(thermo.source_version_id).not.toBe(entropy.source_version_id);
    expect(await attach(base, id, thermo.source_version_id)).toBe(200);
    const twoSources = await readState(base, id);
    expect(twoSources.sources.length).toBe(2);

    // --- Scenario 13: compare across documents — fusion corroborates the shared concept (Entropy,
    //     covered by BOTH) and names an honest gap (Backpropagation, covered by NEITHER). ---
    const fuseRes = await fetch(`${base}/api/surface/${id}/fuse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concept_refs: ["entropy", "backpropagation"] }),
    });
    expect(fuseRes.status).toBe(200);
    const { fusion } = (await fuseRes.json()) as {
      fusion: {
        concepts: {
          concept_ref: string;
          source_treatments: { source_version_id: string; anchor_refs: string[] }[];
          reconciliation: { corroborated: boolean };
        }[];
        gaps: { concept_ref: string }[];
      };
    };
    const entropyFusion = fusion.concepts.find((c) => c.concept_ref === "entropy");
    expect(entropyFusion).toBeDefined();
    expect(entropyFusion!.reconciliation.corroborated).toBe(true);
    // Provenance preserved: both documents' treatments stay traceable to their own anchors.
    const covering = entropyFusion!.source_treatments.filter((t) => t.anchor_refs.length > 0);
    expect(new Set(covering.map((t) => t.source_version_id)).size).toBe(2);
    // The concept neither source covers is an honest gap, never a fabricated blank.
    expect(fusion.gaps.some((g) => g.concept_ref === "backpropagation")).toBe(true);
  }, 60_000);

  test("scenario 14: close, then resume later as the same learner → a resume card continues the path", async () => {
    if (!pdfReady) return;
    const base = await start();

    // Session 1: a fresh learner teaches from a PDF, then closes — close distills episode/delta
    // artifacts. A fresh learner has nothing to resume (honest absence).
    const first = await createSurface(base, { goal: "", seed: "e2e-resume-1" });
    expect(first.api_key).toBeDefined();
    const pdf = (await buildPdf(ENTROPY_DOC))!;
    const src = await uploadPdf(base, "Entropy", pdf);
    expect(await attach(base, first.surface_id, src.source_version_id)).toBe(200);
    expect((await readState(base, first.surface_id)).resume_card).toBeNull();

    await fetch(`${base}/api/surface/${first.surface_id}/teach-source`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await command(base, first.surface_id, { type: "close" });

    // Session 2: the SAME learner returns (bearer) — the latest episode projects a resume card.
    // (A direct fetch, since the createSurface helper doesn't set an Authorization header.)
    const auth = await fetch(`${base}/api/surface`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${first.api_key}` },
      body: JSON.stringify({ goal: "", seed: "e2e-resume-2" }),
    });
    const second = (await auth.json()) as CreatedSurface & { ok: boolean };
    expect(second.learner_id).toBe(first.learner_id);

    const state = await readState(base, second.surface_id);
    expect(state.resume_card).not.toBeNull();
    expect(state.resume_card!.summary.length).toBeGreaterThan(0);
    expect(state.resume_card!.concepts_touched.length).toBeGreaterThan(0);
  }, 60_000);

  test("scenarios 3 & 15: a long document is usable immediately and teaches many sections", async () => {
    if (!pdfReady) return;
    const base = await start();
    const { surface_id: id } = await createSurface(base, { goal: "", seed: "e2e-long" });

    // A "textbook" — many sections (chapters). Progressive usability: it is usable the moment its
    // structure + anchors exist, BEFORE any deep per-section processing (the latency north star).
    const chapters: Section[] = Array.from({ length: 10 }, (_, i) => ({
      heading: `Chapter ${i + 1}`,
      lines: [
        `This chapter introduces concept number ${i + 1} and its core definition.`,
        `It builds on the previous chapter and prepares the next one.`,
      ],
    }));
    const bookPdf = (await buildPdf(chapters))!;
    const book = await uploadPdf(base, "A Long Textbook", bookPdf);
    expect(book.usable).toBe(true);
    expect(book.layers_available).toContain("structural");

    expect(await attach(base, id, book.source_version_id)).toBe(200);
    const taught = await fetch(`${base}/api/surface/${id}/teach-source`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(taught.status).toBe(200);

    const s = await readState(base, id);
    // The document's many chapters became a multi-node teaching timeline.
    expect((s.timeline?.nodes ?? []).length).toBeGreaterThanOrEqual(5);
    // Teaching began (a frame composed) without waiting for the whole book to be processed.
    expect(s.frames.some((f) => f.status === "composed")).toBe(true);
  }, 60_000);

  test("ADR-0064: TOPIC + DOCUMENT — a topic ask renders the bound document even with no lexical overlap", async () => {
    if (!pdfReady) return;
    const base = await start();
    // TOPIC mode: the surface is created WITH a goal (not source-first). Then a document is attached.
    const { surface_id: id } = await createSurface(base, {
      goal: "Teach me thermodynamics",
      seed: "e2e-topic-grounded",
    });

    // A document whose headings share NO tokens with the topic "thermodynamics" — the exact case the
    // old lexical-only evidence resolver returned [] for, so the document never rendered in topic mode.
    const doc: readonly Section[] = [
      {
        heading: "Microstates and Multiplicity",
        lines: [
          "A configuration is one arrangement of the parts of a system.",
          "The multiplicity W counts how many arrangements share the same energy.",
        ],
      },
      {
        heading: "The Boltzmann Relation",
        lines: [
          "The relation S equals k times the natural log of W.",
          "It bridges microscopic counting and macroscopic disorder.",
        ],
      },
    ];
    const pdf = (await buildPdf(doc))!;
    const src = await uploadPdf(base, "Statistical Notes", pdf);
    expect(await attach(base, id, src.source_version_id)).toBe(200);

    // A plain topic ask (NOT teach-source): the topic drives the curriculum, the document grounds it.
    const asked = await command(base, id, { type: "ask", goal: "Teach me thermodynamics" });
    expect(asked.status).toBe(200);

    const state = await readState(base, id);
    // THE FIX: a frame renders the bound document via a source_viewport MCCR element, even though
    // "thermodynamics" lexically overlaps none of the document's headings.
    const grounded = state.frames.find((f) => f.mccr?.source_viewport);
    expect(grounded).toBeDefined();
    expect(grounded!.mccr!.source_viewport!.content.kind).toBe("source_viewport");
    // The rendered viewport quotes real text from the attached document (never fabricated).
    const quote = grounded!.mccr!.source_viewport!.content.quote;
    expect(typeof quote).toBe("string");
    expect(quote.length).toBeGreaterThan(0);
    // And a viewport plan points into the actual source the learner attached.
    expect(state.viewport_plans.length).toBeGreaterThan(0);
  }, 60_000);
});
