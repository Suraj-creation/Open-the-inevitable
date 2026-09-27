# 01 — From Persistent Execution to Persistent Cognition

> **Question.** Current agent systems have converged on a substrate for persistent *execution*. What is the minimum
> additional substrate needed for persistent *cognition*?
>
> **Short answer (STRONG HYPOTHESIS).** Four record types, two invariants, and one derived projection, layered on the
> converged execution floor:
>
> - **Record types:**
>   - the **claim**: an epistemic object with status, confidence and validity. Expectations, resolutions, diagnoses and
>     competence estimates are all kinds of claim.
>   - the **decision record**: a commitment to act, citing the claims it relied on and the outcome it expects.
>   - the **attention manifest**: why each item entered the model's view, and why others did not.
>   - the **adaptation record**: a proposed change to future behaviour, carrying a measurable prediction of its own
>     effect.
> - **Invariants:**
>   - every consequential decision declares expectations;
>   - every expectation resolves against observation, or expires explicitly.
> - **Derived projection:** the **working state**, a per-process projection over these records and execution state.
>
> Almost every other cognitive capability in the vision can be derived from accumulated *resolutions*: verification,
> calibration, self-knowledge, capability, learning, transfer, even architectural diagnosis.
>
> **Correction after research (`R2` §10.3).** The **resolution loop** is:
> - **the atom of calibration** — REPLICATED; calibration is defined over prediction–outcome pairs;
> - **a necessary but not sufficient input to learning.**
>
> Turning prediction error into a good change also needs a change generator and a **controlled comparison**: a baseline
> and a placebo arm, cost-matched, on held-out tasks.
>
> The reason is empirical. Roughly ⅓ of A/B tests are positive, and apparent improvement appears even under random
> rewards.
>
> The controlled trial is not a fifth record type. It is the evaluation regime carried by the adaptation record.
>
> Evidence keys: `A-xxx` = archaeology documents in `Reference-Architecture-Observatory/archaeology/`; `R1–R4` =
> research notes in `archit/research/`; statuses are defined in `README.md`.

---

## 1. What the evidence establishes

### 1.1 Persistent execution: converged, replicated

Across seven independently engineered systems, the following execution invariants recur. **REPLICATED** means found
independently in at least two systems' source code.

| # | Execution invariant | Systems (source-verified) | Status |
|---|---|---|---|
| E1 | Nothing the model will see next lives only in process memory: the step is recomputed from durable records | OC, DSH, EVE, HER; PRM partial | REPLICATED |
| E2 | An effect is never both unrecorded and possibly done: call-before-effect, settle exactly once, honest "unknown" | DSH, OC, HER, PRM; EVE via receipts | REPLICATED |
| E3 | Input is durable before any execution decision, and delivered only at safe boundaries | OC, DSH, EVE; PRM in memory | REPLICATED |
| E4 | One writer per session, fenced where the write commits | DSH, HER, EVE, OC, PRM | REPLICATED |
| E5 | The model's view is a projection of the record, not the record | DSH, OHS, HER, OC; EVE is the counter-example | REPLICATED |
| E6 | A child is a full durable process; results arrive as notifications | DSH, OC, PRM, EVE, HER | REPLICATED |
| E7 | Failures are classified into recovery classes, not retried blindly | OC, EVE, HER, SWE, PRM | REPLICATED |

Evidence: `A-SYN §1`, and per system: `A-OC §19.1–19.3`, `A-DSH §19.1–19.4`, `A-EVE §19.1–19.5`, `A-HER §19.2–19.3`,
`A-PRM §19 C4–C5`.

**What this establishes.** These invariants are *sufficient* for restart, compaction, model swap and machine moves to
reduce to "reload and continue" (`A-OC §28.1`, `A-DSH §28.1`). Where a system lacks E1 (SWE), it fails all four.

**What it does not establish.** That any of these systems *understands* why it was doing what it was doing after a
restart. Each resumes the *next step*; none resumes a *line of reasoning*.

### 1.2 Persistent cognition: absent

| # | Cognitive property | Found in | Status |
|---|---|---|---|
| C1 | A durable object above the session (person, project, belief store, cross-session goal) | none | ABSENT (7/7) |
| C2 | Epistemic status on stored knowledge (origin, standing, confidence, validity) | none | ABSENT |
| C3 | Runtime verification of task outcomes, independent of the generator | HER exit-code ledger (opt-in, code only); PRM user shell gates | NARROW |
| C4 | Measured learning: a change shown to improve later behaviour | none. HER and PRM adapt, but never evaluate | ABSENT |
| C5 | A record of *why* the model saw what it saw | none. DSH derives *what*; Eve and HER explicitly lack a manifest | ABSENT |
| C6 | Recorded expectations later resolved against outcomes | none. PRM stores `expectedOutcome` and never reads it (`A-PRM §23.3`) | ABSENT |
| C7 | A typed, model-independent working state distinct from the transcript | none. PRM's persistent namespace is the nearest (untyped) | ABSENT |
| C8 | A representation of demonstrated competence | none | ABSENT |

**Why they are absent (causal explanation, INFER).** This is not implementation difficulty. The properties sit outside
these systems' problem statements:

- **Session scope.** They optimise within one thread of work. Calibration, competence and learning require aggregation
  *across* episodes, and there is no object above the session to aggregate in (`A-DSH §28.7`).
- **Cognition is assumed to live in the model.** The harness preserves the model's inputs and outputs. Reasons, beliefs
  and expectations exist only as prose in the transcript (`A-HER §21`: "the transcript is the state").
- **External ground truth.** In the benchmark regime, success is judged outside the loop (SWE-bench tests), so no
  internal verification is needed (`A-SWE §28.4`).
- **Economic pressure pointed elsewhere.** Prompt-cache economics shaped all seven architectures (`A-SYN P7`). None
  models the value of cognition itself.

**Architectural implication.** UCI's distinctive layer lies exactly where the reference evidence base is empty. It
cannot be borrowed; it must be established by experiment (see `12-hypotheses-experiments-and-open-problems.md`).

---

## 2. What exactly separates execution from cognition

A **persistent execution** system can answer, after any interruption:

> Which process exists? Which step ran? Which tool was called? What result came back? What remains?

A **persistent cognition** system must also answer:

> Why was it doing this? What did it believe, why, and how confidently? What did it expect to happen? Why did it attend
> to this and not that? What alternatives did it reject? What has it learned, and was the learning useful? What should
> stay stable, what should change, and when should old knowledge be revisited?

Stated as a model (INFER):

- An **execution trajectory** is a sequence of *mechanical state, action, observation*. Resuming execution means
  reconstructing the mechanical state.
- A **cognitive trajectory** adds five things alongside it:
  - the **epistemic state**: claims held, with their status;
  - the **intentional state**: goals, commitments, intentions, plans;
  - **expectations** attached to decisions;
  - **attention records**: what was selected, and why;
  - **change records**: adaptations, with their predicted effect.
- **Resuming cognition** means reconstructing enough of the epistemic, intentional, expectation and attention state that
  a *different* competent reasoner continues the same line of reasoning, and updates it correctly when a contradiction
  arrives.

This yields the operational test of the whole document, **cognitive equivalence under reasoner substitution**, developed
in `02-persistent-cognitive-state.md` §4.

---

## 3. The missing transition, stage by stage

The research brief lists a thirteen-stage ladder from persistent execution to architectural evolution. The question for
each stage: is it a *genuine primitive*, or a *process* or *projection* over primitives?

| Stage | Verdict | Where it belongs | Reasoning |
|---|---|---|---|
| Persistent execution | **Existing floor** | Harness + kernel | Replicated (E1–E7). Adopt as invariants, not as any one system's mechanism. |
| Persistent state | **Existing floor** | Substrate | Solved for execution. The question is *which* state (§4). |
| Persistent cognitive state | **Distinct, missing** | Substrate holds the authorities; the harness projects them | Defined in `02`. |
| Contextual understanding | **Not a primitive** | Working state + attention | A property of how the situation is projected and attended to, not a stored thing. |
| Experience | **Distinct representation** | Substrate | Trajectory + interpretations + decisions + resolutions linked causally (`06`). |
| Epistemic representation | **Distinct primitive — the claim** | Substrate | Absent in all seven. The foundation for verification, calibration and learning (`03`). |
| Verification | **Process that produces resolution claims** | Harness + environment evaluators | Not a store. Its output is a claim with a method (`07`). |
| Learning | **Not a primitive — a verified property of an adaptation** | Derived | An adaptation *becomes* learning only when evaluated and attributed (`07`). |
| Capability formation | **Projection over resolutions** | Derived (self-model) | Competence = aggregated resolutions under conditions (`07`). |
| Cross-context transfer | **An evaluation, not a primitive** | Derived | Transfer is measured, not stored. |
| Governed adaptation | **Distinct: the adaptation record + governance** | Harness (process); substrate (record) | Replicated in form (HER, PRM), never evaluated. |
| Architectural evolution | **Same ratchet, structural target** | Harness process; human decision | Not a new primitive; the adaptation record applied to architecture (`00`, UCI doc). |

**Result.** Thirteen stages collapse into **four genuinely new record types** on top of the execution floor. Everything
else is processes over, and projections of, these records.

---

## 4. The bridge primitives

### B1. The claim — one epistemic object

A proposition held with:
- an **origin**: observed / stated / source-reported / inferred / conjectured;
- a **standing**: from conjectured up to verified, or disputed / superseded;
- a **confidence vector**, **valid time**, **knowledge time**, evidence for and against, and a derivation;
- optionally, a **resolution condition**.

**Kinds of claim, one structure:**

| Kind | What it asserts |
|---|---|
| Assertion | About the world, a person, a source, or the self |
| Expectation | A future outcome, with a resolution condition and a due time |
| Resolution | Whether an expectation or check held |
| Diagnosis | Why something failed |
| Competence | How reliable the self is under stated conditions |

**Why unify.** Provenance, calibration, contradiction handling, forgetting and access control apply to every kind
*identically*. With one structure:
- the world model is the projection of claims about the world;
- the self-model is the projection of claims about the self;
- a learner model is the projection of claims about a person;
- a misconception is a claim whose subject is another agent's claim.

Details: `03-epistemic-substrate.md`.

### B2. The decision record — the bridge from belief to action

A decision records:
- the choice;
- the alternatives considered;
- the **claims it relied on**, each by address and version;
- the authority it was made under;
- the **expectation claims** it declares.

A decision is the system's own act, so its record is faithful evidence. While it is *in force*, it is operational
state.

**Invariant:** an action cites a decision; a consequential decision cites its beliefs and declares its expectations.

This is what makes credit assignment possible: a bad outcome walks back from action to decision, to the beliefs it
cited, to their evidence (`A-SYN §4`; UCI axiom A3).

### B3. The resolution loop — the atom of calibration, and the necessary input to learning (STRONG HYPOTHESIS)

```
decision ─► expectation (claim, resolution condition, due)
   │
   ▼
action ─► observation (evidence) ─► RESOLUTION (claim: held / failed / indeterminate, by which method)
                                        │
            ┌───────────────────────────┼─────────────────────────────┐
            ▼                           ▼                             ▼
     calibration datum        surprise / salience signal      credit assignment
   (world + self models)     (memory formation, reflection)  (which belief or policy was wrong)
```

**What derives from resolutions:**

| Capability | Derived as |
|---|---|
| Verification | Producing resolutions by an independent method |
| Calibration | Comparing confidence with realised resolutions |
| Self-model / competence | Resolutions of expectations about one's own success, aggregated by condition |
| Learning | Adaptations whose predicted effect is resolved as *held*, under attribution |
| Memory formation | Salience from surprise, i.e. resolutions that falsified confident expectations |
| Architectural diagnosis | Failure resolutions that cluster by structural cause |

**Evidence.**
- *For the loop's value (`R2`):*
  - **Prediction-error learning** is among the best-replicated principles: Rescorla–Wagner, TD learning, dopamine
    prediction-error signals, forecasting tournaments.
  - **Pre-registration** removes hindsight bias: positive results fell from 96% to 44%.
  - **Calibration** is learnable from resolved outcomes (on the order of a thousand graded examples), and not reliably
    available by introspection.
  - **Agents are badly overconfident** about their own success (22% actual vs 77% predicted).
  - **Pre-execution estimates** discriminate better than post-hoc review, so expectations are best captured *before*
    acting.
  - **Two levels, one record type:**
    - *object-level* expectations calibrate the world and self models;
    - *change-level* expectations are pre-registered hypotheses resolved by controlled trials.
- *For its absence:* no reference system records resolvable expectations (C6). The nearest is PRM storing an
  `expectedOutcome` that nothing ever reads, which is exactly the missing half.
- *What remains uncertain:*
  - the granularity at which expectations should be declared (per step, per decision, per goal);
  - their cost;
  - whether models can state useful, resolvable expectations reliably.

  These are experiments (`12`, H-EC2, H-EC3).

### B4. The attention manifest — why the model saw what it saw

A per-model-call record of:
- every included item: address, version, **reason**, score components, epistemic status, staleness, and whether it was
  exact / compressed / inferred;
- every excluded candidate, with the reason for exclusion;
- the clearance used;
- the compression lineage;
- the rendering version.

The reference systems prove *derivability*: DSH folds the request from the log (`A-DSH §19.1`), and HER stores exact
wire bytes (`A-HER §19.1`). None records *reasons*. Without reasons, a bad decision cannot be attributed to a bad
selection versus a bad inference, and attention policy cannot be learned.

Details: `05-context-and-attention.md`.

### B5. The adaptation record — change that can be judged

A proposed change to future behaviour (memory, policy, skill, template, environment, architecture), carrying:
- before and after states;
- the evidence behind it;
- a **predicted effect**, which is itself an expectation claim;
- the evaluation regime and the attribution method;
- scope and lineage.

The reference systems prove the governance half:
- HER: ownership guards, a content-addressed ledger and rollback (`A-HER §19.5`);
- PRM: before/after snapshots, an optimistic baseline and rollback (`A-PRM §19 C8`).

The evaluation half is proven by none.

**Reflection ≠ adaptation ≠ learning ≠ verified improvement:** `07-learning-verification-and-capability.md`.

### Derived: the working state

A per-process, typed, model-independent projection over:
- the intentional state (goals, commitments, decisions in force);
- the claims in play;
- open expectations and open questions;
- constraints and authority;
- execution position.

It is rebuilt at every resume; it is not a new authority. Details: `02` §3.

---

## 5. Competing interpretations

| Interpretation | Claim | Evidence against / for | Status |
|---|---|---|---|
| "Cognition lives in the model; give it the whole transcript" | Long context + transcript replay is enough | **Against:** long-context degradation (`R3`); transcript-as-state carries reasons only as prose, which a new model may read differently. Opaque provider reasoning state cannot cross models (`A-OC §19.5`). There is no calibration signal at all. | REJECTED as sufficient |
| "Add a memory service to an execution harness" | Retrieval-backed memory makes cognition persistent | **Against:** memory without epistemic status or resolutions yields recall, not calibrated belief or learning (`R1`). HER has memory, skills and search, and still cannot tell whether anything helped (`A-HER §28.6`). | REJECTED as sufficient |
| "Learn in the weights" | Fine-tuning from trajectories is the learning substrate | **For:** it is a real long-horizon path (UCI L4). **But:** it needs the same resolution data to know *what* to train on, and it does not provide auditable per-person state. | COMPATIBLE — orthogonal, later |
| "Four record types are too many; claims alone suffice" | Decisions and manifests are just claims | Decisions carry authority and cause actions; manifests are selection records, not propositions. Folding them into claims would blur the epistemic chain. | OPEN — test in implementation |
| "Expectations are too costly to declare" | Models cannot state resolvable expectations cheaply | Plausible. Could be restricted to consequential decisions and goal-level expectations. | OPEN (H-EC3) |

---

## 6. Architectural consequences

These are integrated into the two main documents (see `00-architecture-evolution.md` for the change log):

1. **The execution floor is adopted as invariants E1–E7**, stated implementation-neutrally. The reference mechanisms are
   evidence, not law.
2. **The substrate gains the claim, decision, attention-manifest and adaptation records** as first-class authorities.
3. **Working state is redefined as a projection** over these records and execution state, not as a new store.
4. **Verification is redefined as the production of resolution claims** by independent methods.
5. **Learning is redefined** as an adaptation whose predicted effect is resolved as held, under attribution.
6. **Capability is redefined** as competence claims aggregated from resolutions under conditions.
7. **Two new reality tests** — *cognitive resume* and *context causality* — join the existing ones (`02` §4, `05` §6).

---

## 7. Minimal experiment

**E-EC1 — the cognitive-resume comparison.** One education scenario (a learner across three weeks) and one engineering
scenario (a multi-day objective), each run under three architectures:

- (a) transcript replay (HER-style exact bytes);
- (b) transcript + retrieval memory service;
- (c) execution floor + the four bridge records + a working-state projection.

Apply the resume battery (`02` §4): kill, clear context, swap model, move machine, wait, inject a contradiction, resume.

**Measure:** the cognitive-resume score (C-R1…C-R8), the correctness of belief revision after the contradiction,
repeated side effects, and cost.

**Graduation criterion:** (c) beats (a) and (b) on C-R1…C-R8 at acceptable cost. Then ablate each bridge record in turn
to test which are necessary (H-EC1).
