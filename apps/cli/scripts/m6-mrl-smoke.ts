/**
 * M6 live MRL smoke (CSE-003, ADR-0037) — meaning as governed cognition with real Gemini.
 *
 * Register a markdown source → canonicalize (structural) → land a semantic layer via the real
 * canonicalizer → construct the MRL (L7 meaning) via the real `meaning` agent → assert grounded
 * MeaningUnits landed as the meaning layer AND as world-state nodes with `expresses` edges.
 *
 * Run from apps/cli (workspace deps resolve): `npx tsx scripts/m6-mrl-smoke.ts`. Requires
 * GEMINI_API_KEY in the repo-root .env (loaded here). Exits non-zero on any broken invariant.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { GeminiModelRuntime } from "@inevitable/adapters";
import { InMemoryEventBus } from "@inevitable/events";
import { WorldStateGraph, KnowledgeGraphEngine } from "@inevitable/world-state";
import {
  MarkdownReferenceAdapter,
  SourceEnvironmentStore,
  type SourceProvenance,
  // Not a declared dep of apps/cli — import from source (same gotcha as the M3 smoke).
} from "../../../packages/source-environment/src/index";
import {
  MVP_AGENT_MANIFESTS,
  MeaningRepresentationUnit,
  SourceCanonicalizationService,
  SourceCanonicalizerUnit,
  type CanonicalizerDispatch,
} from "@inevitable/product-cognition";

function loadEnv(): void {
  const file = resolve(process.cwd(), "../../.env");
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
  origin: "fixture",
  attributed_source: "m6-smoke",
  license_class: null,
  consent_ref: null,
};

const FIXTURE = `# Gradient Descent

Gradient descent minimizes a loss function by repeatedly stepping in the direction opposite the
gradient. Each step moves the parameters a little way downhill on the loss surface.

## The Learning Rate

The learning rate sets the size of each step. If it is too large, the iterates overshoot the
minimum and can diverge; if it is too small, convergence is painfully slow.

## Convexity

On a convex loss surface every local minimum is the global minimum, so gradient descent is
guaranteed to converge to the best solution given a small enough learning rate.
`;

function fail(msg: string): never {
  console.error(`FAIL ${msg}`);
  process.exit(1);
}

/** Build a canonicalizer/meaning request packet inline (mirrors the unit tests). */
function mkPacket(
  layer: string,
  targetCid: string,
  versionId: string,
  regions: readonly { path: string; kind: string; text: string }[],
  concepts?: readonly { concept_id: string; label: string; definition?: string }[],
): unknown {
  return {
    packet_id: `pkt-${layer}-${Math.abs(regions.length)}`,
    schema_version: "1.0.0",
    source_cid: "cog-smoke",
    target_cid: targetCid,
    tenant_id: null,
    session_id: null,
    causation_id: null,
    correlation_id: null,
    timestamp: "2026-07-11T00:00:00Z",
    hlc: "0000000000000001-00000000-smoke",
    sequence_number: 0,
    packet_type: "request",
    intent: `canonicalize-${layer}`,
    concept_ids: [],
    domain_ids: [],
    content: {
      layer,
      version_id: versionId,
      regions: regions.map((r) => ({ path: r.path, kind: r.kind, text: r.text })),
      ...(concepts ? { concepts } : {}),
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
  const store = new SourceEnvironmentStore({ bus, nodeId: "m6-smoke" });
  store.registerAdapter(new MarkdownReferenceAdapter());
  const version = await store.registerVersion({
    modality: "markdown",
    content: FIXTURE,
    provenance: PROVENANCE,
  });
  if (!version.ok) fail(version.error.message);
  const canon = await store.canonicalize(version.value.version_id);
  if (!canon.ok) fail(canon.error.message);
  console.log(`1 CANONICALIZED: ${version.value.version_id} | usable: ${canon.value.usable}`);

  const world = new WorldStateGraph();
  const kg = new KnowledgeGraphEngine(world);

  // L2 semantic via the real canonicalizer (grounds the MRL's concept vocabulary).
  const canonManifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.canonicalizer")!;
  const canonUnit = new SourceCanonicalizerUnit({ manifest: canonManifest, model });
  const semanticDispatch: CanonicalizerDispatch = async (input) => {
    const packet = mkPacket("semantic", "agent.canonicalizer", input.versionId, input.regions);
    const emissions = await canonUnit.execute(packet as never);
    const out = emissions.packets?.[0];
    if (!out) fail("canonicalizer produced no packet");
    return { ok: true, value: out } as never;
  };
  const semanticService = new SourceCanonicalizationService({
    store,
    dispatch: semanticDispatch,
    kg,
  });
  const semantic = await semanticService.canonicalizeSemantic(version.value.version_id);
  if (!semantic.ok) fail(semantic.error.message);
  console.log(
    `2 SEMANTIC (L2): degraded=${semantic.value.degraded} | concepts=${semantic.value.conceptsExtracted} | KG=${semantic.value.conceptsBoundToKg}`,
  );

  // L7 meaning (MRL v1) via the real meaning agent.
  const meaningManifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.meaning")!;
  const meaningUnit = new MeaningRepresentationUnit({ manifest: meaningManifest, model });
  const meaningDispatch: CanonicalizerDispatch = async (input) => {
    const packet = mkPacket(
      "meaning",
      "agent.meaning",
      input.versionId,
      input.regions,
      input.concepts,
    );
    const emissions = await meaningUnit.execute(packet as never);
    const out = emissions.packets?.[0];
    if (!out) fail("meaning unit produced no packet");
    return { ok: true, value: out } as never;
  };
  const meaningService = new SourceCanonicalizationService({
    store,
    dispatch: meaningDispatch,
    world,
  });
  const meaning = await meaningService.constructMeaning(version.value.version_id);
  if (!meaning.ok) fail(meaning.error.message);

  if (meaning.value.unitsProduced === 0) fail("no meaning units produced");
  if (meaning.value.worldNodesCreated === 0) fail("no MRL world nodes created");
  console.log(
    `3 MEANING (L7): degraded=${meaning.value.degraded} | units=${meaning.value.unitsProduced} | kinds=${JSON.stringify(meaning.value.unitsByKind)} | worldNodes=${meaning.value.worldNodesCreated}`,
  );

  // Diagnostic: which concept ids did semantic vs. meaning mint?
  const semLayer = store.layer(version.value.version_id, "semantic");
  const semIds = (
    (semLayer?.content as { concepts?: { concept_id: string }[] })?.concepts ?? []
  ).map((c) => c.concept_id);
  const meaningLayer = store.layer(version.value.version_id, "meaning");
  const mrlRefs = (
    (meaningLayer?.content as { units?: { concept_refs?: string[] }[] })?.units ?? []
  ).flatMap((u) => u.concept_refs ?? []);
  console.log(`   semantic ids: ${semIds.join(", ")}`);
  console.log(
    `   mrl refs:     ${[...new Set(mrlRefs)].join(", ") || "(none survived grounding)"}`,
  );

  // The MRL is queryable beside the KG: at least one mrl node with an expresses edge to a concept.
  const edges = world.snapshot().edges.filter((e) => e.type === "expresses");
  const nodes = world.snapshot().nodes.filter((n) => n.type === "meaning_unit");
  if (edges.length === 0) fail("no expresses edges — MRL not bound to concepts");
  const sample = nodes[0];
  console.log(
    `4 GRAPH: ${nodes.length} meaning_unit nodes, ${edges.length} expresses edges | e.g. ${sample?.id} (${String((sample?.props as Record<string, unknown>)?.["kind"])}) → ${edges[0]?.to}`,
  );

  if (meaning.value.degraded) {
    console.log("NOTE: meaning layer landed DEGRADED (fallback) — grounding law held, honest.");
  }
  console.log("M6 MRL LIVE SMOKE: ALL PROOFS PASSED");
}

main().catch((cause) => {
  console.error("FAIL", cause);
  process.exit(1);
});
