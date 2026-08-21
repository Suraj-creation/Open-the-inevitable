# Living Cognitive Agents — A Research Program for the UCI Agent Runtime

**Status:** Research proposal (Research Layer). **Not adopted law.** Nothing here modifies the
production codebase. Adoption of any primitive proposed here is gated on a per-capability ADR plus,
where the primitive is probabilistic, the Cognitive Evaluation Layer's calibration harness
(ADR-0023 Layer 2; ADR-0027). See [§Adoption gate](#adoption-gate).

**Constitutional placement.** This corpus obeys `CLAUDE.md`: it is *research beside product*, and it
becomes UCI architecture only through the one door — an ADR. It labels every capability with a truth
status and never lets aspiration read as implementation. Its architectural home, once adopted, is
`spec/architecture/uci-architecture.md` (Part II/III); until then it lives here.

**Provenance.** Produced by a repository-wide investigation (agent runtime, memory, world-state,
intelligence plane, governance, evolution, the digital twin, and the existing
[persistent-cognitive-intelligence](../persistent-cognitive-intelligence/) corpus) cross-checked
against a 2024–2026 external-research sweep. Every claim about *what exists today* is cited to a
file, type, or ADR ([`01-current-architecture-and-gap.md`](01-current-architecture-and-gap.md)).
Every claim about the external frontier is cited to an author/year
([`07-research-landscape.md`](07-research-landscape.md)).

---

## The one-paragraph thesis

The originating brief asks how to turn UCI's agents from stateless task-executors that "die after each
task" into **Living Cognitive Agents** with persistent identity, memory, skills, self-models,
relationships, and governed self-improvement. The investigation confirms the *problem* is real but
**corrects the proposed solution in one decisive way**: do **not** make agents stateful entities that
carry their life inside themselves. UCI already made the harder, better choice — **cognitive state is
externalized to the substrate** (world-state graph, tiered memory, the durable intelligence plane,
the event log) and agents are *stateless projections over shared state*. That choice is what buys
model-independence, deterministic replay, one-source-of-truth consistency, and governability — all of
which per-agent internal state would destroy. The correct target is therefore not a *stateful agent*
but a **stateful substrate with experienced agent projections**: a stable **Cognitive Constitution**
(tightly-governed identity) compiled at dispatch time together with a durable, versioned, governed
**Adaptive Policy** — the agent's learned strategies, self-model, skills, and relationships, all held
as first-class substrate artifacts scoped to `(agentType, learner, tenant)`, never as fields inside a
long-lived object. The decisive finding that makes this tractable: **the loop is already ~80% built
and simply left open.** The intelligence plane *already distills* `agent.strategy-outcome` and
`agent.collaboration` artifacts durably at session close
([distillers.ts:273,307](../../../packages/intelligence/src/distillers.ts)); the context assembler
*already* does lease-bounded retrieval; the `EvolutionEngine` *already* runs a governed
propose→evaluate→shadow→approve→rollout→rollback lifecycle
([evolution.ts](../../../packages/orchestration/src/evolution.ts)). What is missing is the *return
path*: **no agent ever reads its own accumulated experience** — `reflect()`, `checkpoint()`, and
`restore()` are declared in the Cognitive Unit ABI and **never called** anywhere in the codebase
([abi.ts:40–49](../../../packages/runtime/src/abi.ts)). The Living Agent program, in its first
production layer, is therefore not a rewrite but **closing that loop**: a `reflect()` step that emits
governed learning, an **Agent Policy** projection over the artifacts the plane already records, and a
**Cognitive Context Compiler** that folds Constitution + Policy + task + learner-state + memory into
the model call that today is a flat template. Everything beyond that — offline cognition, agent
societies with evidence-based trust, dynamic team formation, autonomous research — is a disciplined
extension of the same closed loop, not a parallel invention.

---

## The three corrections this corpus makes to the brief

The brief (§50) explicitly invites challenge. Three of its framings are corrected here, each with
architectural consequence:

1. **"Make each agent a stateful entity with its own memory/beliefs/skills."** → **Corrected.** Build
   a stateful *substrate*; agents stay stateless projections. Per-agent internal mutable state breaks
   model-independence (§19 of the brief — which the brief itself wants), replay, and consistency. The
   "Living Agent" is `Constitution + AdaptivePolicy(projection)`, compiled per dispatch. See
   [`02`](02-the-living-agent-thesis.md).

2. **"Give each agent beliefs, hypotheses, goals, uncertainty as first-class agent state."** →
   **Mostly corrected.** Beliefs/hypotheses/uncertainty *about the learner* belong in the shared
   **learner Belief State** (the dual primitive already proposed by the
   [PCI corpus](../persistent-cognitive-intelligence/)), projected into every agent — not copied into
   each. Only three things are genuinely agent-owned: its **Adaptive Policy**, its **Self-Model**, and
   its **Skills**. Creating a table per noun is the anti-pattern the brief itself warns against (§8,
   §32). See [`03`](03-cognitive-state-and-memory.md).

3. **"Agent Sleep / Offline Cognition as a new subsystem."** → **Corrected.** The mechanism already
   exists — distillation at session close is offline consolidation. Offline cognition is *scheduling*
   the existing distill → evaluate → propose pipeline as a governed background job, not a new
   subsystem. See [`04`](04-learning-reflection-evolution.md).

A fourth, unifying correction: the **learner Belief State** (PCI) and the **agent Self-Model/Policy**
are *duals* — both are "persistent, probabilistic, provenance-bearing state with calibrated
uncertainty." They must share one primitive family (Evidence → State → Uncertainty + calibration),
not two parallel uncertainty stacks. This corpus and the PCI corpus therefore converge on a common
epistemic substrate.

---

## Review round: what was accepted and what was not

A critical review of the first draft was evaluated proposal-by-proposal, on merit — *not* accepted
wholesale. The discipline: **accept the substance where it is genuinely deep; reject the *form* where
it would violate the corpus's own laws** (no new store per noun; one concept, one authority; nothing
in the production path un-gated). The record:

| Review proposal | Verdict | What actually changed |
|---|---|---|
| State Ownership Matrix | **Accepted (improved)** | Added to [`03` §0](03-cognitive-state-and-memory.md#0-the-state-ownership-matrix--one-authority-per-kind-of-truth) with an *invalidation/replay* column the proposal omitted (the hard part) |
| Intention / Commitment primitive | **Accepted, reframed** | Added as a **World-State projection** (not an agent-private store) unifying with Intent Lease + PCI `CognitiveGoal` — [`03` §1.5](03-cognitive-state-and-memory.md#15-the-intention--commitment-graph--research-frontier) |
| Intervention Graph / credit assignment | **Substance accepted, form rejected** | No new store; instead an **attribution gate** + promotion-requires-isolation rule on the existing `intervention-outcome` artifact — [`04` §1.3](04-learning-reflection-evolution.md#13-reflection-is-not-learning--the-attribution-gate-between-them) |
| Reflection ≠ learning (counterfactual step) | **Accepted (sharpening)** | The attribution gate is exactly this: hypothesis → counterfactual isolation → learning candidate → proposal |
| Epistemic Workspace | **Accepted, reframed + deferred hard** | Not a fourth store; the **collective projection of Claim Graph + Intention Graph** — [`05` §7](05-society-and-formation.md#7-the-epistemic-workspace--collective-inquiry-state) |
| Predictive observability / health monitoring | **Accepted** | Added leading-indicator metrics reconnecting the merged Cognitive Health Monitor — [`06` §4.1](06-runtime-data-observability.md#41-predictive-observability--cognitive-health-monitoring) |
| Compiler as attention (not prompt assembler) | **Accepted (substantive part)** | Counter-evidence inclusion + stale-state suppression + contradiction surfacing as first-class compiler duties — [`03` §3.1](03-cognitive-state-and-memory.md#31-the-compiler-is-an-attention-mechanism-not-a-prompt-assembler) |
| Phase L1.5 — Cognitive State Integrity | **Strongly accepted** | New gate before L2; grounded in the real substrate gaps (world-state still JSON) — [`08`](08-roadmap-and-adrs.md#1-production-roadmap-deliverable-f) |
| Cross-agent contamination + quarantine | **Accepted** | Named as the shadow side of the shared-substrate thesis; lineage + quarantine + lineage-scoped rollback — [`06` §6.1](06-runtime-data-observability.md#61-cross-agent-epistemic-contamination--the-shadow-side-of-the-shared-substrate) |
| 3 further open problems (context bottleneck, goal drift, distribution shift) | **Accepted** | Added as [open problems #9–12](08-roadmap-and-adrs.md#5-open-problems-deliverable-l--the-deepest-unresolved-questions) |
| Linear 8-stage maturity ladder | **Partially accepted** | Kept the multi-axis rigor; absorbed the genuine gap as a **third (Horizon) axis** — [`02` §6](02-the-living-agent-thesis.md#6-the-maturity-ladder-deliverable--agent-evolution-model) |
| Numeric scorecard | **Noted, not enshrined** | Directional only; the *pattern* (weak on long-horizon/situated/research) was a fair read and drove the additions above |

The unifying theme of the review — and it is correct — is that the first draft was strong on *the
agent that remembers and adapts* (Statefulness) and thin on *the agent that maintains intention,
models its situation, and participates in collective inquiry* (the Horizon axis). Every acceptance
above strengthens that axis **without** touching the production first slice (L2 stays one agent, one
dimension). *Prove the loop before expanding the vision* remains the governing instruction.

---

## Reading order

| # | Document | Covers |
|---|---|---|
| 00 | **README** (this file) | Map · thesis · corrections · primitive summary · adoption gate |
| 01 | [`01-current-architecture-and-gap.md`](01-current-architecture-and-gap.md) | What exists today (evidence-cited) · limitations of the stateless/prompt-centric agent · the gap analysis (Deliverable C) |
| 02 | [`02-the-living-agent-thesis.md`](02-the-living-agent-thesis.md) | Design philosophy · Constitution + Adaptive Policy · the closed cognition loop · the Cognitive Context Compiler · maturity ladder |
| 03 | [`03-cognitive-state-and-memory.md`](03-cognitive-state-and-memory.md) | Agent cognitive-state primitives (what is genuinely first-class) · memory architecture · context engineering · the learner-model dual |
| 04 | [`04-learning-reflection-evolution.md`](04-learning-reflection-evolution.md) | The learning loop · self-model & metacognition · skills · reflection · offline cognition · governed evolution ladder |
| 05 | [`05-society-and-formation.md`](05-society-and-formation.md) | Relationships & evidence-based trust · disagreement · multi-agent society · dynamic team formation · model routing |
| 06 | [`06-runtime-data-observability.md`](06-runtime-data-observability.md) | Runtime · data model · events/protocols · observability · evaluation & benchmarks · failure modes · safety/privacy/security |
| 07 | [`07-research-landscape.md`](07-research-landscape.md) | The external frontier that informs this (Deliverable B), cited — *populated from deep-research run `wf_05c83541-7a4`* |
| 08 | [`08-roadmap-and-adrs.md`](08-roadmap-and-adrs.md) | Production roadmap · research roadmap · ADR candidates · open problems · implementation boundaries · glossary |
| 09 | [`09-cognitive-environment-runtime.md`](09-cognitive-environment-runtime.md) | The Prime-Agent synthesis: Cognitive Environment/Workspace · **agent → open Cognitive Process taxonomy** · Recursive Cognitive Invocation · programmatic context ops · Cognitive Scheduler · Environment Generator · the accept/reject/generalize/invent mapping |
| 10 | [`10-master-cognitive-architecture.md`](10-master-cognitive-architecture.md) | **The implementation-architecture capstone.** Whole-system current→target map (code-grounded) · the three-layer agent society (permanent core / domain societies / dynamic formation) · archetype+skill+formation model · AgentDefinition · deliverable ownership index · the disciplined build order (loop before society) · the walking-skeleton methodology + four-measurement L2 gate |
| 11 | [`11-cognitive-harness-runtime.md`](11-cognitive-harness-runtime.md) | **The DeepSeek-Harness synthesis.** What dsh actually is (from source) · DeepSeek→UCI mapping (keep/generalize/wrap/reject) · the Cognitive Harness · capability seams + protected kernel · durable-vs-live events · the ContextManifest + reconstruction law · the cognitive action pipeline · transactional formation · the dsh reference-only strategy. Seed built in [`@inevitable/cognitive-loop`](../../../packages/cognitive-loop) |

**If you read one thing:** [`02`](02-the-living-agent-thesis.md) is the canonical architecture and
[`01`](01-current-architecture-and-gap.md) is why it is shaped that way. **For the whole-system
implementation plan** — current→target map, the three-layer society, and the disciplined build order —
read [`10`](10-master-cognitive-architecture.md), the capstone that ties this corpus to the actual
code and the roadmap.

---

## The proposed primitives (summary)

Only primitives that create *future cognitive value not already captured* are proposed. Each carries a
status label (see [§Status labels](#status-labels)) and its full treatment lives in the linked file.

| Primitive | One-line role | Genuinely new? | Status |
|---|---|---|---|
| **Agent Constitution** | Tightly-governed identity: purpose, responsibilities, authority, constraints, invariants. Version-pinned; changing it is an E4/E5 governance event. | Formalizes what is today an ungoverned string (`manifest.role`) | SPECIFIED |
| **Agent Adaptive Policy** | Durable, versioned, governed record of learned strategy, calibration, and preferences, scoped `(agentType, learner, tenant)`. Compiled into context; never mutated in place. | **New** — replaces the single system-wide `depthBias` | RESEARCH FRONTIER |
| **Agent Self-Model** | Calibrated competence map: where this agent succeeds/fails/should defer, per task-type and domain. A projection over `agent.strategy-outcome` artifacts. | Projection of existing artifacts + calibration | RESEARCH FRONTIER |
| **Agent Skill** | First-class, versioned, evidence-bearing procedure with success/failure statistics; retrievable, composable, retirable. | **New** — capabilities today are inert strings | RESEARCH FRONTIER |
| **Cognitive Context Compiler** | The function that composes Constitution + Policy + task + learner-state + memory + skills + relationships → the model invocation. | Replaces today's flat prompt template | ARCHITECTURALLY SUPPORTED |
| **Agent Relationship** | Evidence-based collaboration record between agent types (interactions, resolutions, contradictions, escalations). Influences routing. | **New** — no inter-agent state today | RESEARCH FRONTIER |
| **Learner Belief State** | The shared, probabilistic, provenance-bearing model of the learner that every agent projects from. | Owned by the [PCI corpus](../persistent-cognitive-intelligence/); referenced, not duplicated | RESEARCH FRONTIER |
| **Reflection Record** | The governed output of a `reflect()` step: observation → inference → hypothesis → proposed adaptation, with provenance and confidence. | **New** — `reflect()` exists but is never called | SPECIFIED |
| **Intention / Commitment Graph** | Persistent forward-looking state: goals, hypotheses, open questions, plans — with expiry, supersession, first-class abandonment. A **World-State projection**, pursued under Intent Leases. | **New** (review round) — unifies with the Intent Lease + PCI `CognitiveGoal`; the substrate for cross-session inquiry | RESEARCH FRONTIER |
| **Cognitive Environment / Workspace** | The substrate seen as a *programmable, typed environment* a process acts within — the concretization of "the substrate," not a store the Compiler merely reads. Every write is a governed mutation; the base Constitution is immutable to the process. | **New** ([`09`](09-cognitive-environment-runtime.md)) — unifies world-state + memory + intelligence plane + event log as a place | RESEARCH FRONTIER |
| **Cognitive Process** | The generalization of "agent": an *open, extensible* taxonomy (Agent, ResearchTask, VerificationTask, Simulation, RetrievalJob, ReflectionJob, Consolidation, RepresentationJob, AutonomousProject) sharing one lifecycle/identity/budget/observability contract. **Most are not autonomous agents.** | **New** ([`09`](09-cognitive-environment-runtime.md)) — generalizes `CognitiveUnit` + fibers; the answer to "many small deep-task agents, not a hardcoded roster" | RESEARCH FRONTIER |
| **Cognitive Object** | Every unit of cognition (hypothesis, decision, evidence, goal, …) as a stable-id, versioned, related, governed object — *object-centric, not session-centric*. Unifies the State Ownership Matrix + Claim Graph + Intention Graph under one identity principle. | **New** ([`09 §2.1`](09-cognitive-environment-runtime.md#21-the-cognitive-object--object-centric-not-session-centric-the-deepest-correction)) — a world-state projection, not a new store | RESEARCH FRONTIER |
| **Cognitive Branch** | Temporary *in-process* expansion (branch → solve subtask → fold back a concise result) — a third context mechanism distinct from persistent memory and from delegation. | **New** ([`09 §5.1`](09-cognitive-environment-runtime.md#51-the-cognitive-branch--a-third-context-mechanism-context-folding)) — Context-Folding, foldable/replayable | RESEARCH FRONTIER |

Reused as-is (no new primitive): Cognition Packet, Cognitive Event, Memory Mutation, World-State
Delta, Reasoning Trace, Capability Envelope, Context/Intent Lease, Intelligence Artifact, Claim Graph,
the `EvolutionEngine` lifecycle, the Governance Engine. **The substrate is already rich; the program
is mostly about connecting what exists.**

**Governing reference:** the [State Ownership Matrix](03-cognitive-state-and-memory.md#0-the-state-ownership-matrix--one-authority-per-kind-of-truth)
(one canonical owner + one write path + one invalidation/replay rule per kind of cognitive state) is
the single table the whole corpus is accountable to — the operational form of *one concept, one
authority*.

**What the review round added (2026-08-20).** A critical read of the corpus was evaluated on merit —
some proposals accepted, some rejected in *form* while accepted in *substance*, per
[§Review round](#review-round-what-was-accepted-and-what-was-not). The net additions, all
`RESEARCH FRONTIER`/`LONG-HORIZON` and outside the L2 first slice: the **Intention/Commitment Graph**
(the "Intentional" horizon), the **State Ownership Matrix**, the **attribution gate** between
reflection and learning ([`04` §1.3](04-learning-reflection-evolution.md#13-reflection-is-not-learning--the-attribution-gate-between-them)),
the **compiler-as-attention** duties incl. counter-evidence inclusion
([`03` §3.1](03-cognitive-state-and-memory.md#31-the-compiler-is-an-attention-mechanism-not-a-prompt-assembler)),
the **Epistemic Workspace** ([`05` §7](05-society-and-formation.md#7-the-epistemic-workspace--collective-inquiry-state)),
**predictive health monitoring** + **contamination-propagation semantics**
([`06` §4.1](06-runtime-data-observability.md#41-predictive-observability--cognitive-health-monitoring),
[§6.1](06-runtime-data-observability.md#61-cross-agent-epistemic-contamination--the-shadow-side-of-the-shared-substrate)),
the **L1.5 Cognitive-State-Integrity gate**, and a **third (Horizon) axis** on the maturity ladder.

**What the Prime-Agent round added (2026-08-20).** A cross-read of Prime Agent (RLM + Continual
Harness + general-agent), ACE, MemGPT, Voyager, Generative Agents, and sleep-time compute yielded
[`09`](09-cognitive-environment-runtime.md). Its lesson *sharpens* the thesis rather than replacing
it: **move intelligence into a persistent, programmable Cognitive Environment; the context window is
one temporary view.** Net additions, all `RESEARCH FRONTIER`/`LONG-HORIZON`, all subordinate to the
externalized-state law: the **Cognitive Environment/Workspace** and the **open Cognitive Process
taxonomy** (the architectural answer to *"many small deep-task agents, not a hardcoded roster"* —
agent ⊂ process, most processes not autonomous), **Recursive Cognitive Invocation**, **programmatic
context operations** (compute over context, not larger prompts — direct CSE payoff), the **Cognitive
Scheduler**, the **Cognitive Environment Generator** (active experimental pedagogy), and the
**compaction ≠ termination** invariant. UCI **rejects** Prime's model-side self-editing harness
(governed proposals only) and its benchmarks-as-proof; it *generalizes* the rest. The governing
instruction is unchanged: **prove the loop (L2) before building the environment.**

A **second, deeper Prime-Agent pass** (2026-08-20) was evaluated strictly for *net-new depth* — most
of it was already covered by `09` and not re-added. The five genuine additions: the **Cognitive
Object** (object-centric addressability — the deepest), the **Cognitive Branch** (Context-Folding, a
third context mechanism), **Task/Harness/Runtime separation + model–harness co-learning** (`09 §8.1`,
the "trainable cognitive process" `LONG-HORIZON` direction), the **Longitudinal Cognitive Task**
flagship benchmark ([`06 §5.4`](06-runtime-data-observability.md#54-the-flagship-benchmark--the-longitudinal-cognitive-task)),
and sharpenings (event-driven scheduler triggers, child epistemic read-boundaries, three forms of
compression). Everything else in that pass was already present.

---

## Status labels

Per the brief (§40) and mapped to the `CLAUDE.md` §2 truth model:

| Label (this corpus) | Meaning | `CLAUDE.md` truth-model equivalent |
|---|---|---|
| **IMPLEMENTED** | Real code on a product path, verified | PRODUCTION / PRODUCTION VERIFIED |
| **ARCHITECTURALLY SUPPORTED** | Substrate can host it; the wiring is partial or absent | PARTIAL |
| **SPECIFIED** | Designed here; not built | SPECIFICATION |
| **RESEARCH FRONTIER** | Needs genuine research/prototyping before it can be specified for production | RESEARCH |
| **LONG-HORIZON VISION** | Strategic aspiration beyond current engineering capability | VISION |

**No section of this corpus may be cited as evidence that a capability exists.** It is a design, not a
status report. The status of any capability lives only in that capability's own record once built.

---

## Adoption gate

No primitive here becomes production architecture except through this sequence (mirrors the PCI
corpus, deliberately):

1. **Formalize (R0).** Types + JSON Schema for the primitive; prove it is re-derivable by replay from
   the event log (it must be a projection, not a new source of truth).
2. **Measure before trust (Layer 2 gate).** Any probabilistic element (policy confidence, self-model
   calibration, relationship reliability) must pass per-agent/per-learner calibration on the Cognitive
   Evaluation Layer (ADR-0027) before it is allowed to influence a dispatch. Uncalibrated confidence
   may be *recorded* but must not *route*.
3. **One terse ADR.** A §25.4-level decision (now `uci-architecture.md` §3), 2–4 sentences: context,
   decision, rejected alternatives. Candidate ADRs are enumerated in
   [`08`](08-roadmap-and-adrs.md#3-adr-candidates-deliverable-m).
4. **Then implement**, behind the eight-contract adapter seam, as a governed projection, with the
   failure-mode mitigations from [`06`](06-runtime-data-observability.md#6-failure-modes-deliverable--brief-36-each-with-detection--prevention--rollback) wired from day
   one — not retrofitted.

The **first** capability through this gate should be the smallest one that closes the loop end-to-end:
a governed `reflect()` → **Agent Adaptive Policy** projection → **Cognitive Context Compiler** read,
for a single agent (the Explainer) and a single adaptation dimension (explanation-strategy ordering).
Everything else waits behind evidence that this one works. See
[`08` §Production roadmap](08-roadmap-and-adrs.md#1-production-roadmap-deliverable-f).
