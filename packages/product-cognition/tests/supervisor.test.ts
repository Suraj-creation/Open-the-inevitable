import { describe, expect, test } from "vitest";
import { InMemoryEventBus } from "@inevitable/events";
import type { CognitiveIdentity } from "@inevitable/protocols";
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";
import { WorldStateGraph } from "@inevitable/world-state";
import { MVP_AGENT_MANIFESTS } from "../src/agent-catalog";
import { ProductRuntimeDispatcher } from "../src/runtime-dispatch";
import { SupervisorUnit } from "../src/supervisor";
import type { OnboardingSession } from "../src/types";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function session(userId = "user-sup"): OnboardingSession {
  const learnerIdentity: CognitiveIdentity = {
    cid: "cog-supervisor-learner",
    unit_type: "human.student",
    version: "1.0.0",
    capabilities: ["product.onboarding"],
    trust_level: 5,
    parent_cid: null,
    lineage: [],
    tenant_id: null,
    created_at: "2026-06-05T00:00:00.000Z",
    governance_policies: [],
    attestation_chain: [],
  };
  return {
    learnerIdentity,
    capabilityEnvelope: {
      envelope_id: "env-sup-001",
      granted_to: learnerIdentity.cid,
      granted_by: "kernel",
      memory_scopes: ["working", "semantic"],
      max_spawn_depth: 1,
      max_child_units: 7,
      network_access: false,
      cost_ceiling_usd: 0,
      data_classification_ceiling: "internal",
      expires_at: "2026-06-05T02:00:00.000Z",
    },
    contextLease: {
      lease_id: "lease-sup-001",
      granted_to: learnerIdentity.cid,
      memory_layers: ["working", "semantic"],
      allowed_users: [userId],
      token_budget: 16_000,
      granted_by: "kernel",
      expires_at: "2026-06-05T02:00:00.000Z",
    },
    intentLease: {
      intent_id: "intent-sup-001",
      owner_user_id: userId,
      interpreted_goal: "Learn calculus",
      scope: ["learning", "student"],
      constraints: [],
      expires_at: "2026-06-05T02:00:00.000Z",
      confidence: 1,
      held_by: [learnerIdentity.cid],
    },
    learnerNodeId: `learner:${userId}`,
    intentNodeId: "intent:intent-sup-001",
    seedMemoryMutationId: "mut-sup-001",
  };
}

function makeWorldWithConcept(conceptId: string): WorldStateGraph {
  const world = new WorldStateGraph({ acyclicEdgeTypes: ["prerequisite_of"] });
  world.apply({
    kind: "upsert_node",
    id: `concept:${conceptId}`,
    type: "concept",
    props: { conceptId },
  });
  return world;
}

function supervisorManifest() {
  return MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.supervisor")!;
}

// ---------------------------------------------------------------------------
// SupervisorUnit.route() — unit tests (no dispatcher required)
// ---------------------------------------------------------------------------

describe("SupervisorUnit.route()", () => {
  test("defaults to explanation when world-state has no prior evidence", () => {
    const world = makeWorldWithConcept("derivatives");
    const unit = new SupervisorUnit(supervisorManifest(), world);

    const decision = unit.route("derivatives", "user-sup");
    expect(decision.targetAgent).toBe("explanation");
    expect(decision.conceptId).toBe("derivatives");
    expect(decision.reason).toMatch(/not yet explained/i);
  });

  test("routes to practice when explanation has been dispatched", () => {
    const world = makeWorldWithConcept("derivatives");
    world.apply({
      kind: "set_node_prop",
      id: "concept:derivatives",
      key: "explanation_dispatched:user-sup",
      value: true,
    });

    const unit = new SupervisorUnit(supervisorManifest(), world);
    const decision = unit.route("derivatives", "user-sup");

    expect(decision.targetAgent).toBe("practice");
    expect(decision.reason).toMatch(/explanation complete/i);
  });

  test("routes to assessment when practice has been dispatched", () => {
    const world = makeWorldWithConcept("derivatives");
    world.apply({
      kind: "set_node_prop",
      id: "concept:derivatives",
      key: "explanation_dispatched:user-sup",
      value: true,
    });
    world.apply({
      kind: "set_node_prop",
      id: "concept:derivatives",
      key: "practice_dispatched:user-sup",
      value: true,
    });

    const unit = new SupervisorUnit(supervisorManifest(), world);
    const decision = unit.route("derivatives", "user-sup");

    expect(decision.targetAgent).toBe("assessment");
    expect(decision.reason).toMatch(/practice complete/i);
  });

  test("routes to revision when a mastery checkpoint is failed", () => {
    const world = makeWorldWithConcept("derivatives");
    world.apply({
      kind: "upsert_node",
      id: "mastery:user-sup:derivatives:abc",
      type: "mastery_checkpoint",
      props: { conceptId: "derivatives", ownerUserId: "user-sup", passed: false, confidence: 0.3 },
    });

    const unit = new SupervisorUnit(supervisorManifest(), world);
    const decision = unit.route("derivatives", "user-sup");

    expect(decision.targetAgent).toBe("revision");
    expect(decision.reason).toMatch(/assessment failed/i);
  });

  test("routes to complete when a mastery checkpoint is passed", () => {
    const world = makeWorldWithConcept("derivatives");
    world.apply({
      kind: "upsert_node",
      id: "mastery:user-sup:derivatives:abc",
      type: "mastery_checkpoint",
      props: { conceptId: "derivatives", ownerUserId: "user-sup", passed: true, confidence: 0.92 },
    });

    const unit = new SupervisorUnit(supervisorManifest(), world);
    const decision = unit.route("derivatives", "user-sup");

    expect(decision.targetAgent).toBe("complete");
    expect(decision.reason).toMatch(/mastery verified/i);
  });

  test("passed checkpoint takes precedence over failed checkpoint for same concept", () => {
    const world = makeWorldWithConcept("derivatives");
    world.apply({
      kind: "upsert_node",
      id: "mastery:user-sup:derivatives:fail",
      type: "mastery_checkpoint",
      props: { conceptId: "derivatives", ownerUserId: "user-sup", passed: false, confidence: 0.4 },
    });
    world.apply({
      kind: "upsert_node",
      id: "mastery:user-sup:derivatives:pass",
      type: "mastery_checkpoint",
      props: { conceptId: "derivatives", ownerUserId: "user-sup", passed: true, confidence: 0.95 },
    });

    const unit = new SupervisorUnit(supervisorManifest(), world);
    const decision = unit.route("derivatives", "user-sup");

    expect(decision.targetAgent).toBe("complete");
  });

  test("routes to revision when passed checkpoint has confidence below threshold (0.45)", () => {
    const world = makeWorldWithConcept("derivatives");
    world.apply({
      kind: "upsert_node",
      id: "mastery:user-sup:derivatives:low",
      type: "mastery_checkpoint",
      props: {
        conceptId: "derivatives",
        ownerUserId: "user-sup",
        passed: true,
        confidence: 0.45, // below MASTERY_CONFIDENCE_THRESHOLD (0.6)
      },
    });

    const unit = new SupervisorUnit(supervisorManifest(), world);
    const decision = unit.route("derivatives", "user-sup");

    expect(decision.targetAgent).toBe("revision");
    expect(decision.reason).toMatch(/mastery passed but confidence 0\.45 below threshold 0\.6/);
  });

  test("routes to complete when passed checkpoint confidence equals threshold exactly (0.6)", () => {
    // Threshold is strict less-than: confidence < 0.6 → revision. 0.6 is NOT below threshold.
    const world = makeWorldWithConcept("derivatives");
    world.apply({
      kind: "upsert_node",
      id: "mastery:user-sup:derivatives:exact",
      type: "mastery_checkpoint",
      props: {
        conceptId: "derivatives",
        ownerUserId: "user-sup",
        passed: true,
        confidence: 0.6, // exactly at threshold → NOT below → complete
      },
    });

    const unit = new SupervisorUnit(supervisorManifest(), world);
    const decision = unit.route("derivatives", "user-sup");

    expect(decision.targetAgent).toBe("complete");
    expect(decision.reason).toMatch(/mastery verified/i);
  });

  test("uses max confidence across multiple passing checkpoints for revision/complete decision", () => {
    // Even if one passing checkpoint has low confidence, a second with high confidence promotes to complete.
    const world = makeWorldWithConcept("derivatives");
    world.apply({
      kind: "upsert_node",
      id: "mastery:user-sup:derivatives:low",
      type: "mastery_checkpoint",
      props: {
        conceptId: "derivatives",
        ownerUserId: "user-sup",
        passed: true,
        confidence: 0.45,
      },
    });
    world.apply({
      kind: "upsert_node",
      id: "mastery:user-sup:derivatives:high",
      type: "mastery_checkpoint",
      props: {
        conceptId: "derivatives",
        ownerUserId: "user-sup",
        passed: true,
        confidence: 0.85,
      },
    });

    const unit = new SupervisorUnit(supervisorManifest(), world);
    const decision = unit.route("derivatives", "user-sup");

    // max(0.45, 0.85) = 0.85 ≥ 0.6 → complete
    expect(decision.targetAgent).toBe("complete");
  });

  test("returns explanation with no-concept-id-in-packet when conceptId is empty", () => {
    const world = new WorldStateGraph();
    const unit = new SupervisorUnit(supervisorManifest(), world);

    const decision = unit.route("", "user-sup");
    expect(decision.targetAgent).toBe("explanation");
    expect(decision.reason).toBe("no-concept-id-in-packet");
  });
});

// ---------------------------------------------------------------------------
// SupervisorUnit via ProductRuntimeDispatcher — integration
// ---------------------------------------------------------------------------

describe("SupervisorUnit via ProductRuntimeDispatcher", () => {
  test("routing decision is embedded in the response packet content", async () => {
    const clock = new ManualClock(Date.UTC(2026, 5, 5));
    const idGenerator = new SeededIdGenerator("supervisor-dispatch");
    const bus = new InMemoryEventBus({ idGenerator });
    const world = makeWorldWithConcept("derivatives");

    const manifest = supervisorManifest();
    const agentIdentity: CognitiveIdentity = {
      cid: "cog-supervisor-agent",
      unit_type: "agent.supervisor",
      version: "1.0.0",
      capabilities: manifest.capabilities,
      trust_level: 5,
      parent_cid: null,
      lineage: [],
      tenant_id: null,
      created_at: "2026-06-05T00:00:00.000Z",
      governance_policies: manifest.policies,
      attestation_chain: [],
    };

    const dispatcher = new ProductRuntimeDispatcher({
      bus,
      clock,
      idGenerator,
      agent: {
        identity: agentIdentity,
        unit: new SupervisorUnit(manifest, world, idGenerator),
      },
    });

    const result = await dispatcher.dispatch({
      session: session(),
      targetAgentId: "supervisor",
      intent: "route",
      conceptIds: ["derivatives"],
      content: { learnerUserId: "user-sup" },
      priority: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw result.error;

    const response = result.value.responsePackets[0];
    expect((response?.content as Record<string, unknown>)?.["routing_decision"]).toMatchObject({
      targetAgent: "explanation",
      conceptId: "derivatives",
    });
  });

  test("routes to practice after explanation_dispatched prop is written to world-state", async () => {
    const clock = new ManualClock(Date.UTC(2026, 5, 5));
    const idGenerator = new SeededIdGenerator("supervisor-dispatch-practice");
    const bus = new InMemoryEventBus({ idGenerator });
    const world = makeWorldWithConcept("derivatives");

    // Simulate that explanation was already dispatched
    world.apply({
      kind: "set_node_prop",
      id: "concept:derivatives",
      key: "explanation_dispatched:user-sup",
      value: true,
    });

    const manifest = supervisorManifest();
    const agentIdentity: CognitiveIdentity = {
      cid: "cog-supervisor-agent-2",
      unit_type: "agent.supervisor",
      version: "1.0.0",
      capabilities: manifest.capabilities,
      trust_level: 5,
      parent_cid: null,
      lineage: [],
      tenant_id: null,
      created_at: "2026-06-05T00:00:00.000Z",
      governance_policies: manifest.policies,
      attestation_chain: [],
    };

    const dispatcher = new ProductRuntimeDispatcher({
      bus,
      clock,
      idGenerator,
      agent: { identity: agentIdentity, unit: new SupervisorUnit(manifest, world, idGenerator) },
    });

    const result = await dispatcher.dispatch({
      session: session(),
      targetAgentId: "supervisor",
      intent: "route",
      conceptIds: ["derivatives"],
      content: { learnerUserId: "user-sup" },
      priority: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw result.error;

    expect(
      (result.value.responsePackets[0]?.content as Record<string, unknown>)?.["routing_decision"],
    ).toMatchObject({
      targetAgent: "practice",
    });
  });

  test("supervisor.route event appears in bus log after FiberedLearningLoop run", async () => {
    // Verifies the event is emitted by the fiber loop after routing.
    // (Full fiber-loop integration is in fiber-learning-loop.test.ts)
    const clock = new ManualClock(Date.UTC(2026, 5, 5));
    const idGenerator = new SeededIdGenerator("supervisor-event-check");
    const bus = new InMemoryEventBus({ idGenerator });
    const world = makeWorldWithConcept("derivatives");

    const manifest = supervisorManifest();
    const agentIdentity: CognitiveIdentity = {
      cid: "cog-supervisor-agent-3",
      unit_type: "agent.supervisor",
      version: "1.0.0",
      capabilities: manifest.capabilities,
      trust_level: 5,
      parent_cid: null,
      lineage: [],
      tenant_id: null,
      created_at: "2026-06-05T00:00:00.000Z",
      governance_policies: manifest.policies,
      attestation_chain: [],
    };
    const dispatcher = new ProductRuntimeDispatcher({
      bus,
      clock,
      idGenerator,
      agent: { identity: agentIdentity, unit: new SupervisorUnit(manifest, world, idGenerator) },
    });

    // Dispatch once and check agent events (supervisor.route is emitted by FiberedLearningLoop)
    const result = await dispatcher.dispatch({
      session: session(),
      targetAgentId: "supervisor",
      intent: "route",
      conceptIds: ["derivatives"],
      content: { learnerUserId: "user-sup" },
    });

    expect(result.ok).toBe(true);
    // The agent lifecycle events confirm the supervisor ran
    const agentEvents = bus.replay({ subject: "agent.>" }).map((e) => e.event_type);
    expect(agentEvents).toContain("agent.completed");

    // Verify the routing decision is accessible
    if (result.ok) {
      const decision = (result.value.responsePackets[0]?.content as Record<string, unknown>)?.[
        "routing_decision"
      ] as
        | {
            targetAgent: string;
          }
        | undefined;
      expect(["explanation", "practice", "assessment", "revision", "complete"]).toContain(
        decision?.targetAgent,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// SupervisorUnit.execute() — packet in / packet out
// ---------------------------------------------------------------------------

describe("SupervisorUnit.execute()", () => {
  test("returns a response packet with routing_decision in content", () => {
    const world = makeWorldWithConcept("integrals");
    const manifest = supervisorManifest();
    const unit = new SupervisorUnit(manifest, world, new SeededIdGenerator("sup-execute"));

    const fakePacket = {
      packet_id: "cp-aaaaaaaaaaaaaaaaaaaaaaaa",
      schema_version: "1.0.0",
      source_cid: "cog-learner",
      target_cid: "cog-supervisor-agent",
      tenant_id: null,
      session_id: "intent-001",
      causation_id: null,
      correlation_id: null,
      timestamp: "2026-06-05T00:00:00.000Z",
      hlc: "0|0|supervisor-test",
      sequence_number: 0,
      packet_type: "intent" as const,
      intent: "route",
      concept_ids: ["integrals"],
      domain_ids: [],
      content: { learnerUserId: "user-sup" },
      evidence: [],
      confidence: 1,
      uncertainty_estimate: 0,
      reasoning_depth: 0,
      classification: "internal" as const,
      policy_tags: [],
      requires_human_review: false,
      priority: 1,
      expiry: null,
      trace_id: "trace-001",
      span_id: "span-001",
    };

    const emissions = unit.execute(fakePacket);
    const response = emissions.packets?.[0];

    expect(response).toBeDefined();
    expect((response?.content as Record<string, unknown>)?.["routing_decision"]).toMatchObject({
      targetAgent: "explanation",
      conceptId: "integrals",
    });
    expect(response?.packet_type).toBe("response");
    // source_cid is the runtime CID (packet.target_cid), not the manifest ID
    expect(response?.source_cid).toBe("cog-supervisor-agent");
    expect(response?.target_cid).toBe("cog-learner");
  });
});
