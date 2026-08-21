# 05 — UCI Integration · Autonomous Research · Gap · Questions · Hypotheses · Program · Datasets · Evaluation

> Part of the **Persistent Cognitive Intelligence** research program. See [`README`](README.md).
> Status: research proposal (not adopted law).

---

## Section 16 — Connection to the Existing UCI Architecture

The binding constraint (`CLAUDE.md` §20): *do not create another isolated memory system.* The
Cognitive State is designed as a **projection over the existing substrate**, intersecting the current
subsystems rather than paralleling them.

```
              CHRONICLE (append-only event log)  ── the single source of evidence
                        │  fold
        ┌───────────────┼───────────────────────────────┐
        ▼               ▼                                 ▼
  World-State Graph   Memory tiers                 CognitiveEvidence records   ◀── NEW (projection)
  (mastery nodes,     (typed mutations,                  │ interpret + weight
   claim nodes)        confidence, evidence)              ▼
        │               │                          BELIEF UPDATE (calibrated)
        └───────┬───────┘                                 │
                ▼                                          ▼
      ══════════════════  COGNITIVE STATE (Belief projection)  ══════════════════   ◀── NEW (unifying)
        projects to / reconciles:
          • mastery_checkpoint nodes      (world-state)      — becomes a read-model
          • TwinSnapshot.masteryMap       (digital twin)     — becomes a read-model
          • intelligence.* artifacts      (CIP plane)        — becomes evidence + read-models
          • Claim Graph epistemic status  (domain belief)    — SIBLING instance of the same primitive
                │ query                              │ render
                ▼                                     ▼
        Active Diagnosis (EIG)              Cognitive Surface as Open Learner Model
                │ select                     (belief made visible, scrutable, correctable)
                ▼
        Adaptive Intervention (policy) ──▶ Director FSM (pedagogical governor) ──▶ new evidence
```

**How it honors each architectural law:**

- **Projection, not store** — the Belief is folded from the chronicle and materialized in world-state;
  it adds probabilistic *properties*, not a new database. Satisfies §25.4 invariant 9 (no hidden state
  outside event sourcing) and the §2 projection law.
- **Evidence and provenance** — every belief component links to `CognitiveEvidence` → chronicle events;
  satisfies invariant 8 (no high-risk output without evidence) and makes the belief replay-re-derivable.
- **Governance** — belief reads/writes flow through capability envelopes and memory mutations; the
  consent/redaction cascade (ADR-0054) extends to belief components (a revoked learner's belief is
  redacted with the rest). Satisfies invariants 2 and 5.
- **Measurement gate** — the belief is untrusted until the Cognitive Evaluation Layer scores its
  calibration (ADR-0023 Layer 2). This is the architecture's own gating discipline, not an exception to it.
- **Reconciliation, not duplication** — the four current representations become *read-models* of the one
  belief, directly addressing the codebase's dominant fragmentation failure.

**The unification dividend.** Because Cognitive State and the Claim Graph are the *same primitive* over
different systems-of-interest, one investment yields two upgrades: a probabilistic, actively-maintained
belief substrate for *learners* and a natural home for the blueprint §26.14 deferred epistemology layer
for *domain knowledge*. The program is thus not a feature; it is the concrete first draft of a
substrate layer the architecture already planned.

---

## Section 17 — Connection to Autonomous Research

The long-horizon claim, stated carefully. UCI's arc is *learner → researcher → scientist → discovery
system*, and the vision already gates a "research transition" (UALRCI Stage 5–6; ADR-0026 research
mode; ResearchUnit; frontier overlays). The program's structural thesis makes the bridge precise:

> A research system needs a persistent, provenance-bearing, uncertainty-calibrated Belief over
> **hypotheses, evidence, failed experiments, conceptual models, contradictions, and open questions**
> — which is the *same primitive* as the learner Cognitive State, with "hypothesis space" substituted
> for "human competence." The active-diagnosis loop (choose the probe that most reduces uncertainty)
> becomes *experiment selection* (choose the experiment that most reduces uncertainty about a
> hypothesis). The intervention policy becomes *research-action selection*.

This is not speculative hand-waving: the external landscape confirms persistent, cited hypothesis-state
is *already being built* for scientific discovery — **Kosmos** (Mitchener et al., 2025) uses a
"structured world model" shared across agents over long rollouts, citing every claim to code or
literature. Kosmos proves the primitive is feasible *for domains*; it does **not** do it for a *human
cognitive state* under active diagnosis. UCI's opportunity is to build the primitive *once* and
instantiate it three times (learner competence, domain truth via the Claim Graph, research hypotheses),
which is exactly the emergent-architecture progression: Knowledge Layer (3) → Research Layer (4) →
Autonomous Improvement (5), each gated by Evaluation (2).

**The honest boundary.** The learner and research instantiations share a *primitive*, not an
*implementation timeline*. The program validates the primitive on the learner (rich evidence, clean
ground truth) and merely *shows the path* to the research instantiation; it does not claim to deliver
autonomous science. Over-claiming continuity here would be the exact failure the vision corpus is
prone to. The defensible statement: *persistent cognitive state is a necessary condition for both
durable human learning and autonomous research, and building it as one primitive is how UCI avoids
building it twice.*

---

## Section 18 — The Research Gap

After repository and literature review, stated precisely and defensibly.

**What is NOT the gap (would be over-claims):** inferring knowledge from language (OKT, ECKT, LLMKT,
Language Bottleneck Models); probabilistic mastery estimation (BKT, Bayesian student models); active
diagnosis / information-gain item selection (BALD 2011; CAT; Rafferty–Brunskill 2011); intervention as
policy (RL/bandits for instruction); causal effect estimation; persistent agent memory (MemGPT,
Generative Agents); scrutable/open learner models (Bull & Kay 2007; Conati 2018); persistent cited
hypothesis-state for science (Kosmos 2025). **Each of these is prior art; claiming any as novel is
unsupported.**

**The genuine, defensible gap is a *systems* gap** — the same conclusion reached independently by the
literature survey and the code audit:

> Existing systems address knowledge tracing, misconception diagnosis, dialogue-based knowledge
> extraction, active diagnosis, adaptive intervention, causal evaluation, and agent memory **as
> separate artifacts**. No system unifies them into a **single, persistent, probabilistic,
> provenance-bearing Cognitive State** that (1) fuses *heterogeneous* evidence across *long horizons*
> into one revisable posterior that all downstream faculties *project from*; (2) carries **calibrated
> per-individual uncertainty** rather than a point estimate or an aggregate calibration; (3) is
> **actively maintained** by information-gain-driven probing; and (4) closes the **diagnose → probe →
> intervene → causally attribute → update** loop **without losing provenance, interpretability, or
> control.** UCI itself demonstrates the gap internally: it computes learner state in *four* fragmented,
> point-estimate, passive representations and has *no* active-diagnosis faculty at all.

The gap is real precisely because it is *integrative and architectural*, and because it is validated by
a live system (UCI) that has the substrate but not the belief layer. The novelty is the substrate and
the closed loop, not the parts.

---

## Section 19 — Research Questions

**RQ1 (Representation).** Can a single factored, probabilistic Cognitive State — reconciling UCI's four
current representations — be maintained as a projection over the event chronicle without loss of the
provenance and replayability the substrate guarantees?

**RQ2 (Evidence fusion).** Can heterogeneous, channel-tagged Cognitive Evidence, each with a
*measured* (not asserted) reliability, be fused into one calibrated posterior — and does calibration
improve over the current hardcoded-confidence baseline?

**RQ3 (Fidelity of language evidence).** With what measured reliability can language evidence
(explanations, teach-backs) update competence and mental-model beliefs — and does the interpretation
step (vs. a direct utterance→state map) improve fidelity? *(Framed skeptically after Scarlatos et al.
2026.)*

**RQ4 (Active diagnosis).** Does information-gain-driven probe selection reduce uncertainty about the
Cognitive State in fewer interactions than UCI's topology-driven `nextConcept` and than random/fixed
item selection?

**RQ5 (Mental-model reconstruction).** Can generative-discrepancy modeling recover known buggy/synthetic
models better than chance on held-out behavior, and does an explicit misconception belief improve
downstream remediation over the current counter-based `misconceptionTracker`?

**RQ6 (Adaptive intervention & causality).** Does a belief-conditioned intervention policy, with
*causal* outcome attribution, produce more **durable** understanding (retention/transfer at t+Δ) than
the authored Director FSM — under matched exposure?

**RQ7 (Longitudinal durability).** Does the persistent belief predict later retention and transfer
(the durable-understanding target) — and does modeling per-learner forgetting beat the fixed
`decay_confidence` rate?

**RQ8 (Unification / compounding).** Does treating the Claim Graph and the learner state as one
primitive, and feeding trajectory outcomes to the governed-evolution layer, produce measurable
population-level improvement (compounding) — and can that be shown without confounding?

---

## Section 20 — Hypotheses

**Core hypothesis (H0).** A persistent, probabilistic, provenance-bearing Cognitive State, actively
maintained by information-gain probing and updated by principled belief revision, produces more durable
and transferable understanding per unit of learner effort than UCI's current point-estimate, passive,
topology-driven machinery — *without* degrading provenance, interpretability, or learner control.

**Secondary hypotheses.**
- **H1 (calibration).** Measured evidence-reliability weighting yields better per-learner calibration
  (lower expected calibration error) than the hardcoded per-distiller confidences.
- **H2 (active diagnosis).** EIG-driven probing reaches a target belief precision in significantly fewer
  interactions than topology-order or fixed-form assessment.
- **H3 (mental models).** Generative-discrepancy misconception beliefs predict held-out learner errors
  above chance and above the counter-based baseline (directly testing the Scarlatos caution).
- **H4 (causal intervention).** Belief-conditioned intervention selection with causal attribution
  improves durable outcomes over the authored FSM under matched exposure.
- **H5 (unification).** The four representations can be replaced by read-models of one belief with no
  loss of any capability currently shipped (a *conservation* claim, testable by regression).

**Falsifiable predictions & failure conditions.** H0 is falsified if durability does not improve under
matched exposure, or improves only by *increasing* effort. H2 is falsified if EIG probing does not beat
random/topology selection on interaction-to-precision. **H3 is the highest-risk and the one the
literature predicts may fail** — if language-derived misconception beliefs cannot beat chance on
held-out behavior, the mental-model component is demoted to a *rendering hint* (source-scoped, as
today), and the program proceeds on competence + uncertainty + active diagnosis alone. This
pre-registered fallback is what keeps the program honest rather than promissory.

---

## Section 21 — Experimental Program

A phased program, each phase falsifiable in isolation, each reusing UCI's determinism/replay so that
"benchmarks are recorded sessions re-folded" (exact, not flaky — the architecture's own D2+ property).

1. **E0 — Reconciliation (conservation test).** Build the Cognitive State as a projection; prove by
   replay over recorded sessions that it reproduces every currently-shipped capability (mastery gating,
   resume cards, twin snapshots). *Baseline:* the four current representations. *Metric:* zero
   capability regression (H5).
2. **E1 — Evidence calibration.** Replace hardcoded confidences with measured reliability weights.
   *Baseline:* current distiller constants. *Metric:* per-learner expected calibration error (H1).
3. **E2 — Language-evidence fidelity.** Ablate the interpretation step (direct map vs. extract→interpret).
   *Metric:* prediction of held-out depth-gate outcomes from language evidence (H3-adjacent, RQ3).
4. **E3 — Active diagnosis.** EIG probe selection vs. `nextConcept` vs. random/fixed. *Metric:*
   interactions-to-belief-precision; learner-effort-to-mastery (H2).
5. **E4 — Mental-model reconstruction.** Generative-discrepancy vs. counter-baseline on a
   misconception-annotated set. *Metric:* held-out error prediction vs. chance (H3; the Scarlatos test).
6. **E5 — Adaptive intervention (offline then shadow).** Bandit/offline-RL policy evaluated by
   off-policy estimators, then randomized via the governed `ShadowEvaluator`/`EvolutionEngine`.
   *Metric:* causal durable-outcome effect (H4).
7. **E6 — Longitudinal durability.** Multi-session retention/transfer probes. *Metric:* durability at
   t+Δ; per-learner forgetting fit vs. fixed decay (H7/RQ7).
8. **E7 — Compounding.** Feed trajectory outcomes to governed evolution; measure population-level
   durability drift with rollback control. *Metric:* governed improvement without regression (H8/RQ8).

**Assumptions & their risks.** Ground-truth for "understanding" is proxied by delayed retention/
transfer probes (imperfect but standard); synthetic-learner cohorts (available via UCI's
`SyntheticLearnerSeed`) bootstrap E3–E5 before human data; causal claims (E5–E7) depend on the
governed-experiment machinery to escape observational confounding.

---

## Section 22 — Datasets

**Internal (the decisive advantage).** UCI *generates* the ideal dataset by construction: an
event-sourced, provenance-complete, replayable chronicle of real learning sessions with depth-gate
outcomes, interaction traces, and (with consent) cross-session longitudinal continuity. This is rarer
and richer than any public corpus — most learner-modeling datasets are correct/incorrect-on-tagged-items
with no dialogue, no provenance, no longitudinal follow-up. The consent/redaction cascade (ADR-0054)
governs its research use.

- **Synthetic-learner cohorts** — `SyntheticLearnerSeed` + the deterministic `ShadowEvaluator`
  (ADR-0021) generate controllable trajectories with *known* latent state for bootstrapping and for
  ground-truth active-diagnosis evaluation before human deployment. **MalruleLib** (2026, 101 executable
  malrules) is a natural external seed for buggy-model libraries.

**External (for baselines and positioning).** ASSISTments, EdNet, Junyi (KT benchmarks — for baselines,
acknowledging specialised KT still leads on raw prediction, arXiv:2603.02830); dialogue-tutoring corpora
(for language-evidence work, positioned against LLMKT / Dialogue-KT 2025); misconception-annotated math
sets (for E4). External data is for *baselining and external validity*, not primary training — the
program's target regime (long-horizon, multi-channel, provenance-bearing) is not represented in public
datasets, which is itself part of the gap.

---

## Section 23 — Evaluation Methodology

Evaluation is not an afterthought; it is the **adoption gate** (ADR-0023 Layer 2) and reuses UCI's
existing `@inevitable/evaluation` package (UALRCI scorecard, `CognitiveEvaluationEngine`, replayable
benchmarks). Four evaluation families:

1. **Calibration (per-learner).** Reliability diagrams / expected calibration error on the belief's
   competence posteriors — *per learner*, fixing the current aggregate-only limitation (ADR-0017). This
   is the trust prerequisite; nothing ships on top of an uncalibrated belief.
2. **Diagnostic efficiency.** Interactions (and learner effort/attention) to reach a target belief
   precision; held-out prediction of depth-gate outcomes and errors. Directly scores active diagnosis
   and mental-model fidelity — including the honest chance-level baseline for H3.
3. **Durable outcome (causal).** Retention and *transfer* at t+Δ under **matched exposure**, estimated
   causally (off-policy + governed randomization). This is the durable-understanding target and the only
   honest test of "did the intervention help." Baselines: authored Director FSM; topology sequencing.
4. **Conservation & provenance.** Regression proof that no shipped capability is lost (H5), and an audit
   that every belief component traces to evidence and is replay-re-derivable (the interpretability/control
   requirement, and the invariant-8 obligation).

**Baselines & ablations (mandatory, to prevent over-claim).** Baselines: BKT/DKT (prediction), UCI's
current four representations (capability), `nextConcept` (sequencing), authored Director FSM
(intervention), hardcoded-confidence distillers (calibration). Ablations: with/without the
interpretation step; greedy-EIG vs. POMDP planning; bandit vs. offline-RL; with/without per-learner
forgetting; with/without causal attribution. Every headline claim must beat both a naïve baseline *and*
UCI's own current mechanism, or it is not reported as an improvement.

**Publication venues** are surveyed in [`06 §29`](06-architecture-roadmap-risks-ethics.md); the evaluation
design is chosen to satisfy those venues' bars (calibration, causal identification, honest baselines)
from the outset.
