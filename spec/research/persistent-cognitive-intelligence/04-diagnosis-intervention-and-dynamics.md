# 04 — Active Diagnosis · Adaptive Intervention · Longitudinal · Multimodal

> Part of the **Persistent Cognitive Intelligence** research program. See [`README`](README.md).
> Status: research proposal (not adopted law).

---

## Section 12 — Active Cognitive Diagnosis

This is **the single largest capability gap** in UCI. The audit is unambiguous: the only "what next"
is `KnowledgeGraphEngine.nextConcept()`, which walks prerequisite topology; the Director FSM *reacts*
to offered signals; "the learner is the diagnostician; the system routes." Nothing anywhere asks the
active question:

> *What should I ask or do next to most reduce my uncertainty about this learner's Cognitive State?*

**Formalization as expected information gain.** Given the current belief `b = P(state | evidence≤t)`
and a set of candidate probing actions `A` (each with a cost), select

```
a* = argmax_{a ∈ A}  [ E[ InformationGain(a) ]  −  λ · cost(a) ]

where  InformationGain(a) = H(b) − E_{o∼P(o|a,b)}[ H(b | a, o) ]     (expected entropy reduction)
```

i.e. choose the probe whose expected answer most sharpens the belief, discounted by its attentional
cost (UCI already tracks an `attention` budget — that is the `cost` term, ready to use). This is
**not novel as a technique** — it is Bayesian active learning (BALD, Houlsby et al. 2011), sequential
experimental design (Lindley 1956), and item selection in Computerized Adaptive Testing (maximum
Fisher information). Its novelty here is **integrative**: applying it against a *persistent, factored,
multi-channel* Cognitive State rather than a single-skill IRT ability, and letting the action space
include UCI's *rich* probe repertoire, not just test items.

**The probe repertoire is already built.** UCI's interaction grammar and pedagogy already contain the
actions active diagnosis would select among — the program contributes the *selection principle*, not
the actions:

| Probe | Reduces uncertainty about | Already in UCI |
|---|---|---|
| Ask for an explanation | depth of `competence`, `reasoning` strategy | five-test depth (explanation) |
| Ask to apply to a novel problem | transfer, robustness | depth (application) |
| Ask for a prediction | which `MentalModel` candidate has mass | — (new) |
| Teach-back | model structure, gaps | depth (teaching); interaction `teach_back` |
| Counterexample / contrastive case | which misconception is present | RIA `misconception` role; ADR-0058 |
| Test a prerequisite | whether a gap is upstream | prerequisite descent (F03) |
| Edge-case probe | boundary understanding | depth (edge_case) |

**Two honest hard problems** (flagged, not hidden). (1) **Myopia:** one-step greedy EIG is
suboptimal; the horizon-aware version is a POMDP, and Rafferty, Brunskill, Griffiths & Shafto
(2011/2016) showed POMDP planning can beat greedy EIG for tutoring — but at real computational cost.
The program starts greedy (tractable, a large improvement over topology-only) and treats POMDP
planning as an ablation, not a premise. (2) **Cost of EIG:** computing expected posterior entropy over
a factored belief is expensive; the factoring (per-concept, sparse) and cheap surrogate acquisition
functions keep it tractable. Both are engineering-bounded, not conceptual blockers.

**Relationship to UCI's Director.** The Director FSM stays as the *pedagogical governor* (pacing,
affect-sensitivity, "silence is first-class"), but its input gains an *information-value signal*: when
the belief has high-variance components on the current path, the Director's "assessing/practicing"
branches are driven by *which probe is most diagnostic*, not by fixed priority order. This is an
additive, backward-compatible change — the FSM's authored pedagogy still gates the machine's
suggestion, preserving the deliberate "principled around honesty, not information-gain" ethos as a
*safety layer over* an information-seeking core.

---

## Section 13 — Adaptive Intervention (and Causal Attribution)

Diagnosis answers *what is happening* and *why*. Intervention answers *what should happen next to
produce durable understanding*. UCI has the intervention *actions* (explain, demonstrate, visualize,
challenge, prerequisite-descend, analogize, counterexample, practice, teach-back, introduce research —
all built) and an *authored FSM* that selects among them. Two things are missing: intervention
selection as a *learnable policy*, and *causal* attribution of whether an intervention actually helped.

**Intervention selection as policy learning.** Frame intervention as a policy
`π(intervention | CognitiveState)` optimizing *durable* state improvement. The literature is rich and
its cautions must be respected: RL for instructional sequencing, **contextual bandits at scale**
("Learning to Optimize Feedback for One Million Students," 2025), and **offline RL** (Conservative
Q-Learning) for feedback. Known-hard, so scoped carefully:

- **Reward is delayed and sparse** (durable understanding shows up at the *next* session's retention
  probe, not immediately). The `CognitiveTrajectory`'s durability metric is the reward signal, which is
  why the trajectory object ([`03 §10`](03-the-cognitive-primitives.md)) must exist first.
- **Start with bandits, not deep RL.** A contextual bandit over intervention *types*, contextualized on
  the factored belief, is sample-efficient and safe. Deep/offline RL is a later ablation.
- **Off-policy evaluation is the bottleneck** and is treated as a first-class deliverable, not an
  afterthought (see causal attribution below).

**Causal attribution, not correlation.** UCI's current `pedagogy.intervention-outcome` distiller is,
by its own code comment, a "temporal-correlation heuristic, honestly weak" (conf 0.6). Correlation is
the wrong tool: a learner who improves after an intervention may have improved anyway. The program
requires **causal** evaluation of the transition:

```
CognitiveState(t) ──[Intervention]──▶ CognitiveState(t+1) ──▶ durable Outcome(t+Δ)
                     estimate:  did the intervention CAUSE the durable improvement?
```

Tools are standard causal ML — counterfactual policy evaluation, doubly-robust / importance-weighted
off-policy estimators, causal forests for *heterogeneous* (per-learner-type) effects. The honest
caveats (unobserved confounding in observational logs, transportability across cohorts, individual
treatment-effect reliability) are exactly why the program pairs *observational* causal estimation with
*governed micro-experiments*: UCI's **shadow-testing + governed-evolution machinery already exists**
(ADR-0021, `EvolutionEngine`, deterministic `ShadowEvaluator`), and is the lawful vehicle for randomized
intervention trials with rollback — a rare asset most learner-modeling research lacks.

**The `CognitiveIntervention` / `CognitiveOutcome` pair (proposed).** Promote the weak distiller into a
typed pair: an intervention record (what was chosen, for which belief component, why) and a *causally
estimated* outcome (durable Δ in the targeted component, with a counterfactual estimate and its
uncertainty). This is the training signal the policy consumes and the evidence the self-evolution layer
gates on — turning UCI's "honestly weak" outcome heuristic into a scientifically usable measurement.

---

## Section 14 — Longitudinal Cognition

Everything above is only meaningful *across time*. The program's outcome target — *durable*
understanding — is definitionally longitudinal, and it is where UCI's substrate is a decisive
advantage over the field.

**What must be modeled over time:** learning, **forgetting** (per-learner forgetting curves, not a
fixed decay factor), reinforcement, **misconception formation and correction**, **conceptual
restructuring** (discrete belief jumps), skill acquisition, **transfer**, regression, and the
*evolution of uncertainty itself* (a belief should sharpen with evidence and *re-widen* with elapsed
time — the mechanism that tells active diagnosis to re-probe a stale belief).

**UCI's structural advantages here are real and rare:**

- **Exact time-travel.** `materialize_state(session_id, at_time)` reconstructs belief at any past
  instant; snapshot/restore forks timelines. Counterfactual longitudinal questions ("was this
  understanding durable?", "would a different order have been better?") are *mechanically supported*.
- **Event-sourced provenance across sessions.** A retention probe at week 6 links, through the
  chronicle, to the exact teaching at week 1 — the causal chain is auditable, not reconstructed.
- **The cross-session resume machinery** (ADR-0037 resume cards; per-learner cognition profile;
  Digital Twin) is the delivery vehicle for longitudinal re-probing.

**The scientific payoff.** Longitudinal modeling is what lets the program make a *falsifiable durable-
understanding claim*: define durability as retained/transferable competence at t+Δ measured by a probe
the learner did not see at teach time; a system that produces higher durability under matched exposure
*causes* better learning. This is the honest bar the vision's "verified mastery" rhetoric needs, and
the one the Cognitive Evaluation Layer is being built to hold.

**The non-stationarity caution.** Humans are non-stationary (mood, sleep, motivation, life events),
which breaks the stationarity assumptions of clean state-space models and of the active-inference
literature (§12). The program does not pretend otherwise: it models what it can (competence, retention,
transfer), represents the rest as *irreducible noise / widening uncertainty*, and never over-claims a
precise mental state where the evidence supports only a distribution.

---

## Section 15 — Multimodal Extension

Language is channel #1 because it is richest and already ingested. It must not become the boundary.
The `CognitiveEvidence` record ([`03 §09`](03-the-cognitive-primitives.md)) is already channel-tagged, so the
extension is *additive*: new channels contribute evidence to the *same* belief, they do not spawn new
models.

**Evidence channels, ordered by tractability and current availability in UCI:**

| Channel | Signal | UCI status |
|---|---|---|
| **Language** | explanations, answers, teach-backs, questions | ingested today (asks, depth gates, source text) |
| **Interaction** | interrupt / jump / challenge / request_depth / annotate | first-class events today (7 interaction classes) |
| **Assessment** | depth-gate outcomes, graded answers | `AssessmentUnit`, depth gates today |
| **Attention** | dwell, rewind, long-hover, session duration | `surface.attention.budgeted` today (heuristic) |
| **Source / navigation** | which passages, what order, what re-read | source anchors, Living Reference today |
| **Code / artifacts** | problem-solving traces, code edits | code modality (ADR-0046) |
| **Visual / spatial** | whiteboard actions, diagram manipulation | Scene interaction grammar (partial) |
| **Voice** | prosody, pause, hesitation | Gemini voice in/out exists; prosodic *sensing* is new |
| **Vision / gesture / video** | gaze, expression, demonstration | future; video modality ingests transcript today |

**The unifying research problem (channel-agnostic):**

> *How are heterogeneous observations transformed into a coherent, persistent, probabilistic Cognitive
> State?*

This is a **multi-channel evidence-fusion** problem, and — importantly — UCI has already solved the
*structural* version of it for a different belief layer: **Source Fusion** reconciles multiple sources
into one Claim Graph with corroboration/complement/contradiction/gap semantics and grounded provenance
(ADR-0040/0041). The same fusion discipline — never blur provenance, weight by reliability, honest
absence over fabrication — transfers directly to fusing multi-channel evidence about a *learner*. The
multimodal extension is therefore not a new research program; it is the *same* evidence-and-belief
machinery with more channels, each carrying its own calibrated reliability. That reuse is the point:
one belief substrate, one evidence pipeline, many channels — the opposite of UCI's current
fragmentation.
