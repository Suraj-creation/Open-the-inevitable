# 02 — Persistent Cognitive State

> **Question.** What exactly must persist for a system to resume *cognition* rather than merely resume *execution*?
>
> **Answer in brief (STRONG HYPOTHESIS; the component set is an OPEN HYPOTHESIS pending ablation).**
>
> Persistent cognitive state is the minimal durable information that lets *an arbitrary competent reasoner* continue the
> same line of cognition after interruption: same commitments for the same reasons, same beliefs at the same confidence,
> same open expectations and questions, same authority — and correct updating when new evidence arrives.
>
> - **What must persist.** It is small and *authoritative*: intentions, decisions, claims, expectations, open questions,
>   plus execution authority.
> - **What is rebuilt.** Everything else — the situation, relevant memory, world state, the working state itself — is a
>   *projection*, rebuilt at resume.

---

## 1. What persistent cognitive state is not

| Candidate | Why it is not cognitive state | Evidence |
|---|---|---|
| **Transcript** | Carries reasons, beliefs and expectations only as prose. A new model may read it differently. Provider-opaque reasoning cannot cross models. It grows without bound and forces lossy compaction. | `A-HER §21, §28.8` ("long-lived conversations, not long-lived cognitive state"); `A-OC §19.5` |
| **Memory** (retrieval store) | Stores what may be recalled, not what is currently *held, pursued, or expected*. Nothing in it says what the process is doing or why. | `R1`; `A-HER §28.6` |
| **Database state** | Too broad: most rows are evidence or knowledge not in play. Too narrow: a database has no notion of "in force", "open", or "pending resolution". | — |
| **Process checkpoint** | Bytes of a runtime. Restores *execution position*, not understanding. Checkpoints also couple state to code: Eve refuses cross-version checkpoints, and OHS needs legacy classes forever. | `A-EVE §23.8`; `A-OHS §28.8`; UCI "recovery is reconstruction" |
| **Prompt** | A rendering for one model at one step. Model-specific, budget-truncated, lossy by construction. | UCI "two compilations"; `05` |
| **Task state** | Tracks progress on one objective, but loses the beliefs, expectations and alternatives that justified the plan. It also ends when the task ends, while cognition continues across tasks. | — |

---

## 2. Definition, and the test that makes it falsifiable

**Definition.** Persistent cognitive state *S* for a process (or for a long-lived entity: a person's environment, a
project, an agent identity) is the minimal durable information such that a competent reasoner *R′*, possibly a
different model from the original *R*, given only *S* and access to the evidence and knowledge stores, will:

1. **pursue the same commitments for the same reasons** — or deviate explicitly, citing new evidence;
2. **hold the same beliefs with the same confidence and validity**;
3. **await the same expectations**, and resolve them when evidence arrives;
4. **treat the same questions as open**, and not silently answer or drop them;
5. **operate under the same authority and constraints**;
6. **update correctly** when evidence arrives that contradicts a held belief, revising dependent decisions rather than
   ignoring the contradiction or adopting it blindly;
7. **not repeat, and not lose,** effects that may already have happened.

This is **cognitive equivalence under reasoner substitution**. It is testable (§4), and it separates cognition from
execution: a system can restart the next step perfectly (execution) and still fail items 1–6.

---

## 3. The components: authoritative, derivable, referenced

Each candidate component from the research brief is sorted by one question: *if it were lost, could it be rebuilt
exactly from other durable state?*

| Component | Class | Owner | Justification |
|---|---|---|---|
| Active goals | **Authoritative** | Operational (intentional) state | Chosen, not derivable. Losing one silently abandons work. |
| Commitments (to others, with due conditions) | **Authoritative** | Intentional state | Obligations cannot be re-inferred reliably. |
| Intentions (chosen direction toward a goal) | **Authoritative** | Intentional state | Revocable choices carry rationale; re-deriving them may choose differently. |
| Plans | **Authoritative artifact of a decision** | Decision record | Regenerable in principle, but a regenerated plan may differ, and the old one's rationale is lost. Persisted as the output of a decision, with provenance. |
| Pending decisions and their alternatives | **Authoritative** | Decision records (open) | Alternatives considered are the context of the eventual choice. |
| Decisions in force, with cited beliefs | **Authoritative** | Decision records | The *why*. Evidence of the system's own act. |
| Beliefs (claims held), with standing, confidence, validity | **Authoritative** | Claims | The epistemic state. Absent from all reference systems (C2). |
| Hypotheses | **Authoritative** | Claims of standing *conjectured* | A hypothesis is just a claim at low standing. No separate type. |
| Uncertainties | **Part of claims** | Confidence vectors and open questions | Not a separate store. |
| Expected outcomes (open expectations) | **Authoritative** | Expectation claims | The half of the resolution loop no reference system keeps (C6). |
| Unresolved questions | **Authoritative** | Open-question objects | Most often lost across interruption. Human "where was I?" is largely "what was I waiting for or unsure about?" (INFER). |
| Authority and constraints | **Authoritative** | Kernel authority + policy | Must not be reconstructed from prose. |
| Resource allocation (budgets, spend) | **Authoritative** | Execution state | Budgets are hard limits. Process-local budgets are a known inconsistency (`A-DSH §19.6`). |
| Process / execution state (claims, journals, inbox, ownership) | **Authoritative** | Execution state | The replicated execution floor (E1–E7). |
| Temporal position (process clock, last verification times) | **Authoritative (small)** | Execution state + claim metadata | Needed to compute staleness on resume. |
| Current situation | **Derivable** | Working-state projection | A rendering of the above plus the environment. |
| Active threads | **Derivable** | Projection over episodes and goals | — |
| Relevant memories | **Derivable** | Retrieval at resume | Persist *pointers* from the last attention manifest, not copies. |
| World state | **Derivable** | Projection over world claims | Asserting it directly would violate "stages never collapse". |
| Environment state | **Referenced** | The environment | The environment owns it. Cognitive state holds a snapshot reference and a staleness mark. |
| Capability state | **Derivable** | Projection over competence resolutions | `07`. |
| Attention | **Derivable (history is evidence)** | Attention manifests | The last manifest is evidence of what was attended. Next attention is recomputed. |
| Provenance | **Cross-cutting** | Everywhere | Not a component; a property of every authoritative object. |

**The minimal authoritative cognitive set** (OPEN HYPOTHESIS; ablation experiment E-PCS1 below):

```
INTENTIONAL   goals · commitments · intentions · plans (as decision artifacts)
DELIBERATIVE  decisions (open and in force; cited claims; alternatives; declared expectations)
EPISTEMIC     claims (standing, confidence, validity, evidence) · open expectations · open questions
EXECUTIVE     process & execution state · authority envelope · budgets · temporal position
```

Everything else is rebuilt from these, plus the evidence and knowledge stores, at resume.

### 3.1 The working state, redefined

**Prior assumption** (current UCI, Lifelong doc §23): the working state is a typed, durable object in operational
memory, maintained incrementally.

**Revision (STRONG HYPOTHESIS).** The working state is a **per-process projection** over the authoritative cognitive
set and execution state. It is:
- typed;
- model-independent;
- versioned;
- *cached* durably for speed.

It is never the authority. Only two things in it are process-local authorities: the **plan position** and the **current
attention focus**.

**Why the revision.**
- **"One concept, one authority."** Goals, decisions and claims already have owners. A working state that duplicated
  them would be a second, drifting copy.
- **Recovery by reconstruction** means rebuilding the working state from authorities, which is only coherent if it is a
  projection. The references show projection-over-durable-records working (E1): OC recomputes every step from
  projections; DSH folds requests from the log.
- **Model swap.** A projection can be re-rendered for any model. An authoritative blob would be one model's
  interpretation, frozen.

**What remains uncertain.** Whether rebuilding the projection costs acceptably little at every resume and every epoch.
The fallback is a versioned durable cache, invalidated by changes to its sources, which is how projections work in DSH
and OC.

### 3.2 Relationship to the three memories

The three correctness regimes survive this revision and become sharper:

| Regime | Holds (after this revision) | Correctness |
|---|---|---|
| **Evidence memory** | Observations, sources, the system's own trajectories and **decision records**, attention manifests | Faithful: never revised |
| **Operational memory** | **Execution state** (processes, claims, inboxes, journals, effect ledger, budgets) **and intentional state** (goals, commitments, intentions, open expectations, open questions) | Consistent: exact, keyed, transactional |
| **Cognitive memory** | Claims (beliefs, hypotheses, resolutions, competence), experience interpretations, skills | Calibrated: revised, never overwritten |

The sharpening: *intentional state* belongs with execution state in the **consistent** regime. A commitment must never
be "approximately remembered" or retrieved by similarity. *Claims* belong in the **calibrated** regime. A **decision**
is evidence of an act, and its "in force" flag is operational.

---

## 4. The cognitive-resume battery: a reality test

The core experiment from the research brief, made concrete. It replaces "did the application restart?" with "did
cognition continue?"

**Protocol.**
1. Run a process until it holds at least:
   - one active goal with a plan;
   - one open decision with alternatives;
   - one belief at moderate confidence that a pending decision depends on;
   - one open expectation;
   - one open question;
   - one side effect in flight.
2. **Kill** the process mid-step.
3. **Clear** all context and caches.
4. **Swap** the model for one from a different provider.
5. **Move** to a different machine or runtime.
6. **Wait**. Advance world time so that at least one belief's validity lapses and one expectation's due time passes.
7. **Inject a contradiction**: new evidence against the moderate belief.
8. **Resume**, and compare against a control run that was never interrupted.

**Scoring (C-R1 … C-R8).**

| Check | Passes when | Fails when |
|---|---|---|
| C-R1 Objective and rationale | The resumed process restates the goal *and why*, matching the decision record | It restates only the next step |
| C-R2 Open deliberation | Open decisions keep their alternatives; nothing is silently decided | Alternatives are lost; the default is chosen without record |
| C-R3 Belief revision | The contradicted belief is revised (standing and validity), and **dependent decisions are re-examined** | The contradiction is ignored, or adopted without re-examining dependents |
| C-R4 Expectations | Open expectations are still pending; the overdue one is marked expired or resolved | Expectations are forgotten |
| C-R5 Staleness | Beliefs whose validity lapsed are re-validated before being acted on | Stale beliefs are acted on |
| C-R6 Effect honesty | The in-flight effect is disclosed as outcome-unknown and reconciled, not repeated | It is repeated or silently dropped |
| C-R7 Reasoning continuity | The new model's next decision is consistent with the prior reasoning, or deviates *with stated reasons* | It restarts the reasoning from scratch or contradicts it without reason |
| C-R8 Open questions | Open questions remain open and are pursued, or explicitly closed with reasons | They vanish |

**Measures.**
- A per-check pass rate over many runs.
- Divergence from the control on decisions and final outcome.
- Cost of resumption.

**Invariant.** The C-R pass rate under interruption stays within a tolerance of the control run.

**Where the reference systems stand (INFER from archaeology).**
- **C-R6** is well supported by the execution floor: DSH, OC, HER, PRM (`A-SYN P1`).
- **C-R1, C-R4, C-R7, C-R8** are supported only incidentally, through transcript text.
- **C-R3 and C-R5** have no support at all: no epistemic status, no validity intervals, no staleness reasoning.

Predicted result: every reference architecture passes C-R6 and fails C-R3 and C-R5.

---

## 5. Time in cognitive state

The Lifelong doc distinguishes world time, knowledge time and process time. The resume battery shows why this is
load-bearing, not decorative. A process that sat dormant for a month has aged a month in world time but not at all in
process time. On resume it must ask *what changed while I was away?*

**Mechanism.** Every claim in the working state carries its last-verified time and validity interval. At resume the
projection flags claims whose validity lapsed, and those whose sources changed, for re-validation *before* the next
decision relies on them.

**Evidence.**
- *Against the simpler alternative:*
  - Eve rebuilds behaviour from current code, but holds no staleness notion for beliefs (`A-EVE §19.2`).
  - DSH deliberately makes goal activation process-local, so a restart requires a human to re-arm it. That is a crude
    staleness guard (`A-DSH I29`).
  - PRM recomputes queued goal facts at delivery time, not queue time. That is staleness handling for one fact type
    (`A-PRM C9.3`).
- *Generalization (STRONG HYPOTHESIS):* staleness applies to all claims used in decisions.

---

## 6. Cognitive state above the process

Cognition continues across processes: a learner across lessons, a project across tasks. So cognitive state has **two
scopes**:

- **Entity scope** — a person's environment, a project, a persistent agent identity. It owns long-lived goals,
  commitments, claims, and entity-level open questions.
- **Process scope** — one unit of work. It owns decisions, expectations, plan position and attention, and cites
  entity-scope objects.

**Evidence.**
- *For the separation:* Eve separates identity from ownership from replay unit (`A-EVE §19.3`); PRM makes durable
  identity separable from residency (`A-PRM §28.4`).
- *For the need:* all seven lack a durable object above the session (C1).

**Status.** STRONG HYPOTHESIS. It is the substrate half of Eve's identity/ownership split.

---

## 7. Experiments

| ID | Experiment | Invariant measured | Graduation criterion | Status |
|---|---|---|---|---|
| E-PCS1 | Ablation: remove each authoritative component in turn (open questions, expectations, decision alternatives, claim confidence…) and run the resume battery | C-R score drop per component | Components whose ablation drops C-R significantly are confirmed as authoritative; the rest are demoted to derivable | OPEN |
| E-PCS2 | Working state as projection vs as authoritative durable object: compare drift, resume cost and correctness | Projection equals recomputation from authorities; divergence rate | The projection matches the authoritative variant's correctness at acceptable resume cost | OPEN |
| E-PCS3 | Staleness re-validation on/off after long dormancy | Rate of decisions made on lapsed claims | With re-validation, near-zero lapsed-claim decisions at bounded cost | OPEN |
| E-PCS4 | Cross-model resumption: the same state resumed by 3 different providers | C-R7 consistency across models | Consistency within tolerance of same-model resumption | OPEN |

---

## 8. Education instance

A learner stops mid-way through linear algebra for three weeks.

**Authoritative state that persists:**

| Kind | Content |
|---|---|
| Goal | Understand eigen-decomposition, and why |
| Intention | Visual-first route, chosen for this learner by an earlier decision citing competence claims |
| Claims | Vector spaces *verified*; linear maps *supported*; misconception "eigenvectors must be unit length" *supported*, confidence 0.7 |
| Open expectation | "The learner will normalize vectors in the next exercise" |
| Open question | "Is the learner's difficulty with notation or with concept?" |
| Execution | Lesson process position; budget |

**On return, the projection:**
- rebuilds the situation;
- flags the mastery claims as stale (mastery decays);
- schedules a delayed-retrieval check *before* depending on them;
- keeps the expectation open, to be resolved by the first exercise;
- pursues the open question.

A transcript-replay system would resume "the next lesson frame". It would lose the question, the expectation, and the
staleness entirely.
