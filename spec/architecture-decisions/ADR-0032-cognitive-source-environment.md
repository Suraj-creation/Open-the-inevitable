# ADR-0032: The Cognitive Source Environment as a First-Class COS Subsystem

**Status:** Accepted
**Date:** 2026-07-09
**Related:** ADR-0030 (frames/MCCR/narration), ADR-0024 (interaction protocol), ADR-0007
(choreography), ADR-0021 (governed self-evolution), ADR-0026 (research gating), ADR-0027
(evaluation layer), F15 (content ingestion), F16 (cognitive surface), SRF-001…006

## Context

The mission requires that learners learn *from real knowledge artifacts* — books, papers, videos,
websites, code, datasets, conversations — not only from agent-generated explanation. Today the
repository covers this need only partially and only at the product tier:

- **F15** defines ingestion as a product feature (parse → attribute → graph → select-to-expand)
  but has no owning architectural domain: no canonical representation contract, no addressing
  scheme into sources, no layer semantics, no consent mechanics for human-derived material.
- **The surface** (SRF-001…006, ADR-0030) renders *generated* cognition — frames, MCCR, narration,
  generated media — but has **no primitive for rendering an external source** synchronized with
  narration: no page/region/timestamp addressing, no highlight semantics, no source viewport.
- The emergent cognitive architecture (ADR-0023) reserves Layer 3 (Knowledge) with the explicit
  activation trigger "real external content ingestion begins" — with nothing yet activating it.

A consolidated founding draft ("Cognitive Source Environment & Cognitive Surface, v1.0", now
preserved at `spec/research/cse-draft-v1-2026-07.md`) proposed the missing subsystem with strong
foundations (Principle Zero, a cognitive constitution, source laws, a meaning representation
layer, episode-centered memory, five transformations) but in a form that conflicted with
repository law in specific ways: it re-specified a fixed panel/dock UI shell (violating the
"layout is never canonical" law, D5/SRF-005), described a linear blocking ingestion pipeline
(cost-hostile at book scale), partially re-invented five subsystems that already exist (memory,
agents, observability, research, surface), referenced sources by page/position rather than a
stable addressing primitive, and specified no event sourcing, replay, governance-kernel, or
adapter-seam integration.

## Decision

Adopt the **Cognitive Source Environment (CSE)** as a first-class COS subsystem with its own
architectural domain, `spec/source-environment/` (CSE-001…CSE-010), superseding the draft. The
domain is bound by these locks:

1. **Principle Zero is architectural.** The canonical representation splits into shared
   source-layers (computed once per content-addressed source version, shared across learners) and
   learner-conditioned layers (per-learner projections). (CSE-001, CSE-002)
2. **The Source Anchor is the addressing primitive.** Every reference into any source — highlight,
   citation, narration binding, viewport, episode, claim, overlay — resolves through a typed,
   versioned, multi-selector anchor with pure-function resolution and cross-version migration.
   Bare page numbers, pixel offsets, and timestamps are forbidden as references. (CSE-002 §5)
3. **Canonicalization is progressive and attention-driven.** A source is usable at its shallowest
   layer; deep layers (meaning, cognitive) compute under budgeted intent leases, prioritized by
   learner trajectory; re-enrichment is governed and versioned. No blocking upload gate; no eager
   whole-book deep processing. (CSE-002 §4)
4. **Sources render as projections of the existing surface, never as a document mode.** New
   `source_viewport` MCCR element + `surface.source.*` event subfamily (schema 1.5.0 → 1.6.0);
   semantic viewports, semantic highlights, and the attention contract extend ADR-0030's
   narration-anchor mechanism; layout remains non-canonical; source bytes stay out-of-band
   (SRF-006 rule). (CSE-008)
5. **The Meaning Representation Layer is inference and says so.** MRL units carry provenance
   class, confidence, and anchor evidence; rendered only in the inference channel; validated
   through the evaluation layer (ADR-0027). (CSE-003)
6. **Transformations are contracts.** Five core transformation kinds with declared
   meaning-preservation contracts, refusal-over-approximation, provenance propagation, and
   composability. (CSE-004)
7. **Episodes are memory-tier citizens.** Episode-centered memory and Understanding Deltas commit
   only through typed memory mutations; forgetting is real redaction with cascade; the
   development ladder transitions only on evidence. (CSE-005)
8. **Enrichment flows through the blackboard.** All "what should appear now" decisions — including
   *nothing* — are arbitration outputs (`source.enrichment.decided`), extending the
   decide→record→render pattern of `surface.image.decided`. Unsolicited initiative is governed by
   a single interruption budget with absolute suppression states. (CSE-007)
9. **Aggregate instructional improvement only via the EvolutionEngine** (ADR-0021), with cohort
   minimums and a formal privacy mechanism (blocking ADR before CSE-P4), opt-in per learner.
   (CSE-006 §7)
10. **Human beings become sources only under consent envelopes** — all-party consent for
    multi-party sessions, utterance-scoped exclusions, revocation with full redaction cascade.
    (CSE-002 §8)

F15 remains the product law for acquisition and gains this domain as its architectural depth
(as F16 has `spec/surface/`).

## Alternatives Considered

- **Extend F15 only (no architectural domain).** Rejected: F15 is product-tier; anchors, layer
  contracts, consent cascades, and projection semantics are substrate law that product specs may
  not own (product law is subordinate to architecture law).
- **Author as SRF-007 inside `spec/surface/`.** Rejected: the surface owns projection, but
  canonical representation, anchors, episodes, claims, and canonicalization are not surface
  concerns; a surface-only spec would recreate the draft's category error in reverse. CSE-008 is
  the seam; the `surface.source.*` subfamily lands in SRF-002 at implementation.
- **Adopt the draft as written (workspace shell, linear pipeline, six new subsystems).** Rejected
  for the conflicts enumerated in Context; the draft is preserved as research lineage and its
  experience law is carried forward as projection archetypes (CSE-009).
- **A separate document-viewer application.** Rejected on mission grounds: it would recreate the
  fragmented-surface problem the Cognitive Surface exists to end, and on architectural grounds
  (manifestations depend on the substrate; a viewer app would inevitably grow substrate-bypassing
  state).
- **Chat-grounded-in-documents (NotebookLM shape).** Rejected: dialogue is one tool inside the
  environment, not the container; grounding a chat is not converting knowledge into cognitive
  growth.

## Conformance to the ten invariants (blueprint §25.4)

1. Agent coordination over sources flows through the proposal blackboard with evented
   negotiation — no direct calls (CSE-007).
2. Episodes, annotations, and learner-source associations write only via Memory Mutations
   (CSE-005).
3. Canonicalization runs and frontier refresh loops hold Intent Leases (CSE-002 §6, CSE-006 §4).
4. Layer and learner-state access is Context-Leased (CSE-002 §6, CSE-007 §3).
5. Parsers, OCR, crawlers, and playback side effects are governance-gated tool invocations
   (CSE-002 §7).
6. All CSE units run with manifest, identity, and capability envelope (CSE-002 §6, CSE-007 §3).
7. Instructional evolution occurs only through Evolution Proposals (CSE-006 §7).
8. Grounded claims require resolvable anchors; unprovenanced or degraded-only content cannot
   ground claims (CSE-002, CSE-008 §7).
9. Every layer construction, viewport, highlight, binding, and enrichment decision is
   event-sourced; layout-only state is explicitly non-canonical (CSE-002 §9, CSE-008 §8).
10. Every CSE unit ships observability contracts: reasoning traces, family-registered events,
    telemetry (CSE-002 §11, CSE-007 §7).

## Consequences

**Positive.** The mission-critical gap closes architecturally before code: sources become
first-class citizens of the surface with full replay determinism; Layer 3 of ADR-0023 activates
with a concrete owner; F15 gains depth instead of ambiguity; the draft's genuinely novel
contributions (Principle Zero, MRL, episodes, transformation algebra, source laws) are preserved
and hardened; anchor-based grounding gives every future claim/citation/highlight one primitive.

**Costs / risks.** The domain adds ~10 specs of law that must be kept coherent with `surface/`,
`memory/`, and `world-state/` as they evolve; the `surface.*` schema takes a minor bump (1.6.0)
at CSE-P1; canonicalization economics at scale are designed-for but unproven (progressive +
budgets mitigate); two blocking sub-ADRs are created (page-render pipeline at CSE-P1; aggregation
privacy mechanism before CSE-P4).

**Traceability.** Indexes updated (domain, event, protocol, capability, dependency-graph,
product-feature cross-cuts); `spec/spec-folder-ecosystem.md` inventory gains the domain;
event-taxonomy registers the `source.*` family; F15 gains the downstream dependency.

## Open Questions

Consolidated in CSE-010 §5; the two blocking ones: the page-render fidelity pipeline (CSE-P1) and
the aggregate-learning privacy mechanism (pre-CSE-P4). Non-blocking: `form` type vocabulary for
the transformation algebra, per-modality anchor-stability targets, episode boundary heuristics.
