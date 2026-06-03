---
name: F10-research-innovation-acceleration
spec:
  id: F10
  title: Research & Innovation Acceleration (UALRCI)
  pillar: P10
  domain: product
  status: draft
  owner: product-architecture
  last_reviewed: 2026-06-03
  upstream_dependencies:
    - product/Broader-feature-product
    - product/features/F03-recursive-prerequisite-intelligence
    - product/features/F06-specialized-agent-ecosystem
    - product/features/F08-interdisciplinary-knowledge-graph
    - product/features/F14-assessment-mastery-depth
    - product/features/F15-content-ingestion-knowledge-substrate
    - vision-application/Universal-Learning-Intelligence-Agent
  downstream_dependencies:
    - product/features/F12-collective-cognitive-evolution
    - product/features/F13-identity-personas-modes
  related_protocols: [cognition-packet-protocol, cognitive-event-protocol, reasoning-trace-protocol, memory-mutation-protocol]
  related_events: [research.frontier.detected, paper.summarized, gap.detected, hypothesis.proposed, contribution.drafted, innovation.review.requested]
  related_runtime_systems: [world-state-graph, cognitive-unit-runtime, deterministic-execution-engine, cognitive-scheduler]
  related_governance_systems: [governance-kernel, capability-envelope, cognitive-safety, human-governance]
  related_observability_systems: [cognitive-observability, reasoning-trace, learner-outcome-telemetry, otel-edge]
  semantic_tags: [ualrci, research, innovation, frontier, hypotheses, creation, original-contribution]
  canonical_references:
    - product/Broader-feature-product#13-research-innovation--collective-evolution
    - vision-application/Universal-Learning-Intelligence-Agent#xx-universal-accelerated-learning--research-creation-intelligence
---

# F10 — Research & Innovation Acceleration (UALRCI)

## 1. Purpose

F10 turns learning into creation. It operationalizes UALRCI: moving a learner from foundations to
advanced understanding, then to research awareness, research capability, hypothesis generation, and
original contribution. The feature does not merely show papers. It knows when the learner is ready,
what prerequisites are missing, which frontier is relevant, and how to keep novelty grounded.

The product outcome is the compressed journey from curiosity -> understanding -> mastery ->
creation -> innovation.

## 2. Scope & Boundaries

- **In scope:** research-readiness detection, frontier mapping, paper survey, gap analysis,
  hypothesis generation, contribution drafting, source grounding, and innovation review loops.
- **Out of scope:** raw ingestion/scraping mechanics (F15), collective system evolution (F12), and
  formal mastery gate implementation (F14).
- **Non-goals:** hallucinated novelty, paper summarization without prerequisite checks, or treating
  research outputs as authoritative without human review.

## 3. Personas & Modes

| Persona | Research posture |
|---|---|
| Child / beginner | Research seeds are framed as wonder and exploration |
| Student | Frontier breadcrumbs appear after depth gates and with scaffolding |
| Researcher | Dense literature maps, gap analysis, and contribution planning |
| Educator | Helps build research-aware curricula and student project arcs |
| Institution | Cohort/project intelligence, governed by institutional policy |
| Open Mode | Allows curiosity-driven frontier exploration with source-grounded limits |

## 4. Narrative Experience

A learner studies backpropagation. The Research Agent notices readiness: prerequisite confidence is
high, explanation depth is strong, and the learner has asked a "why is this still hard?" question.
It surfaces one frontier breadcrumb: a recent line of work, a gap, and the foundation needed to
understand it. Later, after depth verification, the Innovation Agent helps compare methods,
identify constraints, and draft a small hypothesis. The learner is not told they invented something
because the system produced text; they are guided toward a reviewable contribution.

## 5. ULI / UALRCI Hooks

- Implements UALRCI's Stage 4 -> 4.5 -> 5 -> 6 progression.
- Uses ULI prerequisite graphs to prevent frontier exposure before foundations are stable.
- Applies acceleration strategies: prerequisite parallelization, transfer learning, cognitive load
  optimization, spaced repetition, interleaving, elaborative interrogation, and dual coding.
- Uses F14 depth verification as the gate for research transition.

## 6. Agents Involved

| Agent | Role |
|---|---|
| Research Agent | Maps papers, frontiers, trends, and source-grounded summaries |
| Innovation Agent | Generates hypotheses, synthesis paths, and novelty checks |
| Curriculum Agent | Turns research gaps into prerequisite paths |
| Assessment Agent | Confirms readiness and evaluates contribution quality |
| Socio-Ethical Agent | Checks impact, misuse, bias, and domain ethics |
| Memory Agent | Stores research interests, source maps, and contribution drafts |
| Supervisor | Gates frontier exposure and routes human review |

## 7. Cognitive OS Primitives Used

- **World-State Graph** stores frontier concepts, papers, gaps, hypotheses, and learner readiness.
- **Reasoning Trace** explains readiness, source selection, gap detection, and hypothesis formation.
- **Cognitive Event** records paper summaries, gap maps, hypotheses, and review requests.
- **Memory Mutation** stores research preferences, drafts, evidence, and feedback.
- **Capability Envelope** governs web/corpus access, citation surfaces, and external tool use.
- **Cognitive Scheduler** budgets expensive research and synthesis work.

## 8. Events, Protocols & State Transitions

Emits:

- `research.frontier.detected`, `research.frontier.surfaced`, `research.frontier.deferred`
- `paper.ingested`, `paper.summarized`, `paper.linked-to-concept`
- `gap.detected`, `gap.validated`, `gap.rejected`
- `hypothesis.proposed`, `hypothesis.critiqued`, `hypothesis.revised`
- `contribution.drafted`, `innovation.review.requested`, `innovation.review.completed`

State transitions:

1. Mastered concept -> research-aware concept when frontier adjacency is validated.
2. Frontier seed -> research path when the learner accepts.
3. Gap -> hypothesis -> contribution draft -> human/research review.

## 9. Memory & World-State Effects

F10 writes durable research interests, source maps, hypothesis lineage, critique history, and
contribution drafts. It also updates the learner's research readiness model. All writes include
source provenance and confidence. Rejected hypotheses remain as lineage records so the learner can
learn from failure.

## 10. Governance, Safety, Privacy, Ethics

- Source grounding is mandatory for research claims.
- High-stakes domains require disclaimers, domain boundaries, and human review.
- Novelty claims are provisional until externally validated.
- Learner authorship is respected: the platform provides leverage and lineage, not false ownership.
- Misuse-sensitive research triggers Socio-Ethical review and possible refusal.

## 11. Observability

- Telemetry: readiness accuracy, frontier usefulness, paper-source quality, hypothesis survival
  rate, review outcomes, contribution quality tiers, and acceleration without depth loss.
- Reasoning traces: mandatory for frontier surfacing, gap validation, and hypothesis proposal.
- Replay determinism: **full** for surfaced sources, accepted hypotheses, and contribution lineage;
  **trace-level** for search rankings and model-generated synthesis.

## 12. Failure Semantics

| Failure | Behavior |
|---|---|
| Frontier seed too advanced | Defer and route prerequisite repair through F03/F02 |
| Source unavailable | Mark source stale, use cached provenance, or decline if no grounded fallback |
| Hypothesis unsupported | Emit critique, preserve learning lineage, and avoid contribution claim |
| Misuse-sensitive direction | Route through Socio-Ethical/governance review |
| Research tool exceeds budget | Scheduler defers and surfaces progress transparently |

## 13. Architecture Conformance Statement

- Research actions are typed packets and events, not hidden web calls.
- Every external source carries provenance.
- Memory writes use Memory Mutation.
- Readiness and novelty decisions emit reasoning traces.
- Governance checks high-stakes and misuse-sensitive paths.
- Contribution lineage is replayable.

## 14. Success Metrics

- Research seed usefulness > 75% after F14 readiness gates.
- Hallucinated citation rate = 0 in accepted research outputs.
- Hypothesis critique coverage = 100% before contribution drafting.
- Learners reaching Stage 5/6 increases without reduced depth scores.
- Source-grounding trace coverage = 100%.

## 15. MVP -> Advanced -> Frontier Phasing

- **MVP:** frontier breadcrumb surfacing for mastered concepts, source-grounded paper summaries,
  readiness gating, and hypothesis draft events.
- **Advanced:** gap maps, contribution lineage, research project planning, educator review, and
  cross-domain synthesis through F08.
- **Frontier:** autonomous literature surveillance, collective gap discovery, lab/project
  integration, and governed innovation portfolios.

## 16. Open Questions

- Which external source adapters are allowed in MVP, and what is the citation trust policy?
- What exact readiness threshold permits frontier surfacing?
- Which contribution quality tiers map to learner-facing language?
- How should the system distinguish learner-authored insight from agent-suggested scaffolding?

## 17. References

- `spec/product/Broader-feature-product.md` §5.2 and §13.
- `spec/vision-application/Universal-Learning-Intelligence-Agent.md` §XX-XXV.
- `spec/product/features/F14-assessment-mastery-depth.md`.
- `spec/product/features/F15-content-ingestion-knowledge-substrate.md`.
