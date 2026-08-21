# Persistent Cognitive Intelligence
### A Research Program for Universal Cognitive Infrastructure

> The capstone of the **Persistent Cognitive Intelligence** research program (deliverable §30).
> Status: research proposal — the strongest scientifically defensible formulation of the problem that
> is compatible with the long-term UCI vision and buildable inside its existing substrate. Not adopted
> law. Supporting analysis and citations: [`README`](README.md) and documents 01–06.

---

## The question this program answers

> *If Universal Cognitive Infrastructure is ultimately meant to become infrastructure through which
> intelligent systems can learn, remember, reason, adapt, research, and discover over arbitrarily long
> horizons — what is the computational representation of the evolving intelligence that makes such
> continuity possible?*

The answer this program defends: a **persistent, provenance-bearing, uncertainty-calibrated Belief** —
a probability distribution over the latent variables of a system-of-interest, updated by typed
evidence and queried to select maximally-informative action. Continuity is what a Belief provides:
it is the single internal variable that experience updates and action consults, and without it a
system cannot compound — every interaction starts cold. Education is the first laboratory because it
is where this Belief is richest in evidence and cleanest in ground truth. The learner is the first
subject. Language is the first evidence modality. The learner-state model is the first experimentally
tractable instance. But the object of study is the Belief itself.

---

## Why the original framing had to change

The direction arrived as *"Persistent Cognitive State Modeling from Natural-Language Evidence."* The
investigation — reading the repository as a body of thought and the literature as a skeptic — forced
three corrections, each of which makes the program *more* defensible, not less:

1. **UCI already models learner state — badly.** Not in one place, but in four fragmented,
   point-estimate, passively-recorded representations (world-state `mastery_checkpoint` nodes, the
   `TwinSnapshot` mastery map, the `intelligence.*` distiller artifacts, and tiered `MemoryMutation`s).
   Every `confidence` is a scalar; in the distillers it is a *hardcoded constant*. Belief updates by a
   *fixed non-Bayesian rule*. Calibration is measured only *in aggregate*. The only "what next" walks
   prerequisite topology. **So the problem is not "build a learner model." It is: replace fragmented,
   point-estimate, passive machinery with a single, calibrated, actively-maintained belief — without
   losing the provenance UCI already has.**

2. **"Learner state" and "language" are both too narrow.** The repository already contains a second
   instance of the same primitive that is *not* about the learner — the **Claim Graph**, which gives
   *domain claims* an epistemic status with provenance and contradiction detection. And the vision
   requires a third — a researcher's belief over hypotheses. These are one primitive over three
   systems. Language is the first *evidence channel*, not the boundary; the honest object is
   channel-agnostic **Cognitive Evidence** feeding a **Belief**.

3. **The novelty is integrative, not component-level.** The literature has solved the parts —
   Bayesian mastery (BKT), language-based knowledge extraction (LLMKT), active diagnosis (BALD, CAT),
   policy intervention (bandits/RL), causal effect estimation, persistent agent memory (MemGPT,
   Generative Agents), scrutable learner models (OLM), persistent cited hypothesis-state for science
   (Kosmos). Claiming any one as novel is unsupported. What no system does — and what UCI is uniquely
   positioned to build — is *unify* them into one persistent, provenance-bearing, actively-diagnosing
   belief that closes the whole loop.

---

## The four deepest statements

**The deepest problem.** Intelligence that improves through experience requires a persistent internal
variable that experience updates and action consults, whose *uncertainty* is calibrated (so the system
knows what it does not know), whose *provenance* is intact (so every belief is auditable and
correctable), and which is *actively maintained* (so the system seeks the evidence that most sharpens
it) — and no existing system, including UCI itself, has this. UCI has the substrate (event sourcing,
replay, provenance, a materialized world-state, a governance kernel) but only a point-estimate,
fragmented, passive belief on top of it.

**The deepest hypothesis.** *Learner cognitive state, domain knowledge state, and research hypothesis
state are the same primitive — a Belief — over three systems-of-interest.* Memory is the substrate that
persists Beliefs; evidence is what updates them; uncertainty is their variance; goals and curiosity are
the utility over information gain that selects action; attention is the budget that action spends;
intention and reasoning state are Beliefs the system holds about itself. Building this primitive once,
and instantiating it three times, is how UCI avoids building it three times and drifting into three
more fragments.

**The deepest architectural solution.** A **Belief projection** over the existing chronicle — folded
from the event log, materialized in world-state, reconciling the four current representations into
read-models, updated by principled (variance-aware, per-learner) revision, rendered on the Cognitive
Surface as a scrutable **Open Learner Model**, and — the one genuinely new faculty — *actively
maintained* by information-gain-driven probing. It requires **no new adapter contract and no new
store**; it is the concrete first draft of the epistemology layer the blueprint itself deferred
(§26.14) and is gated, correctly, on the Cognitive Evaluation Layer that the architecture already names
as the gate for everything above it (ADR-0023 Layer 2).

**The deepest long-term implication.** The same loop, with "learner" replaced by "researcher" and
"competence" by "hypothesis," is the substrate of autonomous research and discovery. A persistent,
provenance-bearing, uncertainty-calibrated, actively-maintained belief is a *necessary condition* for
durable human learning *and* for machine discovery. This is why the program is not "a better tutor": it
is the first tractable step toward the computational representation of an evolving intelligence that
becomes more capable through experience **without losing provenance, interpretability, continuity, or
control** — the exact property that separates infrastructure worth trusting from a system that merely
predicts.

---

## The corrected progression

The originating diagram — *Language → Evidence → Cognitive State → Mental Models → Cognitive
Trajectories → Active Diagnosis → Adaptive Intervention → Learning → Persistent Experience →
Compounding Intelligence → Research → Discovery* — is validated in its elements and rejected in its
linearity. It is a **closed loop**, mental models are *inside* the state, active diagnosis *closes back*
to observation, and **uncertainty and provenance** — the two properties that distinguish this from all
prior art — are missing from the original line.

```
            ┌───────────────────────────── the persistent loop ─────────────────────────────┐
            │                                                                                │
 Observation ──▶ Cognitive Evidence ──▶ Belief update ──▶ Cognitive State ──▶ Active Diagnosis ┐
 (language-first,   (extracted,          (principled,       (probabilistic,    (max expected    │
  multi-channel)     interpreted,         calibrated         calibrated          information     │
                     provenance-          revision)          uncertainty;        gain)           │
                     stamped, weighted)                      mental models          │            │
            ▲                                                as hypotheses)          ▼            │
            │                                                                Adaptive Intervention│
            └──────────── new Observation ◀──────────── (causally attributed) ◀──── (policy) ────┘

   accumulated provenance-preserving history of the loop  =  Cognitive Trajectory
   the loop improving its own priors / policies / extractors  =  Compounding Intelligence
   the SAME loop over hypotheses instead of competence  =  Research → Discovery
```

Everything flows from three properties the loop preserves at every step and prior art does not preserve
together: **calibrated uncertainty**, **intact provenance**, and **active maintenance**.

---

## What this program commits to, and what it refuses

**It commits to:** unifying UCI's four representations into one belief (R0), measured evidence
reliability and per-learner calibration (R1–R2), information-gain active diagnosis (R4), causally-
attributed adaptive intervention via UCI's governed shadow-testing (R5), and a falsifiable durable-
understanding target measured longitudinally (R6). It commits to beating, on every headline claim,
*both* a naïve baseline *and* UCI's own current mechanism — or not reporting an improvement.

**It refuses:** to claim novelty in any solved component; to assert language→mental-model fidelity
without measuring it (the highest-risk bet, R3, ships only behind a fidelity gate, with a
pre-registered fallback and a plan to publish the negative result if it fails); to build a parallel
store (the belief is a projection or the phase fails its conservation gate); to treat a probabilistic
belief as ground truth about a person (the Open Learner Model, scrutability, and consent cascade are
non-negotiable); and to over-claim the autonomous-research horizon as a plan rather than a direction.

---

## Closing

Education is the laboratory; the learner is the subject; language is the first evidence; the learner-
state model is the first tractable system. But the science is the Belief — persistent, calibrated,
provenance-bearing, actively maintained — and UCI is the rare place where the substrate to build it
honestly already exists. The recommendation is to build it *once*, as a projection, gated on
measurement, governed like everything else — and, in doing so, to draw the blueprint's deferred
epistemology layer, the Claim Graph's domain belief, and the learner's cognitive state into a single
primitive. That is how a cognitive operating system stops merely predicting and starts *compounding*:
by holding, and honestly maintaining, a model of the mind it is trying to grow.
