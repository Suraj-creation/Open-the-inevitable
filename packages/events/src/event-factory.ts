/**
 * Construct well-formed {@link CognitiveEvent}s with deterministic ids, HLC, and timestamps.
 * Time and entropy are injected so events are replay-safe (spec/protocols/cognitive-event-protocol.md).
 */
import {
  type Clock,
  type Hlc,
  type IdGenerator,
  hlcTick,
  hlcToString,
  newEventId,
  CryptoIdGenerator,
} from "@inevitable/shared";
import { type CognitiveEvent, SCHEMA_IDS, defaultValidator } from "@inevitable/protocols";

export type EventClassification = CognitiveEvent["classification"];
export type ReplayBehavior = NonNullable<CognitiveEvent["replay_behavior"]>;

export interface CreateEventInput {
  eventType: string;
  producerCid: string;
  producerType: string;
  payload: Record<string, unknown>;
  classification?: EventClassification;
  topic?: string;
  correlationId?: string | null;
  causationId?: string | null;
  tenantId?: string | null;
  sessionId?: string | null;
  workflowId?: string | null;
  priority?: number;
  confidence?: number;
  retention?: string;
  replayBehavior?: ReplayBehavior;
  requiresAck?: boolean;
  traceId?: string;
  spanId?: string;
}

export interface EventFactoryDeps {
  clock: Clock;
  hlc: Hlc;
  idGenerator?: IdGenerator;
  schemaVersion?: string;
}

export interface CreatedEvent {
  readonly event: CognitiveEvent;
  /** The advanced HLC; thread this back in for the next event from the same source. */
  readonly hlc: Hlc;
}

const defaultGen = new CryptoIdGenerator();

export function createEvent(input: CreateEventInput, deps: EventFactoryDeps): CreatedEvent {
  const gen = deps.idGenerator ?? defaultGen;
  const nextHlc = hlcTick(deps.hlc, deps.clock);
  const event: CognitiveEvent = {
    event_id: newEventId(gen),
    event_type: input.eventType,
    schema_version: deps.schemaVersion ?? "1.0.0",
    timestamp: new Date(deps.clock.nowMs()).toISOString(),
    hlc: hlcToString(nextHlc),
    causation_id: input.causationId ?? null,
    correlation_id: input.correlationId ?? null,
    tenant_id: input.tenantId ?? null,
    session_id: input.sessionId ?? null,
    workflow_id: input.workflowId ?? null,
    producer_cid: input.producerCid,
    producer_type: input.producerType,
    topic: input.topic ?? `cos.${input.eventType}`,
    priority: input.priority ?? 5,
    payload: input.payload,
    confidence: input.confidence ?? 1,
    classification: input.classification ?? "internal",
    policy_tags: [],
    retention: input.retention ?? "30d-hot",
    replay_behavior: input.replayBehavior ?? "replayable",
    requires_ack: input.requiresAck ?? false,
    trace_id: input.traceId ?? "",
    span_id: input.spanId ?? "",
  };
  return { event, hlc: nextHlc };
}

/** Validate an event against the canonical Cognitive Event schema. */
export function validateEvent(event: unknown): ReturnType<typeof defaultValidator.validate> {
  return defaultValidator.validate(SCHEMA_IDS.cognitiveEvent, event);
}
