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
import { assertWorldStateOk } from "./types";

export interface MasteryCheckpointInput {
  readonly ownerUserId: string;
  readonly conceptId: string;
  readonly assessorCid: string;
  readonly passed: boolean;
  readonly confidence: number;
  readonly evidence: readonly Record<string, unknown>[];
}

export interface MasteryCheckpoint {
  readonly checkpointNodeId: string;
  readonly conceptNodeId: string;
  readonly mutationId: string;
}

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
            passed: input.passed,
            confidence: input.confidence,
            evidence: input.evidence,
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
          type: input.passed ? "verifies_mastery_of" : "rejects_mastery_of",
          props: { confidence: input.confidence },
        },
        { proposerCid: input.assessorCid },
      ),
    );

    const mutation: MemoryMutation = {
      mutation_id: newMutationId(this.idGenerator),
      proposer_cid: input.assessorCid,
      memory_layer: "semantic",
      mutation_type: input.passed ? "reinforce_concept" : "revise_fact",
      target: { id: checkpointNodeId, conceptId: input.conceptId },
      payload: {
        ownerUserId: input.ownerUserId,
        conceptId: input.conceptId,
        passed: input.passed,
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
      passed: input.passed,
      confidence: input.confidence,
      mutation_id: mutationId,
    });
    await this.emit(input.passed ? "mastery.verified" : "mastery.rejected", input.assessorCid, {
      checkpoint_node_id: checkpointNodeId,
      concept_id: input.conceptId,
      confidence: input.confidence,
    });

    return { checkpointNodeId, conceptNodeId, mutationId };
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
