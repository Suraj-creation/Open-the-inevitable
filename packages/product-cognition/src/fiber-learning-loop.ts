/**
 * FiberedLearningLoop — a multi-step learning cycle expressed as a deterministic FiberRoutine.
 *
 * The ExecutionEngine drives the routine cooperatively, producing an append-only execution
 * journal that is byte-identical across replays given the same clock and id-generator (D2).
 *
 * The fiber communicates with the async dispatch layer through an emit/await/resolve bridge:
 * - The fiber `emit`s a bridge event carrying a `token` and payload.
 * - The engine's sink intercepts bridge events, performs the async work, and calls
 *   `engine.resolve(token, result)`.
 * - The fiber `awaitValue`s the token to receive the result.
 *
 * This makes the learning cycle phases (supervisor routing → explanation → practice → mastery)
 * fully traceable in the journal and separates orchestration logic from async dispatch mechanics.
 *
 * Spec: spec/product/product-cognition-runtime.md §9, spec/execution/cognitive-execution-engine.md.
 */
import { createEvent, type EventBus } from "@inevitable/events";
import {
  ExecutionEngine,
  type ExecutionJournalEntry,
  type FiberRoutine,
} from "@inevitable/execution";
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

import type { ConceptSeed, LearningPathProjection, LearningPathProjector } from "./learning-path";
import type { LearningLoopMasteryInput } from "./learning-loop";
import type { MasteryCheckpoint, MasteryCheckpointRecorder } from "./mastery";
import type { ProductDispatchResult, ProductRuntimeDispatcher } from "./runtime-dispatch";
import type { SupervisorRoutingDecision } from "./supervisor";
import type { OnboardingSession } from "./types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface FiberedLearningLoopDeps {
  readonly learningPaths: LearningPathProjector;
  /** Dispatcher bound to the supervisor agent. */
  readonly supervisorDispatcher: ProductRuntimeDispatcher;
  readonly dispatchers: {
    readonly explanation: ProductRuntimeDispatcher;
    readonly practice: ProductRuntimeDispatcher;
  };
  readonly mastery: MasteryCheckpointRecorder;
  /** World-state graph for phase-tracking writes after each dispatch. */
  readonly world: WorldStateGraph;
  readonly bus: EventBus;
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
  readonly nodeId?: string;
}

export interface FiberedLearningLoopInput {
  readonly session: OnboardingSession;
  readonly pathId: string;
  readonly concepts: readonly ConceptSeed[];
  readonly focusConceptId: string;
  readonly explanationPrompt: string;
  readonly practicePrompt: string;
  readonly mastery: LearningLoopMasteryInput;
}

export interface FiberedLearningLoopResult {
  readonly path: LearningPathProjection;
  readonly routing: SupervisorRoutingDecision;
  readonly explanation: ProductDispatchResult | null;
  readonly practice: ProductDispatchResult | null;
  readonly mastery: MasteryCheckpoint | null;
  /** Deterministic execution journal — the D2-replayable record of each phase. */
  readonly journal: readonly ExecutionJournalEntry[];
}

// ---------------------------------------------------------------------------
// Bridge event payload types (internal to this module)
// ---------------------------------------------------------------------------

interface SupervisorRoutingRequest {
  token: string;
  conceptId: string;
  learnerUserId: string;
}

interface DispatchRequest {
  token: string;
  agentId: "explanation" | "practice";
  intent: string;
  conceptIds: string[];
}

interface MasteryRecordRequest {
  token: string;
  conceptId: string;
  mastery: LearningLoopMasteryInput;
}

// ---------------------------------------------------------------------------
// Fiber routine factory
// ---------------------------------------------------------------------------

/**
 * Mutable HLC reference shared by the fiber event factory closure.
 * The factory must advance the HLC on every event to preserve monotonicity.
 */
interface HlcRef {
  value: Hlc;
}

/**
 * Build a factory that creates well-formed `CognitiveEvent` objects with advancing HLC.
 * Used inside the fiber routine so bridge events carry deterministic IDs and timestamps.
 */
function makeEventFactory(
  producerCid: string,
  clock: Clock,
  idGenerator: IdGenerator,
  hlcRef: HlcRef,
): (eventType: string, payload: Record<string, unknown>) => CognitiveEvent {
  return function createFiberEvent(
    eventType: string,
    payload: Record<string, unknown>,
  ): CognitiveEvent {
    const result = createEvent(
      {
        eventType,
        producerCid,
        producerType: "product.fiber-loop",
        payload,
        topic: `cos.${eventType}`,
        classification: "internal",
      },
      { clock, hlc: hlcRef.value, idGenerator },
    );
    hlcRef.value = result.hlc;
    return result.event;
  };
}

/**
 * Build the `FiberRoutine` for one learning cycle iteration.
 *
 * The routine yields `reason()` effects at each logical phase (stamped in the journal) and
 * `emit()`/`awaitValue()` effects to bridge async dispatches. It does NOT directly call any
 * async functions — all external work is triggered via bridge events and token resolution.
 */
function makeLearningCycleRoutine(
  input: FiberedLearningLoopInput,
  makeEvent: (type: string, payload: Record<string, unknown>) => CognitiveEvent,
): FiberRoutine<void> {
  return function* (ctx) {
    const userId = input.session.intentLease.owner_user_id;

    // --- Phase 1: supervisor routing ---
    yield* ctx.reason("phase:supervisor-routing", input.focusConceptId);
    const supervisorToken = `supervisor:${ctx.fiberId}`;
    yield* ctx.emit(
      makeEvent("learning.fiber.supervisor.routing.requested", {
        token: supervisorToken,
        conceptId: input.focusConceptId,
        learnerUserId: userId,
      }),
    );
    const routing = yield* ctx.awaitValue<SupervisorRoutingDecision>(supervisorToken);
    yield* ctx.reason(`phase:routing-decided:${routing.targetAgent}`, routing.reason);

    // Early exit for terminal states
    if (routing.targetAgent === "complete" || routing.targetAgent === "revision") {
      yield* ctx.reason("phase:early-exit", routing.targetAgent);
      return;
    }

    // --- Phase 2: explanation dispatch ---
    yield* ctx.reason("phase:explanation-dispatch", input.focusConceptId);
    const explanationToken = `explanation:${ctx.fiberId}`;
    yield* ctx.emit(
      makeEvent("learning.fiber.dispatch.requested", {
        token: explanationToken,
        agentId: "explanation",
        intent: input.explanationPrompt,
        conceptIds: [input.focusConceptId],
      }),
    );
    yield* ctx.awaitValue<ProductDispatchResult | null>(explanationToken);
    yield* ctx.reason("phase:explanation-done");

    // --- Phase 3: practice dispatch ---
    yield* ctx.reason("phase:practice-dispatch", input.focusConceptId);
    const practiceToken = `practice:${ctx.fiberId}`;
    yield* ctx.emit(
      makeEvent("learning.fiber.dispatch.requested", {
        token: practiceToken,
        agentId: "practice",
        intent: input.practicePrompt,
        conceptIds: [input.focusConceptId],
      }),
    );
    yield* ctx.awaitValue<ProductDispatchResult | null>(practiceToken);
    yield* ctx.reason("phase:practice-done");

    // --- Phase 4: mastery recording ---
    yield* ctx.reason("phase:mastery-record", input.focusConceptId);
    const masteryToken = `mastery:${ctx.fiberId}`;
    yield* ctx.emit(
      makeEvent("learning.fiber.mastery.record.requested", {
        token: masteryToken,
        conceptId: input.focusConceptId,
        mastery: input.mastery,
      }),
    );
    yield* ctx.awaitValue<MasteryCheckpoint | null>(masteryToken);

    yield* ctx.reason("phase:cycle-complete");
  };
}

// ---------------------------------------------------------------------------
// FiberedLearningLoop
// ---------------------------------------------------------------------------

export class FiberedLearningLoop {
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;

  constructor(private readonly deps: FiberedLearningLoopDeps) {
    this.clock = deps.clock ?? new SystemClock();
    this.idGenerator = deps.idGenerator ?? new CryptoIdGenerator();
  }

  async run(input: FiberedLearningLoopInput): Promise<Result<FiberedLearningLoopResult, CosError>> {
    // Project the learning path first (sync). This populates the world-state concept nodes that
    // the supervisor and phase-tracking writes depend on.
    const pathResult = this.deps.learningPaths.project({
      pathId: input.pathId,
      ownerUserId: input.session.intentLease.owner_user_id,
      concepts: input.concepts,
    });
    if (!pathResult.ok) return pathResult;

    // Accumulated results from the async bridge handlers.
    const results = new Map<string, unknown>();

    // HLC shared by the fiber event factory — must be mutable so it advances.
    const hlcRef: HlcRef = { value: hlcInit(this.deps.nodeId ?? "fiber-learning-loop") };
    const makeEvent = makeEventFactory(
      input.session.learnerIdentity.cid,
      this.clock,
      this.idGenerator,
      hlcRef,
    );

    // Build the engine. The sink is the async bridge: it intercepts bridge events,
    // performs the async work, and resolves the token so the fiber can continue.
    // Note: `engine` is captured by reference inside the sink closure; it is safe to use `const`
    // here because the closure is only invoked during runToQuiescence(), well after assignment.
    const engine = new ExecutionEngine({
      clock: this.clock,
      idGenerator: this.idGenerator,
      engineId: this.deps.nodeId ?? "fiber-learning-loop",
      sink: async (event: CognitiveEvent) => {
        // Publish all fiber events to the bus for observability.
        await this.deps.bus.publish(event);
        // Route bridge events to their async handlers.
        await this.handleBridgeEvent(engine, event, results, input);
      },
    });

    const routine = makeLearningCycleRoutine(input, makeEvent);
    const fiberId = engine.submit(routine, {
      priority: 3,
      label: `learning-cycle:${input.focusConceptId}`,
    });

    await engine.runToQuiescence();

    const view = engine.view(fiberId);
    if (view?.status === "failed") {
      return err(
        new CosError("E_PRODUCT_FIBER_LEARNING_LOOP", `fiber failed: ${view.error ?? "unknown"}`, {
          specRef: "spec/product/product-cognition-runtime.md",
          details: { fiberId, fiberError: view.error },
        }),
      );
    }

    // Assemble the result from the accumulated bridge results.
    const routing = results.get(`supervisor:${fiberId}`) as SupervisorRoutingDecision | undefined;
    const explanation =
      (results.get(`explanation:${fiberId}`) as ProductDispatchResult | null | undefined) ?? null;
    const practice =
      (results.get(`practice:${fiberId}`) as ProductDispatchResult | null | undefined) ?? null;
    const mastery =
      (results.get(`mastery:${fiberId}`) as MasteryCheckpoint | null | undefined) ?? null;

    if (!routing) {
      return err(
        new CosError(
          "E_PRODUCT_FIBER_LEARNING_LOOP",
          "supervisor routing result missing from fiber run",
          {
            specRef: "spec/product/product-cognition-runtime.md",
          },
        ),
      );
    }

    // Emit the supervisor.route event for observability (spec §7).
    await this.emitSupervisorRoute(routing, input.session, makeEvent);

    return ok({
      path: pathResult.value,
      routing,
      explanation,
      practice,
      mastery,
      journal: engine.journal,
    });
  }

  // ---------------------------------------------------------------------------
  // Bridge event handlers
  // ---------------------------------------------------------------------------

  private async handleBridgeEvent(
    engine: ExecutionEngine,
    event: CognitiveEvent,
    results: Map<string, unknown>,
    input: FiberedLearningLoopInput,
  ): Promise<void> {
    switch (event.event_type) {
      case "learning.fiber.supervisor.routing.requested":
        await this.handleSupervisorRouting(engine, event, results, input);
        return;
      case "learning.fiber.dispatch.requested":
        await this.handleDispatch(engine, event, results, input);
        return;
      case "learning.fiber.mastery.record.requested":
        await this.handleMasteryRecord(engine, event, results, input);
        return;
    }
  }

  private async handleSupervisorRouting(
    engine: ExecutionEngine,
    event: CognitiveEvent,
    results: Map<string, unknown>,
    input: FiberedLearningLoopInput,
  ): Promise<void> {
    const { token, conceptId, learnerUserId } = event.payload as SupervisorRoutingRequest;
    const result = await this.deps.supervisorDispatcher.dispatch({
      session: input.session,
      targetAgentId: "supervisor",
      intent: "route",
      conceptIds: [conceptId],
      content: { learnerUserId },
      priority: 1,
    });
    const decision: SupervisorRoutingDecision = result.ok
      ? (((result.value.responsePackets[0]?.content as Record<string, unknown> | undefined)?.[
          "routing_decision"
        ] as SupervisorRoutingDecision | undefined) ?? {
          targetAgent: "explanation",
          reason: "supervisor did not embed routing_decision in response",
          conceptId,
        })
      : {
          targetAgent: "explanation",
          reason: `supervisor dispatch failed: ${result.error.message}`,
          conceptId,
        };
    results.set(token, decision);
    engine.resolve(token, decision);
  }

  private async handleDispatch(
    engine: ExecutionEngine,
    event: CognitiveEvent,
    results: Map<string, unknown>,
    input: FiberedLearningLoopInput,
  ): Promise<void> {
    const { token, agentId, intent, conceptIds } = event.payload as DispatchRequest;
    const dispatcher = this.deps.dispatchers[agentId];
    if (!dispatcher) {
      results.set(token, null);
      engine.resolve(token, null);
      return;
    }
    const result = await dispatcher.dispatch({
      session: input.session,
      targetAgentId: agentId,
      intent,
      conceptIds,
      priority: 3,
    });
    const dispatchResult = result.ok ? result.value : null;
    results.set(token, dispatchResult);

    // Write phase-tracking prop to world-state so the supervisor can see it on future routing requests.
    if (result.ok && conceptIds[0]) {
      this.trackPhase(agentId, conceptIds[0], input.session.intentLease.owner_user_id);
    }

    engine.resolve(token, dispatchResult);
  }

  private async handleMasteryRecord(
    engine: ExecutionEngine,
    event: CognitiveEvent,
    results: Map<string, unknown>,
    input: FiberedLearningLoopInput,
  ): Promise<void> {
    const { token, conceptId, mastery: masteryInput } = event.payload as MasteryRecordRequest;
    try {
      const checkpoint = await this.deps.mastery.record({
        ownerUserId: input.session.intentLease.owner_user_id,
        conceptId,
        assessorCid: masteryInput.assessorCid,
        passed: masteryInput.passed,
        confidence: masteryInput.confidence,
        evidence: masteryInput.evidence,
      });
      results.set(token, checkpoint);
      engine.resolve(token, checkpoint);
    } catch {
      results.set(token, null);
      engine.resolve(token, null);
    }
  }

  // ---------------------------------------------------------------------------
  // Phase-tracking world-state write
  // ---------------------------------------------------------------------------

  /**
   * After a successful dispatch, stamp the concept node with a phase-tracking prop so the
   * supervisor can read it on the next routing request.
   * Spec: spec/product/product-cognition-runtime.md §7 "Phase Tracking".
   */
  private trackPhase(agentId: "explanation" | "practice", conceptId: string, userId: string): void {
    const nodeId = `concept:${conceptId}`;
    if (!this.deps.world.getNode(nodeId)) return;
    const key =
      agentId === "explanation"
        ? `explanation_dispatched:${userId}`
        : `practice_dispatched:${userId}`;
    this.deps.world.apply({ kind: "set_node_prop", id: nodeId, key, value: true });
  }

  // ---------------------------------------------------------------------------
  // Supervisor route event emission
  // ---------------------------------------------------------------------------

  private async emitSupervisorRoute(
    decision: SupervisorRoutingDecision,
    session: OnboardingSession,
    makeEvent: (type: string, payload: Record<string, unknown>) => CognitiveEvent,
  ): Promise<void> {
    const event = makeEvent("supervisor.route", {
      target_agent: decision.targetAgent,
      concept_id: decision.conceptId,
      reason: decision.reason,
      producer_cid: session.learnerIdentity.cid,
      session_id: session.intentLease.intent_id,
    });
    await this.deps.bus.publish(event);
  }
}
