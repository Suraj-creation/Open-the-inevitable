```yaml
spec:
  title: Capability Registry (Dynamic Grant / Revoke)
  domain: kernel
  status: draft
  owner: kernel-team
  last_reviewed: 2026-06-20
  upstream_dependencies:
    - kernel/capability-envelope
    - kernel/governance-kernel
    - product/product-cognition-runtime
  downstream_dependencies:
    - product/features/F06
    - agents/supervisor-agent
  related_protocols:
    - capability-envelope
  related_events: []
  related_runtime_systems: [capability-registry, governance-engine, product-runtime-dispatcher]
  related_governance_systems: [governance-kernel]
  related_observability_systems: [cognitive-observability]
  semantic_tags: [capability, grant, revoke, governance, dynamic, immune-system, dispatch]
  canonical_references:
    - ../architecture/uci-architecture.md#24-cognition-packet
    - architecture-decisions/ADR-0014-capability-registry
```

# Capability Registry (Dynamic Grant / Revoke)

## Purpose

The [Capability Envelope](./capability-envelope.md) and `CapabilityService` grant a subject a *bounded
envelope* (tools, memory scopes, ceilings) as one unit, revoked wholesale. This spec adds the
complementary primitive: a **registry of individual, named capabilities** that can be granted and
**revoked dynamically at runtime**, and that **governance consults on every dispatch**. It is the
governance "immune system": when a subject misbehaves (or a capability must be withdrawn), revoking it
takes effect immediately on the next dispatch — no session teardown, no envelope re-issue. It completes
the P2 increment "capability registry (dynamic grant/revoke)".

## The gap it closes

Governance today gates dispatch on the learner's static `trust_level` and a fixed agent allowlist
(GOV-P01). There is no way to grant or withdraw a *single* capability at runtime: trust is coarse and
set at onboarding, and the envelope is all-or-nothing. So "this learner may no longer invoke the
explanation agent" or "grant this subject the research capability for the next hour" are inexpressible.
The registry makes capabilities first-class, per-subject, and revocable.

## Model

A **grant** binds a named capability to a subject (cid):

```
{ capability, grantedTo, grantedBy, grantedAt, revokedAt: null, revokedReason: null }
```

The registry holds, per subject, the set of its grants. A capability is **active** for a subject iff a
grant exists and is not revoked. Re-granting a revoked capability re-activates it (a new grant window);
the audit trail (all grants, including revoked) is retained.

Capabilities are opaque strings; the product runtime uses the convention `dispatch.<agentId>` (the same
string as the governance action), so "may dispatch the explanation agent" is the capability
`dispatch.explanation`.

## Operations

- `grant(grantedTo, capability, grantedBy)` → the active grant (idempotent; re-activates if revoked).
- `revoke(grantedTo, capability, reason)` → marks the grant revoked (immediate effect).
- `has(grantedTo, capability)` → active? (granted and not revoked).
- `granted(grantedTo)` → the subject's active capabilities (for governance context).
- `list(grantedTo)` → all grants including revoked (the audit view).

## Enforcement (GOV-P03, opt-in)

Enforcement is a governance policy, **GOV-P03-DISPATCH-CAPABILITY**, evaluated in the dispatch gate
alongside GOV-P01/P02. It is **opt-in by presence**: it applies *only* when the dispatch request carries
a `capabilities` context (the subject's active grants, populated by a dispatcher that was given a
registry). When present, it blocks the dispatch if the required capability (`dispatch.<agentId>`) is not
in the active set; when absent (no registry wired), it is a no-op. This keeps capability enforcement an
additive, opt-in layer: existing governed paths are unaffected until a registry is attached, and the
deterministic substrate stays green.

The dispatcher populates the governance context with `registry.granted(subjectCid)` for the dispatching
subject (the learner). Revoking `dispatch.explanation` therefore blocks the learner's next explanation
dispatch — the cycle degrades gracefully (no explanation block) exactly as for any governance block.

## Governance, observability, determinism

- Grant/revoke are registry operations; the *enforcement* produces a normal governance decision record
  (the existing `GovernanceEngine` audit), so a blocked dispatch is auditable through the standard path.
- The registry is consulted at request-build time (the policy stays a pure function of the request), so
  determinism and replay are unaffected; with a fixed grant set, dispatch decisions are reproducible.
- A revoked capability takes effect on the *next* dispatch (no retroactive effect on in-flight work).

## Non-goals (deferred)

- **Durable capability persistence** across a restart (the registry is in-memory, consistent with the
  other kernel services — `CapabilityService`, `IntentLeaseService`); durable grants are a future
  refinement alongside durable identity.
- **Capability delegation / attenuation chains** (a subject re-granting a subset to a child) — future.
- **Time-boxed grants** (TTL per capability) — the envelope already carries expiry; per-capability TTL
  is a later addition.
- **`capability.*` event family** — grant/revoke are not yet evented (enforcement is audited via the
  governance decision record); a dedicated event family is a future addition.

## Failure modes

- **Revoked / never-granted capability** → dispatch blocked at GOV-P03 (fail-closed); the cycle degrades.
- **No registry wired** → GOV-P03 is a no-op; behavior is exactly as before (trust + allowlist only).
- **Unknown subject** → `granted` returns empty; every capability-gated dispatch for it is blocked.

## Verification

- `grant`/`has`/`granted`/`revoke`/re-grant transitions; `list` retains revoked grants (audit).
- GOV-P03 allows a dispatch whose required capability is granted, blocks it once revoked, and is a no-op
  when no `capabilities` context is present.
- Integration: revoking `dispatch.explanation` blocks the explanation dispatch in a live learning cycle
  (no explanation block); the rest of the cycle proceeds.
- `pnpm verify` stays green fully offline (enforcement is opt-in; existing flows unchanged).
```
