/**
 * Demo composition root — wires the full governed substrate into one Cognitive Surface
 * session: world-state graph, event bus, governance, supervisor routing, model-backed
 * explanation/practice units (with deterministic fallbacks), mastery recording, and the
 * surface runtime. Mirrors the Phase 2A acceptance fixture (packages/surface/tests/session.test.ts).
 *
 * Spec: spec/surface/cognitive-surface-runtime.md, spec/product/product-cognition-runtime.md §11.
 */
import type { ModelRuntime } from "@inevitable/contracts";
import { InMemoryEventBus, type EventBus } from "@inevitable/events";
import { GovernanceEngine } from "@inevitable/governance";
import { TieredMemoryStore } from "@inevitable/memory";
import {
  DeterministicMvpUnit,
  FiberedLearningLoop,
  LearningPathProjector,
  MVP_AGENT_MANIFESTS,
  MasteryCheckpointRecorder,
  ModelBackedUnit,
  PRODUCT_DISPATCH_POLICIES,
  ProductRuntimeDispatcher,
  SupervisorUnit,
  type ModelBackedRole,
  type OnboardingSession,
} from "@inevitable/product-cognition";
import type { CognitiveIdentity } from "@inevitable/protocols";
import { ManualClock, SeededIdGenerator, type Clock, type IdGenerator } from "@inevitable/shared";
import { SurfaceSession, type SurfaceAskInput } from "@inevitable/surface";
import { WorldStateGraph } from "@inevitable/world-state";

export interface DemoFixture {
  readonly surface: SurfaceSession;
  readonly bus: InMemoryEventBus;
  readonly world: WorldStateGraph;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
}

export interface DemoOptions {
  /** Builds the ModelRuntime for the model-backed units (recording wrapper goes here). */
  readonly modelFactory: (bus: EventBus, clock: Clock, idGenerator: IdGenerator) => ModelRuntime;
  readonly seed?: string;
  readonly trustLevel?: number;
}

function onboarding(userId: string, trustLevel: number): OnboardingSession {
  const learnerIdentity: CognitiveIdentity = {
    cid: "cog-demo-learner",
    unit_type: "human.student",
    version: "1.0.0",
    capabilities: ["product.onboarding"],
    trust_level: trustLevel,
    parent_cid: null,
    lineage: [],
    tenant_id: null,
    created_at: "2026-06-11T00:00:00.000Z",
    governance_policies: [],
    attestation_chain: [],
  };
  return {
    learnerIdentity,
    capabilityEnvelope: {
      envelope_id: "env-demo-001",
      granted_to: learnerIdentity.cid,
      granted_by: "kernel",
      memory_scopes: ["working", "semantic"],
      max_spawn_depth: 1,
      max_child_units: 7,
      network_access: true,
      cost_ceiling_usd: 1,
      data_classification_ceiling: "internal",
      expires_at: "2026-06-11T02:00:00.000Z",
    },
    contextLease: {
      lease_id: "lease-demo-001",
      granted_to: learnerIdentity.cid,
      memory_layers: ["working", "semantic"],
      allowed_users: [userId],
      token_budget: 16_000,
      granted_by: "kernel",
      expires_at: "2026-06-11T02:00:00.000Z",
    },
    intentLease: {
      intent_id: "intent-demo-001",
      owner_user_id: userId,
      interpreted_goal: "Understand the requested topic deeply",
      scope: ["learning", "student"],
      constraints: [],
      expires_at: "2026-06-11T02:00:00.000Z",
      confidence: 1,
      held_by: [learnerIdentity.cid],
    },
    learnerNodeId: `learner:${userId}`,
    intentNodeId: "intent:intent-demo-001",
    seedMemoryMutationId: "mut-demo-001",
  };
}

function agentIdentity(kind: string, cid: string): CognitiveIdentity {
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
    created_at: "2026-06-11T00:00:00.000Z",
    governance_policies: manifest.policies,
    attestation_chain: [],
  };
}

/** Build a fully wired, seeded demo session over the governed substrate. */
export function buildDemoSession(options: DemoOptions): DemoFixture {
  const clock = new ManualClock(Date.UTC(2026, 5, 11));
  const idGenerator = new SeededIdGenerator(options.seed ?? "inevitable-demo");
  const bus = new InMemoryEventBus({ idGenerator });
  const world = new WorldStateGraph({
    clock,
    nodeId: "demo",
    acyclicEdgeTypes: ["prerequisite_of"],
  });
  const memory = new TieredMemoryStore();
  const session = onboarding("user-demo", options.trustLevel ?? 5);
  const governance = new GovernanceEngine(PRODUCT_DISPATCH_POLICIES, { idGenerator });
  const model = options.modelFactory(bus, clock, idGenerator);

  const manifest = (id: string) => MVP_AGENT_MANIFESTS.find((m) => m.id === `agent.${id}`)!;
  const modelUnit = (role: ModelBackedRole) =>
    new ModelBackedUnit({
      manifest: manifest(role),
      model,
      role,
      fallback: new DeterministicMvpUnit(manifest(role), idGenerator),
      world,
      timeoutMs: 30_000,
      idGenerator,
    });
  const dispatcher = (
    kind: string,
    cid: string,
    unit: ConstructorParameters<typeof ProductRuntimeDispatcher>[0]["agent"]["unit"],
  ) =>
    new ProductRuntimeDispatcher({
      bus,
      clock,
      idGenerator,
      nodeId: `demo-${kind}`,
      agent: { identity: agentIdentity(kind, cid), unit },
      governance,
    });

  const explanationDispatcher = dispatcher("explanation", "cog-exp-demo", modelUnit("explanation"));
  const loop = new FiberedLearningLoop({
    learningPaths: new LearningPathProjector(world),
    supervisorDispatcher: dispatcher(
      "supervisor",
      "cog-sup-demo",
      new SupervisorUnit(manifest("supervisor"), world, idGenerator),
    ),
    dispatchers: {
      explanation: explanationDispatcher,
      practice: dispatcher("practice", "cog-prc-demo", modelUnit("practice")),
    },
    mastery: new MasteryCheckpointRecorder({
      world,
      memory,
      bus,
      clock,
      idGenerator,
      nodeId: "demo-mastery",
    }),
    world,
    bus,
    clock,
    idGenerator,
    nodeId: "demo-loop",
  });

  const surface = new SurfaceSession({
    session,
    world,
    bus,
    loop,
    explanationDispatcher,
    supervisorCid: "cog-sup-demo",
    clock,
    idGenerator,
    nodeId: "demo-surface",
  });

  return { surface, bus, world, clock, idGenerator };
}

/** The canonical demo ask. */
export function demoAsk(goal: string): SurfaceAskInput {
  return {
    goal,
    pathId: "path-demo",
    concepts: [
      { id: "linear-algebra", title: "Linear Algebra" },
      { id: "gradient-descent", title: "Gradient Descent" },
      { id: "perceptron", title: "The Perceptron", prerequisites: ["linear-algebra"] },
      {
        id: "neural-networks",
        title: "Neural Networks",
        prerequisites: ["perceptron", "gradient-descent"],
      },
    ],
    focusConceptId: "linear-algebra",
    explanationPrompt: "Explain linear algebra as the geometry of data",
    practicePrompt: "Give me one matrix-vector practice problem",
    mastery: {
      assessorCid: "cog-sup-demo",
      passed: true,
      confidence: 0.9,
      evidence: [{ kind: "practice", result: "solved correctly" }],
    },
  };
}
