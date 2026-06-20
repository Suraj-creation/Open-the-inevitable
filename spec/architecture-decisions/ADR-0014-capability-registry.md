# ADR-0014 — Capability Registry (Dynamic Grant / Revoke)

- **Status:** accepted
- **Date:** 2026-06-20
- **Deciders:** kernel-team, runtime-team
- **Supersedes:** —
- **Related:** [ADR-0013 (intent inference)](./ADR-0013-intent-inference.md), [spec/kernel/capability-registry](../kernel/capability-registry.md), [spec/kernel/capability-envelope](../kernel/capability-envelope.md), [spec/kernel/governance-kernel](../kernel/governance-kernel.md), `@inevitable/kernel`, `@inevitable/product-cognition`, `apps/cli`, `apps/api`

## Context

Governance gates dispatch on static `trust_level` + a fixed agent allowlist (GOV-P01); the capability
envelope is granted and revoked wholesale. There is no way to grant or withdraw a *single* capability at
runtime — so the "governance immune system" (revoke a misbehaving subject's access immediately) is
inexpressible. This is the final P2 increment (Identity, Continuity & Context).

## Decision

1. **A fine-grained `CapabilityRegistry` in `@inevitable/kernel`.** Per-subject named-capability grants
   with `grant` / `revoke` / `has` / `granted` / `list`, retaining revoked grants for audit; re-granting
   re-activates. In-memory, consistent with the other kernel services (`CapabilityService`,
   `IntentLeaseService`). Complements — does not replace — the envelope `CapabilityService` (coarse,
   bounded envelopes); the registry is individual, dynamic capabilities.

2. **Enforcement is a governance policy, GOV-P03, opt-in by presence.** GOV-P03-DISPATCH-CAPABILITY
   blocks a dispatch whose required capability (`dispatch.<agentId>`, the same string as the action) is
   not in the subject's active set — but *only when the request carries a `capabilities` context*. With
   no registry wired, the context is absent and GOV-P03 is a no-op. This makes capability enforcement an
   additive layer: every existing governed path (and all standalone dispatcher tests) is unaffected
   until a registry is attached. The policy stays a pure function of the request; the dispatcher
   populates `context.capabilities = registry.granted(subjectCid)` at request-build time.

3. **The dispatcher gains an optional `capabilityRegistry`.** `ProductRuntimeDispatcher` populates the
   governance context with the dispatching subject's active capabilities when a registry is provided.
   `buildDemoSession` constructs one registry, grants the learner `dispatch.<agentId>` for the agents it
   uses, and passes it to every dispatcher — so normal asks pass and revoking a capability blocks that
   agent's next dispatch (the cycle degrades gracefully, as with any governance block).

## Consequences

**Positive:** capabilities become first-class, per-subject, and revocable at runtime; governance can
withdraw a single capability immediately (the immune system) without tearing down the session or
re-issuing an envelope; enforcement is auditable through the existing governance decision-record path;
the opt-in design adds the layer with zero disruption to existing flows; P2 (Identity, Continuity &
Context) is complete.

**Negative / trade-offs:** grants are **in-memory** (do not survive a restart) — durable capability
persistence is deferred (consistent with the other kernel services); no delegation/attenuation chains or
per-capability TTL yet; grant/revoke are not yet evented (`capability.*` family deferred — enforcement is
audited via the governance decision record); the `dispatch.<agentId>` capability convention is a product
choice, not a kernel-wide standard yet.

**Neutral:** the registry is opt-in (no registry ⇒ trust + allowlist only, exactly as before); the
envelope `CapabilityService` is unchanged; no new event family or schema is introduced.
