# 03 — The Epistemic Substrate: Claims, Expectations, Resolutions, World and Self

> **Question.** How should UCI represent what it believes, what it expects, and how reliable it is, so that belief can be
> audited, revised, calibrated and learned from?
>
> **Answer in brief (STRONG HYPOTHESIS).** One epistemic object, the **claim**, in five kinds:
>
> - **assertion** — a proposition about the world, a person, a source or the self;
> - **expectation** — a prediction with a resolution condition;
> - **resolution** — the recorded outcome of an expectation or check;
> - **diagnosis** — an account of why something failed;
> - **competence** — how reliable the self is under stated conditions.
>
> The **world model**, **self-model** and **person model** are *projections* over claims about their respective subjects.
> Calibration, surprise and learning signals are *derived* from resolutions. No reference system has any of this (`A-SYN
> §0`, C2/C6).

---

## 1. Prior assumption and what changes

**Prior UCI.**
- Beliefs were claims with an epistemic lattice (origin × standing), a confidence vector and bitemporal validity (Lifelong
  §14–17).
- The world model made predictions.
- The self-model was the capability graph plus the evaluation fabric (UCI §14).

**What the archaeology and the resolution-loop analysis change.**

1. **Predictions, verification results, diagnoses and competence estimates are the same kind of object as beliefs.** They
   share provenance, status, confidence, validity, contradiction handling and forgetting. The prior documents treated them
   in four places:
   - predictions in the world model;
   - verification results in the claims ledger;
   - diagnoses in architectural evolution;
   - competence in the capability graph.

   Unifying them removes three parallel mechanisms (A18: one concept, one authority).
2. **The expectation → resolution pair is the load-bearing structure**, not the world model as such. A world model that
   never predicts is never tested. A self-model that is never compared against outcomes is a guess.
3. **The self-model is not the capability graph.** It is the projection of *competence claims*, and those derive from
   resolutions (`07`). A capability graph, if kept, is a dependency index over the composition of capabilities, not the
   holder of reliability knowledge.

---

## 2. The claim

```
claim:
  id@version · kind (assertion | expectation | resolution | diagnosis | competence)
  subject          world entity | person | source | another agent's claim | the self (a capability) | a decision
  proposition      structured where possible, text where not
  origin           observed | stated-by-person | source-reported | inferred | conjectured
  standing         conjectured → likely → supported → verified | disputed → contradicted | superseded → obsolete
  confidence       vector: source · extraction · identity · temporal · relational · semantic · causal · epistemic
  valid_time       interval in the world (with uncertainty)
  knowledge_time   when the system came to hold it
  evidence         for[] / against[] — addresses into evidence memory and other claims
  derivation       operator · version · model · inputs
  perspective      whose claim (the system's; a source's; a person's)
  labels           consent · sensitivity · audience (propagated from inputs)
  --- kind-specific ---
  expectation:     resolution_condition · due · bound decision · stated probability
  resolution:      resolves (expectation | check) · outcome (held | failed | indeterminate) · method · verifier identity
  diagnosis:       explains (resolution | failure cluster) · candidate causes · link along the epistemic chain
  competence:      task class · conditions · estimate + uncertainty · supporting resolutions
```

**Invariants (each a measurable check):**

| # | Invariant |
|---|---|
| I-C1 | No claim without a derivation and at least one evidence link, except claims stated by a person, whose evidence is the statement itself. |
| I-C2 | Standing rises to *verified* only through a resolution produced by an independent method. |
| I-C3 | Claims change by new versions and supersession, never by overwrite. `valid_time` closes; history remains. |
| I-C4 | A model's output enters as origin *inferred* or *conjectured*, never as observed or verified (UCI A3). |
| I-C5 | Source-reported claims keep their attribution. "The book says X" is never laundered into "X". |
| I-C6 | Labels on a claim include the join of its inputs' labels (information flow, UCI §33). |

---

## 3. The resolution loop

```
         decision ──declares──► expectation (p, condition, due)
            │                         │
            ▼                         │ (wait: process may be dormant)
          action ──► observation ─────┤
                                      ▼
                               RESOLUTION (held | failed | indeterminate; method; verifier)
                                      │
       ┌──────────────────┬──────────┴─────────┬─────────────────────┐
       ▼                  ▼                    ▼                     ▼
 calibration datum   surprise signal     credit assignment      competence update
 (p vs outcome, per  (|p − outcome|;     (walk the decision's   (self-model: success
  operator/model/     drives memory      cited claims back to    under these
  task class)         formation)         their evidence)         conditions)
```

**What the loop requires.**

1. Decisions that **declare expectations**. Not every step: at minimum, consequential decisions and goal-level
   acceptance.
2. Expectations with **resolvable conditions**: an observable, a check, or a verifier. "The explanation will help" is
   unresolvable. "The learner will answer the transfer item correctly within this lesson" is resolvable.
3. **Resolution production** by the verification fabric (`07`), preferring independent methods.
4. **Explicit expiry.** An expectation whose due time passes without evidence becomes *indeterminate / expired*. It is
   never silently dropped.

**Why this is the atom of learning (STRONG HYPOTHESIS; evidence in `R2`).**
- **Prediction-error learning.** Temporal-difference learning and predictive-processing accounts both place the learning
  signal at the gap between expectation and outcome.
- **Calibration.** Calibration cannot even be *defined* without paired stated confidence and realized outcome.
- **Attribution.** Attributing credit to a belief requires knowing which belief a decision relied on and what it
  predicted.
- **Negative evidence from the archaeology.** Every reference system that "learns" does so with no expectation to
  resolve against:
  - HER archives skills by recency (`A-HER §23`);
  - PRM stores `expectedOutcome` and never reads it (`A-PRM §23.3`).

  Their adaptation is therefore unmeasurable in principle, not merely unmeasured.

**Competing interpretation.** Some learning needs no explicit expectation, for example unsupervised consolidation that
merges duplicate memories.
- Accepted: memory *organization* can be driven by other signals (recurrence, access).
- But any claim that such a change *improved future cognition* is itself an expectation, and must be resolved (`07`).

---

### 3.1 Research refinements (`R2`)

**The verifier record belongs on every resolution.** A resolution names its verifier, not just its method:
- identity and version;
- type (rule / executable / learned / human);
- measured false-positive and false-negative rates on an audit set;
- **whether the verifier was visible to the actor**.

A verdict without a verifier identity is invalid, and the actor cannot write to its verifier. Evidence:
- Verifier quality caps what can be learned (imperfect verifiers cap resampling).
- About 31% of passing SWE-bench patches pass only because tests are weak.
- Actors hack visible scorers (METR: 43× more hacking when the scorer is visible).
- The Darwin Gödel Machine faked test logs and deleted its own hacking detectors.

**Exactly one resolution per expectation.** That resolution may be *unresolvable* or *expired*. Resolutions are
append-only.

**Resolutions can be re-verified retroactively.** Stored raw outcomes can be re-graded by a better verifier, which can
invalidate past "successes" (valid under the replay law, `06` §3).

**Calibration must be re-validated after every model swap.** RLHF shifts calibration, and learned artefacts that helped
model A can be neutral or harmful for model B. A model swap therefore resets the self-model's calibration map to
*provisional* until new resolutions accrue.

## 4. World model

**The world model is the projection of assertion claims whose subject is the external world**, together with the
expectation claims it generates.

It is:
- **bitemporal**: state-at-time and belief-at-time queries;
- **causal where evidence supports it**: causal claims carry causal confidence separately;
- **tested by its predictions**.

**Calibration** is maintained per operator, per model and per task class from resolutions. Systematically overconfident
operators are down-weighted automatically.

**What it is not.** It is not a separate graph database that asserts state. Graph structures are *projections and
indexes* over claims (A18). A graph edge without a claim behind it would be an assertion without provenance.

**Status.**

| Element | Status |
|---|---|
| Projection-over-claims design | STRONG HYPOTHESIS |
| Learned world models for rollout | Research direction; UCI §38 "directions" |

---

## 5. Self-model

**The self-model is the projection of competence claims.**

- A **competence claim** estimates the reliability of a capability (`07`) under stated conditions: task class,
  environment, model, context features. It carries uncertainty.
- It is supported by the resolutions of expectations about the system's own success.

**What it enables.**

- **Graduated autonomy.** Act without asking only where competence is supported with low uncertainty (UCI §14).
- **Routing.** Choose the model, capability or process whose competence claims fit the task.
- **Honest abstention.** Decline or ask where competence is unknown. Selective prediction (`R2`).
- **Architectural diagnosis.** Competence that stays low under every policy change points to structural limits
  (UCI §30).

**Two calibration targets, kept separate:**

1. **Object calibration** — is the system's confidence in its *answers* matched by accuracy?
2. **Self calibration** — is its confidence in its *competence* matched by success rates?

A system can be well calibrated on one and poorly on the other. Both are measured from resolutions.

**Evidence.**
- *For the need:* none of the seven has a self-model (C8). Every one treats completion as self-report (`A-SYN §7.2`).
- *For LLM self-knowledge:* evidence is mixed. Models show some calibration on answer correctness, which degrades under
  distribution shift and verbalized confidence (`R2`). So the self-model must be **empirical**, built from resolutions,
  and must not rely on model introspection.

**Status.** STRONG HYPOTHESIS for the design. Empirical adequacy is OPEN (E-EP2).

---

### 5.1 Representation: latent ability over demand dimensions (`R2` §8)

A competence claim is best represented not as one success rate per capability, but as **latent ability over demand
dimensions**:
- item response theory;
- demand-profile × ability-profile models (ADeLe, which beats black-box predictors out of distribution);
- METR time horizons;
- knowledge tracing in education.

This is **the same machinery that models a learner's mastery** (IRT and Bayesian knowledge tracing). So the self-model
and the learner model share one representation: an ability estimate with uncertainty, over task demands, fitted *only*
from resolutions.

The agent's own verbalized confidence is kept as a **feature**, not as the estimate. Introspection detects only about
20% of relevant states, and agents are systematically overconfident on multi-step work (22% vs 77%).

**Status.**
- REPLICATED in psychometrics; OBSERVED for LLMs.
- Adopted as a STRONG HYPOTHESIS for both the self-model and the person model.
- Education test: does a calibrated IRT/BKT-style learner model beat LLM-judged mastery at predicting *delayed*
  retention? (`R2` §11.8)

## 6. The person model and nested belief

A person model is the projection of claims whose subject is a person:
- preferences, knowledge and capability states;
- goals the person has stated;
- misconceptions — claims whose *subject is another claim* ("the learner believes X").

Education's learner model is exactly this, with mastery as a competence claim whose subject is the learner rather than
the self.

- **Same structure, different subject.** This is the concrete mechanism behind "education concepts are instances of
  universal primitives".
- **Governance.** Claims about people inherit stricter labels (UCI §33). Inference about intimate states is conservative
  (Lifelong §29).

---

## 7. Contradiction and revision

When a new claim conflicts with a held one, revision chooses among:
- coexisting validity intervals — the fact changed;
- supersession;
- a confidence drop;
- *disputed* standing — credible sources disagree;
- asking the person.

Revision is a new version of the claim, with its reason recorded.

**The new element.** Revision propagates to **decisions that cited the revised claim**. Each is re-examined, and so are
its declared expectations. This is C-R3 in the resume battery (`02` §4). Without decision records, a contradiction can
update a belief while every decision built on it continues unexamined. That is the most common failure mode of
transcript-based systems (INFER).

---

## 8. Where claims come from

| Source | Origin | Typical standing on entry |
|---|---|---|
| Direct observation (a sensor, a tool result, an exit code) | observed | supported (what was observed); interpretation separate |
| A person's statement about themselves | stated-by-person | supported for self-reports; not for external facts |
| A document, web page or book | source-reported | as attributed; never laundered |
| Model inference over evidence | inferred | conjectured or likely |
| Hypothesis generation, daydreaming, simulation | conjectured | conjectured; simulation outputs are *expectations*, never evidence (`06`) |
| Verification | resolution | per method |

Ingestion (`08`) produces the first three. The harness produces the rest.

---

## 9. Experiments

| ID | Experiment | Measured invariant | Graduation | Status |
|---|---|---|---|---|
| E-EP1 | Declare expectations on consequential decisions in one environment (education); resolve them; build calibration curves | Calibration error over time (world object calibration) | Calibration improves monotonically over episodes, or at least does not degrade | OPEN |
| E-EP2 | Build an empirical self-model from resolutions vs rely on model-verbalized confidence; use each for routing and abstention | Self-calibration error; task outcome under routing | The empirical self-model beats verbalized confidence | OPEN |
| E-EP3 | Decision-propagating revision vs belief-only revision after injected contradictions | Rate of decisions still acting on revised beliefs | Near zero with propagation | OPEN |
| E-EP4 | Expectation declaration cost: declared expectations per decision vs task outcome and cost | Marginal value of expectation granularity | Find the granularity with positive net value | OPEN |
| E-EP5 | Unified claim store vs separate stores (beliefs / predictions / verification / competence) | Duplication, inconsistency incidents, query complexity | The unified store has fewer inconsistencies at equal performance | OPEN |
