# `spec/product/features/` — Feature Specifications

> This folder owns the **sixteen production-grade feature specifications** that refine the twelve
> capability pillars declared in
> [`../Broader-feature-product.md`](../Broader-feature-product.md). Each feature spec is the
> bridge between a product pillar and the Cognitive Operating System primitives that implement it.

## Read first

Before reading or writing any feature spec, read in this order:

1. [`../Broader-feature-product.md`](../Broader-feature-product.md) — master PRD, capability pillars,
   Product → Architecture mapping.
2. [`../README.md`](../README.md) — product domain entry point.
3. This file — template, conventions, status lifecycle.
4. The feature spec(s) you are touching, and their upstream/downstream features.
5. The owning architecture domains under `spec/kernel/`, `spec/protocols/`, `spec/events/`,
   `spec/runtime/`, `spec/memory/`, `spec/world-state/`, `spec/orchestration/`, `spec/curriculum/`,
   `spec/pedagogy/`.

## Index

| ID | Title | Pillar | Status |
|---|---|---|---|
| [F01](./F01-cognitive-onboarding.md) | Cognitive Onboarding & Context Initialization | P1 | draft |
| [F02](./F02-dynamic-cognitive-navigation.md) | Dynamic Cognitive Navigation & Learning Timeline | P2 | draft |
| [F03](./F03-recursive-prerequisite-intelligence.md) | Recursive Prerequisite Intelligence (ULI Core) | P3 | draft |
| [F04](./F04-adaptive-multimodal-explanation.md) | Adaptive Multimodal Explanation & Dynamic System Prompting | P4 | draft |
| [F05](./F05-persistent-cognitive-memory.md) | Persistent Cognitive Memory System | P5 | draft |
| [F06](./F06-specialized-agent-ecosystem.md) | Specialized Agent Ecosystem | P6 | draft |
| [F07](./F07-realtime-cognitive-orchestration.md) | Real-Time Cognitive Orchestration | P7 | draft |
| [F08](./F08-interdisciplinary-knowledge-graph.md) | Interdisciplinary Intelligence & Knowledge Graph | P8 | draft |
| [F09](./F09-living-universe-experience.md) | Living-Universe Experience & Immersive Roadmap | P9 | draft |
| [F10](./F10-research-innovation-acceleration.md) | Research & Innovation Acceleration (UALRCI) | P10 | draft |
| [F11](./F11-institutional-collective-intelligence.md) | Institutional & Collective Intelligence + Educator Mode | P11 | draft |
| [F12](./F12-collective-cognitive-evolution.md) | Collective Cognitive Evolution (Governed Self-Improvement) | P12 | draft |
| [F13](./F13-identity-personas-modes.md) | Identity, Personas & Dual Modes | cross-cutting | draft |
| [F14](./F14-assessment-mastery-depth.md) | Assessment, Mastery & Depth Verification | cross-cutting | draft |
| [F15](./F15-content-ingestion-knowledge-substrate.md) | Content Ingestion & Universal Knowledge Substrate | cross-cutting | draft |
| [F16](./F16-cognitive-surface.md) | The Cognitive Surface — Universal Multimodal Substrate | cross-cutting | draft |

## Status lifecycle

`scaffold` → `draft` → `review` → `accepted` → `implementing` → `landed` → `superseded` / `retired`.

A spec moves to `accepted` only after architecture conformance has been validated against the
blueprint §25.4 ten non-negotiable laws and the owning architecture domains have been notified.

## Doctrine

- Product law is **subordinate to architecture law**. A feature requirement that appears to conflict
  with an architecture invariant must be re-expressed *through* events, leases, memory mutations,
  and governed capabilities. Never around them.
- Every feature spec must trace to: a capability pillar, the COS primitives it uses, the
  agents/events/protocols it relies on, observability signals, governance requirements, and
  validation evidence.
- Spec-first: if a feature decision changes architecture, runtime, memory, protocol, orchestration,
  governance, observability, or event semantics, update the owning architecture spec first.

## The Canonical Feature-Spec Template

Every feature spec MUST include the sections below in this order. Sections may be expanded with
sub-sections; none may be omitted. Add `N/A — explained why` rather than silently skipping.

```markdown
---
name: F{NN}-{kebab-slug}
spec:
  id: F{NN}
  title: {Human title}
  pillar: P{N}        # or "cross-cutting"
  domain: product
  status: draft       # scaffold | draft | review | accepted | implementing | landed | superseded | retired
  owner: product-architecture
  last_reviewed: YYYY-MM-DD
  upstream_dependencies:
    - product/Broader-feature-product
    - vision-application/{relevant vision file(s)}
    - {other architecture specs}
  downstream_dependencies:
    - product/features/{other feature(s) that consume this}
  related_protocols: [cognition-packet-protocol, cognitive-event-protocol, ...]
  related_events:    [intent.*, context.*, memory.*, ...]
  related_runtime_systems: [cognitive-unit-runtime, cognitive-scheduler, world-state-graph, ...]
  related_governance_systems: [governance-kernel, capability-envelope, human-governance, ...]
  related_observability_systems: [cognitive-observability, reasoning-trace, learner-outcome-telemetry]
  semantic_tags: [...]
  canonical_references: [...]
---

# F{NN} — {Title}

## 1. Purpose
Why this feature exists, in one paragraph. Tie back to the vision and the master PRD pillar.

## 2. Scope & Boundaries
- **In scope:** the capabilities this spec owns.
- **Out of scope:** what *looks* like it might be here but lives elsewhere — link to the owning spec.
- **Non-goals:** ways this could be misinterpreted that we explicitly reject.

## 3. Personas & Modes
Who uses this, in which modes (Student / Educator / Institution / Organization / Open / etc.),
with which defaults.

## 4. Narrative Experience
The user-facing experience as a narrative — not screens, not APIs. What the human feels and does.

## 5. ULI / UALRCI Hooks
Which parts of the cognitive spine this feature activates (recursive prerequisite discovery, the
seven layers, acceleration strategies, depth-verification gates, research transition, novel
contribution mechanisms).

## 6. Agents Involved
The agents that participate, with their role, activation predicate, and what they emit/subscribe.

## 7. Cognitive OS Primitives Used
The exact COS primitives invoked. Reference `spec/product/Broader-feature-product.md` §14:
Cognitive Identity, Capability Envelope, Context Lease, Intent Lease, Cognition Packet,
Cognitive Event, Memory Mutation, Reasoning Trace, Cognitive Unit ABI, World-State Graph,
Blackboard/Bus, Cognitive Scheduler, Governance Kernel.

## 8. Events, Protocols & State Transitions
- Events emitted (taxonomy aligned with `spec/events/event-taxonomy.md`).
- Protocols invoked.
- State transitions in the world-state graph / learner model / memory.

## 9. Memory & World-State Effects
What this feature writes, updates, consolidates, decays, or redacts. Reference the
Memory Mutation Protocol.

## 10. Governance, Safety, Privacy, Ethics
- Capability requirements.
- Lease semantics.
- Consent posture (especially for minors / institutional contexts).
- Audit & replay obligations.
- Cognitive-safety considerations (recursive stabilization, hallucination containment,
  self-modification limits if DSP is involved).

## 11. Observability
- Reasoning-trace requirements.
- Telemetry/metrics emitted (`learner-outcome-telemetry`, `cognitive-observability`).
- Replay determinism level required.

## 12. Failure Semantics
- Failure modes.
- Retry / degradation / recovery / rollback behavior.
- Observability during failure.

## 13. Architecture Conformance Statement
Restate the subset of the ten non-negotiable laws (blueprint §25.4) this feature must honor and
*how* it honors each.

## 14. Success Metrics
North-star metric(s) tied back to the product North Star, plus operational quality signals.

## 15. MVP → Advanced → Frontier Phasing
- **MVP slice:** the minimum that proves the feature.
- **Advanced:** the depth that delivers the promise.
- **Frontier:** the long-horizon (immersive, federated, twin-grade) extension.

## 16. Open Questions
Specific, listable open questions with proposed resolution paths.

## 17. References
Specific section pointers into the master PRD, vision sources, and architecture specs.
```

## Authoring conventions

- **Frontmatter is mandatory.** It is parsed by the retrieval indexes and the spec-governance
  tooling.
- **Update upstream/downstream links** whenever a spec changes its dependencies.
- **Restate architecture invariants** (do not just link) when listing conformance — readers must be
  able to validate without context-switching.
- **Use narrative for the *experience* sections** (§4) and structured tables for the *mechanics*
  sections (§5–§13).
- **Never collapse multiple features into one spec.** If a feature genuinely subsumes another,
  retire the subsumed one with a `superseded` status and a forwarding pointer; never silently
  delete history.

## How to add a new feature

1. Decide which capability pillar it belongs to. If you would create a new pillar, propose an ADR
   under `spec/architecture-decisions/` first.
2. Copy the template above; choose the next available `F{NN}` ID (do not reuse retired numbers).
3. Add the spec under this folder and link it in:
   - The index table above.
   - [`../Broader-feature-product.md`](../Broader-feature-product.md) §15.
   - [`../README.md`](../README.md).
   - [`spec/indexes/product-feature-index.md`](../../indexes/product-feature-index.md).
   - The Feature Spec Catalog table in `CODEX.md` (`CLAUDE.md` carries no copy — it points to the retrieval index).
4. Validate architecture conformance and move the status forward.
