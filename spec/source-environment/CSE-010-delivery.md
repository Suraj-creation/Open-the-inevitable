---
name: cse-delivery
spec:
  id: CSE-010
  title: CSE Delivery — Phases, Success Metrics, Risks, and Verification
  domain: source-environment
  status: draft
  owner: product-architecture
  last_reviewed: 2026-07-09
  upstream_dependencies:
    - source-environment/CSE-001-foundations
    - source-environment/CSE-002-canonical-source-representation
    - source-environment/CSE-008-source-surface-projection
    - source-environment/CSE-009-experience-catalog
    - implementation-roadmaps
  downstream_dependencies:
    - implementation-roadmaps
    - IMPLEMENTATION.md
  related_protocols: [cognitive-event-protocol, memory-mutation-protocol]
  related_events: [source.*, surface.source.*]
  related_runtime_systems: [cognitive-unit-runtime, surface-session]
  related_governance_systems: [governance-kernel]
  related_observability_systems: [learner-outcome-telemetry, cognitive-observability]
  semantic_tags: [source-environment, delivery, phases, metrics, risks, verification]
  canonical_references:
    - source-environment/CSE-001-foundations#6
    - product/features/F15-content-ingestion-knowledge-substrate#15
---

# CSE-010 — Delivery

## 1. Purpose

Sequences the CSE domain into buildable phases against the repository's real state, defines
success metrics consistent with the Constitution (never engagement-time), consolidates risks and
open questions, and states the verification bar each phase must clear. Phase plans elaborating
this sequence belong in `spec/implementation-roadmaps/`; current status belongs in
`IMPLEMENTATION.md` — never here.

## 2. Starting Position (what already exists)

CSE does not start from zero. Already shipped and reusable as-is: the surface runtime, frames,
MCCR, narration script with anchor bindings, choreography, speculation, image decisions
(ADR-0030 + SRF-001…006); real model/media adapters; the proposal blackboard and ensemble
arbitration (ADR-0018/0025); interaction protocol (ADR-0024); memory tiers, durable persistence,
learner identity (DPS-001…005); governed evolution (ADR-0021); evaluation layer (ADR-0027);
research-frontier surfacing and gating (ADR-0026); CDL. F15 defines the acquisition-side product
law. CSE's build is therefore concentrated in: canonicalization units, the anchor system, the
`source.*`/`surface.source.*` events, viewport/highlight planning, MRL, episodes, claims/overlays.

## 3. Phases

| Phase | Focus | Key deliverables | Exit criterion |
|---|---|---|---|
| **CSE-P1 — Anchored Reference** | One modality (PDF) end-to-end, done right | Source identity/versioning; L1/L3 layers + anchor index; media-route page rendering; `source.*` + `surface.source.*` events; source_viewport MCCR element; viewport plans + semantic highlights + attention contract for PDF; raw-source toggle; degraded-OCR honesty | A learner studies a real PDF inside the surface with narration-synchronized viewports and semantic highlights, fully replayable, offline-testable |
| **CSE-P2 — Meaning & Episodes** | From content to understanding | L2/L6 layers; MRL v1 (intent, analogy-map, misconception-hypothesis, conceptual-compression); episodes + understanding deltas + resume cards; Understanding Map v1; lens rail | Resume cards reflect real deltas; "why this analogy?" resolves to a decision trace |
| **CSE-P3 — Transformations & Practice** | The algebra becomes usable | Transformation registry + contracts; Concept Replay rail; worked-example fading + self-explanation console; enrichment decision loop wired through blackboard | Every rail node is an honest available/generatable state; fading governed and overridable |
| **CSE-P4 — Living Knowledge & Society** | The frontier and the ensemble | Claim graph; frontier overlays + temporal knowledge model; contradiction explorer; multi-source alignment; agent theater; interruption budget enforcement; governance center completions (real forgetting cascade) | Two sources on one concept align, disagree visibly, and connect to the frontier — all provenance-channeled |
| **CSE-P5 — Temporal & Live Modalities** | Video, web, code | L4 temporal layer; video environment (concept scrubber, governed media intents, transcript sync); web anchoring + re-crawl migration; code anchors | A lecture video is a navigable concept space, not a timeline |
| **CSE-P6 — Knowledge Universe & Human Sources** | Merging environments; people as sources | Cross-source knowledge universe projection; human-session ingestion with consent envelopes + redaction cascades; aggregate instructional evolution (post privacy-mechanism ADR); platform-as-instrument groundwork | Long-horizon; explicitly must not pull effort from P1–P4 prematurely |

Each phase ships spec-first (updates to owning specs + indexes), then implementation, then
validation against the spec, per CLAUDE.md §4.

## 4. Success Metrics

Success is **not** engagement or time-on-platform (Constitution #1/#6):

- **Capability growth** — movement on Understanding Map axes per learner per domain, evidence-backed.
- **Transfer evidence** — concepts applied in novel, self-directed contexts (projects, creations,
  research artifacts), not familiar-exercise correctness.
- **Episode resolution rate** — logged confusions reaching resolved/breakthrough.
- **Time-to-independent-explanation** — how quickly a learner reaches a strong self-explanation
  on a new concept; should trend downward across their lifetime as reasoning compounds.
- **Research-readiness progression** — learners crossing from mastery into genuine open-question
  engagement (ADR-0026 transitions).
- **Grounding integrity** — zero grounded claims without resolvable anchors; anchor stability rate.
- **Agency exercise rate** — healthy active use of governance controls (forgetting, toggling,
  overrides) read as trust, not dissatisfaction.
- **Silence health** — interruption acceptance rate and "decided: nothing" frequency (a calm
  system is a feature).

Operational: canonicalization latency/cost per layer per modality; shared-layer cache hit rate;
sync realization quality (≤150ms spread attainment); replay equivalence pass rate.

## 5. Consolidated Risks & Open Questions

| Risk / question | Home | Disposition |
|---|---|---|
| Cold-start MRL quality without learner data | CSE-003 §7 | Population-agnostic defaults; evolution improves priors only under ADR-0021 |
| Interruption calibration needs real usage data | CSE-007 §6 | Conservative defaults; learner-configurable; telemetry-driven tuning |
| Multi-party human-source consent complexity | CSE-002 §8 | All-party consent + utterance-scoped exclusion; richer model before P6 |
| Aggregate-learning privacy mechanism (DP vs. cohort minimums) | CSE-006 §8 | Blocking ADR required before CSE-P4 aggregate features |
| Simulation build-vs-generate cost | CSE-004 §7 | ADR at CSE-P3 |
| Page-render pipeline choice (fidelity proof) | CSE-008 §14 | ADR at CSE-P1 |
| Anchor stability on the live web | CSE-002 §12 | Measure in P5; redundant selectors mitigate |
| Civilization/institution-scale layer scope creep | CSE-001 §7 | Long-horizon direction only (F11/F18-future); not scoped in this domain's phases |
| Canonicalization economics at book scale | CSE-002 §4 | Progressive + attention-driven by design; budgets enforced |

## 6. Verification Bar (every phase)

Per working doctrine (CLAUDE.md §4): unit, integration, **governance** (capability/consent/
redaction paths), **replay** (fold equivalence; no re-invocation), and **failure** tests (every
row of each spec's failure table) — plus observability hooks present before a unit is considered
cognitive. The full stack must run offline against deterministic fixture sources (CSE-002 §7);
`pnpm verify` stays green.
