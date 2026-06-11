/**
 * SurfaceSession — the live Cognitive Surface session.
 *
 * Open one session, ask one question, watch the surface evolve: the session composes the
 * existing substrate (FiberedLearningLoop → supervisor routing → governed agent dispatches →
 * mastery recording) and manifests every step as Cognition Blocks on a living timeline.
 *
 * Canonical state = the surface.* event log + world-state graph. `state()` is a fold over
 * the bus replay; the session stores no render state of its own.
 *
 * Spec: spec/surface/cognitive-surface-runtime.md §4.4, §6.1.
 */
import { createEvent, type EventBus } from "@inevitable/events";
import type {
  ConceptSeed,
  FiberedLearningLoop,
  FiberedLearningLoopResult,
  LearningLoopMasteryInput,
  OnboardingSession,
  ProductDispatchInput,
  ProductDispatchResult,
  SupervisorRoutingDecision,
} from "@inevitable/product-cognition";
import type { CognitiveEvent } from "@inevitable/protocols";
import {
  CosError,
  CryptoIdGenerator,
  SystemClock,
  err,
  hlcInit,
  ok,
  type Clock,
  type Hlc,
  type IdGenerator,
  type Result,
} from "@inevitable/shared";
import type { WorldStateGraph } from "@inevitable/world-state";

import type { CognitionBlock } from "./blocks";
import { AgentContributionRuntime, contributionFromDispatch } from "./contribution";
import { foldSurfaceEvents, type SurfaceState } from "./projection";
import { SurfaceTimelineBuilder, type TimelineProjection } from "./timeline";
import { traceBlock, type BlockTrace } from "./trace";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Structural view of a governed dispatcher (ProductRuntimeDispatcher satisfies it). */
export interface GovernedDispatcher {
  dispatch(input: ProductDispatchInput): Promise<Result<ProductDispatchResult, CosError>>;
}

export interface SurfaceSessionDeps {
  readonly session: OnboardingSession;
  readonly world: WorldStateGraph;
  readonly bus: EventBus;
  /** The existing deterministic learning cycle — routing, dispatches, mastery, journal. */
  readonly loop: FiberedLearningLoop;
  /**
   * Optional governed explanation dispatcher enabling `expand()` (Phase 2B progressive
   * deepening). Expansion re-dispatches through the SAME gate — no bypass.
   */
  readonly explanationDispatcher?: GovernedDispatcher;
  /** CID stamped on supervisor routing blocks. */
  readonly supervisorCid?: string;
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
  readonly nodeId?: string;
}

export interface SurfaceAskInput {
  readonly goal: string;
  readonly pathId: string;
  readonly concepts: readonly ConceptSeed[];
  readonly focusConceptId: string;
  readonly explanationPrompt: string;
  readonly practicePrompt: string;
  readonly mastery: LearningLoopMasteryInput;
}

export interface SurfaceAskResult {
  readonly routing: SupervisorRoutingDecision;
  readonly blocks: readonly CognitionBlock[];
  readonly timeline: TimelineProjection;
  readonly loop: FiberedLearningLoopResult;
  readonly state: SurfaceState;
}

function sessionError(message: string, details?: Record<string, unknown>): CosError {
  return new CosError("E_SURFACE_SESSION", message, {
    specRef: "spec/surface/cognitive-surface-runtime.md",
    details,
  });
}

// ---------------------------------------------------------------------------
// SurfaceSession
// ---------------------------------------------------------------------------

export class SurfaceSession {
  private readonly world: WorldStateGraph;
  private readonly bus: EventBus;
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;
  private readonly contributions: AgentContributionRuntime;
  private readonly supervisorCid: string;
  private hlc: Hlc;

  private surfaceId: string | null = null;
  private timeline: SurfaceTimelineBuilder | null = null;
  private closed = false;

  constructor(private readonly deps: SurfaceSessionDeps) {
    this.world = deps.world;
    this.bus = deps.bus;
    this.clock = deps.clock ?? new SystemClock();
    this.idGenerator = deps.idGenerator ?? new CryptoIdGenerator();
    this.supervisorCid = deps.supervisorCid ?? "agent.supervisor";
    this.hlc = hlcInit(deps.nodeId ?? "surface-session");
    this.contributions = new AgentContributionRuntime({
      bus: deps.bus,
      clock: this.clock,
      idGenerator: this.idGenerator,
      nodeId: `${deps.nodeId ?? "surface-session"}-contrib`,
    });
  }

  /** The surface id once started. */
  id(): string | null {
    return this.surfaceId;
  }

  /**
   * Create the surface: world-state node first, then the `surface.created` event
   * (events follow state). Returns the surface id.
   */
  async start(goal?: string): Promise<Result<string, CosError>> {
    if (this.surfaceId) {
      return err(sessionError("surface session already started", { surfaceId: this.surfaceId }));
    }
    const learner = this.deps.session;
    const surfaceId = `srf-${this.idGenerator.hex(12)}`;
    const surfaceNodeId = `surface:${surfaceId}`;

    if (!this.world.getNode(learner.learnerNodeId)) {
      const learnerNode = this.world.apply({
        kind: "upsert_node",
        id: learner.learnerNodeId,
        type: "learner",
        props: { cid: learner.learnerIdentity.cid },
      });
      if (!learnerNode.ok) return learnerNode;
    }
    const nodeResult = this.world.apply({
      kind: "upsert_node",
      id: surfaceNodeId,
      type: "surface_session",
      props: {
        surfaceId,
        learnerCid: learner.learnerIdentity.cid,
        sessionId: learner.intentLease.intent_id,
        goal: goal ?? null,
        status: "active",
      },
    });
    if (!nodeResult.ok) return nodeResult;
    const edgeResult = this.world.apply({
      kind: "upsert_edge",
      id: `edge:${surfaceNodeId}:projected_for:${learner.learnerNodeId}`,
      from: surfaceNodeId,
      to: learner.learnerNodeId,
      type: "projected_for",
      props: {},
    });
    if (!edgeResult.ok) return edgeResult;

    this.surfaceId = surfaceId;
    await this.emit("surface.created", {
      surface_id: surfaceId,
      learner_cid: learner.learnerIdentity.cid,
      session_id: learner.intentLease.intent_id,
      goal: goal ?? null,
    });
    return ok(surfaceId);
  }

  /**
   * One ask cycle: living timeline → governed learning cycle (supervisor routing, agent
   * dispatches, mastery) → cognition blocks → timeline re-projection.
   */
  async ask(input: SurfaceAskInput): Promise<Result<SurfaceAskResult, CosError>> {
    if (!this.surfaceId) return err(sessionError("surface session not started"));
    if (this.closed) return err(sessionError("surface session is closed"));
    const surfaceId = this.surfaceId;
    const learner = this.deps.session;

    // 1. Living timeline (one live timeline per surface; a new ask re-anchors it).
    this.timeline = new SurfaceTimelineBuilder({
      world: this.world,
      bus: this.bus,
      clock: this.clock,
      idGenerator: this.idGenerator,
      nodeId: `${surfaceId}-timeline`,
      producerCid: learner.learnerIdentity.cid,
    });
    const built = await this.timeline.build({
      surface_id: surfaceId,
      goal: input.goal,
      path_id: input.pathId,
      owner_user_id: learner.intentLease.owner_user_id,
      concepts: input.concepts,
    });
    if (!built.ok) return built;

    // 2. The governed learning cycle on the existing substrate.
    const loopResult = await this.deps.loop.run({
      session: learner,
      pathId: input.pathId,
      concepts: input.concepts,
      focusConceptId: input.focusConceptId,
      explanationPrompt: input.explanationPrompt,
      practicePrompt: input.practicePrompt,
      mastery: input.mastery,
    });
    if (!loopResult.ok) return loopResult;
    const cycle = loopResult.value;
    const focusTitle =
      input.concepts.find((c) => c.id === input.focusConceptId)?.title ?? input.focusConceptId;
    const conceptNodeId = `concept:${input.focusConceptId}`;
    const blocks: CognitionBlock[] = [];

    // 3. Supervisor decision becomes visible: reasoning event + routing block.
    await this.emit("surface.reasoning.recorded", {
      surface_id: surfaceId,
      decision: {
        target_agent: cycle.routing.targetAgent,
        reason: cycle.routing.reason,
        concept_id: cycle.routing.conceptId,
      },
      producer_cid: this.supervisorCid,
    });
    const routingBlock = await this.contributions.contribute({
      surface_id: surfaceId,
      agent_id: "supervisor",
      agent_cid: this.supervisorCid,
      block_type: "routing",
      title: `Routing — ${focusTitle}`,
      content: {
        target_agent: cycle.routing.targetAgent,
        reason: cycle.routing.reason,
        concept_id: cycle.routing.conceptId,
      },
      concept_ids: [input.focusConceptId],
      reason: "supervisor world-state routing decision",
      world_state_nodes: [conceptNodeId],
    });
    if (!routingBlock.ok) return routingBlock;
    blocks.push(routingBlock.value);

    // 4. Agent contributions become blocks.
    if (cycle.explanation) {
      const block = await this.contributions.contribute(
        contributionFromDispatch({
          surface_id: surfaceId,
          agent_id: "explanation",
          block_type: "explanation",
          title: `Explanation — ${focusTitle}`,
          dispatch: cycle.explanation,
          reason: "explanation agent response to learner ask",
          concept_ids: [input.focusConceptId],
          world_state_nodes: [conceptNodeId],
        }),
      );
      if (!block.ok) return block;
      blocks.push(block.value);
    }
    if (cycle.practice) {
      const block = await this.contributions.contribute(
        contributionFromDispatch({
          surface_id: surfaceId,
          agent_id: "practice",
          block_type: "practice",
          title: `Practice — ${focusTitle}`,
          dispatch: cycle.practice,
          reason: "practice agent response to learner ask",
          concept_ids: [input.focusConceptId],
          world_state_nodes: [conceptNodeId],
        }),
      );
      if (!block.ok) return block;
      blocks.push(block.value);
    }

    // 5. Mastery evidence becomes an assessment block backed by its memory mutation.
    if (cycle.mastery) {
      const assessmentBlock = await this.contributions.contribute({
        surface_id: surfaceId,
        agent_id: "assessment",
        agent_cid: input.mastery.assessorCid,
        block_type: "assessment",
        title: `Mastery Checkpoint — ${focusTitle}`,
        content: {
          checkpoint_node_id: cycle.mastery.checkpointNodeId,
          concept_node_id: cycle.mastery.conceptNodeId,
          passed: input.mastery.passed,
          confidence: input.mastery.confidence,
        },
        concept_ids: [input.focusConceptId],
        reason: "mastery checkpoint recorded as world-state + memory evidence",
        confidence: input.mastery.confidence,
        world_state_nodes: [cycle.mastery.checkpointNodeId, cycle.mastery.conceptNodeId],
        memory_mutation_id: cycle.mastery.mutationId,
      });
      if (!assessmentBlock.ok) return assessmentBlock;
      blocks.push(assessmentBlock.value);
      await this.emit("surface.memory.attached", {
        surface_id: surfaceId,
        block_id: assessmentBlock.value.block_id,
        mutation_id: cycle.mastery.mutationId,
        memory_layer: "semantic",
      });
    }

    // 6. The world changed — re-project the living timeline.
    const refreshed = await this.timeline.refresh("learning-cycle-completed");
    if (!refreshed.ok) return refreshed;

    return ok({
      routing: cycle.routing,
      blocks,
      timeline: refreshed.value,
      loop: cycle,
      state: this.state() as SurfaceState,
    });
  }

  /**
   * Progressive deepening (Phase 2B, F04 layers 0–1): re-dispatch the explanation agent for a
   * deeper layer of an existing block through the governed dispatcher, then announce
   * `surface.explanation.expanded` — the typed modification the fold applies to the block.
   * Spec: spec/surface/cognitive-surface-runtime.md §6.1 step 3.
   */
  async expand(blockId: string, layer: number): Promise<Result<CognitionBlock, CosError>> {
    if (!this.surfaceId) return err(sessionError("surface session not started"));
    if (this.closed) return err(sessionError("surface session is closed"));
    const dispatcher = this.deps.explanationDispatcher;
    if (!dispatcher) {
      return err(sessionError("expand() requires an explanationDispatcher", { blockId }));
    }
    const state = this.state();
    const block = state?.blocks.find((b) => b.block_id === blockId);
    if (!block) return err(sessionError("block not found on this surface", { blockId }));

    const dispatched = await dispatcher.dispatch({
      session: this.deps.session,
      targetAgentId: "explanation",
      intent: `expand: ${block.title}`,
      conceptIds: block.concept_ids,
      content: { layer, block_id: blockId },
      maxTimeSeconds: 30,
    });
    if (!dispatched.ok) return dispatched;
    const response = dispatched.value.responsePackets[0];
    const responseContent = (response?.content ?? {}) as Record<string, unknown>;
    const layers = (responseContent["layers"] as Record<string, unknown> | undefined) ?? {};
    const summary = responseContent["summary"];

    await this.emit("surface.explanation.expanded", {
      surface_id: this.surfaceId,
      block_id: blockId,
      layer,
      layers,
      ...(typeof summary === "string" ? { summary } : {}),
      packet_id: dispatched.value.packet.packet_id,
      agent_id: "explanation",
    });

    const expanded = this.state()?.blocks.find((b) => b.block_id === blockId);
    if (!expanded) return err(sessionError("block disappeared after expansion", { blockId }));
    return ok(expanded);
  }

  /** Close the surface. State first, then the terminal event. */
  async close(reason = "session-ended"): Promise<Result<void, CosError>> {
    if (!this.surfaceId) return err(sessionError("surface session not started"));
    if (this.closed) return ok(undefined);
    const setStatus = this.world.apply({
      kind: "set_node_prop",
      id: `surface:${this.surfaceId}`,
      key: "status",
      value: "closed",
    });
    if (!setStatus.ok) return setStatus;
    this.closed = true;
    await this.emit("surface.session.closed", {
      surface_id: this.surfaceId,
      block_count: this.state()?.blocks.length ?? 0,
      reason,
    });
    return ok(undefined);
  }

  /**
   * The current surface state — a pure fold over the replayed `surface.*` event log.
   * There is no other state store; replay IS the state path.
   */
  state(): SurfaceState | null {
    if (!this.surfaceId) return null;
    return foldSurfaceEvents(this.surfaceEvents(), this.surfaceId);
  }

  /** Full provenance chain for one visible artifact. */
  trace(blockId: string): Result<BlockTrace, CosError> {
    const state = this.state();
    if (!state) return err(sessionError("surface session not started"));
    return traceBlock(state, this.world, this.surfaceEvents(), blockId);
  }

  private surfaceEvents(): readonly CognitiveEvent[] {
    return this.bus.replay({ subject: "surface.>" });
  }

  private async emit(eventType: string, payload: Record<string, unknown>): Promise<void> {
    const created = createEvent(
      {
        eventType,
        producerCid: this.deps.session.learnerIdentity.cid,
        producerType: "product.surface",
        payload,
        topic: `cos.${eventType}`,
        classification: "internal",
      },
      { clock: this.clock, hlc: this.hlc, idGenerator: this.idGenerator },
    );
    this.hlc = created.hlc;
    await this.bus.publish(created.event);
  }
}
