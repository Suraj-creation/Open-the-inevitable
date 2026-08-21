# 09 — The Cognitive Environment Runtime (Prime-Agent synthesis)

*Part of the [Living Cognitive Agents](README.md) corpus. The design bridge between the
[thesis](02-the-living-agent-thesis.md) and an implementable runtime, informed by Prime Agent (RLM +
Continual Harness + general-agent), ACE, MemGPT, Voyager, Generative Agents, and sleep-time compute.
**Research, not law.** Every capability here is `RESEARCH FRONTIER` or `LONG-HORIZON`, gated on the
[adoption gate](README.md#adoption-gate); nothing is implemented.*

---

## 0. The one lesson worth taking

Prime Agent's deepest contribution is **not** RLM, the IPython kernel, or the harness. It is a
single architectural inversion:

> **Move intelligence out of the transient context window and into a persistent, programmable
> environment the cognitive process can inspect, transform, delegate over, remember, and continue
> work inside — and make the context window merely one temporary *view* into that environment.**

This does **not** replace the [externalized-state thesis](02-the-living-agent-thesis.md#1-the-thesis-stated-as-a-design-law).
It *is* that thesis, concretized and made programmable. The corpus already said "an agent's life
lives in the substrate, not the agent; the context window is an attentional view; the Compiler is the
attention mechanism." Prime Agent shows the strong form of the same idea: **the substrate is not just
storage the Compiler reads — it is a *programmable environment* the process acts within.** That is
the upgrade. Everything below follows from taking it seriously while keeping every UCI law intact.

**Framing correction to the source material.** The synthesis that prompted this file recommended a
standalone "Cognitive Environment & Recursive Agent Runtime" document that could read as a *second*
architecture. It is deliberately written here instead, as a corpus member subordinate to
[`02`](02-the-living-agent-thesis.md) — because *one concept, one authority*: the Cognitive
Environment is the elaboration of "the substrate," not a rival to it.

---

## 1. The inversion: Cognitive Environment first, prompt last

The corpus's runtime ([`06` §1](06-runtime-data-observability.md#1-runtime-architecture)) already
puts the Compiler before the model. Prime Agent pushes the ordering one level deeper:

```
   BEFORE (implicit in most agent frameworks):    AFTER (this synthesis):
   Agent → Dynamic Prompt → Model                 Persistent Cognitive Environment
                                                    → Cognitive State (typed)
                                                    → Attention / Context Compiler
                                                    → Dynamic Context (a VIEW)
                                                    → Model (a reasoning faculty INSIDE the env)
```

The model stops being the thing that *has* context and becomes a **reasoning faculty operating inside
an environment** — able (through typed, governed operations) to query state, transform it, spawn
child processes, and continue across turns, rather than re-ingesting everything into a prompt each
time. This is MemGPT's "LLM as OS" and Prime's RLM lineage, disciplined by UCI's laws.

---

## 2. New primitive — the Cognitive Environment & the Cognitive Workspace

**Status: `RESEARCH FRONTIER`.** Grounded in existing code: it is the *unification and
programmable-view layer* over the world-state graph, tiered memory, intelligence plane, and event log
that already exist ([`01` §3](01-current-architecture-and-gap.md#3-what-the-substrate-already-has-the-good-news)).

- **Cognitive Environment** — the persistent, durable, governed world a cognitive process lives in.
  It is the substrate ([`03` §0 State Ownership Matrix](03-cognitive-state-and-memory.md#0-the-state-ownership-matrix--one-authority-per-kind-of-truth))
  seen as a place, not a store: world state, human/learner state, knowledge, memory,
  goals/commitments, evidence, projects, artifacts, open questions.
- **Cognitive Workspace** — a *process-scoped, typed working environment* over the Environment: the
  generalization of Prime's IPython kernel from "Python variables" to **typed cognitive objects**.
  Not free-form scratch memory — a bounded, governed handle:

```
cognition.workspace     active goals · commitments · open loops (process-scoped view)
cognition.memory        typed tiers, lease-bounded            (Memory Mutation Protocol)
cognition.goals         Intention/Commitment Graph            (03 §1.5)
cognition.evidence      claims + evidence + contradictions    (Claim Graph)
cognition.sources       CSE source workspaces                 (source-environment)
cognition.world         world-state slice
cognition.agents        child cognitive processes             (spawn/await/message)
cognition.history       the event stream (this process's lineage)
```

**The decisive UCI discipline that Prime Agent lacks — and where UCI rejects the source.** Prime's
Continual Harness lets the model **CRUD its own** prompt notes, memories, skills, and subagent specs;
Letta's memory blocks are **tool-mutated** by the model directly. The corpus already
[rejected self-editing memory](07-research-landscape.md#1-agent-memory--context-engineering-angle-1)
as ungoverned. Reconciliation: **the Workspace is programmable, but every write is a typed, governed,
replayable mutation — never an arbitrary edit.** `cognition.memory.write(anything)` does not exist;
`cognition.memory.propose(mutation)` does, and it flows through the same Memory Mutation Protocol +
governance gate as any other write. The base **Constitution is immutable** to the process
([`04` §6](04-learning-reflection-evolution.md#6-why-the-agent-changes-itself-is-never-allowed--and-how-identity-is-protected)).
So UCI gets Prime's programmable environment *without* its self-modification hazard: the model
programs its **workspace**, never its **identity**, and every workspace write is a first-class mutation.

### 2.1 The Cognitive Object — object-centric, not session-centric (the deepest correction)

Prime's state is *session-centric*: variables live in a kernel, findings in a transcript, artifacts
in files — all scoped to a session that survives compaction. That is enough for bounded coding work.
UCI needs one level higher: **every meaningful unit of cognition is a first-class Cognitive Object,
addressable by stable id independently of any runtime instance, session, or model.** A variable that
only exists inside one process's kernel cannot be shared, related, versioned, or governed across the
society and across time — which is precisely what UCI's shared-substrate thesis requires.

```
CognitiveObject (kind ∈ document | hypothesis | decision | question | evidence | observation |
                         experiment | simulation | artifact | goal | skill | agent | process | …)
  id            hypothesis:H-42 · decision:D-17 · research:R-103   (stable, addressable)
  state         typed body
  relationships D-17 based_on→R-103 · contradicts→H-31 · supersedes→D-12 · validated_by→A-7
  version       full history (never in-place overwrite)
  provenance    what produced it, from what evidence
  epistemic     status + calibrated confidence (the epistemic ladder)
  access_policy who may read/write/project it
```

This turns agent memory from *"text snippets"* into *"a structured, evolving, related, governed
web of cognitive objects."* It is the unifying substrate under three things the corpus already
proposes separately — the [State Ownership Matrix](03-cognitive-state-and-memory.md#0-the-state-ownership-matrix--one-authority-per-kind-of-truth)
(which owns *which kind* of object), the [Claim Graph](01-current-architecture-and-gap.md#3-what-the-substrate-already-has-the-good-news)
(claims/evidence/contradictions as objects), and the [Intention/Commitment Graph](03-cognitive-state-and-memory.md#15-the-intention--commitment-graph--research-frontier)
(goals/hypotheses as objects). They are all **Cognitive Objects with typed relationships in the
world-state graph** — not separate stores. Object-centricity is what lets a decision made by one
process today be inspected, contradicted, superseded, or verified by another process next month.

**Discipline (unchanged laws):** an object is a world-state projection (re-derivable from the event
log), every write is a typed mutation, and `supersedes`/`contradicts` are first-class edges resolved
by [semantic conflict handling](03-cognitive-state-and-memory.md#22-contradiction-handling) — never
silent overwrite. `RESEARCH FRONTIER`; the `A10`/`A12` primitives are its first instances.

---

## 3. The reframe that answers "do not hardcode a fixed number of agents"

This is the most important integration for UCI's stated direction — *"many agents, all with small
deep tasks."* Prime's own insight is the key: **do not turn everything into an LLM agent.** UCI
generalizes **agent → Cognitive Process**, and makes the taxonomy **open and extensible**, not a
fixed roster of N.

**Status: `RESEARCH FRONTIER`.** Grounded in existing code: `CognitiveUnit` (the ABI) and the
`FiberRoutine`/`ExecutionEngine` fibers ([`packages/execution/src/fiber.ts`](../../../packages/execution/src/fiber.ts))
are already the two weights of "process" — heavy (a full unit) and light (a fiber). This primitive
names and unifies them.

```
CognitiveProcess  (open set — new kinds added by ADR, never a hardcoded enum)
├── Agent               ← full autonomous unit (Constitution + Policy); the SMALL, persistent set
├── ResearchTask        ┐
├── VerificationTask    │
├── Simulation          │  the LARGE, mostly-ephemeral set: "small deep tasks."
├── RetrievalJob        │  Most are NOT autonomous agents — many are deterministic,
├── ReflectionJob       │  a DB query, a simulator, a specialist model, or a human.
├── MemoryConsolidation │
├── RepresentationJob   │
└── AutonomousProject   ┘
```

All share one contract — **lifecycle · identity · capability envelope · budget · state ·
observability · provenance · cancellation · scheduling · typed messaging** — but **not all need
agentic autonomy.** This is the architecture that makes "many small deep tasks" safe: they are
*processes*, most of them lightweight and cheap, not a swarm of autonomous LLM agents.

**Reconciling with [`05` §3](05-society-and-formation.md#3-the-society-fixed-roster-now-dynamic-formation-later).**
The earlier caution — "a fixed roster beats a dynamic swarm of stateless agents for years" — stands,
but is now precisely scoped: it is a caution about **autonomous *agent* formation**, not about
processes. The corrected position:

- **Autonomous agents** (own Constitution + Policy + accumulation): a *small, curated, persistent*
  set. Spawning new *kinds* of autonomous agent stays governed and `LONG-HORIZON`.
- **Cognitive processes** (retrieval, verification, simulation, reflection, consolidation,
  representation…): an *open, large, mostly-ephemeral* set, dynamically composed per problem. This is
  where "many small deep tasks" lives, and it is *not* the swarm-of-agents anti-pattern — because most
  processes are not agents at all.

So the taxonomy is **not hardcoded**: the runtime hosts an extensible registry of process *kinds*;
new kinds arrive by ADR + manifest, and instances are composed dynamically. The "23 manifests" of
today ([`01` §2](01-current-architecture-and-gap.md#2-the-catalog-how-many-agents-how-alive)) become
the *seed* persistent-agent set, not the ceiling.

---

## 4. New primitive — Recursive Cognitive Invocation (generalized RLM)

**Status: `RESEARCH FRONTIER`.** UCI does **not** implement Prime's `rlm()` literally. It abstracts
the value: a running process can, based on the problem's *cognitive decomposition*, dynamically spawn
child processes, keep working while they run asynchronously, and communicate with them through
**explicit typed messages — never by dumping a giant result back into the parent's context**.

```
  Problem
    ↓  the process asks: "what cognitive decomposition does THIS need?"
    ↓  (not a fixed Planner→Researcher→Reviewer pipeline)
  spawn (governed, budgeted, admission-handled):
     literature-investigator · contradiction-analyst · simulation-specialist ·
     mathematical-verifier · representation-specialist · learner-model-diagnostician · …
    ↓  children run async in their own workspaces
    ↓  results return as typed messages (a claim, an artifact, a verdict) — NOT raw context
  parent continues, integrating messages as they arrive
```

Grounded in existing code: the `ExecutionEngine`'s fiber `emit`/`awaitValue` bridge and the fibered
learning loop already demonstrate async child work resolved by token — Recursive Cognitive Invocation
generalizes that to typed process spawning. Governance is non-negotiable: spawn depth and fan-out are
hard-capped, every spawn is an event, budgets are enforced, and a spawned process inherits a
*narrowed* capability envelope (never wider than its parent's) — the
[dynamic-formation safeguards](05-society-and-formation.md#32-dynamic-agent-formation--long-horizon-vision-with-a-hard-warning)
apply to autonomous children; lightweight processes are cheaper but still budgeted.

**Explicit epistemic boundaries (a security + contamination primitive).** A child does not inherit its
parent's whole view. Every spawn declares a *controlled epistemic boundary* — what the child may and
may not read:

```
spawn(objective, role, model, budget, output_contract,
      can_read:    [research:R-*, sources:/src/auth/**],
      cannot_read: [private-memory, user-private objects, unrelated goals])
```

This is the read-side of the capability envelope, and it does double duty: it is *privacy*
enforcement (a verification child never sees user-private memory it doesn't need) and
*contamination* containment (a child working from a narrow, declared slice cannot silently import a
poisoned belief from elsewhere — see [`06` §6.1](06-runtime-data-observability.md#61-cross-agent-epistemic-contamination--the-shadow-side-of-the-shared-substrate)).
Least-epistemic-privilege is the default; widening requires governance.

---

## 5. Programmatic context operations — computation over context, not larger prompts

**Status: `RESEARCH FRONTIER`; direct payoff for CSE (`ARCHITECTURALLY SUPPORTED` there).** RLM's
sharpest empirical lesson: for long-context problems, *compute over the context* (parallel sub-model
scans, structural maps, extraction) beats forcing one model to serially ingest everything — better
results at lower token cost. This is the honest architecture for the CSE PDF problem the founder
cares about:

```
  1,000-page monograph  — do NOT inject pages 1–1000 into a context window
    ↓ structural map
    ↓ parallel per-section cognition (many small RetrievalJob/extraction processes)
    ↓ concept · claim · figure · equation extraction  → cross-section linking
    ↓ contradiction detection → semantic index
  → a PERSISTENT source workspace (CSE)
     ↓ at teach time: current concept → relevant regions → exact anchor → source viewport → Surface
```

The agent never "re-reads the whole PDF." It **navigates a persistent source workspace** — the way a
researcher works with a reference library and working notes. This is exactly the CSE direction
(ADR-0032, ADR-0057) and this synthesis strengthens the case for it: the source environment is a
region of the Cognitive Environment, populated by many small deep-task processes.

### 5.1 The Cognitive Branch — a *third* context mechanism (Context-Folding)

**Status: `RESEARCH FRONTIER`.** There are now three distinct ways to manage context pressure, and
they are not interchangeable:

1. **Persistent memory** (durable state a process reads back later) — [`03`](03-cognitive-state-and-memory.md).
2. **Delegation** (spawn a *separate* process; get a typed message back) — [Recursive Cognitive
   Invocation §4](#4-new-primitive--recursive-cognitive-invocation-generalized-rlm).
3. **Cognitive Branch** — *temporary in-process expansion*: the same process branches into a local
   sub-trajectory, solves a subtask with its own working context, then **folds the branch back**,
   retaining only a concise result and discarding the sub-trajectory's tokens (Context-Folding,
   arXiv 2510.11967, reports much smaller active context at strong long-horizon performance).

```
  global thread
     ├─ branch → investigate X …………… fold → concise result kept, sub-tokens dropped
     ├─ branch → test hypothesis Y …… fold → verdict kept
     └─ continue (active context stayed small the whole time)
```

The distinction matters: **delegation is a different process** (persistent, own identity, message
protocol, contamination boundary); **a branch is the same process temporarily thinking harder** (no
new identity, folds back, nothing to message). Most "go deep on this sub-question then come back"
work is a *branch*, not a spawn — cheaper and simpler, and it keeps the parent's attention clean
without the overhead of a child. A branch is itself a Cognitive Object (foldable, replayable), so the
fold is auditable.

### 5.2 Three forms of compression — never one generic "summarize"

The corpus already forbids silent truncation and requires provenance-preserving summarization
([`03` §3](03-cognitive-state-and-memory.md#3-context-engineering--the-compiler-in-depth)). Sharpen
"summarize" into three distinct, named operations, because they lose different things:

- **Selection** — drop irrelevant material (lossless for what's kept).
- **Condensation** — compress detail while preserving meaning (lossy in detail, not in claim).
- **Abstraction** — fold many episodes into a more general concept (100 debugging events → 20 failure
  patterns → 5 engineering rules). This is where **experience becomes knowledge**, and it is the
  operation ACE's "curation" and [consolidation](04-learning-reflection-evolution.md#4-offline-cognition--scheduling-not-a-new-subsystem)
  actually perform.

Abstraction is the one most systems skip (they only condense), and it is the one that produces
durable competence rather than a shorter transcript.

---

## 6. New primitive — the Cognitive Scheduler & offline/sleep-time cognition

**Status: `SPECIFICATION` (scheduler seed exists) → `RESEARCH FRONTIER` (governed autonomy).**
Grounded in existing code: `DepthScheduler`/`PriorityReadyQueue`
([`packages/scheduler`](../../../packages/scheduler/src/depth-scheduler.ts)) already admit work by
priority; this generalizes them to *when cognition should happen at all*.

Prime's heartbeat/schedule model + Letta's sleep-time compute make background cognition first-class.
[`04` §4](04-learning-reflection-evolution.md#4-offline-cognition--scheduling-not-a-new-subsystem)
already established offline cognition as *scheduling the existing distill pipeline*. The additions
here:

- **A governing Cognitive Scheduler**, not arbitrary agent wake-ups. It reasons about priority · cost ·
  importance · user policy · resource budget · interruptibility · deadline · cognitive relevance
  before allowing background work. UCI cannot let every process wake itself.
- **Three forms of offline cognition** (sharper than "run the model while idle"):
  **Consolidation** (*what happened?*) → **Reflection** (*what does it mean?*) → **Preparation**
  (*what should happen next?*).
- **Hard rules unchanged from [`04` §4](04-learning-reflection-evolution.md#4-offline-cognition--scheduling-not-a-new-subsystem):**
  offline cognition may *propose and record*, never *deploy* without the same governance + calibration
  gates as online change; non-trivial compute or sensitive inference requires explicit revocable
  consent + a budget ceiling; offline products are timestamped and expire (staleness guard).

**Compaction ≠ cognitive termination** (a core invariant, from Prime's long-running-agent model):
when a process's active context is compacted, the *process, workspace, goals, memories, and child
processes persist*. Context compaction is a change of *view*, never an end of *work*. This is what
makes long-horizon cognition real rather than a chat that forgets when the window fills.

**Event-driven cognition, not only scheduled.** A time-based heartbeat ("every 10 minutes") is the
weakest form of background cognition. The Scheduler should primarily wake work on *cognitively
meaningful events* — so the system is responsive to its world, not to a clock:
`on_new_evidence` · `on_memory_conflict` · `on_goal_stall` · `on_external_change` · `on_child_failure` ·
`on_verification_failure` · `on_dependency_change` · `on_deadline_approach` · `on_user_return`. Each
trigger is still admitted through the same priority/cost/consent/budget gate — an event *proposes*
attention; the Scheduler *grants* it. This is what turns "offline cognition" from a cron job into a
system that notices when its beliefs are contradicted or its goals have stalled and acts accordingly.

---

## 7. New primitive — the Cognitive Environment Generator (from Prime general-agent)

**Status: `RESEARCH FRONTIER`.** Prime's general-agent loop — *synthesizer creates task → solver
attempts → difficulty estimated → gate accepts/revises → evolving calibrated task corpus* — turns
evaluation from guesswork into an active experimental system. For UCI's education domain this is a
major upgrade over static curriculum generation:

```
  Learner Belief State  →  uncertainty / knowledge gap
    ↓ Task Synthesizer  → candidate intervention (diagnostic probe, transfer task, counterexample)
    ↓ Evaluator/simulator → calibrated difficulty (empirical, not guessed)
    ↓ deploy to learner → outcome
    ↓ EXTERNAL VERIFIER (not "do you understand?")
    ↓ update Belief State
```

This makes adaptive pedagogy an **active experimental system** and feeds the longitudinal-evaluation
program ([`06` §5](06-runtime-data-observability.md#5-evaluation-deliverable-k--proving-intelligence-accumulates-not-regenerates)).
It belongs to the education domain (`spec/product/domains/education/`), built on this runtime.

**The external-verifier principle, elevated to a UCI law-candidate** (Prime's strongest evaluation
lesson): *do not ask the process whether it succeeded when an external verifier can determine it.*
- Learning: not "do you understand?" — use transfer, prediction, delayed retrieval, application.
- Research: not "is this hypothesis good?" — use evidence, reproduction, simulation, contradiction search.
- Agent evolution: not "did the agent improve?" — use held-out trajectories, pre/post, calibration,
  counterfactual and model-swap tests.
This is the same discipline as the [attribution gate](04-learning-reflection-evolution.md#13-reflection-is-not-learning--the-attribution-gate-between-them):
correlation nominates; external verification promotes.

---

## 8. World models — the process reasons over beliefs about the world, not conversation state

**Status: `RESEARCH FRONTIER` / `LONG-HORIZON`.** Prime Intellect's "True Agents Model the World"
direction aligns with UCI's world-state graph. A long-running process's cognition is:

```
  process cognition = beliefs over world state + goals/commitments + memory + skills + observations
```

For UCI the "world" includes people, projects, knowledge, environment, events, time, causality, and
uncertainty — which is why the [causal/temporal world-model program (R2)](08-roadmap-and-adrs.md#2-research-roadmap-deliverable-g)
and the [Intention/Commitment Graph](03-cognitive-state-and-memory.md#15-the-intention--commitment-graph--research-frontier)
matter. The Cognitive Environment is where that world model lives; the process holds *beliefs over it*,
never a private copy of it (the [shared-substrate discipline](03-cognitive-state-and-memory.md#4-the-learner-model-dual--one-epistemic-substrate-two-faces)).

### 8.1 Task / Harness / Runtime separation — and the trainable cognitive process

**Status: `LONG-HORIZON` (the co-learning part); `SPECIFICATION` (the separation part).** Prime's
`verifiers v1` separates **Taskset** (*what to solve*) · **Harness** (*how to solve it*) · **Runtime**
(*where it executes*), and makes them composable. This maps cleanly onto UCI and gives the "Universal"
in the name real teeth:

```
  Cognitive Objective   (what)   — the goal/commitment
       ↓
  Cognitive Harness     (how)    — Constitution + Adaptive Policy + skills + process topology
       ↓
  Cognitive Runtime     (where)  — the environment + scheduler + governance
       ↓
  Execution Environment (on what)— local · cloud · browser · sandbox · document space · simulation · robot
```

Because these are independent, the *same* cognitive capability can execute across radically different
environments — which is what "infrastructure on which many kinds of cognition run" actually means, vs.
"one agent." It also makes the [Model Router](05-society-and-formation.md#5-model-routing--the-property-that-makes-everything-else-durable)
a *harness* decision, not a fixed agent property.

**The genuinely new research direction — model–harness co-learning.** Prime's own roadmap notes that
today's models were not *trained* for the RLM/Continual-Harness paradigm, so the harness leaves
capability on the table; it expects the large gains from **co-adapting the model and the harness**.
UCI's version is deeper and is a `LONG-HORIZON` research program (R12): make **the cognitive process
itself trainable**, not just the model. Because every cognition step is already an event with
provenance, a trajectory can record *what the process knew, attended to, retrieved, forgot, delegated,
branched, believed, verified, and learned* — a training signal for **when to branch, when to
retrieve, when to delegate, when to verify, when to consolidate, when to stop** — competencies today
supplied by fragile prompts. This is the endpoint the corpus's whole event-sourced, typed-mutation
discipline quietly enables: the substrate that makes cognition *governable and replayable* is the same
substrate that makes it *trainable*. **Hard boundary:** this is research beyond the horizon of the
production roadmap; it must never be an argument for building the runtime before the L2 loop is proven.

---

## 9. The Prime Agent → UCI mapping (accept / reject / generalize / invent)

Not a transcription — a judgment on each mechanism.

| Prime Agent | UCI equivalent | Verdict |
|---|---|---|
| IPython kernel | Cognitive Workspace (typed, governed) | **Generalize** — Python vars → typed cognitive objects; writes are governed mutations |
| RLM `rlm()` | Recursive Cognitive Invocation | **Generalize** — not literal; typed process spawn + message-passing |
| context variable | Cognitive State View (the Compiler's output) | **Adopt** — context is a view, not memory |
| Continual Harness (CRUD self) | Constitution (immutable) + Adaptive Policy (governed) | **Reject the form, keep the substance** — no model-side self-CRUD; governed proposals only |
| prompt note | Cognitive Policy Note (a Policy dimension) | **Adopt, governed** |
| memory (tool-mutated) | Typed memory via Memory Mutation Protocol | **Reject self-edit; adopt the persistence** |
| skill | Cognitive Skill ([`04` §3](04-learning-reflection-evolution.md#3-skills--the-highest-value-highest-risk-primitive)) | **Adopt, deferred** |
| subagent | Cognitive Process (open taxonomy) | **Generalize** — most processes are not agents |
| session tree | Cognitive Process Graph | **Adopt** |
| goal | Goal / [Commitment Graph](03-cognitive-state-and-memory.md#15-the-intention--commitment-graph--research-frontier) | **Generalize beyond Prime** — life/work/research intentions, not just task goals |
| heartbeat / schedule | Cognitive Scheduler | **Generalize** — a *governing* scheduler, not free wake-ups |
| autonomous mode | Governed Autonomous Continuation | **Adopt, hard-gated** |
| compaction | Context Recomposition (≠ termination) | **Adopt as invariant** |
| `/refine` (small, evidence-backed, rollbackable) | Governed Cognitive Evolution ([`04` §5](04-learning-reflection-evolution.md#5-the-evolution-ladder--governed-self-improvement)) | **Adopt + extend** — add scope/evidence/effect/eval/counterevidence |
| verifier | External Cognitive Outcome Verifier | **Adopt as a principle** |
| task generator + corpus | Cognitive Environment Generator | **Adopt for education domain** |
| model | reasoning faculty inside the environment | **Adopt** — model-replaceable, continuity survives swap |

From **ACE**: context *curation ≠ compression* — incremental typed updates (generation → reflection →
curation), never repeatedly rewriting a giant memory summary (which causes context collapse). This is
already the corpus's [demote-not-overwrite](03-cognitive-state-and-memory.md#22-contradiction-handling)
+ [compiler-as-attention](03-cognitive-state-and-memory.md#31-the-compiler-is-an-attention-mechanism-not-a-prompt-assembler)
discipline; ACE names it. **Curation asks "what should matter for this cognitive act?" — not "how do
I make this smaller?"**

From **Generative Agents / Voyager**: extract the *computational primitives* (observation→plan→reflect;
reusable skill library), **reject the simulated-human framing**. Human-likeness must emerge from
*continuity*, not imitation ([`README` thesis](README.md)).

---

## 10. What UCI must NOT take from Prime Agent

- **Its scope.** Prime optimizes bounded coding/research task execution; its state centers on
  sessions, files, tools, goals, subagents. UCI's environment must hold people, learning, knowledge,
  sources, world state, multimodal experience, longitudinal cognition — a *deeper substrate*. Prime
  gives a persistent *execution* environment; UCI needs a persistent *cognitive* environment.
- **Model-side self-modification.** Governed proposals only (§2).
- **Its benchmarks as proof.** Prime's reported results are self-evaluations; its own write-up notes
  no model is trained specifically for the harness. Treat Prime as an **architectural reference, not a
  destination or an evidence base** ([`07`](07-research-landscape.md) maturity discipline).
- **Everything-is-an-agent.** The process taxonomy (§3) exists precisely to avoid this.

---

## 11. Roadmap placement & boundaries

Everything here sits **above** the [L2 pilot](08-roadmap-and-adrs.md#1-production-roadmap-deliverable-f) and must not
precede it. The ordering:

- **L1 already builds the seed:** the Context Compiler is the Workspace's read-view. Build it as
  specified; do not build the full programmable Workspace yet.
- **After L2 proves the loop:** introduce the **Cognitive Process** abstraction by *renaming and
  generalizing* the existing `CognitiveUnit`/fiber split — a refactor, not a new engine — so "many
  small deep tasks" become first-class without a big-bang runtime.
- **Then, incrementally:** programmable Workspace (typed, governed) → Cognitive Scheduler (generalize
  `DepthScheduler`) → Recursive Cognitive Invocation → Environment Generator (education) → world model.

**Do not build** (added to [`08` §4 boundaries](08-roadmap-and-adrs.md#4-implementation-boundaries-deliverable-n--what-to-not-build-yet)):
the full Cognitive Environment Runtime as a greenfield system; a programmable Workspace with
model-side write access; Recursive Cognitive Invocation before spawn-governance + budgets are proven;
any of it before L1.5 (state integrity) and L2 (the loop) pass. The environment is *grown from the
existing substrate*, one governed capability at a time — the corpus's founding discipline, applied to
its most ambitious layer.

---

## 12. The research question this synthesis actually poses

Prime Agent answers "can we build a persistent agent?" — which has precedents now. The deeper UCI
question, which this file exists to frame:

> **Can a persistent cognitive environment let intelligence compound across experiences, processes,
> models, modalities, and time — without losing provenance, calibration, coherence, or human
> control?**

That connects Prime RLM · Continual Harness · MemGPT · ACE · Voyager · Generative Agents ·
sleep-time compute · the [PCI corpus](../persistent-cognitive-intelligence/) · this Living-Agent
corpus · CSE · the Cognitive Surface. The Surface, in this framing, becomes **the human-facing
projection of the Cognitive Environment** — not the substrate, exactly as
[`06` §4](06-runtime-data-observability.md#4-observability--the-cognitive-surface-as-a-cognitive-layer)
already frames it.

The governing instruction is unchanged and non-negotiable: **prove the loop before building the
environment.** This file is the map of where the loop leads, not permission to skip it.

→ Return to the [canonical architecture](02-the-living-agent-thesis.md) or the
[roadmap](08-roadmap-and-adrs.md).
