---
name: cse-living-knowledge
spec:
  id: CSE-006
  title: Living Knowledge — Frontier Overlays, the Claim Graph, and Governed Instructional Evolution
  domain: source-environment
  status: draft
  owner: product-architecture
  last_reviewed: 2026-07-09
  upstream_dependencies:
    - source-environment/CSE-002-canonical-source-representation
    - source-environment/CSE-003-meaning-representation-layer
    - product/features/F10-research-innovation-acceleration
    - product/features/F15-content-ingestion-knowledge-substrate
    - architecture-decisions/ADR-0026-research-mode-and-readiness-gating
    - architecture-decisions/ADR-0021-governed-self-evolution
    - world-state/knowledge-graph-engine
  downstream_dependencies:
    - source-environment/CSE-008-source-surface-projection
    - source-environment/CSE-009-experience-catalog
  related_protocols: [cognitive-event-protocol, memory-mutation-protocol, evolution-proposal-protocol]
  related_events: [source.frontier.updated, source.claim.recorded, source.contradiction.detected, surface.research.frontier.detected, surface.research.frontier.surfaced, evolution.proposal.created]
  related_runtime_systems: [world-state-graph, knowledge-graph-engine, evolution-engine, cognitive-scheduler]
  related_governance_systems: [governance-kernel, capability-envelope, human-governance]
  related_observability_systems: [cognitive-observability, reasoning-trace, learner-outcome-telemetry]
  semantic_tags: [source-environment, frontier, claims, contradictions, epistemics, temporal-knowledge, instructional-evolution]
  canonical_references:
    - source-environment/CSE-002-canonical-source-representation#9
    - architecture-decisions/ADR-0026-research-mode-and-readiness-gating
    - architecture-decisions/ADR-0021-governed-self-evolution
---

# CSE-006 — Living Knowledge & Dynamic Knowledge Evolution

## 1. Purpose

Sources are never studied in isolation from the evolving world around them. A learner who uploads
a classic textbook, an old paper, or a years-old lecture gets the original artifact preserved as
evidence, **plus** a living overlay connecting every concept to the current frontier:

```
Original Source → Latest Research → Industrial Practice → Alternative Explanations →
Open Questions → Competing Theories → Interdisciplinary Links → Future Directions
```

This spec defines the three structures that make that real — the **Frontier Overlay**, the
**Claim Graph**, and the **temporal knowledge model** — plus the strictly governed
**self-improving instructional layer**. It transforms study from archival consumption into
frontier-aware understanding (Source Law: **Research-aware**).

## 2. Philosophy

- **The source stays sacred; the frontier is an overlay.** Frontier content never edits, annotates
  over, or visually contaminates evidence. It renders in its own reserved provenance channel
  (`frontier`, CDL research state) so a learner always knows at a glance whether they are looking
  at the original material or the evolving edge.
- **Disagreement is content, not noise** (Constitution #7). Contradictions between sources, and
  within the field, are structured objects a learner can explore — never smoothed over, and never
  one-click "resolved for me."
- **Epistemics are typed.** "X claims Y, supported by Z, contradicted by W" is graph structure
  with provenance and confidence — the concrete activation of the reserved `epistemology` domain.

## 3. Primitives

> **Implementation status — §3.1 implemented at CSE M9 T2 (ADR-0041).** Claims are extracted per
> source as governed cognition (the privileged `claim` agent, `ClaimReasoningUnit` `extract` mode,
> grounded + D3-recorded) and persisted as world-state `claim` nodes with `about` + typed epistemic
> edges; cross-source contradiction detection (`contrast` mode) writes `contradicts` edges and emits
> `source.contradiction.detected { claim_ids, source_version_ids, nature }` — value/interpretive
> disagreements labeled as such, never as factual, and never fabricated (honest absence). The
> Frontier Overlay (§3.2), the Temporal Knowledge Model (§3.3), claim quarantine by a judge (§6),
> and the self-improving instructional layer (§7) remain deferred.

### 3.1 `Claim` and the Claim Graph

```json
{
  "claim_id": "clm_...",
  "statement": "the shortest faithful statement",
  "anchors": ["source anchors asserting this claim"],
  "scope": { "conditions": "...", "domain": "..." },
  "epistemic_status": "established | supported | contested | speculative | superseded",
  "edges": [{ "type": "supports | contradicts | refines | replicates | fails-to-replicate | supersedes", "target_claim": "clm_...", "evidence_anchors": [] }]
}
```

Claims are world-state graph nodes extracted during layer 5/6 canonicalization and during
frontier refresh. The Claim Graph grounds: the Contradiction Explorer (CSE-009 §5), citation
tracing, replication-status display, and research-paper inspection (claim inspection, follow-up
work, open questions). Cross-source contradiction detection extends F15's
`ingestion.conflict.detected` with typed claim edges: `source.contradiction.detected
{ claim_ids[], sources[], nature: "empirical | interpretive | value" }` — value disagreements are
labeled as such, never presented as factual ones.

> **Implementation status — §3.2 landed at CSE M9 Frontier T1 (ADR-0043).** Frontier overlays are
> produced on demand by the privileged `frontier` agent (`FrontierResearchUnit`) via **real
> web-grounded generation** (Gemini Google Search → real citations; `webSearch` on the model
> adapter, D3-recorded so replay shows the frontier as it was then). Every entry is admitted only if
> a real citation backs it (no citable origin ⇒ dropped; empty ⇒ honest, never fabricated). Emits
> `source.frontier.updated`. **Deferred:** the ADR-0026 readiness-gating surfacing pipeline
> (`surface.research.frontier.*`), the frontier as a standing Scene actor (§5), the budgeted refresh
> cadence + volatility scoring (§4/§8), and promotion of entries into Claims (§3.1).

### 3.2 `FrontierOverlay`

A typed link set from a concept (and its anchors in a given source) to living knowledge:

```json
{
  "overlay_id": "fov_...",
  "concept_ref": "...",
  "source_version_id": "context source",
  "entries": [{ "kind": "latest-research | practice | alternative-explanation | open-question | competing-theory | interdisciplinary | future-direction", "claim_refs": [], "external_refs": [], "as_of_hlc": "..." }],
  "freshness": { "refreshed_hlc": "...", "policy_ref": "..." }
}
```

Overlays are produced by governed research agents (F10) under capability-enveloped web/corpus
access, on a budgeted refresh cadence prioritized like canonicalization (learner attention +
concept volatility — fast-moving fields refresh more often). Emits `source.frontier.updated`.
Surfacing to the learner flows through the existing research subfamily
(`surface.research.frontier.detected/surfaced/deferred`) and its ADR-0026 readiness gating —
CSE adds the overlay *substance*; ADR-0026 keeps deciding *when a learner is ready to see it*.

> **Implementation status — §3.3 landed at CSE M9 TKM T1 (ADR-0044).** Per-concept Concept Timelines
> are researched on demand by the privileged `temporal` agent (`TemporalResearchUnit`) via **real
> web-grounded generation** — an ordered series of epistemic states (origin → milestone → shift →
> current-debate → open-problem), each backed by a real citation (no citable origin ⇒ dropped),
> chronologically ordered, and **honestly sparse** (a niche concept shows a short strip, never padded
> — §8). Emits `source.timeline.updated`. **Deferred:** assembly from L6 citation lineage + claim
> `supersedes` edges + frontier entries once populated at the gateway; the Cognitive Time Machine UI
> (CSE-009 §3); the Temporal transformation (CSE-004); curated seed timelines for pre-digital
> concepts.

### 3.3 Temporal Knowledge Model

Per concept: an ordered series of **epistemic states** (origin → milestones → shifts → current
debate → open problems), built from citation lineage (layer 6), claim supersession edges, and
frontier entries. This powers the Cognitive Time Machine's *Concept Timeline* mode (CSE-009 §3)
and the Temporal transformation (CSE-004). Sparse timelines are honest: a new/niche concept shows
a short strip, never a padded fiction.

## 4. Runtime Semantics

- Frontier refresh loops hold intent leases; every external fetch is a governed tool invocation
  with provenance recording (F15 web-ingestion path). No frontier entry exists without citable
  origin.
- Claims and overlays are shared-layer structures (CSE-002 seam): computed once, shared across
  learners; *surfacing* decisions are learner-conditioned (readiness, relevance, interruption
  budget CSE-007 §6).
- Replay: overlays are versioned by `as_of_hlc`; replaying a past session shows the frontier *as
  it was then* — time-travel honesty.

## 5. Research Transition

> **Implementation status — proactive surfacing grounded at CSE M9 LKS T1 (ADR-0045).** The S3
> readiness gate (ADR-0026: verified mastery → `surface.research.frontier.detected/surfaced/deferred`)
> now surfaces the **real web-grounded frontier** (§3.2, ADR-0043) via a `frontierProvider` seam —
> grounded-or-deferred, never the earlier ungrounded breadcrumb (which remains only as a fallback for
> manifestations that wire no provider). The Cognitive Director explicitly *raising the horizon* (a
> `researching` state directive), proactive timeline surfacing, and the standing frontier Scene actor
> below remain deferred.

The intended ladder is continuous, not a hand-off between products:

```
Read → Understand → Master → Connect → Question → Experiment → Research → Discover → Create
```

CSE's role ends where RIL's begins, with a shared seam: mature source environments unfold into
the Research Workspace (CSE-009 §6) — hypotheses, argument maps, experiments, drafts — governed
by F10 and readiness gating (ADR-0026). A learner may always self-declare readiness; the system
respects the declaration (records it, adjusts, and does not gatekeep — Constitution #3) while
continuing to verify depth honestly (F14).

**Continuous, not deferred (your architectural direction #10).** Research does not begin only
*after* mastery. Every concept, at every stage, carries a **frontier horizon** — the boundary
between the known and the open:

```
Known → Unknown → Current Debate → Open Question → Research Opportunity → Possible Experiment → Innovation Direction
```

The frontier overlay (§3.2) always exposes this horizon at a depth appropriate to the learner's
development stage (CSE-005): a novice sees "here is where even experts are still arguing" as a
curiosity seed (governed by the interruption budget, CSE-007 §6); an advanced learner sees precise
open questions and experiment openings. This is realized as a standing **frontier actor** available
in every Scene (CSE-012) — one interaction (`explore`, CSE-014) away — so the transition from
learning to research feels like widening attention, never crossing a wall. The Cognitive Director
(CSE-011) decides *when* to raise the horizon into focus (a `researching` state directive) versus
hold it at the periphery, pacing the learning→research continuum across the whole journey rather
than at a single gate. Creation (CSE-016) is the natural next step past the horizon.

## 6. Failure Semantics

| Failure | Behavior |
|---|---|
| Frontier fetch denied / budget exhausted | Overlay renders with explicit staleness ("frontier as of <date>"); refresh queued |
| Contradiction detection uncertain | Flagged `contested` with both readings shown; never auto-resolved |
| External source disappears | Entry retains provenance + preserved quote; marked unavailable |
| Claim extraction low-confidence | Claim held in quarantine (not surfaced) pending judge evaluation (ADR-0027) |

## 7. The Self-Improving Instructional Layer — Strictly Governed

Across many learners studying the same concept, the platform can learn which interventions work
in aggregate: common misconceptions, best analogies for novices, effective visual forms, where
learners stall, sequences that support transfer. This creates compounding pedagogical
intelligence — the environment itself improves, not just the underlying models.

**Binding constraints (blueprint law 7; ADR-0021):**

1. Instructional improvements are **Evolution Proposals** processed by the EvolutionEngine:
   proposed → evaluated → shadow-tested against synthetic learners → governance-approved →
   rolled out | rolled back. No silent prompt/policy drift, ever.
2. Inputs are **aggregate and privacy-preserving only**: cohort minimums (no signal computed from
   fewer than K learners) and a formal anonymization mechanism (differential privacy or
   equivalent — mechanism decision is a named open question, required before implementation).
3. Per-learner participation is **opt-in via the Governance Center** (CSE-009 §8), with a
   plain-language explanation; thinking-pattern data never enters without separate opt-in
   (CSE-005 §7).
4. The platform-as-scientific-instrument (ethically governed studies of teaching strategies)
   requires explicit consent per study, human-governance review, and publishes methods to
   participants. This is a frontier capability, not a default.

## 8. Open Questions

- Privacy mechanism for aggregate signals: differential privacy vs. cohort-minimum-only — needs
  its own ADR before CSE-P4.
- Claim-extraction precision floor before claims become learner-visible (share the ADR-0027
  judge harness; threshold TBD with data).
- Frontier refresh economics: per-concept volatility scoring model.
- How far Concept Timelines extend for pre-digital knowledge (citation lineage thins quickly
  before ~1990) — likely needs curated seed timelines for foundational concepts.
