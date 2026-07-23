/**
 * M10 T3 live smoke (ADR-0048) — the VIDEO modality flows through the real cognition pipeline. A
 * timed transcript (WebVTT) is registered as `video`, canonicalized into structural cue regions +
 * the L4 temporal layer (timecodes), then the REAL canonicalizer (Gemini) extracts an L2 semantic
 * layer over the transcript — proving the whole M1–M9 pipeline works over video (with the new time
 * dimension). Transcription is the client's/upstream's job (deferred, ADR-0048); the harness supplies
 * a transcript. Run from repo ROOT: `npx tsx apps/api/scripts/m10-video-smoke.ts` (needs GEMINI_API_KEY).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GeminiModelRuntime } from "@inevitable/adapters";
import { InMemoryEventBus } from "@inevitable/events";
import { WorldStateGraph, KnowledgeGraphEngine } from "../../../packages/world-state/src/index";
import {
  SourceEnvironmentStore,
  VideoTranscriptAdapter,
  type SourceProvenance,
  type TemporalLayerContent,
} from "@inevitable/source-environment";
import {
  MVP_AGENT_MANIFESTS,
  SourceCanonicalizationService,
  SourceCanonicalizerUnit,
  type CanonicalizerDispatch,
} from "@inevitable/product-cognition";

function loadEnv(): void {
  const file = resolve(process.cwd(), ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (k && process.env[k] === undefined) process.env[k] = v;
  }
}

const PROVENANCE: SourceProvenance = {
  origin: "upload",
  attributed_source: "m10-video-smoke",
  license_class: null,
  consent_ref: null,
};

// A short lecture transcript on gradient descent (WebVTT).
const VTT = `WEBVTT

00:00:00.000 --> 00:00:08.000
Gradient descent is an optimization algorithm that minimizes a loss function by repeatedly stepping
in the direction opposite the gradient.

00:00:08.000 --> 00:00:16.000
The learning rate is a hyperparameter that sets how large each step is; too large and the iterates
overshoot and diverge, too small and training is slow.

00:00:16.000 --> 00:00:24.000
On a convex loss surface, gradient descent converges to the global minimum; on the non-convex
surfaces of neural networks it can settle in a local minimum or a saddle point.

00:00:24.000 --> 00:00:32.000
Stochastic gradient descent estimates the gradient from a small batch of examples, trading exactness
for far cheaper, more frequent updates.
`;

function fail(msg: string): never {
  console.error(`FAIL ${msg}`);
  process.exit(1);
}

function mkPacket(
  versionId: string,
  regions: readonly { path: string; kind: string; text: string }[],
): unknown {
  return {
    packet_id: "pkt-semantic-video",
    schema_version: "1.0.0",
    source_cid: "cog-smoke",
    target_cid: "agent.canonicalizer",
    tenant_id: null,
    session_id: null,
    causation_id: null,
    correlation_id: null,
    timestamp: "2026-07-17T00:00:00Z",
    hlc: "0000000000000001-00000000-smoke",
    sequence_number: 0,
    packet_type: "request",
    intent: "canonicalize-semantic",
    concept_ids: [],
    domain_ids: [],
    content: {
      layer: "semantic",
      version_id: versionId,
      regions: regions.map((r) => ({ path: r.path, kind: r.kind, text: r.text })),
      intent_lease_id: "lease-smoke",
    },
    evidence: [],
    confidence: 1,
    uncertainty_estimate: 0,
    reasoning_depth: 0,
    classification: "internal",
    policy_tags: [],
    requires_human_review: false,
    priority: 4,
    expiry: null,
  };
}

async function main(): Promise<void> {
  loadEnv();
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) fail("GEMINI_API_KEY not set (repo-root .env)");
  const connected = await GeminiModelRuntime.connect({ apiKey });
  if (!connected.ok) fail(`Gemini connect failed: ${connected.error.message}`);
  const model = connected.value;

  const bus = new InMemoryEventBus();
  const store = new SourceEnvironmentStore({ bus, nodeId: "m10-video-smoke" });
  store.registerAdapter(new VideoTranscriptAdapter());
  const version = await store.registerVersion({
    modality: "video",
    content: VTT,
    provenance: PROVENANCE,
  });
  if (!version.ok) fail(version.error.message);
  const canon = await store.canonicalize(version.value.version_id);
  if (!canon.ok) fail(canon.error.message);

  const temporal = store.layer(version.value.version_id, "temporal");
  const segments = (temporal?.content as TemporalLayerContent | undefined)?.segments ?? [];
  console.log(
    `1 CANONICALIZED video: usable=${canon.value.usable} | layers=${canon.value.layers_available.join(",")}`,
  );
  console.log(
    `   temporal segments=${segments.length}, duration=${((temporal?.content as TemporalLayerContent)?.duration_ms ?? 0) / 1000}s`,
  );
  for (const s of segments)
    console.log(
      `   [${(s.start_ms / 1000).toFixed(0)}–${(s.end_ms / 1000).toFixed(0)}s] ${s.region_path}`,
    );

  const world = new WorldStateGraph();
  const kg = new KnowledgeGraphEngine(world);
  const canonManifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.canonicalizer")!;
  const canonUnit = new SourceCanonicalizerUnit({ manifest: canonManifest, model });
  const dispatch: CanonicalizerDispatch = async (input) => {
    const emissions = await canonUnit.execute(mkPacket(input.versionId, input.regions) as never);
    const out = emissions.packets?.[0];
    if (!out) fail("canonicalizer produced no packet");
    return { ok: true, value: out } as never;
  };
  const service = new SourceCanonicalizationService({ store, dispatch, kg });
  const semantic = await service.canonicalizeSemantic(version.value.version_id);
  if (!semantic.ok) fail(semantic.error.message);

  console.log(
    `2 SEMANTIC (L2 over transcript): degraded=${semantic.value.degraded} | concepts=${semantic.value.conceptsExtracted} | KG=${semantic.value.conceptsBoundToKg} | anchors=${semantic.value.anchorsCreated}`,
  );
  const semLayer = store.layer(version.value.version_id, "semantic");
  const concepts = (semLayer?.content as { concepts?: { label: string }[] })?.concepts ?? [];
  for (const c of concepts) console.log(`   • ${c.label}`);

  if (segments.length < 2) fail("expected ≥2 temporal segments");
  if (semantic.value.conceptsExtracted === 0) fail("no concepts extracted over the transcript");
  console.log(
    semantic.value.degraded
      ? "M10 VIDEO LIVE SMOKE: transcript → structural + temporal + pipeline PASSED (semantic degraded — honest)"
      : "M10 VIDEO LIVE SMOKE: PASSED (transcript → cue regions + L4 temporal → real L2 concepts, degraded:false)",
  );
}

main().catch((cause) => {
  console.error("FAIL", cause);
  process.exit(1);
});
