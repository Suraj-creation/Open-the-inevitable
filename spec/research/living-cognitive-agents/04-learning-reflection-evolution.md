# 04 — Learning, Reflection, Skills & Governed Evolution

*Part of the [Living Cognitive Agents](README.md) corpus. Deliverables H (agent evolution model) and
J (governance model), plus the learning loop, self-model, skills, and offline cognition. Design, not
status.*

---

## 1. The learning loop — closing the ABI's open sockets

The brief's loop (Task → Plan → Action → Observation → Outcome → Evaluation → Reflection → Learning →
Memory/Skill/Policy update) maps almost exactly onto machinery that already runs. The only new steps
are `reflect()` and the proposal path:

```
  STEP                         WHAT RUNS                              STATUS
  ────                         ────────                              ──────
  Task/Plan/Action/Observation execute(packet) → tool calls          IMPLEMENTED
  Outcome                      response packet + Reasoning Trace (C)  IMPLEMENTED
  Evaluation                   Cognitive Evaluation Layer (ADR-0027)  IMPLEMENTED
  ──────────────────────────── the loop is open here ────────────────────────
  Reflection                   reflect(trace) → Reflection Record     ABI HOOK, UNCALLED
  Learning extraction          distillers (agent.strategy-outcome)    IMPLEMENTED (unread)
  Proposal                     hypothesis → EvolutionEngine.propose   PROTOTYPE
  Memory/Skill/Policy update   governed rollout → new Policy version  RESEARCH FRONTIER
```

### 1.1 The Reflection Record — `SPECIFIED`

`reflect(trace)` is called after evaluation and emits a governed **Reflection Record** — an *event*,
not a table. It is the epistemically-typed bridge from experience to adaptation:

```
ReflectionRecord {
  agent_type, learner_id?, tenant_id
  trace_ref                 // the reasoning trace it reflects on
  eval_ref                  // the evaluation outcome
  observation               // "the concrete→mechanism ordering resolved confusion in 1 step"
  inference                 // "concrete-first may suit this learner's spatial preference"
  hypothesis                // "adopt concrete-first as default for this learner" — TYPED as hypothesis
  proposed_adaptation {     // OPTIONAL, and only within the closed dimension enum
    dimension: strategy_ordering
    change: [...]
    expected_benefit
  }
  confidence                // uncalibrated at emission
  provenance                // full chain back to the trace
}
```

Critically, the record **preserves the epistemic ladder** (observed → inferred → hypothesized). The
`observation` is fact; the `inference` is a guess; the `hypothesis` is explicitly a hypothesis. Only
after governed evaluation does a hypothesis become a Policy dimension. This is the mechanical guard
against the brief's `stored = truth` prohibition and against hallucinated learning: **a reflection
never directly changes behaviour.** It proposes; the governed loop disposes.

### 1.2 Distinguishing observation from belief — a required type, not a convention

Every learning artifact carries an epistemic level (from [`03` §2.1](03-cognitive-state-and-memory.md)):

```
observed        the agent directly saw it in the trace (highest trust)
inferred        the agent reasoned it from observations
believed        the system's current posterior after evidence accrual
hypothesized    a proposed but unverified adaptation
asserted        the system currently acts on it (must be calibrated to reach here)
```

An adaptation may only reach `asserted` (i.e., influence a live dispatch) by passing the Layer-2
calibration gate. This single rule prevents the most dangerous failure class: a plausible-but-wrong
reflection silently becoming the agent's behaviour.

### 1.3 Reflection is not learning — the attribution gate between them

The review round sharpens a distinction the pipeline above blurred: emitting a `ReflectionRecord`
whose `hypothesis` is *"shorter explanations worked better"* is **not** knowledge — it is a
correlation an agent noticed. Promoting it because an outcome later improved is the failure mode
*"outcome improved → something we did worked → promote strategy."* In a long trajectory
(Episode 1 Explainer changes analogy · Episode 3 Challenger catches a misconception · Episode 7
Planner reorders prerequisites · Episode 12 the learner succeeds) **who deserves credit** — the
Explainer, the Challenger, the Planner, the learner's own growth, the model, or external
circumstance? Without answering that, the Policy system learns noise. The external evidence makes
this non-optional: reward-hacking and verifier-gaming ([`07` §2](07-research-landscape.md#2-self-improving--skill-learning-agents-angle-2))
are precisely what happens when a self-improvement loop promotes on a signal it has not causally
isolated.

So the pipeline gains an explicit **attribution gate**, and the epistemic ladder is enforced *across*
it, not just within the Reflection Record:

```
  experience → observation → hypothesis            (a ReflectionRecord — a NOTICED correlation)
        │
        ▼  ATTRIBUTION GATE  — the hypothesis must be causally isolated:
        │    • a counterfactual/shadow run shows the outcome would NOT have happened without it, OR
        │    • attribution_confidence ≥ threshold from repeated, varied evidence
        ▼
  learning candidate                               (a hypothesis that survived isolation)
        │
        ▼  EvolutionEngine.propose → shadow → govern
        ▼
  Policy version                                    (asserted; may now route)
```

**This is a strengthening of an artifact that already exists, not a new store.** UCI already distills
`pedagogy.intervention-outcome` (decision × result). The addition is (1) it must carry an explicit
`target_variable` (what cognitive variable the intervention meant to move), an `expected_outcome`, the
`observed_outcome`, and an **`attribution_confidence`** — the calibrated degree to which *this*
intervention, not a confound, produced the outcome; and (2) the **promotion rule**: *a Policy
adaptation may not promote on correlation alone.* It requires either a counterfactual that isolates
the intervention (the EvolutionEngine's shadow test *is* this mechanism — it re-runs the trajectory
without the change) or an `attribution_confidence` above threshold accumulated across varied contexts.
Correlation may *nominate*; only isolation may *promote*. This is the near-term, tractable face of the
[causal-cognition research program (R2)](08-roadmap-and-adrs.md#2-research-roadmap-deliverable-g) and
directly feeds [open problems #2/#3 (attribution, long-horizon credit assignment)](08-roadmap-and-adrs.md#5-open-problems-deliverable-l--the-deepest-unresolved-questions).

## 2. The Self-Model — metacognition as a projection, not an oracle

The **Agent Self-Model** ([`03` §1](03-cognitive-state-and-memory.md)) answers the brief's §12
questions (what am I good at / where do I fail / when should I defer). It is a **materialized,
cached projection** over `agent.strategy-outcome` artifacts — computed, not asserted:

```
AgentSelfModel (projection, per agent_type, cached) {
  competence[ task_type × domain ] {
    attempts, successes, failures
    calibration_error        // predicted confidence vs actual outcome
    trend                    // improving / stable / degrading over time
  }
  defer_when []              // task-types where deferral to another agent beat solo
  degradation_signals []     // conditions that historically caused failure
}
```

How it influences runtime (only after calibration): the supervisor/compiler reads the self-model to
decide (a) whether this agent should handle the task or **defer** to a better-calibrated one, and (b)
how much to trust its self-reported confidence. **Uncalibrated, the self-model is observability-only.**
A self-model that says "I'm great at calculus" without calibrated evidence is exactly the
over-confidence the eval layer exists to catch — so the self-model's *own* confidence is subject to
the same gate as everything else.

## 3. Skills — the highest-value, highest-risk primitive

Skills ([`03` §1.3](03-cognitive-state-and-memory.md#13-agent-skill--research-frontier-deferred-highest-value-highest-risk))
are what let competence *compound and transfer*: an Explainer that discovers "the marble-on-a-sheet
analogy resolves gravity confusion" should be able to *reuse* and *refine* that, and the system should
be able to *transfer* it to related concepts. This is the Voyager insight ([`07`](07-research-landscape.md)).

But skills are where self-improvement gets dangerous, so this corpus **defers them** until the Policy
loop is proven, and constrains them hard:

- **Skills are structured, replayable procedures — not opaque prompt blobs.** A skill whose "procedure"
  is a free-text prompt is un-auditable and un-composable; it is just a saved prompt. A real skill has
  typed steps that can be replayed, evaluated, and composed. (This is the single most important design
  constraint, and the one most agent frameworks get wrong — see [`07`](07-research-landscape.md).)
- **Acquisition is a governed proposal**, exactly like a Policy change. A reflection proposes a skill;
  the EvolutionEngine shadow-tests it against historical sessions; governance approves; only then is it
  `active`.
- **Evidence, including `anti_patterns`, is mandatory.** A skill records where it *fails* as carefully
  as where it works. A skill with a rising failure rate is auto-flagged for retirement.
- **Composition and transfer are themselves governed operations**, not automatic — because a composed
  skill can fail in ways neither parent did (brief §36, agent collusion / pathological composition).
- **Retirement is first-class.** Skills decay; a skill unused or failing for N sessions is
  deprecated → retired, kept auditable.

Skills are `RESEARCH FRONTIER` and explicitly **out of the first production layer** — see
[implementation boundaries](08-roadmap-and-adrs.md#4-implementation-boundaries-deliverable-n--what-to-not-build-yet).

## 4. Offline cognition — scheduling, not a new subsystem

The brief's "Agent Sleep Cycle" (§16) is a good idea whose mechanism **already exists**: distillation
at session close *is* offline consolidation. Offline cognition is the existing distill → evaluate →
propose pipeline, **scheduled as a governed background job** when the learner is inactive. Nothing new
is invented; a scheduler and a budget are added.

What may run offline, and under what authority:

| Offline task | Mechanism (exists?) | Authority | Compute |
|---|---|---|---|
| memory consolidation | consolidation distiller ✓ | automatic | bounded |
| experience clustering / failure analysis | new fold over artifacts | automatic | bounded |
| self-model recomputation | projection recompute ✓ | automatic | bounded |
| Policy adaptation *proposal* | reflection → EvolutionEngine ✓ | automatic to propose; **governance to deploy** | bounded |
| relationship reliability update | fold over `agent.collaboration` ✓ | automatic to record; gate to route | bounded |
| skill synthesis *proposal* | reflection → shadow test | **governance to activate** | metered |
| learner-model refinement | PCI Belief update | automatic to record; gate to route | bounded |
| research preparation / hypothesis generation | research units | **explicit user consent** | metered |

Three hard rules (the brief's §16 questions, answered):
1. **Offline cognition may *propose and record*; it may never *deploy* an adaptation that influences a
   live dispatch without passing the same governance + calibration gates as an online change.** There
   is no "trusted because it happened while you slept" path.
2. **Anything that consumes non-trivial compute or touches sensitive inference requires explicit,
   revocable user consent** and a budget ceiling (the brief's §22 privacy floor; runaway-compute
   mitigation, [`06`](06-runtime-data-observability.md#6-failure-modes-deliverable--brief-36-each-with-detection--prevention--rollback)).
3. **Staleness guard:** offline products are timestamped and expire; a Policy proposal generated
   against a learner state that has since moved is invalidated, not applied.

## 5. The evolution ladder — governed self-improvement

The brief's Level 0–6 adaptation hierarchy conflates *what changes* with *how risky it is*. This
corpus keeps the existing **E0–E5 risk-class ladder** from `uci-architecture.md` §16.3 (the
`EvolutionEngine` already implements it) and maps agent adaptations onto it, because risk class — not
adaptation type — is what determines the gate:

| Class | Agent adaptation examples | Gate (who authorizes) | Evaluation | Reversible? |
|---|---|---|---|---|
| **E0** | reword a prompt fragment | automated eval + canary | offline eval | trivially |
| **E1** | Policy dimension tweak (depth bias, modality weight) for one learner | replay eval + shadow | replay against that learner's history | version rollback |
| **E2** | change which strategy is *default* for a learner | shadow + calibration gate | shadow on synthetic + real cohort | version rollback |
| **E3** | activate a new skill; change a routing/relationship weight | human review + shadow | shadow + longitudinal metric | rollback + skill retire |
| **E4** | change an agent's authority/constraints (Constitution) | governance board + migration plan | full replay + security review | migration |
| **E5** | add a new Policy *dimension* or a new agent *kind*; change the ABI | ADR + architecture approval | full program | migration |

The pipeline for every class ≥ E1 (the brief's §18, and it is **already built** in `EvolutionEngine`):

```
  experience (agent.strategy-outcome, durable)
        ↓
  reflection → adaptation hypothesis (typed, epistemic)
        ↓
  EvolutionEngine.propose()          ← exists
        ↓
  evaluate() — shadow test on synthetic learners + replay on history   ← exists (D2/D3)
        ↓
  evaluationGuard (Cognitive Eval Layer, ADR-0027) — calibration gate  ← exists
        ↓
  governance guard (E-class dependent)                                 ← exists
        ↓
  approve() → rollout() with new Policy VERSION (not in-place)         ← exists
        ↓
  monitor (longitudinal metric)  →  promote  OR  rollback()            ← rollback exists
```

**The entire governed-evolution machine the brief asks to design already exists** in
`packages/orchestration/src/evolution.ts` — propose/evaluate/approve/rollout/rollback with a governance
guard and an evaluation guard, deterministic shadow tests, and live-config rollout/rollback callbacks.
The Living-Agent work is: (1) make the *input* an Agent Adaptive Policy proposal instead of a global
config delta; (2) make the *output* a versioned per-agent Policy instead of the shared `depthBias`;
(3) **reach it from the product path** (it is currently CLI-demo-only — a PROTOTYPE). That third point
is the single highest-leverage wiring task after the reflect loop.

## 6. Why "the agent changes itself" is never allowed — and how identity is protected

The brief's §18 prohibition (`Agent → changes itself` is forbidden) is enforced *structurally*, in
three layers:

1. **The agent object is stateless.** It has nothing to change. There is no in-process mutable field
   an execute() could corrupt. (This is the [`02`](02-the-living-agent-thesis.md) thesis paying off:
   an externalized-state agent *cannot* self-modify, because its "self" is a governed artifact it does
   not hold.)
2. **Adaptation is a proposal through a separate engine.** The reflect step *emits*; the EvolutionEngine
   *disposes*. The proposing agent is not the approving authority. This separation of powers is the
   same one the audit corpus insists on for the whole system.
3. **The Constitution is dominant and higher-classed.** A Policy can only specialize within the
   Constitution's envelope (the compiler enforces precedence, [`02` §4](02-the-living-agent-thesis.md#4-the-cognitive-context-compiler)),
   and changing the Constitution is an E4/E5 event requiring human governance. **Identity drift and
   goal drift are therefore not "monitored and corrected" — they are made structurally impossible**
   for the online loop: online adaptation cannot touch Layer A at all.

This is the precise, mechanical answer to "how does the agent evolve without corrupting its identity?"
— the two layers are different artifacts with different governance classes, and the online path can
only write the lower-classed one, within the envelope the higher-classed one defines.

→ Continue to [`05` — society, formation & routing](05-society-and-formation.md).
