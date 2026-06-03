/**
 * Cognitive trace envelope — the portable correlation context attached to every packet and
 * event so reasoning can be reconstructed across units, the bus, and replay.
 *
 * Spec: spec/observability/cognitive-observability.md, spec/protocols/cognitive-event-protocol.md,
 *       spec/protocols/reasoning-trace-protocol.md. `trace_id`/`span_id` map to OpenTelemetry.
 */
import {
  newTraceId,
  newSpanId,
  type TraceId,
  type SpanId,
  type IdGenerator,
  CryptoIdGenerator,
} from "@inevitable/shared";

/**
 * Travels with packets/events. `cognitionId` correlates an entire cognitive interaction
 * (the COS-level correlation id), distinct from the per-operation span.
 */
export interface TraceContext {
  readonly traceId: TraceId;
  readonly spanId: SpanId;
  readonly parentSpanId: SpanId | null;
  /** Correlates a whole interaction across many spans (== event.correlation_id). */
  readonly cognitionId: string;
  /** Propagated key/value baggage (tenant, session, region …). */
  readonly baggage: Readonly<Record<string, string>>;
}

const defaultGen = new CryptoIdGenerator();

export function newRootTrace(
  cognitionId: string,
  baggage: Record<string, string> = {},
  gen: IdGenerator = defaultGen,
): TraceContext {
  return {
    traceId: newTraceId(gen),
    spanId: newSpanId(gen),
    parentSpanId: null,
    cognitionId,
    baggage: { ...baggage },
  };
}

/** Derive a child span sharing the trace and cognition id. */
export function childSpan(
  parent: TraceContext,
  extraBaggage: Record<string, string> = {},
  gen: IdGenerator = defaultGen,
): TraceContext {
  return {
    traceId: parent.traceId,
    spanId: newSpanId(gen),
    parentSpanId: parent.spanId,
    cognitionId: parent.cognitionId,
    baggage: { ...parent.baggage, ...extraBaggage },
  };
}

/** Project onto the flat fields carried by the Cognition Packet / Cognitive Event envelopes. */
export function traceFields(ctx: TraceContext): {
  trace_id: string;
  span_id: string;
  correlation_id: string;
} {
  return { trace_id: ctx.traceId, span_id: ctx.spanId, correlation_id: ctx.cognitionId };
}
