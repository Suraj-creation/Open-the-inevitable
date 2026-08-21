# 06 — Architecture Implications · Existing-vs-New · Roadmap · Risks · Ethics · Publication

> Part of the **Persistent Cognitive Intelligence** research program. See [`README`](README.md).
> Status: research proposal (not adopted law).

---

## Section 24 — Architecture Implications

If the program's primitive is adopted, the architectural changes are **additive projections and
extensions**, not new subsystems. Enumerated against the eight-contract seam and the five cognitive
layers so the impact is legible.

**Where it lives.** The Cognitive State is a **Knowledge/Belief-tier projection** (emergent Layer 3),
sensed through the surface, measured by Evaluation (Layer 2), and feeding Research (Layer 4) and
governed self-evolution (Layer 5). It is the concrete first draft of the blueprint §26.14 deferred
epistemology layer. It requires **no new adapter contract** — it reads the event log
(`EventTransport`), materializes in the graph (`GraphStore`/world-state), retrieves via
`VectorStore`, and uses `ModelRuntime` only for the (governed, recorded) evidence-extraction and
mental-model-hypothesis steps. This matters: adding a ninth contract requires an ADR, and the program
deliberately needs none.

**New typed contracts (schema-level, not infrastructure):** `CognitiveEvidence`, `CognitiveState`
(factored belief), `CognitiveUncertainty` (distribution + calibration metadata), `MentalModel`,
`CognitiveTrajectory`, `CognitiveIntervention`/`CognitiveOutcome`. These are JSON Schemas + generated
types (ADR-0003 canonical-contract discipline), registered in the protocol registry, and — critically
— **replay-re-derivable folds over the chronicle**, so they add no source-of-truth.

**Extensions to existing units (backward-compatible):**
- `CognitiveAnalysisEngine` (ADR-0017) → gains **per-learner** calibration (today aggregate-only).
- The distiller registry (ADR-0035) → distillers become **evidence producers** feeding the belief;
  their hardcoded confidences are replaced by measured reliabilities.
- Memory projection math → the fixed `reinforce/decay` rules become **parameterized belief updates**
  (variance-aware gain; per-learner forgetting), still expressed as `MemoryMutation`s (no new write path).
- Director FSM → gains an **information-value input**; the authored pedagogy remains the safety governor.
- `EvolutionEngine`/`ShadowEvaluator` (ADR-0021) → become the **randomized-intervention-trial** vehicle
  for causal attribution.
- The Cognitive Surface → renders the belief as an **Open Learner Model** (scrutable, correctable).

**Invariant compliance (must hold):** every belief mutation is a typed memory mutation (inv. 2); every
belief component carries evidence (inv. 8); the belief is a fold, never hidden state (inv. 9); every
belief-producing unit emits observability (inv. 10); active-diagnosis probes that side-effect pass
governance (inv. 5). The program does not bend an invariant; it instantiates the layer they were
written to protect.

---

## Section 25 — Existing-vs-New Component Analysis (the primitive recommendations)

For each proposed primitive: **why it exists**, **what UCI already has**, **unify or build**, **layer**,
and **what it unlocks**. This is the "do not duplicate" ledger, and its dominant verdict is *unify /
extend*, not *create*.

**`CognitiveEvidence`** — *Why:* interpose interpretation between observation and belief; make evidence
reliability measured, not asserted. *UCI has:* `MemoryMutation.evidence[]`, `provenance_refs`,
`source_trace_id`, distiller inputs — scattered, unstructured. *Verdict:* **NEW record that unifies**
existing fields; do not add a store. *Layer:* Research (4) → Kernel later. *Unlocks:* multi-channel
fusion; the shared join point between learner-belief and the Claim Graph.

**`CognitiveState` (BeliefState)** — *Why:* one calibrated, probabilistic, factored belief the four
current representations project from. *UCI has:* four fragmented point-estimate representations
(mastery nodes, twin map, intelligence artifacts, memory mutations). *Verdict:* **NEW unifying
projection; reconcile, do not parallel.** *Layer:* Belief (3) / Epistemology. *Unlocks:* calibrated
uncertainty; active diagnosis; the deferred §26.14 layer; the Digital Twin's real substance.

**`CognitiveUncertainty`** — *Why:* a belief without variance cannot drive information-seeking. *UCI
has:* bare scalar `confidence` everywhere; aggregate calibration only. *Verdict:* **EXTEND the scalar
fields** into distribution + calibration metadata; do not replace the API surface, widen it. *Layer:*
cross-cutting, **gated on Evaluation (2)**. *Unlocks:* EIG probing; "knowing what it doesn't know."

**`MentalModel` / `CognitiveHypothesis`** — *Why:* model coherent wrong models, learner-bound and
time-tracked. *UCI has:* MRL `misconception-hypothesis {wrong_model, diagnostic_probe, repair_route}`
(source-scoped) + counter-based `misconceptionTracker`. *Verdict:* **PROMOTE + learner-bind** the MRL
structure; unify with the `misconception` epistemic role (ADR-0058) for rendering. *Layer:* Belief (3).
*Unlocks:* targeted remediation; the `misconception-dissolve` render grammar made true-about-this-learner.
**Highest-risk (see H3); ship behind a fidelity gate.**

**`CognitiveTrajectory`** — *Why:* durable understanding is a longitudinal, queryable claim. *UCI has:*
`learner.episode` + `understanding-delta` artifacts; exact `materialize_state(at_time)`. *Verdict:*
**PROMOTE the ingredients** to a first-class queryable object; do not rebuild time-travel (it exists).
*Layer:* Research (4). *Unlocks:* durability metrics; counterfactual forking; the compounding training set.

**`CognitiveDiagnosis` (active probe selection)** — *Why:* the largest missing faculty. *UCI has:*
`nextConcept` (topology) — **nothing information-theoretic.** *Verdict:* **BUILD NEW** (EIG/BALD/CAT
applied to the factored belief; cost = existing attention budget). *Layer:* Research (4). *Unlocks:*
faster, less effortful diagnosis; the whole active loop.

**`CognitiveIntervention` / `CognitiveOutcome`** — *Why:* selection as policy; attribution as causal.
*UCI has:* `pedagogy.intervention-outcome` distiller (temporal-correlation, "honestly weak", conf 0.6)
+ Director directives. *Verdict:* **EXTEND** the distiller into a typed pair with causal estimation; use
the existing `EvolutionEngine` for randomization. *Layer:* Research (4) → Evolution (5). *Unlocks:*
learnable pedagogy; durable-outcome evidence for governed self-evolution.

**`CognitiveGoal`** — *Why:* utility over information/learning needs the learner's own objectives. *UCI
has:* `TwinSnapshot.goals` **hardwired `[]`** (a named stub). *Verdict:* **FILL THE STUB**; elicit and
persist goals as observable/elicited state. *Layer:* Belief (3). *Unlocks:* goal-conditioned diagnosis
and intervention; personalization beyond mastery topology.

**Net ledger:** 2 genuinely new (`CognitiveEvidence` record, `CognitiveDiagnosis` faculty), 1 new
unifying projection (`CognitiveState`), 4 extensions/promotions of existing structures, 1 stub to fill.
**The program is ~70% unification and extension, ~30% new** — the correct ratio for a mature substrate,
and the direct answer to `CLAUDE.md` §20 ("pull the research into UCI, do not fragment it further").

---

## Section 26 — Research Roadmap

Phases map onto the emergent-architecture layers and are **evaluated, not assumed** — each is a
go/no-go gate, and the program explicitly may stop at any phase.

| Phase | Name | Deliverable | Gate to proceed |
|---|---|---|---|
| **R0** | Formalization | `CognitiveState` + `CognitiveEvidence` schemas; reconciliation projection; replay conservation proof (E0) | No capability regression (H5) |
| **R1** | Language → Evidence | Evidence extraction + interpretation pipeline; measured reliability (E1–E2) | Calibration beats hardcoded baseline (H1) |
| **R2** | Evidence → State | Belief update with calibrated uncertainty; per-learner calibration harness | **Layer-2 calibration gate passes** (the hard gate) |
| **R3** | State → Diagnosis (mental models) | Generative-discrepancy misconception belief (E4) | Beats chance + counter-baseline (H3) — **else demote to render-hint and skip** |
| **R4** | State → Active Diagnosis | EIG probe selection (E3) | Beats topology/random on interactions-to-precision (H2) |
| **R5** | State → Intervention | Belief-conditioned policy + causal attribution; governed shadow trials (E5) | Durable-outcome effect under matched exposure (H4) |
| **R6** | Longitudinal cognition | Per-learner forgetting; durability at t+Δ (E6) | Durability prediction beats fixed decay (H7) |
| **R7** | Multimodal cognition | Additional evidence channels into the same belief (reuse Source-Fusion discipline) | Added channels improve calibration/diagnosis |
| **R8** | Research cognition | Instantiate the primitive over hypotheses (Claim Graph unification) | Primitive transfers with no re-architecture |
| **R9** | Autonomous cognitive systems | Persistent research agents on the shared belief substrate | Evaluation + governance maturity (Layer 5 gate) |

**Evaluation of the roadmap itself.** R0–R2 are the *foundational, must-do* core (unify + calibrate);
R3 is *high-risk, skippable* (the mental-model fidelity bet); R4–R6 are the *scientific payload*
(active diagnosis + causal intervention + durability — the publishable contributions); R7–R9 are
*long-horizon* and explicitly not committed. The honest recommendation: **commit to R0–R2 and R4–R6;
treat R3 as a gated experiment; treat R7–R9 as vision, not plan.**

---

## Section 27 — Risks and Failure Modes

**Scientific.** (1) **Language-fidelity failure (highest).** Misconception reconstruction may not beat
chance (Scarlatos et al. 2026). *Mitigation:* pre-registered fallback — demote mental models to
render-hints; proceed on competence + uncertainty + active diagnosis. (2) **Calibration failure.**
Measured reliabilities may not calibrate per-learner with sparse data. *Mitigation:* hierarchical
priors (pool across learners), honest "insufficient evidence" states. (3) **Causal identification
failure.** Observational confounding may defeat attribution. *Mitigation:* governed randomization via
`EvolutionEngine`; report effects only where identified. (4) **Non-stationarity.** Humans drift; the
dynamical model mis-specifies. *Mitigation:* model what is identifiable; widen uncertainty otherwise;
never assert precise mental state.

**Architectural.** (5) **Fragmentation-by-addition** — the belief becomes a *fifth* representation
instead of unifying the four. *Mitigation:* R0 conservation proof is a hard gate; the four must become
read-models or the phase fails. (6) **Store creep** — the belief drifts into a parallel database.
*Mitigation:* projection-only invariant; replay-re-derivability is a test, not a hope. (7) **Latency /
cost** — EIG and per-learner inference on the critical path. *Mitigation:* factored sparse belief;
surrogate acquisition; belief update off the ask's critical path (UCI already does speculative
off-critical-path work).

**Product.** (8) **Over-reliance / automation bias** — treating a probabilistic belief as ground truth
about a person. *Mitigation:* the Open Learner Model surfacing; uncertainty always visible; learner
correction is first-class. (9) **The confident-wrong belief** — a miscalibrated high-confidence
misconception mis-teaches. *Mitigation:* the Layer-2 calibration gate; honest-absence over fabrication
(UCI's existing ethos). (10) **Motivational harm** — a visible "you don't know this" belief demotivates.
*Mitigation:* CDL/affect governance; framing as growth, not deficit (vision's stated ethos).

**Meta.** (11) **Over-claim risk** — the program's own novelty could be oversold. *Mitigation:* §18's
explicit not-the-gap list; mandatory baselines beating both naïve methods *and* UCI's current
mechanism; this document's provenance discipline.

---

## Section 28 — Ethical and Privacy Considerations

A persistent, probabilistic model *of a person's mind* is among the most sensitive artifacts a system
can hold. UCI's existing governance is a genuine head-start; the program tightens rather than relaxes it.

- **Consent and revocation.** The belief is learner data; the ADR-0054 consent/revocation/redaction
  cascade extends to every belief component and its evidence (revoke → belief redacted, content 410,
  commons delisted). *Named-deferred honestly:* retroactive teaching retraction remains impossible
  ("cannot un-teach"); durable consent persistence across restart is still process-lifetime.
- **Scrutability and control (Open Learner Model).** Following Bull & Kay (2007) and Conati (2018), the
  learner can **inspect, question, and correct** the belief about them. This is not a nicety; it is the
  trust condition and aligns with UCI's "sensing legible, never a hidden score" (CSE-005 §3.5).
- **No hidden scoring / no covert profiling.** Affect/attention/expertise inferences are learner-visible
  and opt-out today; belief components inherit this. The belief must never become a shadow dossier.
- **Interpretability as an ethical requirement.** Every belief assertion traces to evidence (invariant
  8); a learner may ask "why do you believe this about me?" and receive the evidence chain — the same
  reasoning-trace transparency UCI already provides for mastery.
- **Fairness and calibration equity.** Calibration must be checked across learner subgroups, not just in
  aggregate; a belief that is well-calibrated on average but poorly on a subgroup is a fairness failure.
- **Collective vs. individual.** The no-memory-laundering rule (F05 §10, double-consent to promote
  private → collective) governs how trajectories feed population-level compounding; de-identification is
  necessary but not sufficient — trajectory shapes can be re-identifying, so aggregation must be audited.
- **Purpose limitation.** A model built to *help someone learn* must not be repurposed to *rank,
  gate, or surveil* them. This belongs in governance policy, not just intention.

---

## Section 29 — Publication Strategy

The work spans systems and learning science; positioning determines which contribution each venue sees.

- **Systems / architecture contribution** (the unification + closed loop + provenance-preserving
  persistent belief): *AIED*, *EDM (Educational Data Mining)*, *LAK (Learning Analytics & Knowledge)*,
  *L@S (Learning at Scale)*. These value the integrative systems claim and the real longitudinal dataset.
- **Active diagnosis / adaptive intervention** (EIG probing; causal policy; off-policy evaluation):
  *EDM*, *NeurIPS/ICML* workshops (ML-for-education, interactive/active learning), *RLC* for the policy
  work. Frame against BALD/CAT and Rafferty–Brunskill; lead with the *factored multi-channel belief*
  distinction.
- **Mental-model reconstruction / language-evidence fidelity** (the honest, high-risk result): *EMNLP/
  ACL* education tracks, *BEA workshop*. Position explicitly against Scarlatos et al. (2026) — a
  *replication-and-extension with a fidelity gate* is more credible than a novelty claim.
- **Open Learner Model / scrutability / HCI** (belief made visible and correctable): *CHI*, *IUI*,
  *UMAP (User Modeling, Adaptation and Personalization)* — the natural home for the scrutable-belief and
  human-control contributions.
- **Interpretability / trustworthy ML** (provenance-bearing belief; calibration; auditability): *FAccT*,
  *interpretable-ML venues* — where the "persistence and action without losing provenance/control" thesis
  is the contribution.

**Honesty discipline for all venues.** Every submission carries the §18 not-the-gap list, baselines that
beat both naïve methods and UCI's current mechanism, and pre-registered fallbacks for the high-risk
claims. The most defensible papers are the *systems unification* and the *causal durable-outcome* result;
the mental-model paper is submitted only if R3 clears its gate. Publishing a negative R3 result
(language fails to reconstruct misconceptions in this setting) is itself a valuable, publishable
contribution and is planned for, not feared.
