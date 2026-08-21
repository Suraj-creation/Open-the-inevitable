/**
 * The loop's typed Cognitive Events and the append-only log they live in. The event log is the
 * SOURCE OF TRUTH the loop reflects over and replays (10 §3 "Durable event log = source of truth";
 * metric C attribution). Events carry `causation_id` links so the whole chain — episode → compiled →
 * output → outcome → reflection → proposal → accepted — is reconstructable. In-memory here; the
 * Postgres transport (PostgresEventTransport) drops in at the L1.5 integrity gate.
 */
import { createEvent } from "@inevitable/events";
import type { CognitiveEvent } from "@inevitable/protocols";
import type { Clock, Hlc, IdGenerator } from "@inevitable/shared";
import { hlcInit } from "@inevitable/shared";

export const LOOP_EVENTS = {
  episodeStarted: "cognitive.episode.started",
  contextCompiled: "cognitive.context.compiled",
  outputProduced: "cognitive.output.produced",
  outcomeObserved: "cognitive.outcome.observed",
  reflectionRecorded: "cognitive.reflection.recorded",
  policyProposed: "cognitive.policy.proposed",
  policyAccepted: "cognitive.policy.accepted",
  policyRejected: "cognitive.policy.rejected",
} as const;

/** Append-only Cognitive Event log — the loop's source of truth for reflection and replay. */
export interface CognitiveEventLog {
  append(event: CognitiveEvent): void;
  all(): readonly CognitiveEvent[];
  byCorrelation(correlationId: string): readonly CognitiveEvent[];
}

export class InMemoryEventLog implements CognitiveEventLog {
  private readonly events: CognitiveEvent[] = [];

  append(event: CognitiveEvent): void {
    this.events.push(event);
  }

  all(): readonly CognitiveEvent[] {
    return this.events;
  }

  byCorrelation(correlationId: string): readonly CognitiveEvent[] {
    return this.events.filter((e) => e.correlation_id === correlationId);
  }
}

export interface EmitInput {
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  readonly correlationId: string;
  readonly causationId?: string | null;
}

/** Emits well-formed CognitiveEvents with advancing HLC and causal links, appending to the log. */
export class LoopEventEmitter {
  private hlc: Hlc;

  constructor(
    private readonly log: CognitiveEventLog,
    private readonly producerCid: string,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
    nodeId = "cognitive-loop",
  ) {
    this.hlc = hlcInit(nodeId);
  }

  emit(input: EmitInput): CognitiveEvent {
    const created = createEvent(
      {
        eventType: input.eventType,
        producerCid: this.producerCid,
        producerType: "cognitive.loop",
        payload: input.payload,
        classification: "internal",
        correlationId: input.correlationId,
        causationId: input.causationId ?? null,
      },
      { clock: this.clock, hlc: this.hlc, idGenerator: this.idGenerator },
    );
    this.hlc = created.hlc;
    this.log.append(created.event);
    return created.event;
  }
}
