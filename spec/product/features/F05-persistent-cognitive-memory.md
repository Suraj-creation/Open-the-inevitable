---
name: F05-persistent-cognitive-memory
spec:
  id: F05
  title: Persistent Cognitive Memory System
  pillar: P5
  domain: product
  status: draft
  owner: product-architecture
  last_reviewed: 2026-06-02
  upstream_dependencies:
    - product/Broader-feature-product
    - memory/
    - world-state/
    - protocols/memory-mutation-protocol
    - storage/
    - events/
  downstream_dependencies:
    - product/features/F01-cognitive-onboarding
    - product/features/F02-dynamic-cognitive-navigation
    - product/features/F03-recursive-prerequisite-intelligence
    - product/features/F04-adaptive-multimodal-explanation
    - product/features/F06-specialized-agent-ecosystem
    - product/features/F07-realtime-cognitive-orchestration
    - product/features/F11-institutional-collective-intelligence
    - product/features/F12-collective-cognitive-evolution
    - product/features/F15-content-ingestion-knowledge-substrate
  related_protocols: [memory-mutation-protocol, cognitive-event-protocol, reasoning-trace-protocol]
  related_events: [memory.committed, memory.updated, memory.consolidated, memory.decayed, memory.redacted, memory.queried, memory.subscription.fanout]
  related_runtime_systems: [world-state-graph, cognitive-scheduler]
  related_governance_systems: [governance-kernel, human-governance, capability-envelope]
  related_observability_systems: [cognitive-observability, reasoning-trace, learner-outcome-telemetry]
  semantic_tags: [memory, hierarchical-memory, semantic-compression, consolidation, decay, redaction, distributive-subscription]
  canonical_references:
    - product/Broader-feature-product#9-the-memory-architecture
    - vision-application/The_Inevitable_Master_Vision#9-persistent-cognitive-memory-system
---

# F05 — Persistent Cognitive Memory System

## 1. Purpose

The **single most-emphasized infrastructure requirement** of the platform: after any session, the
system stores **only what matters** in the most efficient compressed semantic form, and *every
agent* — Research, Revision, Motivation, Curriculum, Innovation, Identical — receives the relevant
slice of that memory in real time as it forms. Memory is the connective tissue of cognition; this
feature is its specification.

Memory here is **not** chat history. It is a hierarchical, cognition-aware, *distributive* substrate
that is event-sourced, replayable, reversible, decayable, redactable, and projected into the
unified world-state graph. No agent ever writes to a store directly. No memory exists without
provenance.

## 2. Scope & Boundaries

- **In scope:** memory tiers (working, episodic, semantic, procedural, reflective, collective);
  semantic compression; mutation, consolidation, decay, and redaction policies; the
  subscription/fanout model that delivers memory deltas to agents in real time; query and
  retrieval contracts; cross-session continuity; the boundary between memory and the event store.
- **Out of scope:** the storage backends (`spec/storage/`); the world-state graph schema
  (`spec/world-state/`); the Memory Mutation Protocol wire format (`spec/protocols/memory-mutation-protocol.md`);
  the curriculum-specific learner model (F03 + `spec/curriculum/`).
- **Non-goals:** raw chat log retention; surveillance-grade observation; "we keep everything just
  in case."

## 3. Personas & Modes

| Persona | Posture |
|---|---|
| Child | Strict default consent; minor-protection retention windows; collective aggregation off |
| Student / individual | Standard tiers; learner-owned inspection & erasure |
| Educator | Memory write-back for teaching signatures (F04); cohort memory is institution-scoped |
| Institution | Owns its institutional memory substrate; governs cohort retention |
| Researcher | Same as individual; research-context tiers may be longer-retention by request |

## 4. Narrative Experience

The learner does not "manage memory" except when they want to: they can ask *"what do you remember
about me?"* and receive an inspectable, editable view of the learner model — every belief the
system holds about them, every memory that produced it, every chance to redact. Day-to-day, the
experience is silent continuity: weeks later, the platform knows exactly where you stopped, what
felt hard, what landed, what you said you cared about — and uses that to skip nothing and waste
nothing.

The subscription model means an agent that needs to act *now* (e.g., the Research Agent
surfacing a frontier breadcrumb because the learner just engaged with a relevant concept) does so
within the same beat — not because it polled, but because it subscribed to that memory stream.

## 5. ULI / UALRCI Hooks

- The **learner model** that ULI consults to know where the learner stands is a projection of this
  memory substrate.
- UALRCI's **spaced repetition** uses decay modeling that lives here.
- UALRCI's **transfer-learning exploitation** reads existing-knowledge facts from semantic memory.
- The Stage 5–6 research transition draws on **reflective** memory (learner's own
  meta-cognitive history).

## 6. Agents Involved

| Agent | Role |
|---|---|
| **Memory Agent** | Sole writer to memory tiers (through Memory Mutation Protocol) |
| **Supervisor** | Authorizes subscriptions; arbitrates retention conflicts |
| **All other agents** | Subscribers and (via the protocol) proposers of memory writes; never direct writers |

## 7. Cognitive OS Primitives Used

- **Memory Mutation Protocol** — the sole write path.
- **World-State Graph** — projection target; learner model is a graph view.
- **Cognitive Event** — every memory operation emits an event.
- **Reasoning Trace** — every consolidation / decay / redaction decision emits a trace with
  evidence.
- **Capability Envelope** — agents subscribe to memory streams only within their envelope's
  scope.

## 8. Events, Protocols & State Transitions

Emits: `memory.committed`, `memory.updated`, `memory.consolidated`, `memory.decayed`,
`memory.redacted`, `memory.queried`, `memory.subscription.opened`, `memory.subscription.fanout`,
`memory.subscription.closed`.

Tier transitions (canonical):

- **Working** (in-session, ephemeral) → episodic on session close (if signal threshold met).
- **Episodic** (per-session lived experience) → semantic on consolidation (compressed meaning).
- **Procedural** (how-to fluencies) — written when mastery checkpoints (F14) pass.
- **Reflective** (meta-cognitive: what the learner believes about their own learning) — written
  on explicit reflection events.
- **Collective** (anonymized, aggregated patterns) — written through the institutional /
  collective pipeline with double consent.

## 9. Memory & World-State Effects

This feature **is** the effect surface. Every other feature that "writes memory" does so by
emitting a Memory Mutation that F05 commits, projects, and fans out.

## 10. Governance, Safety, Privacy, Ethics

- **Consent**: granular per tier, per agent, per outflow (collective vs. individual). Revocable.
- **Right to inspect & erase**: first-class learner-facing capability; erasure propagates through
  the projection and is auditable in the event store (the audit *fact of erasure* remains;
  the *content* is redacted).
- **Minor and institutional contexts**: stricter retention windows; collective aggregation off
  by default.
- **Source grounding**: every memory carries provenance — which interaction, which agent, which
  evidence.
- **No memory laundering**: an agent cannot promote a private memory to collective without
  passing the double-consent gate.
- **Cognitive safety**: consolidation rules guard against pathological memory bloat or runaway
  reinforcement of incorrect beliefs.

## 11. Observability

- Telemetry: per-tier sizes, compression ratios, decay accuracy, retrieval precision, fanout
  latency, subscription health.
- Replay determinism: **full** — given the event log, memory state at any time-step is
  reconstructible.
- Reasoning traces: mandatory for consolidation, decay, redaction, and any inferred-belief commit.

## 12. Failure Semantics

| Failure | Behavior |
|---|---|
| Mutation rejected (governance) | Atomically failed; emit `memory.mutation.rejected`; surface to learner if user-initiated |
| Storage backend partial failure | Degrade to write-ahead-log only; resume on recovery; emit `memory.degraded` |
| Subscription delivery lag | Buffered redelivery with causality preserved; emit `memory.subscription.delayed` |
| Redaction request fails to propagate | Atomic retry with bounded attempts; if persistent, route to human-governance escalation |
| Consolidation produces a belief that conflicts with prior reflective memory | Mark as semantic conflict; route to `spec/semantic-consistency/` |

## 13. Architecture Conformance Statement

- **No memory write outside Memory Mutation** — strictly enforced; the Memory Agent is the only
  writer.
- **Reasoning traces** on every consolidation/decay/redaction.
- **Capability envelope** gating on subscriptions.
- **Replay determinism** at the full level — memory is a function of the event log.
- **Right-to-erase** is architectural, not optional.

## 14. Success Metrics

- **Retention curves** at 1d / 7d / 30d / 90d / 1y — accurately predicted by the decay model
  (model vs. actual).
- **Compression ratio** vs. raw interaction volume — target ≥ 50× on mature semantic content.
- **Retrieval precision @ k** for memory queries: ≥ 0.9 for top-3.
- **Fanout latency**: median < 100ms; p95 < 500ms.
- **Inspection-and-erasure usage**: > 10% of learners exercise inspection within first month
  (signal of trust + transparency).

## 15. MVP → Advanced → Frontier Phasing

- **MVP:** working + episodic + semantic tiers; consolidation on session close; rule-based decay;
  subscription delivery; learner inspection UI; redaction.
- **Advanced:** procedural + reflective tiers; learned decay; collective tier (anonymized);
  cohort/institutional memory; cross-session continuity hardened.
- **Frontier:** Identical-Agent-grade memory (lifelong personal twin); federated memory across
  institutions; cognitive-filesystem semantic addressing (`spec/cognitive-filesystem/`).

## 16. Open Questions

- The exact compression/consolidation algorithms — needs a benchmark harness owned with F12.
- The boundary between *reflective* and *semantic* tiers in practice — overlap risk.
- Federated memory consent semantics across institutions.

## 17. References

- [`../Broader-feature-product.md`](../Broader-feature-product.md) §9 (Memory Architecture
  overview), §11.1 (Content & Material Substrate), §17.1 (Privacy & Consent UX).
- `spec/memory/`, `spec/world-state/`, `spec/protocols/memory-mutation-protocol.md`,
  `spec/storage/`, `spec/events/`, `spec/cognitive-filesystem/`.
- `spec/vision-application/The_Inevitable_Master_Vision.md` §9 (Persistent Cognitive Memory System).
