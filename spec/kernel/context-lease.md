```yaml
spec:
  title: Context Lease
  domain: kernel
  status: draft
  owner: kernel-team
  last_reviewed: 2026-06-02
  upstream_dependencies:
    - kernel/cognitive-identity
    - kernel/capability-envelope
    - kernel/governance-kernel
  downstream_dependencies:
    - kernel-internals/cognition-syscalls
    - runtime/cognitive-unit-runtime
    - memory/memory-taxonomy
    - replay/deterministic-replay
  related_protocols:
    - cognition-packet-protocol
    - memory-mutation-protocol
  related_events:
    - context.lease.granted
    - context.lease.expired
    - context.retrieval.started
    - context.retrieval.completed
  related_runtime_systems:
    - cognitive-unit-runtime
    - context-lease-service
  related_governance_systems:
    - governance-kernel
    - capability-envelope
  related_observability_systems:
    - cognitive-observability
    - memory-influence-graph
  semantic_tags: [context, lease, virtual-memory, redaction, least-privilege, provenance]
  canonical_references:
    - ../architecture/uci-architecture.md#26-context-lease
```

# Context Lease

## Purpose

Define the Context Lease: a time-bound, revocable, audited grant of access to a bounded slice of
memory and world-state. The context lease is **virtual memory for cognition** — it prevents units
from pulling unlimited memory, leaking private context across tasks, or operating on stale or
unauthorized data, and it makes every context access provable.

## Philosophy

Context is not free to read. A learner's private memory, another tenant's data, and unconsented
information must be unreachable by default. A unit receives only the pages it needs, for only as long
as it needs them, scoped to allowed concepts, time ranges, and users — with redaction applied. This
enforces the architecture law: *no context access without a Context Lease.* It also underpins
deterministic replay: a frozen lease guarantees a replay sees exactly the context the original run saw.

## Architecture

The Context Lease Service (kernel service) mediates all reads against the memory fabric and
world-state graph. A unit requests a lease via the `COG_CONTEXT_LEASE`
[syscall](../kernel-internals/cognition-syscalls.md); the kernel validates the request against the
unit's [capability envelope](capability-envelope.md) and active [policies](governance-kernel.md),
then issues a lease handle. Retrieval is performed *through* the lease, recording which context
influenced output (the [memory influence graph](../observability/cognitive-observability.md)).

## Primitives

Canonical JSON Schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "cos:protocol:context-lease:1.0.0",
  "title": "ContextLease",
  "type": "object",
  "required": ["lease_id", "granted_to", "memory_layers", "expires_at"],
  "properties": {
    "lease_id": { "type": "string" },
    "granted_to": { "type": "string", "description": "CID" },
    "memory_layers": { "type": "array", "items": { "type": "string" }, "description": "working|episodic|semantic|procedural|reflective|collective ..." },
    "allowed_concepts": { "type": "array", "items": { "type": "string" } },
    "allowed_time_range": {
      "type": "object",
      "properties": { "from": { "type": ["string","null"], "format": "date-time" }, "to": { "type": ["string","null"], "format": "date-time" } }
    },
    "allowed_users": { "type": "array", "items": { "type": "string" } },
    "redaction_rules": { "type": "array", "items": { "type": "string" } },
    "token_budget": { "type": "integer", "minimum": 0 },
    "frozen": { "type": "boolean", "description": "true during deterministic replay" },
    "granted_by": { "type": "string" },
    "expires_at": { "type": "string", "format": "date-time" }
  },
  "additionalProperties": false
}
```

Illustrative TypeScript:

```ts
interface ContextLease {
  leaseId: string;
  grantedTo: string;                 // CID
  memoryLayers: string[];
  allowedConcepts: string[];
  allowedTimeRange: { from: string | null; to: string | null };
  allowedUsers: string[];
  redactionRules: string[];
  tokenBudget: number;
  frozen: boolean;
  grantedBy: string;
  expiresAt: string;
}
```

## Protocols and Contracts

- `request(cid, scope) → ContextLease` — validated against envelope + policy; `COG_CONTEXT_LEASE`.
- `read(lease_id, query) → ContextPage[]` — retrieval bounded by the lease; records influence.
- `renew(lease_id, conditions) → ContextLease` — extend if still authorized.
- `revoke(lease_id, reason)` — invalidate; in-flight reads fail closed.

Reads return [Cognition Packet](../protocols/cognition-packet-protocol.md)-compatible context pages
with provenance. Writes are never performed through a context lease — they require a
[Memory Mutation](../protocols/memory-mutation-protocol.md).

## Runtime Semantics

Leases are acquired during `Hydrating` and may be re-acquired during `Executing`. During replay the
lease is `frozen`: reads resolve against recorded context, never live stores (supports determinism
levels D2+, see [deterministic replay](../replay/deterministic-replay.md)). Token budget caps
context pulled into the working set ([context virtualization](../runtime/runtime-virtualization.md)).

## Event and State Transitions

- `context.lease.granted` / `context.lease.expired` — lifecycle.
- `context.retrieval.started` / `context.retrieval.completed` — bounded read operations.

State: `Requested → Granted → (Active/Renewed) → Expired|Revoked`. All transitions evented.

## Observability

Each lease links retrieved context to outputs, forming the memory-influence graph used for
hallucination lineage and retrieval-relevance scoring. Expired/revoked-mid-read events feed
resilience dashboards.

## Governance and Security

Leases enforce tenant/learner isolation, consent scope, and child-data restrictions via
`allowed_users` and `redaction_rules`. Cross-tenant context is impossible without an explicit,
policy-approved lease. Sensitive layers require higher trust and may require human review.

## Failure Semantics

- **Lease service unavailable** → deny new leases; running units operate on already-leased context
  (degraded); re-sync on recovery.
- **Expired/revoked mid-read** → read fails closed; unit handles gracefully or suspends.
- **Redaction failure** → fail closed; never return unredacted sensitive content; emit violation.
- **Budget exceeded** → truncate by relevance with provenance preserved; emit threshold event.

## Testing and Validation

- **Unit:** scope/time/user enforcement; redaction correctness; budget capping.
- **Governance:** cross-tenant access denied; consent scope honored; child-data rules enforced.
- **Replay:** frozen lease yields identical context across runs (determinism).
- **Failure:** fail-closed on outage, revocation, and redaction failure.

## Evolution Strategy

Future: relevance-aware paging, predictive prefetch, hierarchical context summarization with
provenance. Schema additions are additive under semantic versioning; changes to redaction semantics
are governance-critical (risk class E3/E4).
