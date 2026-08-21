```yaml
spec:
  title: Governance Kernel
  domain: kernel
  status: draft
  owner: governance-team
  last_reviewed: 2026-06-02
  upstream_dependencies:
    - kernel/cognitive-identity
    - kernel/capability-envelope
    - philosophy/cognitive-os-principles
  downstream_dependencies:
    - kernel-internals/cognition-syscalls
    - protocols/cognitive-event-protocol
    - protocols/memory-mutation-protocol
    - runtime/cognitive-unit-runtime
    - security/zero-trust-cognition
    - human-governance/approvals
  related_protocols:
    - governance-decision-protocol
    - cognitive-event-protocol
    - cognition-packet-protocol
  related_events:
    - governance.policy.evaluated
    - governance.violation.detected
    - governance.review.requested
    - governance.override.granted
  related_runtime_systems:
    - cognitive-unit-runtime
    - universal-cognitive-bus
  related_governance_systems:
    - governance-kernel
    - human-governance
  related_observability_systems:
    - cognitive-observability
  semantic_tags: [governance, policy, kernel, enforcement, audit, adaptive-trust, zero-trust]
  canonical_references:
    - ../architecture/uci-architecture.md#14-governance
```

# Governance Kernel

## Purpose

Define governance as a **kernel primitive**: executable policy applied at every decision boundary,
producing explainable, auditable decisions. Governance is not a post-processing moderation filter
bolted onto outputs; it is pre-computed and enforced wherever cognition acts — at the bus, at every
syscall, on every memory mutation, and at every side-effecting tool call.

## Philosophy

A cognitive system that cannot enforce policy consistently and explain its decisions is untrustworthy
at scale. Governance is the system's **immune system**. It decides who may think, what they may know,
what they may do, which tools they may use, which memory they may mutate, which workflows need review,
which data may cross regions, and which architecture mutations may deploy. It must be computational,
consistent, fully audited, and adaptive — never a human bottleneck for routine decisions, but always
escalatable to humans for high-risk ones.

## Architecture

The Governance Kernel is a control-plane service consulted by every other kernel service. It loads a
versioned, priority-ordered policy set, evaluates events/actions against it, and emits a
governance-decision record for each evaluation. It is also the **bus interceptor**: every publish and
subscribe on the [Universal Cognitive Bus](../communication/universal-cognitive-bus.md) passes through
policy evaluation (allow / block / modify / redact / require-review).

```
action/event ─► Governance Kernel ─► Decision {allow|block|modify|review}
                   │  policies (priority-ordered, versioned)
                   │  trust + risk state
                   └─► governance.* event (audited, immutable)
                          └─► human-governance queue (if review required)
```

## Primitives

**GovernanceDecision** — canonical JSON Schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "cos:protocol:governance-decision:1.0.0",
  "title": "GovernanceDecision",
  "type": "object",
  "required": ["decision_id", "subject_cid", "resource", "action", "decision", "policy_id", "policy_version"],
  "properties": {
    "decision_id": { "type": "string" },
    "subject_cid": { "type": "string" },
    "resource": { "type": "string" },
    "action": { "type": "string" },
    "context": { "type": "object" },
    "decision": { "type": "string", "enum": ["allow", "block", "modify", "review"] },
    "reason": { "type": "string" },
    "policy_id": { "type": "string" },
    "policy_version": { "type": "string" },
    "evidence": { "type": "array", "items": { "type": "string" } },
    "modified_payload": { "type": ["object", "null"] },
    "review_path": { "type": ["string", "null"] },
    "expires_at": { "type": ["string", "null"], "format": "date-time" }
  },
  "additionalProperties": false
}
```

**GovernancePolicy** — `{ policy_id, version, priority, policy_type, condition, action }`, where
`policy_type ∈ {access, tool, data, evidence, learning, cost, evolution, safety, security}`.

Illustrative TypeScript:

```ts
type Decision = "allow" | "block" | "modify" | "review";
interface GovernanceDecision {
  decisionId: string; subjectCid: string; resource: string; action: string;
  context: Record<string, unknown>; decision: Decision; reason: string;
  policyId: string; policyVersion: string; evidence: string[];
  modifiedPayload: Record<string, unknown> | null;
  reviewPath: string | null; expiresAt: string | null;
}
```

## Protocols and Contracts

- `evaluate(action|event) → GovernanceDecision` — priority-ordered; first blocking/modifying policy
  wins; mediates the `COG_GOVERN` [syscall](../kernel-internals/cognition-syscalls.md).
- `evaluate_bus(event, direction) → Decision` — publish/subscribe interceptor.
- `register_policy(policy)` / `deprecate_policy(id)` — control-plane; policy changes are evented and
  risk-classed (E4 for governance policy, blueprint §12.4).
- `adapt_trust(cid, signal)` — adjust trust within bounds; emits `security.trust.changed`.

## Runtime Semantics

Evaluation is synchronous and on the critical path for side-effecting actions; read-only/low-risk
actions may use cached decisions with short TTLs. Governance can **preempt** running work (safety
pressure interrupts lower-priority cognition via the [scheduler](cognitive-scheduler.md)).

## Event and State Transitions

- `governance.policy.evaluated` — every decision (allow included, sampled for low-risk).
- `governance.violation.detected` — blocked action or detected breach.
- `governance.review.requested` — routed to [human governance](../human-governance/approvals.md).
- `governance.override.granted` — human override, fully audited.

Governance memory (decisions, violations, reviews, overrides) is **strongly consistent and immutable**.

## Observability

Policy-intervention rate, violation rate, review latency, override frequency, and false-block rate are
core [cognitive health metrics](../observability/cognitive-observability.md). Every decision is traceable
in the [causal graph](../world-state/causal-graph.md).

## Governance and Security

- Kernel-mode only; user-mode units cannot read or mutate policy except via `COG_GOVERN`/`COG_EVOLVE`.
- Adaptive trust: rises with sustained safe behavior, falls on violation/drift; new versions start low.
- Integrates with [zero-trust cognition](../security/zero-trust-cognition.md) and prompt-injection defense.
- Enforces architecture laws: side-effects → decision; high-risk output → evidence requirement.

## Failure Semantics

- **Policy engine unreachable** → fail closed for high-risk actions; allow only low-risk read-only
  learning (degraded mode, blueprint §20.3); emit health-changed.
- **Policy misconfiguration** → detected via shadow evaluation before rollout; rollback via Evolution
  Proposal.
- **Decision store outage** → block side-effects requiring audit until restored; queue read-only.

## Testing and Validation

- **Unit:** policy ordering; decision schema; trust-bound arithmetic.
- **Governance:** PII/injection/evidence policies enforce correctly; review routing works.
- **Failure:** fail-closed on outage; misconfig caught in shadow.
- **Replay:** decisions deterministically reconstructable; audit immutable.

## Evolution Strategy

Policies evolve **only** through approved [Evolution Proposals](../evolution/evolution-proposals.md)
with shadow evaluation (risk class E4; kernel-protocol governance changes E5). Adaptive trust models
and new policy types are additive and themselves governed.
