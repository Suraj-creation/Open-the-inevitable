---
name: cse-foundations
spec:
  id: CSE-001
  title: Cognitive Source Environment — Foundations, Principle Zero, and the Source Laws
  domain: source-environment
  status: draft
  owner: product-architecture
  last_reviewed: 2026-07-09
  upstream_dependencies:
    - next-generation-cognitive-operating-system-blueprint
    - advanced-agent-architecture
    - vision-application/The_Inevitable_Master_Vision
    - product/Broader-feature-product
    - product/features/F15-content-ingestion-knowledge-substrate
    - product/features/F16-cognitive-surface
    - architecture/Cognitive-Architecture
  downstream_dependencies:
    - source-environment/CSE-002-canonical-source-representation
    - source-environment/CSE-008-source-surface-projection
    - architecture-decisions/ADR-0032-cognitive-source-environment
  related_protocols: [cognition-packet-protocol, cognitive-event-protocol, memory-mutation-protocol]
  related_events: [source.*, artifact.*, surface.source.*]
  related_runtime_systems: [world-state-graph, cognitive-unit-runtime, memory-tiers]
  related_governance_systems: [governance-kernel, capability-envelope, human-governance]
  related_observability_systems: [cognitive-observability, reasoning-trace, learner-outcome-telemetry]
  semantic_tags: [source-environment, principle-zero, cognitive-source, foundations, constitution]
  canonical_references:
    - next-generation-cognitive-operating-system-blueprint#25-4
    - product/features/F15-content-ingestion-knowledge-substrate
    - research/cse-draft-v1-2026-07
---

# CSE-001 — Cognitive Source Environment: Foundations

## 1. Purpose

The Cognitive Source Environment (CSE) is the subsystem of the Cognitive Operating System that
**converts external knowledge into internal cognitive growth**. Books, papers, videos, websites,
code, datasets, images, presentations, conversations — and eventually people — do not become files
the system stores. They become living cognitive environments: canonical, multi-layer, anchored,
agent-ready representations that teach, challenge, remember, and evolve with each learner.

CSE is not a document feature, a retrieval layer, or a smarter upload flow. It is the bridge
between humanity's accumulated knowledge and a learner's evolving understanding — and, over the
long horizon, between humanity's accumulated knowledge and its future discoveries.

This domain (`spec/source-environment/`, CSE-001…CSE-010) is the architectural law for that
bridge. Product law for ingestion remains
[F15](../product/features/F15-content-ingestion-knowledge-substrate.md); this domain gives F15 the
architectural depth it points at, exactly as `spec/surface/` gives F16 its depth.

## 2. Principle Zero

> **Knowledge sources are not the primary objects of the system. Human understanding is.**

Documents, videos, codebases, and conversations are external manifestations of knowledge. They
matter only insofar as they can shape, expand, test, correct, or reorganize a learner's internal
model of a domain.

Architectural consequences — each is enforced by a later spec in this domain:

1. **The system stores understanding, with sources as evidence.** The primary write target of any
   source interaction is the learner's world-state (concepts, mastery, misconceptions, episodes),
   never "the file plus metadata." (CSE-005)
2. **The canonical representation splits along the Principle Zero seam.** Layers that describe
   what a source *is* (structure, semantics, visuals, citations) are **shared** — computed once
   per source version, cacheable across all learners. Layers that describe what a source *does
   for this person* (meaning emphasis, cognitive binding, episodes) are **learner-conditioned**
   projections. The two must never be conflated in storage, consistency, or cost models. (CSE-002)
3. **Retrieval is a means, not an end.** The end is a change in what the learner can predict,
   explain, and do. Every pipeline, agent, and surface behavior is evaluated by its effect on the
   learner's model of the world, not by its coverage of the source. (CSE-010 metrics)
4. **Where a design choice would optimize source coverage over learner understanding, this
   domain favors understanding.**

## 3. Position within the Cognitive Operating System

Terminology reconciliation (canonical for this domain):

- **UCI — Universal Cognitive Infrastructure** is the mission-level name for the whole endeavor
  (used by the vision corpus and the Cognitive Design Language).
- **COS — Cognitive Operating System** is the architectural realization of UCI: the substrate of
  kernel primitives, protocols, events, memory, world-state, orchestration, and governance.
- **ULI — Universal Learning Intelligence** is the pedagogical intelligence that runs *on* the COS.
- **CSE** is a first-class COS subsystem. It is substrate-side (canonical representations,
  protocols, events) plus a projection seam onto the Cognitive Surface. Dependencies point
  inward: CSE depends on kernel/protocol/memory/world-state contracts; no vendor, parser, or
  model leaks past its adapter (CLAUDE.md §2).

The founding draft (preserved at `spec/research/cse-draft-v1-2026-07.md`) described six
subsystems. Five of the six already exist in this repository. This mapping is binding — CSE must
integrate with these, never re-implement them:

| Draft subsystem | Realized by |
|---|---|
| **CSE** — Cognitive Source Environment | **This domain** (`spec/source-environment/`) |
| **UCS** — Universal Cognitive Surface | `spec/surface/` (SRF-001…006), F16, ADR-0030 frames/MCCR/narration |
| **PCM** — Persistent Cognitive Memory | `spec/memory/memory-tiers.md`, `spec/persistence/` (DPS-001…005), F05 |
| **CAE** — Cognitive Agent Ecosystem | F06/F07, `spec/orchestration/` (proposal blackboard, ADR-0018/0025) |
| **CO** — Cognitive Observatory | `spec/observability/`, `surface.agent.*` observability events (ADR-0029), Observatory UI |
| **RIL** — Research & Innovation Layer | F10, research mode & readiness gating (ADR-0026), `surface.research.*` |

CSE also activates **Layer 3 (Knowledge Layer)** of the emergent cognitive architecture
(`spec/architecture/Cognitive-Architecture.md`, ADR-0023), whose stated trigger is "real external
content ingestion begins." CSE is that beginning.

## 4. Category Definition — What Is a Cognitive Source

> **A Cognitive Source is any external artifact, medium, or interaction surface that can be
> transformed into a living cognitive environment.**

The category spans, without limit: books, PDFs, research papers, technical reports, presentations,
whiteboard photos, images/figures/charts/tables, video lectures, podcasts, audio notes, websites,
documentation, repositories, codebases, notebooks, datasets, CAD models, medical images, personal
notes and journals, institutional corpora — and, under explicit consent (CSE-002 §8), human beings:
mentors, professors, communities, recorded conversations.

Internally, none of these remain inert files. Each becomes a **Canonical Source Environment**
(CSE-002): versioned, anchored, layered, inspectable, transformable, and bound into long-term
cognition. All modalities share one canonical shape; downstream systems (surface, memory, agents,
observability, research) never branch on file type.

## 5. The Cognitive Source Constitution

Enduring design commitments — not features, not phases. Every capability in this domain is checked
against them. They refine, and never override, the blueprint's ten invariants (§25.4).

| # | Principle |
|---|---|
| 1 | **Understanding before optimization.** Depth of comprehension outranks speed of consumption. |
| 2 | **Evidence before assertion.** Every explanation is traceable to a source anchor or explicitly marked as inference or frontier content. |
| 3 | **Human agency before automation.** The learner governs what is remembered, forgotten, automated, and shown — cheaply, at the point of relevance. |
| 4 | **Transparency before persuasion.** The system explains its reasoning before it tries to convince; every adaptation is disclosed. |
| 5 | **Learning before dependency.** Every interaction should increase the learner's independent capability, never their reliance on the system to think for them. |
| 6 | **Compounding before repetition.** Each session builds on the last through episodes and understanding deltas, never resets. |
| 7 | **Research before certainty.** Open questions and disagreement are surfaced honestly, never smoothed over. |
| 8 | **Adaptation before standardization.** One learner's path is not another's; sequencing, modality, and pacing resist one-size-fits-all. |
| 9 | **Silence before interruption.** The system defaults to silence and lets the learner pull; unsolicited pushes are budgeted, timed, and always logged. |

Purpose statement, if only one sentence may be kept:

> *The purpose of the Cognitive Source Environment is not to replace human cognition, but to
> cultivate, amplify, and continuously develop it — from first understanding to original
> discovery — while preserving human agency, transparency, and intellectual independence.*

## 6. The Cognitive Source Laws

Every Cognitive Source in the system must satisfy these invariants. They are design constraints
enforced by contracts and tests, not optional features.

| Law | Meaning | Enforced by |
|---|---|---|
| **Grounded** | Every explanation, overlay, comparison, or transformation is traceable to evidence via source anchors, or explicitly classed as inference/frontier. | CSE-002, CSE-008 |
| **Anchored** | Every reference into a source resolves through a typed, versioned Source Anchor — never a page number, pixel offset, or timestamp alone. | CSE-002 §5 |
| **Observable** | Every cognitive decision — why this paragraph, why this analogy, why this prerequisite — is inspectable through reasoning traces and events. | CSE-007, blueprint law 10 |
| **Transformable** | Knowledge is representable in multiple forms under a declared meaning-preservation contract. | CSE-004 |
| **Adaptive** | Presentation, pacing, modality, and teaching strategy evolve with the learner's development state. | CSE-005, CSE-007 |
| **Persistent** | Interactions accumulate into episodic memory through typed memory mutations, never disposable sessions. | CSE-005, blueprint law 2 |
| **Progressive** | A source is usable the moment its shallowest layer exists; deeper canonicalization continues in the background, prioritized by learner attention. | CSE-002 §4 |
| **Research-aware** | Every concept can connect to current developments, debates, and open questions through frontier overlays. | CSE-006 |
| **Compounding** | Each interaction improves future learning — for this learner always; for others only through governed, privacy-preserving evolution. | CSE-005, CSE-006 §7 |
| **Agent-orchestrated** | Specialized agents collaborate around the same source and learner state through the proposal blackboard, never as disconnected outputs. | CSE-007 |
| **Replayable** | Every source interaction, viewport, highlight, and enrichment decision is event-sourced and deterministically replayable. | CSE-002, CSE-008, blueprint law 9 |
| **User-controlled** | Privacy, memory, personalization, consent, and visibility remain under learner governance; forgetting is real deletion with cascade. | CSE-002 §8, CSE-005 §7 |

Code or content that violates these laws is invalid implementation even if it works locally.

## 7. Scope & Non-Goals

**In scope for this domain:** canonical source representation and progressive canonicalization
(CSE-002); the Meaning Representation Layer (CSE-003); the transformation algebra (CSE-004);
episode-centered memory and cognitive development state (CSE-005); living knowledge, claims, and
frontier overlays (CSE-006); the per-source agent society and interruption law (CSE-007); the
source↔surface projection seam — viewports, highlights, synchronization (CSE-008); the experience
catalog of projection archetypes (CSE-009); delivery phases and metrics (CSE-010).

**Out of scope (owned elsewhere):** the surface runtime, frames, and streaming (spec/surface/);
memory tier mechanics (spec/memory/); orchestration/arbitration mechanics (spec/orchestration/);
visual design law (spec/design/ — CDL); mastery/assessment verification depth (F14); research-mode
gating mechanics (ADR-0026).

**Non-goals — explicitly rejected interpretations:**

- CSE is **not a document viewer** or a "document mode." There are no separate pages or isolated
  viewers; sources render *inside* the Cognitive Surface as projections of canonical state.
- CSE is **not chat-grounded-in-documents.** Dialogue is one tool inside the environment, never
  the container. (The NotebookLM comparison is made here once, for grounding, and never again.)
- CSE is **not a summarizer.** It never merely compresses a source; it decides — observably —
  what enrichment serves understanding.
- CSE does **not** rewrite sources. The original artifact is sacred and renders faithfully;
  cognition is a non-destructive layer around it.

## 8. Conformance to the Ten Invariants (blueprint §25.4)

| # | Invariant | How CSE honors it |
|---|---|---|
| 1 | No direct agent-to-agent calls without protocol/event visibility | Source agents coordinate via the proposal blackboard; negotiation is evented (CSE-007) |
| 2 | No memory write without Memory Mutation | Episodes, annotations, and learner-source associations commit only through typed mutations (CSE-005) |
| 3 | No long-running workflow without Intent Lease | Canonicalization runs and frontier refresh loops hold intent leases (CSE-002 §6, CSE-006) |
| 4 | No context access without Context Lease | Source layers and learner state are retrieved under context leases (CSE-002, CSE-007) |
| 5 | No side-effecting tool call without governance decision | Parsers, OCR, web fetch, and playback side effects are capability-gated tool invocations (CSE-002 §7) |
| 6 | No agent runtime without manifest/identity/envelope | Source-scoped units and agents declare manifests and envelopes (CSE-007) |
| 7 | No architecture evolution without Evolution Proposal | Aggregate instructional improvement flows only through the EvolutionEngine (CSE-006 §7) |
| 8 | No high-risk output without evidence requirements | Grounded claims require anchors; unprovenanced content cannot ground claims (CSE-002, F15) |
| 9 | No hidden state mutation outside event sourcing | Every layer construction, viewport, highlight, and decision is an event; layout-only state is explicitly non-canonical (CSE-008) |
| 10 | No production cognitive unit without observability contract | Every CSE unit emits reasoning traces and family-registered events (CSE-002 §9, CSE-007) |

## 9. References

- `spec/research/cse-draft-v1-2026-07.md` — the founding consolidated draft this domain supersedes.
- `spec/product/features/F15-content-ingestion-knowledge-substrate.md` — product law for ingestion.
- `spec/product/features/F16-cognitive-surface.md`, `spec/surface/` — the surface CSE projects onto.
- `spec/architecture/Cognitive-Architecture.md` — Layer 3 activation.
- `spec/architecture-decisions/ADR-0032-cognitive-source-environment.md` — the adopting decision.
