---
name: cse-episodic-cognition
spec:
  id: CSE-005
  title: Episodic Cognition — Episodes, Understanding Deltas, and Cognitive Development State
  domain: source-environment
  status: draft
  owner: product-architecture
  last_reviewed: 2026-07-09
  upstream_dependencies:
    - source-environment/CSE-001-foundations
    - source-environment/CSE-002-canonical-source-representation
    - memory/memory-tiers
    - world-state/world-state-graph
    - protocols/memory-mutation-protocol
    - product/features/F05-persistent-cognitive-memory
    - product/features/F14-assessment-mastery-depth
    - persistence/durable-learner-identity
  downstream_dependencies:
    - source-environment/CSE-006-living-knowledge
    - source-environment/CSE-007-source-agent-society
    - source-environment/CSE-009-experience-catalog
  related_protocols: [memory-mutation-protocol, cognitive-event-protocol]
  related_events: [memory.mutation.committed, memory.consolidated, memory.redacted, world.mastery.updated]
  related_runtime_systems: [memory-tiers, world-state-graph, cognitive-unit-runtime]
  related_governance_systems: [governance-kernel, consent-policy, human-governance]
  related_observability_systems: [cognitive-observability, learner-outcome-telemetry]
  semantic_tags: [source-environment, episodes, memory, development-state, compounding, continuity]
  canonical_references:
    - memory/memory-tiers
    - product/features/F05-persistent-cognitive-memory
    - source-environment/CSE-001-foundations#5
---

# CSE-005 — Episodic Cognition

## 1. Purpose

CSE does not remember page positions. It remembers **cognitive episodes** — units of lived
learning — and it tracks not just *what* a learner knows but *how their cognition is developing*.
This spec defines the Episode, the Understanding Delta, and the Cognitive Development State model,
and binds all three to the existing memory and world-state substrates. This is **cognitive
continuity, not session continuity**: the system reopens not "where you were" but "what was
happening in your understanding."

## 2. Philosophy

- **Episodes are the unit of compounding** (Constitution #6). Every later capability — resume
  cards, reflection journal, time machine (learner mode), companion continuity, "this analogy
  produced your last breakthrough" — is a projection over episode history. No new store: episodes
  are typed structures in the **episodic memory tier**, committed through memory mutations, and
  consolidated by existing tier policy.
- **What changed matters more than what happened.** Raw interaction logs are events; the episodic
  record distills them into what moved in the learner's model.
- **Development is stage-aware, not percentage-aware.** A novice and an innovator need different
  cognitive architectures from the system — different agents, pedagogy, and transformations —
  not different points on one progress bar.

## 3. Primitives

### 3.1 `Episode`

```json
{
  "episode_id": "epi_...",
  "learner_cid": "...",
  "surface_session_ids": ["..."],
  "source_refs": [{ "source_id": "...", "version_id": "..." }],
  "concept_refs": ["..."],
  "anchor_refs": ["anchors actually engaged"],
  "questions": [{ "text": "...", "anchor_ref": "...", "resolved": false }],
  "confusions": [{ "description": "...", "concept_ref": "...", "state": "open | revisited | resolved | breakthrough" }],
  "interventions": [{ "enrichment_decision_ref": "...", "kind": "analogy | simulation | probe | ...", "outcome": "helped | neutral | confused" }],
  "reflections": ["journal entry refs"],
  "outcome": { "delta_ref": "ud_...", "summary": "one-line, learner-readable" },
  "started_hlc": "...", "closed_hlc": "..."
}
```

Episodes open lazily on first meaningful engagement, close on session end or topic shift, and
commit as episodic-tier memory mutations (blueprint law 2). Consolidation folds episode residue
into semantic memory per existing tier policy; decay applies to salience, never to audit history.

### 3.2 `UnderstandingDelta`

The typed answer to "what did this episode do to this mind":

```json
{
  "delta_id": "ud_...",
  "episode_ref": "epi_...",
  "concepts_touched": ["..."],
  "mastery_movements": [{ "concept_ref": "...", "from_stage": "...", "to_stage": "...", "evidence_refs": ["..."] }],
  "confusions_opened": [], "confusions_resolved": [],
  "misconceptions_corrected": [{ "hypothesis_ref": "mrl unit", "evidence_refs": [] }],
  "assumptions_revised": ["world-model updates"],
  "new_connections": [{ "from_concept": "...", "to_concept": "...", "via": "transfer-map | project | ..." }]
}
```

Understanding Deltas are derived at episode close (model-assisted, D3-recorded), stored as the
episode's outcome, and are the *only* input to resume cards and compounding claims. A session
with an empty delta is honestly reported as consolidation/review, never inflated.

### 3.3 Cognitive Development State

Per learner, per domain — three coordinated structures in the world-state graph:

1. **Development ladder** — the stage model replacing flat mastery-%:
   `Observation → Recognition → Understanding → Application → Transfer → Abstraction → Creation
   → Research → Discovery → Teaching → Paradigm Formation`.
   Stage transitions are world-state deltas (`world.mastery.updated` with stage semantics)
   requiring **evidence lists** — F14 verification artifacts, transfer demonstrations, creations —
   never inferred from time-on-task. F14's depth-verification remains the gatekeeper for
   `Understanding → Application`; RIL gating (ADR-0026) governs `Research`+.
2. **Internal world model** — per domain: current working assumptions, where they hold, where they
   break, how they changed over time (linked to the deltas that changed them). This is what lets
   the system teach *against the learner's actual model* rather than against a syllabus.
3. **Thinking patterns** — observed problem-solving, reasoning style, hypothesis-formation,
   evidence-seeking, reflection, and creativity patterns. **Governance-critical:** patterns are
   disclosed and learner-visible (Understanding Map, Journal), never covertly scored, never
   shared into aggregate learning without explicit opt-in, and deletable like any memory (§7).

### 3.4 The Inspectable Progressive World Model

The internal world model (§3.3.2) is not only an internal input to teaching — it is a **first-class
inspectable projection** the learner can open and navigate (your architectural direction #9). Per
learner, across domains, it exposes:

- **Working assumptions** currently held, per concept, with where each holds and breaks.
- **Cross-domain connections** the learner has actually formed (physics↔mathematics,
  biology↔chemistry) — edges in the Personal Knowledge Graph (CSE-009), sourced from Understanding
  Deltas' `new_connections`.
- **Misconceptions** open, revisited, and corrected (from `confusions` + MRL
  misconception-hypotheses, CSE-003).
- **Contradictions** the learner is holding unresolved (linked to the Claim Graph, CSE-006).
- **Confidence** per concept (from evaluation scorecards, ADR-0027) and **blind spots** (concepts
  in the timeline the learner has not engaged, or engaged and dropped).
- **Evolution over time** — how every one of the above has changed across months and years (the
  *My Timeline* projection, §5).

This makes the learner's own mind legible *to the learner* — the deepest form of metacognitive
support. It is rendered through the Understanding Map and World-Model Inspector (CSE-009), never as
a score, always with the evidence that produced each element. It is governed exactly like thinking
patterns (§7): learner-visible, opt-out, deletable.

### 3.5 The Affective / Attention Signal (input to the Director)

Alongside cognition, the system observes **affective and attention state** — engaged, curious,
frustrated, overloaded, bored, fatigued, confident — plus a depletable attention budget. This is
the primary input to the Cognitive Director's pacing (CSE-011 §3.3): it is what lets the system
slow down, fall silent, or offer a break at the right moment.

Binding governance (identical posture to thinking patterns): affect is inferred from behavioral
evidence (dwell, rewind, error rate, self-explanation quality) *or* learner-declared; it is
**learner-visible, never covertly scored, opt-out, and deletable**; wellbeing-relevant signals
(frustration/fatigue spikes) route to a supportive posture that offers rest, never more content
(CSE-007 Companion/Health). Affect is *never* an input to aggregate instructional evolution
without separate explicit opt-in (CSE-006 §7). Emitted as `surface.affect.observed` /
`surface.attention.budgeted` (owned by CSE-011).

## 4. Runtime Semantics

- Episode assembly is a cognitive unit subscribing to `surface.*`, assessment, and interaction
  events for the learner's sessions (context-leased), distilling — not mirroring — them.
- Stage-aware reconfiguration: the development stage is an input to Enrichment Decisions
  (CSE-007) and timeline projection (SRF-003). A `Transfer`-stage learner gets ambiguous,
  interdisciplinary problems; an `Observation`-stage learner gets grounding and recognition
  scaffolds. The **Adaptive Expertise Engine** rule: once routine mastery is demonstrated, the
  system shifts from repetition toward under-specified, design-oriented problems — the target is
  *adaptive* expertise (inventive transfer), not merely *routine* expertise (fast familiar
  answers).
- Resume: reopening a source projects an **episode resume card** from the latest episode + deltas
  + version diff (CSE-002 §3.1): last concept, last open confusion, days since, "what's changed
  since you last opened this."

## 5. Longitudinal Projections

Because episodes and deltas are permanent (subject to §7), the system can show a learner how
their reasoning, curiosity, and research capability evolved across **years**: the Cognitive Time
Machine's *My Timeline* mode (CSE-009 §3) is a pure projection over delta history — including
resurfacing like "you previously confused eigenvectors with coordinate axes here" and "you later
used this concept in your recommendation-system project."

## 6. Observability & Testing

- Telemetry: episode resolution rate (open confusions reaching resolved/breakthrough),
  delta density per session, stage-transition evidence quality, resume-card usefulness.
- Tests: mutation-typing conformance (no episode writes outside the protocol), consolidation
  round-trips, redaction cascades (§7), replay of episode assembly from event history,
  stage-transition gating (no transition without evidence refs).

## 7. Governance — Forgetting Is Real

- "Forget this episode" is a **redaction mutation with cascade**: the episode, its delta, its
  journal links, and any learner-side world-state edges derived from it are redacted; dependent
  projections (resume cards, timelines) recompute. Audit trail records that a redaction occurred
  (not the content). Export-everything is available at all times.
- Episodes referencing human-source content inherit the consent envelope; consent revocation
  (CSE-002 §8) cascades into episodes automatically.
- Thinking-pattern observation can be disabled per learner; disabling stops collection and hides
  (not deletes) prior patterns pending explicit deletion.

## 8. Open Questions

- Episode boundary heuristics (topic-shift detection vs. session end vs. learner-declared) —
  needs usage data; start with session end + explicit "new thread" signals.
- Whether Understanding Deltas should also feed the digital twin lifecycle (DPS-009) as twin
  update material — joint decision with `persistence/`.
- Stage-model calibration: the eleven-stage ladder may need per-domain collapsing (some domains
  have no meaningful `Paradigm Formation` for individual learners).
