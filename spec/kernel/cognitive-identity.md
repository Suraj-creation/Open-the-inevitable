```yaml
spec:
  title: Cognitive Identity
  domain: kernel
  status: draft
  owner: kernel-team
  last_reviewed: 2026-06-02
  upstream_dependencies:
    - philosophy/cognitive-os-principles
    - advanced-agent-architecture
    - next-generation-cognitive-operating-system-blueprint
  downstream_dependencies:
    - kernel/capability-envelope
    - kernel/context-lease
    - kernel/intent-lease
    - kernel/governance-kernel
    - kernel/cognitive-scheduler
    - kernel-internals/cognition-syscalls
    - protocols/cognition-packet-protocol
    - protocols/cognitive-event-protocol
    - runtime/cognitive-unit-runtime
  related_protocols:
    - cognition-packet-protocol
    - cognitive-event-protocol
    - cognitive-unit-abi
  related_events:
    - security.identity.attested
    - security.trust.changed
    - agent.spawned
  related_runtime_systems:
    - cognitive-unit-runtime
    - identity-registry
  related_governance_systems:
    - governance-kernel
    - capability-envelope
  related_observability_systems:
    - cognitive-observability
    - causal-graph
  semantic_tags: [identity, cid, trust, lineage, attestation, provenance, zero-trust]
  canonical_references:
    - advanced-agent-architecture#2.1
    - next-generation-cognitive-operating-system-blueprint#2.3
```

# Cognitive Identity

## Purpose

Define the Cognitive Identity (CID): the foundational, kernel-issued process descriptor for every
reasoning unit in the COS. The CID is to the Cognitive Operating System what a PID is to Unix — the
stable handle on which authorization, provenance, causal tracing, accountability, scheduling, and
trust are built. No cognitive work occurs under an unidentified actor.

## Philosophy

Identity is a kernel primitive, not an application convenience. In a zero-trust cognitive substrate,
*every* actor — agents, sub-agents, reasoning fibers, tool adapters, model adapters, memory writers,
retrieval jobs, workflow runs, human reviewers, external MCP servers, evolution experiments, and
synthetic test agents — must carry a verifiable identity. Trust is never inferred from network
position or call site; it is carried, attested, and continuously re-evaluated. Identity also encodes
**lineage**, because cognition spawns cognition, and accountability must follow the causal tree.

## Architecture

The Identity Service is a control-plane kernel service. It issues, registers, attests, and revokes
CIDs, and is the authority other kernel services consult.

```
spawn request ──► Identity Service ──► CID issued (signed, lineage-stamped)
                       │                     │
                       ├─ Identity Registry  ├─► Capability Envelope binding (kernel/capability-envelope)
                       ├─ Attestation Chain  ├─► Governance evaluation (kernel/governance-kernel)
                       └─ Trust Ledger       └─► emits security.identity.attested event
```

- **Identity Registry** — durable record of all live and retired CIDs, versions, and lineage edges
  (projected into the [world-state graph](../world-state/unified-world-state-graph.md) agent layer).
- **Attestation Chain** — cryptographic chain proving an identity was issued by the kernel and not
  forged; supports federation and external-runtime trust negotiation.
- **Trust Ledger** — append-only record of trust-level changes, each backed by an event.

## Primitives

**CognitiveIdentity (CID).** Canonical JSON Schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "cos:protocol:cognitive-identity:1.0.0",
  "title": "CognitiveIdentity",
  "type": "object",
  "required": ["cid", "unit_type", "version", "trust_level", "created_at"],
  "properties": {
    "cid": { "type": "string", "pattern": "^cog-[0-9a-f]{12}$" },
    "unit_type": { "type": "string", "description": "agent | subagent | tool | model | memory-writer | workflow | human | external-runtime | evolution-experiment | synthetic" },
    "version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
    "capabilities": { "type": "array", "items": { "type": "string" } },
    "trust_level": { "type": "integer", "minimum": 0, "maximum": 10 },
    "parent_cid": { "type": ["string", "null"] },
    "lineage": { "type": "array", "items": { "type": "string" } },
    "tenant_id": { "type": ["string", "null"] },
    "created_at": { "type": "string", "format": "date-time" },
    "capability_envelope_ref": { "type": ["string", "null"] },
    "governance_policies": { "type": "array", "items": { "type": "string" } },
    "public_key": { "type": ["string", "null"] },
    "attestation_chain": { "type": "array", "items": { "type": "string" } }
  },
  "additionalProperties": false
}
```

Illustrative TypeScript (projection only — JSON Schema is canonical, per [ADR-0003](../architecture-decisions/ADR-0003-tech-stack.md)):

```ts
interface CognitiveIdentity {
  cid: string;                       // "cog-<12 hex>"
  unitType: string;
  version: string;                   // semver
  capabilities: string[];
  trustLevel: number;                // 0..10
  parentCid: string | null;
  lineage: string[];                 // ancestor CIDs, root → parent
  tenantId: string | null;
  createdAt: string;                 // ISO-8601
  capabilityEnvelopeRef: string | null;
  governancePolicies: string[];
  publicKey: string | null;
  attestationChain: string[];
}
```

- **Trust level (0–10):** governs resource access. A child's trust is `max(0, parent.trust - 1)` by
  default; trust may rise via [adaptive governance](governance-kernel.md) after sustained safe
  behavior and fall on violation or drift.
- **Lineage:** ordered ancestor CIDs enabling causal attribution and blast-radius analysis.
- **Attestation chain:** signatures proving kernel issuance; required for federation/external units.

## Protocols and Contracts

- `issue(parent_cid?, unit_type, requested_capabilities) → CID` — kernel-only; enforces trust
  decrement and capability subset rules.
- `attest(cid) → AttestationResult` — verifies the attestation chain.
- `revoke(cid, reason)` — invalidates a CID; cascades to children per policy.
- `resolve(cid) → CognitiveIdentity` — registry lookup.
- `spawn_child(parent, unit_type, capabilities) → CID` — convenience composing `issue`, enforcing
  `child.capabilities ⊆ parent.capabilities` and `child.trust ≤ parent.trust - 1`.

Every CID is referenced by the [Cognition Packet](../protocols/cognition-packet-protocol.md)
(`source_cid`/`target_cid`) and [Cognitive Event](../protocols/cognitive-event-protocol.md)
(`producer_cid`). This satisfies architecture law: *no agent runtime without manifest, identity, and
capability envelope.*

## Runtime Semantics

Identity is bound at the start of the [unit lifecycle](../runtime/cognitive-unit-runtime.md): a unit
moves `Registered → Admitted` only after a valid CID and capability envelope exist. Identity is
immutable for the unit's lifetime except for `trust_level` and `attestation_chain`, which mutate
only through governed, evented operations. Spawning is mediated by the `COG_SPAWN`
[syscall](../kernel-internals/cognition-syscalls.md).

## Event and State Transitions

- `security.identity.attested` — CID issued/verified.
- `security.trust.changed` — trust level adjusted (carries old/new value, reason, evidence).
- `agent.spawned` / `agent.quarantined` / `agent.retired` — lifecycle edges referencing the CID.

Identity state lives in the registry; every transition is event-sourced and replayable. Corrections
are appended as new events, never rewritten (see [event governance](../meta/event-governance.md)).

## Observability

Every CID participates in the [causal graph](../world-state/causal-graph.md): emitted packets and
events carry the `producer_cid`, enabling hallucination-lineage tracing, blast-radius queries on
revocation, and per-identity reasoning-drift and confidence-calibration metrics.

## Governance and Security

- Issuance, trust changes, and revocation are privileged kernel operations (kernel-mode only).
- New versions of an agent type start at **reduced trust** and earn trust through evaluation.
- Capability grants are bounded by the [capability envelope](capability-envelope.md) — never by
  `unit_type` alone.
- Attestation enables zero-trust federation; external/untrusted identities receive low trust and
  stricter envelopes.

## Failure Semantics

- **Forged/invalid attestation** → reject at admission; emit `security.access.denied`; quarantine.
- **Orphaned CID** (parent revoked) → cascade per policy; eligible for cognitive GC.
- **Registry unavailable** → admission denied for new units; running units continue under their
  already-bound identity (degraded mode); re-sync on recovery.
- **Trust ledger conflict** (concurrent updates) → resolved by HLC ordering; conflict event emitted.

## Testing and Validation

- **Unit:** schema validation; trust-decrement and capability-subset invariants on `spawn_child`.
- **Integration:** identity issuance → admission → first packet carries correct `source_cid`.
- **Governance:** unauthorized issuance attempts denied; revocation cascades correctly.
- **Replay:** registry state deterministically reconstructable from the identity event stream.
- **Failure:** forged attestation rejected; orphan cleanup preserves audit history.

## Evolution Strategy

Identity schema changes are protocol changes governed by [ADR process](../meta/spec-governance.md)
and [protocol versioning](../protocols/cognitive-unit-abi.md). Future additions (vector clocks for
multi-agent causality, richer attestation for federation, hardware-backed keys) are additive fields
under semantic versioning. Kernel-protocol-level changes are risk class **E5** (blueprint §12.4).
