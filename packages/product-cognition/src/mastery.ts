import { createEvent, type EventBus } from "@inevitable/events";
import { type MemoryMutation, type TieredMemoryStore } from "@inevitable/memory";
import {
  CryptoIdGenerator,
  type Clock,
  type Hlc,
  type IdGenerator,
  SystemClock,
  hlcInit,
  newMutationId,
} from "@inevitable/shared";
import type { WorldStateGraph } from "@inevitable/world-state";
import type { DepthTestResult } from "./learning-loop";
import { assertWorldStateOk } from "./types";

export interface MasteryCheckpointInput {
  readonly ownerUserId: string;
  readonly conceptId: string;
  readonly assessorCid: string;
  readonly passed: boolean;
  readonly confidence: number;
  readonly evidence: readonly Record<string, unknown>[];
  /** Five-test depth verification results (S2.2, F14). */
  readonly depthTests?: readonly DepthTestResult[];
}

/** The depth-gate outcome recorded alongside a mastery checkpoint (S2.2, F14). */
export interface DepthGateOutcome {
  readonly passed: boolean;
  readonly passedCount: number;
  readonly totalCount: number;
  readonly tests: readonly DepthTestResult[];
}

export interface MasteryCheckpoint {
  readonly checkpointNodeId: string;
  readonly conceptNodeId: string;
  readonly mutationId: string;
  /** Present when depth tests were evaluated (S2.2, F14). */
  readonly depthGate?: DepthGateOutcome;
}

/** Minimum tests that must pass to clear the depth gate (4 of 5). */
const DEPTH_GATE_THRESHOLD = 4;

export interface MasteryCheckpointRecorderDeps {
  readonly world: WorldStateGraph;
  readonly memory: TieredMemoryStore;
  readonly bus: EventBus;
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
  readonly nodeId?: string;
}

export class MasteryCheckpointRecorder {
  private readonly world: WorldStateGraph;
  private readonly memory: TieredMemoryStore;
  private readonly bus: EventBus;
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;
  private hlc: Hlc;

  constructor(deps: MasteryCheckpointRecorderDeps) {
    this.world = deps.world;
    this.memory = deps.memory;
    this.bus = deps.bus;
    this.clock = deps.clock ?? new SystemClock();
    this.idGenerator = deps.idGenerator ?? new CryptoIdGenerator();
    this.hlc = hlcInit(deps.nodeId ?? "mastery-recorder");
  }

  async record(input: MasteryCheckpointInput): Promise<MasteryCheckpoint> {
    const conceptNodeId = `concept:${input.conceptId}`;
    const checkpointNodeId = `mastery:${input.ownerUserId}:${input.conceptId}:${this.idGenerator.hex(
      8,
    )}`;

    // Evaluate the five-test depth gate when tests are provided (S2.2, F14).
    // The gate overrides the caller's `passed` flag: ≥ DEPTH_GATE_THRESHOLD tests must pass.
    let depthGate: DepthGateOutcome | undefined;
    let gatePassed = input.passed;
    if (input.depthTests && input.depthTests.length > 0) {
      const passedCount = input.depthTests.filter((t) => t.passed).length;
      gatePassed = passedCount >= DEPTH_GATE_THRESHOLD;
      depthGate = {
        passed: gatePassed,
        passedCount,
        totalCount: input.depthTests.length,
        tests: input.depthTests,
      };
    }

    assertWorldStateOk(
      this.world.apply(
        {
          kind: "upsert_node",
          id: conceptNodeId,
          type: "concept",
          props: { conceptId: input.conceptId },
        },
        { proposerCid: input.assessorCid },
      ),
    );
    assertWorldStateOk(
      this.world.apply(
        {
          kind: "upsert_node",
          id: checkpointNodeId,
          type: "mastery_checkpoint",
          props: {
            ownerUserId: input.ownerUserId,
            conceptId: input.conceptId,
            assessorCid: input.assessorCid,
            passed: gatePassed,
            confidence: input.confidence,
            evidence: input.evidence,
            ...(depthGate
              ? {
                  depthGatePassed: depthGate.passed,
                  depthGatePassedCount: depthGate.passedCount,
                  depthGateTotalCount: depthGate.totalCount,
                }
              : {}),
          },
        },
        { proposerCid: input.assessorCid },
      ),
    );
    assertWorldStateOk(
      this.world.apply(
        {
          kind: "upsert_edge",
          id: `edge:${checkpointNodeId}:assesses:${conceptNodeId}`,
          from: checkpointNodeId,
          to: conceptNodeId,
          type: gatePassed ? "verifies_mastery_of" : "rejects_mastery_of",
          props: { confidence: input.confidence },
        },
        { proposerCid: input.assessorCid },
      ),
    );

    const mutation: MemoryMutation = {
      mutation_id: newMutationId(this.idGenerator),
      proposer_cid: input.assessorCid,
      memory_layer: "semantic",
      mutation_type: gatePassed ? "reinforce_concept" : "revise_fact",
      target: { id: checkpointNodeId, conceptId: input.conceptId },
      payload: {
        ownerUserId: input.ownerUserId,
        conceptId: input.conceptId,
        passed: gatePassed,
        confidence: input.confidence,
      },
      evidence: [...input.evidence],
      confidence: input.confidence,
      reversible: true,
      classification: "internal",
    };
    const mutationId = assertWorldStateOk(this.memory.commit(mutation)) as string;

    await this.emit("mastery.checkpoint.created", input.assessorCid, {
      checkpoint_node_id: checkpointNodeId,
      concept_id: input.conceptId,
      passed: gatePassed,
      confidence: input.confidence,
      mutation_id: mutationId,
    });
    await this.emit(gatePassed ? "mastery.verified" : "mastery.rejected", input.assessorCid, {
      checkpoint_node_id: checkpointNodeId,
      concept_id: input.conceptId,
      confidence: input.confidence,
    });

    // Emit depth gate events when tests were evaluated (S2.2, F14).
    if (depthGate) {
      await this.emit(
        depthGate.passed ? "depth.gate.passed" : "depth.gate.failed",
        input.assessorCid,
        {
          concept_id: input.conceptId,
          checkpoint_node_id: checkpointNodeId,
          passed_count: depthGate.passedCount,
          total_count: depthGate.totalCount,
          threshold: DEPTH_GATE_THRESHOLD,
          tests: depthGate.tests.map((t) => ({
            kind: t.kind,
            passed: t.passed,
            confidence: t.confidence,
            evidence: t.evidence,
          })),
        },
      );
    }

    return { checkpointNodeId, conceptNodeId, mutationId, ...(depthGate ? { depthGate } : {}) };
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
        producerType: "agent.assessment",
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
