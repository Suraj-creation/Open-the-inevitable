import { describe, expect, test } from "vitest";
import { InMemoryEventBus } from "@inevitable/events";
import { TieredMemoryStore } from "@inevitable/memory";
import type { CognitiveIdentity } from "@inevitable/protocols";
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";
import { WorldStateGraph } from "@inevitable/world-state";
import type { OnboardingSession } from "../src/types";
import { MVP_AGENT_MANIFESTS } from "../src/agent-catalog";
import { LearningPathProjector } from "../src/learning-path";
import { MasteryCheckpointRecorder } from "../src/mastery";
import { DeterministicMvpUnit, ProductRuntimeDispatcher } from "../src/runtime-dispatch";
import { DeterministicLearningLoop } from "../src/learning-loop";

function session(): OnboardingSession {
  const learnerIdentity: CognitiveIdentity = {
    cid: "cog-000000000111",
    unit_type: "human.student",
    version: "1.0.0",
    capabilities: ["product.onboarding", "product.navigation"],
    trust_level: 5,
    parent_cid: null,
    lineage: [],
    tenant_id: null,
    created_at: "2026-06-03T00:00:00.000Z",
    governance_policies: ["product-consent", "memory-scope"],
    attestation_chain: [],
  };

  return {
    learnerIdentity,
    capabilityEnvelope: {
      envelope_id: "env-000000000111",
      granted_to: learnerIdentity.cid,
      granted_by: "kernel",
      memory_scopes: ["working", "semantic"],
      max_spawn_depth: 1,
      max_child_units: 7,
      network_access: false,
      cost_ceiling_usd: 0,
      data_classification_ceiling: "internal",
      expires_at: "2026-06-03T01:00:00.000Z",
    },
    contextLease: {
      lease_id: "lease-000000000111",
      granted_to: learnerIdentity.cid,
      memory_layers: ["working", "semantic"],
      allowed_users: ["user-1"],
      token_budget: 16_000,
      granted_by: "kernel",
      expires_at: "2026-06-03T01:00:00.000Z",
    },
    intentLease: {
      intent_id: "intent-000000000111",
      owner_user_id: "user-1",
      interpreted_goal: "Understand gradient descent",
      scope: ["learning", "student"],
      constraints: ["spec-first", "depth-preserving"],
      expires_at: "2026-06-03T01:00:00.000Z",
      confidence: 1,
      held_by: [learnerIdentity.cid],
    },
    learnerNodeId: "learner:user-1",
    intentNodeId: "intent:intent-000000000111",
    seedMemoryMutationId: "mut-0000000000000111",
  };
}

function agentIdentity(kind: "explanation" | "practice"): CognitiveIdentity {
  const manifest = MVP_AGENT_MANIFESTS.find((candidate) => candidate.id === `agent.${kind}`);
  if (!manifest) throw new Error(`agent.${kind} manifest missing`);
  return {
    cid: kind === "explanation" ? "cog-000000000222" : "cog-000000000333",
    unit_type: `agent.${kind}`,
    version: "1.0.0",
    capabilities: manifest.capabilities,
    trust_level: 5,
    parent_cid: null,
    lineage: [],
    tenant_id: null,
    created_at: "2026-06-03T00:00:00.000Z",
    governance_policies: manifest.policies,
    attestation_chain: [],
  };
}

function dispatcher(
  kind: "explanation" | "practice",
  bus: InMemoryEventBus,
  clock: ManualClock,
  idGenerator: SeededIdGenerator,
): ProductRuntimeDispatcher {
  const manifest = MVP_AGENT_MANIFESTS.find((candidate) => candidate.id === `agent.${kind}`);
  if (!manifest) throw new Error(`agent.${kind} manifest missing`);
  return new ProductRuntimeDispatcher({
    bus,
    clock,
    idGenerator,
    nodeId: `loop-${kind}`,
    agent: {
      identity: agentIdentity(kind),
      unit: new DeterministicMvpUnit(manifest),
    },
  });
}

describe("DeterministicLearningLoop", () => {
  test("projects a path, dispatches explanation/practice agents, and records mastery", async () => {
    const clock = new ManualClock(Date.UTC(2026, 5, 3));
    const idGenerator = new SeededIdGenerator("learning-loop");
    const bus = new InMemoryEventBus({ idGenerator });
    const world = new WorldStateGraph({
      clock,
      nodeId: "learning-loop",
      acyclicEdgeTypes: ["prerequisite_of"],
    });
    const memory = new TieredMemoryStore();
    const loop = new DeterministicLearningLoop({
      learningPaths: new LearningPathProjector(world),
      dispatchers: {
        explanation: dispatcher("explanation", bus, clock, idGenerator),
        practice: dispatcher("practice", bus, clock, idGenerator),
      },
      mastery: new MasteryCheckpointRecorder({
        world,
        memory,
        bus,
        clock,
        idGenerator,
        nodeId: "learning-loop-mastery",
      }),
      bus,
      clock,
      idGenerator,
      nodeId: "learning-loop",
    });

    const result = await loop.run({
      session: session(),
      pathId: "path-gradient-descent",
      concepts: [
        { id: "linear-algebra", title: "Linear Algebra" },
        { id: "gradient-descent", title: "Gradient Descent", prerequisites: ["linear-algebra"] },
      ],
      focusConceptId: "gradient-descent",
      explanationPrompt: "Explain gradient descent intuitively",
      practicePrompt: "Give me one transfer practice task",
      mastery: {
        assessorCid: "cog-000000000333",
        passed: true,
        confidence: 0.88,
        evidence: [{ kind: "practice", result: "solved transfer task" }],
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw result.error;

    expect(world.getNode(result.value.path.pathNodeId)?.type).toBe("learning_path");
    expect(result.value.explanation.responsePackets[0]?.content).toMatchObject({
      handled_by: "agent.explanation",
      concepts: ["gradient-descent"],
    });
    expect(result.value.practice.responsePackets[0]?.content).toMatchObject({
      handled_by: "agent.practice",
      concepts: ["gradient-descent"],
    });
    expect(world.getNode(result.value.mastery.checkpointNodeId)?.type).toBe("mastery_checkpoint");
    expect(memory.projectionOf("semantic", result.value.mastery.checkpointNodeId)?.confidence).toBe(
      0.88,
    );
    // M3: prerequisite edge correctly materialized in world-state
    expect(
      world.hasPath("concept:linear-algebra", "concept:gradient-descent", "prerequisite_of"),
    ).toBe(true);

    // Orchestration observability: loop start/complete events bookend the interaction
    expect(bus.replay({ subject: "learning.loop.>" }).map((event) => event.event_type)).toEqual([
      "learning.loop.started",
      "learning.loop.completed",
    ]);
    expect(bus.replay({ subject: "agent.completed" })).toHaveLength(2);
    expect(bus.replay({ subject: "mastery.>" }).map((event) => event.event_type)).toEqual([
      "mastery.checkpoint.created",
      "mastery.verified",
    ]);
  });
});
