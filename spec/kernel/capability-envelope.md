```yaml
spec:
  title: Capability Envelope
  domain: kernel
  status: draft
  owner: kernel-team
  last_reviewed: 2026-06-02
  upstream_dependencies:
    - kernel/cognitive-identity
    - kernel/governance-kernel
  downstream_dependencies:
    - kernel/cognitive-scheduler
    - kernel-internals/cognition-syscalls
    - runtime/cognitive-unit-runtime
    - protocols/cognitive-unit-abi
  related_protocols:
    - cognitive-unit-abi
    - governance-decision-protocol
  related_events:
    - governance.policy.evaluated
    - security.access.denied
    - security.trust.changed
  related_runtime_systems:
    - cognitive-unit-runtime
    - capability-registry
  related_governance_systems:
    - governance-kernel
  related_observability_systems:
    - cognitive-observability
  semantic_tags: [capability, authorization, least-privilege, envelope, sandbox, policy]
  canonical_references:
    - next-generation-cognitive-operating-system-blueprint#2.10
    - advanced-agent-architecture#20
```

# Capability Envelope

## Purpose

Define the Capability Envelope: the policy-granted, runtime-bound description of *what a cognitive
unit may do, under what conditions, with what resources*. The envelope is the COS equivalent of a
process's permission set and resource limits combined — but granted by policy at admission time, not
hardcoded by unit type.

## Philosophy

Capabilities must be **granted, not assumed**. Two units of the same `unit_type` may receive
different envelopes depending on tenant, learner sensitivity, trust level, and current system risk.
This enables least-privilege cognition and adaptive tightening under threat. The envelope is the
enforcement surface for the architecture law: *no side-effecting tool call without a governance
decision* and *no agent runtime without a capability envelope*.

## Architecture

The Capability Service (control plane) computes an envelope from `(identity, requested capabilities,
active policies, system risk state)` and binds it to the unit for its lifetime or until re-leased.
Enforcement happens at every [syscall](../kernel-internals/cognition-syscalls.md) boundary: the
kernel checks the calling CID's envelope before honoring `COG_TOOL_INVOKE`, `COG_MEMORY_MUTATE`,
`COG_SPAWN`, `COG_CONTEXT_LEASE`, etc.

## Primitives

Canonical JSON Schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "cos:protocol:capability-envelope:1.0.0",
  "title": "CapabilityEnvelope",
  "type": "object",
  "required": ["envelope_id", "granted_to", "granted_by", "expires_at"],
  "properties": {
    "envelope_id": { "type": "string" },
    "granted_to": { "type": "string", "description": "CID" },
    "granted_by": { "type": "string", "description": "policy or authority CID" },
    "tools_allowed": { "type": "array", "items": { "type": "string" } },
    "memory_scopes": { "type": "array", "items": { "type": "string" }, "description": "readable/writable memory layers" },
    "models_allowed": { "type": "array", "items": { "type": "string" } },
    "max_spawn_depth": { "type": "integer", "minimum": 0 },
    "max_child_units": { "type": "integer", "minimum": 0 },
    "network_access": { "type": "boolean" },
    "cost_ceiling_usd": { "type": "number", "minimum": 0 },
    "latency_ceiling_ms": { "type": ["integer", "null"] },
    "data_classification_ceiling": { "type": "string", "description": "public | internal | sensitive | restricted" },
    "regions_allowed": { "type": "array", "items": { "type": "string" } },
    "human_review_required_for": { "type": "array", "items": { "type": "string" } },
    "expires_at": { "type": "string", "format": "date-time" }
  },
  "additionalProperties": false
}
```

Illustrative TypeScript:

```ts
interface CapabilityEnvelope {
  envelopeId: string;
  grantedTo: string;                 // CID
  grantedBy: string;                 // policy/authority CID
  toolsAllowed: string[];
  memoryScopes: string[];
  modelsAllowed: string[];
  maxSpawnDepth: number;
  maxChildUnits: number;
  networkAccess: boolean;
  costCeilingUsd: number;
  latencyCeilingMs: number | null;
  dataClassificationCeiling: "public" | "internal" | "sensitive" | "restricted";
  regionsAllowed: string[];
  humanReviewRequiredFor: string[];
  expiresAt: string;
}
```

A child unit's envelope MUST be a subset of its parent's (capabilities, scopes, ceilings).

## Protocols and Contracts

- `grant(identity, requested, context) → CapabilityEnvelope` — control-plane; applies policy.
- `check(cid, action, target) → Decision` — kernel enforcement at syscall boundaries.
- `narrow(envelope, constraints) → CapabilityEnvelope` — tighten under risk/load.
- `revoke(envelope_id, reason)` — invalidate; running syscalls fail closed.

Envelope decisions are emitted as [governance decisions](governance-kernel.md) and are referenced by
the [Cognitive Unit ABI](../protocols/cognitive-unit-abi.md) `prepare()` step.

## Runtime Semantics

Bound during `Admitted → Scheduled → Hydrating`. The [scheduler](cognitive-scheduler.md) honors
`regions_allowed`, `models_allowed`, and `cost_ceiling_usd`. Under load-shedding or safety pressure,
the kernel may `narrow` envelopes system-wide (e.g. reduce `max_spawn_depth`).

## Event and State Transitions

- `governance.policy.evaluated` — envelope granted/narrowed with reason and policy version.
- `security.access.denied` — a syscall blocked by envelope check.
- `security.trust.changed` — may trigger envelope re-computation.

## Observability

Every denied or narrowed capability emits an auditable event. Capability-intervention rate is a
[cognitive health metric](../observability/cognitive-observability.md). Envelope edges are projected
into the governance layer of the [world-state graph](../world-state/unified-world-state-graph.md).

## Governance and Security

The envelope *is* the kernel's authorization mechanism. Side-effecting tools (classified by
reversibility/blast radius) require stronger envelopes and may set `human_review_required_for`.
Escalation (widening an envelope) is privileged, evented, and risk-classed (E2+).

## Failure Semantics

- **Capability service unavailable** → fail closed: deny new grants; running units keep their bound
  envelope; high-risk actions paused.
- **Expired envelope mid-execution** → syscall denied; unit suspended pending re-lease.
- **Subset violation on spawn** → spawn rejected; emit `security.access.denied`.

## Testing and Validation

- **Unit:** subset invariant; expiry enforcement; classification ceiling checks.
- **Governance:** unauthorized tool/memory/model access denied; escalation requires approval.
- **Failure:** fail-closed behavior on service outage; expired-envelope suspension.
- **Replay:** envelope grants reconstructable from governance event stream.

## Evolution Strategy

Adaptive policies may propose envelope-default changes via [Evolution Proposals](../evolution/evolution-proposals.md)
(risk class E2/E4). New ceiling dimensions are additive under semantic versioning.
