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
import type { ProposalBlackboard } from "@inevitable/orchestration";
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
import type {
  ProductDispatchResult,
  ProductRuntimeAgentId,
  ProductRuntimeDispatcher,
} from "./runtime-dispatch";
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
  /**
   * Optional challenger dispatcher (P4.1 — multi-agent blackboard arbitration, ADR-0018). When
   * present, the explanation phase runs a concurrent challenger dispatch (`agent.revision`) and
   * emits `surface.agent.disagreed` when the layer_0 outputs diverge (Jaccard < 0.3).
   */
  readonly challengerDispatcher?: ProductRuntimeDispatcher;
  /**
   * Optional proposal blackboard (P4.1). When present, explanation and challenger proposals are
   * written; arbitration is recorded after disagreement detection.
   */
  readonly proposals?: ProposalBlackboard;
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
  /**
   * Assembled working-memory context items from P2.4 context-lease-bounded retrieval.
   * When present, threaded into the explanation dispatch content so the model can build on
   * what the learner already knows (ADR-0016). Plain {text, score} to avoid cross-package deps.
   */
  readonly assembledContextItems?: ReadonlyArray<{ readonly text: string; readonly score: number }>;
  /**
   * Surface ID for emitting `surface.agent.disagreed` (P4.1, ADR-0018). When present, the
   * disagreement event payload includes `surface_id` so the surface fold picks it up. When
   * absent (CLI demo, unit tests), the event is on the bus but matches no surface fold.
   */
  readonly surfaceId?: string;
  /**
   * Cooperative interrupt (S1.3, ADR-0024). Checked at each phase boundary; when it returns true
   * the cycle early-exits (recorded as `phase:interrupted`). Live-only — replay re-folds the
   * recorded surface events and never re-runs the loop, so determinism is preserved.
   */
  readonly isInterrupted?: () => boolean;
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

    // Cooperative interrupt (S1.3, ADR-0024): the learner cancelled before explanation.
    if (input.isInterrupted?.()) {
      yield* ctx.reason("phase:interrupted", "explanation");
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

    // Cooperative interrupt (S1.3): the learner cancelled before practice.
    if (input.isInterrupted?.()) {
      yield* ctx.reason("phase:interrupted", "practice");
      return;
    }

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
  /** Separate HLC for bridge-layer events (emitted outside the fiber journal, P4.1 ADR-0018 D5). */
  private orchestrationHlc: Hlc;

  constructor(private readonly deps: FiberedLearningLoopDeps) {
    this.clock = deps.clock ?? new SystemClock();
    this.idGenerator = deps.idGenerator ?? new CryptoIdGenerator();
    this.orchestrationHlc = hlcInit(deps.nodeId ?? "fiber-orchestration");
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

    const assembledContent =
      agentId === "explanation" && input.assembledContextItems?.length
        ? { content: { assembled_context_items: input.assembledContextItems } }
        : {};

    // S1.2 — Cognitive Ensemble (ADR-0025). Explanation + a genuine challenger/Socratic peer run
    // concurrently as a *visible* ensemble: each publishes a proposal (surface.proposal.proposed),
    // presence reflects parallel thinking, and the arbiter records a synthesis
    // (surface.synthesis.recorded). The primary explanation remains the authoritative surfaced
    // result, so determinism and replay are unchanged; the challenger is now a surfaced peer, not a
    // discarded probe. Members iterate in a fixed order so id/HLC advance deterministically.
    if (agentId === "explanation" && this.deps.challengerDispatcher) {
      const learnerCid = input.session.learnerIdentity.cid;
      const proposalKey = `explanation:${conceptIds[0] ?? "unknown"}`;
      const members: ReadonlyArray<{
        readonly agentId: ProductRuntimeAgentId;
        readonly agentCid: string;
        readonly role: string;
        readonly dispatcher: ProductRuntimeDispatcher;
        readonly extra: Record<string, unknown>;
      }> = [
        {
          agentId: "explanation",
          agentCid: learnerCid,
          role: "explainer",
          dispatcher,
          extra: assembledContent,
        },
        {
          agentId: "revision",
          agentCid: "challenger",
          role: "challenger",
          dispatcher: this.deps.challengerDispatcher,
          extra: {},
        },
      ];

      // Presence: every member is thinking in parallel — visible parallel cognition.
      for (const m of members) {
        await this.emitPresence(input, m.agentCid, m.agentId, m.role, "thinking");
      }

      const startedMs = this.clock.nowMs();
      const settled = await Promise.all(
        members.map((m) =>
          m.dispatcher.dispatch({
            session: input.session,
            targetAgentId: m.agentId,
            intent,
            conceptIds,
            ...m.extra,
            priority: 3,
          }),
        ),
      );
      const completedMs = this.clock.nowMs();

      // Publish each proposal + presence in fixed member order (deterministic id/HLC advance).
      const chosenProposalIds: string[] = [];
      for (let i = 0; i < members.length; i += 1) {
        const m = members[i];
        const r = settled[i];
        if (!m || !r) continue;
        if (r.ok) {
          if (this.deps.proposals) this.deps.proposals.propose(proposalKey, m.agentCid, r.value);
          const proposalId = await this.emitProposal(input, proposalKey, m, r.value);
          if (m.agentId === "explanation") chosenProposalIds.unshift(proposalId);
          await this.emitPresence(input, m.agentCid, m.agentId, m.role, "contributing");
          // S-UCS: surface each ensemble member's latency + reasoning summary (ADR-0029).
          await this.emitAgentWork(input, m.agentId, r.value, startedMs, completedMs, m.agentCid);
        } else {
          await this.emitPresence(input, m.agentCid, m.agentId, m.role, "idle");
        }
      }

      const primaryResult = settled[0];
      const challengerResult = settled[1];
      const disagree = Boolean(
        primaryResult?.ok &&
        challengerResult?.ok &&
        this.outputsDisagree(primaryResult.value, challengerResult.value),
      );
      if (disagree) {
        await this.emitDisagreement(input, proposalKey, conceptIds[0] ?? "unknown");
        if (this.deps.proposals) {
          this.deps.proposals.arbitrate(proposalKey, learnerCid, "primary explanation selected");
        }
      }

      // Arbiter synthesis: the primary explanation is the surfaced result; record the rationale.
      if (primaryResult?.ok) {
        await this.emitSynthesis(
          input,
          proposalKey,
          chosenProposalIds,
          disagree
            ? "primary explanation selected over divergent challenger"
            : "primary explanation selected; challenger concurred",
        );
      }

      const dispatchResult = primaryResult?.ok ? primaryResult.value : null;
      results.set(token, dispatchResult);
      if (primaryResult?.ok && conceptIds[0]) {
        this.trackPhase(agentId, conceptIds[0], input.session.intentLease.owner_user_id);
      }
      engine.resolve(token, dispatchResult);
      return;
    }

    // Standard single-agent dispatch.
    const startedMs = this.clock.nowMs();
    const result = await dispatcher.dispatch({
      session: input.session,
      targetAgentId: agentId,
      intent,
      conceptIds,
      // Thread assembled context into explanation dispatch (ADR-0016): the explanation unit reads
      // assembled_context_items from packet.content to build adaptive prompts grounded in prior knowledge.
      ...assembledContent,
      priority: 3,
    });
    const completedMs = this.clock.nowMs();
    const dispatchResult = result.ok ? result.value : null;
    results.set(token, dispatchResult);

    // Write phase-tracking prop to world-state so the supervisor can see it on future routing requests.
    if (result.ok && conceptIds[0]) {
      this.trackPhase(agentId, conceptIds[0], input.session.intentLease.owner_user_id);
    }
    // S-UCS: surface this agent's latency + reasoning summary for the Observatory (ADR-0029).
    if (result.ok) {
      await this.emitAgentWork(input, agentId, result.value, startedMs, completedMs);
    }

    engine.resolve(token, dispatchResult);
  }

  // ---------------------------------------------------------------------------
  // P4.1 — disagreement detection helpers (ADR-0018 D4)
  // ---------------------------------------------------------------------------

  private outputsDisagree(a: ProductDispatchResult, b: ProductDispatchResult): boolean {
    const aText = this.extractLayer0(a);
    const bText = this.extractLayer0(b);
    if (!aText || !bText) return false;
    return this.jaccardSimilarity(this.wordSet(aText), this.wordSet(bText)) < 0.3;
  }

  private extractLayer0(result: ProductDispatchResult): string | undefined {
    const content = result.responsePackets[0]?.content as Record<string, unknown> | undefined;
    const layers = content?.["layers"] as Record<string, unknown> | undefined;
    return layers?.["layer_0"] as string | undefined;
  }

  private wordSet(text: string): Set<string> {
    return new Set(text.toLowerCase().split(/\W+/).filter(Boolean));
  }

  private jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 1;
    let intersection = 0;
    for (const word of a) {
      if (b.has(word)) intersection += 1;
    }
    const union = a.size + b.size - intersection;
    return union === 0 ? 1 : intersection / union;
  }

  /** Publish a `surface.*` orchestration event stamped with the surface_id (when present). */
  private async emitSurface(
    input: FiberedLearningLoopInput,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const created = createEvent(
      {
        eventType,
        producerCid: input.session.learnerIdentity.cid,
        producerType: "product.orchestration",
        payload: { ...(input.surfaceId ? { surface_id: input.surfaceId } : {}), ...payload },
        topic: `cos.${eventType}`,
        classification: "internal",
      },
      { clock: this.clock, hlc: this.orchestrationHlc, idGenerator: this.idGenerator },
    );
    this.orchestrationHlc = created.hlc;
    await this.deps.bus.publish(created.event);
  }

  private async emitDisagreement(
    input: FiberedLearningLoopInput,
    topic: string,
    conceptId: string,
  ): Promise<void> {
    await this.emitSurface(input, "surface.agent.disagreed", {
      agent_cids: [input.session.learnerIdentity.cid, "challenger"],
      topic,
      concept_id: conceptId,
      resolution: { winner: "explanation", reason: "primary explanation selected" },
    });
  }

  /** Surface an ensemble agent's presence transition (thinking/contributing/idle). */
  private async emitPresence(
    input: FiberedLearningLoopInput,
    agentCid: string,
    agentId: string,
    role: string,
    state: "idle" | "thinking" | "contributing" | "speaking",
  ): Promise<void> {
    await this.emitSurface(input, "surface.presence.updated", {
      agent_cid: agentCid,
      agent_id: agentId,
      role,
      state,
    });
  }

  /** Surface an ensemble proposal (competing cognition made visible). Returns the proposal id. */
  private async emitProposal(
    input: FiberedLearningLoopInput,
    topic: string,
    member: { readonly agentId: string; readonly agentCid: string },
    result: ProductDispatchResult,
  ): Promise<string> {
    const proposalId = `pr-${this.idGenerator.hex(8)}`;
    await this.emitSurface(input, "surface.proposal.proposed", {
      proposal_id: proposalId,
      agent_cid: member.agentCid,
      agent_id: member.agentId,
      topic,
      summary: this.summarize(result),
      confidence: this.confidenceOf(result),
    });
    return proposalId;
  }

  /** Surface the arbiter's synthesis over the topic's proposals. */
  private async emitSynthesis(
    input: FiberedLearningLoopInput,
    topic: string,
    chosenProposalIds: readonly string[],
    rationale: string,
  ): Promise<void> {
    await this.emitSurface(input, "surface.synthesis.recorded", {
      topic,
      chosen_proposal_ids: chosenProposalIds,
      block_ids: [],
      rationale,
      producer_cid: input.session.learnerIdentity.cid,
    });
  }

  /**
   * Surface an agent's work timing (real latency) and reasoning summary for the Agent Observatory
   * (S-UCS, ADR-0029). Latency is real-clock — deterministic per event log, excluded from canonical
   * block content. The reasoning summary is a structured projection of the unit's ReasoningTrace
   * (task interpretation, strategy, decision, self-critique — never raw private memory).
   */
  private async emitAgentWork(
    input: FiberedLearningLoopInput,
    agentId: string,
    result: ProductDispatchResult,
    startedMs: number,
    completedMs: number,
    agentCid?: string,
  ): Promise<void> {
    const cid =
      agentCid ?? result.responsePackets[0]?.source_cid ?? input.session.learnerIdentity.cid;
    await this.emitSurface(input, "surface.agent.work.timing", {
      agent_cid: cid,
      agent_id: agentId,
      work_id: result.workItem.work_id,
      packet_id: result.packet.packet_id,
      work_type: result.workItem.work_type,
      status: "completed",
      queue_wait_ms: 0,
      execution_ms: Math.max(0, completedMs - startedMs),
    });
    const trace = result.emissions.trace;
    if (trace) {
      await this.emitSurface(input, "surface.agent.reasoning.summary", {
        agent_cid: cid,
        agent_id: agentId,
        packet_id: result.packet.packet_id,
        work_id: result.workItem.work_id,
        task_interpretation: trace.task_interpretation,
        strategy: trace.strategy,
        decision: trace.decision,
        self_critique: trace.self_critique ?? null,
        confidence: trace.claims?.[0]?.confidence ?? this.confidenceOf(result),
        determinism_level: trace.determinism_level ?? "D3",
      });
    }
  }

  /** A short human-readable summary of a proposal (layer_0 text, else content.summary). */
  private summarize(result: ProductDispatchResult): string {
    const layer0 = this.extractLayer0(result);
    if (layer0) return layer0.slice(0, 280);
    const content = result.responsePackets[0]?.content as Record<string, unknown> | undefined;
    const summary = content?.["summary"];
    return typeof summary === "string" ? summary.slice(0, 280) : "";
  }

  private confidenceOf(result: ProductDispatchResult): number {
    const pkt = result.responsePackets[0];
    return pkt && typeof pkt.confidence === "number" ? pkt.confidence : 0.5;
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
        ...(masteryInput.depthTests ? { depthTests: masteryInput.depthTests } : {}),
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
