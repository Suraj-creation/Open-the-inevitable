/**
 * CSE M3 — canonicalization as governed cognition. Covers: grounding-validated parsing (evidence
 * paths not in L1 are dropped; ungrounded concepts discarded), deterministic fallbacks landing as
 * honest DEGRADED layers, and the full service loop: dispatch → record layer → bind KG concepts →
 * create evidence anchors.
 */
import { describe, expect, it } from "vitest";
import type { ModelGenerationRequest, ModelGenerationResult } from "@inevitable/contracts";
import { ManualClock, SeededIdGenerator, err, ok, CosError } from "@inevitable/shared";
import { InMemoryEventBus } from "@inevitable/events";
import { WorldStateGraph, KnowledgeGraphEngine } from "@inevitable/world-state";
import {
  MarkdownReferenceAdapter,
  SOURCE_EVENT_TYPES,
  SourceEnvironmentStore,
  type SourceProvenance,
  type SourceVersionId,
} from "@inevitable/source-environment";
import {
  FALLBACK_LAYER_CONFIDENCE,
  MVP_AGENT_MANIFESTS,
  SourceCanonicalizationService,
  SourceCanonicalizerUnit,
  deterministicSemanticLayer,
  parseCitationLayerOutput,
  parseSemanticLayerOutput,
  type CanonicalizerDispatch,
} from "../src/index";

const PROVENANCE: SourceProvenance = {
  origin: "fixture",
  attributed_source: "tests/canonicalizer",
  license_class: null,
  consent_ref: null,
};

const FIXTURE = `# Thermodynamics

Entropy measures the number of microscopic configurations of a system (Boltzmann, 1877).

## The Second Law

The entropy of an isolated system never decreases over time.
`;

const VALID_PATHS = new Set(["h1-1", "h1-1/para-1", "h1-1/h2-1", "h1-1/h2-1/para-1"]);

const MODEL_SEMANTIC_JSON = JSON.stringify({
  concepts: [
    {
      concept_id: "entropy",
      label: "Entropy",
      definition: "The number of microscopic configurations of a system.",
      evidence_paths: ["h1-1/para-1", "not/a/real/path"],
      prerequisites: [],
    },
    {
      concept_id: "second-law",
      label: "The Second Law",
      definition: "Entropy of an isolated system never decreases.",
      evidence_paths: ["h1-1/h2-1/para-1"],
      prerequisites: ["entropy", "hallucinated-concept"],
    },
    {
      concept_id: "ungrounded",
      label: "Ungrounded",
      definition: "All evidence invented.",
      evidence_paths: ["fake/path"],
      prerequisites: [],
    },
  ],
  terminology: [
    {
      term: "isolated system",
      definition: "no exchange with surroundings",
      evidence_path: "h1-1/h2-1/para-1",
    },
    { term: "bad", definition: "bad path", evidence_path: "nope" },
  ],
});

function manifest() {
  const found = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.canonicalizer");
  if (!found) throw new Error("canonicalizer manifest missing from catalog");
  return found;
}

function stubModel(text: string) {
  return {
    generate: async (_req: ModelGenerationRequest): Promise<ModelGenerationResult> => ({
      text,
      model: "stub-model",
      finishReason: "stop" as const,
    }),
    embed: async () => [0],
  };
}

function failingModel() {
  return {
    generate: async (): Promise<ModelGenerationResult> => {
      throw new CosError("E_MODEL_UNAVAILABLE", "offline");
    },
    embed: async () => [0],
  };
}

function requestPacket(layer: "semantic" | "citation", regions: unknown) {
  return {
    packet_id: "pkt-test-1",
    schema_version: "1.0.0",
    source_cid: "cog-test-source",
    target_cid: "agent.canonicalizer",
    tenant_id: null,
    session_id: null,
    causation_id: null,
    correlation_id: null,
    timestamp: "2026-07-10T00:00:00Z",
    hlc: "0000000000000001-00000000-test",
    sequence_number: 0,
    packet_type: "request",
    intent: `canonicalize-${layer}`,
    concept_ids: [],
    domain_ids: [],
    content: { layer, version_id: "srcv-test", regions, intent_lease_id: "lease-1" },
    evidence: [],
    confidence: 1,
    uncertainty_estimate: 0,
    reasoning_depth: 0,
    classification: "internal",
    policy_tags: [],
    requires_human_review: false,
    priority: 4,
    expiry: null,
  } as never;
}

const REGIONS = [
  { path: "h1-1", kind: "heading", text: "Thermodynamics" },
  {
    path: "h1-1/para-1",
    kind: "paragraph",
    text: "Entropy measures the number of microscopic configurations of a system (Boltzmann, 1877).",
  },
  { path: "h1-1/h2-1", kind: "heading", text: "The Second Law" },
  {
    path: "h1-1/h2-1/para-1",
    kind: "paragraph",
    text: "The entropy of an isolated system never decreases over time.",
  },
];

describe("grounding-validated parsing (CSE-002 Grounded / CSE-003 §6)", () => {
  it("drops hallucinated evidence paths, discards ungrounded concepts, cleans prerequisites", () => {
    const content = parseSemanticLayerOutput(MODEL_SEMANTIC_JSON, VALID_PATHS);
    expect(content.concepts.map((c) => c.concept_id)).toEqual(["entropy", "second-law"]);
    const entropy = content.concepts[0];
    expect(entropy?.evidence_paths).toEqual(["h1-1/para-1"]); // fake path dropped
    const secondLaw = content.concepts[1];
    expect(secondLaw?.prerequisites).toEqual(["entropy"]); // hallucinated prereq dropped
    expect(content.terminology).toHaveLength(1); // bad evidence_path dropped
  });

  it("throws E_MODEL_OUTPUT_MALFORMED when nothing survives grounding", () => {
    const allFake = JSON.stringify({
      concepts: [{ concept_id: "x", label: "X", definition: "d", evidence_paths: ["fake"] }],
    });
    expect(() => parseSemanticLayerOutput(allFake, VALID_PATHS)).toThrowError(/grounded/);
  });

  it("grounds citation sites the same way", () => {
    const json = JSON.stringify({
      references: [
        {
          ref_id: "boltzmann-1877",
          raw: "(Boltzmann, 1877)",
          year: 1877,
          cited_at_paths: ["h1-1/para-1", "invented"],
        },
      ],
    });
    const content = parseCitationLayerOutput(json, VALID_PATHS);
    expect(content.references[0]?.cited_at_paths).toEqual(["h1-1/para-1"]);
  });
});

describe("SourceCanonicalizerUnit", () => {
  it("returns a model-extracted semantic layer through the unit ABI", async () => {
    const unit = new SourceCanonicalizerUnit({
      manifest: manifest(),
      model: stubModel(MODEL_SEMANTIC_JSON),
      idGenerator: new SeededIdGenerator("canonicalizer-test"),
    });
    const emissions = await unit.execute(requestPacket("semantic", REGIONS));
    const response = emissions.packets?.[0];
    expect(response).toBeDefined();
    const content = (response?.content ?? {}) as Record<string, unknown>;
    expect(content["response_kind"]).toBe("model-semantic-layer");
    expect(content["intent_lease_id"]).toBe("lease-1");
    const layerContent = content["layer_content"] as { concepts: Array<{ concept_id: string }> };
    expect(layerContent.concepts.map((c) => c.concept_id)).toEqual(["entropy", "second-law"]);
    expect(emissions.trace?.determinism_level).toBe("D3");
  });

  it("falls back deterministically with confidence BELOW the degradation floor", async () => {
    const unit = new SourceCanonicalizerUnit({
      manifest: manifest(),
      model: failingModel(),
      idGenerator: new SeededIdGenerator("canonicalizer-test"),
    });
    const emissions = await unit.execute(requestPacket("semantic", REGIONS));
    const content = (emissions.packets?.[0]?.content ?? {}) as Record<string, unknown>;
    expect(content["response_kind"]).toBe("deterministic-semantic-layer");
    expect(content["fallback_reason"]).toBe("E_MODEL_UNAVAILABLE");
    expect(content["confidence"]).toBe(FALLBACK_LAYER_CONFIDENCE);
    // Heading-derived concepts, grounded by construction.
    const layerContent = content["layer_content"] as { concepts: Array<{ concept_id: string }> };
    expect(layerContent.concepts.map((c) => c.concept_id)).toEqual([
      "thermodynamics",
      "the-second-law",
    ]);
  });

  it("deterministic citation fallback harvests (Author, YYYY) patterns without invention", async () => {
    const unit = new SourceCanonicalizerUnit({
      manifest: manifest(),
      model: failingModel(),
      idGenerator: new SeededIdGenerator("canonicalizer-test"),
    });
    const emissions = await unit.execute(requestPacket("citation", REGIONS));
    const content = (emissions.packets?.[0]?.content ?? {}) as Record<string, unknown>;
    const layerContent = content["layer_content"] as {
      references: Array<{ raw: string; cited_at_paths: string[] }>;
    };
    expect(layerContent.references).toHaveLength(1);
    expect(layerContent.references[0]?.raw).toContain("Boltzmann");
    expect(layerContent.references[0]?.cited_at_paths).toEqual(["h1-1/para-1"]);
  });
});

// ── Service end-to-end: dispatch → layer → KG → anchors ───────────────────────────────────────

async function setupService(model: ReturnType<typeof stubModel> | ReturnType<typeof failingModel>) {
  const idGenerator = new SeededIdGenerator("m3-service-test");
  const bus = new InMemoryEventBus({ idGenerator });
  const store = new SourceEnvironmentStore({
    bus,
    clock: new ManualClock(),
    idGenerator,
    nodeId: "test",
  });
  store.registerAdapter(new MarkdownReferenceAdapter());
  const version = await store.registerVersion({
    modality: "markdown",
    content: FIXTURE,
    provenance: PROVENANCE,
  });
  if (!version.ok) throw new Error("registration failed");
  await store.canonicalize(version.value.version_id);

  const unit = new SourceCanonicalizerUnit({ manifest: manifest(), model, idGenerator });
  const world = new WorldStateGraph({ clock: new ManualClock() });
  const kg = new KnowledgeGraphEngine(world);
  const service = new SourceCanonicalizationService({
    store,
    kg,
    idGenerator,
    intentLeaseId: "lease-m3",
    dispatch: (async (input) => {
      // Test dispatcher: routes straight to the unit (governed dispatch is covered by the
      // existing ProductRuntimeDispatcher suites; PRIVILEGED gating asserted separately below).
      const packet = service.buildRequestPacket(
        {
          schemaVersion: "1.0.0",
          sourceCid: "cog-test",
          targetCid: "agent.canonicalizer",
          hlc: "0000000000000001-00000000-test",
          timestamp: "2026-07-10T00:00:00Z",
        },
        input.layer,
        input.versionId,
        input.regions,
      );
      try {
        const emissions = await unit.execute(packet);
        const response = emissions.packets?.[0];
        return response ? ok(response) : err(new CosError("E_TEST", "no response packet"));
      } catch (cause) {
        return err(cause instanceof CosError ? cause : new CosError("E_TEST", String(cause)));
      }
    }) satisfies CanonicalizerDispatch,
  });
  return { store, bus, kg, world, service, versionId: version.value.version_id };
}

describe("SourceCanonicalizationService (M3 end-to-end)", () => {
  it("records the semantic layer, binds concepts to the KG, and anchors the evidence", async () => {
    const { store, bus, world, service, versionId } = await setupService(
      stubModel(MODEL_SEMANTIC_JSON),
    );
    const result = await service.canonicalizeSemantic(versionId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Layer landed, not degraded (model confidence 0.85 ≥ floor).
    expect(result.value.environment.layers_available).toContain("semantic");
    expect(result.value.degraded).toBe(false);
    expect(result.value.conceptsExtracted).toBe(2);
    expect(
      bus.log.filter(
        (e) =>
          e.event_type === SOURCE_EVENT_TYPES.layerConstructed &&
          (e.payload as Record<string, unknown>)["layer"] === "semantic",
      ),
    ).toHaveLength(1);

    // Concepts bound into world-state (Layer-3 activation).
    expect(result.value.conceptsBoundToKg).toBe(2);
    expect(world.getNode("concept:entropy")).toBeDefined();
    expect(world.getNode("concept:second-law")).toBeDefined();

    // Evidence is anchor-addressable: byConcept resolves to real anchors.
    expect(result.value.anchorsCreated).toBeGreaterThanOrEqual(2);
    const index = store.anchorIndex(versionId);
    expect(index?.byConcept("entropy").length).toBeGreaterThanOrEqual(1);
    expect(index?.byConcept("second-law").length).toBeGreaterThanOrEqual(1);
  });

  it("lands the deterministic fallback as an honest DEGRADED layer", async () => {
    const { bus, service, versionId } = await setupService(failingModel());
    const result = await service.canonicalizeSemantic(versionId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.degraded).toBe(true);
    expect(result.value.fallbackReason).toBe("E_MODEL_UNAVAILABLE");
    expect(result.value.environment.degraded_layers).toContain("semantic");
    expect(bus.log.filter((e) => e.event_type === SOURCE_EVENT_TYPES.layerDegraded)).toHaveLength(
      1,
    );
  });

  it("records the citation layer (L6) with grounded citation sites", async () => {
    const { service, versionId } = await setupService(failingModel());
    const result = await service.canonicalizeCitations(versionId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.environment.layers_available).toContain("citation");
    expect(result.value.referencesExtracted).toBe(1); // (Boltzmann, 1877)
  });

  it("refuses deeper layers before the structural layer exists (canonicalization DAG)", async () => {
    const idGenerator = new SeededIdGenerator("m3-dag-test");
    const store = new SourceEnvironmentStore({ clock: new ManualClock(), idGenerator });
    store.registerAdapter(new MarkdownReferenceAdapter());
    const version = await store.registerVersion({
      modality: "markdown",
      content: "# Uncanonicalized",
      provenance: PROVENANCE,
    });
    if (!version.ok) return;
    const service = new SourceCanonicalizationService({
      store,
      dispatch: async () => err(new CosError("E_TEST", "should never dispatch")),
    });
    const result = await service.canonicalizeSemantic(version.value.version_id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("E_SOURCE_NOT_CANONICALIZED");
  });

  it("deterministicSemanticLayer derives grounded concepts from headings", () => {
    const layer = deterministicSemanticLayer(REGIONS);
    expect(layer.concepts.map((c) => c.concept_id)).toEqual(["thermodynamics", "the-second-law"]);
    expect(layer.concepts[0]?.evidence_paths).toContain("h1-1/para-1");
  });
});

describe("governance posture (GOV-P01)", () => {
  it("the canonicalizer is PRIVILEGED: student trust blocked, elevated trust allowed", async () => {
    const { productDispatchTrustGate } = await import("../src/product-dispatch-policies");
    const request = (trustLevel: number) =>
      ({
        action: "dispatch.canonicalizer",
        context: { trustLevel },
      }) as never;
    const student = productDispatchTrustGate.evaluate(request(1));
    const elevated = productDispatchTrustGate.evaluate(request(3));
    expect(student.decision).toBe("block");
    expect(student.reason).toMatch(/privileged agent "canonicalizer"/);
    expect(elevated.decision).toBe("allow");
  });
});
