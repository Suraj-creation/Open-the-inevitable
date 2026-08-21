# 02 — The Living Agent Thesis

*Part of the [Living Cognitive Agents](README.md) corpus. This is the canonical architecture
(Deliverable A). It is a design, not a status report — see [status labels](README.md#status-labels).*

---

## 1. The thesis, stated as a design law

> **An agent's life lives in the substrate, not in the agent.**
> A Living Cognitive Agent is a **stable Constitution** compiled at dispatch time with a **durable,
> versioned, governed Adaptive Policy** and a set of **projections** (memory, self-model, skills,
> relationships) drawn from shared substrate state scoped to `(agentType, learner, tenant)`. The
> agent object itself remains stateless and disposable. Intelligence accumulates in the substrate;
> the agent is the lens through which a slice of it is brought to bear on the task at hand.

Everything else in this corpus is a consequence of that law. It is the single most important
correction to the brief, and it is not a compromise — it is *strictly stronger* than the "stateful
agent" it replaces, for five reasons the brief itself demands elsewhere:

1. **Model independence (brief §19).** If the agent's memory/skills/self-model live inside the agent
   object, they are coupled to a process and, through the prompt, to a model. Externalized to the
   substrate, they survive model upgrades and process restarts *for free* — which is exactly the
   property §19 asks for. You cannot have both "stateful agents" and "model-independent agents"; the
   externalized design is the only one that delivers §19.
2. **Deterministic replay (a UCI law).** Event-sourced external state replays deterministically
   (D2/D3, `uci-architecture.md` §11.3). Mutable state inside a long-lived agent object does not.
3. **One source of truth.** N stateful agents create N potentially-contradictory copies of "the truth
   about this learner." One world-state with N read-only projections cannot contradict itself.
4. **Governability (a UCI law).** A typed mutation through the substrate is governable at the seam
   that already governs every mutation. A field mutated inside an agent is invisible to governance.
5. **Scale.** Stateless agents over shared state scale horizontally without sticky sessions or
   state migration; stateful agents require both. This is what makes "thousands of agents" (brief
   §42) an infrastructure property rather than an operations nightmare.

The behaviour the brief wants — coherent, contextual, experienced, improving — **emerges** from a rich
substrate + a good compiler + a governed learning loop. It does not require the agent to *be* a
persistent object. This is the same move classical operating systems make: a process is ephemeral;
the filesystem, the page tables, and the scheduler's accounting persist. UCI's own
`uci-architecture.md` §1.3 already draws this analogy — this corpus takes it to its conclusion for
agents.

> **The substrate, concretized: the Cognitive Environment ([`09`](09-cognitive-environment-runtime.md)).**
> "The substrate" in this thesis is not merely storage the Compiler reads — it is a persistent,
> *programmable* **Cognitive Environment** the process acts within (query, transform, spawn, continue),
> with the context window as one temporary *view*. And "agent" is one kind of **Cognitive Process**: an
> open, extensible taxonomy in which most processes (retrieval, verification, simulation, reflection,
> consolidation) are *not* autonomous agents — which is how UCI supports *many small deep-task
> processes* without a hardcoded roster or a swarm of agents. `09` is the design bridge from this
> thesis to that runtime; it is subordinate to this document (one concept, one authority) and every
> capability in it is gated research.

## 2. The two-layer identity

The brief's Layer-A / Layer-B split is **correct and adopted**, with one sharpening: Layer B is not
"a second prompt" — it is a **substrate artifact**, versioned and governed like any other.

```
┌──────────────────────────────────────────────────────────────────────┐
│  AGENT = CONSTITUTION (Layer A)  +  ADAPTIVE POLICY (Layer B)           │
│                                                                        │
│  LAYER A — Cognitive Constitution        LAYER B — Adaptive Policy      │
│  ───────────────────────────────         ────────────────────────────  │
│  identity, purpose, mission              learned strategies            │
│  responsibilities, authority             per-learner adaptations       │
│  boundaries, values                      calibration (self-model)      │
│  safety & epistemic constraints          routing/collab preferences    │
│  system invariants                       memory & retrieval policy     │
│                                                                        │
│  • version-pinned                        • versioned per adaptation     │
│  • change = E4/E5 governance event       • change = E0–E3 proposal      │
│  • one per agentType (+tenant overlay)   • scoped (agentType,learner,   │
│  • signed; edits are auditable            tenant); compiled, not mutated│
│                                                                        │
│  "This should not casually change."      "This evolves under governance"│
└──────────────────────────────────────────────────────────────────────┘
```

**Constitution** answers *who this agent is and what it may never do*. It is authored by humans,
signed, and changed only through high-class governance (the E-ladder, [`04`](04-learning-reflection-evolution.md#5-the-evolution-ladder--governed-self-improvement)).
The Explainer's Constitution ("transform knowledge into genuine understanding; never advance mastery
without depth verification; always ground claims in evidence") is stable across years.

**Adaptive Policy** answers *how this agent, for this learner, has learned to do its job better*. It
is authored by the *system*, through the governed learning loop, and is a durable artifact — a
projection/accumulation over the `agent.strategy-outcome` artifacts the plane already records. It is
**never mutated in place**: each adaptation is a new version with provenance, confidence, and an
evaluation record. This is what makes "the agent evolves without corrupting its identity" mechanically
true: the two layers are *different artifacts with different governance classes*, and the compiler
keeps A strictly dominant over B (a Policy may specialize within the Constitution's envelope; it can
never override a constraint).

## 3. The closed cognition loop

This is the architecture in one diagram. **Bold** = exists today; *italic* = the closing move.

```
                         ┌───────────────────────────────┐
                         │   LEARNER / WORLD / TASK        │
                         └───────────────┬───────────────┘
                                         │ intent, packet
                                         ▼
              ┌────────────────── COGNITIVE CONTEXT COMPILER ──────────────────┐
              │  Constitution (A)  +  Adaptive Policy (B, projection)           │
              │  + Learner Belief State (shared)  + relevant Memory (leased)    │
              │  + Skills (retrieved)  + Relationships  + Goals  + World slice   │
              │  + Governance constraints  + Temporal context                   │
              │           ↓ compile (budgeted, provenance-tagged)               │
              │                    Dynamic Agent Context                        │
              └───────────────────────────┬────────────────────────────────────┘
                                          ▼
                    ┌──────── AGENT EXECUTION (stateless) ────────┐
                    │  model routing → **model call** → tool calls │
                    │           → **Reasoning Trace** (C)          │   ← exists
                    └───────────────────────┬─────────────────────┘
                                            ▼
                    **Observation → Evaluation** (Cognitive Eval Layer)   ← exists (ADR-0027)
                                            ▼
                    *reflect(trace) → REFLECTION RECORD*   ← the unplugged ABI hook
                                            ▼
              ┌──────────── **INTELLIGENCE PLANE / distillation** ───────────┐  ← exists,
              │  agent.strategy-outcome · agent.collaboration · episode · …   │    durable
              └───────────────────────────┬─────────────────────────────────┘
                                          ▼
                    *ADAPTATION HYPOTHESIS → proposal*
                                          ▼
              ┌──────── **EVOLUTION ENGINE** (governed) ────────┐   ← exists (PROTOTYPE)
              │  evaluate → shadow → governance → approve         │
              │            → rollout / rollback                   │
              └───────────────────────────┬─────────────────────┘
                                          ▼
                    *new ADAPTIVE POLICY version (B)*  ──────────┐
                                                                 │
                                          ┌──────────────────────┘
                                          ▼  (compiled next dispatch)
                              back to the COMPILER, top of loop
```

Read the arrows: **the left/lower two-thirds already exist and are durable.** The *italic* steps —
`reflect()`, the adaptation hypothesis, the Policy version — are the missing return path. The loop is
not a new machine; it is three wires between machines that are already running.

## 4. The Cognitive Context Compiler

Dynamic System Prompting is **one output** of this compiler, not the source of truth (brief §7,
adopted). The compiler is a pure, deterministic, budgeted function:

```
compile(agentType, task, leases, nowHlc, budget) → DynamicAgentContext
```

Inputs, in strict precedence order (higher wins on conflict; the Constitution is inviolable):

| Precedence | Input | Source | Status |
|---|---|---|---|
| 0 (inviolable) | **Constitution** | agent constitution record | SPECIFIED |
| 1 | **Governance constraints** | governance engine, for this dispatch | IMPLEMENTED |
| 2 | **Task / intent** | cognition packet + intent lease | IMPLEMENTED |
| 3 | **Learner Belief State (relevant slice)** | shared learner model (PCI) | RESEARCH FRONTIER |
| 4 | **Adaptive Policy** | `(agentType, learner, tenant)` projection | RESEARCH FRONTIER |
| 5 | **Retrieved memory** | `ContextAssembler`, lease-bounded | IMPLEMENTED |
| 6 | **Retrieved skills** | skill library (when it exists) | SPECIFIED |
| 7 | **Relationships** | collaboration graph | RESEARCH FRONTIER |
| 8 | **World-state slice + temporal context** | world-state graph | IMPLEMENTED |

Three properties are non-negotiable:

1. **Budgeted.** The compiler takes a token budget (the context window is finite; brief §10). It does
   not "retrieve top-k" — it *fills a cognitive budget by precedence*, dropping the lowest-precedence
   items first and **reporting what it dropped** (the `ContextAssembler` already reports
   `droppedForBudget`/`excludedByLease` — this generalizes it). The objective, verbatim from the
   brief: *construct the cognitive context required for this agent to perform its responsibility
   correctly right now.*
2. **Provenance-tagged.** Every element carried into context records *why it was included* (which
   policy, which memory, which relationship), so observability can answer "which memory influenced
   this decision" ([`06`](06-runtime-data-observability.md#4-observability--the-cognitive-surface-as-a-cognitive-layer)). This is what makes the
   Cognitive Surface a *cognitive observability layer* (brief §26) rather than a renderer.
3. **Constitution-dominant.** No lower-precedence input may contradict the Constitution. A Policy that
   proposes "skip prerequisites for this fast learner" is *rejected at compile time* if the
   Constitution forbids acceleration-by-omission. This is the mechanical guarantee that adaptation
   cannot corrupt identity.

The compiler is **ARCHITECTURALLY SUPPORTED**: `ModelBackedUnit` already assembles a prompt from
manifest + packet; the compiler generalizes that assembly, adds the precedence/budget/provenance
discipline, and reads Policy + Belief State. It is the *first* thing to build because everything else
flows through it.

## 5. What is genuinely agent-owned vs. projected (the anti-noun-table discipline)

The brief lists ~24 candidate "Agent*" primitives (§8, §32) and then warns: *do not create a table
per noun.* This corpus honours that. The test for a first-class agent-owned primitive is:

> **Is this state (a) about the agent itself, (b) not derivable as a projection of shared state, and
> (c) does persisting it create future cognitive value the substrate does not already hold?**

Applying the test:

| Candidate | Verdict | Why |
|---|---|---|
| Adaptive Policy | **First-class, agent-owned** | About the agent; accumulates; not derivable |
| Self-Model | **Projection** (materialize + cache) | Derivable from `agent.strategy-outcome`; cache for speed |
| Skill | **First-class, agent-owned** | Procedure + evidence; not derivable; high value (and high risk) |
| Relationship | **First-class** (but per-pair, tenant-level) | Accumulated interaction evidence; not derivable |
| Reflection Record | **Event** (not a table) | It is an emission; it flows to the plane and evolution |
| Beliefs / hypotheses / uncertainty *about the learner* | **Projection of the shared Learner Belief State** | Owned by PCI; agent reads, never owns |
| Goals | **Projection of the Intent Lease + learner goals** | Already a substrate primitive |
| World model | **Shared world-state graph** | Already exists; agent reads a slice |
| Experience / trajectory / interaction history | **The event log + intelligence artifacts** | Already durable; do not re-persist |
| Constitution | **First-class** (but per-agentType, human-authored) | Governed identity |

Net new persisted primitives: **four** — Constitution, Adaptive Policy, Skill, Relationship — plus one
event (Reflection Record) and one *cached projection* (Self-Model). Everything else the brief names is
already in the substrate or is a projection of it. This is the discipline that keeps the architecture
implementable rather than a schema explosion.

## 6. The maturity ladder (Deliverable — agent evolution model)

The brief's Stage 0–10 ladder conflates independent axes and should be refactored. An agent's maturity
is not one number; it is a point in a **3-D space**. (The review round proposed a linear
Persistent→Adaptive→Reflective→Intentional→Situated→Social→Experimental→Research ladder; that linear
form is rejected for the same reason the brief's was — maturity is not one number — but it correctly
exposed a *third axis* the original 2-D version buried: **Horizon**. "Intentional" and "Situated" are
neither pure statefulness nor pure sociality; they are temporal/contextual reach.)

- **Statefulness axis** (how much durable cognition the agent draws on): Stateless → Contextual →
  Experienced → Adaptive → Self-Reflective.
- **Sociality axis** (how it operates with others): Solo → Collaborative → Society-Embedded →
  Self-Organizing.
- **Horizon axis** *(the third dimension the review surfaced)* (how far across time and context it
  reasons): Reactive → **Intentional** (maintains goals/hypotheses/open work across sessions —
  the [Intention Graph](03-cognitive-state-and-memory.md#15-the-intention--commitment-graph--research-frontier))
  → **Situated** (maintains an evolving model of the user, environment, and context — the
  multimodal/ambient future) → Research-capable (sustained inquiry under governance).

```
  Sociality
     ▲
  Self-Organizing │                                  ⑩ UCI Agent
                  │                          ⑧ ───────┘  (research-capable,
  Society-        │                  ⑦ ──────┘            self-improving)
  Embedded        │          ⑥ ──────┘
                  │   ⑤ ─────┘
  Collaborative   │ ④┘
                  │③
  Solo            │②  ← UCI TODAY (Contextual, Solo→Collaborative via supervisor)
                  │①
                  └①──②──③──④──⑤──────────────────────►  Statefulness
                   Stateless  Experienced  Adaptive  Self-Reflective
```

*(The diagram shows the Statefulness × Sociality plane at **Horizon = Reactive**, where UCI lives
today. The Horizon axis extends orthogonally: the **Intentional** stage adds the
[Intention Graph](03-cognitive-state-and-memory.md#15-the-intention--commitment-graph--research-frontier)
(R7), **Situated** adds the evolving user/environment model (the multimodal future, R5), and
**Research-capable** adds the [Epistemic Workspace](05-society-and-formation.md#7-the-epistemic-workspace--collective-inquiry-state)
and autonomous inquiry (R6/R8). UCI is Reactive today; nothing on the Horizon axis is near-term.)*

**UCI today sits at roughly (Contextual, Solo-to-Collaborative, Reactive)** — marked ②. Agents
receive rich task context and are routed by a supervisor, but hold no experience, adapt via one shared
scalar, and maintain no intention across sessions. The program is a walk *up, right, and eventually
outward on Horizon*, one governed capability at a time. The stages, with the single most important
prerequisite and risk for each:

| Stage | Name | Defining capability | Prereq | Dominant risk | Status |
|---|---|---|---|---|---|
| 0 | Stateless | prompt + model + tools | — | — | (below UCI) |
| 1 | Contextual | rich compiled context, no memory | Context Compiler | context contamination | ARCHITECTURALLY SUPPORTED |
| 2 | **Experienced** | reads its own durable experience | Reflection Record + Policy read | false memory / poisoning | RESEARCH FRONTIER |
| 3 | Adaptive | per-learner governed Policy influences behaviour | Layer-2 calibration gate | over-personalization | RESEARCH FRONTIER |
| 4 | Self-Reflective | calibrated self-model routes deferral | self-model calibration | mis-calibrated confidence | RESEARCH FRONTIER |
| 5 | Skilled | first-class skills, composed & retired | skill governance | skill drift / reward hacking | RESEARCH FRONTIER |
| 6 | Society-Embedded | evidence-based trust shapes routing | relationship calibration | agent collusion | RESEARCH FRONTIER |
| 7 | Self-Organizing | dynamic team formation for novel tasks | capability discovery + resource governance | runaway spawning | LONG-HORIZON |
| 8 | Research-Capable | governed autonomous inquiry loop | verification + human gate | fabricated discovery | LONG-HORIZON |

Note there is no "Stage 10 — UCI Agent" as a distinct capability; "UCI Agent" is the *whole system*
operating at high stages across many agents, not a new agent kind. The brief's Stage 10 is a category
error (an agent is not the infrastructure); this corpus drops it.

**Discipline:** UCI should not attempt Stage 3 before Stage 2 is proven, and must never let a stage
route (influence a live dispatch) before its calibration gate passes. Recording is cheap and safe;
*routing on uncalibrated belief is the failure mode that makes personalization dangerous.* The
ordering is not a roadmap convenience — it is a safety property.

## 7. Why this is the right architecture even if models get far more capable (brief §51)

The externalized design is *more* valuable as models improve, not less:

- A more capable model still cannot remember across sessions without external state — the memory
  problem is not solved by scale, it is orthogonal to it. Externalized memory is the durable answer.
- A more capable model makes the *compiler* more valuable, because a better model does more with a
  well-constructed context and is more damaged by a poorly-constructed one.
- Model-independence means a decade of accumulated learner Belief State, agent Policy, and skills
  *survives every model swap*. The thing that compounds is the substrate, precisely because it is not
  the model. This is the answer to the brief's deepest question: **intelligence accumulates in the
  substrate; the model is a replaceable faculty that the substrate wields.**

> **Honest boundary (corrected by the research landscape, [`07` §3](07-research-landscape.md#3-continual--lifelong-learning--model-independent-state-angle-3)).**
> Externalizing state does **not** *eliminate* the stability–plasticity dilemma (catastrophic
> forgetting) — it **relocates** it from the weights (opaque, un-governable, catastrophic) to
> *retrieval-time competition* between old and new memories (inspectable, governable, gradual). That
> is a strictly *better place to fight the problem*, not a place where it disappears. This is exactly
> why the [Context Compiler's budgeted precedence](#4-the-cognitive-context-compiler) and the
> [forgetting/demotion policy](03-cognitive-state-and-memory.md#21-memory-lifecycle--capture--promote--forget)
> are load-bearing, not peripheral: they *are* where the relocated forgetting problem now lives, and
> the research (JitRL; "When Continual Learning Moves to Memory"; "Useful Memories Become Faulty When
> Continuously Updated") says it must be engineered explicitly, never assumed away.

→ Continue to [`03` — cognitive state, memory & context](03-cognitive-state-and-memory.md).
