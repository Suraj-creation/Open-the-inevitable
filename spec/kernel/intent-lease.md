```yaml
spec:
  title: Intent Lease
  domain: kernel
  status: draft
  owner: kernel-team
  last_reviewed: 2026-06-02
  upstream_dependencies:
    - kernel/cognitive-identity
    - kernel/governance-kernel
  downstream_dependencies:
    - kernel-internals/cognition-syscalls
    - runtime/cognitive-unit-runtime
    - workflows/workflow-contracts
    - orchestration/hierarchical-directors
  related_protocols:
    - cognition-packet-protocol
    - workflow-state-protocol
  related_events:
    - intent.received
    - intent.interpreted
    - intent.renewed
    - intent.expired
    - intent.revoked
  related_runtime_systems:
    - cognitive-unit-runtime
    - durable-workflow-engine
  related_governance_systems:
    - governance-kernel
  related_observability_systems:
    - cognitive-observability
  semantic_tags: [intent, lease, goal, long-running, workflow, revocation, renewal]
  canonical_references:
    - ../architecture/uci-architecture.md#25-intent-lease
```

# Intent Lease

## Purpose

Define the Intent Lease: a time-bound, revocable, confidence-scored interpretation of what a user or
system is trying to accomplish. Long-running cognition (curriculum paths spanning weeks, research
pipelines spanning hours) must periodically re-validate that it is still pursuing the user's *current*
goal. The architecture law is explicit: *no long-running cognitive workflow without a valid Intent Lease.*

## Philosophy

User intent drifts; agents overcommit to stale interpretations. Without renewal, a multi-session
learning path can keep optimizing a goal the learner has abandoned. The intent lease makes goals
**explicit, expiring, and revocable**, forcing periodic reconfirmation and giving governance a clean
point to pause or redirect work.

## Architecture

Intent leases are issued by the kernel from interpreted user input and held by
[durable workflows](../workflows/workflow-contracts.md) and [orchestration cells](../orchestration/orchestration-cells.md).
A workflow checks its lease at milestone boundaries; an expired or revoked lease halts progression
and triggers renewal or graceful cancellation. Issued/renewed via the `COG_SCHEDULE`/governance path
and tracked in the workflow timeline.

## Primitives

Canonical JSON Schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "cos:protocol:intent-lease:1.0.0",
  "title": "IntentLease",
  "type": "object",
  "required": ["intent_id", "owner_user_id", "interpreted_goal", "expires_at", "confidence"],
  "properties": {
    "intent_id": { "type": "string" },
    "owner_user_id": { "type": "string" },
    "interpreted_goal": { "type": "string" },
    "scope": { "type": "array", "items": { "type": "string" } },
    "constraints": { "type": "array", "items": { "type": "string" } },
    "expires_at": { "type": "string", "format": "date-time" },
    "renewal_conditions": { "type": "array", "items": { "type": "string" } },
    "revocation_reason": { "type": ["string", "null"] },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "held_by": { "type": "array", "items": { "type": "string" }, "description": "workflow/unit CIDs" }
  },
  "additionalProperties": false
}
```

Illustrative TypeScript:

```ts
interface IntentLease {
  intentId: string;
  ownerUserId: string;
  interpretedGoal: string;
  scope: string[];
  constraints: string[];
  expiresAt: string;
  renewalConditions: string[];
  revocationReason: string | null;
  confidence: number;                // 0..1
  heldBy: string[];                  // workflow/unit CIDs
}
```

## Protocols and Contracts

- `interpret(user_input, context) → IntentLease` — emits `intent.received` then `intent.interpreted`.
- `validate(intent_id) → bool` — workflow milestone gate.
- `renew(intent_id, evidence) → IntentLease` — extend if conditions met.
- `revoke(intent_id, reason)` — halt dependent workflows; emit compensation as needed.

## Runtime Semantics

A workflow holding an intent lease MUST `validate` before each milestone. On expiry: pause, request
renewal (possibly via human/learner confirmation), or cancel with compensation. Low-confidence
interpretations require earlier renewal and may demand confirmation before high-cost steps.

## Event and State Transitions

`intent.received → intent.interpreted → (intent.renewed)* → intent.expired | intent.revoked`.
Each transition is evented and joins the [learner timeline](../world-state/temporal-cognition.md).

## Observability

Intent confidence, renewal frequency, and revocation reasons are tracked; frequent revocation signals
mis-interpretation and feeds [evolution](../evolution/evolution-proposals.md) of intent parsing.

## Governance and Security

Intent leases bind work to a consenting owner, enabling data-rights enforcement and preventing
goal-hijacking via prompt injection (a compromised input cannot silently rewrite an active lease;
re-interpretation produces a new, evented lease subject to policy).

## Failure Semantics

- **Expired lease, workflow mid-flight** → suspend at next milestone; do not start new high-cost steps.
- **Revoked lease** → run compensations; emit `workflow.cancelled`.
- **Interpretation service down** → existing leases remain valid until expiry; no new long-running
  work admitted (degraded mode).

## Testing and Validation

- **Unit:** expiry/renewal/revocation transitions; confidence bounds.
- **Integration:** workflow halts on expired/revoked lease; renewal resumes correctly.
- **Governance:** owner consent enforced; injected re-interpretation requires policy + new lease.
- **Replay:** lease timeline reconstructable from events.

## Evolution Strategy

Future: predictive intent drift detection, multi-goal leases, negotiated renewal UX. Schema growth is
additive; changes to revocation/compensation semantics are risk class E3+.
