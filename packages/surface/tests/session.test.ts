/**
 * Phase 2A acceptance: start a Cognitive Surface Session, ask "Teach me Neural Networks",
 * watch the living timeline generate, cognition blocks appear, supervisor decisions surface,
 * world-state update — then replay the session deterministically and trace every visible
 * artifact back to its source.
 */
import { describe, expect, test } from "vitest";
import { GovernanceEngine } from "@inevitable/governance";
import { InMemoryEventBus } from "@inevitable/events";
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
  type OnboardingSession,
} from "@inevitable/product-cognition";
import type { ModelRuntime } from "@inevitable/contracts";
import type { CognitiveIdentity } from "@inevitable/protocols";
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";
import { WorldStateGraph } from "@inevitable/world-state";
import { foldSurfaceEvents } from "../src/projection";
import { TextSurfaceRenderer } from "../src/renderer";
import { SurfaceSession, type SurfaceAskInput } from "../src/session";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function onboarding(userId = "user-surface", trustLevel = 5): OnboardingSession {
  const learnerIdentity: CognitiveIdentity = {
    cid: "cog-surface-learner",
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
      envelope_id: "env-surface-001",
      granted_to: learnerIdentity.cid,
      granted_by: "kernel",
      memory_scopes: ["working", "semantic"],
      max_spawn_depth: 1,
      max_child_units: 7,
      network_access: false,
      cost_ceiling_usd: 0,
      data_classification_ceiling: "internal",
      expires_at: "2026-06-11T02:00:00.000Z",
    },
    contextLease: {
      lease_id: "lease-surface-001",
      granted_to: learnerIdentity.cid,
      memory_layers: ["working", "semantic"],
      allowed_users: [userId],
      token_budget: 16_000,
      granted_by: "kernel",
      expires_at: "2026-06-11T02:00:00.000Z",
    },
    intentLease: {
      intent_id: "intent-surface-001",
      owner_user_id: userId,
      interpreted_goal: "Understand neural networks deeply",
      scope: ["learning", "student"],
      constraints: [],
      expires_at: "2026-06-11T02:00:00.000Z",
      confidence: 1,
      held_by: [learnerIdentity.cid],
    },
    learnerNodeId: `learner:${userId}`,
    intentNodeId: "intent:intent-surface-001",
    seedMemoryMutationId: "mut-surface-001",
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
    created_at: "2026-06-11T00:00:00.000Z",
    governance_policies: manifest.policies,
    attestation_chain: [],
  };
}

interface Fixture {
  surface: SurfaceSession;
  world: WorldStateGraph;
  bus: InMemoryEventBus;
}

/**
 * A minimal fake model that returns layered explanation JSON — stands in for live, dynamic
 * generation (Gemini in production). Deterministic per call so replay stays exact, but the
 * content is *generated*, not pre-authored: this is the dynamic classroom path, not a static script.
 */
function fakeLayeredModel(): ModelRuntime {
  return {
    async generate() {
      return {
        text: JSON.stringify({
          layers: {
            layer_0:
              "A perceptron weighs each input and fires when the weighted sum crosses a threshold.",
            layer_1: "Picture a row of dials feeding a single gate that flips on past a cutoff.",
          },
          summary: "A perceptron is a threshold-weighted linear classifier.",
          confidence: 0.9,
          reasoning: "intuition-first, then a visual model",
        }),
        model: "fake-layered-model",
        finishReason: "stop",
      };
    },
    async embed() {
      return [0, 0, 0, 0, 0, 0, 0, 0];
    },
  };
}

function makeFixture(
  seed = "surface-session",
  options: { governance?: boolean; trustLevel?: number; explanationModel?: ModelRuntime } = {},
): Fixture {
  const clock = new ManualClock(Date.UTC(2026, 5, 11));
  const idGenerator = new SeededIdGenerator(seed);
  const bus = new InMemoryEventBus({ idGenerator });
  const world = new WorldStateGraph({
    clock,
    nodeId: "surface-session",
    acyclicEdgeTypes: ["prerequisite_of"],
  });
  const memory = new TieredMemoryStore();
  const session = onboarding("user-surface", options.trustLevel ?? 5);
  const governance = options.governance
    ? new GovernanceEngine(PRODUCT_DISPATCH_POLICIES, { idGenerator })
    : undefined;

  const supManifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.supervisor")!;
  const expManifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.explanation")!;
  const prcManifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.practice")!;

  const loop = new FiberedLearningLoop({
    learningPaths: new LearningPathProjector(world),
    supervisorDispatcher: new ProductRuntimeDispatcher({
      bus,
      clock,
      idGenerator,
      nodeId: "surface-supervisor",
      agent: {
        identity: agentIdentity("supervisor", "cog-sup-surface"),
        unit: new SupervisorUnit(supManifest, world, idGenerator),
      },
      governance,
    }),
    dispatchers: {
      explanation: new ProductRuntimeDispatcher({
        bus,
        clock,
        idGenerator,
        nodeId: "surface-explanation",
        agent: {
          identity: agentIdentity("explanation", "cog-exp-surface"),
          // Default: deterministic offline unit. With an explanationModel, the explanation is
          // generated dynamically (model-backed) — the product's real, live path.
          unit: options.explanationModel
            ? new ModelBackedUnit({
                manifest: expManifest,
                model: options.explanationModel,
                role: "explanation",
                fallback: new DeterministicMvpUnit(expManifest, idGenerator),
                world,
                idGenerator,
              })
            : new DeterministicMvpUnit(expManifest, idGenerator),
        },
        governance,
      }),
      practice: new ProductRuntimeDispatcher({
        bus,
        clock,
        idGenerator,
        nodeId: "surface-practice",
        agent: {
          identity: agentIdentity("practice", "cog-prc-surface"),
          unit: new DeterministicMvpUnit(prcManifest, idGenerator),
        },
        governance,
      }),
    },
    mastery: new MasteryCheckpointRecorder({
      world,
      memory,
      bus,
      clock,
      idGenerator,
      nodeId: "surface-mastery",
    }),
    world,
    bus,
    clock,
    idGenerator,
    nodeId: "surface-loop",
  });

  const surface = new SurfaceSession({
    session,
    world,
    bus,
    loop,
    supervisorCid: "cog-sup-surface",
    clock,
    idGenerator,
    nodeId: "surface-session",
  });

  return { surface, world, bus };
}

function teachMeNeuralNetworks(): SurfaceAskInput {
  return {
    goal: "Teach me Neural Networks",
    pathId: "path-neural-networks",
    concepts: [
      { id: "linear-algebra", title: "Linear Algebra" },
      { id: "gradient-descent", title: "Gradient Descent" },
      {
        id: "perceptron",
        title: "The Perceptron",
        prerequisites: ["linear-algebra"],
      },
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
      assessorCid: "cog-sup-surface",
      passed: true,
      confidence: 0.9,
      evidence: [{ kind: "practice", result: "solved correctly" }],
    },
  };
}

// ---------------------------------------------------------------------------
// Phase 2A acceptance
// ---------------------------------------------------------------------------

describe("SurfaceSession — end-to-end 'Teach me Neural Networks'", () => {
  test("the surface evolves: timeline, blocks, supervisor decisions, world-state", async () => {
    const { surface, world } = makeFixture();

    // 1. Start a Cognitive Surface Session
    const started = await surface.start("Teach me Neural Networks");
    expect(started.ok).toBe(true);
    if (!started.ok) throw started.error;
    expect(world.getNode(`surface:${started.value}`)?.type).toBe("surface_session");

    // 2-3. Ask, see a living timeline generated
    const asked = await surface.ask(teachMeNeuralNetworks());
    expect(asked.ok).toBe(true);
    if (!asked.ok) throw asked.error;

    const timeline = asked.value.timeline;
    expect(timeline.goal).toBe("Teach me Neural Networks");
    expect(timeline.nodes.map((n) => n.concept_id)).toEqual([
      "linear-algebra",
      "gradient-descent",
      "perceptron",
      "neural-networks",
    ]);
    // The focus concept was explained, practiced, and mastered in this cycle
    const status = new Map(timeline.nodes.map((n) => [n.concept_id, n.status]));
    expect(status.get("linear-algebra")).toBe("mastered");
    expect(status.get("perceptron")).toBe("available"); // unlocked by mastery
    expect(status.get("neural-networks")).toBe("locked");

    // 4. Cognition blocks appeared, typed and ordered
    expect(asked.value.blocks.map((b) => b.block_type)).toEqual([
      "routing",
      "explanation",
      "practice",
      "assessment",
    ]);

    // 5. Supervisor orchestration decision is visible
    expect(asked.value.routing.targetAgent).toBe("explanation");
    expect(asked.value.state.routing_decisions).toHaveLength(1);
    expect(asked.value.state.routing_decisions[0]?.target_agent).toBe("explanation");

    // 6. Agent contributions are recorded with agent identity
    expect(asked.value.state.agents_joined).toContain("cog-exp-surface");
    expect(asked.value.state.agents_joined).toContain("cog-prc-surface");
    expect(asked.value.state.contributions.length).toBeGreaterThanOrEqual(4);

    // 7. World-state updated: mastery checkpoint + phase props exist
    const conceptNode = world.getNode("concept:linear-algebra");
    expect(conceptNode?.props["explanation_dispatched:user-surface"]).toBe(true);
    expect(world.nodesByType("mastery_checkpoint").length).toBe(1);

    // The fiber journal is part of the result (D2 replayable record)
    expect(asked.value.loop.journal.length).toBeGreaterThan(5);
  });

  test("8. the session replays deterministically", async () => {
    // Identical seeds ⇒ identical event logs ⇒ identical folded state
    const run = async () => {
      const { surface, bus } = makeFixture("surface-replay");
      await surface.start("Teach me Neural Networks");
      const asked = await surface.ask(teachMeNeuralNetworks());
      expect(asked.ok).toBe(true);
      await surface.close();
      return { state: surface.state(), events: bus.replay({ subject: "surface.>" }) };
    };

    const [a, b] = await Promise.all([run(), run()]);
    expect(a.state).toEqual(b.state);
    expect(a.events.map((e) => e.event_type)).toEqual(b.events.map((e) => e.event_type));

    // Folding the replayed log reconstructs the live state exactly
    const refolded = foldSurfaceEvents(a.events, a.state?.surface_id);
    expect(refolded).toEqual(a.state);
  });

  test("9. every visible artifact traces back to its source", async () => {
    const { surface, world } = makeFixture("surface-trace");
    await surface.start("Teach me Neural Networks");
    const asked = await surface.ask(teachMeNeuralNetworks());
    expect(asked.ok).toBe(true);
    if (!asked.ok) throw asked.error;

    for (const block of asked.value.blocks) {
      const trace = surface.trace(block.block_id);
      expect(trace.ok).toBe(true);
      if (!trace.ok) throw trace.error;

      // Every block has a producer and a reason — nothing appears magically
      expect(trace.value.producer_cid).toBeTruthy();
      expect(trace.value.reason).toBeTruthy();
      // Every block is anchored in world-state, and the nodes actually exist
      expect(trace.value.world_state_nodes.length).toBeGreaterThan(0);
      expect(trace.value.world_state_nodes.every((n) => n.exists)).toBe(true);
      // Every block is announced by at least one event (block.generated + agent.contributed)
      expect(trace.value.event_chain.length).toBeGreaterThanOrEqual(2);
    }

    // Agent-produced blocks carry the packet linkage
    const explanation = asked.value.blocks.find((b) => b.block_type === "explanation");
    expect(explanation?.provenance.packet_id).toBeTruthy();
    expect(explanation?.provenance.trace_id).toBeTruthy();

    // The assessment block is memory-backed
    const assessment = asked.value.blocks.find((b) => b.block_type === "assessment");
    expect(assessment?.provenance.memory_mutation_id).toBeTruthy();
    expect(world.getNode(assessment!.provenance.world_state_nodes[0]!)?.type).toBe(
      "mastery_checkpoint",
    );
  });

  test("the surface speaks live: dynamic explanation is narrated, focused, with agent presence", async () => {
    // Dynamic (model-backed) explanation — the real classroom path, not a static script.
    const { surface } = makeFixture("surface-choreo", { explanationModel: fakeLayeredModel() });
    await surface.start("Teach me Neural Networks");
    const asked = await surface.ask(teachMeNeuralNetworks());
    expect(asked.ok).toBe(true);
    if (!asked.ok) throw asked.error;

    const state = asked.value.state;
    // The dynamically-generated explanation was narrated, segment by segment, focused on its block.
    const explanation = asked.value.blocks.find((b) => b.block_type === "explanation");
    expect(explanation).toBeTruthy();
    expect(state.narration.length).toBeGreaterThanOrEqual(1);
    expect(state.narration.every((s) => s.block_id === explanation!.block_id)).toBe(true);
    expect(state.narration[0]?.sequence).toBe(0);
    // The narration is the generated content, not a canned line.
    expect(state.narration.map((s) => s.text).join(" ")).toContain("perceptron");
    expect(state.focus?.target_id).toBe(explanation!.block_id);
    // Agents are visible entities (presence keyed by CID; one CID may play several roles in the MVP).
    expect(state.presence.length).toBeGreaterThanOrEqual(2);
    const roles = new Set(state.presence.map((p) => p.role));
    expect(roles.has("explainer")).toBe(true);
    expect(state.presence.find((p) => p.role === "explainer")?.state).toBe("contributing");
  });

  test("event ordering laws hold (created first, joined before contributed, closed terminal)", async () => {
    const { surface, bus } = makeFixture("surface-ordering");
    await surface.start("Teach me Neural Networks");
    await surface.ask(teachMeNeuralNetworks());
    await surface.close();

    const types = bus.replay({ subject: "surface.>" }).map((e) => e.event_type);
    expect(types[0]).toBe("surface.created");
    expect(types[types.length - 1]).toBe("surface.session.closed");
    expect(types.indexOf("surface.agent.joined")).toBeLessThan(
      types.indexOf("surface.agent.contributed"),
    );
    expect(types.indexOf("surface.timeline.generated")).toBeLessThan(
      types.indexOf("surface.timeline.updated"),
    );
    expect(types).toContain("surface.reasoning.recorded");
    expect(types).toContain("surface.memory.attached");
  });

  test("a closed surface rejects further asks", async () => {
    const { surface } = makeFixture("surface-closed");
    await surface.start();
    await surface.close();

    const asked = await surface.ask(teachMeNeuralNetworks());
    expect(asked.ok).toBe(false);
    if (!asked.ok) expect(asked.error.code).toBe("E_SURFACE_SESSION");
  });

  test("renderer is a pure projection: same state, identical frames", async () => {
    const { surface } = makeFixture("surface-render");
    await surface.start("Teach me Neural Networks");
    const asked = await surface.ask(teachMeNeuralNetworks());
    expect(asked.ok).toBe(true);
    if (!asked.ok) throw asked.error;

    const renderer = new TextSurfaceRenderer();
    const frame = renderer.render(asked.value.state);
    expect(renderer.render(asked.value.state)).toBe(frame);

    // The frame shows the living timeline, the blocks, and the supervisor decision
    expect(frame).toContain("Teach me Neural Networks");
    expect(frame).toContain("Living Timeline");
    expect(frame).toContain("[x] 1. Linear Algebra (mastered)");
    expect(frame).toContain("Explanation — Linear Algebra");
    expect(frame).toContain("-> explanation:");
  });

  test("governance gates the surface: untrusted learner gets no agent blocks", async () => {
    const { surface, bus } = makeFixture("surface-governed", {
      governance: true,
      trustLevel: 0,
    });
    await surface.start("Teach me Neural Networks");
    const asked = await surface.ask(teachMeNeuralNetworks());
    expect(asked.ok).toBe(true);
    if (!asked.ok) throw asked.error;

    // All dispatches were blocked: routing fell back, no explanation/practice blocks exist
    const types = asked.value.blocks.map((b) => b.block_type);
    expect(types).not.toContain("explanation");
    expect(types).not.toContain("practice");
    // No governed agent ever joined the surface
    const joins = bus
      .replay({ subject: "surface.agent.joined" })
      .map((e) => (e.payload as Record<string, unknown>)["agent_cid"]);
    expect(joins).not.toContain("cog-exp-surface");
    expect(joins).not.toContain("cog-prc-surface");
  });
});
