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
  FramePlannerUnit,
  ImagePlannerUnit,
  LearningPathProjector,
  MVP_AGENT_MANIFESTS,
  MasteryCheckpointRecorder,
  ModelBackedUnit,
  PRODUCT_DISPATCH_POLICIES,
  ProductRuntimeDispatcher,
  SupervisorUnit,
  SurfaceComposerUnit,
  type DepthTestResult,
  type OnboardingSession,
} from "@inevitable/product-cognition";
import type { ModelRuntime } from "@inevitable/contracts";
import type { CognitionPacket, CognitiveIdentity, CognitiveWorkItem } from "@inevitable/protocols";
import { ManualClock, SeededIdGenerator, ok } from "@inevitable/shared";
import { WorldStateGraph } from "@inevitable/world-state";
import { foldSurfaceEvents } from "../src/projection";
import type { MediaGenerator } from "../src/providers";
import { TextSurfaceRenderer } from "../src/renderer";
import { SurfaceSession, type GovernedDispatcher, type SurfaceAskInput } from "../src/session";
import type { SurfaceFrontierProvider } from "../src/source-projection";

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
  kind: "supervisor" | "explanation" | "practice" | "composer" | "frameplanner" | "imageplanner",
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

/**
 * A fake composer model: distilled MCCR anchors + a SEPARATE narration script + an image decision.
 * The board text and the spoken text are deliberately DIFFERENT (no duplication) — UCS, ADR-0030.
 */
function fakeComposerModel(): ModelRuntime {
  return {
    async generate() {
      return {
        text: JSON.stringify({
          mccr: {
            core_concept: "Linear algebra",
            definition: "The study of vectors, matrices, and the linear maps between them.",
            key_formula: { latex: "A\\mathbf{x}=\\mathbf{b}", plain: "A x equals b" },
            mental_model: "Data as arrows in space; matrices reshape that space.",
          },
          narration_script: {
            segments: [
              {
                text: "Think of every data point as an arrow pointing out from the origin.",
                anchor_ref: "mental_model",
                intent: "introduce",
                pause_after: false,
              },
              {
                text: "A matrix is a machine that stretches and rotates all those arrows at once.",
                anchor_ref: "core_concept",
                intent: "build",
                pause_after: false,
              },
              {
                text: "So solving A x equals b asks: which arrow, once reshaped, lands on b?",
                anchor_ref: "key_formula",
                intent: "connect",
                pause_after: true,
              },
            ],
          },
          image_plan: {
            helps: true,
            prompt: "vectors as arrows being transformed by a matrix grid",
            rationale: "a visual makes the reshaping concrete",
          },
        }),
        model: "fake-composer-model",
        finishReason: "stop",
      };
    },
    async embed() {
      return [0, 0, 0, 0, 0, 0, 0, 0];
    },
  };
}

/**
 * A composer whose look-ahead (next-concept) composition BLOCKS on a manual gate, so a test can prove
 * a learner interrupt cancels the in-flight background speculation (ADR-0063 Phase F). The on-screen
 * frames (focus concept) resolve immediately; only the speculative compose for `blockTitle` waits.
 */
function gatedComposerModel(blockTitle: string): { model: ModelRuntime; release: () => void } {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const base = fakeComposerModel();
  const model: ModelRuntime = {
    async generate(request) {
      if (typeof request.prompt === "string" && request.prompt.includes(blockTitle)) {
        await gate; // hold the speculation open until the test releases it
      }
      return base.generate(request);
    },
    async embed() {
      return [0, 0, 0, 0, 0, 0, 0, 0];
    },
  };
  return { model, release };
}

/**
 * A composer that STREAMS its output (ADR-0063 Phase B): the same fake composition, chunked into
 * `chunks` text deltas with a terminal whole result — so a test can watch the board form via
 * `surface.frame.element.delta` and prove settled state is delta-independent.
 */
function streamingComposerModel(chunks = 12): ModelRuntime {
  const base = fakeComposerModel();
  return {
    generate: (req) => base.generate(req),
    embed: (t) => base.embed(t),
    generateStream() {
      return {
        async *[Symbol.asyncIterator]() {
          const whole = await base.generate({ prompt: "" });
          const text = whole.text;
          const size = Math.max(1, Math.ceil(text.length / chunks));
          for (let i = 0; i < text.length; i += size) yield { textDelta: text.slice(i, i + size) };
          yield {
            textDelta: "",
            result: { text, model: whole.model, finishReason: "stop" as const },
          };
        },
      };
    },
  };
}

/**
 * A fake frame planner: decomposes the concept into a 2-frame progressive sequence (intuition →
 * formal), each with a distinct sub_focus — UCS, ADR-0030 Phase 2. Deterministic per call.
 */
function fakeFramePlannerModel(): ModelRuntime {
  return {
    async generate() {
      return {
        text: JSON.stringify({
          frames: [
            {
              title: "Intuition: arrows in space",
              sub_focus: "the geometric intuition of vectors and transformations",
              archetype: "image-led",
              slots: ["core_concept", "mental_model"],
              intent: "introduce",
            },
            {
              title: "The map, precisely",
              sub_focus: "the formal definition and the matrix equation",
              archetype: "formal",
              slots: ["definition", "key_formula"],
              intent: "deepen",
            },
          ],
          lookahead: [
            {
              title: "Opening: descending the gradient",
              sub_focus: "following the slope downhill to minimize error",
              archetype: "concept-first",
              slots: ["core_concept", "mental_model"],
              trigger_assumption: "learner masters linear algebra and advances to gradient descent",
            },
          ],
          pacing: { strategy: "progressive", notes: "intuition → formal" },
        }),
        model: "fake-frameplanner-model",
        finishReason: "stop",
      };
    },
    async embed() {
      return [0, 0, 0, 0, 0, 0, 0, 0];
    },
  };
}

/**
 * A fake image agent (UCS, ADR-0030 Phase 4): decides an image helps and returns a prompt + an
 * explanatory caption + callout labels — distinct from the composer's inline plan so a test can
 * prove the dedicated agent's decision drives the folded image element. Deterministic per call.
 */
function fakeImagePlannerModel(): ModelRuntime {
  return {
    async generate() {
      return {
        text: JSON.stringify({
          helps: true,
          prompt: "arrows on a plane being stretched and rotated by a matrix grid",
          rationale: "the spatial reshaping is the whole point and is hard to say in words",
          caption: "A matrix reshapes every vector in the space at once",
          labels: ["input vector", "transformed grid", "output vector"],
        }),
        model: "fake-imageplanner-model",
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
  options: {
    governance?: boolean;
    trustLevel?: number;
    explanationModel?: ModelRuntime;
    composerModel?: ModelRuntime;
    framePlannerModel?: ModelRuntime;
    imagePlannerModel?: ModelRuntime;
    media?: MediaGenerator;
    motivationDispatcher?: GovernedDispatcher;
    /** Grounded-frontier provider (CSE M9 LKS T1, ADR-0045). */
    frontierProvider?: SurfaceFrontierProvider;
    /** Look-ahead budget (UCS, ADR-0030; Phase 3). Absent/0 ⇒ no speculation (the default). */
    lookaheadBudget?: number;
    /** Live board streaming (ADR-0063 Phase B). Absent/false ⇒ whole-frame (the deterministic default). */
    frameStreamEnabled?: boolean;
    /** Surface practice + checkpoint as frames (default OFF = teaching-only surface). */
    surfacePracticeFrames?: boolean;
  } = {},
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

  const composerManifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.composer")!;
  const composerDispatcher = options.composerModel
    ? new ProductRuntimeDispatcher({
        bus,
        clock,
        idGenerator,
        nodeId: "surface-composer",
        agent: {
          identity: agentIdentity("composer", "cog-comp-surface"),
          unit: new SurfaceComposerUnit({
            manifest: composerManifest,
            model: options.composerModel,
            idGenerator,
          }),
        },
        governance,
      })
    : undefined;

  const framePlannerManifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.frameplanner")!;
  const framePlannerDispatcher = options.framePlannerModel
    ? new ProductRuntimeDispatcher({
        bus,
        clock,
        idGenerator,
        nodeId: "surface-frameplanner",
        agent: {
          identity: agentIdentity("frameplanner", "cog-plan-surface"),
          unit: new FramePlannerUnit({
            manifest: framePlannerManifest,
            model: options.framePlannerModel,
            idGenerator,
          }),
        },
        governance,
      })
    : undefined;

  const imagePlannerManifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.imageplanner")!;
  const imagePlannerDispatcher = options.imagePlannerModel
    ? new ProductRuntimeDispatcher({
        bus,
        clock,
        idGenerator,
        nodeId: "surface-imageplanner",
        agent: {
          identity: agentIdentity("imageplanner", "cog-img-surface"),
          unit: new ImagePlannerUnit({
            manifest: imagePlannerManifest,
            model: options.imagePlannerModel,
            idGenerator,
          }),
        },
        governance,
      })
    : undefined;

  const surface = new SurfaceSession({
    session,
    world,
    bus,
    loop,
    supervisorCid: "cog-sup-surface",
    clock,
    idGenerator,
    nodeId: "surface-session",
    ...(options.media ? { media: options.media } : {}),
    ...(options.motivationDispatcher ? { motivationDispatcher: options.motivationDispatcher } : {}),
    ...(options.frontierProvider ? { frontierProvider: options.frontierProvider } : {}),
    ...(composerDispatcher ? { composerDispatcher } : {}),
    ...(framePlannerDispatcher ? { framePlannerDispatcher } : {}),
    ...(imagePlannerDispatcher ? { imagePlannerDispatcher } : {}),
    ...(options.lookaheadBudget !== undefined ? { lookaheadBudget: options.lookaheadBudget } : {}),
    ...(options.frameStreamEnabled ? { frameStreamEnabled: true } : {}),
    ...(options.surfacePracticeFrames ? { surfacePracticeFrames: true } : {}),
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
      depthTests: [
        { kind: "explanation", passed: true, confidence: 0.9, evidence: "articulated correctly" },
        { kind: "application", passed: true, confidence: 0.88, evidence: "solved problem" },
        { kind: "connection", passed: true, confidence: 0.85, evidence: "linked to prerequisites" },
        { kind: "teaching", passed: true, confidence: 0.82, evidence: "rephrased for novice" },
        { kind: "edge_case", passed: true, confidence: 0.8, evidence: "handled edge case" },
      ],
    },
  };
}

/** The same lesson refocused on a later concept in the path (UCS Phase 3 promote/invalidate tests). */
function askForConcept(focusConceptId: string): SurfaceAskInput {
  const base = teachMeNeuralNetworks();
  return {
    ...base,
    focusConceptId,
    explanationPrompt: `Explain ${focusConceptId}`,
    practicePrompt: `Practice ${focusConceptId}`,
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

    // 4. Cognition blocks appeared, typed and ordered — incl. the projected concept map (S2.1a)
    expect(asked.value.blocks.map((b) => b.block_type)).toEqual([
      "routing",
      "concept",
      "explanation",
      "practice",
      "assessment",
    ]);

    // S2.2 — depth gate recorded in state
    expect(asked.value.state.depth_gates).toHaveLength(1);
    const gate = asked.value.state.depth_gates[0]!;
    expect(gate.concept_id).toBe("linear-algebra");
    expect(gate.passed).toBe(true);
    expect(gate.passed_count).toBe(5);
    expect(gate.total_count).toBe(5);
    expect(gate.tests).toHaveLength(5);
    expect(gate.tests.map((t) => t.kind)).toEqual([
      "explanation",
      "application",
      "connection",
      "teaching",
      "edge_case",
    ]);
    // Assessment block carries the depth_gate payload
    const assessmentBlock = asked.value.blocks.find((b) => b.block_type === "assessment");
    expect(assessmentBlock?.content["depth_gate"]).toBeTruthy();
    // The concept map is a structured visual projected from the learning graph
    const conceptMap = asked.value.blocks.find((b) => b.block_type === "concept");
    const map = conceptMap?.content["map"] as
      | { focus?: string; nodes?: unknown[]; edges?: unknown[] }
      | undefined;
    expect(map?.focus).toBe("linear-algebra");
    expect((map?.nodes ?? []).length).toBeGreaterThan(0);

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

  test("learner interactions are governed, recorded, and folded (S1.3)", async () => {
    const { surface } = makeFixture("surface-interact");
    await surface.start("Teach me Neural Networks");
    await surface.ask(teachMeNeuralNetworks());

    const jump = await surface.interact({ kind: "jump", target_id: "perceptron" });
    expect(jump.ok).toBe(true);
    if (!jump.ok) throw jump.error;
    expect(jump.value.effect).toBe("refocused");

    const interrupt = await surface.interact({ kind: "interrupt" });
    expect(interrupt.ok).toBe(true);
    if (!interrupt.ok) throw interrupt.error;
    expect(interrupt.value.effect).toBe("cancelled");

    const state = surface.state();
    expect(state?.interactions).toHaveLength(2);
    const byId = new Map((state?.interactions ?? []).map((i) => [i.interaction_id, i]));
    expect(byId.get(jump.value.interaction_id)?.kind).toBe("jump");
    expect(byId.get(jump.value.interaction_id)?.effect).toBe("refocused");
    expect(byId.get(interrupt.value.interaction_id)?.effect).toBe("cancelled");
    // jump moved the surface's focus to the requested concept
    expect(state?.focus?.target_id).toBe("perceptron");
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

  test("UCS frame path: the board holds the MCCR; the voice carries a SEPARATE narration (ADR-0030)", async () => {
    const { surface, bus } = makeFixture("surface-frame", {
      composerModel: fakeComposerModel(),
      media: {
        async generate(request) {
          return {
            artifact_id: `art-${request.request_id}`,
            modality: request.modality,
            content_ref: `/api/surface/${request.surface_id}/media/art-${request.request_id}`,
            mime_type: "image/svg+xml",
            provider_id: "test-null",
            deterministic: true,
          };
        },
      },
    });
    await surface.start("Teach me Neural Networks");
    const asked = await surface.ask(teachMeNeuralNetworks());
    expect(asked.ok).toBe(true);
    if (!asked.ok) throw asked.error;
    const state = asked.value.state;

    // A Cognitive Frame was composed — the board holds the distilled MCCR, not prose.
    expect(state.frames).toHaveLength(1);
    const frame = state.frames[0]!;
    expect(frame.status).toBe("composed");
    expect(frame.concept_id).toBe("linear-algebra");
    expect(frame.mccr?.core_concept?.content).toEqual({ kind: "text", text: "Linear algebra" });
    expect(frame.mccr?.key_formula?.content).toMatchObject({ kind: "formula" });
    // image-as-cognition: the generated illustration is folded into the MCCR (not a detached block)
    expect(frame.mccr?.image?.content).toMatchObject({ kind: "image" });

    // The frame REPLACES the prose explanation block — no document on the board.
    expect(asked.value.blocks.map((b) => b.block_type)).not.toContain("explanation");

    // The narration is a SEPARATE script, recorded and voiced.
    expect(state.narration_scripts).toHaveLength(1);
    expect(state.narration_scripts[0]?.segments).toHaveLength(3);
    expect(state.narration.length).toBe(3);
    // The spoken text differs from the board text (no duplication) and targets MCCR elements.
    const spoken = state.narration.map((s) => s.text).join(" ");
    expect(spoken).toContain("arrow");
    expect(spoken).not.toContain("the study of vectors"); // board's definition is not re-spoken verbatim
    expect(state.narration[0]?.frame_id).toBe(frame.frame_id);
    expect(state.narration[0]?.focus?.target_type).toBe("element");
    expect(state.frames[0]?.segment_ids).toHaveLength(3);

    // The image decision is recorded and observable; the composer's reasoning reaches the Observatory.
    expect(state.image_decisions).toHaveLength(1);
    expect(state.image_decisions[0]?.helps).toBe(true);
    expect(state.agent_reasoning.some((r) => r.agent_id === "composer")).toBe(true);

    // Ordering: frame.composed precedes its script + narration segments (SRF-002 laws 8/10).
    const types = bus.replay({ subject: "surface.>" }).map((e) => e.event_type);
    expect(types.indexOf("surface.frame.composed")).toBeLessThan(
      types.indexOf("surface.narration.script.produced"),
    );
    expect(types.indexOf("surface.frame.composed")).toBeLessThan(
      types.indexOf("surface.narration.segment"),
    );
  });

  test("UCS Phase 4: the Image Agent owns the image-as-cognition decision (caption + labels)", async () => {
    const { surface } = makeFixture("surface-image-agent", {
      composerModel: fakeComposerModel(),
      imagePlannerModel: fakeImagePlannerModel(),
      media: {
        async generate(request) {
          return {
            artifact_id: `art-${request.request_id}`,
            modality: request.modality,
            content_ref: `/api/surface/${request.surface_id}/media/art-${request.request_id}`,
            mime_type: "image/svg+xml",
            provider_id: "test-null",
            deterministic: true,
          };
        },
      },
    });
    await surface.start("Teach me Neural Networks");
    const asked = await surface.ask(teachMeNeuralNetworks());
    expect(asked.ok).toBe(true);
    if (!asked.ok) throw asked.error;
    const state = asked.value.state;

    // The image element carries the Image Agent's caption + callout labels (image-as-cognition),
    // NOT the composer's inline decision.
    const image = state.frames[0]?.mccr?.image?.content;
    expect(image?.kind).toBe("image");
    if (image?.kind !== "image") throw new Error("expected image content");
    expect(image.caption).toBe("A matrix reshapes every vector in the space at once");
    expect(image.labels).toEqual(["input vector", "transformed grid", "output vector"]);
    expect(image.prompt).toContain("matrix grid");

    // The image agent's reasoning reaches the Observatory (ADR-0029), distinct from the composer's.
    expect(state.agent_reasoning.some((r) => r.agent_id === "imageplanner")).toBe(true);
    expect(state.agent_reasoning.some((r) => r.agent_id === "composer")).toBe(true);
    // The decision is recorded as helping.
    expect(state.image_decisions[0]?.helps).toBe(true);
  });

  test("UCS Phase 4 image-agent path replays deterministically (deep-equal folded state)", async () => {
    const run = async () => {
      const { surface, bus } = makeFixture("surface-image-agent-replay", {
        composerModel: fakeComposerModel(),
        imagePlannerModel: fakeImagePlannerModel(),
        media: {
          async generate(request) {
            return {
              artifact_id: `art-${request.request_id}`,
              modality: request.modality,
              content_ref: `/api/surface/${request.surface_id}/media/art-${request.request_id}`,
              mime_type: "image/svg+xml",
              provider_id: "test-null",
              deterministic: true,
            };
          },
        },
      });
      await surface.start("Teach me Neural Networks");
      const asked = await surface.ask(teachMeNeuralNetworks());
      expect(asked.ok).toBe(true);
      await surface.close();
      return { state: surface.state(), events: bus.replay({ subject: "surface.>" }) };
    };
    const [a, b] = await Promise.all([run(), run()]);
    expect(a.state).toEqual(b.state);
    const refolded = foldSurfaceEvents(a.events, a.state?.surface_id);
    expect(refolded).toEqual(a.state);
  });

  test("UCS frame path replays deterministically (deep-equal folded state)", async () => {
    const run = async () => {
      const { surface, bus } = makeFixture("surface-frame-replay", {
        composerModel: fakeComposerModel(),
      });
      await surface.start("Teach me Neural Networks");
      const asked = await surface.ask(teachMeNeuralNetworks());
      expect(asked.ok).toBe(true);
      await surface.close();
      return { state: surface.state(), events: bus.replay({ subject: "surface.>" }) };
    };
    const [a, b] = await Promise.all([run(), run()]);
    expect(a.state).toEqual(b.state);
    const refolded = foldSurfaceEvents(a.events, a.state?.surface_id);
    expect(refolded).toEqual(a.state);
  });

  test("UCS Phase 2: the planner decomposes the concept into a progressive frame sequence (ADR-0030)", async () => {
    const { surface, bus } = makeFixture("surface-multiframe", {
      composerModel: fakeComposerModel(),
      framePlannerModel: fakeFramePlannerModel(),
      surfacePracticeFrames: true, // this test exercises the practice + checkpoint frame path
    });
    await surface.start("Teach me Neural Networks");
    const asked = await surface.ask(teachMeNeuralNetworks());
    expect(asked.ok).toBe(true);
    if (!asked.ok) throw asked.error;
    const state = asked.value.state;

    // The lesson is a SEQUENCE of frames: 2 teaching frames (planner) + practice + assessment.
    expect(state.frames).toHaveLength(4);
    expect(state.frames.every((f) => f.status === "composed")).toBe(true);
    // Ordinals are sparse + monotone (promotion-friendly; SRF-002 law 8).
    expect(state.frames.map((f) => f.ordinal)).toEqual([1000, 2000, 3000, 4000]);
    const titles = state.frames.map((f) => f.title);
    expect(titles[0]).toBe("Intuition: arrows in space");
    expect(titles[1]).toBe("The map, precisely");
    expect(titles).toContain("Practice — Linear Algebra");
    expect(titles).toContain("Checkpoint — Linear Algebra");

    // Practice became its own anchored frame carrying the practice prompt as a key_example.
    const practiceFrame = state.frames.find((f) => f.title === "Practice — Linear Algebra");
    expect(practiceFrame?.mccr?.key_example?.content).toEqual({
      kind: "text",
      text: "Give me one matrix-vector practice problem",
    });

    // Each teaching frame reserved its layout first (planned → composed); 4 planned events in all.
    const types = bus.replay({ subject: "surface.>" }).map((e) => e.event_type);
    expect(types.filter((t) => t === "surface.frame.planned")).toHaveLength(4);
    expect(types.filter((t) => t === "surface.frame.composed")).toHaveLength(4);
    // Law 8: a frame's planned + composed precede its narration segments.
    expect(types.indexOf("surface.frame.planned")).toBeLessThan(
      types.indexOf("surface.frame.composed"),
    );
    expect(types.indexOf("surface.frame.composed")).toBeLessThan(
      types.indexOf("surface.narration.segment"),
    );

    // Narration spans every frame: distinct frame_ids in order, each frame voiced.
    const narratedFrameIds = new Set(state.narration.map((s) => s.frame_id));
    expect(narratedFrameIds.size).toBe(4);
    expect(state.frames.every((f) => f.segment_ids.length > 0)).toBe(true);

    // The planner's decomposition reasoning reaches the Observatory (ADR-0029).
    expect(state.agent_reasoning.some((r) => r.agent_id === "frameplanner")).toBe(true);
    // The board still never holds a prose explanation block.
    expect(asked.value.blocks.some((b) => b.block_type === "explanation")).toBe(false);
  });

  test("UCS Phase 2 planner path replays deterministically (deep-equal folded state)", async () => {
    const run = async () => {
      const { surface, bus } = makeFixture("surface-multiframe-replay", {
        composerModel: fakeComposerModel(),
        framePlannerModel: fakeFramePlannerModel(),
      });
      await surface.start("Teach me Neural Networks");
      const asked = await surface.ask(teachMeNeuralNetworks());
      expect(asked.ok).toBe(true);
      await surface.close();
      return { state: surface.state(), events: bus.replay({ subject: "surface.>" }) };
    };
    const [a, b] = await Promise.all([run(), run()]);
    expect(a.state).toEqual(b.state);
    const refolded = foldSurfaceEvents(a.events, a.state?.surface_id);
    expect(refolded).toEqual(a.state);
  });

  test("UCS Phase 3: mastery pre-composes the next frame as discardable speculation, then a matching ask promotes it", async () => {
    const { surface, bus } = makeFixture("surface-lookahead-promote", {
      composerModel: fakeComposerModel(),
      framePlannerModel: fakeFramePlannerModel(),
      lookaheadBudget: 1,
    });
    await surface.start("Teach me Neural Networks");

    // Ask 1: teach linear-algebra. After clean mastery the NEXT concept (gradient-descent) is
    // pre-composed as a speculative frame — recorded but NEVER surfaced. Speculation runs OFF the
    // ask's critical path (review §22), so quiescence requires settle() before asserting.
    const first = await surface.ask(teachMeNeuralNetworks());
    expect(first.ok).toBe(true);
    if (!first.ok) throw first.error;
    await surface.settle();
    const afterFirst = surface.state()!;

    const spec = afterFirst.speculative_frames;
    expect(spec).toHaveLength(1);
    expect(spec[0]?.status).toBe("speculative");
    expect(spec[0]?.concept_id).toBe("gradient-descent");
    expect(spec[0]?.trigger_assumption).toContain("gradient descent");
    expect(spec[0]?.mccr).not.toBeNull(); // full MCCR pre-composed ⇒ promotion skips recompute
    const specFrameId = spec[0]!.frame_id;
    // Provably absent from the on-screen frame line, and not voiced (never surfaced).
    expect(afterFirst.frames.some((f) => f.concept_id === "gradient-descent")).toBe(false);
    expect(afterFirst.narration.some((s) => s.frame_id === specFrameId)).toBe(false);
    // But its script + image decision WERE recorded (Observatory / N+1 buffer).
    expect(afterFirst.narration_scripts.some((s) => s.frame_id === specFrameId)).toBe(true);
    expect(afterFirst.image_decisions.some((d) => d.frame_id === specFrameId)).toBe(true);

    // Ask 2: the learner advances to gradient-descent — the bet held.
    const second = await surface.ask(askForConcept("gradient-descent"));
    expect(second.ok).toBe(true);
    if (!second.ok) throw second.error;
    await surface.settle();
    const afterSecond = surface.state()!;

    // The speculative entry is now promoted, and a promoted frame stands on the canonical line.
    expect(afterSecond.speculative_frames.find((f) => f.frame_id === specFrameId)?.status).toBe(
      "promoted",
    );
    const promoted = afterSecond.frames.find((f) => f.frame_id === specFrameId);
    expect(promoted?.status).toBe("promoted");
    expect(promoted?.concept_id).toBe("gradient-descent");
    expect(promoted?.mccr).not.toBeNull();
    // The promoted frame is voiced now (surfaced) — its recorded script drives narration.
    expect(afterSecond.narration.some((s) => s.frame_id === specFrameId)).toBe(true);

    const types = bus.replay({ subject: "surface.>" }).map((e) => e.event_type);
    // Two prepares (ask1 → gradient-descent, ask2 → perceptron); exactly one promotion.
    expect(types.filter((t) => t === "surface.frame.speculation.prepared")).toHaveLength(2);
    expect(types.filter((t) => t === "surface.frame.promoted")).toHaveLength(1);
  });

  test("UCS Phase 3: a speculative frame is invalidated when the learner diverges, never surfacing", async () => {
    const { surface, bus } = makeFixture("surface-lookahead-invalidate", {
      composerModel: fakeComposerModel(),
      framePlannerModel: fakeFramePlannerModel(),
      lookaheadBudget: 1,
    });
    await surface.start("Teach me Neural Networks");

    const first = await surface.ask(teachMeNeuralNetworks()); // focus linear-algebra ⇒ speculate gradient-descent
    expect(first.ok).toBe(true);
    if (!first.ok) throw first.error;
    await surface.settle(); // speculation is detached from the ask's critical path
    const specFrameId = surface.state()!.speculative_frames[0]!.frame_id;
    expect(surface.state()!.speculative_frames[0]?.concept_id).toBe("gradient-descent");

    // Ask 2: the learner jumps to perceptron instead — the bet failed.
    const second = await surface.ask(askForConcept("perceptron"));
    expect(second.ok).toBe(true);
    if (!second.ok) throw second.error;
    await surface.settle();
    const afterSecond = surface.state()!;

    // The gradient-descent speculation is invalidated and NEVER copied into the frame line.
    const invalidated = afterSecond.speculative_frames.find((f) => f.frame_id === specFrameId);
    expect(invalidated?.status).toBe("invalidated");
    expect(invalidated?.invalidation_reason).toContain("perceptron");
    expect(afterSecond.frames.some((f) => f.frame_id === specFrameId)).toBe(false);
    expect(afterSecond.frames.some((f) => f.concept_id === "gradient-descent")).toBe(false);

    const types = bus.replay({ subject: "surface.>" }).map((e) => e.event_type);
    expect(types).toContain("surface.frame.speculation.invalidated");
    expect(types.filter((t) => t === "surface.frame.promoted")).toHaveLength(0);
  });

  test("UCS Phase 3: budget 0 emits no speculation (deterministic default)", async () => {
    const { surface, bus } = makeFixture("surface-lookahead-off", {
      composerModel: fakeComposerModel(),
      framePlannerModel: fakeFramePlannerModel(),
      // no lookaheadBudget ⇒ 0
    });
    await surface.start("Teach me Neural Networks");
    const asked = await surface.ask(teachMeNeuralNetworks());
    expect(asked.ok).toBe(true);
    if (!asked.ok) throw asked.error;
    expect(asked.value.state.speculative_frames).toEqual([]);
    const types = bus.replay({ subject: "surface.>" }).map((e) => e.event_type);
    expect(types.some((t) => t.startsWith("surface.frame.speculation"))).toBe(false);
  });

  test("UCS Phase 3 speculation lifecycle replays deterministically (deep-equal folded state)", async () => {
    const run = async () => {
      const { surface, bus } = makeFixture("surface-lookahead-replay", {
        composerModel: fakeComposerModel(),
        framePlannerModel: fakeFramePlannerModel(),
        lookaheadBudget: 1,
      });
      await surface.start("Teach me Neural Networks");
      await surface.ask(teachMeNeuralNetworks());
      await surface.ask(askForConcept("gradient-descent"));
      await surface.close();
      return { state: surface.state(), events: bus.replay({ subject: "surface.>" }) };
    };
    const [a, b] = await Promise.all([run(), run()]);
    expect(a.state).toEqual(b.state);
    const refolded = foldSurfaceEvents(a.events, a.state?.surface_id);
    expect(refolded).toEqual(a.state);
  });

  test("ADR-0063 Phase F: a learner interrupt cancels in-flight background speculation (no frame emitted, settle returns)", async () => {
    // The look-ahead composition for the NEXT concept (Gradient Descent) is held open on a gate, so it
    // is provably still in flight — detached from ask 1's critical path — when the learner interrupts.
    const gated = gatedComposerModel("Gradient Descent");
    const { surface, bus } = makeFixture("surface-lookahead-cancel", {
      composerModel: gated.model,
      framePlannerModel: fakeFramePlannerModel(),
      lookaheadBudget: 1,
    });
    await surface.start("Teach me Neural Networks");

    const first = await surface.ask(teachMeNeuralNetworks());
    expect(first.ok).toBe(true);
    if (!first.ok) throw first.error;
    // Speculation is blocked on the gate (not yet emitted) — nothing speculative on the board.
    expect(surface.state()!.speculative_frames).toEqual([]);

    // The learner stops. The interrupt must abort the stale look-ahead — the gateway should not keep
    // composing a frame the learner will never see.
    const interrupted = await surface.interact({ kind: "interrupt" });
    expect(interrupted.ok).toBe(true);

    // Release the (now-cancelled) composer dispatch. settle() must return, and the speculation must
    // leave NO trace: its model call ran, but no image, no speculation.prepared, no records.
    gated.release();
    await surface.settle();

    const state = surface.state()!;
    expect(state.speculative_frames).toEqual([]);
    const types = bus.replay({ subject: "surface.>" }).map((e) => e.event_type);
    expect(types.some((t) => t.startsWith("surface.frame.speculation"))).toBe(false);
    expect(types).toContain("surface.interaction.applied"); // the interrupt itself is recorded
    // Replay equivalence still holds over the cancelled prefix (fold ≡ live state).
    const refolded = foldSurfaceEvents(bus.replay({ subject: "surface.>" }), state.surface_id);
    expect(refolded).toEqual(state);
  });

  test("ADR-0063 Phase B: the board streams as surface.frame.element.delta, and settled state is delta-independent", async () => {
    const { surface, bus } = makeFixture("surface-frame-stream", {
      composerModel: streamingComposerModel(),
      framePlannerModel: fakeFramePlannerModel(),
      frameStreamEnabled: true,
    });
    await surface.start("Teach me Neural Networks");
    const asked = await surface.ask(teachMeNeuralNetworks());
    expect(asked.ok).toBe(true);
    if (!asked.ok) throw asked.error;
    await surface.settle();

    const events = bus.replay({ subject: "surface.>" });
    const deltas = events.filter((e) => e.event_type === "surface.frame.element.delta");
    // The board streamed: MCCR string anchors surfaced as deltas (el-<anchor> ids).
    expect(deltas.length).toBeGreaterThan(0);
    const ids = new Set(deltas.map((e) => (e.payload as Record<string, unknown>)["element_id"]));
    expect(ids.has("el-core_concept")).toBe(true);
    // Each frame's deltas precede its own surface.frame.composed (buffer-clear invariant).
    for (const delta of deltas) {
      const frameId = (delta.payload as Record<string, unknown>)["frame_id"];
      const deltaIdx = events.indexOf(delta);
      const composedIdx = events.findIndex(
        (e) =>
          e.event_type === "surface.frame.composed" &&
          (e.payload as Record<string, unknown>)["frame_id"] === frameId,
      );
      expect(composedIdx).toBeGreaterThan(deltaIdx);
    }

    const state = surface.state()!;
    // Settled state is delta-independent: the transient buffer is cleared by surface.frame.composed.
    expect(state.streaming_frame_elements).toEqual([]);
    // Replay equivalence holds over the streamed log (client fold ≡ server state).
    const refolded = foldSurfaceEvents(events, state.surface_id);
    expect(refolded).toEqual(state);
  });

  test("ADR-0063 Phase B: streamed and whole-frame runs settle to identical board content", async () => {
    const boardOf = async (frameStreamEnabled: boolean) => {
      const { surface } = makeFixture("surface-frame-stream-eq", {
        composerModel: streamingComposerModel(),
        framePlannerModel: fakeFramePlannerModel(),
        frameStreamEnabled,
      });
      await surface.start("Teach me Neural Networks");
      await surface.ask(teachMeNeuralNetworks());
      await surface.settle();
      // Compare the canonical board CONTENT: concept, title, and the distilled MCCR anchors. The
      // mccr's `frame_id` is id-derived and legitimately differs (streaming consumes extra event ids
      // for the deltas); every anchor's content/element_id/order must be byte-identical.
      return surface.state()!.frames.map((f) => {
        const { frame_id: _drop, ...mccrContent } = (f.mccr ?? {}) as unknown as Record<
          string,
          unknown
        >;
        return { concept_id: f.concept_id, title: f.title, mccr: mccrContent };
      });
    };
    expect(await boardOf(true)).toEqual(await boardOf(false));
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

  test("prerequisite-descent triggers on depth-gate failure and surfaces the prereq (S2.3)", async () => {
    // 1/5 depth tests pass → gate fails (threshold 4) → descent to "linear-algebra"
    const FAILING_DEPTH_TESTS: DepthTestResult[] = [
      { kind: "explanation", passed: false, confidence: 0.3, evidence: "unclear explanation" },
      { kind: "application", passed: false, confidence: 0.2, evidence: "failed to apply" },
      { kind: "connection", passed: false, confidence: 0.3, evidence: "no connections made" },
      { kind: "teaching", passed: true, confidence: 0.7, evidence: "rephrased basics" },
      { kind: "edge_case", passed: false, confidence: 0.2, evidence: "missed edge cases" },
    ];

    const { surface, bus } = makeFixture("surface-descent");
    await surface.start("Teach me Neural Networks");

    // "perceptron" has "linear-algebra" as a direct prerequisite.
    const asked = await surface.ask({
      goal: "Teach me Neural Networks",
      pathId: "path-neural-networks",
      concepts: [
        { id: "linear-algebra", title: "Linear Algebra" },
        { id: "perceptron", title: "The Perceptron", prerequisites: ["linear-algebra"] },
      ],
      focusConceptId: "perceptron",
      explanationPrompt: "Explain the perceptron",
      practicePrompt: "Practice the perceptron",
      mastery: {
        assessorCid: "cog-sup-surface",
        passed: false,
        confidence: 0.3,
        evidence: [],
        depthTests: FAILING_DEPTH_TESTS,
      },
    });
    expect(asked.ok).toBe(true);
    if (!asked.ok) throw asked.error;

    // S2.3: one descent recorded in folded state
    const state = asked.value.state;
    expect(state.prerequisite_descents).toHaveLength(1);
    const descent = state.prerequisite_descents[0]!;
    expect(descent.from_concept_id).toBe("perceptron");
    expect(descent.to_concept_id).toBe("linear-algebra");
    expect(descent.trigger).toBe("depth_gate_failed");
    expect(descent.completed).toBe(true);

    // Descent blocks are visible on the surface (routing banner + prereq explanation)
    const prereqBlocks = asked.value.blocks.filter((b) => b.concept_ids.includes("linear-algebra"));
    expect(prereqBlocks.length).toBeGreaterThan(0);
    const prereqBlockTypes = prereqBlocks.map((b) => b.block_type);
    expect(prereqBlockTypes).toContain("routing");
    expect(prereqBlockTypes).toContain("explanation");

    // D3: descent.started precedes descent.completed in the event log
    const events = bus.replay({ subject: "surface.>" }).map((e) => e.event_type);
    expect(events).toContain("surface.prerequisite.descent.started");
    expect(events).toContain("surface.prerequisite.descent.completed");
    const startIdx = events.indexOf("surface.prerequisite.descent.started");
    const completeIdx = events.indexOf("surface.prerequisite.descent.completed");
    expect(startIdx).toBeLessThan(completeIdx);

    // Timeline re-projected after descent: the prerequisite concept is now mastered
    const laNode = asked.value.timeline.nodes.find((n) => n.concept_id === "linear-algebra");
    expect(laNode?.status).toBe("mastered");
  });

  test("inline image block appears after explanation when a MediaGenerator is wired (S2.1b)", async () => {
    // Deterministic fake: no external dependency; bytes-out-of-band contract held (content_ref only)
    const fakeMedia: MediaGenerator = {
      async generate(request) {
        return {
          artifact_id: `art-image-${request.request_id}`,
          modality: request.modality,
          content_ref: `/api/surface/${request.surface_id}/media/art-image-${request.request_id}`,
          mime_type: "image/svg+xml",
          provider_id: "test-null",
          deterministic: true,
        };
      },
    };
    const { surface, bus } = makeFixture("surface-media-gen", { media: fakeMedia });
    await surface.start("Teach me Neural Networks");
    const asked = await surface.ask(teachMeNeuralNetworks());
    expect(asked.ok).toBe(true);
    if (!asked.ok) throw asked.error;

    // The image block must appear immediately after the explanation block
    const blockTypes = asked.value.blocks.map((b) => b.block_type);
    expect(blockTypes).toContain("image");
    const imageIdx = blockTypes.indexOf("image");
    const explanationIdx = blockTypes.indexOf("explanation");
    expect(imageIdx).toBe(explanationIdx + 1);

    // The block carries the artifact reference (bytes never in events — SRF-006 D3)
    const imageBlock = asked.value.blocks[imageIdx];
    const artifact = imageBlock?.content["artifact"] as Record<string, unknown> | undefined;
    expect(artifact?.content_ref).toMatch(/^\/api\/surface\//);
    expect(artifact?.mime_type).toBe("image/svg+xml");
    expect(artifact?.deterministic).toBe(true);

    // The surface.visual.generated event was emitted (D3 record-before-use: recorded before the block)
    const events = bus.replay({ subject: "surface.>" }).map((e) => e.event_type);
    expect(events).toContain("surface.visual.generated");
    expect(events.filter((t) => t === "surface.visual.generated")).toHaveLength(1);
  });

  test("S3.3 motivation surfaced when barely-passed mastery (0.6 ≤ conf < 0.75)", async () => {
    // Stub motivation dispatcher: returns a packet with content.message
    const fakeMotivationDispatcher: GovernedDispatcher = {
      async dispatch() {
        return ok({
          workItem: {
            work_id: "wk-mot-001",
            work_type: "student_interaction",
            session_id: "intent-surface-001",
            tenant_id: null,
            risk_class: "low",
          } as unknown as CognitiveWorkItem,
          packet: {} as unknown as CognitionPacket,
          emissions: { packets: [] },
          responsePackets: [
            {
              packet_id: "cp-mot-001",
              schema_version: "1.0.0",
              source_cid: "agent.motivation",
              target_cid: "cog-surface-learner",
              tenant_id: null,
              session_id: "intent-surface-001",
              causation_id: "cp-mot-000",
              correlation_id: "cp-mot-001",
              timestamp: "2026-06-11T00:00:00.000Z",
              hlc: "00000000000000000000:0:test",
              sequence_number: 1,
              packet_type: "response",
              intent: "motivation",
              concept_ids: ["linear-algebra"],
              domain_ids: [],
              content: {
                message: "You passed! Confidence will grow with practice — keep going.",
                response_kind: "motivational-message",
              },
              evidence: [],
              confidence: 0.8,
              uncertainty_estimate: 0.2,
              reasoning_depth: 1,
              classification: "internal",
              policy_tags: [],
              requires_human_review: false,
              priority: 5,
              expiry: null,
              trace_id: "00000000000000000000000000000001",
              span_id: "0000000000000001",
            },
          ],
        });
      },
    };

    const { surface, bus } = makeFixture("surface-motivation", {
      motivationDispatcher: fakeMotivationDispatcher,
    });
    await surface.start("Teach me Neural Networks");

    // Barely-passed mastery: confidence 0.65 — above 0.6 floor, below 0.75 research threshold.
    const asked = await surface.ask({
      goal: "Teach me Neural Networks",
      pathId: "path-neural-networks",
      concepts: [{ id: "linear-algebra", title: "Linear Algebra" }],
      focusConceptId: "linear-algebra",
      explanationPrompt: "Explain linear algebra",
      practicePrompt: "Practice linear algebra",
      mastery: {
        assessorCid: "cog-sup-surface",
        passed: true,
        confidence: 0.65,
        evidence: [{ kind: "practice", result: "partial" }],
        depthTests: [],
      },
    });
    expect(asked.ok).toBe(true);
    if (!asked.ok) throw asked.error;

    // D3: surface.motivation.surfaced emitted (before the motivation block)
    const events = bus.replay({ subject: "surface.>" }).map((e) => e.event_type);
    expect(events).toContain("surface.motivation.surfaced");

    // Fold: motivation_surfaced flag is set
    expect(asked.value.state.motivation_surfaced).toBe(true);

    // Motivation block contributed by the dispatcher
    const motBlock = asked.value.blocks.find((b) => b.block_type === "motivation");
    expect(motBlock).toBeDefined();
    expect(motBlock?.content["message"]).toContain("keep going");
  });

  test("S3.3 motivation NOT surfaced above research-readiness threshold", async () => {
    const { surface, bus } = makeFixture("surface-no-motivation");
    await surface.start("Teach me Neural Networks");

    // Confidence 0.9 — above 0.75 threshold; research frontier path, not motivation.
    await surface.ask(teachMeNeuralNetworks());

    const events = bus.replay({ subject: "surface.>" }).map((e) => e.event_type);
    expect(events).not.toContain("surface.motivation.surfaced");
    expect(surface.state()?.motivation_surfaced).toBe(false);
  });

  test("LKS T1: verified mastery surfaces the GROUNDED frontier (ADR-0045), cited, not the breadcrumb", async () => {
    const grounded: SurfaceFrontierProvider = {
      async researchFrontier(conceptId) {
        return {
          concept_ref: conceptId,
          degraded: false,
          entries: [
            {
              kind: "latest-research",
              summary: "Adaptive step-size methods are an active direction.",
              external_refs: [{ uri: "https://arxiv.org/abs/2401.1", title: "A 2024 Survey" }],
            },
          ],
        };
      },
    };
    const { surface, bus } = makeFixture("surface-grounded-frontier", {
      frontierProvider: grounded,
    });
    await surface.start("Teach me Neural Networks");
    const asked = await surface.ask(teachMeNeuralNetworks());
    expect(asked.ok).toBe(true);
    if (!asked.ok) throw asked.error;

    // The frontier is surfaced (grounded), and only ONE surfaced event — no ungrounded breadcrumb.
    const surfaced = bus
      .replay({ subject: "surface.research.frontier.surfaced" })
      .map((e) => e.payload as Record<string, unknown>);
    expect(surfaced).toHaveLength(1);
    expect(surfaced[0]?.["grounded"]).toBe(true);

    // Folded: the record is grounded and carries the cited entries.
    const record = asked.value.state.research_frontiers.find((r) => r.surfaced);
    expect(record?.grounded).toBe(true);
    expect(record?.entries?.[0]?.external_refs[0]?.uri).toBe("https://arxiv.org/abs/2401.1");

    // A grounded research block was contributed (not the ungrounded frontier/gap/hypothesis shape).
    const block = asked.value.blocks.find((b) => b.block_type === "research");
    expect(block?.content["grounded"]).toBe(true);
    expect(block?.content["frontier"]).toBeUndefined();
  });

  test("LKS T1: no citable frontier ⇒ honest deferral (never the ungrounded breadcrumb)", async () => {
    const empty: SurfaceFrontierProvider = {
      async researchFrontier(conceptId) {
        return { concept_ref: conceptId, degraded: true, entries: [] };
      },
    };
    const { surface, bus } = makeFixture("surface-frontier-defer", { frontierProvider: empty });
    await surface.start("Teach me Neural Networks");
    const asked = await surface.ask(teachMeNeuralNetworks());
    expect(asked.ok).toBe(true);
    if (!asked.ok) throw asked.error;

    const events = bus.replay({ subject: "surface.>" }).map((e) => e.event_type);
    // Detected (readiness fired) + deferred (nothing citable) — never surfaced.
    expect(events).toContain("surface.research.frontier.detected");
    expect(events).toContain("surface.research.frontier.deferred");
    expect(events).not.toContain("surface.research.frontier.surfaced");
    expect(asked.value.blocks.find((b) => b.block_type === "research")).toBeUndefined();
  });
});
