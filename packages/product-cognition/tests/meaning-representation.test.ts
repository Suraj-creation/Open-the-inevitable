/**
 * CSE M6 — MRL v1 as governed cognition (CSE-003, ADR-0037). Covers: grounding-validated parsing
 * (units citing no known anchor/concept are discarded), the deterministic fallback landing as an
 * honest DEGRADED layer (compressions + intent only — never fabricated analogies), and the full
 * service loop: dispatch → record `meaning` layer → MRL world-state nodes with `expresses` edges.
 */
import { describe, expect, it } from "vitest";
import type { ModelGenerationRequest, ModelGenerationResult } from "@inevitable/contracts";
import { CosError } from "@inevitable/shared";
import { InMemoryEventBus } from "@inevitable/events";
import { KnowledgeGraphEngine, WorldStateGraph } from "@inevitable/world-state";
import {
  MarkdownReferenceAdapter,
  SourceEnvironmentStore,
  type MeaningLayerContent,
  type SemanticLayerContent,
  type SourceProvenance,
} from "@inevitable/source-environment";
import {
  FALLBACK_MEANING_CONFIDENCE,
  MVP_AGENT_MANIFESTS,
  MeaningRepresentationUnit,
  SourceCanonicalizationService,
  deterministicMeaningLayer,
  parseMeaningLayerOutput,
  type CanonicalizerDispatch,
} from "../src/index";

const PROVENANCE: SourceProvenance = {
  origin: "fixture",
  attributed_source: "tests/meaning",
  license_class: null,
  consent_ref: null,
};

const FIXTURE = `# Gradient Descent

Gradient descent minimizes a loss function by stepping against the gradient.

## Learning Rate

The learning rate controls the step size; too large and the iterates diverge.
`;

const VALID_PATHS = new Set(["h1-1", "h1-1/para-1", "h1-1/h2-1", "h1-1/h2-1/para-1"]);
const VALID_CONCEPTS = new Set(["gradient-descent", "learning-rate"]);

const MODEL_MEANING_JSON = JSON.stringify({
  units: [
    {
      kind: "intent",
      source_anchors: ["h1-1/para-1", "invented/path"],
      concept_refs: ["gradient-descent"],
      payload: { target: "predict when gradient descent oscillates", register: "derive" },
      confidence: 0.8,
    },
    {
      kind: "analogy-map",
      source_anchors: [],
      concept_refs: ["Gradient Descent"], // label-cased — parser kebabs + validates
      payload: {
        target_domain: "a ball rolling downhill",
        correspondence: "position ↔ parameters; slope ↔ gradient",
        breaks_at: "momentum: the ball has inertia, vanilla GD does not",
      },
      confidence: 0.75,
    },
    {
      kind: "misconception-hypothesis",
      source_anchors: ["fake/only"],
      concept_refs: ["some-concept-not-in-source"],
      payload: { wrong_model: "entirely ungrounded", diagnostic_probe: "-", repair_route: "-" },
    },
    {
      kind: "not-a-kind",
      source_anchors: ["h1-1"],
      concept_refs: [],
      payload: { x: 1 },
    },
  ],
});

function manifest() {
  const found = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.meaning");
  if (!found) throw new Error("meaning manifest missing from catalog");
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

const REGIONS = [
  { path: "h1-1", kind: "heading", text: "Gradient Descent" },
  {
    path: "h1-1/para-1",
    kind: "paragraph",
    text: "Gradient descent minimizes a loss function by stepping against the gradient.",
  },
  { path: "h1-1/h2-1", kind: "heading", text: "Learning Rate" },
  {
    path: "h1-1/h2-1/para-1",
    kind: "paragraph",
    text: "The learning rate controls the step size; too large and the iterates diverge.",
  },
];

const CONCEPTS = [
  {
    concept_id: "gradient-descent",
    label: "Gradient Descent",
    definition: "Stepping against the gradient to minimize loss.",
  },
  {
    concept_id: "learning-rate",
    label: "Learning Rate",
    definition: "The step size of each update.",
  },
];

function requestPacket(regions: unknown, concepts: unknown) {
  return {
    packet_id: "pkt-meaning-1",
    schema_version: "1.0.0",
    source_cid: "cog-test-source",
    target_cid: "agent.meaning",
    tenant_id: null,
    session_id: null,
    causation_id: null,
    correlation_id: null,
    timestamp: "2026-07-11T00:00:00Z",
    hlc: "0000000000000001-00000000-test",
    sequence_number: 0,
    packet_type: "request",
    intent: "canonicalize-meaning",
    concept_ids: [],
    domain_ids: [],
    content: {
      layer: "meaning",
      version_id: "srcv-test",
      regions,
      concepts,
      intent_lease_id: "lease-1",
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
  } as never;
}

describe("grounding-validated meaning parsing (CSE-003 §2/§6)", () => {
  it("drops hallucinated anchors/concepts, discards ungrounded units, rejects unknown kinds", () => {
    const content = parseMeaningLayerOutput(
      MODEL_MEANING_JSON,
      VALID_PATHS,
      VALID_CONCEPTS,
      "agent.meaning",
    );
    // intent survives (real anchor + concept); analogy survives (kebabbed concept ref);
    // fully-ungrounded misconception and the unknown kind are discarded.
    expect(content.units.map((u) => u.kind)).toEqual(["intent", "analogy-map"]);
    expect(content.units[0]?.source_anchors).toEqual(["h1-1/para-1"]); // invented path dropped
    expect(content.units[1]?.concept_refs).toEqual(["gradient-descent"]); // label kebabbed
    expect(content.units.every((u) => u.produced_by === "agent.meaning")).toBe(true);
  });

  it("throws E_MODEL_OUTPUT_MALFORMED when no unit survives grounding", () => {
    const allFake = JSON.stringify({
      units: [{ kind: "intent", source_anchors: ["fake"], concept_refs: ["nope"], payload: {} }],
    });
    expect(() =>
      parseMeaningLayerOutput(allFake, VALID_PATHS, VALID_CONCEPTS, "agent.meaning"),
    ).toThrowError(/grounded/);
  });
});

describe("deterministic fallback (degradation, never fabrication — CSE-003 §7)", () => {
  it("produces only intent + compressions, never analogies or misconception hypotheses", () => {
    const content = deterministicMeaningLayer(REGIONS, CONCEPTS, "agent.meaning");
    const kinds = new Set(content.units.map((u) => u.kind));
    expect(kinds.has("intent")).toBe(true);
    expect(kinds.has("conceptual-compression")).toBe(true);
    expect(kinds.has("analogy-map")).toBe(false);
    expect(kinds.has("misconception-hypothesis")).toBe(false);
    expect(content.units.every((u) => u.confidence === FALLBACK_MEANING_CONFIDENCE)).toBe(true);
    // Compressions state what they dropped (fidelity honesty).
    const compression = content.units.find((u) => u.kind === "conceptual-compression");
    expect(String(compression?.payload["fidelity_notes"])).toContain("dropped");
  });

  it("the unit falls back on model failure with fallback confidence + D2 trace", async () => {
    const unit = new MeaningRepresentationUnit({ manifest: manifest(), model: failingModel() });
    const emissions = await unit.execute(requestPacket(REGIONS, CONCEPTS));
    const content = (emissions.packets?.[0]?.content ?? {}) as Record<string, unknown>;
    expect(content["response_kind"]).toBe("deterministic-meaning-layer");
    expect(content["confidence"]).toBe(FALLBACK_MEANING_CONFIDENCE);
    expect(content["fallback_reason"]).toBe("E_MODEL_UNAVAILABLE");
    expect(emissions.trace?.determinism_level).toBe("D2");
  });
});

describe("service loop: dispatch → record meaning layer → MRL world nodes (ADR-0037)", () => {
  async function build() {
    const bus = new InMemoryEventBus();
    const store = new SourceEnvironmentStore({ bus, nodeId: "meaning-test" });
    store.registerAdapter(new MarkdownReferenceAdapter());
    const version = await store.registerVersion({
      modality: "markdown",
      content: FIXTURE,
      provenance: PROVENANCE,
    });
    if (!version.ok) throw version.error;
    const canonicalized = await store.canonicalize(version.value.version_id);
    if (!canonicalized.ok) throw canonicalized.error;
    // Land a semantic layer so constructMeaning has a concept vocabulary.
    const semantic: SemanticLayerContent = {
      concepts: CONCEPTS.map((c) => ({
        concept_id: c.concept_id,
        label: c.label,
        definition: c.definition,
        evidence_paths: ["h1-1/para-1"],
        prerequisites: [],
      })),
      terminology: [],
    };
    const landed = await store.recordLayerArtifact(version.value.version_id, "semantic", semantic, {
      confidence: 0.85,
      producedBy: "agent.canonicalizer",
    });
    if (!landed.ok) throw landed.error;
    return { store, versionId: version.value.version_id };
  }

  it("records the meaning layer and places grounded MRL nodes with expresses edges", async () => {
    const { store, versionId } = await build();
    const world = new WorldStateGraph();
    const kg = new KnowledgeGraphEngine(world);
    kg.seedConcepts(
      CONCEPTS.map((c) => ({
        id: c.concept_id,
        label: c.label,
        prerequisites: [],
        domain: "math",
        layer: 2,
      })),
    );

    const unit = new MeaningRepresentationUnit({
      manifest: manifest(),
      model: stubModel(MODEL_MEANING_JSON),
    });
    const dispatch: CanonicalizerDispatch = async (input) => {
      const emissions = await unit.execute(requestPacket(input.regions, input.concepts ?? []));
      const packet = emissions.packets?.[0];
      if (!packet) throw new Error("no packet");
      return { ok: true, value: packet } as never;
    };
    const service = new SourceCanonicalizationService({ store, dispatch, world });

    const result = await service.constructMeaning(versionId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.degraded).toBe(false);
    expect(result.value.unitsProduced).toBe(2);
    expect(result.value.unitsByKind["intent"]).toBe(1);
    expect(result.value.worldNodesCreated).toBe(2);
    expect(result.value.environment.layers_available).toContain("meaning");

    // The MRL is queryable beside the knowledge graph: node + expresses edge exist.
    const layer = store.layer(versionId, "meaning");
    const units = (layer?.content as MeaningLayerContent).units;
    const nodeId = `mrl:${versionId}:${units[0]!.unit_id}`;
    expect(world.getNode(nodeId)?.type).toBe("meaning_unit");
    const edges = world.snapshot().edges.filter((e) => e.from === nodeId && e.type === "expresses");
    expect(edges.some((e) => e.to === "concept:gradient-descent")).toBe(true);
  });

  it("backfills concept_refs from shared evidence when a unit grounds only on anchors (L7→L8 hinge)", async () => {
    const { store, versionId } = await build();
    const world = new WorldStateGraph();
    const kg = new KnowledgeGraphEngine(world);
    kg.seedConcepts(
      CONCEPTS.map((c) => ({
        id: c.concept_id,
        label: c.label,
        prerequisites: [],
        domain: "math",
        layer: 2,
      })),
    );
    // A unit that cites ONLY an anchor (h1-1/para-1) and no concept_refs — as the live model does.
    const anchorOnly = JSON.stringify({
      units: [
        {
          kind: "conceptual-compression",
          source_anchors: ["h1-1/para-1"],
          concept_refs: [],
          payload: { text: "GD steps against the gradient", fidelity_notes: "drops the math" },
          confidence: 0.8,
        },
      ],
    });
    const unit = new MeaningRepresentationUnit({
      manifest: manifest(),
      model: stubModel(anchorOnly),
    });
    const dispatch: CanonicalizerDispatch = async (input) => {
      const emissions = await unit.execute(requestPacket(input.regions, input.concepts ?? []));
      const packet = emissions.packets?.[0];
      if (!packet) throw new Error("no packet");
      return { ok: true, value: packet } as never;
    };
    // Both CONCEPTS cite h1-1/para-1 in the semantic layer (see build()), so the anchored unit
    // expresses both — grounded shared-evidence inference, never invention.
    const service = new SourceCanonicalizationService({ store, dispatch, world });
    const result = await service.constructMeaning(versionId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const units = (store.layer(versionId, "meaning")?.content as MeaningLayerContent).units;
    expect(units[0]?.concept_refs).toEqual(["gradient-descent", "learning-rate"]);
    expect(result.value.worldNodesCreated).toBe(1);
    const nodeId = `mrl:${versionId}:${units[0]!.unit_id}`;
    const edges = world.snapshot().edges.filter((e) => e.from === nodeId && e.type === "expresses");
    expect(edges.map((e) => e.to).sort()).toEqual([
      "concept:gradient-descent",
      "concept:learning-rate",
    ]);
  });

  it("a failed model lands the fallback as an honest DEGRADED meaning layer", async () => {
    const { store, versionId } = await build();
    const unit = new MeaningRepresentationUnit({ manifest: manifest(), model: failingModel() });
    const dispatch: CanonicalizerDispatch = async (input) => {
      const emissions = await unit.execute(requestPacket(input.regions, input.concepts ?? []));
      const packet = emissions.packets?.[0];
      if (!packet) throw new Error("no packet");
      return { ok: true, value: packet } as never;
    };
    const service = new SourceCanonicalizationService({ store, dispatch });
    const result = await service.constructMeaning(versionId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.degraded).toBe(true); // 0.45 < floor — visible, never laundered
    expect(result.value.fallbackReason).toBe("E_MODEL_UNAVAILABLE");
    expect(result.value.environment.degraded_layers).toContain("meaning");
  });
});
