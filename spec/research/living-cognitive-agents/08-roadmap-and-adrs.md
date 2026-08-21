# 08 — Roadmap, ADR Candidates, Open Problems & Boundaries

*Part of the [Living Cognitive Agents](README.md) corpus. Deliverables F (production roadmap),
G (research roadmap), L (open problems), M (ADR candidates), N (implementation boundaries), plus the
glossary. Design, not status.*

---

## 1. Production roadmap (Deliverable F)

The ordering is a **safety property**, not a convenience: each phase must be *proven* (its calibration
gate passed, its longitudinal metric positive) before the next begins. The first phase is deliberately
tiny — the smallest change that closes the loop end-to-end — because everything downstream inherits
its correctness.

### Phase L0 — The Constitution (Production Now)
Promote `manifest.{role,policies,capabilities,memory_access}` into a signed, version-pinned
`AgentConstitution`; wire the governance engine to gate edits by change-class (E4/E5). No behaviour
change; pure governance upgrade of existing data. **Unblocks** governance of everything after it.
*Effort: small. Risk: minimal.*

### Phase L1 — The Cognitive Context Compiler (Production Now → Next)
Generalize `ModelBackedUnit`'s prompt assembly into the budgeted, precedence-ordered,
provenance-tagged compiler ([`02` §4](02-the-living-agent-thesis.md#4-the-cognitive-context-compiler)).
Initially it reads only what exists (Constitution, task, memory, world-slice). **This is the spine;
build it before any adaptive state so there is a place to plug Policy in.** *Effort: moderate. Risk:
low (no new behaviour, better structure + observability).*

### Phase L1.5 — Cognitive State Integrity (Production Next — a gate, not a feature)
The review round adds this, and it is correct: **do not build adaptive policy on an unproven
persistence substrate.** Before any Policy influences behaviour, prove — for every row of the
[State Ownership Matrix](03-cognitive-state-and-memory.md#0-the-state-ownership-matrix--one-authority-per-kind-of-truth)
— that the substrate answers: *what state exists, who owns it, how is it mutated (one typed path),
how is it retrieved, how is it invalidated, how are contradictions handled, how does replay
reconstruct it?* This is grounded in current reality, not hypothetical: the durable-learner slice
(migration 0004) and durable retrieval (ADR-0065) landed, **but world-state and the source catalog
are still JSON snapshots, and retrieval text is thin.** Building the Policy loop on top of that would
create *intelligent adaptation over incomplete memory* — dangerous both technically (silent data
loss) and scientifically (you would be measuring adaptation over a substrate that itself loses state,
confounding every longitudinal result). L1.5 is the gate that closes those substrate gaps (world-state
→ Postgres; richer indexed retrieval; contradiction + invalidation semantics wired) and *verifies them
by replay* before L2 begins. *Effort: moderate. Risk: low — but skipping it makes L2's evidence
uninterpretable.*

### Phase L2 — Close the loop for ONE agent, ONE dimension (Production Next)
The pilot. For the **Explainer only** and the **strategy-ordering dimension only**:
1. Call `reflect(trace)` after evaluation → emit `ReflectionRecord`.
2. Project `agent.strategy-outcome` artifacts into an `AgentAdaptivePolicy(explanation, learner)`.
3. Route the reflection through the **already-built** `EvolutionEngine` (make it reachable from the
   product path — the one significant wiring task).
4. Compiler reads the Policy; the Layer-2 calibration gate governs whether it *routes* or is merely
   *recorded*.
5. Measure the **experience-accumulation** longitudinal metric ([`06` §5.2](06-runtime-data-observability.md#52-longitudinal-metrics-the-actual-test--does-it-get-better)).

**This single vertical slice is the whole thesis in miniature.** If the Explainer measurably teaches
this learner better after 20 episodes than at episode 1 — model held fixed — the program is validated.
If not, it rolls back and the corpus's core claim is falsified cheaply. *Effort: moderate. Risk:
medium — but bounded, reversible, and single-agent.*

### Phase L3 — Generalize Policy across agents (Production Next → Experimental)
Extend the proven loop to the other model-backed agents and the remaining closed Policy dimensions
(depth, modality, pacing). Introduce the **Self-Model** as a read-only projection; surface it in
observability. Introduce **default (learner-null) policies** and the governed personalized→default
promotion for collective learning.

### Phase L4 — Relationships & selective society (Experimental)
Project `agent.collaboration` into `AgentRelationship`; calibrate; let it influence routing for
high-uncertainty tasks only. Invoke the disagreement machinery selectively (cost-gated).

### Phase L5 — Skills (Frontier Research)
Only after L2–L4 are stable. First-class, structured, governed skills with acquisition/composition/
retirement. Highest value, highest risk; smallest possible initial scope (one agent, hand-seeded skill
library, acquisition disabled until composition is safe).

### Phase L6+ — Offline cognition at scale, causal cognition, autonomous research (Frontier → Long-Horizon)
Scheduled governed offline jobs; causal world-model edges; the research loop. Each its own program
with its own ADR. **Dynamic agent formation is explicitly beyond this roadmap** (§4 boundaries).

| Phase | Deliverable | Layer | Depends on |
|---|---|---|---|
| L0 | Constitution | Production Now | — |
| L1 | Context Compiler | Production Now/Next | L0 |
| **L1.5** | **Cognitive State Integrity gate** | **Production Next** | **substrate slices (world-state → Postgres, retrieval)** |
| L2 | Loop closed, 1 agent | Production Next | L1 + L1.5 + EvolutionEngine reachable |
| L3 | Policy generalized + Self-Model | Production Next/Exp | L2 proven |
| L4 | Relationships + society | Experimental | L3 |
| L5 | Skills | Frontier Research | L4 stable |
| L6+ | Offline/causal/research + Intention Graph + Epistemic Workspace + **Cognitive Environment Runtime** (env/workspace/process/recursive-invocation/scheduler/generator) | Frontier/Long-Horizon | its own ADRs; grown from existing execution engine + world-state, never greenfield |

## 2. Research roadmap (Deliverable G)

Longer-horizon programs, each gated by the adoption gate, each with a genuine open problem:

- **R1 — Calibrated cognitive state.** The shared R0 formalization + Layer-2 calibration harness for
  the unified epistemic substrate (agent Policy/Self-Model **and** learner Belief State). *Co-owned
  with the [PCI corpus](../persistent-cognitive-intelligence/); they adopt together.*
- **R2 — Causal cognition.** From "learner failed X repeatedly" to "failure X ← weak prerequisite Y ←
  wrong abstraction level," with the *correlation → inference → causal hypothesis → verified causal*
  ladder made rigorous. First-class causal edges in the world-state graph. This is a major research
  direction shared with PCI's `CognitiveDiagnosis`.
- **R3 — Skill learning that is safe.** Structured, composable, transferable skills with reward-hacking
  and skill-drift resistance proven on synthetic learners before any real deployment.
- **R4 — Longitudinal evaluation science.** The benchmark suite that *proves accumulation* ([`06`
  §5](06-runtime-data-observability.md#5-evaluation-deliverable-k--proving-intelligence-accumulates-not-regenerates))
  — this is itself research; there is no off-the-shelf "does this agent get better over months" benchmark.
- **R5 — Multimodal perception → durable cognitive model.** The importance/relevance filter that
  decides *what deserves to become durable knowledge about a person's cognitive world* — with privacy,
  consent, and inference boundaries as first-class research constraints, not afterthoughts.
- **R6 — Autonomous research loop.** Question → uncertainty → hypothesis → source discovery → evidence
  → verification → knowledge update, with a mandatory human verification gate and zero tolerance for
  fabricated discovery. `LONG-HORIZON`.
- **R7 — Intentional cognition.** The [Intention / Commitment Graph](03-cognitive-state-and-memory.md#15-the-intention--commitment-graph--research-frontier)
  as a world-state projection: persistent goals/hypotheses/open-questions/plans with expiry,
  supersession, and first-class abandonment — the "Intentional" horizon. Unifies with the Intent Lease
  and PCI's `CognitiveGoal`; the substrate for any cross-session inquiry. `RESEARCH FRONTIER`.
- **R8 — Epistemic workspaces & organizational cognition.** The [Epistemic Workspace](05-society-and-formation.md#7-the-epistemic-workspace--collective-inquiry-state)
  as the collective projection of Claim Graph + Intention Graph — a research society acting on shared,
  structured inquiry state, with contamination-propagation + quarantine semantics
  ([`06` §6.1](06-runtime-data-observability.md#61-cross-agent-epistemic-contamination--the-shadow-side-of-the-shared-substrate))
  as a first-class constraint. `LONG-HORIZON`.
- **R9 — The Cognitive Environment Runtime** ([`09`](09-cognitive-environment-runtime.md)). The
  persistent, programmable environment; the **open Cognitive Process taxonomy** (agent ⊂ process,
  grown by generalizing `CognitiveUnit` + fibers); **Recursive Cognitive Invocation** (governed,
  budgeted, spawn-capped); and **programmatic context operations** (compute over context — direct CSE
  payoff). Grown from the existing execution engine + world-state + memory, never greenfield.
  `RESEARCH FRONTIER`.
- **R10 — The Cognitive Scheduler & governed offline cognition.** Generalize `DepthScheduler` into a
  scheduler that reasons about *when* cognition should happen (priority · cost · consent · budget ·
  interruptibility · relevance); realize consolidation→reflection→preparation as governed background
  work; enforce *compaction ≠ termination*. `RESEARCH FRONTIER`.
- **R11 — The Cognitive Environment Generator** ([`09` §7](09-cognitive-environment-runtime.md#7-new-primitive--the-cognitive-environment-generator-from-prime-general-agent)).
  Active experimental pedagogy: synthesize diagnostic/transfer tasks with *calibrated difficulty* and
  *external verifiers*, closing the learner-model loop. Education-domain, on the runtime. `RESEARCH FRONTIER`.
- **R12 — Task/Harness/Runtime separation & model–harness co-learning** ([`09` §8.1](09-cognitive-environment-runtime.md#81-task--harness--runtime-separation--and-the-trainable-cognitive-process)).
  Compose Objective / Harness / Runtime / Environment so one capability runs across local/cloud/
  browser/sandbox/simulation; then make **the cognitive process itself trainable** — trajectories that
  record when to branch/retrieve/delegate/verify/consolidate/stop become a training signal, replacing
  fragile prompt-supplied competence. The endpoint the event-sourced substrate quietly enables.
  `LONG-HORIZON` — beyond the production roadmap; never a reason to build the runtime before L2.

## 3. ADR candidates (Deliverable M)

Only genuinely architectural decisions — each terse (context / decision / rejected alternatives), each
a gate for a phase. Proposed, not accepted; each requires the R0 formalization first.

| # | ADR candidate | Decides | Gates |
|---|---|---|---|
| A1 | **Agent Constitution as a governed artifact** | Promote manifest identity to a signed, change-classed Constitution; online path cannot write it | L0 |
| A2 | **Cognitive Context Compiler** | Replace flat prompt assembly with budgeted, precedence-ordered, provenance-tagged compilation; DSP is one output | L1 |
| A3 | **Agent Adaptive Policy + closed dimension enum** | Per-(agent,learner) versioned Policy through the EvolutionEngine; adaptation space is a closed, ADR-gated enum | L2 |
| A4 | **The reflect→propose loop** | `reflect()` emits governed ReflectionRecords; adaptations flow only through the EvolutionEngine; no self-modification | L2 |
| A5 | **Layer-2 calibration gate for routing** | Uncalibrated belief may record but not route; shared with PCI | L2 (cross-cutting) |
| A6 | **Unified epistemic substrate** | Agent Self-Model/Policy and learner Belief State share one Evidence→State→Uncertainty family and one calibration harness | R1 (co-owned) |
| A7 | **Agent Relationship & evidence-based routing** | Calibrated, outcome-grounded reliability influences routing; collusion-resistant by grounding in learner outcome | L4 |
| A8 | **Agent Skill primitive** | Structured, replayable, governed skills; acquisition is a proposal; anti-patterns mandatory | L5 |
| A9 | **Causal world-model edges** | First-class causal edges + the correlation→verified-causal ladder | R2 |
| A10 | **Intention / Commitment Graph** | Persistent goals/hypotheses/open-questions as a world-state projection under Intent Leases; unifies with PCI `CognitiveGoal`; first-class expiry + abandonment | R7 |
| A11 | **Contamination lineage & quarantine semantics** | Traversable provenance lineage; quarantine propagates to descendants; lineage-scoped (not global) rollback | R8 (also hardens L3+) |
| A12 | **Cognitive Process taxonomy** | Generalize `CognitiveUnit`+fibers into an *open, extensible* process taxonomy; agent ⊂ process; new kinds by ADR + manifest, never a hardcoded enum | R9 |
| A13 | **Programmable Cognitive Workspace** | A typed, process-scoped environment view; every write a governed mutation; base Constitution immutable to the process (no model-side self-edit) | R9 |
| A14 | **Recursive Cognitive Invocation** | Governed, budgeted, spawn-capped dynamic process spawning with typed message-passing + explicit epistemic read-boundaries (not result-into-parent-context) | R9 |
| A15 | **Cognitive Object addressing** | Cognition units are stable-id, versioned, related, governed world-state objects (object-centric, not session-centric); unifies State Ownership + Claim + Intention graphs | R9 |
| A16 | **Cognitive Branch (fold)** | In-process temporary expansion — branch → solve → fold a concise result; distinct from delegation; foldable/replayable | R9 |

A1–A5 are the near-term set. A6 is the cross-corpus unifier. A7–A16 are frontier (A12–A16 are the
[Cognitive Environment Runtime](09-cognitive-environment-runtime.md) set — post-L2). **Note:** the
[State Ownership Matrix](03-cognitive-state-and-memory.md#0-the-state-ownership-matrix--one-authority-per-kind-of-truth)
and the **Phase L1.5 integrity gate** are *not* ADRs — the matrix is a living reference document (it
records decisions made elsewhere), and L1.5 is a verification gate on substrate work already
committed. Neither introduces a new architectural decision; both enforce existing laws.

## 4. Implementation boundaries (Deliverable N) — what to NOT build yet

The brief (§45) and `CLAUDE.md` (*no speculative architecture*) both demand this. **Do not build:**

- **Skills, before the Policy loop (L2/L3) is proven.** Skills without a proven governed-adaptation
  substrate are a reward-hacking accident waiting to happen.
- **Dynamic agent formation / agent spawning agents.** A fixed roster of experienced agents beats a
  swarm of stateless ones for years. This is a scaling answer to a problem UCI does not have. Beyond
  the roadmap entirely until Stages 2–4 are real.
- **Autonomous research / discovery as a product capability.** The loop is designable; autonomous
  scientific discovery is not solved. Keep it `LONG-HORIZON`; never let it masquerade as shipped.
- **Causal world model, ahead of the evaluation science.** Building causal inference before you can
  *measure* whether its inferences are right produces confident wrongness.
- **Multimodal "collect everything" context.** The perception→importance→memory-policy pipeline and its
  consent/inference machinery must precede any ambient capture. Capture without the filter is
  surveillance, not cognition.
- **Per-agent internal mutable state, ever.** This is not "not yet" — it is *never*. It violates the
  externalized-state thesis that the whole architecture rests on.
- **A second uncertainty/calibration stack.** Reuse the PCI one (A6). Two is a `one-concept-one-authority`
  violation.
- **The full Cognitive Environment Runtime as a greenfield system** ([`09` §11](09-cognitive-environment-runtime.md#11-roadmap-placement--boundaries)).
  It is *grown* from the existing execution engine + world-state + memory, post-L2 — never a big-bang
  rewrite. Likewise: **no model-side write access to the Workspace** (governed mutation proposals
  only), and **no Recursive Cognitive Invocation before spawn-governance, budgets, and caps are
  proven.** A programmable environment built before the loop is proven is speculative architecture at
  the largest possible scale.
- **Model–harness co-learning / training the cognitive process** ([R12](#2-research-roadmap-deliverable-g)).
  `LONG-HORIZON` research, not a build item. It presupposes a stable runtime, a rich trajectory
  corpus, and proven evaluation — none of which exist pre-L2. Do not let "the substrate makes cognition
  trainable" become an argument for building the substrate ahead of the loop.

## 5. Open problems (Deliverable L) — the deepest unresolved questions

1. **Calibration at low N.** A learner has a handful of episodes; an agent-learner Policy must
   calibrate on sparse data or it never routes. Bayesian priors from the default policy help, but
   principled low-N calibration for cognitive state is open (shared with PCI).
2. **Attributing improvement to the Policy, not the model or the learner's own growth.** The
   longitudinal metric must isolate *the agent's* contribution from confounds. This is a causal-
   inference problem inside the evaluation itself.
3. **Credit assignment across a long trajectory.** When a learner masters a concept after 15 episodes,
   *which* agent strategies deserve credit? Without this, Policy learning is noisy.
4. **Skill transfer boundaries.** When does a skill that works for concept A genuinely transfer to B
   vs. misfire? The `applicable_when` predicate is the hard part; getting it wrong is negative transfer.
5. **Safe composition.** A composed skill/strategy can fail in ways neither parent did. Detecting
   pathological composition before deployment is open.
6. **Distinguishing genuine disagreement from correlated error.** Two agents agreeing may both be
   wrong for the same reason; the eval must not read agreement as correctness.
7. **The forgetting policy.** What *should* an agent forget, and when does forgetting help vs. harm?
   Under-forgetting → stale, contradictory state; over-forgetting → no accumulation. The optimum is
   learner- and domain-specific and currently unknown.
8. **Causal cognition without over-claiming.** Inferring *why* a learner failed, at a confidence that
   is honestly calibrated, without the seductive over-confidence of a plausible narrative, is perhaps
   the deepest open problem — and the highest-value one.
9. **Context selection as the cognitive bottleneck.** Since retrieval *is* attention
   ([`03` §3.1](03-cognitive-state-and-memory.md#31-the-compiler-is-an-attention-mechanism-not-a-prompt-assembler)),
   how do you *prove* the compiler selected the evidence that was *right* rather than merely
   *relevant-looking* — especially the counter-evidence a relevance ranker starves? There is no
   established metric for "the context contained what was needed and excluded what would mislead."
10. **Goal persistence vs. intention drift.** How does a long-horizon agent
    ([Intention Graph](03-cognitive-state-and-memory.md#15-the-intention--commitment-graph--research-frontier))
    hold commitments across time without becoming rigid, pursuing obsolete goals, forgetting
    unfinished work, or accumulating unbounded open intentions? The expiry/abandonment policy is the
    crux and is unknown.
11. **Cross-agent epistemic contamination at scale.** The shared substrate propagates a wrong
    inference across agents ([`06` §6.1](06-runtime-data-observability.md#61-cross-agent-epistemic-contamination--the-shadow-side-of-the-shared-substrate)).
    Lineage tracking + quarantine + lineage-scoped rollback are the design, but *efficient, complete
    contamination-propagation semantics over a large evolving graph* — catching every descendant
    without freezing the system — is genuinely unsolved. This is the price of the corpus's own thesis.
12. **Distribution shift across people and domains.** A strategy that improves *education* may fail —
    or harm — when the same machinery is reused for research, healthcare, or ambient personal
    cognition. The personalized→default and domain→domain promotion paths need explicit **domain
    boundaries**; a Policy validated in one domain must not silently route in another. This is the
    governance form of UCI's "education is the first domain, not the boundary" identity.
13. **Governed self-programming without self-modification** ([`09` §2](09-cognitive-environment-runtime.md#2-new-primitive--the-cognitive-environment--the-cognitive-workspace)).
    Prime Agent lets the model CRUD its own harness; UCI forbids that and allows only *governed
    mutation proposals*. The open question: how much *programmability* of the Workspace can a process
    have — for genuine expressive power — while every write remains typed, governed, replayable, and
    unable to touch identity? Too little and it is just RAG; too much and it is self-editing memory's
    documented corruption. The safe expressive frontier is unknown.
14. **Process-explosion economics.** "Many small deep-task processes"
    ([`09` §3](09-cognitive-environment-runtime.md#3-the-reframe-that-answers-do-not-hardcode-a-fixed-number-of-agents))
    only helps if the [Cognitive Scheduler](09-cognitive-environment-runtime.md#6-new-primitive--the-cognitive-scheduler--offlinesleep-time-cognition)
    can decide *which* processes are worth running, when, and at what budget — across potentially
    thousands of candidate spawns. Scheduling cognition by expected value (not just readiness), and
    proving it does not degrade into runaway spawn or starvation, is an open control problem.

## 6. Glossary

| Term | Meaning |
|---|---|
| **Living Cognitive Agent** | Constitution + externalized Adaptive Policy + projections, compiled per dispatch; stateless object, stateful substrate |
| **Cognitive Constitution** | The tightly-governed, version-pinned identity layer (A); online path cannot write it |
| **Adaptive Policy** | The governed, versioned, per-(agent,learner) learned-competence layer (B); compiled, never mutated in place |
| **Cognitive Context Compiler** | The budgeted, precedence-ordered, provenance-tagged function that composes the model invocation |
| **Reflection Record** | The governed, epistemically-typed event a `reflect()` step emits: observation→inference→hypothesis→proposal |
| **Self-Model** | A cached projection of an agent's calibrated competence; observability-only until calibrated |
| **Skill** | A first-class, structured, replayable, evidence-bearing procedure; governed acquisition/retirement |
| **Relationship** | Evidence-based, calibrated, outcome-grounded reliability between agent types; influences routing |
| **Learner Belief State** | The shared probabilistic learner model (owned by the PCI corpus); every agent projects from it |
| **Epistemic ladder** | observed → inferred → believed → hypothesized → asserted; a required field, gates routing |
| **Layer-2 gate** | The Cognitive Evaluation Layer's calibration certification; uncalibrated belief may record but not route |
| **E0–E5** | The existing risk-class ladder for adaptations; risk class (not adaptation type) sets the governance gate |
| **The closed loop** | reflect → distill → propose → shadow → govern → rollout(versioned Policy) → compile; ~80% already built |
| **Cognitive Environment** | The substrate seen as a persistent, programmable place a process acts within; the context window is one view of it |
| **Cognitive Workspace** | A typed, process-scoped, governed view over the Environment; programmable via *mutation proposals*, never model-side self-edit |
| **Cognitive Process** | The generalization of "agent" — an open taxonomy (agent, retrieval, verification, simulation, reflection, consolidation, …); most are not autonomous agents |
| **Recursive Cognitive Invocation** | Governed dynamic spawning of child processes with typed message-passing; the generalized, non-literal form of RLM's `rlm()` |
| **Cognitive Scheduler** | Generalizes `DepthScheduler` to decide *when* cognition should run (priority · cost · consent · budget · relevance) |
| **Compaction ≠ termination** | Compacting a process's context changes its *view*, never ends its *work*; workspace, goals, memories, children persist |
| **Cognitive Object** | A stable-id, versioned, related, governed unit of cognition (hypothesis, decision, evidence, …); object-centric, not session-centric; a world-state projection |
| **Cognitive Branch** | Temporary in-process expansion — branch → solve subtask → fold back a concise result; a third context mechanism beyond memory and delegation |
| **Task/Harness/Runtime** | The composable separation: Objective (what) · Harness (how) · Runtime/Environment (where); lets one capability run across many environments and become trainable |
| **Longitudinal Cognitive Task** | The flagship benchmark: work → disconnect → resume → contradiction → new sub-problem; proves accumulation, not single-shot success |

---

## Closing statement

The brief asked how to build cognitive entities whose intelligence does not reset after every
interaction. The honest, evidence-grounded answer this corpus reaches is narrower and more actionable
than the brief assumed: **UCI does not need to build living agents from scratch — it needs to close a
loop it already left open.** The experience is recorded; the governance exists; the evaluation exists;
the persistence floor is now real. What is missing is the return path — a `reflect()` call, a Policy
projection, and a compiler — plus the discipline to let nothing route until it is calibrated, and to
let nothing touch identity except human governance.

Build that one vertical slice for one agent. Prove the Explainer teaches *this* learner measurably
better at episode 20 than episode 1, model held fixed, improvement surviving a model swap. Everything
else in this corpus — societies, skills, causal cognition, autonomous research — is a governed
extension of that single proven loop, or it is speculation. The discipline is to keep it the former.

*This corpus is research. It becomes architecture only through the [adoption gate](README.md#adoption-gate)
— one ADR at a time, each behind evidence.*
