# `spec/source-environment/` — The Cognitive Source Environment (CSE)

> One-sentence purpose: **this domain owns how external knowledge becomes internal cognitive
> growth** — the conversion of every artifact of human knowledge (books, papers, videos, websites,
> code, datasets, conversations, and eventually people) into living, anchored, agent-orchestrated
> cognitive environments on the Cognitive Surface.

CSE is a first-class subsystem of the Cognitive Operating System, adopted by
[ADR-0032](../architecture-decisions/ADR-0032-cognitive-source-environment.md). It is the
architectural depth behind the product law of
[F15 — Content Ingestion](../product/features/F15-content-ingestion-knowledge-substrate.md),
exactly as `spec/surface/` is the depth behind F16.

## Read first

1. [`CSE-001-foundations.md`](./CSE-001-foundations.md) — Principle Zero, the Constitution, the
   Source Laws, position within the COS, non-goals. **Everything else assumes it.**
2. [`CSE-002-canonical-source-representation.md`](./CSE-002-canonical-source-representation.md) —
   the canonical shape, the eight layers, progressive canonicalization, and the **Source Anchor**
   (the domain's load-bearing primitive).
3. [`CSE-008-source-surface-projection.md`](./CSE-008-source-surface-projection.md) — the seam
   with the Cognitive Surface: semantic viewports, semantic highlights, the attention contract.
4. The remaining specs in numeric order, as your work requires.

Upstream law this domain obeys: blueprint §25.4 (ten invariants), `spec/surface/` (SRF-001…006),
ADR-0030 (frames/MCCR/narration), ADR-0033 (the Cognitive Theater), `spec/memory/`,
`spec/world-state/`, ADR-0021 (evolution), ADR-0026 (research gating), ADR-0027 (evaluation), and
the CDL (`spec/design/`, incl. v3 multi-sensory scope).

Delivery, backend, and phase sequencing:
[`spec/implementation-roadmaps/cse-cognitive-theater-and-backend.md`](../implementation-roadmaps/cse-cognitive-theater-and-backend.md)
(the persistence graduation to Supabase-first is ADR-0034).

## Doctrine

- **Principle Zero:** sources are evidence; understanding is the substrate. Shared source layers
  and learner-conditioned layers never conflate (CSE-001 §2).
- **Anchored:** every reference into a source resolves through a Source Anchor — never a bare
  page number, pixel offset, or timestamp (CSE-002 §5).
- **Progressive:** a source is usable at its shallowest layer; deep canonicalization follows
  learner attention (CSE-002 §4).
- **Projection, not panels:** sources render inside the surface as frames/events; layout is never
  canonical (CSE-008 §2).
- **Silence before interruption:** unsolicited initiative is budgeted and logged (CSE-007 §6).
- **Spec-first:** if a decision changes canonicalization, anchors, events, memory behavior, or
  projection semantics, update the owning spec here first, then the indexes, then implement.

## Contents

| ID | File | Owns | Status |
|---|---|---|---|
| CSE-001 | [CSE-001-foundations.md](./CSE-001-foundations.md) | Thesis, Principle Zero, Constitution, Source Laws, COS position, non-goals | draft |
| CSE-002 | [CSE-002-canonical-source-representation.md](./CSE-002-canonical-source-representation.md) | Source identity/versions, eight layers, progressive canonicalization, Source Anchors, `source.*` events, human-source consent | draft |
| CSE-003 | [CSE-003-meaning-representation-layer.md](./CSE-003-meaning-representation-layer.md) | MeaningUnits: intent, causality, analogy, abstraction, counterfactuals, misconception hypotheses | draft |
| CSE-004 | [CSE-004-transformations.md](./CSE-004-transformations.md) | The five core transformations, transformation laws, registry, Concept Replay substrate | draft |
| CSE-005 | [CSE-005-episodic-cognition.md](./CSE-005-episodic-cognition.md) | Episodes, Understanding Deltas, development ladder, world model, thinking patterns, real forgetting | draft |
| CSE-006 | [CSE-006-living-knowledge.md](./CSE-006-living-knowledge.md) | Claim graph, frontier overlays, temporal knowledge, governed instructional evolution | draft |
| CSE-007 | [CSE-007-source-agent-society.md](./CSE-007-source-agent-society.md) | Agent activation, Enrichment Decision loop, pedagogy policies, the interruption law | draft |
| CSE-008 | [CSE-008-source-surface-projection.md](./CSE-008-source-surface-projection.md) | Semantic viewports, semantic highlights, attention contract, `surface.source.*`, modality specifics, multi-source alignment | draft |
| CSE-009 | [CSE-009-experience-catalog.md](./CSE-009-experience-catalog.md) | Projection archetypes (Living Reference, Replay Rail, Time Machine, Teaching Theatre, …) and cross-cutting UX patterns | draft |
| CSE-010 | [CSE-010-delivery.md](./CSE-010-delivery.md) | Phases CSE-P1…P6, success metrics, consolidated risks, verification bar | draft |

### The Cognitive Theater (ADR-0033)

| ID | File | Owns | Status |
|---|---|---|---|
| CSE-011 | [CSE-011-cognitive-director.md](./CSE-011-cognitive-director.md) | The conductor: cross-scale cognitive-state orchestration, pacing, the affective/attention channel | draft |
| CSE-012 | [CSE-012-cognitive-scene.md](./CSE-012-cognitive-scene.md) | Frames elevated to living, inhabitable Scenes with actors, lighting, and in-place evolution | draft |
| CSE-013 | [CSE-013-knowledge-cinematography.md](./CSE-013-knowledge-cinematography.md) | The shot grammar of understanding (semantic zoom, spotlight, dissolve, hold…) as pedagogy | draft |
| CSE-014 | [CSE-014-cognitive-interaction-grammar.md](./CSE-014-cognitive-interaction-grammar.md) | ~25 semantic interaction primitives as cognitive intent, not UI manipulation | draft |
| CSE-015 | [CSE-015-source-fusion.md](./CSE-015-source-fusion.md) | Many sources reconciled into one cognitive environment (beyond side-by-side alignment) | draft |
| CSE-016 | [CSE-016-creative-cognition.md](./CSE-016-creative-cognition.md) | Creation (writing, hypothesis, design, invention) as a first-class cognitive capability | draft |

### Acquisition (ADR-0056)

| ID | File | Owns | Status |
|---|---|---|---|
| CSE-017 | [CSE-017-source-dock.md](./CSE-017-source-dock.md) | The Source Dock — learner-facing acquisition: upload/crawl/paste, the honest loading narrative, auto-attach, honest refusal | draft |

### Representation Intelligence (ADR-0058)

| ID | File | Owns | Status |
|---|---|---|---|
| CSE-018 | [CSE-018-representation-intelligence.md](./CSE-018-representation-intelligence.md) | The Representation Intelligence Agent (RIA) — the `RepresentationPlan`, the ten representation laws, MCCR 2.0 grammars; cognitive intent → the clearest multimodal representation | draft |

## Lineage

This domain supersedes the consolidated founding draft, preserved verbatim at
[`spec/research/cse-draft-v1-2026-07.md`](../research/cse-draft-v1-2026-07.md) (originally
`Cognitive-Source-Environment-Specification.md` at the repository root). The draft's six-subsystem
decomposition maps onto existing COS domains per CSE-001 §3; its Part III UI specification is
re-expressed as projection archetypes in CSE-008/CSE-009.
