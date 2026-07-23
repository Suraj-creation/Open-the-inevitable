/**
 * CSE M9 T2 — the Claim Graph as governed cognition (CSE-006 §3.1, ADR-0041). Covers:
 * grounding-validated extraction (ungrounded claims discarded), honest contradiction parsing
 * (unknown/same-source pairs dropped, empty is valid — never fabricated), the deterministic
 * extraction fallback, and the service loop: extract → world `claim` nodes + `about` edges + emit;
 * contrast → `contradicts` edges + emit.
 */
import { describe, expect, it } from "vitest";
import type { ModelGenerationRequest, ModelGenerationResult } from "@inevitable/contracts";
import { CosError } from "@inevitable/shared";
import { WorldStateGraph } from "@inevitable/world-state";
import type { Claim } from "@inevitable/source-environment";
import {
  ClaimGraphService,
  ClaimReasoningUnit,
  FALLBACK_CLAIM_CONFIDENCE,
  MVP_AGENT_MANIFESTS,
  claimNodeId,
  deterministicClaimExtraction,
  parseClaimExtractionOutput,
  parseContradictionOutput,
  type ClaimDispatch,
  type ClaimForContrast,
} from "../src/index";

const VALID_PATHS = new Set(["h1-1", "h1-1/para-1", "h1-1/h2-1", "h1-1/h2-1/para-1"]);
const VALID_CONCEPTS = new Set(["gradient-descent", "learning-rate"]);

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
    text: "If the learning rate is too large the iterates diverge.",
  },
];

const CONCEPTS = [
  {
    concept_id: "gradient-descent",
    label: "Gradient Descent",
    definition: "Steps against the gradient.",
  },
  {
    concept_id: "learning-rate",
    label: "Learning Rate",
    definition: "The step size of each update.",
  },
];

const EXTRACT_JSON = JSON.stringify({
  claims: [
    {
      statement: "Gradient descent steps against the gradient to reduce loss.",
      source_anchors: ["h1-1/para-1", "invented/path"],
      concept_refs: ["gradient-descent"],
      epistemic_status: "established",
    },
    {
      statement: "Too large a learning rate makes the iterates diverge.",
      source_anchors: ["h1-1/h2-1/para-1"],
      concept_refs: ["Learning Rate"], // label-cased — parser kebabs + validates
      epistemic_status: "supported",
    },
    {
      statement: "entirely ungrounded assertion",
      source_anchors: ["fake/only"],
      concept_refs: ["not-in-source"],
    },
  ],
});

function manifest() {
  const found = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.claim");
  if (!found) throw new Error("claim manifest missing from catalog");
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

function packet(content: Record<string, unknown>) {
  return {
    packet_id: "pkt-claim-1",
    schema_version: "1.0.0",
    source_cid: "cog-test",
    target_cid: "agent.claim",
    tenant_id: null,
    session_id: null,
    causation_id: null,
    correlation_id: null,
    timestamp: "2026-07-16T00:00:00Z",
    hlc: "0000000000000001-00000000-test",
    sequence_number: 0,
    packet_type: "request",
    intent: "claim",
    concept_ids: [],
    domain_ids: [],
    content,
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

describe("parseClaimExtractionOutput (grounding law, CSE-006 §3.1)", () => {
  it("drops hallucinated anchors/concepts, discards ungrounded claims, kebabs + defaults status", () => {
    const claims = parseClaimExtractionOutput(EXTRACT_JSON, VALID_PATHS, VALID_CONCEPTS, "srcv-a");
    expect(claims).toHaveLength(2); // the ungrounded third is discarded
    expect(claims[0]?.anchors).toEqual(["h1-1/para-1"]); // invented path dropped
    expect(claims[0]?.about_concepts).toEqual(["gradient-descent"]);
    expect(claims[0]?.epistemic_status).toBe("established");
    expect(claims[1]?.about_concepts).toEqual(["learning-rate"]); // label kebabbed + validated
    expect(claims.every((c) => c.source_version_id === "srcv-a")).toBe(true);
    expect(claims.every((c) => c.edges.length === 0)).toBe(true); // extract carries no cross edges
  });

  it("throws when no claim survives grounding", () => {
    const allFake = JSON.stringify({
      claims: [{ statement: "x", source_anchors: ["fake"], concept_refs: ["nope"] }],
    });
    expect(() =>
      parseClaimExtractionOutput(allFake, VALID_PATHS, VALID_CONCEPTS, "srcv-a"),
    ).toThrowError(/grounded/);
  });
});

describe("parseContradictionOutput (honest — never fabricated, CSE-006 §2/§6)", () => {
  const byId = new Map<string, ClaimForContrast>([
    [
      "va::c1",
      {
        claim_id: "va::c1",
        statement: "X is true",
        source_version_id: "va",
        about_concepts: ["x"],
      },
    ],
    [
      "vb::c1",
      {
        claim_id: "vb::c1",
        statement: "X is false",
        source_version_id: "vb",
        about_concepts: ["x"],
      },
    ],
    [
      "va::c2",
      { claim_id: "va::c2", statement: "Y", source_version_id: "va", about_concepts: ["y"] },
    ],
  ]);

  it("keeps only cross-source pairs; drops same-source + unknown ids; dedups; labels nature", () => {
    const json = JSON.stringify({
      contradictions: [
        {
          claim_id_a: "va::c1",
          claim_id_b: "vb::c1",
          nature: "empirical",
          rationale: "true vs false",
        },
        { claim_id_a: "vb::c1", claim_id_b: "va::c1", nature: "empirical" }, // duplicate pair
        { claim_id_a: "va::c1", claim_id_b: "va::c2", nature: "interpretive" }, // same source — dropped
        { claim_id_a: "va::c1", claim_id_b: "ghost", nature: "value" }, // unknown — dropped
      ],
    });
    const found = parseContradictionOutput(json, byId);
    expect(found).toHaveLength(1);
    expect(found[0]?.claim_ids).toEqual(["va::c1", "vb::c1"]);
    expect(found[0]?.source_version_ids).toEqual(["va", "vb"]);
    expect(found[0]?.nature).toBe("empirical");
    expect(found[0]?.rationale).toBe("true vs false");
  });

  it("an empty contradiction set is valid (honest absence, no error)", () => {
    expect(parseContradictionOutput(JSON.stringify({ contradictions: [] }), byId)).toEqual([]);
  });
});

describe("deterministicClaimExtraction (degradation, never fabrication)", () => {
  it("produces one supported claim per concept, grounded on the concept ref", () => {
    const claims = deterministicClaimExtraction(REGIONS, CONCEPTS, "srcv-a");
    expect(claims).toHaveLength(2);
    expect(claims.every((c) => c.epistemic_status === "supported")).toBe(true);
    expect(claims[0]?.about_concepts).toEqual(["gradient-descent"]);
    expect(claims.every((c) => c.edges.length === 0)).toBe(true);
  });

  it("falls back to heading claims when no concept vocabulary is available", () => {
    const claims = deterministicClaimExtraction(REGIONS, [], "srcv-a");
    expect(claims.length).toBeGreaterThan(0);
    expect(claims[0]?.anchors).toEqual(["h1-1"]);
  });
});

describe("ClaimReasoningUnit.execute", () => {
  it("extract: grounds against the model output (D3)", async () => {
    const unit = new ClaimReasoningUnit({ manifest: manifest(), model: stubModel(EXTRACT_JSON) });
    const emissions = await unit.execute(
      packet({ mode: "extract", version_id: "srcv-a", regions: REGIONS, concepts: CONCEPTS }),
    );
    const content = (emissions.packets?.[0]?.content ?? {}) as Record<string, unknown>;
    expect(content["response_kind"]).toBe("model-claim-extraction");
    expect((content["claims"] as unknown[]).length).toBe(2);
    expect(emissions.trace?.determinism_level).toBe("D3");
  });

  it("extract: falls back deterministically on model failure (honest degraded)", async () => {
    const unit = new ClaimReasoningUnit({ manifest: manifest(), model: failingModel() });
    const emissions = await unit.execute(
      packet({ mode: "extract", version_id: "srcv-a", regions: REGIONS, concepts: CONCEPTS }),
    );
    const content = (emissions.packets?.[0]?.content ?? {}) as Record<string, unknown>;
    expect(content["response_kind"]).toBe("deterministic-claim-extraction");
    expect(content["confidence"]).toBe(FALLBACK_CLAIM_CONFIDENCE);
    expect(content["fallback_reason"]).toBe("E_MODEL_UNAVAILABLE");
  });

  it("contrast: fewer than two sources ⇒ honest empty, NO model call", async () => {
    let called = false;
    const model = {
      generate: async (): Promise<ModelGenerationResult> => {
        called = true;
        return { text: "{}", model: "x", finishReason: "stop" as const };
      },
      embed: async () => [0],
    };
    const unit = new ClaimReasoningUnit({ manifest: manifest(), model });
    const emissions = await unit.execute(
      packet({
        mode: "contrast",
        claims: [
          { claim_id: "va::c1", statement: "X", source_version_id: "va", about_concepts: ["x"] },
        ],
      }),
    );
    const content = (emissions.packets?.[0]?.content ?? {}) as Record<string, unknown>;
    expect(content["contradictions"]).toEqual([]);
    expect(content["response_kind"]).toBe("no-comparison");
    expect(called).toBe(false);
  });

  it("contrast: surfaces a genuine cross-source contradiction; failure ⇒ honest empty", async () => {
    const contrastJson = JSON.stringify({
      contradictions: [
        { claim_id_a: "va::c1", claim_id_b: "vb::c1", nature: "interpretive", rationale: "differ" },
      ],
    });
    const claims = [
      { claim_id: "va::c1", statement: "X true", source_version_id: "va", about_concepts: ["x"] },
      { claim_id: "vb::c1", statement: "X false", source_version_id: "vb", about_concepts: ["x"] },
    ];
    const ok = new ClaimReasoningUnit({ manifest: manifest(), model: stubModel(contrastJson) });
    const emissions = await ok.execute(packet({ mode: "contrast", claims }));
    const content = (emissions.packets?.[0]?.content ?? {}) as Record<string, unknown>;
    expect((content["contradictions"] as unknown[]).length).toBe(1);

    const failed = new ClaimReasoningUnit({ manifest: manifest(), model: failingModel() });
    const emissions2 = await failed.execute(packet({ mode: "contrast", claims }));
    const content2 = (emissions2.packets?.[0]?.content ?? {}) as Record<string, unknown>;
    expect(content2["contradictions"]).toEqual([]); // never fabricate on failure
  });
});

describe("ClaimGraphService (world binding + events, ADR-0041)", () => {
  function dispatchOf(model: ReturnType<typeof stubModel>): { dispatch: ClaimDispatch } {
    const unit = new ClaimReasoningUnit({ manifest: manifest(), model });
    const dispatch: ClaimDispatch = async (input) => {
      const content: Record<string, unknown> = { mode: input.mode };
      if (input.versionId) content["version_id"] = input.versionId;
      if (input.regions) content["regions"] = input.regions;
      if (input.concepts) content["concepts"] = input.concepts;
      if (input.claims) content["claims"] = input.claims;
      const emissions = await unit.execute(packet(content));
      const out = emissions.packets?.[0];
      if (!out) throw new Error("no packet");
      return { ok: true, value: out } as never;
    };
    return { dispatch };
  }

  it("extractClaims namespaces ids, binds world claim nodes + about edges, emits recorded", async () => {
    const world = new WorldStateGraph();
    const events: { type: string; payload: Record<string, unknown> }[] = [];
    const { dispatch } = dispatchOf(stubModel(EXTRACT_JSON));
    const service = new ClaimGraphService({
      dispatch,
      world,
      emit: async (type, payload) => {
        events.push({ type, payload });
      },
    });
    const result = await service.extractClaims({
      versionId: "srcv-a",
      regions: REGIONS,
      concepts: CONCEPTS,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.claims.map((c) => c.claim_id)).toEqual(["srcv-a::clm-1", "srcv-a::clm-2"]);
    expect(result.value.nodesCreated).toBe(2);
    // World: claim node + `about` edge to its concept.
    const nodeId = claimNodeId("srcv-a::clm-1");
    expect(world.getNode(nodeId)?.type).toBe("claim");
    const about = world.snapshot().edges.filter((e) => e.from === nodeId && e.type === "about");
    expect(about.some((e) => e.to === "concept:gradient-descent")).toBe(true);
    // Events: one source.claim.recorded per claim.
    expect(events.filter((e) => e.type === "source.claim.recorded")).toHaveLength(2);
  });

  it("detectContradictions writes contradicts edges + emits, honest absence otherwise", async () => {
    const world = new WorldStateGraph();
    const events: { type: string; payload: Record<string, unknown> }[] = [];
    const claims: Claim[] = [
      {
        claim_id: "va::c1",
        statement: "X true",
        anchors: [],
        about_concepts: ["x"],
        source_version_id: "va",
        epistemic_status: "contested",
        edges: [],
      },
      {
        claim_id: "vb::c1",
        statement: "X false",
        anchors: [],
        about_concepts: ["x"],
        source_version_id: "vb",
        epistemic_status: "contested",
        edges: [],
      },
    ];
    // Endpoints must exist before a contradicts edge.
    for (const c of claims) {
      world.apply({ kind: "upsert_node", id: claimNodeId(c.claim_id), type: "claim", props: {} });
    }
    const contrastJson = JSON.stringify({
      contradictions: [{ claim_id_a: "va::c1", claim_id_b: "vb::c1", nature: "empirical" }],
    });
    const { dispatch } = dispatchOf(stubModel(contrastJson));
    const service = new ClaimGraphService({
      dispatch,
      world,
      emit: async (type, payload) => {
        events.push({ type, payload });
      },
    });
    const result = await service.detectContradictions({ claims });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.contradictions).toHaveLength(1);
    expect(result.value.edgesCreated).toBe(1);
    const edges = world.snapshot().edges.filter((e) => e.type === "contradicts");
    expect(edges[0]?.from).toBe(claimNodeId("va::c1"));
    expect(edges[0]?.props?.["nature"]).toBe("empirical");
    expect(events.filter((e) => e.type === "source.contradiction.detected")).toHaveLength(1);
  });

  it("detectContradictions returns honest empty when the model finds none", async () => {
    const { dispatch } = dispatchOf(stubModel(JSON.stringify({ contradictions: [] })));
    const service = new ClaimGraphService({ dispatch });
    const claims: Claim[] = [
      {
        claim_id: "va::c1",
        statement: "X",
        anchors: [],
        about_concepts: ["x"],
        source_version_id: "va",
        epistemic_status: "supported",
        edges: [],
      },
      {
        claim_id: "vb::c1",
        statement: "Y",
        anchors: [],
        about_concepts: ["y"],
        source_version_id: "vb",
        epistemic_status: "supported",
        edges: [],
      },
    ];
    const result = await service.detectContradictions({ claims });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.contradictions).toEqual([]);
    expect(result.value.edgesCreated).toBe(0);
  });
});
