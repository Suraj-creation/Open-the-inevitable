---
name: cip-audit-and-distiller-registry
spec:
  id: CIP-002
  title: Subsystem Cognition Audit, Distiller Registry v1, and the M3.5 Implementation Plan
  domain: intelligence
  status: draft
  owner: product-architecture
  last_reviewed: 2026-07-10
  upstream_dependencies:
    - intelligence/CIP-001-cognitive-intelligence-substrate
    - architecture-decisions/ADR-0035-cognitive-intelligence-persistence
    - architecture-decisions/ADR-0034-supabase-persistence-graduation
    - source-environment/CSE-005-episodic-cognition
    - implementation-roadmaps/cse-implementation-blueprint
  downstream_dependencies:
    - implementation-roadmaps/cse-cognitive-theater-and-backend
    - IMPLEMENTATION.md
  related_protocols: [memory-mutation-protocol, cognitive-event-protocol, reasoning-trace-protocol]
  related_events: [intelligence.*, reasoning.trace.recorded]
  related_runtime_systems: [world-state-graph, memory-tiers, cognitive-unit-runtime]
  related_governance_systems: [governance-kernel, consent-policy]
  related_observability_systems: [cognitive-observability, learner-outcome-telemetry]
  semantic_tags: [intelligence, audit, distillers, m3-5, schema, backfill, migration]
  canonical_references:
    - intelligence/CIP-001-cognitive-intelligence-substrate
    - architecture-decisions/ADR-0035-cognitive-intelligence-persistence
---

# CIP-002 — Cognition Audit, Distiller Registry v1, and M3.5

## 1. The Subsystem Cognition Audit

Every runtime subsystem, audited for: what cognition it produces, what reaches the chronicle
today, what evaporates, and what it should distill into. Code-verified 2026-07-10.

| Subsystem | Runtime cognition produced | Chronicled today | Evaporates today | Distills into (kind) |
|---|---|---|---|---|
| **Supervisor** | routing decisions (precedence, confidence-weighted) | `surface.reasoning.recorded` (decision only) | the *rejected* routes and why | `agent.strategy-outcome`, `agent.rejected-alternative` |
| **Planner (FramePlanner)** | frame decomposition, pacing, look-ahead bets + trigger assumptions | `surface.frame.planned/speculation.*` | full trace (interpretation/strategy/self-critique) — **dropped at dispatch** | `agent.strategy-outcome`; speculation hit-rate → `pedagogy.sequence-effectiveness` |
| **Explainer/Composer (MCCR)** | representation choices, density decisions, narration strategy | `surface.frame.composed`, script events | why THIS representation; alternatives considered | `agent.strategy-outcome`, `pedagogy.analogy-effectiveness` (via outcomes) |
| **Challenger/Debate, Revision** | critiques, disagreements, improvement rationale | `surface.agent.disagreed`, proposals | the argument content's fate (accepted? taught better?) | `agent.collaboration`, `pedagogy.intervention-outcome` |
| **Assessment / depth gates** | 5-test outcomes, gate decisions, confidence | `surface.assessment.gate.evaluated`, `evaluation.reasoning.completed` | linkage: which prior interventions produced this outcome | `learner.understanding-delta`, `learner.confidence-calibration`, `pedagogy.intervention-outcome` |
| **Practice** | fade-level decisions, struggle signals | blocks + events | struggle→recovery patterns | `learner.misconception` (recurrence), `pedagogy.intervention-outcome` |
| **Narration/Choreographer** | pacing realized vs planned | narration/segment events | pacing fit per learner | `surface.pacing-fit` (M5+) |
| **Blackboard/Arbiter** | proposals, syntheses, conflicts, rationale | `surface.proposal.proposed`, `synthesis.recorded` | decision *quality over time* per topic/agent | `agent.collaboration`, arbiter weighting priors |
| **Curriculum unit** | concept DAGs, edges, focus choices | KG seeds + events | which decompositions actually taught well | `pedagogy.sequence-effectiveness` |
| **Canonicalizer (M3)** | layer extractions, grounding drops, degradations | `source.layer.*` events, artifacts | which extractions later proved wrong/weak | `source.explanation-weakness`, method-version priors |
| **Intent inference** | interpreted goals, scope | `intent.*` events | goal-evolution across sessions | `question.evolution` |
| **Memory tiers** | mutations, consolidation flags | `memory.*` (permanent) | *systematic* episodic→semantic consolidation never driven | consolidation distiller (drives `consolidate_memory`) |
| **World-state/KG** | deltas, mastery, phases | `world.*` + snapshots (file!) | durable multi-tenant persistence (M2b gap) | — (substrate cutover, §4 W1) |
| **Evaluation (ADR-0027)** | scorecards, dimension scores | `evaluation.*`, `surface.evaluation.recorded` | trends per learner/agent/method | `learner.confidence-calibration`, `agent.strategy-outcome` |
| **Evolution (ADR-0021)** | proposals, shadow results, rollouts | `evolution.*` (permanent) | *inputs* are thin — no distilled evidence base | consumes `pedagogy.*`/`agent.*` kinds (the plane is its evidence) |
| **Observability (ADR-0017)** | drift, calibration warnings | `observability.*` (30d) | — (correct: telemetry regime) | signals may *trigger* distillation; never stored as intelligence |
| **Replay** | deterministic reconstruction | D-levels held | — | recovery drill: re-derive the plane (§5 V4) |
| **CSE store (M1)** | versions, layers, anchors, migrations | `source.*` (permanent) | learner×source engagement structure | `source.confusion-density`, `source.revisit-pattern` (M5 producers) |
| **All units (generic)** | **full ReasoningTraces** | **trace_id only — trace body dropped** | interpretation, strategy, claims, self-critique, uncertainty | chronicle fix C1 (§4) — the single highest-value close |

## 2. Distiller Registry v1 (M3.5 ships these)

| Distiller | Consumes | Produces | Cadence | Det. |
|---|---|---|---|---|
| `episode-assembler` | surface/interaction/assessment/source events per learner-session | `learner.episode` | session-close (+ topic-shift) | D3 |
| `understanding-delta` | episode + mastery/evaluation events | `learner.understanding-delta` | episode-close | D3 |
| `misconception-tracker` | confusions, depth-gate failures, corrections across episodes | `learner.misconception` (life-story: cause→correction→recurrence) | episode-close | D1 |
| `intervention-outcome` | enrichment/image/practice decisions × subsequent assessment/delta | `pedagogy.intervention-outcome` (learner-scoped pair; shared aggregate gated) | episode-close | D1 |
| `strategy-outcome` | reasoning traces × evaluation scorecards per unit | `agent.strategy-outcome`, `agent.rejected-alternative` | session-close | D1 |
| `collaboration-distiller` | proposals/syntheses/disagreements per topic | `agent.collaboration` | session-close | D1 |
| `consolidation-driver` | episodic-tier mutations + salience | `consolidate_memory` mutations (semantic tier) | scheduled | D1 |

Registry law: adding a distiller = registry entry + manifest + named consumers + tests; kinds for
future producers (surface/question/research intelligence) land with their milestones (M5, M8,
M11) — the substrate never changes, only the registry grows.

## 3. Physical Mapping (per kind → store)

Graph-shaped kinds (misconception life-stories, strategy outcomes, collaboration, source
intelligence) → world-state nodes `intelligence:<kind>` + edges (`concerns` → concept/anchor/
learner/agent), persisted as world deltas. Stream-shaped learner kinds (episodes, deltas) →
memory tiers (episodic/reflective) as typed mutations, per CSE-005. Both reach Postgres via the
M3.5 substrate cutover (§4 W1). Aggregates (shared regime) → materialized views over artifacts,
never hand-written tables.

## 4. M3.5 Implementation Plan — Cognitive Intelligence Persistence & Data Unification

Order of work (each step verify-green before the next):

- **C1 — Chronicle fixes** *(highest value, smallest diff)*: dispatcher publishes
  `reasoning.trace.recorded` with the full trace (respecting family `reasoning`,
  recorded-observation, 30d-hot/1y-archive per taxonomy); transparency envelopes chronicled where
  produced. Tests: no dispatch drops a trace.
- **W1 — Substrate cutover (absorbs M2b)**: Postgres-backed WorldStateStore + MemoryStore behind
  existing contracts (adapters follow the M2 pattern: SQL constants, fromPool seams, conformance
  vs fakes + live-gated); gateway `COS_BACKEND=supabase` wiring: event log → `transport_events`,
  world deltas → `world_state_deltas` + projected nodes/edges, mutations → `memory_mutations`,
  learners → `learners`; file snapshots retired to fallback. Migration `0003_intelligence`:
  `intelligence_artifacts` (envelope columns + JSONB body + provenance refs + RLS),
  `intelligence.*` family registration.
- **D1 — Registry v1 distillers** (§2), wired at session close in the gateway; episodes/deltas
  live per CSE-005 (resume cards become real).
- **B1 — Backfill**: replay existing durable logs (`.cos-data`, Postgres transport) through the
  registry — the backfill *is* a replay test; artifacts carry `method_version` so improved
  distillers can re-run history.
- **G1 — Governance**: RLS policies for learner scope; deletion cascade (episode → artifacts →
  recompute); opt-out flags honored at distillation entry; cohort-minimum guard on shared kinds.
- **V — Verification bar**: unit (contracts, envelope validation), conformance (Postgres stores),
  replay (**plane re-derivation drill**: drop plane, re-distill from chronicle, byte-compare),
  governance (cascade completeness, opt-out, cohort minimum), live smoke (gated), `pnpm verify`.

**Resequencing (ADR-0035 locks 6–7):** M3.5 sits between M3 and M4; absorbs M2b; pulls CSE-005
episode infrastructure forward from M6. M4 (PDF) and M5 (projection) then *produce into* an
already-listening plane — no new backfill debt. M6 narrows to MRL + Understanding Map experience.

## 5. Success Criteria

A learner's second session is measurably shaped by their first (resume card from a real delta;
enrichment selection consulting intervention history); zero dispatches drop traces; the plane
re-derives from the chronicle byte-identically; a deleted episode leaves no derived residue;
no shared aggregate exists below cohort minimum; every artifact answers "who consumes this" —
and `intelligence.consumed` proves someone does.
