# 06 — Experience, Replay, and Simulation

> **Question.** How should accumulated experience be represented? Where do replay and simulation belong, and what can
> each legitimately establish?
>
> **Answer in brief.**
>
> - **Experience** is causally linked evidence and interpretation: trajectories, decisions, expectations, resolutions,
>   attention manifests, and interpretations over them.
> - Accumulated experience can become an **executable evaluation substrate** for alternative cognitive policies. This is
>   the idea behind "Dream-RSI".
> - That substrate is valid **only within strict limits**:
>   - Re-running a *changed selection, interpretation, or decision* over recorded inputs is legitimate.
>   - Replaying a changed *action* is legitimate **only until the first divergent action**. After that, the recorded
>   observations no longer apply and the result becomes a **prediction**, not evidence.
> - **Simulation never produces evidence**, only expectations that reality must resolve.
>
> Replay is a tool of verification, learning and evolution. It is not the architecture.

---

## 1. Experience as a representation

**Prior UCI.** Experience lived in the experience substrate (events, episodes, threads), with interpreted accounts of
"what happened, what mattered, what changed" (Lifelong §11).

**Revision (STRONG HYPOTHESIS).** An experience worth learning from must be **causally linked**. An episode should
connect:

```
situation (working state at start) ─► attention manifests ─► decisions (cited claims, expectations)
   ─► actions ─► observations ─► resolutions ─► outcome ─► interpretation ("what mattered, what changed")
```

**The test of an experience.** Can it answer *why this outcome?* by walking the chain backward?

- **Without decisions and manifests**, an episode records *what* happened but cannot support credit assignment. That is
  all the reference systems keep (C4–C6).
- **With them**, the episode can be re-evaluated against alternative policies. That is the replay substrate.

**Evidence of the gap.**

| System | What it keeps | What it lacks | Source |
|---|---|---|---|
| SWE | A clean history kept separate from the complete trajectory (a strong split) | Decisions and expectations | `A-SWE §28.2` |
| HER | Exact bytes | Why | `A-HER §19.1` |
| DSH | The exact model stream, enabling keyless replay | Resolutions | `A-DSH §19.9` |
| OHS | Raw tool calls plus typed actions | Rationale; its critic verdicts never feed back | `A-OHS §19.3` |

---

## 2. A taxonomy of re-execution

These are frequently conflated. The code evidence separates them clearly.

| Mode | What changes | What stays recorded | Output is | Legitimate for | Reference evidence |
|---|---|---|---|---|---|
| **Re-fold** | Nothing; rebuild projections | All events | State | Recovery, migration, new projections, audit | DSH projections; OC projector; EVE step results |
| **Re-play** | Nothing; re-run orchestration with recorded model outputs | Model outputs and observations | Behaviour trace | Regression tests, debugging, proof that the harness is deterministic | DSH keyless recorded replay + workspace oracle (`A-DSH §17.3, §28.9`); OHS mock-LLM trajectories; SWE `run_replay` (**unverified: observations are not compared**, `A-SWE §25`) |
| **Re-think** | The cognitive policy: selection, interpretation, decision rule, model, skill | Inputs and evidence up to the point of use | A counterfactual decision | Evaluating changes to *how the system thinks*, on the same evidence | None in the references. UCI-derived. |
| **Rehearsal** | Actions, executed in a forked sandbox of the environment | Fork origin | A sandboxed outcome, valid for that sandbox | Pre-commitment testing where the environment can be forked | OC shadow-git snapshots; SWE container reset; HER checkpoints |
| **Prediction / rollout** | Actions, "executed" in a model of the world | Nothing beyond the model | An **expectation** | Planning, comparing options | World-model research (`R2`); no reference system |
| **Counterfactual reasoning** | Hypothetical premises | — | A **conjecture** | Hypothesis generation | — |
| **Real-world validation** | Nothing simulated | — | **Evidence** | The only source of resolutions about reality | All verification |

---

## 3. The divergence boundary: the key validity law

**Law (STRONG HYPOTHESIS; supported by off-policy evaluation theory in `R2`).**

> Replaying recorded experience under a changed policy produces evidence about the changed policy **only up to the first
> point where the changed policy would have taken a different action than the recorded one.**
> After that point, the recorded observations are observations of a world the new policy never produced.

**Consequences.**

1. **Re-think is fully valid for changes that do not alter actions**:
   - reinterpreting evidence (a new extractor);
   - re-ranking retrieval;
   - re-computing a belief;
   - re-scoring a decision's alternatives.

   Re-deriving memory from evidence with a better operator is exactly this (Lifelong §5, retroactive re-derivation). It
   is sound.
2. **Re-think is valid up to divergence for changes that alter actions.** At the divergence point it yields a
   *conclusion about the decision* ("the new policy would choose B here"), not a conclusion about the outcome.
3. **Beyond divergence, there are three paths:**
   - **Rehearsal**, if the environment can be forked;
   - **Off-policy estimation**, with its variance and assumptions made explicit (`R2`);
   - **Shadow or live evaluation.**
4. **The divergence point itself is informative.** A catalog of "where the new policy disagrees with the old one" is a
   cheap, sound triage of which changes need expensive evaluation.

**Implementation prerequisites** (all REPLICATED somewhere; none combined anywhere):

| Prerequisite | Seen in |
|---|---|
| Exact inputs | HER bytes; DSH fold |
| Recorded observations | All seven |
| Attention manifests | None — UCI must add them |
| Recorded decisions with alternatives | None — UCI must add them |
| Divergence detection | OC `bus.replay` has a divergence check but no production caller (`A-OC §26.4`) |

---

### 3.1 Research confirmation and additions (`R2` §4, §10.4)

**Off-policy evaluation theory confirms the divergence law.** Beyond the first divergent action, outcomes need a model.
**LLM world simulators are poor multi-step predictors:** 59.9% accuracy for GPT-4 on a single step, falling below 1%
after ten steps. Rollouts are therefore *priors for triage*, never evidence.

**Off-policy estimates need logged propensities.** Importance-sampling and doubly-robust estimators are undefined
without the probability that the logged action or exposure was chosen. UCI does not currently record these, so it
needs:
- decision records that carry the **alternatives with their probabilities**;
- manifests that carry **inclusion propensities**;
- a small amount of **randomized exploration** (randomized withholding of artefacts, exploratory choices where safe),
  so that later policy evaluation has overlap.

**Additional valid uses:**
- **Re-verification** — re-grading stored outcomes with a better verifier.
- **Compilation determinism** — the same substrate must compile to the same working state and manifest.
- **Recalibration** — refitting the self-model on historical resolutions, while tasks and models stay exchangeable.

**Additional invalid uses:**
- effects under a **new model** or a **new population** without fresh data;
- anything logged deterministically with no exploration (no overlap);
- human-response counterfactuals;
- long-horizon effects from short logs.

## 4. Simulation is never evidence

**Invariant I-S1.** A simulated outcome — from a rollout, a hypothetical, or daydreaming — enters the epistemic
substrate as an **expectation claim** with a resolution condition. It is never an observation.

**Invariant I-S2.** A simulation or rehearsal can **never cause an external effect**. The sandbox boundary is structural
(UCI §18).

**Invariant I-S3.** A rehearsal outcome is evidence *about the sandbox*. It transfers to the real environment only as an
expectation. Rehearsal fidelity is itself a competence claim about the environment's simulability, calibrated by
comparing rehearsal outcomes with real outcomes.

**Why these matter.** The failure mode is a system that "learns" from its own imagination and treats rehearsed success
as competence. The evidence against trusting self-generated signals is strong: LLMs have limited ability to self-correct
without external feedback, and self-judging is subject to reward hacking (`R2`).

---

## 5. Where replay belongs in the architecture

| Use | Mode | Architectural home | Status |
|---|---|---|---|
| Recovery, migration, new projections | re-fold | Substrate (provenance) | ADOPTED |
| Harness regression and determinism proofs | re-play | Verification fabric (test tier) | REPLICATED (DSH, OHS) |
| Evaluating a proposed adaptation to how the system thinks | re-think (to divergence) | Learning / evolution ratchet (`07`) | STRONG HYPOTHESIS |
| Triage of which changes need live evaluation | divergence catalog | Learning / evolution ratchet | STRONG HYPOTHESIS |
| Pre-commitment testing of consequential actions | rehearsal | Harness (transactions) + environment (fork) | REPLICATED in form (OC snapshots, SWE reset) |
| Choosing among plans | prediction | Harness (planning) | OPEN; depends on world-model quality |
| Capability evaluation on historical tasks | re-think over a held-out experience set | Evaluation fabric (`07`) | STRONG HYPOTHESIS |
| Architectural diagnosis (does a structural change fix a failure cluster?) | re-think over the failure cluster | Architectural evolution | STRONG HYPOTHESIS |
| Context-selection learning | re-think with perturbed manifests | Attention (`05` §6) | EXPERIMENTAL |

**Not a use: replay as scheduling or as world modelling.** A world model is claims plus predictions, not a replay
engine (`03`).

---

## 6. What still requires real-world revalidation

- Any change whose evaluation crosses the divergence boundary without a high-fidelity fork.
- Anything involving another person's response: a learner, a collaborator. People cannot be forked. Learner simulators
  give *expectations* for triage only (see the deterministic learner simulator experiments in the UCI repository history,
  which were valid only as mechanism tests).
- Competence claims in new conditions (transfer).
- Rehearsal fidelity itself, via periodic real/sandbox comparison.

---

## 7. Reality test: replay validity

**Protocol.**
1. Take a recorded history.
2. Apply a policy change and run re-think.
3. The system must mark exactly where divergence occurs, and must label every post-divergence result as an expectation.
4. For a sample, run the change live (or in shadow) and compare.

**Passes when.**
- No post-divergence result is ever recorded as an observation.
- Pre-divergence conclusions agree with live evaluation within tolerance.

**Status.** New test; to be added to the UCI reality tests.

---

## 8. Experiments

| ID | Experiment | Invariant | Graduation | Status |
|---|---|---|---|---|
| E-RS1 | Retroactive re-derivation: re-extract claims from stored evidence with an improved operator; compare against the old claims and against ground truth | Re-derived claims are better and old versions are kept as superseded | Measured improvement with no evidence loss | OPEN |
| E-RS2 | Divergence-bounded re-think vs live A/B on the same adaptation | Agreement before divergence | Pre-divergence agreement within tolerance | OPEN |
| E-RS3 | Divergence catalog as triage: what share of proposed changes can be rejected or accepted without live evaluation | Triage precision | High precision on rejection | OPEN |
| E-RS4 | Rehearsal fidelity calibration: sandbox vs real outcomes over time | Fidelity estimate calibration | Calibrated fidelity claims per environment | OPEN |
