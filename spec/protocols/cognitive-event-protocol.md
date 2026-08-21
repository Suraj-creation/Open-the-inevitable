```yaml
spec:
  title: Cognitive Event Protocol
  domain: protocols
  status: draft
  owner: protocols-team
  last_reviewed: 2026-06-02
  upstream_dependencies:
    - kernel/cognitive-identity
    - protocols/cognition-packet-protocol
    - meta/event-governance
  downstream_dependencies:
    - events/event-taxonomy
    - communication/universal-cognitive-bus
    - replay/deterministic-replay
    - observability/cognitive-observability
    - world-state/temporal-cognition
  related_protocols:
    - cognition-packet-protocol
    - memory-mutation-protocol
    - governance-decision-protocol
  related_events:
    - "all event families (see events/event-taxonomy)"
  related_runtime_systems:
    - universal-cognitive-bus
    - event-store
  related_governance_systems:
    - governance-kernel
  related_observability_systems:
    - cognitive-observability
    - causal-graph
  semantic_tags: [event, event-sourcing, immutable, causality, replay, retention, classification]
  canonical_references:
    - ../architecture/uci-architecture.md#63-event-envelope
```

# Cognitive Event Protocol

## Purpose

Define the Cognitive Event: the immutable, typed, causally-ordered record of *something that happened*
in the COS. Events are the system's source of truth — materialized state, memory, world-state, and
observability views are all projections of the event log. This protocol defines the event **envelope**
shared by every event family; the families themselves are enumerated in the
[event taxonomy](../events/event-taxonomy.md).

## Philosophy

"State is the source of truth, not computation" (Axiom 2): every cognitive output must be derivable
from event history. Events enable time-travel debugging, causal attribution, replay-based recovery,
and safe evolution. Events are **append-only**: corrections are new events, never rewrites. This is the
fact ledger that complements the transient [Cognition Packet](cognition-packet-protocol.md) data plane.

## Architecture

Events flow on the event plane of the
[Universal Cognitive Bus](../communication/universal-cognitive-bus.md) and are persisted in the
event store (time-partitioned, hot+archive). They are validated against the registered schema at
publish time, pass the [governance interceptor](../kernel/governance-kernel.md), and fan out to
durable/semantic subscribers, observability, and replay buffers.

## Primitives

Canonical JSON Schema (the shared envelope):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "cos:protocol:cognitive-event:1.0.0",
  "title": "CognitiveEvent",
  "type": "object",
  "required": ["event_id", "event_type", "schema_version", "producer_cid", "producer_type", "timestamp", "hlc", "classification", "payload"],
  "properties": {
    "event_id": { "type": "string", "pattern": "^evt-[0-9a-f]+$" },
    "event_type": { "type": "string", "description": "hierarchical: family.subdomain.action" },
    "schema_version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
    "timestamp": { "type": "string", "format": "date-time" },
    "hlc": { "type": "string" },
    "sequence": { "type": "integer", "minimum": 0, "description": "global monotonic from the stream" },
    "causation_id": { "type": ["string", "null"] },
    "correlation_id": { "type": ["string", "null"] },
    "tenant_id": { "type": ["string", "null"] },
    "session_id": { "type": ["string", "null"] },
    "workflow_id": { "type": ["string", "null"] },
    "producer_cid": { "type": "string" },
    "producer_type": { "type": "string" },
    "topic": { "type": "string" },
    "priority": { "type": "integer", "minimum": 1, "maximum": 10 },
    "payload": { "type": "object" },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "classification": { "type": "string", "enum": ["public","internal","sensitive","restricted","audit"] },
    "policy_tags": { "type": "array", "items": { "type": "string" } },
    "retention": { "type": "string", "description": "e.g. 30d-hot, 1y-archive, permanent" },
    "replay_behavior": { "type": "string", "enum": ["replayable","recorded-observation","non-replayable"] },
    "requires_ack": { "type": "boolean" },
    "trace_id": { "type": "string" },
    "span_id": { "type": "string" }
  },
  "additionalProperties": false
}
```

Illustrative TypeScript:

```ts
interface CognitiveEvent {
  eventId: string; eventType: string; schemaVersion: string;
  timestamp: string; hlc: string; sequence: number;
  causationId: string | null; correlationId: string | null;
  tenantId: string | null; sessionId: string | null; workflowId: string | null;
  producerCid: string; producerType: string; topic: string; priority: number;
  payload: Record<string, unknown>; confidence: number;
  classification: "public"|"internal"|"sensitive"|"restricted"|"audit";
  policyTags: string[]; retention: string;
  replayBehavior: "replayable"|"recorded-observation"|"non-replayable";
  requiresAck: boolean; traceId: string; spanId: string;
}
```

Per [event governance](../meta/event-governance.md), every event MUST carry a version, causation,
classification, retention, and replay behavior.

## Protocols and Contracts

- `publish(event) → seq` — validated, governed, persisted, fanned out (`COG_EVENT_PUBLISH` syscall).
- `subscribe(pattern|semantic_filter, handler, consumer)` — durable/semantic subscription with acks.
- `replay(from, filters) → stream` — ordered reconstruction (see [replay](../replay/deterministic-replay.md)).
- Producers/consumers per family are declared in the [event taxonomy](../events/event-taxonomy.md).

## Runtime Semantics

Events are causally ordered by `hlc` + stream `sequence`. `replay_behavior` controls reconstruction:
`replayable` events re-apply directly; `recorded-observation` events (model/tool outputs) are replayed
from recording rather than re-invoked (determinism levels D2–D3). `requires_ack` events use explicit
acknowledgment with retry/dead-letter on failure.

## Event and State Transitions

Events drive every materialized projection: state, memory graph, world-state graph, observability
views. Aggregates (learner, concept, agent, workflow, policy timelines) are folds over filtered event
streams. The log itself never transitions backward — only forward-appended.

## Observability

The event stream *is* the primary observability substrate. Drift, hallucination lineage, disagreement,
and confidence curves are computed from events. `trace_id`/`span_id` bridge to
[OpenTelemetry](../telemetry/) per [ADR-0003](../architecture-decisions/ADR-0003-tech-stack.md).

## Governance and Security

The bus governance interceptor evaluates every publish/subscribe: producer authorization, payload
classification, PII/redaction, consumer authorization, retention/consent. `audit`-classified events
are immutable and strongly consistent. Cross-region replication follows classification (governance
events globally replicated; private learner data regional).

## Failure Semantics

- **Schema-invalid event** → rejected at publish; dead-lettered; emit violation.
- **Missing causation** → rejected (events must carry causality).
- **Consumer failure** → nak + retry with capped backoff; poison messages quarantined.
- **Event store outage** → buffer locally; pause non-critical analytics/evolution events; replay
  buffered events on recovery (degraded mode, blueprint §20.3).

## Testing and Validation

- **Unit:** envelope schema; causality/classification/retention required fields.
- **Contract:** family schema fixtures; producer/consumer compatibility across versions.
- **Replay:** deterministic reconstruction; recorded-observation handling.
- **Failure:** dead-letter, poison-quarantine, store-outage buffering.

## Evolution Strategy

Envelope changes are kernel-protocol-level (risk class E5). Family/payload schema changes follow
[protocol versioning](cognitive-unit-abi.md) and the [taxonomy](../events/event-taxonomy.md): additive
under minor versions; breaking changes need ADR + migration + contract tests. Unversioned payloads are
an invalid pattern ([event governance](../meta/event-governance.md)).
