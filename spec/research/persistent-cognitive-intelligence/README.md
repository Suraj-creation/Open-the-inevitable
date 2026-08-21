# Persistent Cognitive Intelligence — A Research Program for Universal Cognitive Infrastructure

**Status:** Research proposal (Research Layer / Cognitive-Architecture Layer 4). **Not adopted law.**
This corpus refines, challenges, and repositions a research direction; it does **not** modify the
production codebase. Adoption of any primitive proposed here is gated on a future ADR plus the
Cognitive Evaluation Layer's calibration harness (ADR-0023 Layer 2; ADR-0027). See
[§Adoption gate](#adoption-gate).

**Provenance:** produced by a repository-wide investigation (vision corpus, architecture law,
code-level ground truth of the intelligence/mastery/memory planes, surface sensing/intervention,
and an external-literature landscape). Every architectural claim is cited to a file, ADR, type, or
event. Every literature claim is cited to an author/year. This README is the map; the numbered
documents are the investigation.

**Dual corpus.** This program models the **learner's** cognitive state (the Belief State). Its dual,
the [Living Cognitive Agents](../living-cognitive-agents/) corpus, models the **agent's** cognitive
state (Self-Model, Adaptive Policy). The two are the *same primitive family* — persistent,
probabilistic, provenance-bearing state with calibrated uncertainty, pointed at two subjects — and
they **share one epistemic substrate (Evidence → State → Uncertainty) and one Layer-2 calibration
harness**. For the probabilistic layer they should be **adopted together or not at all**: they share
the R0 formalization and the calibration gate. See
[Living Agents §03 §4](../living-cognitive-agents/03-cognitive-state-and-memory.md#4-the-learner-model-dual--one-epistemic-substrate-two-faces).

---

## The one-paragraph thesis

The direction currently framed as *"Persistent Cognitive State Modeling from Natural-Language
Evidence"* is the **right frontier but mis-scoped in three ways**, and the correction makes it both
more defensible and more architecturally native to UCI. First, **UCI already models learner state**
— in at least four fragmented, point-estimate, passively-recorded representations (world-state
`mastery_checkpoint` nodes, the `LearnerCognitionSeed`/`TwinSnapshot` mastery map, the
`intelligence.*` distiller artifacts, and tiered `MemoryMutation`s) — so the problem is **not** "build
a learner model." Second, **"learner state" and "natural language" are both too narrow**: the deeper
object is a **persistent, probabilistic, provenance-bearing *Belief State* with calibrated
uncertainty**, of which the *learner cognitive state*, the *domain knowledge state* (already embodied
in the Claim Graph's epistemic status), and the *research hypothesis state* are three instantiations;
language is the first rich **evidence channel**, not the boundary. Third, the genuine, literature-defensible
contribution is **not any single capability** (Bayesian mastery estimation, active diagnosis, policy
learning, persistent agent memory, and scrutable learner models are all prior art) but the
**unification**: one persistent probabilistic cognitive-state substrate that (a) fuses heterogeneous
evidence into a single revisable posterior all subsystems *project from*, (b) carries **calibrated
per-learner uncertainty with full provenance**, and (c) closes the **diagnose → actively probe →
intervene → causally attribute → update** loop that UCI today leaves open. The scientifically honest
name for the program is therefore **Persistent Cognitive Intelligence**: the study of how a system
constructs, maintains, and acts on a persistent probabilistic model of an evolving cognitive state
*without losing provenance, interpretability, continuity, or control* — with education as the first
laboratory and language as the first evidence modality.

---

## Reading order

| # | Document | Covers (deliverable sections) |
|---|---|---|
| 00 | **README** (this file) | Map, thesis, primitive summary, adoption gate |
| 01 | [`01-synthesis-and-uci-map.md`](01-synthesis-and-uci-map.md) | 01 Repository synthesis · 02 UCI intellectual model · 03 Existing-architecture mapping |
| 02 | [`02-problem-critique-and-refinement.md`](02-problem-critique-and-refinement.md) | 04 Current problem · 05 Critique · 06 Refined problem · 07 First-principles formulation |
| 03 | [`03-the-cognitive-primitives.md`](03-the-cognitive-primitives.md) | 08 Cognitive State · 09 Cognitive Evidence · 10 Cognitive Trajectory · 11 Mental Model |
| 04 | [`04-diagnosis-intervention-and-dynamics.md`](04-diagnosis-intervention-and-dynamics.md) | 12 Active Diagnosis · 13 Adaptive Intervention (+causal) · 14 Longitudinal cognition · 15 Multimodal extension |
| 05 | [`05-integration-and-research-program.md`](05-integration-and-research-program.md) | 16 Connection to UCI · 17 Autonomous research · 18 Research gap · 19 Research questions · 20 Hypotheses · 21 Experimental program · 22 Datasets · 23 Evaluation |
| 06 | [`06-architecture-roadmap-risks-ethics.md`](06-architecture-roadmap-risks-ethics.md) | 24 Architecture implications · 25 Existing-vs-new component analysis · 26 Research roadmap · 27 Risks & failure modes · 28 Ethics/privacy · 29 Publication strategy |
| 30 | [`persistent-cognitive-intelligence-thesis.md`](persistent-cognitive-intelligence-thesis.md) | 30 Final research thesis (the capstone deliverable) |

---

## The corrected progression (validated, not assumed)

The originating prompt proposed a linear chain: *Language → Evidence → Cognitive State → Mental
Models → Cognitive Trajectories → Active Diagnosis → Adaptive Intervention → Learning → Persistent
Experience → Compounding Intelligence → Research → Discovery*. The investigation **validates the
elements but rejects the linearity**. Four corrections (defended in
[`02`](02-problem-critique-and-refinement.md) and [`03`](03-the-cognitive-primitives.md)):

1. **Language is a channel, not the root.** The root is **Observation**, of which language is the
   first and richest tractable channel. Nothing in the loop is language-specific.
2. **It is a closed loop, not a pipeline.** *Compounding* is precisely the loop feeding its own
   priors and policies; drawn as a line, the central claim disappears.
3. **Mental models are *inside* the Cognitive State, not a later stage.** A mental model is a
   hypothesis the state holds about the learner; a misconception is a mental model with high
   posterior mass that disagrees with the canonical model.
4. **Uncertainty and Provenance are missing and load-bearing.** They are the two properties that
   distinguish this program from the prior art and from UCI's own current point-estimate machinery.

```
            ┌───────────────────────────── the persistent loop ─────────────────────────────┐
            │                                                                                │
 Observation ──▶ Cognitive Evidence ──▶ Belief update ──▶ Cognitive State ──▶ Active Diagnosis ┐
 (language-first,   (extracted,          (Bayesian /       (probabilistic,    (choose the      │
  multi-channel)     interpreted,         principled         calibrated         maximally-      │
                     provenance-          revision)          uncertainty;       informative     │
                     stamped)                                mental-model        next action)   │
            ▲                                                hypotheses)             │          │
            │                                                                        ▼          │
            └──────────── new Observation ◀── Adaptive Intervention ◀── (causally attributed) ──┘
                                              (Director / policy)
   ─────────────────────────────────────────────────────────────────────────────────────────
   The accumulated, provenance-preserving history of this loop over time  =  Cognitive Trajectory
   The loop improving its own priors, policies, and evidence-extractors    =  Compounding Intelligence
   The SAME loop with "learner" replaced by "researcher / agent"           =  Research → Discovery
```

The final claim — that the identical loop, applied to a *researcher's* belief over hypotheses rather
than a *learner's* belief over competence, is the bridge to autonomous research — is the program's
long-horizon significance (see [`05 §17`](05-integration-and-research-program.md)).

---

## What should become a first-class UCI primitive (summary)

Full analysis with "already exists / unify / defer" verdicts in
[`06 §25`](06-architecture-roadmap-risks-ethics.md). Headline recommendations:

| Proposed primitive | Verdict | Home |
|---|---|---|
| **`CognitiveEvidence`** | **NEW but unifies** scattered `MemoryMutation.evidence[]`, `provenance_refs`, distiller inputs | Research Layer first |
| **`CognitiveState` (BeliefState)** | **NEW unifying projection** over the ~4 fragmented representations; *not a new store* | Research Layer → Epistemology Layer |
| **`CognitiveUncertainty`** | **EXTENDS** the bare scalar `confidence` fields everywhere with a distribution + calibration | Cross-cutting, gated on Layer 2 |
| **`MentalModel` / `CognitiveHypothesis`** | **PARTIALLY EXISTS** as MRL `misconception-hypothesis {wrong_model, diagnostic_probe, repair_route}` — but about *sources*, not learners, and untracked | Promote + learner-bind |
| **`CognitiveTrajectory`** | **PARTIALLY EXISTS** via episodes + understanding-deltas + `materialize_state(at_time)`; make it a queryable object | Research Layer |
| **`CognitiveDiagnosis`** (active probe selection) | **GENUINELY MISSING** — the single largest capability gap | Research Layer |
| **`CognitiveIntervention` / `CognitiveOutcome`** | **PARTIALLY EXISTS** — weak `pedagogy.intervention-outcome` distiller (conf 0.6, "honestly weak") + Director directives; make selection a causally-informed policy | Extend |
| **`CognitiveGoal`** | **EXISTS as a stub** — `TwinSnapshot.goals` is hardwired `[]` | Fill in |

**Governing rule (do not duplicate):** every primitive above is proposed as a **projection over the
existing event-sourced substrate** or an extension of an existing typed field — never a parallel
store. UCI's law that "memory, orchestration, workflows, agents, and runtime state are projections
of a unified world-state architecture" (`CLAUDE.md` §2) is the design constraint, not an obstacle.

---

## Adoption gate

This program deliberately stops before implementation (per the originating instruction). The
architecturally lawful path from *proposal* to *production primitive*:

1. **Formalize (R0)** — define the Cognitive State object and the Cognitive Evidence record as
   **types + JSON Schema**, and prove they are re-derivable by replay of the existing chronicle.
2. **Measure before trust (Layer 2 gate)** — the Cognitive Evaluation Layer (ADR-0027) must be able
   to score **per-learner calibration** of the probabilistic state before any downstream system
   depends on it. Today calibration is measured only *in aggregate* (`CognitiveAnalysisEngine`,
   ADR-0017). This is the hard prerequisite; the blueprint itself gates Layers 4–5 behind Layer 2.
3. **One ADR, terse** — adopting a first-class belief/uncertainty primitive is a §25.4-level
   architectural decision and earns exactly one ADR (per `CLAUDE.md` §4), recording context,
   decision, and the rejected alternative of "extend point-estimate confidence in place."
4. **Then implement** — as a governed projection, behind the eight-contract seam, with observability
   and replay, exactly as every other cognitive capability.

Until steps 1–3 clear, the material here lives in the Research Layer, where hypotheses belong.
