# 03 — Cognitive State · Cognitive Evidence · Cognitive Trajectory · Mental Model

> Part of the **Persistent Cognitive Intelligence** research program. See [`README`](README.md).
> Status: research proposal (not adopted law). Definitions here are *design intent*, not yet types.

---

## Section 08 — What "Cognitive State" Actually Means

Used loosely, "cognitive state" is a slogan. Used rigorously, it is a **factored Belief**: a
probability distribution over a structured set of latent variables about a system-of-interest,
carrying uncertainty and provenance, updated by evidence, queried for action. The first discipline is
to separate what the system can *measure* from what it must *infer* — the prompt's most important
methodological demand.

**The four epistemic classes of every state variable.** No variable is trusted without knowing which
class it belongs to.

| Class | Definition | Example (learner) | UCI today |
|---|---|---|---|
| **Observable** | Directly recorded from interaction; not inferred | The exact answer text; that an interrupt fired at segment 3; a depth-gate pass/fail | Recorded as events (strong) |
| **Latent** | Never directly seen; must be inferred with uncertainty | *Does the learner understand gradient descent?* The learner's actual mental model | Collapsed to a scalar `confidence` (weak) |
| **Derived** | Computed deterministically from other state | Prerequisite readiness = f(mastery of parents); expertise = f(coverage, mean confidence) | `expertiseFromMastery()` exists (ok) |
| **Hypothesized** | The system suspects but has insufficient evidence | *A specific misconception the learner may hold* | MRL `misconception-hypothesis` (source-scoped only) |

The failure mode this taxonomy prevents is UCI's current one: **treating a latent variable as if it
were observable** by asserting a hardcoded `confidence`. A latent variable must always carry its
uncertainty; a hypothesized variable must be labeled as such and must *drive* evidence-gathering, not
masquerade as belief.

**A factored definition of learner Cognitive State.** The full state is intractable if monolithic;
it factors into components, each a Belief with its own class and uncertainty:

```
CognitiveState(learner, t) = {
  competence   : per-concept posterior  P(mastery_c | evidence≤t), with variance     [latent]
  models       : set of MentalModel hypotheses per concept, with posterior mass       [hypothesized]
  misconceptions: MentalModels whose mass disagrees with canonical model              [hypothesized]
  reasoning    : distribution over reasoning-strategy use (analogical, procedural…)   [latent]
  retention    : per-concept forgetting-curve parameters, fit to this learner         [latent/derived]
  transfer     : cross-domain readiness edges (evidence of A→B transfer)              [latent]
  affect       : {frustrated|confident|engaged|…} with confidence, or null            [latent, honest-null]
  attention    : budget {high|medium|low|depleted}                                    [derived]
  expertise    : {novice|intermediate|expert} per region                             [derived]
  goals        : the learner's own objectives                                         [observable/elicited]
  provenance   : every above assertion links to the Evidence that produced it         [meta]
}
```

Three design commitments distinguish this from UCI's four current representations:

1. **Uncertainty is intrinsic, not attached.** `competence` is `P(mastery)` *with variance*, not a
   scalar. The variance is what active diagnosis consumes. A high-mean/high-variance belief ("probably
   knows it, but we've barely tested") behaves differently from high-mean/low-variance ("verified") —
   UCI cannot currently express this distinction, and it is the crux of knowing what to probe.
2. **One object, many projections.** The existing `mastery_checkpoint` nodes, `TwinSnapshot.masteryMap`,
   intelligence artifacts, and memory mutations become **projections/read-models of this one state**,
   reconciled rather than parallel. This is the anti-duplication requirement made concrete.
3. **Provenance is mandatory.** Every component links to the `CognitiveEvidence` (§09) that moved it.
   This is the property UCI already has (`provenance_refs`, `evidence[]`) and the literature usually
   lacks; it is preserved as a hard invariant, satisfying blueprint §25.4 invariant 8.

**What Cognitive State is *not*.** It is not the memory tiers (those are the substrate that persists
it); it is not the world-state graph (that is where it lives as a projection); it is not the event log
(that is the evidence it is folded from). It is the *belief layer* — the thing the blueprint §26.14
deferred and the Claim Graph half-built for domain truth.

---

## Section 09 — The Cognitive Evidence Model

The program's second structural commitment: **never map `observation → state` directly.** Insert a
typed, inspectable pipeline. This is both a scientific requirement (the direct map is unreliable —
Scarlatos et al. 2026) and an architectural one (UCI already inserts grounding/interpretation in the
MRL and Claim units; this generalizes that pattern).

```
Observation ──▶ Evidence extraction ──▶ Evidence interpretation ──▶ Hypothesis ──▶ Belief update
(raw event:     (channel-tagged,          (what does this imply       (candidate     (calibrated
 utterance,      grounded span, e.g.       about latent state, and     mental-model   posterior
 answer, click,  "learner conflated       with what reliability?)      / competence   revision)
 interrupt,      X and Y here")                                        claim)
 source anchor)
```

**The `CognitiveEvidence` record (proposed).** A first-class primitive that generalizes the scattered
`MemoryMutation.evidence[]`, `provenance_refs`, and distiller inputs into one typed object:

```
CognitiveEvidence = {
  evidence_id, learner_cid,
  channel      : "language" | "assessment" | "interaction" | "attention" | "source" | "multimodal"
  observation_refs : event ids in the chronicle (the raw observation)     ← provenance, replay-safe
  extracted    : grounded, structured signal (e.g. {claim_ref, span, "conflation(X,Y)"})
  interpretation : { implies: state-variable, direction: +/−, strength: 0..1 }
  reliability  : channel- and method-calibrated weight (NOT a constant)   ← the fix for hardcoded conf
  produced_by  : the extractor unit + method_version                       ← governed, auditable
}
```

Two properties are load-bearing:

- **Reliability is *calibrated*, not asserted.** The single worst pattern in UCI today is the
  hardcoded per-distiller `confidence` (0.6–0.9). Here, an evidence record's `reliability` is a
  *measured* property of its channel and extractor — how often does "language-extractor v3 detecting
  conflation" actually predict the later depth-gate outcome? That measurement is exactly what the
  Cognitive Evaluation Layer can produce, closing the loop between the belief and its own trustworthiness.
- **Interpretation is separable and inspectable.** Because `extracted` and `interpretation` are
  distinct fields, a human (or an evaluation agent) can audit "the system saw *this* and concluded
  *that*" — the scrutability the Open Learner Model literature (Bull & Kay 2007; Conati 2018) shows is
  necessary for trust, and which UCI's governance ethos already demands.

**Why Cognitive Evidence should be a foundational primitive.** It is the *join point* of the two
existing belief layers. A `CognitiveEvidence` whose `interpretation.implies` is a learner competence
variable updates the learner Cognitive State; one whose interpretation implies a *domain* claim
updates the Claim Graph. **The same evidence pipeline serves both belief layers** — which is the
mechanism by which the program unifies rather than fragments. It belongs in the Research Layer first
(as a projection/harness), graduating toward the kernel only once its reliability calibration is
trusted.

---

## Section 10 — The Cognitive Trajectory Model

A learner is not a profile; a learner is a *path*. UCI already asserts this ("understanding is a
trajectory," `materialize_state(at_time)`) but never makes the trajectory a first-class object. The
program does.

**Cognition as a temporal dynamical system.** Model state evolution as a controlled stochastic
process:

```
CognitiveState(t+1) = f( CognitiveState(t), Intervention(t), time-elapsed, Evidence(t) ) + noise
```

where `f` composes: **learning** (evidence + intervention raise competence), **forgetting** (a decay
process on elapsed time — UCI's `decay_confidence` is the crude current form; the program fits a
*per-learner* forgetting curve, a solved idea from MemoryBank and spaced-repetition research),
**reinforcement**, **conceptual restructuring** (a discrete jump when a misconception dissolves),
**transfer** (competence in A raises the prior for B across a `bridges_to` edge), and **regression**.

This reframes several UCI heuristics as special cases of a principled model:

- The fixed `reinforce_concept → c+(1−c)·conf` rule is a **degenerate Kalman-style update with a
  fixed gain**; the program makes the gain a function of evidence reliability and current variance.
- `decay_confidence → c·factor` is a **fixed forgetting rate**; the program fits the rate per
  learner/concept from observed retention.
- Prerequisite descent on confusion is a **discrete restructuring transition**; making it part of the
  dynamical model lets the system *predict* when descent will be needed, not only react.

**The `CognitiveTrajectory` as a queryable object.** The ingredients exist — `learner.episode` and
`learner.understanding-delta` artifacts, exact time-travel replay. The proposal is to promote the
trajectory to a first-class, queryable research object supporting: *velocity* (rate of competence
gain), *durability* (retention after Δt — the durable-understanding target), *regression detection*,
*transfer events*, *restructuring events* (misconception→correction), and *counterfactual forking*
("what if B were taught before A?", which UCI's snapshot/restore already supports mechanically). The
trajectory is what turns "durable understanding" from a slogan into a *measurable* longitudinal claim,
and it is the object longitudinal evaluation ([`04 §14`](04-diagnosis-intervention-and-dynamics.md)) scores.

**Trajectories as persistent research objects.** Aggregated and de-identified, trajectories become the
raw material for the collective-intelligence and self-evolution layers: which intervention sequences
produce durable understanding for which trajectory shapes? This is where the learner-modeling research
feeds the governed-self-evolution machinery UCI already has (ADR-0021) — the compounding loop at the
population level.

---

## Section 11 — The Mental-Model Model

The deepest and riskiest frontier. A wrong answer is cheap information; a *coherent wrong model* is
rich information. The learning-science canon is unambiguous that student errors are frequently
rule-governed and internally coherent, not random noise: Brown & Burton's **buggy models** (DEBUGGY,
1978), diSessa's **knowledge-in-pieces / p-prims**, Chi's **ontological miscategorization**, and
Vosniadou's **synthetic models**. UCI has exactly one structure that touches this — the MRL
`misconception-hypothesis {wrong_model, diagnostic_probe, repair_route}` — but it is scoped to *source
text*, not the *learner*, and is never tracked over time.

**Reconstruction as diagnostic inference.** Represent a mental model explicitly as a *generative*
object and diagnose by discrepancy:

```
Learner Mental Model A  ──predicts──▶  observed behavior / answers / explanations
Canonical Model         ──predicts──▶  expected behavior
                          the DISCREPANCY is the diagnostic evidence
```

The system maintains, per concept, a small set of candidate models (canonical + a library of known
buggy/synthetic models drawn from the learning-science literature and, later, mined from data — cf.
MalruleLib 2026, 101 executable malrules). Each observation is scored under each candidate; the
posterior over candidates *is* the misconception belief. A misconception is then, precisely: **a
non-canonical mental model carrying significant posterior mass.** This makes "misconception" a
first-class, learner-bound, time-tracked component of Cognitive State — resolving the
counter-only representation of the current `misconceptionTracker` distiller.

**The honesty constraint (non-negotiable).** The literature's strongest cautionary result is that
LLM-based inference of misconceptions from language is *near-chance* (Scarlatos et al. 2026,
error-prediction ≈ 0.06). Therefore mental-model reconstruction is treated as **hypothesis generation
under explicit uncertainty**, whose fidelity must be *measured against held-out behavior*, never
asserted. The generative-discrepancy framing is what makes this measurable: a candidate model earns
posterior mass only by *predicting the learner's next behavior better than the alternatives*. A model
that cannot predict is discarded — the same grounding discipline UCI's MRL parser already enforces
(drop ungrounded units) and the Claim unit enforces (a fabricated contradiction is worse than a missed
one). This is the difference between reconstructing mental models and hallucinating them.

**Why this belongs in UCI specifically.** Because UCI *renders cognition* — the Representation
Intelligence Agent already has a `misconception` epistemic role and a `misconception-dissolve` render
grammar (ADR-0058). A learner-bound mental-model belief gives that render grammar something *true about
this learner* to dissolve, instead of a generic misconception drawn from the source. The belief layer
and the surface layer complete each other: the surface becomes an **Open Learner Model** — the belief
made visible, scrutable, and correctable by the learner — which the OLM literature (Bull & Kay; Conati)
identifies as the trust-critical design, and which UCI's governance ethos already mandates ("sensing
legible, never a hidden score," CSE-005 §3.5).
