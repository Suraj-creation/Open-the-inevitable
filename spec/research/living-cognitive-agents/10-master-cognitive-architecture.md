# 10 — The Master Cognitive Architecture (implementation-architecture synthesis)

*The capstone of the [Living Cognitive Agents](README.md) corpus. It synthesizes the whole corpus
(00–09), the [PCI corpus](../persistent-cognitive-intelligence/), the adopted
[`uci-architecture.md`](../../architecture/uci-architecture.md), and the **actual code** into one
implementation-oriented plan: what exists, what the target is, how they map, and the disciplined order
of build. It is the document to read after [`02`](02-the-living-agent-thesis.md) for the whole-system
picture.*

**Status:** `SPECIFICATION` (the plan) over a `RESEARCH` corpus. Each capability graduates into
`uci-architecture.md` Parts II–III one ADR at a time. As of the L0→L2 authorization, the **walking
skeleton** of the Explainer proof loop (§11.0, §12) is cleared to build; **everything beyond the L2
gate (§11.5) remains plan, not license.** Build strictly bottom-up — loop first, cathedral after.

---

## 0. Recorded architectural context (per the directive)

Two principles are hereby persisted as standing architectural context for every future session,
integrated (not copied) from Prime Agent / RLM:

1. **Context is an attentional workspace, not the source of truth.** Use persistent external cognitive
   state, programmable execution, recursive delegation, durable processes, controlled context
   composition, background execution, and governed continual adaptation.
2. **Dynamic formation is a runtime capability.** When a deep task requires specialized reasoning,
   research, design, verification, simulation, or implementation, the runtime must be able to
   **form, configure, execute, observe, and retire** the required agent, team, or branch — without a
   hardcoded roster and without a permanent micro-agent zoo.
3. **Prime/RLM is a mechanism, not UCI's ontology.** Prime/RLM informs *how* long-running cognitive
   processes operate — externalized state, programmable execution, recursive delegation, durable
   processes, background execution, controlled context composition. **UCI defines the environment** in
   which those processes, humans, knowledge objects, documents, surfaces, and adaptive representations
   coexist and co-think over persistent artifacts. Adopt the process mechanisms; never narrow UCI to a
   Prime-Agent clone — the Cognitive Environment and the [Cognitive Object](09-cognitive-environment-runtime.md#21-the-cognitive-object--object-centric-not-session-centric-the-deepest-correction)
   universe are the broader whole this architecture is *for*. Process architecture vs. the
   environment-and-object universe in which processes, humans, and artifacts co-think.

These are elaborated across [`09`](09-cognitive-environment-runtime.md) (environment/process/branch),
[`02`](02-the-living-agent-thesis.md) (Constitution + Adaptive Policy), and this file (§4–§6, the
three-layer society and formation model).

---

## 1. The one-sentence architecture

> **UCI is a persistent cognitive environment in which the model is a reasoning faculty; a small
> permanent core runtime hosts durable domain societies and dynamically forms task-specific cognitive
> topologies over shared, addressable Cognitive Objects; specialized processes run concurrently,
> integrate through structured artifacts (not transcript accumulation), are verified externally, made
> visible on the Cognitive Surface, and improved through governed reflection.**

Every noun in that sentence maps to an owning corpus file (§9). This document is the *whole* those
files are parts of.

---

## 2. The layered target (the hierarchy, made precise)

```
Universal Cognitive Infrastructure          ← the product
  └ Cognitive Environment                    ← persistent programmable world (09 §2)
     └ Cognitive Runtime                      ← permanent core: hosts, schedules, governs (§4 Layer A)
        └ Living Cognitive Agents             ← Constitution + Adaptive Policy + Self-Model (02, 03, 04)
           └ Domain Societies                 ← durable per-capability orchestration (§4 Layer B)
              └ Dynamic Formations            ← task-specific teams/branches (§4 Layer C, 09 §3-4)
                 └ Cognitive Processes         ← open taxonomy; most not autonomous agents (09 §3)
                    └ Model / Tools / Envs      ← replaceable faculties behind adapters (05 §5)
```

The load-bearing inversions, all already argued in the corpus and *not re-argued here*:
externalized state ([`02` §1](02-the-living-agent-thesis.md#1-the-thesis-stated-as-a-design-law));
context-as-view ([`09` §1](09-cognitive-environment-runtime.md#1-the-inversion-cognitive-environment-first-prompt-last));
agent ⊂ process ([`09` §3](09-cognitive-environment-runtime.md#3-the-reframe-that-answers-do-not-hardcode-a-fixed-number-of-agents));
governed adaptation only ([`04` §6](04-learning-reflection-evolution.md#6-why-the-agent-changes-itself-is-never-allowed--and-how-identity-is-protected)).

### 2.1 The locked conceptual stack (canonical)

The full loop, locked as the canonical reference figure. §2's hierarchy above is the *containment*
view (what lives inside what); this is the *flow* view of the same system — the environment first, the
model as one faculty inside Process Runtime, cognition flowing through structured artifacts to a
governed adaptation that feeds the next cycle.

```
                    UNIVERSAL COGNITIVE INFRASTRUCTURE
                                  │
                          COGNITIVE ENVIRONMENT
              ┌───────────────────┼───────────────────┐
       HUMAN COGNITION      COGNITIVE OBJECTS      AI COGNITION
              │            (persistent identity)          │
              └───────────────────┼───────────────────┘
                          COGNITIVE RUNTIME
        ┌───────────────────────┼───────────────────────┐
   EVENT / STATE          CONTEXT / MEMORY          PROCESS RUNTIME
   SUBSTRATE                 COMPILER                / LIFECYCLE
        └───────────────────────┼───────────────────────┘
                       LIVING COGNITIVE AGENTS
                  (Constitution + Policy + Self-Model)
                                  │
                          DOMAIN SOCIETIES
                                  │
                       DYNAMIC FORMATION ENGINE
                                  │
                    TASK-SPECIFIC COGNITIVE TOPOLOGY
              ┌───────────────────┼───────────────────┐
         AGENTS /             TOOLS /              EXECUTION
         PROCESSES            SKILLS               ENVIRONMENTS
              └───────────────────┼───────────────────┘
                    STRUCTURED COGNITIVE ARTIFACTS
              ┌───────────────────┼───────────────────┐
          SURFACE            DOCUMENTS          REPRESENTATIONS
              └───────────────────┼───────────────────┘
                             VERIFICATION
                                  │
                              REFLECTION
                                  │
                         GOVERNED ADAPTATION
                                  │
                          └──► NEXT COGNITIVE CYCLE
```

Two boundaries keep this figure honest and stop it becoming a diagram-driven build (§0, anti-pattern):
**humans and AI are peers inside the environment** — co-thinking over shared Cognitive Objects, not a
chatbot beside a canvas — and **the model sits *inside* Process Runtime as a replaceable faculty**, not
at the top of the stack. This is a reference to build *toward*, strictly bottom-up (§11); it is never
license to build top-down.

---

## 3. Whole-system Current → Target map (code-grounded)

Labels: **IMPLEMENTED** (real, product path) · **PARTIAL** · **PROTOTYPE** (real, unreachable from a
product route) · **SPEC-ONLY** · **ABSENT**. Evidence is the file cited; fuller evidence in
[`01`](01-current-architecture-and-gap.md) and the
[2026-08-16 audit](../../../docs/audits/2026-08-16-specification-and-implementation-truth-audit.md).

| Subsystem | Today (evidence) | Status | Target (owning file) |
|---|---|---|---|
| **Event substrate** | `EventBus` + `FileEventTransport`/in-memory; `PostgresEventTransport` exists; the canonical `events` table is **unused**; `transport_events` used only as an intelligence mirror | PARTIAL | Durable event log = source of truth (the L1.5 gate) — `uci-architecture.md` §6 |
| **Process runtime** | `CognitiveUnitHost` + ABI (`abi.ts`); `reflect/checkpoint/restore` **declared, never called**; only `execute()` runs; no lifecycle | PARTIAL | Process lifecycle (created→working→paused→retired) — [`09` §3](09-cognitive-environment-runtime.md#3-the-reframe-that-answers-do-not-hardcode-a-fixed-number-of-agents) |
| **Execution + fibers** | `ExecutionEngine` + `FiberRoutine` real; `FiberedLearningLoop` (D2 journal) | IMPLEMENTED (narrow) | Seed of Cognitive Process + Recursive Invocation — [`09` §4](09-cognitive-environment-runtime.md#4-new-primitive--recursive-cognitive-invocation-generalized-rlm) |
| **Scheduler** | `DepthScheduler` + `PriorityReadyQueue`; admits by depth/priority | IMPLEMENTED (narrow) | Cognitive Scheduler: *when* cognition runs — [`09` §6](09-cognitive-environment-runtime.md#6-new-primitive--the-cognitive-scheduler--offlinesleep-time-cognition) |
| **Dispatch + governance** | `ProductRuntimeDispatcher`: governance gate **before** mutation, OTel span; 18 routable agent ids | IMPLEMENTED | Unchanged seam; formation routes through it |
| **Supervisor** | `SupervisorUnit`: routes by world-state signals + confidence weighting | PARTIAL | Executive coordinator over *structured summaries*, not raw trajectories (§10) |
| **Agents** | 23 manifests / 18 routable; stateless; flat prompt; **one shared `depthBias`** the only adaptation | PARTIAL | Constitution + Adaptive Policy + Self-Model + archetypes (§4–§6) |
| **Context** | `ModelBackedUnit` flat prompt + `ContextAssembler` (lease-bounded; `PgVectorStore` wired, ADR-0065) | PARTIAL | Cognitive Context Compiler (budgeted, precedence, provenance, attention) — [`03` §3.1](03-cognitive-state-and-memory.md#31-the-compiler-is-an-attention-mechanism-not-a-prompt-assembler) |
| **Memory** | `TieredMemoryStore` (~227 loc, session `Map`, decay real); durable learner slice (migration 0004, live-proven) | PARTIAL | Multi-tier durable + consolidation/contradiction/forgetting as processes — [`03` §2](03-cognitive-state-and-memory.md#2-the-memory-architecture) |
| **World-state** | In-memory delta fold; HLC temporal; **no causal edges**; `learner_world_*` wired; shared `world_state_*` tables unwired | PARTIAL | Durable, temporal→causal; **Cognitive Object registry** — [`09` §2.1](09-cognitive-environment-runtime.md#21-the-cognitive-object--object-centric-not-session-centric-the-deepest-correction) |
| **Intelligence plane** | 7 durable distillers incl. `agent.strategy-outcome`/`agent.collaboration` (recorded, **unread**) | IMPLEMENTED (unread) | The reflection/consolidation return path — [`04` §1](04-learning-reflection-evolution.md#1-the-learning-loop--closing-the-abis-open-sockets) |
| **Claim graph** | extract/contrast; epistemic status; `contradicts` edges | IMPLEMENTED (service-gated) | Evidence layer of the Epistemic Workspace — [`05` §7](05-society-and-formation.md#7-the-epistemic-workspace--collective-inquiry-state) |
| **Governance** | `GovernanceEngine` at dispatch (2 default + dispatch policies) | IMPLEMENTED (thin) | Governance/Safety governor across formation + adaptation + surface ops (§4) |
| **Evolution** | `EvolutionEngine` (propose→shadow→approve→rollout/rollback, governed) | PROTOTYPE (unreachable) | Reachable governed adaptation — [`04` §5](04-learning-reflection-evolution.md#5-the-evolution-ladder--governed-self-improvement) |
| **Digital twin** | `TwinRegistry` (consent-scoped snapshot) | PROTOTYPE (unreachable) | Learner Belief State projection (PCI corpus) |
| **Surface** | `CognitionBlock` = typed, versioned, **provenance-mandatory** record (`block_id`/`block_type`/`world_state_nodes`); `AgentContributionRuntime` emits `surface.*`; frames/narration/viewports/theater/MCCR | IMPLEMENTED (rich) | Agent-surface protocol over stable objects + representation transform + real branching (§7) |
| **Document / CSE** | Ingestion (PDF/notebook/web/code/markdown), anchors, viewports, `teach-source`, `fuse`, `frontier`, `timeline`, `creation`; bytes in Supabase Storage; **catalog is JSON** | IMPLEMENTED (teaching) / PARTIAL (living-artifact) | Living Artifact w/ full op-set + shared object identity (§8) |
| **Agent/team formation** | none — all units statically constructed in `wiring.ts`; only the evolution *proposal* lifecycle exists | ABSENT | Dynamic formation (§4 Layer C) |
| **Ensemble / blackboard** | ADR-0018/0025 exist as ADRs; **no coordination code** beyond evolution proposals + `disagreement` interaction kind | SPEC-ONLY | Domain-society coordination + typed messaging (§4B, [`05`](05-society-and-formation.md)) |
| **Branch / fork / merge** | "branch"/"merge" exist only as *surface interaction kinds* + fused-view (cinematography) | SPEC-ONLY (as cognition primitive) | First-class Cognitive Branch — [`09` §5.1](09-cognitive-environment-runtime.md#51-the-cognitive-branch--a-third-context-mechanism-context-folding) |

**The one-line reading of this table:** the *substrate is rich and the surface is genuinely strong*;
what is missing is (a) durability of the event/world-state floor, (b) the **return path** that turns
recorded experience into adaptation, and (c) the **formation + object-registry + compiler** layer that
turns a fixed set of stateless units into a runtime that composes cognition per task. **None of it is
"invent from scratch" — it is "connect, durablize, and generalize what exists."**

---

## 4. The three-layer agent society

The correction the directive itself makes, and this corpus adopts: **not a permanent micro-agent
zoo.** Three layers, each with a different lifetime and a different implementation boundary.

```
                          COGNITIVE SYSTEM
   ┌───────────────────────────┼───────────────────────────┐
   ▼                           ▼                           ▼
 LAYER A                    LAYER B                     LAYER C
 PERMANENT CORE RUNTIME     DURABLE DOMAIN SOCIETIES    DYNAMIC FORMATION
 (few; deterministic/       (per product capability;    (per task; ephemeral;
  agentic/hybrid)            archetypes + skills)         formed then retired)
```

### 4.1 Layer A — the permanent core (few, mostly deterministic)

The directive lists 16 core processes. The disciplined question for each is **not** "make it an LLM
agent" but *"deterministic service, agentic process, or hybrid?"* and *"does a seed exist?"*

| # | Core process | Boundary | Seed today |
|---|---|---|---|
| 1 | Cognitive Supervisor / Executive | **Hybrid** (deterministic routing + agentic decomposition) | `SupervisorUnit` (PARTIAL) |
| 2 | Cognitive Daemon | **Deterministic** (loops, watches, recovery) + agentic triggers | ABSENT (§ daemon below) |
| 3 | Context Compiler | **Deterministic** (compose/rank/budget) w/ model-assisted summarize | `ModelBackedUnit`+`ContextAssembler` (PARTIAL) |
| 4 | Process / Lifecycle Manager | **Deterministic** | `CognitiveUnitHost` (PARTIAL — no lifecycle) |
| 5 | Goal Manager | **Deterministic** over Intention Graph | Intent Lease (PARTIAL) |
| 6 | Memory Governor | **Deterministic** (mutation protocol + policy) | `TieredMemoryStore` (PARTIAL) |
| 7 | World-State Manager | **Deterministic** (delta fold + registry) | `WorldStateGraph` (PARTIAL) |
| 8 | Event Router | **Deterministic** | `EventBus` (IMPLEMENTED) |
| 9 | Agent/Team Formation Manager | **Hybrid** (deterministic caps + agentic topology) | ABSENT |
| 10 | Capability / Skill Registry | **Deterministic** | manifest catalog (PARTIAL) |
| 11 | Model Router | **Deterministic** (requirements→model) | model injected per unit (PARTIAL) |
| 12 | Verification Governor | **Hybrid** (deterministic gates + agentic critics) | eval layer + governance (PARTIAL) |
| 13 | Reflection / Consolidation Manager | **Hybrid** | distillers (IMPLEMENTED, unread) |
| 14 | Adaptation Governor | **Deterministic** gate over agentic proposals | `EvolutionEngine` (PROTOTYPE) |
| 15 | Observability / Trace Manager | **Deterministic** | reasoning traces + OTel (IMPLEMENTED) |
| 16 | Surface Synchronization Manager | **Deterministic** | `foldSurfaceEvents` + SSE (IMPLEMENTED) |

**The discipline this table enforces:** ~10 of the 16 are **deterministic runtime services**, not
LLM agents. Putting them in a model loop would be slow, non-replayable, and ungovernable. The core is
mostly *plumbing that already half-exists*; only Supervisor, Formation, Verification, Reflection carry
genuine agentic reasoning, and even those are *deterministic shells around agentic steps*.

### 4.2 Layer B — durable domain societies (the missing middle layer)

The corpus jumped from "agents" to "dynamic formation" and under-specified the middle. A **Domain
Society** is a durable, reusable, per-capability orchestration unit. Candidates map to product
capabilities that already have code: **Surface Society** (surface pkg), **Document Intelligence
Society** (CSE/source-environment), **Content Creation Society**, **Research Society** (research/
frontier/temporal units), **Teaching Society** (explanation/curriculum/practice/assessment),
**Representation Society** (representation/imageplanner/composer), **Memory/Learning Society**,
**Verification Society**.

Each society is a **specification object**, not a bag of prompts — it declares: `purpose · inputs ·
outputs · authority · state_access · tools · capabilities · formation_rules · coordination_protocol ·
verification_strategy · termination_conditions`. A society is *how a capability composes archetypes +
skills + dynamic specialists*; it is not itself a permanent set of agents.

### 4.3 Layer C — dynamic formation (per task, then retired)

When a task needs specialized work, the Formation Manager composes a topology from **archetypes +
skills** and retires it at completion. This is [Recursive Cognitive Invocation](09-cognitive-environment-runtime.md#4-new-primitive--recursive-cognitive-invocation-generalized-rlm)
governed by budgets, spawn caps, and epistemic read-boundaries. Formed specialists have **no durable
Adaptive Policy and no accumulation** — only Layer-A/B persistent agents accumulate ([`05` §3.2](05-society-and-formation.md#32-dynamic-agent-formation--long-horizon-vision-with-a-hard-warning)).

---

## 5. Archetype + Skill + Dynamic-Formation model (adopted from the directive's refinement)

The directive's sharpest correction — and this corpus adopts it verbatim in spirit: **do not make
"content creator", "content formatter", "consistency checker" permanent top-level agents.** Define a
small set of **archetypes**, a growing library of **skills**, and let the runtime **dynamically
specialize**.

```
DOMAIN SOCIETY (e.g. Content)
├── Society Supervisor                       (Layer B, durable)
├── Archetypes  (few, durable, Constitution + Adaptive Policy)
│     Researcher · Architect · Creator · Designer · Critic · Verifier · Integrator
├── Skills      (many, reusable, versioned, evidence-bearing — 04 §3)
└── Dynamic specializations (Layer C, ephemeral, formed from archetype × skill × task)
      "Scientific explainer" · "Mathematical formalizer" · "Citation verifier" ·
      "Quantum-Mechanics intuition→formalism agent" · …  (never predefined in the repo)
```

**The deepest architectural rule** (recorded as canonical):

> Permanent agents define cognitive infrastructure and durable authority. Domain societies define
> durable per-capability orchestration. Dynamic agents define temporary expertise and task-specific
> cognitive labor. Skills define reusable procedures. **The runtime decides which combination is
> necessary.** A new specialization is a *composition*, not a new file in the repo.

### 5.1 Worked example — a deep-content request (the directive's test case)

```
CONTENT REQUEST
  ↓ Content Society Supervisor: understand objective; inspect surface/document/world state
  ↓ generate cognitive topology (NOT "spawn all archetypes")
  ↓ form only what the task needs, in parallel where independent:
      Researcher ─┐   Architect ─┐
      (deep dive)  │   (structure) │   ← Layer C specialists, formed from archetype × skill
      Representation ┘  Critic ────┘
  ↓ each returns a STRUCTURED ARTIFACT (not a transcript) into shared Cognitive Objects
  ↓ Integrator merges · Verifier gates (external checks, not self-report)
  ↓ Surface Synchronization projects the result as living artifacts
  ↓ Reflection distills which topology worked → skill/policy proposals (governed)
```

The value is not "100 agents." It is a runtime that **understands the problem, forms the right
topology, runs it concurrently, preserves work as structured artifacts, verifies, integrates, and
learns which topologies work.**

---

## 6. The AgentDefinition (formation contract)

Every formable agent — permanent, society archetype, or dynamic specialist — is instantiated from one
schema. **Static** fields are its stable role (its Constitution); **dynamic** fields are computed per
formation from goal/task/state/evidence/peers/time.

```
AgentDefinition {
  STATIC (Constitution — governed, versioned):
    identity · purpose · scope · authority · responsibilities · forbidden_actions ·
    memory_scope · tool_permissions · model_requirements · lifecycle_policy ·
    observability_requirements · evaluation_metrics
  DYNAMIC (computed at formation, bounded by Static):
    current_goal · task_state · required_inputs · expected_output_contract ·
    peer_agents · epistemic_read_boundary · budget · priority · adaptive_policy_overlay
}
```

Static ≈ [Agent Constitution §1.1](03-cognitive-state-and-memory.md#11-agent-constitution--specified);
dynamic ≈ the compiled context + the [Adaptive Policy overlay](03-cognitive-state-and-memory.md#12-agent-adaptive-policy--research-frontier).
Dynamic behavior is **compiled, never hardcoded** — the corpus's whole thesis.

---

## 7. Cognitive Surface as an execution target (current is strong; three gaps)

The surface is the corpus's most-built subsystem. `CognitionBlock` is already the right primitive: a
typed, versioned, **provenance-mandatory** object (a block cannot appear without a `reason` and
`producer_cid` — "nothing appears magically"), linked to `world_state_nodes`. Agents already
contribute via `AgentContributionRuntime` → `surface.*` events; the client fold ≡ server state is a
tested invariant. **Three gaps** to the "agents operate on stable cognitive objects" target:

1. **Blocks are session-scoped, not globally addressable Cognitive Objects.** Gap → [`09` §2.1](09-cognitive-environment-runtime.md#21-the-cognitive-object--object-centric-not-session-centric-the-deepest-correction):
   promote the block to (or back it by) an addressable, versioned, related world-state object with a
   stable id usable across sessions and representations.
2. **The agent-surface protocol is write-mostly.** Agents emit blocks; there is no rich *read/query*
   protocol (`inspect_object`, `query_semantics`) or typed *transform/link/restructure* op-set.
   Target: the formal agent-surface protocol (directive §15) over stable object ids.
3. **Branch/merge is UI-interaction only.** First-class [Cognitive Branch](09-cognitive-environment-runtime.md#51-the-cognitive-branch--a-third-context-mechanism-context-folding)
   (independent workspace, controlled boundary, fold/merge with provenance) is absent.

**Do not rebuild the surface** — it is genuinely good. Extend it: object identity, a read+transform
protocol, branches.

---

## 8. Living Document architecture (current is strong for teaching; op-set is partial)

CSE already does the hard half: durable content-addressed ingestion (PDF/notebook/web/code/markdown),
structural/semantic/visual layers, anchors with ≥2 selectors, exact source viewports + highlights +
agent-controlled scroll, `teach-source` (the document *becomes* the timeline), `fuse` (cross-source),
`frontier`/`timeline` research overlays, and `creation`. **The living-artifact op-set is where it is
partial**: `select-region→expand/explain` and cross-source synthesis exist; **rewrite / restructure /
summarize-in-place / compare / branch-interpretation / turn-into-simulation / turn-into-learning-path
are absent as first-class operations.** The deepest gap is the same as the surface's: an uploaded
document's regions do not yet share **stable Cognitive Object identity** with the concepts/frames they
teach — provenance links exist, but not one addressable object spanning representations. Target:
[`09` §5](09-cognitive-environment-runtime.md#5-programmatic-context-operations--computation-over-context-not-larger-prompts)
(the persistent source workspace) + the Cognitive Object registry. **Also durablize:** the source
catalog is still JSON (`source-persistence.ts`) — it moves to Postgres in the L1.5 gate.

---

## 9. Deliverable ownership index (A–K → where each lives)

The directive asks for 11 deliverables. Most already exist in this corpus — creating parallel copies
would violate *one concept, one authority*. This index is the map; only **A** and **B** are new (this
file).

| Deliverable | Owned by |
|---|---|
| A. Master Cognitive Architecture | **this file (10)** |
| B. Current vs Target map | **this file §3** |
| C. Agent Architecture (permanent + dynamic) | this file §4–§6 + [`02`](02-the-living-agent-thesis.md), [`09` §3](09-cognitive-environment-runtime.md#3-the-reframe-that-answers-do-not-hardcode-a-fixed-number-of-agents) |
| D. Cognitive Runtime spec | [`06`](06-runtime-data-observability.md) + [`09`](09-cognitive-environment-runtime.md) |
| E. Agent Society / Formation | this file §4–§5 + [`05`](05-society-and-formation.md), [`09` §4](09-cognitive-environment-runtime.md#4-new-primitive--recursive-cognitive-invocation-generalized-rlm) |
| F. Surface Agent Protocol | this file §7 + [`05` surface refs] + directive §15 (to formalize at Phase 3) |
| G. Living Document architecture | this file §8 + `spec/source-environment/` (CSE-001…010) |
| H. Context Compiler spec | [`02` §4](02-the-living-agent-thesis.md#4-the-cognitive-context-compiler) + [`03` §3](03-cognitive-state-and-memory.md#3-context-engineering--the-compiler-in-depth) |
| I. Capability / Skill Registry | [`03` §1.3](03-cognitive-state-and-memory.md#13-agent-skill--research-frontier-deferred-highest-value-highest-risk) + [`04` §3](04-learning-reflection-evolution.md#3-skills--the-highest-value-highest-risk-primitive) |
| J. Implementation roadmap | [`08` §1](08-roadmap-and-adrs.md#1-production-roadmap-deliverable-f) + §11 here |
| K. Test / Evaluation architecture | [`06` §5](06-runtime-data-observability.md#5-evaluation-deliverable-k--proving-intelligence-accumulates-not-regenerates) + [`06` §5.4](06-runtime-data-observability.md#54-the-flagship-benchmark--the-longitudinal-cognitive-task) |

---

## 10. Redesigning the shallow agents

The directive is right to challenge the current agents. Accurately: there is no literal "Planner"/
"Challenger" — there are 18 model-backed units (curriculum ≈ planner; revision/debate ≈ challenger;
supervisor) that are **stateless, flat-prompt, and share one `depthBias`**. Diagnosis and redesign:

- **The unit is a flat prompt with no identity or memory.** → Constitution + Adaptive Policy +
  Self-Model, compiled per dispatch ([`02`](02-the-living-agent-thesis.md)). *Refactor, not rewrite:
  the manifest already carries role/capabilities/policies — promote it to a governed Constitution.*
- **The Supervisor risks becoming a bottleneck.** → It must read *structured summaries and world-state
  signals* (it already reads world-state) and **delegate via structured artifacts**, never ingest raw
  child trajectories ([`09` §4](09-cognitive-environment-runtime.md#4-new-primitive--recursive-cognitive-invocation-generalized-rlm)).
- **`memory`, `motivation`, `reflection`, `debate` are inert manifests.** → `reflection`/`memory`
  become **substrate faculties** (the reflect step; the memory governor), not agents; `debate`/
  `motivation` become real archetypes or are removed. An undispatched manifest is a status claim
  without evidence ([`01` §5](01-current-architecture-and-gap.md#5-contradictions-and-inconsistencies-found)).
- **Adaptation is one global scalar.** → per-(agent,learner) Adaptive Policy through the reachable
  `EvolutionEngine` ([`04` §5](04-learning-reflection-evolution.md#5-the-evolution-ladder--governed-self-improvement)).

---

## 11. The disciplined build order (and why NOT to start with the society)

The directive's Phase 0–7 and the corpus's L0–L6 reconcile cleanly. The **non-negotiable** ordering,
because it is a safety and correctness property, not a preference:

```
SUBSTRATE FIRST → LOOP → then SOCIETIES/FORMATION → then AUTONOMY
```

### 11.0 The methodology: one walking skeleton, not sequential framework projects

The order above lists *layers*, and a layer list invites the exact failure it exists to prevent:
building a Constitution framework, then a Compiler framework, then an Event framework, then a Policy
framework — four efforts that each look like progress and together prove nothing about whether
cognition actually accumulates. Phases 1–2 are therefore built as **one thin vertical thread through
every layer**, not four infrastructure projects run to completion in series:

```
ONE REAL TASK → ONE COGNITIVE OBJECT → ONE AGENT → CONTEXT COMPILER → EXECUTION →
EVENTS → STATE UPDATE → REFLECTION → ADAPTIVE-POLICY PROPOSAL → GOVERNED ACCEPTANCE →
NEXT EPISODE → MEASURABLE IMPROVEMENT?
```

Each box is its *thinnest real instance* (one Explainer, one dimension, one policy field), wired end to
end before any layer is generalized, with the Explainer experiment visible from the first commit. Only
after the thread runs and the L2 gate (§11.5) passes does each layer earn generalization into the
frameworks later phases need. This is `CLAUDE.md` §3 — *"build vertical slices before abstractions;
prove end-to-end, observe the pattern, then extract the primitive"* — applied to this roadmap itself.

| Phase | What | Corpus | Gate |
|---|---|---|---|
| **0** | This audit + Master doc | §3, §9 | ✅ done (this file) |
| **1** | Core runtime: event log durable · process lifecycle · Cognitive Object registry · Context Compiler v1 · capability registry · model routing · observability | L0 (Constitution), L1 (Compiler) | — |
| **1.5** | **Cognitive State Integrity gate** — world-state + source catalog → Postgres; prove every State-Ownership row by replay | [L1.5](08-roadmap-and-adrs.md#1-production-roadmap-deliverable-f) | **substrate proven before any adaptation rides on it** |
| **2** | **Close the loop, ONE agent, ONE dimension** (Explainer, strategy-ordering) as a single walking skeleton (§11.0): reflect → Policy → reachable EvolutionEngine → Compiler reads it; **instrumented for all four L2 measurements from episode 1** | L2 | **four-measurement exit gate (§11.5) — the whole thesis, falsified cheaply if it fails** |
| **3** | Surface: object identity · read+transform agent protocol · first-class branches | — | after L2 |
| **4** | Living Document: full op-set + shared object identity | — | after L3 |
| **5** | Domain Societies + dynamic formation + structured-artifact integration | L3–L4 | after the loop generalizes |
| **6** | Reflection/adaptation at scale; skills | L5 | governed |
| **7** | Background/scheduled/event-driven cognition; world-model; self-model calibration | L6+ | LONG-HORIZON |

### 11.5 The L2 exit gate — four measurements (not "the agent changed")

"Episode 20 beats episode 1" is satisfiable by *memorizing one learner* — a lookup table, not a
cognitive architecture. Passing L2 (and thereby unlocking Phases 3–7) requires all four measurements,
with the crucial split that the **walking skeleton is *instrumented* for all four from episode 1, but
the *gate* is evaluated only after the loop has run** — instrumenting is a skeleton requirement, passing
is the exit requirement:

| # | Measurement | Question | Guards against |
|---|---|---|---|
| **A** | **Longitudinal adaptation** | Does the same learner get measurably better outcomes, episode 1 → 20, model held fixed? | no accumulation at all |
| **B** | **Transfer** | Does adaptation on one task improve a *new but related* task? | memorizing one learner/task |
| **C** | **Replay / attribution** | Can it reconstruct *why* behavior changed: event history → reflection → policy proposal → accepted policy → compiled context → output? | ungovernable, unexplainable change (also a `CLAUDE.md` law) |
| **D** | **Ablation** | Does the adapted path consistently beat an identical no-adaptation baseline? | crediting the base model or noise for the gain |

The claim the gate defends is not *"the agent changed"* but *"the system demonstrably accumulated
useful cognitive capability while preserving identity, reproducibility, and governance."* If **D**
fails — adaptation-on does not beat adaptation-off — the architecture has **not** earned its complexity
and the slice rolls back. Because measuring real longitudinal human learning needs live users over
weeks, the skeleton runs A/B/D against a **deterministic learner simulator** to prove the mechanism and
its instrumentation; the identical instrumented loop is then validated against real learner telemetry
before Phase 3. (Ownership: [`06` §5](06-runtime-data-observability.md#5-evaluation-deliverable-k--proving-intelligence-accumulates-not-regenerates).)

**Why not start with the Supervisor/Daemon/society (the tempting move):** building the three-layer
society before L2 proves the loop is *speculative architecture at the largest scale* — the exact
`CLAUDE.md` violation this whole reset corrected. A society of stateless agents over an un-durable
event log and a JSON world-state would be a beautiful shell with no accumulation and no replay. The
society is **earned** by the loop, not built before it.

**Implementation boundaries** (what NOT to build yet): the full Cognitive Environment Runtime as
greenfield; model-side workspace writes; Recursive Invocation before spawn-governance; dynamic
formation before archetypes have durable Policy; anything before the L1.5 durability gate. See
[`08` §4](08-roadmap-and-adrs.md#4-implementation-boundaries-deliverable-n--what-to-not-build-yet).

---

## 12. The single next step

The first build is **not** any of the society. It is the smallest vertical slice that earns everything
above — implemented as **one walking skeleton** (§11.0), not four framework projects run in series:

> **The Explainer loop, one dimension, end to end.** Promote the Explainer manifest to a governed
> **Constitution**; make its per-learner teaching strategy an addressable, versioned **Cognitive
> Object** (the Adaptive Policy); build **Context Compiler v1** as the thinnest real composer
> (Constitution + Policy + learner-state + task → bounded context, generalizing `ModelBackedUnit`'s
> `buildRequest`); run an **episode** (compile → execute → typed **events** → **state** delta); then
> **reflect → propose a policy delta → govern acceptance → the next episode's compiler reads the new
> policy.** Durablize the event log + world-state as the loop rides on them (the L1.5 integrity gate).
> Instrument **A/B/C/D (§11.5) from episode 1**, run it against a deterministic learner simulator, and
> answer the one question that validates the whole architecture:

> **Can this system accumulate, govern, retrieve, apply, and verify cognitive improvement across time —
> provably (replay), generally (transfer), and causally (ablation)?**

If yes, the Master Architecture is validated and Phases 3–7 unlock. If no, it rolls back cheaply and we
have lost a slice, not a cathedral. That is the bridge from the Planner/Challenger-era implementation to
the persistent cognitive environment this document plans — built the only way it can be built safely:
**loop first, cathedral after.**

→ The parts: [`02` thesis](02-the-living-agent-thesis.md) · [`03` state/memory](03-cognitive-state-and-memory.md) ·
[`04` learning](04-learning-reflection-evolution.md) · [`05` society](05-society-and-formation.md) ·
[`06` runtime/eval](06-runtime-data-observability.md) · [`08` roadmap](08-roadmap-and-adrs.md) ·
[`09` environment](09-cognitive-environment-runtime.md).
