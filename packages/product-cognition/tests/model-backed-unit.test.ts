/**
 * ModelBackedUnit — real cognition through the same governed path
 * (spec/product/product-cognition-runtime.md §11). Deterministic: stub models only.
 */
import { describe, expect, test } from "vitest";
import type { ModelRuntime } from "@inevitable/contracts";
import { InMemoryEventBus } from "@inevitable/events";
import { GovernanceEngine } from "@inevitable/governance";
import type { CognitionPacket, CognitiveIdentity } from "@inevitable/protocols";
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";
import { MVP_AGENT_MANIFESTS } from "../src/agent-catalog";
import { ModelBackedUnit, parseModelLayeredOutput } from "../src/model-backed-unit";
import { PRODUCT_DISPATCH_POLICIES } from "../src/product-dispatch-policies";
import { DeterministicMvpUnit, ProductRuntimeDispatcher } from "../src/runtime-dispatch";
import type { OnboardingSession } from "../src/types";

const expManifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.explanation")!;

function stubModel(
  text: string,
  finishReason?: "stop" | "refusal",
): ModelRuntime & {
  calls: number;
} {
  const model = {
    calls: 0,
    async generate() {
      model.calls++;
      return { text, model: "stub-model", finishReason: finishReason ?? ("stop" as const) };
    },
    async embed() {
      return [];
    },
  };
  return model;
}

const GOOD_OUTPUT = JSON.stringify({
  layers: { layer_0: "Think of gradients as slopes.", layer_1: "Picture a hillside." },
  summary: "Gradient descent walks downhill.",
  confidence: 0.85,
  reasoning: "led with intuition, then the visual model",
});

function packet(overrides: Partial<CognitionPacket> = {}): CognitionPacket {
  return {
    packet_id: "cp-000000000000000000000001",
    schema_version: "1.0.0",
    source_cid: "cog-learner",
    target_cid: "cog-exp",
    tenant_id: null,
    session_id: "intent-001",
    causation_id: "intent-001",
    correlation_id: "cp-000000000000000000000002",
    timestamp: "2026-06-12T00:00:00.000Z",
    hlc: "00000000000000000000:0:test",
    sequence_number: 0,
    packet_type: "intent",
    intent: "Explain gradient descent",
    concept_ids: ["gradient-descent"],
    domain_ids: [],
    content: {},
    evidence: [],
    confidence: 1,
    uncertainty_estimate: 0,
    reasoning_depth: 0,
    classification: "internal",
    policy_tags: [],
    requires_human_review: false,
    priority: 5,
    expiry: null,
    trace_id: "00000000000000000000000000000001",
    span_id: "0000000000000001",
    ...overrides,
  };
}

describe("parseModelLayeredOutput", () => {
  test("accepts fenced JSON and clamps confidence", () => {
    const parsed = parseModelLayeredOutput(
      '```json\n{"layers":{"layer_0":"x"},"summary":"s","confidence":7}\n```',
    );
    expect(parsed.layers.layer_0).toBe("x");
    expect(parsed.confidence).toBe(1);
  });

  test("rejects output without layer_0", () => {
    expect(() => parseModelLayeredOutput('{"summary":"s","confidence":0.5}')).toThrowError(
      /layer_0/,
    );
  });
});

describe("ModelBackedUnit", () => {
  test("valid model output becomes a model-cognition response packet with trace", async () => {
    const model = stubModel(GOOD_OUTPUT);
    const unit = new ModelBackedUnit({
      manifest: expManifest,
      model,
      role: "explanation",
      idGenerator: new SeededIdGenerator("mbu"),
    });
    const emissions = await unit.execute(packet());

    const response = emissions.packets?.[0];
    expect(response).toBeDefined();
    const content = response!.content as Record<string, unknown>;
    expect(content["response_kind"]).toBe("model-cognition");
    expect((content["layers"] as Record<string, unknown>)["layer_0"]).toContain("slopes");
    expect(content["summary"]).toBe("Gradient descent walks downhill.");
    expect(response!.confidence).toBe(0.85);

    expect(emissions.trace).toBeDefined();
    expect(emissions.trace!.determinism_level).toBe("D3");
    expect(emissions.trace!.claims[0]?.statement).toBe("Gradient descent walks downhill.");
  });

  test("malformed output falls back deterministically, visibly degraded", async () => {
    const model = stubModel("this is not json");
    const unit = new ModelBackedUnit({
      manifest: expManifest,
      model,
      role: "explanation",
      fallback: new DeterministicMvpUnit(expManifest, new SeededIdGenerator("fb")),
    });
    const emissions = await unit.execute(packet());
    const content = emissions.packets?.[0]?.content as Record<string, unknown>;
    expect(content["response_kind"]).toBe("deterministic-fallback");
    expect(content["fallback_reason"]).toBe("E_MODEL_OUTPUT_MALFORMED");
    expect(emissions.packets?.[0]?.confidence).toBeLessThanOrEqual(0.5);
  });

  test("a refusal finish reason falls back with E_MODEL_REFUSAL", async () => {
    const model = stubModel(GOOD_OUTPUT, "refusal");
    const unit = new ModelBackedUnit({
      manifest: expManifest,
      model,
      role: "explanation",
      fallback: new DeterministicMvpUnit(expManifest, new SeededIdGenerator("fb2")),
    });
    const emissions = await unit.execute(packet());
    const content = emissions.packets?.[0]?.content as Record<string, unknown>;
    expect(content["fallback_reason"]).toBe("E_MODEL_REFUSAL");
  });

  test("without a fallback the typed error propagates (host quarantine path)", async () => {
    const unit = new ModelBackedUnit({
      manifest: expManifest,
      model: stubModel("not json"),
      role: "explanation",
    });
    await expect(unit.execute(packet())).rejects.toMatchObject({
      code: "E_MODEL_OUTPUT_MALFORMED",
    });
  });

  test("the governance gate blocks a model-backed dispatch before the model is invoked", async () => {
    const clock = new ManualClock(Date.UTC(2026, 5, 12));
    const idGenerator = new SeededIdGenerator("mbu-gov");
    const bus = new InMemoryEventBus({ idGenerator });
    const model = stubModel(GOOD_OUTPUT);

    const learnerIdentity: CognitiveIdentity = {
      cid: "cog-untrusted",
      unit_type: "human.student",
      version: "1.0.0",
      capabilities: [],
      trust_level: 0,
      parent_cid: null,
      lineage: [],
      tenant_id: null,
      created_at: "2026-06-12T00:00:00.000Z",
      governance_policies: [],
      attestation_chain: [],
    };
    const session: OnboardingSession = {
      learnerIdentity,
      capabilityEnvelope: {
        envelope_id: "env-001",
        granted_to: learnerIdentity.cid,
        granted_by: "kernel",
        memory_scopes: ["working"],
        max_spawn_depth: 1,
        max_child_units: 1,
        network_access: false,
        cost_ceiling_usd: 0,
        data_classification_ceiling: "internal",
        expires_at: "2026-06-12T02:00:00.000Z",
      },
      contextLease: {
        lease_id: "lease-001",
        granted_to: learnerIdentity.cid,
        memory_layers: ["working"],
        allowed_users: ["user-untrusted"],
        token_budget: 1000,
        granted_by: "kernel",
        expires_at: "2026-06-12T02:00:00.000Z",
      },
      intentLease: {
        intent_id: "intent-gov-001",
        owner_user_id: "user-untrusted",
        interpreted_goal: "learn",
        scope: ["learning"],
        constraints: [],
        expires_at: "2026-06-12T02:00:00.000Z",
        confidence: 1,
        held_by: [learnerIdentity.cid],
      },
      learnerNodeId: "learner:user-untrusted",
      intentNodeId: "intent:intent-gov-001",
      seedMemoryMutationId: "mut-001",
    };

    const dispatcher = new ProductRuntimeDispatcher({
      bus,
      clock,
      idGenerator,
      agent: {
        identity: {
          ...learnerIdentity,
          cid: "cog-exp-agent",
          unit_type: "agent.explanation",
          trust_level: 5,
        },
        unit: new ModelBackedUnit({ manifest: expManifest, model, role: "explanation" }),
      },
      governance: new GovernanceEngine(PRODUCT_DISPATCH_POLICIES, { idGenerator }),
    });

    const result = await dispatcher.dispatch({
      session,
      targetAgentId: "explanation",
      intent: "Explain gradient descent",
      conceptIds: ["gradient-descent"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("E_PRODUCT_RUNTIME_DISPATCH");
    expect(model.calls).toBe(0); // the model was never reached — the gate is structural
  });
});
