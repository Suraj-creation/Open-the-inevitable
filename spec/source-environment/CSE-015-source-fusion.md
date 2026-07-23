---
name: cse-source-fusion
spec:
  id: CSE-015
  title: Source Fusion — Many Sources Reconciled into One Cognitive Environment
  domain: source-environment
  status: draft
  owner: product-architecture
  last_reviewed: 2026-07-10
  upstream_dependencies:
    - source-environment/CSE-002-canonical-source-representation
    - source-environment/CSE-003-meaning-representation-layer
    - source-environment/CSE-006-living-knowledge
    - source-environment/CSE-008-source-surface-projection
    - world-state/knowledge-graph-engine
    - product/features/F08-interdisciplinary-knowledge-graph
    - architecture-decisions/ADR-0027-cognitive-evaluation-layer
  downstream_dependencies:
    - source-environment/CSE-009-experience-catalog
    - source-environment/CSE-012-cognitive-scene
    - indexes/event-index
  related_protocols: [cognitive-event-protocol, memory-mutation-protocol, reasoning-trace-protocol]
  related_events: [source.fusion.composed, source.fusion.concept.reconciled, source.fusion.contradiction.surfaced, source.fusion.gap.detected, world.node.created, world.edge.created]
  related_runtime_systems: [world-state-graph, knowledge-graph-engine, cognitive-unit-runtime]
  related_governance_systems: [governance-kernel, capability-envelope]
  related_observability_systems: [cognitive-observability, reasoning-trace]
  semantic_tags: [source-environment, fusion, multi-source, reconciliation, knowledge-graph, contradictions, provenance]
  canonical_references:
    - source-environment/CSE-008-source-surface-projection#10
    - source-environment/CSE-006-living-knowledge#3
    - source-environment/CSE-002-canonical-source-representation#5
---

# CSE-015 — Source Fusion

## 1. Purpose

CSE-008 §10 aligns multiple sources on the same concept side by side. Fusion goes further: it
**reconciles many sources into one coherent cognitive environment** the learner inhabits, where a
concept is understood from all sources at once — complementary explanations woven, contradictions
surfaced, coverage gaps named, evolution across sources visible. The learner experiences *one
understanding*, not a stack of documents (your architectural direction #7).

## 2. Philosophy

- **Understanding is source-agnostic; evidence is not.** The fused concept is the learner's, drawn
  from many sources — but every claim in it remains traceable to the specific source anchor that
  grounds it (Source Law: Grounded). Fusion never blurs provenance; it *organizes* it.
- **Fusion is reconciliation, not averaging.** Where sources agree, fusion strengthens; where they
  differ in emphasis, fusion composes; where they contradict, fusion surfaces the disagreement as
  content (CSE-006), never smooths it into a false consensus.
- **The concept graph is the fusion substrate.** Fusion is expressed as edges and reconciliation
  nodes in the existing world-state/knowledge graph — not a new store. Two sources' treatments of
  "gradient descent" become one concept node with multiple anchored evidence sets.

## 3. Primitives

> **Implementation status.** Deterministic reconciliation (`source_treatments`, corroboration,
> complements, coverage, gaps) landed at **M9 T1** (ADR-0040); the Claim Graph feeding
> `reconciliation.contradictions` at **M9 T2** (ADR-0041); the **`fused_explanation_ref`** — the
> model-backed synthesis citing every contributing source — at **M9 T3** (ADR-0042,
> `source.fusion.synthesized`, grounding + disagreement-honesty gates enforced; the ADR-0027
> entailment judge, reconciliation *edges* §3.2, evolution ordering, and fusion-as-Scene remain
> deferred).

### 3.1 `FusedConcept`

```json
{
  "concept_ref": "the shared concept node",
  "source_treatments": [{ "source_version_id": "...", "anchor_refs": ["..."], "emphasis": "definition|derivation|application|intuition|critique", "coverage": "full|partial|absent" }],
  "reconciliation": {
    "agreements": ["claim_refs asserted by ≥2 sources"],
    "complements": [{ "aspect": "...", "from_source": "..." }],
    "contradictions": ["contradiction_refs (CSE-006 §3.1)"],
    "evolution": ["temporal ordering across sources (CSE-006 §3.3)"]
  },
  "fused_explanation_ref": "an inference-class synthesis citing every contributing anchor",
  "confidence": 0.0
}
```

### 3.2 Reconciliation edges

Added to the knowledge graph between source treatments (reusing `KnowledgeEdgeType` where
possible; new fusion edge kinds): `corroborates`, `complements`, `contradicts`, `supersedes`,
`reframes`. Edges carry the evidence anchors on both ends.

### 3.3 Coverage map

Per fused concept, which sources cover it and how deeply — powering honest "not covered here"
signals (CSE-008 §10) and gap detection (a concept in the learner's timeline that *no* source
covers → a research/ingestion prompt).

## 4. Architecture

- Fusion is a governed cognitive unit that operates over the **anchor index** (CSE-002 §5.5) and
  **Claim Graph** (CSE-006) of a learner's active source set. It is progressive and
  attention-driven (CSE-002 §4): fuses the concepts the learner is approaching, not the whole
  corpus.
- **Reconciliation logic:** cluster source treatments by concept (semantic layer + anchor index);
  detect agreements/contradictions via the Claim Graph; synthesize a fused explanation
  (inference-class, D3-recorded) that cites *every* contributing anchor. Emits
  `source.fusion.composed` and per-concept `source.fusion.concept.reconciled`.
- **Contradictions** discovered in fusion route to the Contradiction Explorer (CSE-009 §5) via
  `source.fusion.contradiction.surfaced`; **gaps** via `source.fusion.gap.detected`.
- **Fusion is a Scene input (CSE-012):** a fused concept renders as one Scene whose actors are the
  contributing source viewports (CSE-008) plus the fused synthesis — with `split`/`merge` shots
  (CSE-013) showing how the sources come together. The learner inhabits the reconciliation.
- Quality gated by the evaluation layer (ADR-0027): a fused explanation must be entailed by its
  cited anchors (grounding audit) and must not flatten a live contradiction (disagreement-honesty
  check, CSE-003 §6).

## 5. Event Subfamily — `source.fusion.*`

| Event | Emitted when | Payload core |
|---|---|---|
| `source.fusion.composed` | a fused environment (concept set) is built | learner_cid, concept_refs[], source_version_ids[] |
| `source.fusion.concept.reconciled` | one FusedConcept produced | concept_ref, source_treatments[], reconciliation summary, confidence |
| `source.fusion.contradiction.surfaced` | a cross-source contradiction promoted | contradiction_ref, source_version_ids[], nature |
| `source.fusion.gap.detected` | a timeline concept no source covers | concept_ref, reason, suggested_action |

## 6. Governance, Determinism & Failure

- Fusion respects each source's license/consent (CSE-002 §8): a consent-revoked human source's
  treatments are removed and the fused concept recomposed (redaction cascade).
- **Determinism:** fusion synthesis records before use (D3); replay folds recorded FusedConcepts;
  the reconciliation *edges* are world-state deltas (replayable).

| Failure | Behavior |
|---|---|
| Sources conflict irreconcilably | Present as a surfaced contradiction (CSE-006), not a forced synthesis |
| A source's layer is missing for a concept | Mark coverage `absent`/`partial`; fuse from available sources; state the gap |
| Fused synthesis fails grounding audit | Quarantine synthesis; fall back to per-source alignment view (CSE-008 §10) |
| Learner adds/removes a source mid-session | Incremental re-fusion of affected concepts only; evented |

## 7. Open Questions

- Concept-identity matching across sources (when two sources name the same idea differently) —
  semantic + anchor-index clustering; precision floor before auto-fusion vs. learner confirmation.
- Whether fused explanations should be cached as shared-layer artifacts (they cite specific source
  *sets*, so they are per-source-set, not per-source) — likely a distinct cache keyed by the
  source-set hash.
- How fusion interacts with the Knowledge Universe (CSE-009 §2 / CSE-P6): fusion is the mechanism
  by which many living environments become one navigable universe — the boundary needs its own
  treatment at the Universe phase.
