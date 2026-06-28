import { createEvent, type EventBus } from "@inevitable/events";
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
import type { ConceptSeed, LearningPathProjection, LearningPathProjector } from "./learning-path";
import type { MasteryCheckpoint, MasteryCheckpointRecorder } from "./mastery";
import type { OnboardingSession } from "./types";
import type { ProductDispatchResult, ProductRuntimeDispatcher } from "./runtime-dispatch";

export interface DeterministicLearningLoopDeps {
  readonly learningPaths: LearningPathProjector;
  readonly dispatchers: {
    readonly explanation: ProductRuntimeDispatcher;
    readonly practice: ProductRuntimeDispatcher;
  };
  readonly mastery: MasteryCheckpointRecorder;
  readonly bus: EventBus;
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
  readonly nodeId?: string;
}

/** The five dimensions of depth verification (F14, S2.2). */
export type DepthTestKind = "explanation" | "application" | "connection" | "teaching" | "edge_case";

/** One outcome from the five-test depth gate. */
export interface DepthTestResult {
  readonly kind: DepthTestKind;
  readonly passed: boolean;
  readonly confidence: number;
  /** Short evidence note (what the learner did/said that produced this result). */
  readonly evidence: string;
}

export interface LearningLoopMasteryInput {
  readonly assessorCid: string;
  readonly passed: boolean;
  readonly confidence: number;
  readonly evidence: readonly Record<string, unknown>[];
  /**
   * Five-test depth verification results (S2.2, F14). When present, the gate overrides `passed`:
   * the checkpoint is recorded as passed iff ≥ 4/5 tests pass.
   */
  readonly depthTests?: readonly DepthTestResult[];
}

export interface DeterministicLearningLoopInput {
  readonly session: OnboardingSession;
  readonly pathId: string;
  readonly concepts: readonly ConceptSeed[];
  readonly focusConceptId: string;
  readonly explanationPrompt: string;
  readonly practicePrompt: string;
  readonly mastery: LearningLoopMasteryInput;
}

export interface DeterministicLearningLoopResult {
  readonly path: LearningPathProjection;
  readonly explanation: ProductDispatchResult;
  readonly practice: ProductDispatchResult;
  readonly mastery: MasteryCheckpoint;
}

function loopError(message: string, details?: Record<string, unknown>): CosError {
  return new CosError("E_PRODUCT_LEARNING_LOOP", message, {
    specRef: "spec/product/product-cognition-runtime.md",
    details,
  });
}

export class DeterministicLearningLoop {
  private readonly learningPaths: LearningPathProjector;
  private readonly explanation: ProductRuntimeDispatcher;
  private readonly practice: ProductRuntimeDispatcher;
  private readonly mastery: MasteryCheckpointRecorder;
  private readonly bus: EventBus;
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;
  private hlc: Hlc;

  constructor(deps: DeterministicLearningLoopDeps) {
    this.learningPaths = deps.learningPaths;
    this.explanation = deps.dispatchers.explanation;
    this.practice = deps.dispatchers.practice;
    this.mastery = deps.mastery;
    this.bus = deps.bus;
    this.clock = deps.clock ?? new SystemClock();
    this.idGenerator = deps.idGenerator ?? new CryptoIdGenerator();
    this.hlc = hlcInit(deps.nodeId ?? "learning-loop");
  }

  async run(
    input: DeterministicLearningLoopInput,
  ): Promise<Result<DeterministicLearningLoopResult, CosError>> {
    await this.emit("learning.loop.started", input.session.learnerIdentity.cid, {
      path_id: input.pathId,
      focus_concept_id: input.focusConceptId,
      intent_id: input.session.intentLease.intent_id,
    });

    const path = this.learningPaths.project({
      pathId: input.pathId,
      ownerUserId: input.session.intentLease.owner_user_id,
      concepts: input.concepts,
    });
    if (!path.ok) return path;

    const explanation = await this.explanation.dispatch({
      session: input.session,
      targetAgentId: "explanation",
      intent: input.explanationPrompt,
      conceptIds: [input.focusConceptId],
      content: {
        pathId: input.pathId,
        focusConceptId: input.focusConceptId,
        phase: "explanation",
      },
      priority: 3,
    });
    if (!explanation.ok) return explanation;

    const practice = await this.practice.dispatch({
      session: input.session,
      targetAgentId: "practice",
      intent: input.practicePrompt,
      conceptIds: [input.focusConceptId],
      content: {
        pathId: input.pathId,
        focusConceptId: input.focusConceptId,
        phase: "practice",
        explanationPacketId: explanation.value.responsePackets[0]?.packet_id ?? null,
      },
      priority: 3,
    });
    if (!practice.ok) return practice;

    try {
      const mastery = await this.mastery.record({
        ownerUserId: input.session.intentLease.owner_user_id,
        conceptId: input.focusConceptId,
        assessorCid: input.mastery.assessorCid,
        passed: input.mastery.passed,
        confidence: input.mastery.confidence,
        evidence: input.mastery.evidence,
      });
      await this.emit("learning.loop.completed", input.session.learnerIdentity.cid, {
        path_id: input.pathId,
        focus_concept_id: input.focusConceptId,
        mastery_passed: input.mastery.passed,
        mastery_confidence: input.mastery.confidence,
        checkpoint_node_id: mastery.checkpointNodeId,
      });
      return ok({
        path: path.value,
        explanation: explanation.value,
        practice: practice.value,
        mastery,
      });
    } catch (cause) {
      return err(
        loopError("mastery recording failed during deterministic learning loop", {
          conceptId: input.focusConceptId,
          cause: cause instanceof Error ? cause.message : String(cause),
        }),
      );
    }
  }

  private async emit(
    eventType: string,
    producerCid: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const created = createEvent(
      {
        eventType,
        producerCid,
        producerType: "product.learning-loop",
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
