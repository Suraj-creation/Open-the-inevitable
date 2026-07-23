/**
 * M5 live e2e — the first learner-visible CSE (CSE-008; SRF-002 1.6.0).
 *
 * Drives the RUNNING gateway (PORT env, default 8899) over real HTTP with a real PDF and real
 * Gemini cognition:
 *   1. build a small PDF about gradient descent (pdf-lib, root devDep);
 *   2. POST /api/sources (register + canonicalize: structural + visual layers);
 *   3. GET  /api/sources/:id/content — client-side fidelity proof (sha-256 vs X-Content-Hash);
 *   4. create a surface, POST /api/surface/:id/sources (bind), then ask;
 *   5. read folded state: viewport plans (page+bbox geometry), semantic highlights, the attention
 *      contract, and the source_viewport element on a composed frame.
 *
 * Prints one proof line per stage. Exits non-zero on any broken invariant.
 */
import { createHash } from "node:crypto";

const BASE = `http://127.0.0.1:${process.env["PORT"] ?? 8899}`;

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

async function buildPdf(): Promise<Uint8Array> {
  const mod = (await import("pdf-lib")) as unknown as PdfLibModule;
  const doc = await mod.PDFDocument.create();
  const bold = await doc.embedFont(mod.StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(mod.StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  page.drawText("Gradient Descent", { x: 72, y: 720, size: 20, font: bold });
  page.drawText("Gradient descent minimizes a loss function by stepping against the gradient.", {
    x: 72,
    y: 680,
    size: 12,
    font: regular,
  });
  page.drawText("The learning rate controls the step size of each gradient descent update.", {
    x: 72,
    y: 620,
    size: 12,
    font: regular,
  });
  page.drawText("Too large a learning rate makes gradient descent diverge instead of converge.", {
    x: 72,
    y: 560,
    size: 12,
    font: regular,
  });
  return doc.save();
}

function fail(line: string): never {
  console.error(`FAIL ${line}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const pdf = await buildPdf();

  // 1–2. Register + canonicalize.
  const upload = await fetch(
    `${BASE}/api/sources?modality=pdf&title=${encodeURIComponent("Gradient Descent — Notes")}`,
    {
      method: "POST",
      body: Buffer.from(pdf),
    },
  );
  if (upload.status !== 201) fail(`upload status ${upload.status}: ${await upload.text()}`);
  const { source } = (await upload.json()) as {
    source: {
      source_id: string;
      source_version_id: string;
      content_hash: string;
      content_ref: string;
      layers_available: string[];
      usable: boolean;
    };
  };
  if (!source.usable || !source.layers_available.includes("visual")) {
    fail(`environment not usable/visual: ${JSON.stringify(source)}`);
  }
  console.log(
    `1 REGISTERED: ${source.source_version_id} | layers: ${source.layers_available.join("+")} | ref: ${source.content_ref}`,
  );

  // 3. Fidelity proof, exactly as the web client does it.
  const content = await fetch(`${BASE}/api/sources/${source.source_version_id}/content`);
  const served = new Uint8Array(await content.arrayBuffer());
  const computed = createHash("sha256").update(served).digest("hex");
  const headerHash = content.headers.get("x-content-hash");
  const fidelity = computed === headerHash && computed === source.content_hash;
  if (!fidelity) fail(`fidelity broken: computed ${computed} vs header ${headerHash}`);
  console.log(`2 FIDELITY: sha256(served) === X-Content-Hash === content_hash -> true`);

  // 4. Surface: create → bind → ask.
  const created = await fetch(`${BASE}/api/surface`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goal: "Teach me Gradient Descent" }),
  });
  const { surface_id } = (await created.json()) as { surface_id: string };
  const attach = await fetch(`${BASE}/api/surface/${surface_id}/sources`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source_version_id: source.source_version_id }),
  });
  if (attach.status !== 200) fail(`attach status ${attach.status}: ${await attach.text()}`);
  console.log(`3 ATTACHED: ${source.source_version_id} -> ${surface_id}`);

  const asked = await fetch(`${BASE}/api/surface/${surface_id}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "ask", goal: "Teach me Gradient Descent" }),
  });
  if (asked.status !== 200) fail(`ask status ${asked.status}: ${await asked.text()}`);

  // 5. Folded state: the projection chain.
  const stateRes = await fetch(`${BASE}/api/surface/${surface_id}/state`);
  const state = ((await stateRes.json()) as { state: Record<string, unknown> }).state as {
    sources: { modality: string; title: string }[];
    viewport_plans: {
      frame_id: string;
      viewports: {
        emphasis: string;
        region: { page: number | null; bbox: number[] | null; quote: string };
      }[];
    }[];
    viewport_changes: { cause: string }[];
    source_highlights: { amplitude: string; role: string; provenance_class: string }[];
    sync_bindings: { frame_id: string; bindings: unknown[] }[];
    narration_scripts: { frame_id: string }[];
    frames: {
      frame_id: string;
      title: string;
      mccr: {
        source_viewport: { content: { quote: string; region: { page: number | null } } } | null;
      } | null;
    }[];
  };

  if (state.sources.length !== 1) fail(`sources: ${state.sources.length}`);
  if (state.viewport_plans.length === 0) fail("no viewport plans");
  const plan = state.viewport_plans[0]!;
  const vp = plan.viewports[0]!;
  if (vp.emphasis !== "focus") fail(`first viewport emphasis ${vp.emphasis}`);
  if (vp.region.page === null || !vp.region.bbox) fail("focus viewport lacks page/bbox geometry");
  console.log(
    `4 VIEWPORT PLAN: frame ${plan.frame_id} | ${plan.viewports.length} viewports | focus p${vp.region.page} bbox[${vp.region.bbox.map((n) => Math.round(n)).join(",")}] | "${vp.region.quote.slice(0, 60)}..."`,
  );

  const focal = state.source_highlights.filter((h) => h.amplitude === "focal").length;
  if (state.source_highlights.length === 0 || focal === 0) fail("no highlights/focal");
  console.log(
    `5 HIGHLIGHTS: ${state.source_highlights.length} applied | ${focal} focal | roles: ${[...new Set(state.source_highlights.map((h) => h.role))].join(",")} | provenance: evidence`,
  );

  const sync = state.sync_bindings.find((b) => b.frame_id === plan.frame_id);
  if (!sync || sync.bindings.length === 0) fail("no attention contract for the planned frame");
  const planCause = state.viewport_changes.some((c) => c.cause === "plan");
  if (!planCause) fail("no plan-cause viewport change");
  console.log(
    `6 ATTENTION CONTRACT: ${sync.bindings.length} narration segments bound | initial viewport.changed cause=plan`,
  );

  const withEvidence = state.frames.find((f) => f.mccr?.source_viewport);
  if (!withEvidence) fail("no frame carries the source_viewport element");
  const ev = withEvidence.mccr!.source_viewport!;
  console.log(
    `7 EVIDENCE ON BOARD: "${withEvidence.title}" carries source_viewport (p${ev.content.region.page}): "${ev.content.quote.slice(0, 60)}..."`,
  );

  console.log("M5 LIVE E2E: ALL PROOFS PASSED");
}

main().catch((cause) => {
  console.error("FAIL", cause);
  process.exit(1);
});
