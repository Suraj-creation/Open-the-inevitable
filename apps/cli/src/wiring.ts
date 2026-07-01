/**
 * Demo composition root — wires the full governed substrate into one Cognitive Surface
 * session: world-state graph, event bus, governance, supervisor routing, model-backed
 * explanation/practice units (with deterministic fallbacks), mastery recording, and the
 * surface runtime. Mirrors the Phase 2A acceptance fixture (packages/surface/tests/session.test.ts).
 *
 * Spec: spec/surface/cognitive-surface-runtime.md, spec/product/product-cognition-runtime.md §11.
 */
import { InMemoryToolRuntime, InMemoryVectorStore } from "@inevitable/adapters";
import {
  ContextAssembler,
  type RetrievableMemoryItem,
  type WorkingMemoryContext,
} from "@inevitable/context";
import type { ModelRuntime } from "@inevitable/contracts";
import { InMemoryEventBus, createEvent, type EventBus } from "@inevitable/events";
import { GovernanceEngine } from "@inevitable/governance";
import { CapabilityRegistry } from "@inevitable/kernel";
import { TieredMemoryStore, type MemoryLayer } from "@inevitable/memory";
import {
  CurriculumUnit,
  DeterministicMvpUnit,
  FiberedLearningLoop,
  FramePlannerUnit,
  ImagePlannerUnit,
  LearningPathProjector,
  MVP_AGENT_MANIFESTS,
  IntentInferenceUnit,
  MasteryCheckpointRecorder,
  ModelBackedUnit,
  PRODUCT_DISPATCH_POLICIES,
  ProductRuntimeDispatcher,
  ResearchUnit,
  SupervisorUnit,
  SurfaceComposerUnit,
  TwinRegistry,
  curriculumSlug,
  type ModelBackedRole,
  type OnboardingSession,
  type ProductMode,
  type TwinConsent,
  type TwinSnapshot,
  type TwinState,
} from "@inevitable/product-cognition";
import type {
  CognitiveEvent,
  CognitiveIdentity,
  IntentLease,
  MemoryMutation,
} from "@inevitable/protocols";
import {
  CosError,
  CryptoIdGenerator,
  ManualClock,
  SeededIdGenerator,
  err,
  hlcInit,
  newMutationId,
  ok,
  type Clock,
  type Hlc,
  type IdGenerator,
  type Result,
} from "@inevitable/shared";
import { CognitiveEvaluationEngine, EVALUATION_PASS_THRESHOLD } from "@inevitable/evaluation";
import { CognitiveAnalysisEngine, InMemoryMeter } from "@inevitable/observability";
import {
  EvolutionEngine,
  LiveEvolutionConfig,
  ProposalBlackboard,
  type EvaluationResult,
  type EvolutionProposal,
  type ProposalConfiguration,
  type ProposalKind,
  type SyntheticLearnerSeed,
} from "@inevitable/orchestration";
import { guard as governanceGuard } from "@inevitable/governance";
import {
  SurfaceSession,
  type MediaGenerator,
  type SurfaceAskInput,
  type VoiceSynthesizer,
} from "@inevitable/surface";
import type { DepthTestResult } from "@inevitable/product-cognition";
import {
  KnowledgeGraphEngine,
  WorldStateGraph,
  type ConceptLayer,
  type ConceptSpec,
  type KnowledgeEdgeType,
  type WorldStateSnapshot,
} from "@inevitable/world-state";

/** Durable state captured for a surface, used to rehydrate a live session on resume (DPS-002). */
export interface DemoRestore {
  readonly worldSnapshot: WorldStateSnapshot;
  readonly memoryMutations: readonly MemoryMutation[];
  readonly events: readonly CognitiveEvent[];
  readonly surfaceId: string;
}

/** A world node/edge carried across surfaces (id/type/props only; version/hlc are re-derived). */
export interface SeedWorldNode {
  readonly id: string;
  readonly type: string;
  readonly props: Record<string, unknown>;
}
export interface SeedWorldEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly type: string;
  readonly props: Record<string, unknown>;
}

/**
 * The learner-durable cognition that carries across a learner's surfaces (DPS-004): their mastery
 * subgraph plus durable-tier memory. A derived projection of per-surface artifacts — not a source of
 * truth. Applied (silently) into a NEW surface at create so a returning learner draws on prior mastery.
 */
export interface LearnerCognitionSeed {
  readonly worldNodes: readonly SeedWorldNode[];
  readonly worldEdges: readonly SeedWorldEdge[];
  readonly memoryMutations: readonly MemoryMutation[];
}

/**
 * Memory tiers that are the learner's durable knowledge (carried across surfaces) vs. session scratch
 * (`working`/`episodic`) which is not. Spec: spec/persistence/shared-learner-cognition.md, memory-tiers.
 */
const DURABLE_MEMORY_LAYERS: ReadonlySet<MemoryLayer> = new Set<MemoryLayer>([
  "semantic",
  "procedural",
  "reflective",
]);

/**
 * Extract the learner-durable subset of a live surface's world-state + memory (DPS-004): the learner's
 * mastery checkpoints (scoped by `ownerUserId`), the concept nodes they verify, the assess edges between
 * carried nodes, and durable-tier memory mutations. The surface is single-learner, so memory is scoped
 * by tier alone. Pure read — no mutation.
 */
export function extractLearnerCognition(
  world: WorldStateGraph,
  memory: TieredMemoryStore,
  ownerUserId: string,
): LearnerCognitionSeed {
  const snapshot = world.snapshot();
  const masteryNodes = snapshot.nodes.filter(
    (n) => n.type === "mastery_checkpoint" && n.props["ownerUserId"] === ownerUserId,
  );
  const conceptKeys = new Set(masteryNodes.map((n) => `concept:${String(n.props["conceptId"])}`));
  const conceptNodes = snapshot.nodes.filter((n) => n.type === "concept" && conceptKeys.has(n.id));
  const carried = [...masteryNodes, ...conceptNodes];
  const carriedIds = new Set(carried.map((n) => n.id));
  const worldNodes: SeedWorldNode[] = carried.map((n) => ({
    id: n.id,
    type: n.type,
    props: n.props,
  }));
  const worldEdges: SeedWorldEdge[] = snapshot.edges
    .filter((e) => carriedIds.has(e.from) && carriedIds.has(e.to))
    .map((e) => ({ id: e.id, from: e.from, to: e.to, type: e.type, props: e.props }));
  const memoryMutations = memory.history().filter((m) => DURABLE_MEMORY_LAYERS.has(m.memory_layer));
  return { worldNodes, worldEdges, memoryMutations: [...memoryMutations] };
}

/**
 * Seed a fresh surface's substrate with a learner's prior cognition (DPS-004). Best-effort/fail-soft:
 * a malformed entry is skipped, never fatal (the profile is a re-derivable cache). Must run BEFORE any
 * wiring/`start()` so it is silent state reconstruction — no event fires, no subscriber is re-triggered.
 */
function applyLearnerSeed(
  world: WorldStateGraph,
  memory: TieredMemoryStore,
  seed: LearnerCognitionSeed,
): void {
  for (const node of seed.worldNodes) {
    world.apply({ kind: "upsert_node", id: node.id, type: node.type, props: node.props });
  }
  for (const edge of seed.worldEdges) {
    world.apply({
      kind: "upsert_edge",
      id: edge.id,
      from: edge.from,
      to: edge.to,
      type: edge.type,
      props: edge.props,
    });
  }
  for (const mutation of seed.memoryMutations) memory.commit(mutation);
}

/**
 * Build a TwinSnapshot from a learner's cross-surface cognition seed (DPS-004 / ADR-0020 D2).
 * Extracts mastery from mastery_checkpoint nodes and digests durable memory per layer.
 */
export function buildTwinSnapshot(cognition: LearnerCognitionSeed, nowMs: number): TwinSnapshot {
  const masteryMap: Record<string, { level: number; confidence: number }> = {};
  for (const node of cognition.worldNodes) {
    if (node.type === "mastery_checkpoint") {
      const conceptId = String(node.props["conceptId"] ?? "");
      const level = typeof node.props["level"] === "number" ? node.props["level"] : 0;
      const confidence =
        typeof node.props["confidence"] === "number" ? node.props["confidence"] : 0;
      if (conceptId) masteryMap[conceptId] = { level, confidence };
    }
  }
  const layerMap = new Map<string, string[]>();
  for (const m of cognition.memoryMutations) {
    const layer = m.memory_layer;
    if (!layerMap.has(layer)) layerMap.set(layer, []);
    const payload = (m.payload ?? {}) as Record<string, unknown>;
    const text = String(payload["conceptId"] ?? payload["content"] ?? m.mutation_id);
    layerMap.get(layer)!.push(text);
  }
  const memoryDigest = [...layerMap.entries()].map(([layer, contents]) => ({
    layer,
    content: contents.join(", "),
    weight: contents.length,
  }));
  return { snapshotAt: nowMs, masteryMap, memoryDigest, goals: [] };
}

export interface DemoFixture {
  readonly surface: SurfaceSession;
  readonly bus: InMemoryEventBus;
  readonly world: WorldStateGraph;
  readonly memory: TieredMemoryStore;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  /**
   * Generate a curriculum for any goal (F02/F03) through the governed curriculum agent, returning
   * a ready `SurfaceAskInput`. Falls back to a deterministic scaffold when the model is unavailable
   * or returns non-curriculum output (e.g. the NullModelRuntime). Spec: PCR §12.
   */
  readonly generateCurriculum: (goal: string) => Promise<Result<SurfaceAskInput, CosError>>;
  /**
   * Assemble a bounded working-memory context for a query from the learner's durable memory, scoped by
   * the session's context lease (tier/user/budget/expiry), and write the admitted items into the
   * `working` tier (distributed). Returns the bounded context. Spec: DPS-005. Empty for a fresh learner.
   */
  readonly assembleContext: (query: string) => Promise<WorkingMemoryContext>;
  /**
   * Interpret a learner goal into the session's intent lease (DPS intent inference): refreshes
   * `interpreted_goal`/`scope`/`constraints`/`confidence` in place (stable `intent_id`) via the governed
   * intent agent, emitting `intent.received` then `intent.interpreted`. Spec: kernel/intent-inference.
   */
  readonly inferIntent: (goal: string) => Promise<Result<IntentLease, CosError>>;
  /**
   * The dynamic capability registry (GOV-P03). The learner is granted `dispatch.<agentId>` for the
   * agents in play; revoking one blocks that agent's next dispatch (the governance immune system).
   * Spec: spec/kernel/capability-registry.md.
   */
  readonly capabilities: CapabilityRegistry;
  /**
   * The knowledge-graph engine (DPS-006): the domain query layer over WorldStateGraph.
   * Pre-seeded with the demo concept graph at session build time. Use `kg.decompose`,
   * `kg.learnerState`, `kg.nextConcept`, and `kg.addBridge` to query the knowledge graph.
   * Spec: spec/world-state/knowledge-graph-engine.md, ADR-0015.
   */
  readonly kg: KnowledgeGraphEngine;
  /**
   * The cognitive observability analysis engine (DPS-007): subscribes to mastery and loop
   * events and produces drift, calibration, and learning-outcome signals. Inspect via
   * `analysis.driftStats()`, `analysis.calibrationStats()`, `analysis.outcomeStats(conceptId)`.
   * Spec: spec/observability/DPS-007-observability-analysis.md, ADR-0017.
   */
  readonly analysis: CognitiveAnalysisEngine;
  /**
   * The proposal blackboard (P4.1 — multi-agent arbitration, ADR-0018): records explanation and
   * challenger proposals per concept and the arbitration winner. Inspect via
   * `proposals.proposals(key)` and `proposals.arbitrations()`.
   * Spec: spec/orchestration/DPS-008-proposal-blackboard.md.
   */
  readonly proposals: ProposalBlackboard;
  /**
   * The governed tool runtime (P4.2 — ADR-0019): in-process ToolRuntime adapter with
   * capability checks and event emission. Use `tools.discover()` and `tools.invoke(name, params)`.
   * Spec: spec/architecture-decisions/ADR-0019-governed-tool-runtime.md.
   */
  readonly tools: InMemoryToolRuntime;
  /**
   * The digital twin registry (P5.1 — ADR-0020): manages consent-scoped cognitive twins for the
   * learner. Use `twins.list(learnerId)` to query, or the lifecycle helpers below.
   * Spec: spec/persistence/DPS-009-digital-twin.md.
   */
  readonly twins: TwinRegistry;
  /** Mint a new digital twin from the current learner cognition state. Emits `twin.created`. */
  readonly createTwin: (displayName: string) => TwinState;
  /** Fork an existing twin into an independent cognitive branch. Emits `twin.branched`. */
  readonly branchTwin: (twinId: string, displayName: string) => TwinState;
  /** Mark a twin as exported (portable artifact created). Emits `twin.exported`. */
  readonly exportTwin: (twinId: string) => TwinState;
  /** Terminate a twin (consent revoked; data preserved for audit). Emits `twin.terminated`. */
  readonly terminateTwin: (twinId: string) => TwinState;
  /**
   * The governed self-evolution engine (P6.1 — ADR-0021): manages pedagogical evolution proposals
   * through the shadow-test → governance-approve → rollout/rollback lifecycle. Inspect via
   * `evolution.list()` and `evolution.get(proposalId)`.
   * Spec: spec/evolution/DPS-010-governed-self-evolution.md.
   */
  readonly evolution: EvolutionEngine;
  /** Propose a pedagogical change for shadow-test evaluation. Emits `evolution.proposal.created`. */
  readonly proposeEvolution: (
    kind: ProposalKind,
    description: string,
    config: ProposalConfiguration,
  ) => EvolutionProposal;
  /** Run shadow tests against default synthetic learners. Emits experiment + shadow_result events. */
  readonly evaluateEvolution: (proposalId: string) => Promise<EvaluationResult>;
  /** Approve a proposal that passed shadow tests (governance gate). */
  readonly approveEvolution: (proposalId: string) => EvolutionProposal;
  /** Mark an approved proposal as rolled out. Emits `evolution.rollout.completed`. */
  readonly rolloutEvolution: (proposalId: string) => EvolutionProposal;
  /** Roll back an approved or rolled-out proposal. Emits `evolution.rollback.completed`. */
  readonly rollbackEvolution: (proposalId: string) => EvolutionProposal;
}

/** Capabilities the learner is granted at session setup (dispatch.<agentId> per ProductRuntimeAgentId). */
const DISPATCH_CAPABILITIES = [
  "supervisor",
  "curriculum",
  "explanation",
  "practice",
  "assessment",
  "revision",
  "memory",
  "intent",
  "research",
  "composer",
  "frameplanner",
  "imageplanner",
].map((id) => `dispatch.${id}`);

export interface DemoOptions {
  /** Builds the ModelRuntime for the model-backed units (recording wrapper goes here). */
  readonly modelFactory: (bus: EventBus, clock: Clock, idGenerator: IdGenerator) => ModelRuntime;
  readonly seed?: string;
  readonly trustLevel?: number;
  /** Optional narration voice synthesis (Phase 2D-S4). Absent ⇒ text-only narration. */
  readonly voice?: VoiceSynthesizer;
  /** Optional generated-media seam (S2.1b, SRF-006). Absent ⇒ no inline generated artifacts. */
  readonly media?: MediaGenerator;
  /** Product mode for this session (S4.3). Absent ⇒ "student". */
  readonly mode?: ProductMode;
  /**
   * Enable the UCS frame path (UCS, ADR-0030): the focus concept becomes a Cognitive Frame —
   * distilled MCCR on the board + a SEPARATE paced narration script + an image decision — instead of
   * a prose explanation block. The product surface (gateway → web) sets this; the CLI/debug harness
   * leaves it off so the substrate's explanation-block path (and `expand`) stays exercised.
   */
  readonly composer?: boolean;
  /**
   * Enable the UCS frame planner (UCS, ADR-0030; Phase 2): the focus concept is decomposed into a
   * SEQUENCE of progressive Cognitive Frames (and practice/assessment become frames), instead of a
   * single composed frame. Requires `composer` to be on. The gateway sets this; the CLI leaves it off.
   */
  readonly framePlanner?: boolean;
  /**
   * Enable the UCS image agent (UCS, ADR-0030; Phase 4): a dedicated governed agent owns the
   * image-as-cognition decision (decide/prompt + caption + callout labels), replacing the composer's
   * inline image_plan on the frame path. Requires `composer`. The gateway sets this; the CLI leaves
   * it off. Absent ⇒ the composer's inline image decision drives generation.
   */
  readonly imagePlanner?: boolean;
  /**
   * Look-ahead budget (UCS, ADR-0030; Phase 3): how many discardable speculative frames the surface
   * may pre-compose ahead of the learner per ask. Seeds `LiveEvolutionConfig.lookaheadBudget` (a
   * governed evolution rollout may then raise/lower it live). 0/absent ⇒ no speculation (the
   * deterministic default the CLI/tests use). Requires `composer` + `framePlanner`. The gateway sets 1.
   */
  readonly lookaheadBudget?: number;
  /**
   * Live progressive-reveal pacing (ms) for the explanation block (S-UCS, ADR-0028). When > 0, the
   * explanation streams as paced `surface.block.delta` chunks before the whole block. Absent/0 ⇒ the
   * whole block is emitted at once (the default; deterministic CLI/tests stay byte-identical).
   */
  readonly streamRevealMs?: number;
  /**
   * Rehydrate a previously-persisted surface into a LIVE session (DPS-002). When present, world-state
   * is restored, memory mutations replayed, and the event log hydrated; the session uses a
   * `CryptoIdGenerator` (new ids unique by construction). The caller then calls `surface.resume(id)`.
   */
  readonly restore?: DemoRestore;
  /** The learner that owns this surface (DPS-003). Absent ⇒ the default demo learner. */
  readonly learner?: LearnerDescriptor;
  /**
   * Seed a NEW surface with the owning learner's prior cross-surface cognition (DPS-004): their
   * mastery subgraph + durable-tier memory, applied silently before wiring so the supervisor routes
   * from prior mastery on the first ask. Mutually exclusive with `restore` (resume already carries the
   * cognition seeded at create). Ignored when `restore` is present.
   */
  readonly learnerSeed?: LearnerCognitionSeed;
  /**
   * Inject the id generator. Default: seeded (deterministic, for the CLI demo + tests). The gateway
   * passes a `CryptoIdGenerator` so concurrently-hosted surfaces get globally-unique ids (the seeded
   * generator is seed-independent, so `seed` alone does not separate id-spaces).
   */
  readonly idGenerator?: IdGenerator;
  /** LLM judge for evaluation scoring (D3 path). Absent ⇒ heuristic D1 scorecards only. */
  readonly evaluationModel?: ModelRuntime;
  /** Semantic embed fn for ContextAssembler. Absent ⇒ local FNV-1a fallback. */
  readonly embedFn?: (text: string) => Promise<number[]>;
}

/** A learner the surface is owned by (DPS-003). Defaults to the demo learner for the CLI/tests. */
export interface LearnerDescriptor {
  /** Stable external handle (`lnr-…` or `user-demo`); the world-state `learner:<userId>` node key. */
  readonly userId: string;
  /** Cognitive identity (`cog-…`) used for governance, leases, and the learner node. */
  readonly cid: string;
  readonly trustLevel: number;
}

const DEMO_LEARNER: LearnerDescriptor = {
  userId: "user-demo",
  cid: "cog-demo-learner",
  trustLevel: 5,
};

function onboarding(learner: LearnerDescriptor, mode?: ProductMode): OnboardingSession {
  const { userId, cid, trustLevel } = learner;
  const learnerIdentity: CognitiveIdentity = {
    cid,
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
      envelope_id: `env-${userId}`,
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
      lease_id: `lease-${userId}`,
      granted_to: learnerIdentity.cid,
      memory_layers: ["working", "semantic"],
      allowed_users: [userId],
      token_budget: 16_000,
      granted_by: "kernel",
      expires_at: "2026-06-11T02:00:00.000Z",
    },
    intentLease: {
      intent_id: `intent-${userId}`,
      owner_user_id: userId,
      interpreted_goal: "Understand the requested topic deeply",
      scope: ["learning", "student"],
      constraints: [],
      expires_at: "2026-06-11T02:00:00.000Z",
      confidence: 1,
      held_by: [learnerIdentity.cid],
    },
    learnerNodeId: `learner:${userId}`,
    intentNodeId: `intent:intent-${userId}`,
    seedMemoryMutationId: `mut-${userId}`,
    ...(mode ? { mode } : {}),
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
  // Resumed sessions need globally-unique NEW ids (recorded events keep their original ids), so they
  // use a crypto generator; fresh sessions stay seeded for deterministic tests/replay (DPS-002). An
  // explicit generator (the gateway passes crypto for unique surface ids) overrides both.
  const idGenerator: IdGenerator =
    options.idGenerator ??
    (options.restore
      ? new CryptoIdGenerator()
      : new SeededIdGenerator(options.seed ?? "inevitable-demo"));
  const bus = new InMemoryEventBus({ idGenerator });
  const world = new WorldStateGraph({
    clock,
    nodeId: "demo",
    acyclicEdgeTypes: ["prerequisite_of"],
  });
  const memory = new TieredMemoryStore();

  if (options.restore) {
    // Restore the three independently event-sourced substrates before any wiring uses them.
    world.restore(options.restore.worldSnapshot);
    for (const mutation of options.restore.memoryMutations) memory.commit(mutation);
    bus.hydrate(options.restore.events); // load history without re-delivery
  } else if (options.learnerSeed) {
    // A NEW surface for a returning learner: silently reconstruct prior cross-surface cognition
    // (DPS-004) before any wiring/start, so the supervisor routes from prior mastery on the first ask.
    applyLearnerSeed(world, memory, options.learnerSeed);
  }
  const learner: LearnerDescriptor = options.learner ?? {
    ...DEMO_LEARNER,
    trustLevel: options.trustLevel ?? DEMO_LEARNER.trustLevel,
  };
  const session = onboarding(learner, options.mode);
  const governance = new GovernanceEngine(PRODUCT_DISPATCH_POLICIES, { idGenerator });
  // Dynamic capability registry (GOV-P03): grant the learner the dispatch capabilities up front;
  // revoking one blocks that agent's next dispatch. Spec: spec/kernel/capability-registry.md.
  const capabilities = new CapabilityRegistry({ clock });
  for (const capability of DISPATCH_CAPABILITIES) {
    capabilities.grant(session.learnerIdentity.cid, capability, "kernel");
  }
  const model = options.modelFactory(bus, clock, idGenerator);

  const manifest = (id: string) => MVP_AGENT_MANIFESTS.find((m) => m.id === `agent.${id}`)!;
  // Live evolution config (P5.2, DPS-010 §5): rollout callbacks mutate this; modelUnit reads it.
  // Seed the look-ahead budget (UCS, ADR-0030; Phase 3) from options so the gateway's base budget is
  // live-governable (a rolled-out proposal may raise/lower it without a restart).
  const liveConfig = new LiveEvolutionConfig();
  if (typeof options.lookaheadBudget === "number") {
    liveConfig.lookaheadBudget = Math.max(0, Math.floor(options.lookaheadBudget));
  }
  const modelUnit = (role: ModelBackedRole) =>
    new ModelBackedUnit({
      manifest: manifest(role),
      model,
      role,
      fallback: new DeterministicMvpUnit(manifest(role), idGenerator),
      world,
      timeoutMs: 60_000,
      idGenerator,
      getDepthBias: () => liveConfig.depthBias,
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
      capabilityRegistry: capabilities,
    });

  const explanationDispatcher = dispatcher("explanation", "cog-exp-demo", modelUnit("explanation"));
  // P4 — revision agent is now a real ModelBackedUnit so it produces genuine competing content.
  // When the two agents' layer_0 outputs have Jaccard similarity < 0.3, surface.agent.disagreed
  // fires and the arbiter records a synthesis — making multi-agent cognition visible in the panel.
  const challengerDispatcher = dispatcher("revision", "cog-rev-demo", modelUnit("revision"));
  const proposals = new ProposalBlackboard();
  // S3.2 — research frontier dispatcher (F10, ADR-0026).
  const researchDispatcher = dispatcher(
    "research",
    "cog-res-demo",
    new ResearchUnit({ manifest: manifest("research"), model, idGenerator }),
  );
  // UCS (ADR-0030) — Surface Composer: the focus concept becomes a Cognitive Frame (distilled MCCR
  // on the board + a SEPARATE paced narration script + an image decision). Reads the live depth bias.
  const composerDispatcher = dispatcher(
    "composer",
    "cog-comp-demo",
    new SurfaceComposerUnit({
      manifest: manifest("composer"),
      model,
      idGenerator,
      getDepthBias: () => liveConfig.depthBias,
    }),
  );
  // UCS (ADR-0030; Phase 2) — Frame Planner: decomposes the focus concept into a SEQUENCE of
  // progressive Cognitive Frames. The composer then distills each frame. Reads the live depth bias.
  const framePlannerDispatcher = dispatcher(
    "frameplanner",
    "cog-plan-demo",
    new FramePlannerUnit({
      manifest: manifest("frameplanner"),
      model,
      idGenerator,
      getDepthBias: () => liveConfig.depthBias,
    }),
  );
  // UCS (ADR-0030; Phase 4) — Image Agent: owns the image-as-cognition decision (decide/prompt/refine),
  // producing the prompt + an explanatory caption + callout labels, off the composer's shoulders.
  const imagePlannerDispatcher = dispatcher(
    "imageplanner",
    "cog-img-demo",
    new ImagePlannerUnit({
      manifest: manifest("imageplanner"),
      model,
      idGenerator,
    }),
  );

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
    challengerDispatcher,
    proposals,
    world,
    bus,
    clock,
    idGenerator,
    nodeId: "demo-loop",
  });

  const evaluationEngine = new CognitiveEvaluationEngine({
    bus,
    clock,
    idGenerator,
    nodeId: "demo-eval",
    producerCid: "engine.evaluation.demo",
    model: options.evaluationModel,
  });

  const surface = new SurfaceSession({
    session,
    world,
    bus,
    loop,
    explanationDispatcher,
    researchDispatcher,
    evaluationEngine,
    supervisorCid: "cog-sup-demo",
    clock,
    idGenerator,
    nodeId: "demo-surface",
    ...(options.composer ? { composerDispatcher } : {}),
    ...(options.composer && options.framePlanner ? { framePlannerDispatcher } : {}),
    ...(options.composer && options.imagePlanner ? { imagePlannerDispatcher } : {}),
    // Look-ahead budget (UCS, ADR-0030; Phase 3) is read live from the governed config each ask.
    ...(options.composer && options.framePlanner
      ? { getLookaheadBudget: () => liveConfig.lookaheadBudget }
      : {}),
    ...(options.voice ? { voice: options.voice } : {}),
    ...(options.media ? { media: options.media } : {}),
    ...(options.streamRevealMs ? { streamRevealMs: options.streamRevealMs } : {}),
  });

  // The curriculum agent (F02/F03) turns any goal into a concept DAG — governed like every unit.
  const curriculumDispatcher = dispatcher(
    "curriculum",
    "cog-cur-demo",
    new CurriculumUnit({ manifest: manifest("curriculum"), model, idGenerator }),
  );

  const generateCurriculum = async (goal: string): Promise<Result<SurfaceAskInput, CosError>> => {
    const dispatched = await curriculumDispatcher.dispatch({
      session,
      targetAgentId: "curriculum",
      intent: `curriculum: ${goal}`,
      content: { goal },
      maxTimeSeconds: 30,
    });
    if (!dispatched.ok) return err(dispatched.error);
    const content = (dispatched.value.responsePackets[0]?.content ?? {}) as Record<string, unknown>;
    const rawConcepts = Array.isArray(content["concepts"]) ? content["concepts"] : [];
    const concepts = rawConcepts.map((entry) => {
      const c = entry as { id?: unknown; title?: unknown; prerequisites?: unknown };
      return {
        id: String(c.id ?? ""),
        title: String(c.title ?? ""),
        prerequisites: Array.isArray(c.prerequisites)
          ? c.prerequisites.filter((p): p is string => typeof p === "string")
          : [],
      };
    });
    if (concepts.length === 0) {
      return err(
        new CosError("E_DEMO_CURRICULUM", "curriculum produced no concepts", {
          specRef: "spec/product/product-cognition-runtime.md",
        }),
      );
    }
    // S2.4 — Seed the live curriculum into the KG: concept layer/domain + typed cross-concept edges.
    // `SurfaceTimelineBuilder.projectEdges()` reads world-state neighbors for typed edge types, so
    // seeding here is all that is needed — no changes to the timeline builder.
    const CURRICULUM_EDGE_TYPES = new Set<string>([
      "depends_on",
      "applies_to",
      "research_adjacent",
      "bridges_to",
      "frontier_of",
    ]);
    const conceptSpecs: ConceptSpec[] = rawConcepts
      .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
      .map((c) => {
        const rawLayer = typeof c["layer"] === "number" ? c["layer"] : 2;
        const layer = Math.min(6, Math.max(0, Math.round(rawLayer))) as ConceptLayer;
        const domain =
          typeof c["domain"] === "string" && c["domain"].trim()
            ? c["domain"].trim()
            : curriculumSlug(goal);
        return {
          id: String(c["id"] ?? ""),
          label: String(c["title"] ?? ""),
          domain,
          layer,
          prerequisites: Array.isArray(c["prerequisites"])
            ? (c["prerequisites"] as unknown[]).filter((p): p is string => typeof p === "string")
            : [],
        };
      })
      .filter((s) => s.id);
    if (conceptSpecs.length > 0) {
      kg.seedConcepts(conceptSpecs);
    }
    const rawEdges = Array.isArray(content["edges"]) ? (content["edges"] as unknown[]) : [];
    for (const entry of rawEdges) {
      if (typeof entry !== "object" || entry === null) continue;
      const e = entry as Record<string, unknown>;
      const from = typeof e["from"] === "string" ? e["from"] : "";
      const to = typeof e["to"] === "string" ? e["to"] : "";
      const type = typeof e["type"] === "string" ? e["type"] : "";
      if (from && to && type && CURRICULUM_EDGE_TYPES.has(type)) {
        kg.addEdge(from, to, type as KnowledgeEdgeType);
      }
    }
    const focusConceptId =
      typeof content["focus_concept_id"] === "string" &&
      concepts.some((c) => c.id === content["focus_concept_id"])
        ? (content["focus_concept_id"] as string)
        : concepts[0]!.id;
    const focusTitle = concepts.find((c) => c.id === focusConceptId)?.title ?? focusConceptId;
    const explanationPrompt =
      typeof content["explanation_prompt"] === "string"
        ? (content["explanation_prompt"] as string)
        : `Explain ${focusTitle} so a motivated beginner genuinely understands it`;
    const practicePrompt =
      typeof content["practice_prompt"] === "string"
        ? (content["practice_prompt"] as string)
        : `Give one concrete practice problem for ${focusTitle}`;
    return ok({
      goal,
      pathId: `path-${curriculumSlug(goal)}`,
      concepts,
      focusConceptId,
      explanationPrompt,
      practicePrompt,
      mastery: {
        assessorCid: "cog-sup-demo",
        passed: true,
        confidence: 0.9,
        evidence: [{ kind: "practice", result: "solved correctly" }],
        depthTests: DEMO_DEPTH_TESTS,
      },
    });
  };

  // Intent inference (kernel/intent-inference): interpret the learner's goal into the session's intent
  // lease through the governed path, emitting intent.received → intent.interpreted.
  const intentDispatcher = dispatcher(
    "intent",
    "cog-int-demo",
    new IntentInferenceUnit({ manifest: manifest("intent"), model, idGenerator }),
  );
  let intentHlc: Hlc = hlcInit("demo-intent");
  const emitIntent = async (eventType: string, payload: Record<string, unknown>): Promise<void> => {
    const created = createEvent(
      {
        eventType,
        producerCid: session.learnerIdentity.cid,
        producerType: "kernel.intent",
        payload,
        topic: `cos.${eventType}`,
        classification: "internal",
      },
      { clock, hlc: intentHlc, idGenerator },
    );
    intentHlc = created.hlc;
    await bus.publish(created.event);
  };
  const inferIntent = async (goal: string): Promise<Result<IntentLease, CosError>> => {
    await emitIntent("intent.received", { goal, owner_user_id: session.intentLease.owner_user_id });
    const dispatched = await intentDispatcher.dispatch({
      session,
      targetAgentId: "intent",
      intent: `interpret: ${goal}`,
      content: { goal },
      maxTimeSeconds: 30,
    });
    if (!dispatched.ok) return err(dispatched.error);
    const content = (dispatched.value.responsePackets[0]?.content ?? {}) as Record<string, unknown>;
    const interpretedGoal =
      typeof content["interpreted_goal"] === "string" && content["interpreted_goal"].trim()
        ? (content["interpreted_goal"] as string)
        : goal;
    const scope = Array.isArray(content["scope"])
      ? content["scope"].filter((s): s is string => typeof s === "string")
      : [];
    const constraints = Array.isArray(content["constraints"])
      ? content["constraints"].filter((s): s is string => typeof s === "string")
      : [];
    const confidence = typeof content["confidence"] === "number" ? content["confidence"] : 0.5;
    // Re-interpret the session's intent lease IN PLACE: keep intent_id (= surface session_id) stable.
    session.intentLease.interpreted_goal = interpretedGoal;
    session.intentLease.scope = scope;
    session.intentLease.constraints = constraints;
    session.intentLease.confidence = confidence;
    await emitIntent("intent.interpreted", {
      intent_id: session.intentLease.intent_id,
      owner_user_id: session.intentLease.owner_user_id,
      interpreted_goal: interpretedGoal,
      scope,
      confidence,
    });
    return ok(session.intentLease);
  };

  // Context-lease-bounded retrieval (DPS-005): assemble the learner's relevant prior knowledge into
  // working memory on demand, bounded by the session's context lease. VectorStore-backed; deterministic.
  const contextAssembler = new ContextAssembler({
    vectors: new InMemoryVectorStore(),
    ...(options.embedFn ? { embedFn: options.embedFn } : {}),
  });
  const ownerUserId = session.intentLease.owner_user_id;
  const assembleContext = async (query: string): Promise<WorkingMemoryContext> => {
    // Index the learner's durable-tier memory (the retrievable knowledge), then assemble under the lease.
    const items: RetrievableMemoryItem[] = memory
      .history()
      .filter((m) => DURABLE_MEMORY_LAYERS.has(m.memory_layer))
      .map((m) => {
        const payload = (m.payload ?? {}) as Record<string, unknown>;
        const target = (m.target ?? {}) as Record<string, unknown>;
        const text = String(payload["conceptId"] ?? target["conceptId"] ?? target["id"] ?? "");
        const owner =
          typeof payload["ownerUserId"] === "string" ? payload["ownerUserId"] : ownerUserId;
        return {
          id: m.mutation_id,
          text,
          memoryLayer: m.memory_layer,
          ownerUserId: owner,
          confidence: m.confidence,
        };
      });
    await contextAssembler.index(items);
    const context = await contextAssembler.assemble({
      query,
      lease: session.contextLease,
      nowMs: clock.nowMs(),
    });
    // Assemble into the working tier: each admitted item becomes a distributed working-memory fact,
    // carrying its lease ref + source provenance. Working tier is session scratch (never captured/seeded).
    for (const admitted of context.items) {
      const mutation: MemoryMutation = {
        mutation_id: newMutationId(idGenerator),
        proposer_cid: session.learnerIdentity.cid,
        memory_layer: "working",
        mutation_type: "add_fact",
        target: { id: `ctx:${context.leaseId}:${admitted.id}` },
        payload: {
          assembled_from: admitted.id,
          query,
          concept: admitted.text,
          score: admitted.score,
        },
        evidence: [],
        confidence: Math.max(0, Math.min(1, admitted.score)),
        context_lease_ref: context.leaseId,
        classification: "internal",
      };
      memory.commit(mutation);
    }
    return context;
  };

  // Knowledge-graph engine (DPS-006): pre-seed the demo concept graph so the KG is queryable
  // from the first ask. Concepts mirror demoAsk() — idempotent if demoAsk is called later.
  const kg = new KnowledgeGraphEngine(world);
  const DEMO_KG_CONCEPTS: readonly ConceptSpec[] = [
    { id: "linear-algebra", label: "Linear Algebra", domain: "mathematics", layer: 3 },
    { id: "gradient-descent", label: "Gradient Descent", domain: "optimization", layer: 3 },
    {
      id: "perceptron",
      label: "The Perceptron",
      domain: "machine-learning",
      layer: 2,
      prerequisites: ["linear-algebra"],
    },
    {
      id: "neural-networks",
      label: "Neural Networks",
      domain: "machine-learning",
      layer: 2,
      prerequisites: ["perceptron", "gradient-descent"],
    },
  ];
  kg.seedConcepts(DEMO_KG_CONCEPTS);

  // Observability analysis engine (DPS-007): subscribes to mastery and loop events, emitting
  // drift/calibration/outcome signals back onto the bus and into the metrics store.
  const analysisMeter = new InMemoryMeter();
  let analysisHlc = hlcInit("analysis");
  const analysis = new CognitiveAnalysisEngine({
    meter: analysisMeter,
    publish: (eventType: string, payload: Record<string, unknown>) => {
      const created = createEvent(
        {
          eventType,
          producerCid: "cog-analysis",
          producerType: "system.analysis",
          payload,
          topic: `cos.${eventType}`,
          classification: "internal",
        },
        { clock, hlc: analysisHlc, idGenerator },
      );
      analysisHlc = created.hlc;
      void bus.publish(created.event);
    },
  });
  bus.subscribe("mastery.checkpoint.created", async (event) => {
    analysis.handleEvent(event);
  });
  bus.subscribe("learning.loop.completed", async (event) => {
    analysis.handleEvent(event);
  });

  // Governed tool runtime (P4.2 — ADR-0019): in-process ToolRuntime with capability checks and
  // event emission. Tools are granted via the capability registry: grant "tool.<name>" to allow.
  const tools = new InMemoryToolRuntime({
    bus,
    clock,
    idGenerator,
    ownerCid: session.learnerIdentity.cid,
    checkCapability: (cid: string, cap: string) => capabilities.has(cid, cap),
    nodeId: "demo-tools",
  });
  // Pre-grant tool capabilities for the demo learner.
  capabilities.grant(session.learnerIdentity.cid, "tool.search-concepts", "kernel");
  // Demo tool: search concept nodes in the world-state graph by type (ADR-0019 D5).
  tools.register({ name: "search-concepts", sideEffecting: false }, async (params) => {
    const keyword = typeof params["keyword"] === "string" ? params["keyword"].toLowerCase() : "";
    const snapshot = world.snapshot();
    const matches = snapshot.nodes
      .filter((n) => n.type === "concept" && n.id.includes(keyword))
      .map((n) => ({ id: n.id, label: n.props["label"] ?? n.id }));
    return ok(matches);
  });

  // Digital twin registry (P5.1 — ADR-0020): consent-scoped cognitive artifact lifecycle.
  let twinHlc: Hlc = hlcInit("demo-twins");
  const twins = new TwinRegistry({
    clock,
    idGenerator,
    publish: (eventType: string, payload: Record<string, unknown>) => {
      const created = createEvent(
        {
          eventType,
          producerCid: session.learnerIdentity.cid,
          producerType: "system.twin-registry",
          payload,
          topic: `cos.${eventType}`,
          classification: "internal",
        },
        { clock, hlc: twinHlc, idGenerator },
      );
      twinHlc = created.hlc;
      void bus.publish(created.event);
    },
  });

  const createTwin = (displayName: string): TwinState => {
    const cognition = extractLearnerCognition(world, memory, learner.userId);
    const twinSnapshot = buildTwinSnapshot(cognition, clock.nowMs());
    const consent: TwinConsent = {
      learnerId: learner.userId,
      grantedAt: clock.nowMs(),
      allowedSurfaces: ["*"],
      allowedAgents: ["*"],
    };
    return twins.create({
      learnerId: learner.userId,
      displayName,
      consent,
      snapshot: twinSnapshot,
    });
  };
  const branchTwin = (twinId: string, displayName: string): TwinState =>
    twins.branch(twinId, displayName);
  const exportTwin = (twinId: string): TwinState => twins.export(twinId);
  const terminateTwin = (twinId: string): TwinState => twins.terminate(twinId);

  // Governed self-evolution engine (P6.1 — DPS-010, ADR-0021): proposals → shadow tests →
  // governance gate → rollout/rollback. Default synthetic learners cover zero-knowledge,
  // intermediate, and advanced learner profiles for representative shadow testing.
  const DEFAULT_SYNTHETIC_LEARNERS: readonly SyntheticLearnerSeed[] = [
    {
      learnerId: "synthetic-beginner",
      masteryMap: {},
      goals: ["linear-algebra"],
    },
    {
      learnerId: "synthetic-intermediate",
      masteryMap: {
        "linear-algebra": { level: 3, confidence: 0.7 },
        calculus: { level: 2, confidence: 0.6 },
      },
      goals: ["neural-networks"],
    },
    {
      learnerId: "synthetic-advanced",
      masteryMap: {
        "linear-algebra": { level: 4, confidence: 0.9 },
        calculus: { level: 4, confidence: 0.85 },
        probability: { level: 3, confidence: 0.75 },
      },
      goals: ["deep-learning"],
    },
  ];
  let evolutionHlc: Hlc = hlcInit("demo-evolution");
  const evolution = new EvolutionEngine({
    clock,
    idGenerator,
    publish: (eventType: string, payload: Record<string, unknown>) => {
      const created = createEvent(
        {
          eventType,
          producerCid: session.learnerIdentity.cid,
          producerType: "system.evolution-engine",
          payload,
          topic: `cos.${eventType}`,
          classification: "internal",
        },
        { clock, hlc: evolutionHlc, idGenerator },
      );
      evolutionHlc = created.hlc;
      void bus.publish(created.event);
    },
    guard: (action: string) => {
      const result = governanceGuard(governance, {
        subjectCid: session.learnerIdentity.cid,
        resource: "evolution.proposal",
        action,
        context: {},
      });
      return result.allowed;
    },
    evaluationGuard: (proposal) => {
      // S4.2 (ADR-0027): block evolution approval when cognitive evaluation quality is
      // insufficient. The overallPassRate already captures shadow-learner cognitive signal;
      // we gate it against EVALUATION_PASS_THRESHOLD (0.7) from @inevitable/evaluation.
      const passRate = proposal.evaluationResult?.overallPassRate ?? 0;
      return passRate >= EVALUATION_PASS_THRESHOLD;
    },
    // P5.2: apply/revert the proposal's configuration to the live config so all subsequent
    // model-backed units pick up the depth shift immediately without a restart (DPS-010 §5).
    onRollout: (proposal) => liveConfig.apply(proposal.configuration),
    onRollback: (proposal) => liveConfig.revert(proposal.configuration),
  });
  const proposeEvolution = (
    kind: ProposalKind,
    description: string,
    config: ProposalConfiguration,
  ): EvolutionProposal =>
    evolution.propose({
      kind,
      description,
      configuration: config,
      syntheticLearners: DEFAULT_SYNTHETIC_LEARNERS,
    });
  const evaluateEvolution = (proposalId: string): Promise<EvaluationResult> =>
    evolution.evaluate(proposalId);
  const approveEvolution = (proposalId: string): EvolutionProposal => evolution.approve(proposalId);
  const rolloutEvolution = (proposalId: string): EvolutionProposal => evolution.rollout(proposalId);
  const rollbackEvolution = (proposalId: string): EvolutionProposal =>
    evolution.rollback(proposalId);

  return {
    surface,
    bus,
    world,
    memory,
    clock,
    idGenerator,
    generateCurriculum,
    assembleContext,
    inferIntent,
    capabilities,
    kg,
    analysis,
    proposals,
    tools,
    twins,
    createTwin,
    branchTwin,
    exportTwin,
    terminateTwin,
    evolution,
    proposeEvolution,
    evaluateEvolution,
    approveEvolution,
    rolloutEvolution,
    rollbackEvolution,
  };
}

/**
 * Deterministic five-test depth results for demo/offline paths (S2.2, F14).
 * All five pass at high confidence — the gate will always pass in the demo.
 */
const DEMO_DEPTH_TESTS: readonly DepthTestResult[] = [
  { kind: "explanation", passed: true, confidence: 0.9, evidence: "articulated core concept" },
  { kind: "application", passed: true, confidence: 0.88, evidence: "solved practice problem" },
  {
    kind: "connection",
    passed: true,
    confidence: 0.85,
    evidence: "linked to prerequisite concepts",
  },
  { kind: "teaching", passed: true, confidence: 0.82, evidence: "rephrased for a novice" },
  {
    kind: "edge_case",
    passed: true,
    confidence: 0.8,
    evidence: "handled degenerate input correctly",
  },
];

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
      depthTests: DEMO_DEPTH_TESTS,
    },
  };
}
