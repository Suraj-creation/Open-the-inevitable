# 07 — Learning, Verification, and Capability

> **Question.** How does UCI know that experience made it better? How is success verified, and how is competence, as
> distinct from access, represented?
>
> **Answer in brief.**
>
> - **Four processes are kept distinct: reflection ≠ adaptation ≠ learning ≠ verified improvement.**
>   - Reflection and adaptation are REPLICATED in the reference systems (HER, PRM).
>   - Learning, meaning *measured* improvement, is ABSENT in all seven.
> - **Verification** is redefined as producing **resolution claims** by methods independent of the generator.
> - **Capability** is redefined as **competence claims aggregated from resolutions under conditions**. A capability
>   graph survives only as a dependency index (OPEN HYPOTHESIS).

---

## 1. Reflection ≠ adaptation ≠ learning ≠ verified improvement

| Process | Definition | Produces | Reference evidence | Status in references |
|---|---|---|---|---|
| **Reflection** | Examining experience to form interpretations or proposals | Interpretations; proposed adaptations | HER background review fork (`A-HER §19.5`); PRM auto-refine planning (`A-PRM §16`); OHS critic (`A-OHS §19.11`) | REPLICATED |
| **Adaptation** | Applying a change to future behaviour: memory, policy, skill, template, prompt addendum | An adaptation record (before/after) | HER memory/skill edits with ownership guards and a content-addressed ledger; PRM harness edits with snapshots and rollback; DSH self-recomposition of plugins; EVE draft PRs | REPLICATED — governed, but never evaluated |
| **Learning** | An adaptation whose **predicted effect is resolved as held** under an evaluation regime, with attribution | A resolution on the adaptation's expectation | None | ABSENT (0/7) |
| **Verified improvement** | Learning that survives held-out, longitudinal and regression evaluation, and transfers where it claims to | Promoted scope; a competence-claim update | None | ABSENT (0/7) |

**What the reference systems prove.**
- Governance of adaptation is achievable: ownership, attendedness, persistence isolation, rollback, and optimistic
  concurrency (`A-HER §28.6`, `A-PRM §28.6`).
- *"The architecture of reversibility is present; the architecture of evidence is not."*

**What they disprove.** That reflection can safely share a record with live cognition. In HER's "curator-takeover"
incident, a review wrote a turn into the live session and was re-read as an instruction (`A-HER §28.5`). This is direct
evidence for **persistence isolation of reflective processes** (ADOPTED).

**Why reflection alone is insufficient (research).** Self-correction without external feedback is unreliable, and
LLM-as-judge has known biases and is exploitable (`R2`). Reflection therefore generates *hypotheses*, never verdicts.

---

### 1.1 What the research adds (`R2` §1–§2, §9–§10)

- **External signal is the engine** (REPLICATED). Every durable self-improvement success has a trusted outside checker:
  - ground-truth answers (STaR, ReST-EM);
  - game state (Voyager);
  - tests (DGM, HGM);
  - evaluators (AlphaEvolve);
  - proofs (AlphaProof);
  - an executor (Absolute Zero).

  Voyager's largest ablation drop comes from removing verification.
- **LLM-judged gains fail independent checks.**
  - A token-budget-matched vanilla agent matches or beats AWM, ASI and ReasoningBank.
  - Self-authored skills add **zero on average**.
  - Curated skills add +16.2 points, but made 16 of 84 tasks worse.
- **Self-correction without outside feedback does not help, and can hurt.** An untrained model flipped more right
  answers to wrong: −11.2% on MATH, fixed only by reinforcement learning on a verifiable reward.
- **Most changes do not help.** Roughly ⅓ of industrial A/B tests improve the metric (10–20% in mature products).
- **Improvement after a learning event is not proof of causation.** Random rewards gave +21.4 points against +29.1 with
  ground truth, and the effect was model-specific. Attribution requires a **placebo arm**.

**Status ladder for a learned artefact** (adopted from `R2` §9; it mirrors the constitution's status discipline):

`proposed` (reflection) → `active` (adaptation, in trial) → `effective` (learning shown on held-out tasks) → `verified`
(pre-declared, controlled, retained, attributed)

Only `verified` artefacts get default-on treatment. Everything else stays in a randomized trial, with its exposure
logged in the manifest, including its inclusion propensity.

## 2. Learning as causal change

**Definition (STRONG HYPOTHESIS).**

> **Learning** is an evidence-backed change to future cognition that *measurably improves behaviour* under an
> appropriate evaluation regime, with the improvement *attributed* to the change.

**The learning record** is the adaptation record from `01` B5, completed:

```
adaptation:
  target@version · before · after · scope · lineage · attendedness (was a person present?)
  evidence            experiences/resolutions that motivated it
  predicted effect    an EXPECTATION claim: metric, direction, magnitude, conditions, due
  evaluation regime   re-think-to-divergence | held-out suite | shadow | live A/B | longitudinal
  attribution method  ablation | shadow comparison | counterfactual re-think | randomized assignment
  result              a RESOLUTION claim on the predicted effect
  status              proposed → evaluated → promoted (local) → widened → monitored | rolled back | quarantined
```

**Invariants.**

| ID | Invariant |
|---|---|
| I-L1 | No adaptation is labelled *learning* unless its predicted-effect expectation has a *held* resolution under the declared regime. |
| I-L2 | Scope widens (person → environment → global) only as resolutions accumulate at each scope. |
| I-L3 | A promoted adaptation whose monitored effect falls below its prediction is automatically rolled back, together with its lineage descendants. |
| I-L4 | The evaluation suites and rubrics are outside the adaptive layer. The system cannot improve its grade by changing the grader (UCI §29). |

**The evaluation regimes, and what each can establish.** Replay limits come from `06` §3.

| Regime | Cost | Establishes | Cannot establish |
|---|---|---|---|
| Re-think over recorded experience (to divergence) | Low | Effect of changes to selection, interpretation or decision on past evidence | Outcomes after the first divergent action |
| Held-out suite | Medium | Generalization within the suite's distribution | Behaviour on this person or project; drift |
| Shadow | Medium | Divergence and predicted effect on live inputs without acting | Effect of actually acting |
| Live A/B / randomized assignment | High | Causal effect in reality | Long-horizon effects, until run long enough |
| Longitudinal | Highest | Durability; interaction with other adaptations; forgetting | — |

**Attribution.**
- Correlation with a good week is never enough.
- Accept only counterfactual evidence: ablation, shadow, re-think, or randomization (UCI §29).

---

### 2.1 The controlled trial, and hack-resistance (`R2` §4, §2.5)

The evaluation regime carried by an adaptation record must be a **controlled trial**:
- randomized or paired exposure of the change vs baseline **and a placebo / no-op arm**;
- **cost-matched**, so the "gain" is not just extra tokens;
- **seed-replicated**, with variance reported;
- run on **time-sliced held-out tasks**;
- plus a **retention suite** on prior task classes, to catch forgetting;
- reported with a confidence interval.

**Hack-resistance invariant.**
- The evaluator, the evaluation set, and any detection markers lie **outside the adaptive process's authority
  envelope**.
- Where possible they are **invisible to the actor**. METR found 43× more hacking when the scorer was visible.
- Evaluation sets carry provenance and integrity checks. Poisoned benchmarks persisted through later self-evolution.

**Two further checks:**
- **Cost-matched baseline as a reality test.** No learned-capability claim stands unless it beats a budget-matched
  vanilla actor on time-sliced held-out tasks (`R2` §11.11).
- **Retirement.** Artefacts whose measured effect is ≤ 0, or whose evidence became invalid (tainted provenance, a failed
  re-verification), are demoted or reverted. This is logged and reversible.

**Model-swap revalidation.** Every `verified` artefact's effect is re-measured after a model swap. Nothing guarantees
that a playbook item which helped one model helps the next.

## 3. Verification

**Redefinition (STRONG HYPOTHESIS).** Verification is the process of producing **resolution claims** about outputs,
claims, actions or expectations by methods **independent of the generator**. Its results live in the epistemic
substrate. They do not live in a separate ledger (`03`).

**The verifier hierarchy** (retained, with its evidence status):

| Level | Examples | Reference evidence | Independence |
|---|---|---|---|
| 1. Harness-observed signals | Exit codes, test results, invariants, recomputation, **post-condition checks** | HER verification ledger with edit-relative staleness (`A-HER §19.8`); PRM worktree-fingerprinted gates (`A-PRM C9.2`); OHS compaction post-condition check (`A-OHS §19.7`); DSH replay against a workspace oracle (`A-DSH §28.9`) | High |
| 2. Environment evaluators | Transfer tasks and delayed retrieval (education); reproduction (research); benchmarks | SWE-bench grader, external to the loop (`A-SWE §28.4`) | High, if the evaluators are validated |
| 3. Independent model judges with fixed rubrics | A different model, calibrated against ground truth | OHS critic and goal judge; DSH auto-review (authorization only); SWE reviewer/chooser | Medium — biases and gaming (`R2`) |
| 4. Human judgment | Review, approval | All | High, but costly and slow |

**Harness-observed signals are the only genuinely independent runtime verifiers found in the archaeology.**
- They are narrow, opt-in and mostly code-only.
- The open question for UCI: **what is the harness-observed signal of a non-code outcome?**
  - In education: the learner's answer to a delayed-retrieval item, observed by the environment, not reported by the
    teaching process.
  - Generalization: every environment must declare at least one harness-observed outcome signal (`09`).

**Verification-thrash protection.** A failed check is not re-run on an unchanged state (PRM worktree fingerprint). This
generalizes to any environment with a state fingerprint (REPLICATED in form; ADOPTED).

**Post-condition verification** (OHS): take a baseline before the action; observe a new event; measure the metric delta;
treat a timeout as failure. *"An acknowledgement is not an effect."* This generalizes to every asynchronous action
(ADOPTED as a pattern).

---

## 4. Capability as competence

**Prior UCI.** A capability is a composition (faculties, knowledge, skills, actions, evaluators, process template). The
capability graph with the evaluation fabric *is* the self-model (UCI §14).

**Revision.**

1. **Capability ≠ tool ≠ permission ≠ agent** (retained).
2. **Competence is a claim.** "Capability X succeeds with reliability p ± u under conditions C" is a competence claim
   (`03` §5), supported by resolutions. The self-model is the projection of these claims.
3. **Composition is a separate question.** What a capability *is made of* is a dependency structure: skills, tools,
   evaluators, model routes. Whether that deserves a first-class "capability graph", or is simply the composition
   manifests of process templates, is **OPEN**. No reference system has either (C8). The prior "capability algebra"
   stays a future direction.
4. **Access vs competence.** Having a tool, or the authority to use it, is *access*. Competence is demonstrated
   reliability. A system must never infer competence from access.

**The competence record (conceptual).**

```
competence claim:
  capability (what task class, composed how)
  conditions         environment · model route · task features · context features
  estimate           success probability / quality distribution
  uncertainty        interval; sample size
  evidence           resolutions (by verifier level)
  failure modes      diagnosis claims clustered from failures
  transfer evidence  resolutions in conditions outside the original
  version · lineage  what compositions / adaptations produced changes
```

**Graduated autonomy** (retained, now precise): act without asking in condition C only if the competence claim for C
has sufficient support (sample size) and low uncertainty, *and* the authority envelope allows it. Autonomy contracts
automatically when resolutions degrade.

**Transfer.**
- Transfer is not a primitive; it is an **evaluation**: the competence of a capability in conditions it was not trained
  or adapted in.
- Negative transfer is a real risk (`R2`). Skills carry applicability conditions, and must earn competence in each new
  context.

---

## 5. Skills in this model

A skill is a procedure: declarative and/or executable, with applicability, an expected effect, and lineage (Lifelong
§37). In the new model:

- The **expected effect** is an expectation claim template, instantiated at each use.
- **Use outcomes** are resolutions of those expectations.
- **Trust** is a competence claim on the skill under conditions.
- **"Know what not to learn"** (from HER's review doctrine) becomes a formation filter. Candidate skills matching
  known-bad patterns are rejected with reasons:
  - environment failures mistaken for domain laws;
  - negative tool claims drawn from one run;
  - dead ends dressed as workflows.

**Evidence.**
- HER skills: owned, versioned, audited, progressive disclosure; archived by recency, never by measured value
  (`A-HER §23`).
- Voyager-style skill libraries (`R2`).

---

## 6. Reality tests (new or deepened)

| Test | Passes when |
|---|---|
| **Learning** | For a promoted adaptation, the system produces the adaptation record, predicted effect, evaluation regime, attribution method and a held resolution; ablating the adaptation reproduces the loss |
| **Memory value** | For a sample of formed memories, the system shows they were later retrieved *and* that decisions citing them resolved better than matched decisions without them (`04`) |
| **Capability formation** | The system distinguishes capabilities it has access to from ones with demonstrated competence, and its autonomy follows the latter |
| **Self-model calibration** | Over time, predicted success rates per condition match realized success rates within tolerance, and the gap shrinks |
| **Transfer** | A skill or adaptation measurably improves a novel environment, under the same attribution standard |

---

## 7. Experiments

| ID | Experiment | Invariant | Graduation | Status |
|---|---|---|---|---|
| E-LV1 | Close the learning loop in one environment (education): reflection proposes → adaptation with predicted effect → re-think to divergence → shadow → local promotion → resolution | Share of promoted adaptations whose predictions hold | Majority hold; failed ones are rolled back automatically | OPEN |
| E-LV2 | Reflection-only (HER-style) vs evaluated adaptation over N episodes | Longitudinal outcome slope; memory/skill pollution | Evaluated adaptation beats reflection-only with less pollution | OPEN |
| E-LV3 | Harness-observed outcome signals in non-code environments (education: delayed retrieval observed by the environment) | Agreement with expert judgment | High agreement; resistant to gaming | OPEN |
| E-LV4 | Competence-based routing and autonomy vs static routing | Outcome, cost, unnecessary interruptions | Better outcome/cost with fewer interruptions | OPEN |
| E-LV5 | Capability graph vs composition-manifests-only for routing, impact analysis and delegation | Task success; impact-analysis accuracy | Keep the graph only if it measurably helps | OPEN |
