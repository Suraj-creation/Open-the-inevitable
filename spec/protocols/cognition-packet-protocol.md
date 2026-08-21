```yaml
spec:
  title: Cognition Packet Protocol
  domain: protocols
  status: draft
  owner: protocols-team
  last_reviewed: 2026-06-02
  upstream_dependencies:
    - kernel/cognitive-identity
    - kernel/context-lease
    - protocols/cognitive-unit-abi
  downstream_dependencies:
    - protocols/cognitive-event-protocol
    - communication/universal-cognitive-bus
    - runtime/cognitive-unit-runtime
    - orchestration/blackboard-protocol
  related_protocols:
    - cognitive-event-protocol
    - reasoning-trace-protocol
    - cognitive-unit-abi
  related_events:
    - reasoning.claim.produced
    - agent.completed
  related_runtime_systems:
    - cognitive-unit-runtime
    - universal-cognitive-bus
  related_governance_systems:
    - governance-kernel
  related_observability_systems:
    - cognitive-observability
    - causal-graph
  semantic_tags: [packet, semantic-exchange, causality, hlc, evidence, confidence, typed]
  canonical_references:
    - ../architecture/uci-architecture.md#24-cognition-packet
```

# Cognition Packet Protocol

## Purpose

Define the Cognition Packet: the canonical unit of semantic exchange between cognitive units. A packet
is a self-describing, typed, causally-linked artifact — never an untyped string. Natural language may
live *inside* a packet, but the packet itself is always structured, identified, and traceable.

## Philosophy

If units exchange bare strings, the system cannot observe, govern, or replay their interaction. Making
the packet the atomic exchange unit means every act of communication carries identity, causality,
evidence, confidence, and governance metadata — turning "a message was sent" into "an identified unit
produced a typed, evidence-bearing, causally-linked artifact at a known logical time." This is the
data-plane counterpart to the [Cognitive Event](cognitive-event-protocol.md) (the fact ledger).

## Architecture

Packets flow on the command and realtime planes of the
[Universal Cognitive Bus](../communication/universal-cognitive-bus.md), between units and across
[blackboards](../orchestration/blackboard-protocol.md). Each significant packet typically has a
corresponding [Cognitive Event](cognitive-event-protocol.md) recording that it was produced. Packets
reference the producing [identity](../kernel/cognitive-identity.md) and carry a
[hybrid logical clock](../world-state/temporal-cognition.md) for causal ordering.

## Primitives

Canonical JSON Schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "cos:protocol:cognition-packet:1.0.0",
  "title": "CognitionPacket",
  "type": "object",
  "required": ["packet_id", "schema_version", "source_cid", "packet_type", "timestamp", "hlc"],
  "properties": {
    "packet_id": { "type": "string", "pattern": "^cp-[0-9a-f]+$" },
    "schema_version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
    "source_cid": { "type": "string" },
    "target_cid": { "type": ["string", "null"], "description": "null = broadcast" },
    "tenant_id": { "type": ["string", "null"] },
    "session_id": { "type": ["string", "null"] },
    "causation_id": { "type": ["string", "null"] },
    "correlation_id": { "type": ["string", "null"] },
    "timestamp": { "type": "string", "format": "date-time" },
    "hlc": { "type": "string", "description": "hybrid logical clock, sortable" },
    "sequence_number": { "type": "integer", "minimum": 0 },
    "packet_type": { "type": "string", "description": "intent | context | claim | tool-call | tool-result | response | handoff ..." },
    "intent": { "type": ["string", "null"] },
    "concept_ids": { "type": "array", "items": { "type": "string" } },
    "domain_ids": { "type": "array", "items": { "type": "string" } },
    "content": { "type": "object" },
    "semantic_embedding": { "type": ["array", "null"], "items": { "type": "number" } },
    "evidence": { "type": "array", "items": { "type": "object" } },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "uncertainty_estimate": { "type": "number", "minimum": 0, "maximum": 1 },
    "reasoning_depth": { "type": "integer", "minimum": 0 },
    "classification": { "type": "string", "enum": ["public","internal","sensitive","restricted"] },
    "policy_tags": { "type": "array", "items": { "type": "string" } },
    "requires_human_review": { "type": "boolean" },
    "priority": { "type": "integer", "minimum": 1, "maximum": 10 },
    "expiry": { "type": ["string","null"], "format": "date-time" },
    "trace_id": { "type": "string" },
    "span_id": { "type": "string" }
  },
  "additionalProperties": false
}
```

Illustrative TypeScript (projection only; JSON Schema canonical per [ADR-0003](../architecture-decisions/ADR-0003-tech-stack.md)):

```ts
interface CognitionPacket {
  packetId: string; schemaVersion: string;
  sourceCid: string; targetCid: string | null;
  tenantId: string | null; sessionId: string | null;
  causationId: string | null; correlationId: string | null;
  timestamp: string; hlc: string; sequenceNumber: number;
  packetType: string; intent: string | null;
  conceptIds: string[]; domainIds: string[];
  content: Record<string, unknown>; semanticEmbedding: number[] | null;
  evidence: Array<Record<string, unknown>>;
  confidence: number; uncertaintyEstimate: number; reasoningDepth: number;
  classification: "public"|"internal"|"sensitive"|"restricted";
  policyTags: string[]; requiresHumanReview: boolean;
  priority: number; expiry: string | null; traceId: string; spanId: string;
}
```

## Protocols and Contracts

- **Producers:** any cognitive unit (via the [ABI](cognitive-unit-abi.md) `execute()` step), directors,
  tools, models, memory services.
- **Consumers:** units, blackboards, the bus, observability.
- **Validation:** packets are validated against the registered schema at the bus boundary; invalid
  packets are dead-lettered.
- **Causality:** `causation_id` links a packet to the packet/event that caused it; `correlation_id`
  groups a logical interaction; `hlc` provides total causal ordering across nodes.

## Runtime Semantics

A unit appends inbound packets to its working context (bounded by its
[context lease](../kernel/context-lease.md) token budget), reasons, and emits output packets. Packets
exceeding `expiry` are dropped with an event. Embeddings enable
[semantic routing](../communication/universal-cognitive-bus.md).

## Event and State Transitions

Packets are transient data-plane artifacts; their production/consumption is recorded as
[Cognitive Events](cognitive-event-protocol.md) (e.g. `reasoning.claim.produced`, `agent.completed`).
The packet itself is immutable once emitted; revisions are new packets with `causation_id` set.

## Observability

`confidence`, `uncertainty_estimate`, `reasoning_depth`, and `evidence` feed confidence-calibration,
hallucination-risk, and evidence-coverage metrics. `causation_id`/`correlation_id`/`hlc` build the
[causal graph](../world-state/causal-graph.md) and memory-influence lineage.

## Governance and Security

`classification` and `policy_tags` drive bus governance interception and redaction.
`requires_human_review` routes to [human governance](../human-governance/approvals.md). Cross-tenant
delivery requires matching `tenant_id` and an authorizing policy. Untrusted-source content is marked
and screened for [prompt injection](../security/prompt-injection-defense.md).

## Failure Semantics

- **Schema-invalid packet** → dead-letter; emit violation; never delivered.
- **Expired packet** → dropped with event.
- **Missing causation on a derived packet** → rejected (events must carry causality, per
  [event governance](../meta/event-governance.md)).
- **Oversized content** → rejected against capability/lease budget; producer must summarize.

## Testing and Validation

- **Unit:** schema validation; causality field rules; classification enum.
- **Contract:** producer/consumer round-trip fixtures across versions.
- **Replay:** packets recorded for nondeterministic steps reproduce identically.
- **Governance:** classification/redaction enforced at the bus.

## Evolution Strategy

Schema changes follow [protocol versioning](cognitive-unit-abi.md) and
[protocol governance](../meta/protocol-governance.md): additive fields under minor versions, breaking
changes require an ADR + migration plan + contract tests. New `packet_type`s are registered, not
hardcoded.
