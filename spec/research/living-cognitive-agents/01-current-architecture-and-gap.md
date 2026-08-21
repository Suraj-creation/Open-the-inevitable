# 01 — Current Agent Architecture & the Gap

*Part of the [Living Cognitive Agents](README.md) corpus. Deliverables C (gap analysis) and the
"Current Agent Architecture / Limitations" sections of the brief. Every claim is cited to a file,
type, or ADR. This document is the empirical floor the rest of the corpus stands on.*

---

## 1. What an agent *is* today, precisely

An agent in UCI today is a `CognitiveUnit` — an object implementing the ABI in
[`packages/runtime/src/abi.ts`](../../../packages/runtime/src/abi.ts):

```
describe()            → UnitDescriptor          IMPLEMENTED, called at registration
prepare(lease)        → void                    IMPLEMENTED, minimal
execute(packet)       → Emissions               IMPLEMENTED, the whole agent
reflect(trace)        → string | null           DECLARED, NEVER CALLED
checkpoint()          → CognitionFrame          DECLARED, NEVER CALLED
restore(frame)        → void                    DECLARED, NEVER CALLED
shutdown(reason)      → void                    IMPLEMENTED, teardown only
health()              → HealthReport             IMPLEMENTED, liveness only
```

The ABI *already anticipates a living agent* — `reflect`, `checkpoint`, `restore` are the exact hooks
a learning, resumable agent needs. They are declared and implemented as no-ops on every unit, and
**called from nowhere in the codebase** (the only `.restore(` call in the repo is `world.restore()`,
an unrelated world-state snapshot restore). The learning loop the brief asks for is a set of empty
sockets that were wired for but never plugged in.

An agent's runtime shape (from `agent-catalog.ts` `MVP_AGENT_MANIFESTS` and the model-backed units):

- **Identity** = a manifest `{ id, version, role, capabilities[], memory_access, policies[],
  resources, observability }`. The `role` is a **prose string** with no governance status — anyone
  may edit it in a PR; there is no versioned, tightly-governed *Constitution*.
- **Capabilities** = **inert strings** (`"concept.decompose"`, `"prerequisite.discover"`). They are
  matched for routing and governance but carry no procedure, no evidence, no success rate — they are
  labels, not *Skills*.
- **Behavior** = `execute(packet)` composes a prompt from the manifest persona + the packet's
  concept/layer and calls the model ([`model-backed-unit.ts`](../../../packages/product-cognition/src/model-backed-unit.ts)).
  This is a **flat template**, not a *Cognitive Context Compiler*.
- **The only adaptive parameter in the entire agent layer** is a single integer,
  `LiveEvolutionConfig.depthBias` ([`live-config.ts:13`](../../../packages/orchestration/src/live-config.ts)),
  read by `ModelBackedUnit` via a `getDepthBias()` closure
  ([`model-backed-unit.ts:285`](../../../packages/product-cognition/src/model-backed-unit.ts)) to
  shift explanation depth. It is **system-wide and shared by every agent and every learner** — there
  is no per-agent, per-learner adaptive state anywhere.

So: today's agent is *Constitution-as-a-string + inert-capabilities + flat-template + one shared
scalar*. It is a competent stateless function. It is not living in any sense.

## 2. The catalog: how many agents, how alive

`agent-catalog.ts` declares **23 manifests**. Of these:

- **~19 are wired and dispatched** through `ProductRuntimeDispatcher` and the surface (supervisor,
  curriculum, explanation, practice, assessment, revision, intent, research, composer, frameplanner,
  imageplanner, representation, canonicalizer, meaning, claim, synthesis, frontier, temporal,
  creation).
- **4 are inert** — `memory`, `motivation`, `reflection`, `debate` appear in the manifest catalog and
  the `ProductRuntimeAgentId` union with `work_type` mappings, but have **no dedicated unit and no
  registration**. They are taxonomy, not cognition. (Notably, three of the four —
  memory/reflection/debate — are exactly the faculties a living agent needs, declared and unbuilt,
  mirroring the ABI's unplugged sockets.)

None of the 23 has any persistent per-agent state. All are re-instantiated per surface via
`buildDemoSession`.

## 3. What the substrate *already* has (the good news)

This is the decisive context. The substrate is **rich**, and most of it is exactly what a living
agent needs — it is simply never routed back into the agent. Status labels per
[README §Status labels](README.md#status-labels).

| Substrate capability | What it does | Status | Why it matters here |
|---|---|---|---|
| **Cognition Packet / Event / Reasoning Trace** | Typed semantic exchange, event-sourced, every decision traced | IMPLEMENTED | The agent's *experience stream* already exists and is durable |
| **Memory Mutation Protocol + `TieredMemoryStore`** | Typed writes; tiers; decay runs as a real process; subscribers | IMPLEMENTED (session-scoped) | The *mechanism* of memory exists; it is learner-scoped and not durable for agents |
| **World-State Graph** | In-memory delta-fold; HLC-versioned nodes/edges; snapshot/fork | IMPLEMENTED | Temporal (versioned) yes; **causal & bi-temporal no** |
| **Intelligence Plane + 7 distillers** | Folds a closed session's chronicle into durable `IntelligenceArtifact`s; Postgres-backed | IMPLEMENTED | **Includes `agent.strategy-outcome` and `agent.collaboration` — the agent's experience is ALREADY distilled and stored** |
| **Claim Graph** (`extract`/`contrast`) | Claims as world-state nodes with epistemic status + `contradicts` edges | IMPLEMENTED (service-gated) | The epistemic machinery for beliefs/contradictions already exists |
| **Governance Engine** | Priority-ordered policies; evaluated at the dispatch boundary *before* any mutation | IMPLEMENTED (2 default + dispatch policies) | Any adaptation can be gated by the exact mechanism that already gates dispatch |
| **`EvolutionEngine`** | propose → evaluate → shadow → approve → rollout → rollback, with governance + eval gates | PROTOTYPE (unreachable from any gateway route) | The governed-evolution lifecycle the brief asks for is **already built**, just not reachable |
| **`TwinRegistry`** | consent-scoped snapshot: create/branch/export/terminate; file-persist | PROTOTYPE (unreachable) | Persistent per-learner cognitive snapshot exists, unrouted |
| **`ContextAssembler`** (DPS-005) | Lease-bounded semantic retrieval into a bounded working context | IMPLEMENTED (in-memory vectors) | The retrieval half of the Context Compiler exists |
| **Durable learner identity + carried cognition** | Postgres `learners` / `learner_world_*` / `memory_mutations` (migration 0004, live-proven) | IMPLEMENTED | Understanding now survives a redeploy — the persistence floor is real |
| **PCI corpus** — Learner Belief State | A unified probabilistic learner model with calibrated uncertainty | RESEARCH FRONTIER (gated) | The *dual* of the agent self-model; must be shared, not duplicated |

**The single most important line of this document:** the intelligence plane
([`distillers.ts:273,307`](../../../packages/intelligence/src/distillers.ts)) already produces
`agent.strategy-outcome` (reasoning traces joined with evaluation results) and `agent.collaboration`
(how the ensemble negotiated) artifacts, durably, at every session close. **The agent's experience is
already being recorded to durable storage. No agent ever reads it.** The learning loop is not absent
for lack of a place to store experience — it is absent for lack of a *return path*.

## 4. The seven gaps (Deliverable C)

Each gap is stated as: what the brief wants → what exists → what is genuinely missing → smallest
closing move.

### Gap 1 — No agent identity distinct from a mutable string
- **Wants:** a tightly-governed Constitution (purpose, authority, constraints, invariants).
- **Exists:** `manifest.role` — an ungoverned prose string; `manifest.version` — a semver never used
  to gate change.
- **Missing:** a **Constitution** as a version-pinned, governance-classified artifact; changing it is
  an E4/E5 event, not a PR diff.
- **Smallest move:** promote `role` + `policies` + `capabilities` into a signed `AgentConstitution`
  record with a change-class; wire the governance engine to block edits above E3 without approval.

### Gap 2 — No per-agent adaptive policy
- **Wants:** learned strategies, learner-specific adaptations, calibration — evolving without
  corrupting identity.
- **Exists:** one shared `depthBias` integer. That is the entire adaptive surface.
- **Missing:** an **Agent Adaptive Policy** artifact scoped `(agentType, learner, tenant)`, versioned,
  governed, compiled into context — *not mutated in place*.
- **Smallest move:** a durable `agent_policy` projection over `agent.strategy-outcome` artifacts;
  read at `prepare()`; one adaptation dimension (explanation-strategy ordering) to start.

### Gap 3 — The learning loop is unplugged
- **Wants:** Task → … → Reflection → Learning extraction → Memory/Skill/Policy update.
- **Exists:** `reflect()`/`checkpoint()`/`restore()` declared and never called; `agent.strategy-outcome`
  distilled but never re-read.
- **Missing:** an actual `reflect()` invocation that emits a governed **Reflection Record**, and a
  path from that record to a Policy proposal.
- **Smallest move:** call `reflect(trace)` after evaluation; route its output through the existing
  `EvolutionEngine` as a scoped proposal.

### Gap 4 — Capabilities are inert; there are no skills
- **Wants:** first-class skills with procedure, evidence, success/failure rates, versioning,
  composition, retirement.
- **Exists:** capability strings used only for routing/governance.
- **Missing:** a **Skill** primitive and a skill library scoped to `(agentType, domain[, learner])`.
- **Smallest move:** defer. Skills are the highest-value *and* highest-risk primitive (skill drift,
  reward hacking); they wait until the Policy loop is proven. See
  [`04`](04-learning-reflection-evolution.md#3-skills--the-highest-value-highest-risk-primitive).

### Gap 5 — No inter-agent relationships or evidence-based trust
- **Wants:** a collaboration graph with reliability derived from evidence, influencing routing.
- **Exists:** the supervisor routes by static confidence weighting; disagreement can be published as a
  `disagreement.raised` event but no reliability is accumulated.
- **Missing:** an **Agent Relationship** record (interactions, resolutions, contradictions,
  escalations) per `(agentType_a, agentType_b)`, and a router that reads it.
- **Smallest move:** the `agent.collaboration` distiller already records negotiation; project it into a
  relationship record; make it *observable* before it is allowed to *route* (calibration gate).

### Gap 6 — No self-model / metacognition
- **Wants:** the agent knows where it succeeds/fails, when to defer, how it has changed.
- **Exists:** nothing. Confidence is a per-response scalar the model asserts, uncalibrated.
- **Missing:** an **Agent Self-Model** — a calibrated competence map per task-type/domain, a
  projection over `agent.strategy-outcome`.
- **Smallest move:** compute a read-only self-model from existing artifacts; surface it in
  observability; do **not** let it route until calibrated (Layer 2 gate).

### Gap 7 — The world model is temporal but not causal
- **Wants:** the system infers *why* (failure X ← weak prerequisite Y ← wrong abstraction level).
- **Exists:** HLC-versioned nodes (temporal), `contradicts`/`prerequisite_of` edges — but **no causal
  edge type and no bi-temporal validity**.
- **Missing:** first-class **causal edges** and **event/experience graph** structure; this is the
  substrate change with the widest blast radius.
- **Smallest move:** research-tier. Causal inference over learner failures is a genuine research
  program (shared with the PCI corpus's `CognitiveDiagnosis`); do not build speculatively. See
  [`03`](03-cognitive-state-and-memory.md) and [`06`](06-runtime-data-observability.md).

## 5. Contradictions and inconsistencies found

Per the brief's instruction to surface conflicts rather than silently resolve them:

- **CONFLICT — "agents are runtime containers, not prompts" (law) vs. reality.**
  `uci-architecture.md` §2 and `CLAUDE.md` §3 both state agents are cognitive runtime containers with
  manifest + identity + capability envelope + observability. Today's agents *have* those four things,
  so the letter of the law holds — but they have **no runtime state, no lifecycle beyond a single
  execute, and no persistence**, so the *spirit* (a "container" implies something that holds state
  across time) does not. This corpus resolves it: the law is satisfied by the Constitution +
  externalized Policy, not by making the agent object stateful.

- **CONFLICT — four inert manifests.** `memory`, `motivation`, `reflection`, `debate` exist in the
  catalog as dispatchable ids with no units. Either implement or delete; a manifest that cannot be
  dispatched is a status claim without evidence (a `CLAUDE.md` §2 violation). Recommendation:
  `reflection` and `memory` become *substrate faculties* (the reflect step, the memory projection),
  not agents; `debate` and `motivation` become real units or are removed.

- **CONFLICT — two evolution surfaces.** `EvolutionEngine` (real, governed, unreachable) and the
  single `depthBias` knob (reachable, ungoverned-per-agent) both claim to be "how the system adapts."
  They must unify: `depthBias` becomes one dimension of an Agent Adaptive Policy that flows *through*
  the `EvolutionEngine`, not around it.

- **CONFLICT — twin vs. learner Belief State vs. carried cognition.** Three representations of "durable
  learner state" exist (`TwinSnapshot.masteryMap`, `learner_world_*` carried cognition, and the
  proposed PCI Belief State). The PCI corpus already flags this as the core fragmentation to resolve;
  the agent self-model must **project from the unified one**, not add a fourth.

## 6. Honest scorecard

| Living-agent faculty | Status | One-line evidence |
|---|---|---|
| Stable identity / constitution | SPECIFIED here | `manifest.role` is a string, not governed |
| Long-term memory (agent-owned) | ABSENT | memory is learner-scoped; no agent memory |
| Experiential record | **IMPLEMENTED** | `agent.strategy-outcome` distilled, durable — but unread |
| Learning loop | ARCHITECTURALLY SUPPORTED | `reflect()` declared, never called |
| Skills | ABSENT | capabilities are inert strings |
| Self-model / metacognition | ABSENT | confidence is an uncalibrated scalar |
| Adaptive policy | ARCHITECTURALLY SUPPORTED | one shared `depthBias` integer |
| Relationships / trust | ABSENT (recordable) | `agent.collaboration` distilled, unprojected |
| Governed evolution | PROTOTYPE | `EvolutionEngine` real, unreachable from product |
| Offline cognition | ARCHITECTURALLY SUPPORTED | distillation-at-close is offline consolidation already |
| Model independence | IMPLEMENTED | model behind `ModelRuntime` adapter; agent state (what exists) is external |
| Causal world model | ABSENT | temporal yes, causal no |

**The through-line:** UCI is not far from Living Agents because it lacks primitives. It is far because
it has never connected the ones it has. The gap is *wiring and governance*, not invention — for the
first production layer. The genuine research (causal cognition, calibrated self-models, autonomous
research) sits on top of that closed loop, not in place of it.

→ Continue to [`02` — the Living Agent thesis](02-the-living-agent-thesis.md).
