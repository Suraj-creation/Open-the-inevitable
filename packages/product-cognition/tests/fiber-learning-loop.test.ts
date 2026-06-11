import { describe, expect, test } from "vitest";
import { InMemoryEventBus } from "@inevitable/events";
import { TieredMemoryStore } from "@inevitable/memory";
import type { CognitiveIdentity } from "@inevitable/protocols";
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";
import { WorldStateGraph } from "@inevitable/world-state";
import { MVP_AGENT_MANIFESTS } from "../src/agent-catalog";
import { FiberedLearningLoop } from "../src/fiber-learning-loop";
import { LearningPathProjector } from "../src/learning-path";
import { MasteryCheckpointRecorder } from "../src/mastery";
import { DeterministicMvpUnit, ProductRuntimeDispatcher } from "../src/runtime-dispatch";
import { SupervisorUnit } from "../src/supervisor";
import type { OnboardingSession } from "../src/types";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function session(userId = "user-fiber"): OnboardingSession {
  const learnerIdentity: CognitiveIdentity = {
    cid: "cog-fiber-learner",
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
      envelope_id: "env-fiber-001",
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
      lease_id: "lease-fiber-001",
      granted_to: learnerIdentity.cid,
      memory_layers: ["working", "semantic"],
      allowed_users: [userId],
      token_budget: 16_000,
      granted_by: "kernel",
      expires_at: "2026-06-05T02:00:00.000Z",
    },
    intentLease: {
      intent_id: "intent-fiber-001",
      owner_user_id: userId,
      interpreted_goal: "Understand eigenvectors",
      scope: ["learning", "student"],
      constraints: [],
      expires_at: "2026-06-05T02:00:00.000Z",
      confidence: 1,
      held_by: [learnerIdentity.cid],
    },
    learnerNodeId: `learner:${userId}`,
    intentNodeId: "intent:intent-fiber-001",
    seedMemoryMutationId: "mut-fiber-001",
  };
}

function agentIdentity(
  kind: "supervisor" | "explanation" | "practice",
  cid: string,
): CognitiveIdentity {
  const manifest = MVP_AGENT_MANIFESTS.find((m) => m.id === `agent.${kind}`)!;
  return {
    cid,
    unit_type: `agent.${kind}`,
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
}

interface LoopFixture {
  loop: FiberedLearningLoop;
  world: WorldStateGraph;
  bus: InMemoryEventBus;
}

function makeLoop(_userId = "user-fiber", seed = "fiber-loop"): LoopFixture {
  const clock = new ManualClock(Date.UTC(2026, 5, 5));
  const idGenerator = new SeededIdGenerator(seed);
  const bus = new InMemoryEventBus({ idGenerator });
  const world = new WorldStateGraph({
    clock,
    nodeId: "fiber-loop",
    acyclicEdgeTypes: ["prerequisite_of"],
  });
  const memory = new TieredMemoryStore();

  const supManifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.supervisor")!;
  const expManifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.explanation")!;
  const prcManifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.practice")!;

  const supervisorDispatcher = new ProductRuntimeDispatcher({
    bus,
    clock,
    idGenerator,
    nodeId: "fiber-supervisor",
    agent: {
      identity: agentIdentity("supervisor", "cog-sup-fiber"),
      unit: new SupervisorUnit(supManifest, world, idGenerator),
    },
  });

  const explanationDispatcher = new ProductRuntimeDispatcher({
    bus,
    clock,
    idGenerator,
    nodeId: "fiber-explanation",
    agent: {
      identity: agentIdentity("explanation", "cog-exp-fiber"),
      unit: new DeterministicMvpUnit(expManifest, idGenerator),
    },
  });

  const practiceDispatcher = new ProductRuntimeDispatcher({
    bus,
    clock,
    idGenerator,
    nodeId: "fiber-practice",
    agent: {
      identity: agentIdentity("practice", "cog-prc-fiber"),
      unit: new DeterministicMvpUnit(prcManifest, idGenerator),
    },
  });

  const loop = new FiberedLearningLoop({
    learningPaths: new LearningPathProjector(world),
    supervisorDispatcher,
    dispatchers: {
      explanation: explanationDispatcher,
      practice: practiceDispatcher,
    },
    mastery: new MasteryCheckpointRecorder({
      world,
      memory,
      bus,
      clock,
      idGenerator,
      nodeId: "fiber-mastery",
    }),
    world,
    bus,
    clock,
    idGenerator,
    nodeId: "fiber-loop",
  });

  return { loop, world, bus };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FiberedLearningLoop", () => {
  test("runs explanation → practice → mastery and produces a non-empty execution journal", async () => {
    const { loop, world } = makeLoop();

    const result = await loop.run({
      session: session(),
      pathId: "path-eigenvectors",
      concepts: [
        { id: "linear-algebra", title: "Linear Algebra" },
        { id: "eigenvectors", title: "Eigenvectors", prerequisites: ["linear-algebra"] },
      ],
      focusConceptId: "eigenvectors",
      explanationPrompt: "Explain eigenvectors geometrically",
      practicePrompt: "Give me one practice problem",
      mastery: {
        assessorCid: "cog-sup-fiber",
        passed: true,
        confidence: 0.9,
        evidence: [{ kind: "practice", result: "solved correctly" }],
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw result.error;

    // Learning path was projected into world-state
    expect(world.getNode("path:path-eigenvectors")?.type).toBe("learning_path");
    expect(world.getNode("concept:eigenvectors")?.type).toBe("concept");

    // Prerequisite edge exists
    expect(world.hasPath("concept:linear-algebra", "concept:eigenvectors", "prerequisite_of")).toBe(
      true,
    );

    // Explanation and practice dispatches returned response packets
    expect(
      (result.value.explanation?.responsePackets[0]?.content as Record<string, unknown>)?.[
        "handled_by"
      ],
    ).toBe("agent.explanation");
    expect(
      (result.value.practice?.responsePackets[0]?.content as Record<string, unknown>)?.[
        "handled_by"
      ],
    ).toBe("agent.practice");

    // Mastery checkpoint was recorded
    expect(result.value.mastery).not.toBeNull();
    expect(world.getNode(result.value.mastery!.checkpointNodeId)?.type).toBe("mastery_checkpoint");

    // Supervisor routed to explanation (no prior evidence)
    expect(result.value.routing.targetAgent).toBe("explanation");

    // Journal contains the expected phase entries
    const journalLabels = result.value.journal
      .filter((e) => e.kind === "reason")
      .map((e) => e.detail["label"] as string);

    expect(journalLabels).toContain("phase:supervisor-routing");
    expect(journalLabels).toContain("phase:explanation-dispatch");
    expect(journalLabels).toContain("phase:practice-dispatch");
    expect(journalLabels).toContain("phase:mastery-record");
    expect(journalLabels).toContain("phase:cycle-complete");
    expect(result.value.journal.length).toBeGreaterThan(5);
  });

  test("emits supervisor.route and learning.fiber.* bridge events to the bus", async () => {
    const { loop, bus } = makeLoop("user-fiber", "fiber-events");

    const result = await loop.run({
      session: session(),
      pathId: "path-events-test",
      concepts: [{ id: "matrix-mult", title: "Matrix Multiplication" }],
      focusConceptId: "matrix-mult",
      explanationPrompt: "Explain matrix multiplication",
      practicePrompt: "Give me a practice problem",
      mastery: {
        assessorCid: "cog-sup-fiber",
        passed: false,
        confidence: 0.3,
        evidence: [],
      },
    });

    expect(result.ok).toBe(true);

    // supervisor.route event is emitted after routing decision
    const supervisorRouteEvents = bus.replay({ subject: "supervisor.route" });
    expect(supervisorRouteEvents).toHaveLength(1);
    expect((supervisorRouteEvents[0]?.payload as Record<string, unknown>)?.["target_agent"]).toBe(
      "explanation",
    );

    // Bridge events were published on the bus
    const bridgeEvents = bus.replay({ subject: "learning.fiber.>" }).map((e) => e.event_type);
    expect(bridgeEvents).toContain("learning.fiber.supervisor.routing.requested");
    expect(bridgeEvents).toContain("learning.fiber.dispatch.requested");
    expect(bridgeEvents).toContain("learning.fiber.mastery.record.requested");

    // Mastery events confirm the checkpoint was recorded
    const masteryEvents = bus.replay({ subject: "mastery.>" }).map((e) => e.event_type);
    expect(masteryEvents).toContain("mastery.checkpoint.created");
    expect(masteryEvents).toContain("mastery.rejected"); // passed=false
  });

  test("phase-tracking props are written to world-state after dispatches", async () => {
    const { loop, world } = makeLoop("user-fiber", "fiber-phase-track");

    const result = await loop.run({
      session: session(),
      pathId: "path-phase-track",
      concepts: [{ id: "calculus", title: "Calculus" }],
      focusConceptId: "calculus",
      explanationPrompt: "Explain calculus",
      practicePrompt: "Practice calculus",
      mastery: {
        assessorCid: "cog-sup-fiber",
        passed: true,
        confidence: 0.85,
        evidence: [],
      },
    });

    expect(result.ok).toBe(true);

    // Phase-tracking props were written
    const conceptNode = world.getNode("concept:calculus");
    expect(conceptNode?.props?.["explanation_dispatched:user-fiber"]).toBe(true);
    expect(conceptNode?.props?.["practice_dispatched:user-fiber"]).toBe(true);
  });

  test("returns early (no explanation/practice) when supervisor routes to complete", async () => {
    const { loop, world, bus } = makeLoop("user-fiber", "fiber-complete");

    // Pre-populate a passing mastery checkpoint so the supervisor routes to complete
    world.apply({
      kind: "upsert_node",
      id: "concept:already-mastered",
      type: "concept",
      props: { conceptId: "already-mastered" },
    });
    world.apply({
      kind: "upsert_node",
      id: "mastery:user-fiber:already-mastered:existing",
      type: "mastery_checkpoint",
      props: {
        conceptId: "already-mastered",
        ownerUserId: "user-fiber",
        passed: true,
        confidence: 0.99,
      },
    });

    const result = await loop.run({
      session: session(),
      pathId: "path-already-mastered",
      concepts: [{ id: "already-mastered", title: "Already Mastered" }],
      focusConceptId: "already-mastered",
      explanationPrompt: "Should not be called",
      practicePrompt: "Should not be called",
      mastery: {
        assessorCid: "cog-sup-fiber",
        passed: true,
        confidence: 1,
        evidence: [],
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw result.error;

    // Supervisor routes to complete
    expect(result.value.routing.targetAgent).toBe("complete");

    // No explanation or practice dispatched
    expect(result.value.explanation).toBeNull();
    expect(result.value.practice).toBeNull();

    // No mastery recording needed (early exit before mastery phase)
    expect(result.value.mastery).toBeNull();

    // Journal shows early exit
    const journalLabels = result.value.journal
      .filter((e) => e.kind === "reason")
      .map((e) => e.detail["label"] as string);
    expect(journalLabels).toContain("phase:early-exit");
    expect(journalLabels).not.toContain("phase:explanation-dispatch");

    // supervisor.route event still emitted
    const routeEvents = bus.replay({ subject: "supervisor.route" });
    expect(routeEvents).toHaveLength(1);
    expect((routeEvents[0]?.payload as Record<string, unknown>)?.["target_agent"]).toBe("complete");
  });

  test("journal is deterministic across identical runs (same clock + idGenerator)", async () => {
    // Two loops with the same seeded state should produce identical journal shapes.
    const run = async () => {
      const { loop } = makeLoop("user-fiber", "fiber-deterministic");
      return loop.run({
        session: session(),
        pathId: "path-det",
        concepts: [{ id: "det-concept", title: "Deterministic Concept" }],
        focusConceptId: "det-concept",
        explanationPrompt: "Explain",
        practicePrompt: "Practice",
        mastery: {
          assessorCid: "cog-sup-fiber",
          passed: true,
          confidence: 0.8,
          evidence: [],
        },
      });
    };

    const [r1, r2] = await Promise.all([run(), run()]);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;

    // Both journals should have the same number of entries and same kinds/labels
    expect(r1.value.journal.length).toBe(r2.value.journal.length);
    const labels1 = r1.value.journal.map((e) => ({ kind: e.kind, label: e.detail["label"] }));
    const labels2 = r2.value.journal.map((e) => ({ kind: e.kind, label: e.detail["label"] }));
    expect(labels1).toEqual(labels2);
  });

  test("path projection failure returns a typed error without running the fiber", async () => {
    const { loop } = makeLoop("user-fiber", "fiber-path-fail");

    // Introduce a cycle in concepts — Kahn's validation should reject before fiber starts
    const result = await loop.run({
      session: session(),
      pathId: "path-cyclic",
      concepts: [
        { id: "a", title: "A", prerequisites: ["b"] },
        { id: "b", title: "B", prerequisites: ["a"] }, // cycle
      ],
      focusConceptId: "a",
      explanationPrompt: "Explain",
      practicePrompt: "Practice",
      mastery: {
        assessorCid: "cog-sup-fiber",
        passed: false,
        confidence: 0,
        evidence: [],
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("E_PRODUCT_LEARNING_PATH");
    }
  });
});
