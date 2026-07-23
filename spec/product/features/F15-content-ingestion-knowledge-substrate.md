---
name: F15-content-ingestion-knowledge-substrate
spec:
  id: F15
  title: Content Ingestion & Universal Knowledge Substrate
  pillar: cross-cutting
  domain: product
  status: draft
  owner: product-architecture
  last_reviewed: 2026-06-03
  upstream_dependencies:
    - product/Broader-feature-product
    - product/features/F02-dynamic-cognitive-navigation
    - product/features/F03-recursive-prerequisite-intelligence
    - product/features/F05-persistent-cognitive-memory
    - product/features/F08-interdisciplinary-knowledge-graph
    - world-state/world-state-graph
    - protocols/cognition-packet-protocol
    - protocols/memory-mutation-protocol
  downstream_dependencies:
    - product/features/F04-adaptive-multimodal-explanation
    - product/features/F09-living-universe-experience
    - product/features/F10-research-innovation-acceleration
    - product/features/F11-institutional-collective-intelligence
    - source-environment/CSE-002-canonical-source-representation
  related_protocols: [cognition-packet-protocol, cognitive-event-protocol, memory-mutation-protocol, reasoning-trace-protocol]
  related_events: [artifact.ingested, artifact.parsed, artifact.graph.constructed, source.attributed, provenance.recorded, ingestion.rejected]
  related_runtime_systems: [world-state-graph, cognitive-unit-runtime, cognitive-scheduler, deterministic-execution-engine]
  related_governance_systems: [governance-kernel, capability-envelope, consent-policy, human-governance]
  related_observability_systems: [cognitive-observability, otel-edge, reasoning-trace, learner-outcome-telemetry]
  semantic_tags: [ingestion, documents, source-grounding, universal-knowledge-substrate, provenance, scraping, artifacts]
  canonical_references:
    - product/Broader-feature-product#11-1-content-material--knowledge-substrate
    - vision-application/Vision#xiii-global-repository-of-knowledge
---

# F15 — Content Ingestion & Universal Knowledge Substrate

## 1. Purpose

F15 defines how external knowledge enters the Cognitive OS. PDFs, DOCX files, text, classroom
audio, web pages, papers, whiteboard artifacts, videos, and future multimodal inputs do not become
passive files. They become source-attributed, graph-connected, explainable objects in the
learner-specific knowledge substrate.

The product outcome is universal knowledge access: anything a learner brings can be understood,
decomposed, linked, explained, remembered, and governed.

## 2. Scope & Boundaries

- **In scope:** artifact ingestion, parsing, source attribution, provenance, document concept graph
  construction, select-to-expand semantics, deduplication, conflict detection, and governed web
  ingestion.
- **Out of scope:** explanation delivery (F04), visual artifact surface (F09), long-term memory
  consolidation policy (F05), and research synthesis beyond source grounding (F10). The
  architectural depth downstream of acquisition — canonical source representation, Source
  Anchors, progressive canonicalization, and source–surface projection — is owned by
  `spec/source-environment/` (CSE-001…CSE-010, ADR-0032).
- **Non-goals:** storing raw content without provenance, scraping without policy, or treating
  ingestion as a simple file upload.

## 3. Personas & Modes

| Persona / mode | Ingestion posture |
|---|---|
| Student | Upload books, notes, PDFs, syllabus, and get selectable concept maps |
| Educator | Ingest lecture materials and live class streams into Living Notebooks |
| Researcher | Ingest papers, datasets, and literature sets with citation rigor |
| Institution | Govern curriculum corpora, internal knowledge, and cohort materials |
| Open Mode | Ephemeral ingestion allowed when the user does not want memory persistence |

## 4. Narrative Experience

A learner uploads a chapter. The platform reads it end-to-end, identifies key terms, maps every
concept to prerequisites, attributes sources, and opens a split pane: document on one side, living
explanation graph on the other. Select a paragraph and the system can explain, simplify, connect,
practice, or turn it into a timeline. In class, spoken lecture becomes notes, concept links,
question banks, and later a Contemporary Book that reflects what was actually taught.

## 5. ULI / UALRCI Hooks

- ULI decomposes ingested artifacts into prerequisite graphs and zero-knowledge paths.
- UALRCI uses ingested material for transfer learning, spaced repetition, and research transition.
- F10 depends on source-grounded ingestion for papers and frontier mapping.
- F08 uses artifact graphs to discover interdisciplinary bridges.

## 6. Agents Involved

| Agent | Role |
|---|---|
| Ingestion / Parser Agent | Converts artifacts into structured packets and graph candidates |
| Curriculum Agent | Builds prerequisite paths from ingested concepts |
| Explanation Agent | Explains selected spans and concepts |
| Memory Agent | Commits durable artifact memories and provenance |
| Research Agent | Handles paper/literature ingestion and citation maps |
| Socio-Ethical Agent | Reviews sensitive or restricted material |
| Supervisor | Applies source, consent, and capability policy |

## 7. Cognitive OS Primitives Used

- **Cognition Packet** represents artifact chunks, parsed spans, source metadata, and user
  selections.
- **Cognitive Event** records ingestion lifecycle and provenance.
- **World-State Graph** stores artifact nodes, concept nodes, source edges, prerequisite edges, and
  conflicts.
- **Memory Mutation** stores durable summaries, user associations, and learned provenance.
- **Reasoning Trace** explains parsing, graph construction, deduplication, and conflict resolution.
- **Capability Envelope** governs file, web, and corpus access.

## 8. Events, Protocols & State Transitions

Emits:

- `artifact.ingested`, `artifact.parsed`, `artifact.rejected`
- `artifact.graph.constructed`, `artifact.graph.updated`
- `source.attributed`, `provenance.recorded`, `citation.linked`
- `document.span.selected`, `document.span.explained`
- `ingestion.conflict.detected`, `ingestion.conflict.resolved`
- `web.ingestion.requested`, `web.ingestion.approved`, `web.ingestion.denied`

State transitions:

1. Raw artifact -> parsed artifact with provenance.
2. Parsed artifact -> concept graph candidates.
3. Candidates -> world-state graph deltas after validation.
4. Useful artifact knowledge -> memory consolidation through F05.

## 9. Memory & World-State Effects

The world-state graph records artifact structure, concept extraction, prerequisite links, source
lineage, and conflicts. Memory stores durable learner associations, summaries, annotations, and
artifact usage patterns only through mutation. Raw artifact content may be retained, transformed,
or discarded according to consent, copyright, institution policy, and storage constraints.

## 10. Governance, Safety, Privacy, Ethics

- Web and corpus ingestion require capability checks and source attribution.
- Copyrighted or restricted materials follow policy; ingestion does not imply redistribution.
- Sensitive personal or institutional documents require stricter consent and retention.
- Source provenance is mandatory; generated answers must cite ingestion lineage.
- Learners can delete or detach personal artifacts; institutions govern institutional corpora.

## 11. Observability

- Telemetry: parse success, concept extraction quality, graph validation rate, citation coverage,
  conflict rate, select-to-expand usefulness, and ingestion-to-mastery lift.
- Reasoning traces: mandatory for graph construction, source resolution, and conflict resolution.
- Replay determinism: **full** for artifact lifecycle events and graph deltas if artifact snapshots
  are retained; **trace-level** when external web content changes after ingestion.

## 12. Failure Semantics

| Failure | Behavior |
|---|---|
| Artifact parse fails | Preserve raw artifact if allowed, ask for alternate format, emit failure |
| Source provenance missing | Do not use artifact for grounded claims until provenance is resolved |
| Graph extraction conflicts | Mark conflict, route to validation or human review |
| Web ingestion denied | Explain policy and offer allowed alternatives |
| Artifact contains sensitive data | Apply stricter envelope, pause memory consolidation, request consent |

## 13. Architecture Conformance Statement

- Ingestion produces typed packets and events.
- Graph construction is a world-state delta, not hidden parser state.
- Durable artifact knowledge enters memory only through Memory Mutation.
- Source provenance and reasoning traces are mandatory for grounded answers.
- External access is capability-governed.
- Replays can reconstruct what artifact knowledge was available at a given time.

## 14. Success Metrics

- Source attribution coverage = 100% for accepted ingested artifacts.
- Concept graph extraction quality > 85% against reviewed samples.
- Select-to-expand usefulness > 80%.
- Ingestion-to-timeline latency within product budget for MVP artifact sizes.
- Zero grounded-answer claims from unprovenanced artifacts.

## 15. MVP -> Advanced -> Frontier Phasing

- **MVP:** PDF/DOCX/text ingestion, source metadata, concept extraction events, select-to-expand,
  and world-state graph deltas.
- **Advanced:** live classroom transcription, Living Notebooks, question banks, exam papers,
  source conflict resolution, and research-paper ingestion.
- **Frontier:** universal web/corpus ingestion, multimodal/sensor ingestion, federated knowledge
  corpora, and institution-scale Contemporary Books.

## 16. Open Questions

- Which artifact formats are Phase 1E MVP versus roadmap?
- What provenance schema is canonical across files, web, classroom audio, and generated artifacts?
- How should copyright and redistribution constraints be encoded in capability envelopes?
- What graph extraction quality threshold is required before learner-facing use?

## 17. References

- `spec/product/Broader-feature-product.md` §11.1.
- `spec/vision-application/Vision.md` §XIII and §XXXVIII.
- `spec/world-state/world-state-graph.md`.
- `spec/protocols/memory-mutation-protocol.md`.
