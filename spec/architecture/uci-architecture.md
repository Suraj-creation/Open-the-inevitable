```yaml
spec:
  title: UCI Architecture — The Cognitive Operating System
  domain: architecture
  status: adopted
  owner: architecture
  last_reviewed: 2026-08-16
  supersedes:
    - advanced-agent-architecture (v3.0, 2026-06-04)
    - next-generation-cognitive-operating-system-blueprint (v4.0, 2026-06-04)
  related_protocols:
    [cognition-packet-protocol, cognitive-event-protocol, memory-mutation-protocol,
     reasoning-trace-protocol, cognitive-unit-abi, model-invocation-protocol]
  semantic_tags:
    [architecture, cognitive-operating-system, uci, kernel, protocols, runtime,
     orchestration, memory, world-state, governance, observability, evolution]
```

# UCI Architecture — The Cognitive Operating System

**The single authoritative architecture document for Universal Cognitive Infrastructure.**

This document replaces two near-identical predecessors — `advanced-agent-architecture.md` (v3.0)
and `next-generation-cognitive-operating-system-blueprint.md` (v4.0) — which shared 24 of 26
sections and were reconciled by a "treat differences as additive context" clause rather than a
merge. Both are archived under `docs/history/architecture/`. Nothing was discarded: v4.0's
normative framing is the spine, v3.0's additive depth is grafted in, and superseded material is
listed in [Appendix A](#appendix-a--what-was-superseded-and-why).

---

## 0. How to Read This Document

UCI is the product; the **Cognitive Operating System (COS)** is its internal architecture style.
This document describes the COS. It does not describe education, product features, or research —
those live in `spec/product/`, `spec/product/domains/`, and `spec/research/`.

**Every section carries a truth status.** This is the load-bearing discipline of this document, and
the reason the merge was worth doing. Per `CLAUDE.md` §2, a specification is not evidence that a
capability exists. Sections are therefore stratified into four parts:

| Part | Status | Meaning | Binding? |
|---|---|---|---|
| **I — Foundations** | `ADOPTED` | Philosophy, primitives, and laws that govern all code today | **Binding law** |
| **II — The Substrate** | `ADOPTED` / `PARTIAL` | The architecture as built. Each section states what is real | **Binding law** |
| **III — Committed Direction** | `SPECIFICATION` | Decided and designed; not yet built. Requires no new ADR to begin | Binding *when built* |
| **IV — Long-Horizon Architecture** | `RESEARCH` | Architecturally interesting, not currently load-bearing | **Not law.** Requires an ADR to adopt |

A per-section status marker — `ADOPTED`, `PARTIAL`, `SPECIFICATION`, `RESEARCH` — appears under
each heading. **Do not implement a Part IV section without an ADR.** Building infrastructure
because this document contains it, absent a capability that needs it, violates the
*no speculative architecture* law.

Where this document and a domain spec (`spec/kernel/`, `spec/protocols/`, `spec/memory/`, …)
disagree, **the domain spec wins** for its own domain: it is the owning authority and it tracks
code more closely. This document owns the whole and the laws.

---

# PART I — FOUNDATIONS

*Status: `ADOPTED` throughout. This part is binding law.*

## 1. Architectural Philosophy

### 1.1 The Core Thesis

UCI is not an AI application, an agent workflow system, or a set of specialized prompts. It is an
intelligence substrate: a persistent environment where cognitive units can be created, scheduled,
observed, governed, composed, replayed, evolved, and replaced over time.

> **Intelligence becomes infrastructure when every act of cognition is represented as a typed,
> addressable, replayable, governed, observable, and evolvable state transition.**

Agents are not the center. Models are not the center. Prompts are not the center. The center is the
substrate that lets many forms of intelligence coordinate across time — human learners, educator
agents, personal twins, curriculum engines, memory systems, research agents, reasoning engines,
external MCP tools, external agent runtimes, and future model families.

A product architecture asks: *what features do users need? which agent answers which request? which
database stores which data?* A cognitive operating system asks:

- What is a unit of intelligence?
- How does cognition move through the system?
- How is cognitive state represented across time?
- How do specialized intelligences coordinate without tight coupling?
- How does the system detect that its own reasoning is degrading?
- How can memory persist without becoming corrupt, stale, unsafe, or unbounded?
- How can agents evolve while preserving identity, governance, and auditability?
- How can the system replay, fork, compare, and repair reasoning trajectories?

UCI is therefore designed around substrate-level primitives, not feature-level modules.

### 1.2 The Foundational Commitments

**Cognition is process, not output.** Every answer is the surface of a temporal process: intent
interpretation, context retrieval, reasoning, tool use, memory mutation, governance checks,
confidence estimation, state update. The architecture must expose that process.

**Knowledge is graph-native, not document-native.** Recursive prerequisite discovery, cross-domain
bridges, mastery states, and research-frontier transitions cannot be represented as text chunks.
Documents are inputs; the durable representation is a living concept graph over an event-sourced
world model.

**Memory is institutional, not conversational.** Conversation history is one small stream. The
system needs episodic, semantic, procedural, reflective, governance, failure, and collective memory.

**Agents are runtime containers, not prompts.** An agent is a portable cognitive process with
identity, capabilities, memory adapters, reasoning engines, policies, quotas, observability hooks,
and lifecycle state.

**Orchestration is distributed governance, not a supervisor prompt.** A single supervisor is a
bottleneck and a source of brittle decisions. Orchestration is hierarchical, event-driven,
policy-aware, and locally autonomous.

**State is the source of truth, not computation.** Every cognitive output must be derivable from
state history. This is what enables time-travel debugging, causal attribution, and resilient
recovery. *(From v3.0 Axiom 2.)*

**The system must observe itself.** A cognitive system that cannot observe its own reasoning is
untrustworthy. Introspective telemetry — drift detection, confidence calibration, hallucination
lineage, semantic divergence — is a safety mechanism, not a logging feature. *(v3.0 Axiom 5.)*

**Governance is computational, not procedural.** Policy enforcement cannot be a human gate. It is
executable constraint applied at every decision boundary, automatically and with audit.
*(v3.0 Axiom 6.)*

**The architecture must become learnable by the system itself.** The infrastructure measures its own
decisions, proposes mutations, runs governed experiments, and converges on better topologies.

### 1.3 The Operating-System Analogy

| Classical OS Concern | Cognitive OS Equivalent |
|---|---|
| Process | Cognitive unit, agent runtime, reasoning fiber |
| PID | Cognitive identity |
| System call | Cognitive protocol call |
| IPC | Universal Cognitive Bus |
| Scheduler | Cognitive scheduler |
| File system | Memory and world-state graph |
| Kernel | Governance, routing, scheduling, identity, resource control |
| Device driver | Tool adapter, model adapter, memory adapter |
| Virtual memory | Context lease and working-memory manager |
| Process isolation | Capability envelope and sandbox |
| Audit log | Event-sourced cognition ledger |
| Crash dump | Reasoning trace and causal replay |
| Package manager | Capability registry and manifest registry |
| Upgrade manager | Evolution proposal and rollout controller |

The correct mental model is not "N agents in an app." It is "a cognitive kernel that can run many
kinds of intelligence processes safely."

### 1.4 Why Naive Architectures Fail

*(Retained from v3.0 §1.3 — the diagnostic table that justifies the substrate.)*

| Failure Mode | Root Cause | Manifests At |
|---|---|---|
| Supervisor bottleneck | Single-point LLM routing | >10 concurrent sessions |
| Memory amnesia | Session-scoped context only | >5 conversation turns |
| Reasoning opacity | Black-box model calls | >50 agent interactions/day |
| Cascade failure | Synchronous dependency chains | >3 nested agent calls |
| Policy drift | Manual governance rules | >100 unique user types |
| Knowledge stagnation | No cross-session learning | >1000 interactions |
| Topology rigidity | Hardcoded agent relationships | >20 specialized domains |

Each is a consequence of building on the wrong substrate. The COS addresses each architecturally.

---

## 2. The Cognitive ABI — Foundational Primitives

**Status: `ADOPTED`.** All twelve primitives are specified in `spec/kernel/` and `spec/protocols/`
and implemented in `@inevitable/kernel` and `@inevitable/protocols`. JSON Schema is the canonical
contract form (ADR-0003); TypeScript types are generated from it.

These primitives are the application binary interface for intelligence. Together they are what
makes an agent pluggable rather than hand-wired.

### 2.1 Cognitive Unit

The smallest schedulable intelligence process — a full agent, a reasoning thread, a planner step, a
memory consolidation task, a retrieval reranker, a governance evaluator, a mastery estimator, a
reflective review loop, a topology optimizer.

| Field | Purpose |
|---|---|
| `unit_id` | Stable identity for the cognitive process |
| `unit_type` | Agent, workflow, memory job, reasoning engine, policy evaluator |
| `capabilities` | Declared operations the unit can perform |
| `inputs` / `outputs` | Typed accepted and emitted packets |
| `policies` | Runtime policies enforced before execution |
| `memory_scope` | Which memory layers it may read or write |
| `resource_budget` | Time, token, cost, concurrency, memory, tool limits |
| `observability_contract` | Required metrics, traces, health signals |
| `evolution_policy` | Whether it may be tuned, replaced, or self-mutated |

### 2.2 Cognitive Unit ABI

Every unit implements: `describe()` · `prepare(context_lease)` · `execute(cognition_packet)` ·
`reflect(trace)` · `checkpoint()` · `restore(checkpoint)` · `shutdown(reason)` · `health()`.

Owner: `spec/protocols/cognitive-unit-abi.md`.

### 2.3 Cognitive Identity (CID)

Identity extends beyond an agent id: it encodes lineage, trust level, version, capability grants,
policy boundaries, and attestation chain. A child unit inherits its parent's lineage at **reduced
trust** — trust descends, never ascends, across a spawn boundary.

Identity is assigned to agents, subagents, tool adapters, model adapters, memory writers, retrieval
jobs, workflow runs, human reviewers, external MCP servers, evolution experiments, and synthetic
test agents. It is the foundation for authorization, provenance, causal tracing, and accountability.

Owner: `spec/kernel/cognitive-identity.md`.

### 2.4 Cognition Packet

The canonical unit of semantic exchange. **Packets are never untyped strings.** Natural language may
live *inside* a packet; the packet itself is structured:

- **Identity** — packet id, producer, target, tenant, session
- **Time** — physical timestamp, hybrid logical clock, sequence number
- **Causality** — causation id, correlation id, parent trace id
- **Semantics** — packet type, intent, concept ids, domain ids, embeddings
- **Evidence** — sources, retrieved memories, citations, confidence, uncertainty
- **Governance** — classification, policy tags, consent scope, review flags
- **Runtime** — priority, expiry, retry policy, resource hints
- **Observability** — trace id, span id, metric tags

Owner: `spec/protocols/cognition-packet-protocol.md`.

### 2.5 Intent Lease

A time-bound, revocable interpretation of what the user or system is trying to accomplish. It exists
because user intent changes during long workflows, agents overcommit to stale interpretations, and
multi-week learning paths need periodic renewal.

Fields: `intent_id` · `owner_user_id` · `interpreted_goal` · `scope` · `constraints` · `expires_at` ·
`renewal_conditions` · `revocation_reason` · `confidence`.

**No long-running cognitive workflow continues without a valid intent lease.**
Owner: `spec/kernel/intent-lease.md`.

### 2.6 Context Lease

Temporary, bounded access to a context slice — virtual memory for cognition. It prevents unlimited
memory pulls and cross-task context leakage, and makes context access auditable.

Fields: `lease_id` · `granted_to` · `memory_layers` · `allowed_concepts` · `allowed_time_range` ·
`allowed_users` · `redaction_rules` · `token_budget` · `expires_at`.

Enforcement is **fail-closed**: an expired lease assembles nothing; what a lease excludes is counted
and reported, never silently dropped. Owner: `spec/kernel/context-lease.md`.

### 2.7 Memory Mutation

Every memory write is a typed mutation, never a direct store update. Mutation types: add fact ·
revise fact · decay confidence · reinforce concept · link concepts · split concept · merge concepts ·
add episode · add procedural pattern · redact · quarantine · consolidate.

Each mutation carries evidence, confidence, source identity, and reversibility metadata.
Owner: `spec/protocols/memory-mutation-protocol.md`.

### 2.8 Reasoning Trace

A structured execution record sufficient for debugging, evaluation, and trust — **not** raw
chain-of-thought. It records task interpretation, chosen strategy, retrieved context summaries,
claims, evidence per claim, tool calls and results, uncertainty, alternatives considered, governance
checks, final decision, and self-critique.

This gives cognitive observability without unsafe exposure of hidden reasoning.
Owner: `spec/protocols/reasoning-trace-protocol.md`.

### 2.9 Cognitive Fork

A branch in a reasoning or learning timeline: test an alternate explanation order, simulate a
different learner pathway, compare orchestration topologies, replay a failure under a patched
policy, evaluate an upgrade against historical sessions.

Forks require deterministic replay where possible, with nondeterministic model invocations
explicitly marked. **Forks are labeled as simulation; only approved mutations merge into canonical
state.**

### 2.10 Capability Envelope

Binds what a unit may do, under what conditions, with what resources: tools allowed · memory scopes ·
models · spawn depth · network access · cost ceiling · latency ceiling · data-classification ceiling ·
human-review requirements · regions.

**Capabilities are granted by policy, never hardcoded by agent type.**
Owner: `spec/kernel/capability-envelope.md`.

### 2.11 Cognitive Contract

A versioned interface between cognitive units: input schema · output schema · failure modes · latency
expectations · required evidence · confidence calibration · safety constraints · observability
events · compatibility version. All agent↔agent and agent↔tool communication is contract-first.

### 2.12 Evolution Proposal

Any self-improvement attempt is a proposal: `proposal_id` · `target_component` · `mutation_type` ·
`hypothesis` · `expected_benefit` · `risk_class` · `rollback_plan` · `evaluation_dataset` ·
`shadow_run_plan` · `approval_policy` · `deployment_policy`.

This makes self-evolution governed engineering, not uncontrolled self-modification.

### 2.13 Supporting Primitives

*(Retained from v3.0 §2.3–2.5. Concepts are binding; v3.0's Python illustrations are superseded by
the real TypeScript implementations.)*

**Hybrid Logical Clock (HLC).** Distributed cognition requires causal consistency; wall clocks
diverge across nodes. HLC combines physical time with a logical counter and node id, giving a
sortable, causally-correct ordering. Implemented: `@inevitable/shared` (`hlcInit`, `hlcTick`).
Used as the ordering key in the event log, world-state deltas, and memory mutations.

**Cognitive Resource Quota.** Every unit runs within enforced cognitive constraints, not merely
compute limits: model calls per minute · input/output token ceilings · concurrent calls · working
memory tokens · episodic writes per session · tool calls per minute · allowed tools · child-agent
count · spawn depth · reasoning seconds · cost per session · cost per day. Expressed through the
capability envelope and enforced by the scheduler.

**Distributed Cognitive Semaphore.** A mutex primitive across cognitive units, preventing deadlock
when several units contend for a bounded resource. Priority-ordered queue, holder set, acquisition
timeout that raises a typed deadlock error. `RESEARCH` at distributed scale; the single-process
equivalent is the per-surface command queue in the gateway.

---

## 3. Architectural Laws

**Status: `ADOPTED` — binding, non-negotiable.**

> *These are the ten invariants formerly published as blueprint §25.4. This section is their
> permanent home. `CLAUDE.md` §3 carries their working form; where the two are read together, this
> section is the detailed statement and `CLAUDE.md` is the operative summary.*

1. **No direct unit-to-unit calls** without protocol and event visibility.
2. **No memory write** without a Memory Mutation.
3. **No long-running workflow** without an Intent Lease.
4. **No context access** without a Context Lease.
5. **No side-effecting tool call** without a governance decision.
6. **No unit runtime** without manifest, identity, and capability envelope.
7. **No architecture evolution** without an Evolution Proposal.
8. **No high-risk output** without evidence requirements satisfied.
9. **No hidden state mutation** outside event sourcing.
10. **No production cognitive unit** without an observability contract.

Three further laws are adopted from the 2026-08 architecture reset and carry equal weight:

11. **Persistence is a product requirement.** A capability that cannot survive a process restart is
    not implemented. Durable cognitive state must never rest on ephemeral storage.
12. **Retrieval is half of memory.** Storage without indexed, ranked, cross-session retrieval is not
    memory. A memory tier with no retrieval path is incomplete.
13. **One concept, one authority.** Every stable architectural concept has exactly one owning source.
    Two documents describing the same truth is a defect, not redundancy.

**Code that violates these laws is invalid implementation even if it works locally.**

---

# PART II — THE SUBSTRATE

*The architecture as built. Each section states what is real and what is not.*

## 4. Infrastructure Topology

**Status: `PARTIAL`.** The control/data-plane split and the adapter seam are adopted and
implemented. The layered stack below layer 3 (Kubernetes, service mesh, event mesh) is `RESEARCH`.

### 4.1 Control Plane and Data Plane

**Control plane** — decides what is allowed and how the system is wired: identity registry,
capability registry, policy registry, manifest registry, tool registry, model registry, protocol
registry, topology registry, rollout controller, evolution controller, governance kernel.

**Data plane** — executes cognition at scale: unit execution, reasoning engines, memory retrieval
and writes, tool calls, event streaming, workflow execution, context assembly, interaction streams,
observability streams.

### 4.2 Layered Stack

1. Physical and cloud substrate — `RESEARCH` beyond single-node deployment
2. Transport substrate — event transport, streams, realtime channels
3. Persistence substrate — event store, graph store, vector store, relational store, object store
4. **Cognitive kernel** — identity, scheduling, governance, resource accounting, leases, capability checks
5. **Cognitive runtime** — units, reasoning engines, memory/tool/model adapters
6. **Orchestration fabric** — directors, routers, workflow engines, blackboards
7. **Intelligence services** — domain capabilities (education: ULI, UALRCI, DSP, assessment, research)
8. **Experience layer** — Cognitive Surface, API clients, voice, CLI
9. **Evolution layer** — evaluation harnesses, shadow deployment, topology optimization

Layers 4–8 are `ADOPTED` and implemented. Layers 1–3 are behind adapters (§4.3).

### 4.3 The Adapter Seam

**Status: `ADOPTED`.** Every infrastructure dependency sits behind a contract in
`@inevitable/contracts`. Heavy clients are loaded by guarded dynamic import at the deployment edge
and appear in no package's dependencies (ADR-0005). **No vendor, model, transport, or store leaks
past its adapter.**

| Contract | Operations | Reference impl | Deployment impl |
|---|---|---|---|
| `EventTransport` | publish, subscribe, replay, ack | in-memory | file JSONL · Postgres |
| `RelationalStore` | transaction, migration, snapshot | in-memory | Postgres |
| `GraphStore` | query, mutate, diff, merge, snapshot | in-memory delta fold | Postgres (recursive CTE) |
| `VectorStore` | embed, upsert, search, filter, delete | in-memory cosine | pgvector · Qdrant |
| `ObjectStore` | put, get, ensure-bucket | in-memory | Supabase Storage |
| `ModelRuntime` | generate, stream, tool-call, score, embed | Null (deterministic) | Gemini |
| `ToolRuntime` | discover, invoke, authorize, observe | in-memory | MCP |
| `ObservabilitySink` | trace, metric, log, cognitive event | no-op | OpenTelemetry |

Every adapter passes the same conformance harness as the in-memory reference — a drop-in proven by
identical tests. In-memory remains the offline default so the full stack runs hermetically.

Technology selection is owned by `spec/architecture/Tech-Stack.md` and ADR-0034 (Supabase-first
Postgres backend). *v3.0's stack picks — NATS, Neo4j, Qdrant-by-default, Redis, K3s, LiteLLM — are
superseded by ADR-0034 and retained only as deferred graduation targets.*

### 4.4 Kernel Services

Identity · Capability · Context Lease · Cognitive Scheduler · Universal Cognitive Bus · Governance
Kernel · Memory Mutation · World-State Graph · Temporal Cognition · Cognitive Observability ·
Evolution Controller · Protocol Registry · Agent Runtime Manager · Model Runtime Manager · Tool
Runtime Manager · Failure Recovery Manager.

Independently versioned, conceptually one kernel.

---

## 5. Cognitive Runtime

**Status: `ADOPTED`.** Implemented in `@inevitable/runtime` and `@inevitable/product-cognition`.

### 5.1 Units as Runtime Containers

A cognitive unit is a containerized process with: manifest · identity · capability envelope ·
reasoning engine adapters · memory adapters · tool adapters · model preferences · policy constraints ·
resource quotas · observability hooks · lifecycle state · checkpoint strategy · reflection strategy ·
evolution policy.

**A unit is never only a prompt.** The prompt is one runtime artifact among many.

### 5.2 Agent Manifest

Every agent is defined by a manifest declaring id, version, role, capabilities, preferred and
fallback reasoning engines, memory read/write scopes, policies, resource limits, and required
observability events. Manifests are validated at load; an unmanifested unit cannot be dispatched
(law 6).

Owner: `spec/runtime/cognitive-unit-runtime.md`. The live catalog is
`packages/product-cognition/src/agent-catalog.ts` — **the manifest catalog is the authority on which
agents exist**, not any prose list in a product document.

### 5.3 Lifecycle

`Registered` → `Admitted` → `Scheduled` → `Hydrating` → `Ready` → `Executing` → `Checkpointing` →
`Reflecting` → `Publishing`, with `Suspended`, `Recovering`, `Retired`, and `Quarantined` as
off-path states. **Every transition emits an event.**

*v3.0's nine-state pod machine (`INITIALIZING`, `IDLE`, `REASONING`, `WAITING_FOR_TOOL`,
`WAITING_FOR_CHILD`, `SUSPENDED`, `TERMINATING`, `TERMINATED`, `FAILED`) is the execution-level
projection of the same lifecycle; the thirteen-state model above is canonical.*

### 5.4 Pluggable Reasoning Engines

Reasoning is a runtime plugin, not a unit implementation detail. Strategies: direct response · chain
decomposition · tree search · graph reasoning · debate · reflection · planner-executor · symbolic ·
retrieval-grounded · simulation-based · causal · Socratic · research synthesis · policy reasoning ·
multi-agent consensus.

Each implements `supports(task_type, context)` · `estimate_cost(task)` · `execute(packet, context)` ·
`emit_trace()` · `self_evaluate()`. The scheduler selects dynamically from learner state, task risk,
latency budget, and confidence requirement.

### 5.5 Cognitive Scheduler

**Inputs:** intent priority · fairness policy · capability match · memory locality · region
requirements · load · cost budget · trust and policy constraints · required reasoning depth ·
deadline · risk class · cache availability.

**Outputs:** assigned unit · runtime zone · resource lease · context lease · model route · timeout
policy · retry policy · observability contract.

The scheduler supports **preemption**: a safety review or live interaction may interrupt background
consolidation. Owner: `spec/kernel/cognitive-scheduler.md`.

---

## 6. Event-Driven Cognition

**Status: `ADOPTED`** for the taxonomy, envelope, and sourcing doctrine.
**`PARTIAL`** for the durable event store — see §6.5.

### 6.1 The Event-Driven Rule

**No important cognitive action happens silently.** These must emit events: intent received ·
intent interpreted · context retrieved · unit spawned · reasoning started · tool called · memory read ·
memory mutated · world-state changed · policy evaluated · governance violation · unit completed ·
confidence collapsed · disagreement detected · workflow checkpointed · timeline forked · evolution
proposal created · architecture mutation deployed.

### 6.2 Event Taxonomy

| Family | Examples |
|---|---|
| `intent.*` | received, interpreted, renewed, expired, revoked |
| `context.*` | lease.granted, lease.expired, retrieval.started, retrieval.completed |
| `agent.*` | registered, spawned, ready, executing, completed, failed, quarantined |
| `reasoning.*` | started, strategy.selected, claim.produced, uncertainty.updated, completed |
| `memory.*` | read, mutation.proposed, mutation.committed, consolidated, redacted, quarantined |
| `world.*` | node.created, edge.created, mastery.updated, branch.created, conflict.detected |
| `orchestration.*` | task.routed, topology.changed, director.decision, consensus.reached |
| `workflow.*` | started, checkpointed, signaled, suspended, resumed, cancelled, completed |
| `governance.*` | policy.evaluated, violation.detected, review.requested, override.granted |
| `security.*` | identity.attested, prompt_injection.detected, trust.changed, access.denied |
| `observability.*` | drift.detected, loop.detected, disagreement.detected, health.changed |
| `evolution.*` | proposal.created, experiment.started, shadow_result.recorded, rollout.completed |
| `model.*` | invocation.requested, output.recorded, invocation.failed |
| `surface.*` | block.created, block.delta, frame.composed, narration.segment, focus.changed |
| `source.*` | version.registered, layer.produced, anchor.created, consent.revoked |

The last three families were added after v4.0 was written and are owned by
`spec/events/event-taxonomy.md`, `spec/protocols/model-invocation-protocol.md`, `spec/surface/`,
and `spec/source-environment/`.

### 6.3 Event Envelope

Every event carries: event id · event type · schema version · producer identity · tenant and user
scope · session or workflow scope · causation id · correlation id · hybrid logical clock · data
classification · policy tags · payload · trace id · replay behavior · retention policy.

### 6.4 Event Sourcing Doctrine

The COS distinguishes: **event log** (immutable history) · **materialized state** (current derived
view) · **memory graph** (semantic interpretation) · **world-state graph** (shared model) ·
**observability views** (metrics and traces).

**State can be rebuilt. Events are never rewritten. Corrections are appended as new events.**

### 6.5 Replay and Reconstruction

Replay supports reconstructing a session, rebuilding memory after corruption, debugging a failure,
comparing unit versions, running counterfactual paths, auditing policy decisions, training evolution
engines, and detecting drift.

Replay is deterministic where possible: **model and tool calls are recorded observations during
replay**, never re-invoked, unless explicitly running a simulation fork (see §11 determinism levels).

> **Implementation reality.** Deterministic replay within a process lifetime is `PRODUCTION` and
> tested. The *durable* event store is `PARTIAL`: the append-only file transport and the Postgres
> transport both exist and pass conformance, but the canonical `events` table is not yet the
> production source of truth. Closing this is the current architectural priority (ADR-0034).

---

## 7. Universal Cognitive Bus

**Status: `PARTIAL`.** In-process bus with typed publish/subscribe/replay and a governance
interceptor is `ADOPTED` and implemented. Multi-plane separation, semantic routing, and cross-region
replication are `SPECIFICATION`.

### 7.1 Purpose

The UCB is not a queue. It is a semantic, causal, policy-aware, replayable nervous system supporting
topic routing, semantic routing, priority, broadcast, point-to-point, consumer groups, durable
subscriptions, replay, causal ordering, dead-letter queues, backpressure, policy interception,
schema validation, and observability hooks.

### 7.2 Bus Planes

*`SPECIFICATION`*

| Plane | Purpose |
|---|---|
| Command | Directed requests requiring execution |
| Event | Immutable facts emitted by the system |
| State | World-state deltas and synchronization |
| Trace | Observability and reasoning traces |
| Governance | Policy decisions and audit events |
| Evolution | Experiment, mutation, rollout events |
| Realtime | Low-latency streaming to interfaces |

Plane separation prevents high-volume observability or realtime traffic from disrupting critical
workflow commands.

### 7.3 Semantic Routing

*`SPECIFICATION`*

The bus routes by meaning as well as topic: a Revision unit subscribes to any event semantically
indicating forgetting risk; a Socratic unit to confusion and contradiction signals; a Governance unit
to high-risk tool use. Routing combines embeddings, symbolic filters, policy tags, and payload
schemas.

### 7.4 Governance Interceptor

*`ADOPTED`*

Every publish and subscribe passes governance: is the producer allowed to emit this? is the payload
correctly classified? does it contain sensitive data? is the target allowed to receive it? does it
require human review? should it be redacted? what retention applies? **The bus is a policy
enforcement point.**

### 7.5 Failure Behavior

Dead-letter topics by family · poison-message quarantine · retry with jitter and capped backoff ·
idempotency keys · consumer lag alerts · backpressure propagation to the scheduler · replay
checkpoints · ordered processing for causally sensitive streams · out-of-order tolerance for
analytics.

---

## 8. Orchestration

**Status: `PARTIAL`.** Supervisor routing, the proposal blackboard, and disagreement-as-signal are
`ADOPTED` and implemented (ADR-0018, ADR-0025). The multi-level director hierarchy and orchestration
cells are `RESEARCH` — they exist to serve scale this system does not yet have.

### 8.1 From Supervisor to Fabric

Directors do not call units directly. They publish routing decisions, grant leases, and coordinate
through the bus and world-state graph.

### 8.2 Hierarchy

*`RESEARCH` above L2*

| Level | Name | Responsibility |
|---|---|---|
| L7 | Global meta-director | System-wide goals, evolution priorities, incidents |
| L6 | Regional director | Region health, data sovereignty, failover |
| L5 | Domain director | Education, research, infrastructure, governance |
| L4 | Capability director | Curriculum, assessment, memory, retrieval |
| L3 | Workflow director | Long-running journey, research pipeline |
| **L2** | **Session director** | **Active session and short-term routing** — *implemented* |
| **L1** | **Cognitive unit** | **Specialized execution** — *implemented* |
| **L0** | **Tool and model adapters** | **Concrete operations** — *implemented* |

### 8.3 Blackboard

*`ADOPTED`*

Direct unit-to-unit calls are forbidden (law 1). Units coordinate through blackboards: session
(active task, state, recent outputs, open questions) · workflow (milestones, artifacts,
dependencies) · classroom (transcript, scene, speaker queue) · research (hypotheses, evidence,
citations) · governance (concerns, decisions, overrides). Blackboard updates are world-state
mutations and bus events.

### 8.4 Dynamic Routing

Routing combines capability match · semantic intent match · learner state · unit health · prior
performance · cost · latency target · trust level · memory locality · policy constraints · reasoning
diversity · confidence requirement.

The question is never "which prompt should answer?" It is "which cognitive unit, under which lease,
with which reasoning engine, using which memory scope, in which zone, under which governance
envelope?"

### 8.5 Consensus and Disagreement

*`ADOPTED`*

For high-risk outputs, orchestration requests multiple independent units. Disagreement handling:
detect semantic divergence · compare evidence coverage · ask a critic to adjudicate · escalate to
human review if warranted · store the disagreement as a learning artifact · update reliability
metrics.

**Disagreement is a first-class signal, not a hidden race.** Hidden unit-to-unit override is an
integrity violation.

---

## 9. Temporal Cognition

**Status: `PARTIAL`.** HLC ordering, event-sourced timelines, and causal tracing are `ADOPTED`.
Timeline forking is `SPECIFICATION`. Developmental and institutional time scales are `RESEARCH`.

### 9.1 Temporal Layers

| Layer | Scale | Purpose |
|---|---|---|
| Working cognition | Seconds–minutes | Active reasoning, current task |
| Session cognition | Minutes–hours | Current learning or workflow arc |
| Episodic cognition | Days–months | Remembered interactions and outcomes |
| Developmental cognition | Months–years | Growth and identity evolution |
| Institutional cognition | Years | Collective curriculum and system learning |
| Civilizational cognition | Decades | Global knowledge and research evolution |

### 9.2 Timelines and Forking

Each major aggregate has a timeline — learner, concept, agent, workflow, memory, policy,
architecture, cohort, research frontier — replayable, forkable, comparable, compressible.

Forking supports testing a different explanation, prerequisite order, unit version, retrieval method,
or policy; and simulating future progress. **Forks are labeled simulation.**

### 9.3 Causal Graph

Every important event links to its causes: which input caused this answer, which retrieved memories
influenced this claim, which decision caused this branch, which policy blocked this action, which
mutation changed mastery, which version caused a regression. **Causal tracing is the foundation of
debugging intelligence.**

---

## 10. Unified World-State Graph

**Status: `PARTIAL`.** The in-memory delta-fold graph, typed deltas, and the domain query layer
(ADR-0015) are `ADOPTED`. Durable Postgres backing is **not yet wired** — see the note below.

### 10.1 Purpose

The world-state graph is the shared evolving model. Memory, orchestration, workflows, and runtime
state are **not separate realities** — they are projections of one evolving world model.

### 10.2 Graph Layers

| Layer | Nodes | Edges |
|---|---|---|
| Learner | Learners, goals, preferences, mastery states | learns, struggles_with, mastered, prefers |
| Knowledge | Concepts, domains, prerequisites, examples | requires, explains, contradicts, applies_to, bridges_to |
| Agent | Units, versions, capabilities, policies | can_perform, depends_on, evolved_from |
| Workflow | Workflows, tasks, milestones, artifacts | blocks, produces, consumes, resumes |
| Memory | Episodes, facts, procedures, reflections | supports, revises, decays, reinforces |
| Governance | Policies, grants, violations, reviews | allows, denies, requires_review |
| Observability | Traces, anomalies, failures, metrics | caused, correlated_with, recovered_by |
| Evolution | Proposals, experiments, rollouts, outcomes | tests, improves, regresses, supersedes |

### 10.3 Writes and Conflict

All writes are Memory Mutations or World-State Deltas: typed · versioned · causally linked · policy
checked · reversible where possible · evidence-backed · conflict aware.

**Semantic conflict resolution** goes beyond CRDTs. When two units estimate different mastery, or
memory contradicts recent behavior, or a dependency edge is disputed: detect · classify · compare
evidence · check source reliability · adjudicate via specialist if needed · **preserve the minority
view when useful** · emit a resolution event · update reliability metrics.

*(CRDT mechanics for concurrent distributed writes are retained from v3.0 §8.2 as `RESEARCH`; the
current single-writer delta fold does not require them.)*

> **Implementation reality.** `world_state_deltas`, `world_state_nodes`, and `world_state_edges`
> exist in migration `0001` and are referenced by almost no code. World-state currently persists as
> a JSON snapshot per surface. Law 11 is violated here until ADR-0034 is completed.

---

## 11. Execution, Threading, and Determinism

**Status: `ADOPTED`.** The deterministic execution engine, cognitive fibers, and determinism levels
are implemented in `@inevitable/execution`. *(Elevated from v4.0 §26 research tier — this material
graduated into production.)*

### 11.1 Cognitive Execution Engine

Turns cognitive plans into executable state transitions. Defines execution-graph lifecycle,
instruction lifecycle, queues, continuation passing, fiber execution, checkpoint cadence, failure
propagation, deterministic replay boundaries, resource metering, and state-transition validation.

States: `Planned` → `Admitted` → `Lowered` → `Queued` → `Running` → `Interrupted` → `Checkpointed` →
`Resumed` → `Completed` | `Failed` → `Compensated` → `Archived`.

Owner: `spec/execution/cognitive-execution-engine.md`.

### 11.2 Cognitive Threading

Units are too heavy to be the only execution primitive. Lightweight **fibers**: reasoning, retrieval,
verification, reflection, governance, memory consolidation, simulation, orchestration.

Semantics: cooperative scheduling by default · preemptive interruption for policy, safety, or
resource pressure · suspended cognition frames · resumable continuation tokens · parent-child
lineage · join, cancel, timeout, checkpoint.

### 11.3 Determinism Levels

| Level | Meaning |
|---|---|
| D0 | Non-replayable exploratory cognition |
| D1 | Event replay reconstructs state but not reasoning |
| D2 | Replay reconstructs routing, tool outputs, and state |
| D3 | Replay reconstructs the full execution graph with recorded model outputs |
| D4 | Simulation replay reruns with a changed component while preserving the environment |

**Production workflows target at least D2; high-risk workflows target D3.** D3 is realized through
the Model Invocation Protocol: record-before-use in live runs, resolve-from-record in replay, never
re-invoking the provider. A seeded record→replay round trip reproduces byte-identical output.

Requirements: stable HLC ordering · recorded model invocations · recorded tool results · explicit
nondeterminism markers · frozen context leases during replay · stable routing on replay ·
version-pinned units and protocols.

---

## 12. Memory

**Status: `PARTIAL` — the largest gap between this document and the code.** The Memory Mutation
Protocol and tiered projection are `ADOPTED`. Durable storage, consolidation as a running process,
decay scheduling, and cross-session retrieval are **not implemented**.

### 12.1 Memory Layers

| Layer | Purpose |
|---|---|
| Working | Current task context and transient reasoning state |
| Episodic | Interactions, events, attempts, confusion, feedback |
| Semantic | Concepts, prerequisites, mastery, knowledge structures |
| Procedural | How a learner learns; how units solve tasks |
| Reflective | Critiques, lessons, failures, self-review |
| Social | Educator, cohort, classroom interaction patterns |
| Institutional | Global curriculum, policy, and architecture learning |
| Governance | Policy decisions, violations, review history |
| Failure | Incidents, regressions, recovered faults |
| Evolution | Experiments and architecture changes |

### 12.2 Operational Hierarchy

*(From v4.0 §26.9 — the memory taxonomy as a cache hierarchy.)*

`L0` context registers → `L1` working memory → `L2` session blackboard → `L3` hot semantic cache →
`L4` warm episodic store → `L5` semantic graph → `L6` procedural memory → `L7` collective memory →
`L8` cold archive.

Policies: page context by relevance and permission · preserve provenance during compression · evict
low-value context under pressure · promote repeatedly useful memories · quarantine contaminated
memories · compact stale branches.

### 12.3 Operations

Retrieve · commit mutation · consolidate · diff · merge · decay · reinforce · redact · quarantine ·
replay · snapshot · restore · export under consent · forget under policy.

### 12.4 Consistency by Layer

| Layer | Consistency need |
|---|---|
| Working | Low latency, local consistency |
| Episodic | Append-only durability |
| Semantic mastery | Strong consistency per learner-concept edge |
| Collective | Eventual, with privacy aggregation |
| Governance | Strong consistency, immutable audit |
| Evolution | Strong consistency for rollout decisions |

### 12.5 Consolidation and Collective Privacy

Consolidation runs as durable workflows: compress episodes into stable patterns · convert repeated
confusion into misconception nodes · promote verified facts into semantic memory · decay
low-confidence stale memories · detect contradictions · build cohort difficulty maps. **Consolidation
must be observable and reversible.**

Collective memory is **never raw user memory**. It stores anonymized misconception patterns,
aggregated difficulty, effective explanation templates, successful prerequisite orderings, and
strategy outcomes. Personal data is stripped, bucketed, encrypted, or aggregated by policy.

### 12.6 Retrieval

**Retrieval is half of memory (law 12).** A complete retrieval path requires:
capture → normalize → structure → persist → index → relate → retrieve → reason → update → verify.

Required retrieval modes: semantic (vector) · graph (relationship traversal) · temporal (validity
windows) · contextual (lease-bounded) · hybrid ranking. Plus: relevance scoring, memory
consolidation, stale-memory handling, confidence, provenance, contradiction detection, and
learner-scoped, session-to-session continuity.

> **Implementation reality.** `ContextAssembler` implements lease-bounded semantic retrieval, but is
> constructed over an in-memory vector store that is rebuilt per session. There is no durable
> retrieval index, no graph retrieval, no temporal retrieval, and no hybrid ranking in production.
> `memory_mutations` is referenced by no code. This is the single largest gap in the substrate.

---

## 13. Cognitive Observability

**Status: `ADOPTED`.** Reasoning traces, the OTel edge, and the analysis engine (ADR-0017) are
implemented. Some health metrics below are `SPECIFICATION`.

### 13.1 Beyond Logs, Metrics, and Traces

Classical observability asks: is the service up? how slow? how many errors? Cognitive observability
asks: is reasoning improving or drifting? did hallucination propagate between units? did retrieval
bias the answer? did the learner actually understand? did units agree for the right reasons? did
confidence collapse silently? did an evolution experiment improve outcomes?

### 13.2 Telemetry Types

Reasoning trace · claim graph · confidence curve · disagreement map · drift signal · hallucination
lineage · memory influence graph · learner response signal · pedagogy outcome · workflow efficiency ·
evolution outcome.

### 13.3 Health Metrics

Evidence coverage · claim support ratio · unsupported assertion count · retrieval relevance · memory
contradiction rate · disagreement entropy · confidence calibration error · reasoning loop count ·
tool success rate · policy intervention rate · mastery prediction error · confusion recovery time ·
explanation success rate by concept · prerequisite correction rate · path efficiency · evolution win
rate.

### 13.4 Cognitive Debugging

Replay a session · inspect intent interpretation · inspect context lease · inspect retrieved
memories · inspect claims and evidence · inspect policy decisions · inspect routing · inspect tool
results · inspect world-state mutations · compare an alternate fork · patch and rerun.
**This is the debugger for intelligence.**

### 13.5 Alerting

Hallucination propagation · memory poisoning suspected · confidence collapse · recurring cohort
confusion · loop or deadlock · policy bypass attempted · retrieval quality below threshold ·
disagreement above threshold · persona drift · cost spike · consumer lag.

---

## 14. Governance

**Status: `ADOPTED`.** The governance kernel evaluates at the dispatch boundary before any state
mutation. The baseline policy set is thin and expected to grow.

### 14.1 Governance as Kernel Primitive

Governance is **not** an external moderation layer. It governs: who may spawn units · which tools
they may use · which memory layers are accessible · which outputs require evidence · which workflows
require review · which data may cross regions · which units may evolve · which mutations may deploy.

### 14.2 Policy Types

| Type | Example |
|---|---|
| Access | A unit may read semantic memory but not private twin memory |
| Tool | A research unit may use web search; an assessment unit may not send email |
| Data | Minor learner data may not leave region |
| Evidence | Medical, legal, or current factual claims require citation and review |
| Learning | Mastery cannot advance without depth verification |
| Cost | Long workflows require budget lease renewal |
| Evolution | Persona changes require shadow evaluation |
| Safety | Wellbeing topics require a specialized flow |
| Security | Detected prompt injection triggers tool isolation |

### 14.3 Policy Evaluation

Every decision produces: decision id · subject identity · resource · action · context · decision ·
reason · policy version · evidence · expiry · review path. **This creates explainable governance.**

### 14.4 Adaptive Governance

Trust rises after consistent safe behavior and falls after violations or drift. High-risk domains
trigger stricter evidence requirements. New unit versions start at lower trust. Suspected
contaminated memory is quarantined. Sensitive learner contexts receive stricter privacy handling.
**The policy system evolves only through approved Evolution Proposals.**

---

# PART III — COMMITTED DIRECTION

*Status: `SPECIFICATION` throughout. Decided and designed; not yet built. These require no new ADR
to begin — they are already adopted direction.*

## 15. Durable Workflows

Many cognitive processes cannot be single request-response calls: zero-to-mastery path generation,
research pipelines, live classroom generation, twin evolution, memory consolidation, curriculum
evolution, cohort analytics, unit evaluation, mutation rollout.

**Workflow contract:** workflow id · intent lease · input/output schema · milestones · checkpoints ·
timeout policy · retry policy · human review points · compensation actions · memory writes · events ·
metrics · rollback strategy.

**Patterns:** saga with compensation · human-in-the-loop · long-running research · scheduled
revision · event-triggered consolidation · multi-unit consensus · shadow evaluation · policy review.

Workflow state lives in **both** the durable engine (which knows how to resume) and the world-state
graph (which knows what the workflow means). The `WorkflowRuntime` contract exists in
`@inevitable/contracts`; no implementation is wired.

## 16. Evolution

### 16.1 The Controlled Loop

Observe → detect opportunity → form hypothesis → create proposal → build candidate → offline
evaluation → replay evaluation against historical sessions → shadow deployment → limited live
experiment → compare → roll out or roll back → store learning in evolution memory.

### 16.2 Evolvable Targets

Prompts · personas · reasoning strategies · routing policies · retrieval strategies · consolidation
rules · sequencing heuristics · assessment thresholds · tool selection · workflow topology · pool
sizing · governance policies · observability thresholds · scaling policy.

### 16.3 Mutation Risk Classes

| Class | Example | Required gate |
|---|---|---|
| E0 | Prompt wording | Automated eval + canary |
| E1 | Routing weight | Replay eval + shadow |
| E2 | Capability change | Human review + canary |
| E3 | Memory mutation rule | Offline replay + staged rollout |
| E4 | Governance policy | Security review + explicit approval |
| E5 | Kernel protocol | Architecture approval + migration plan |

### 16.4 Cross-Unit Intelligence

Intelligence evolves at four levels: **instance** (this session) · **persona** (this learner over
time) · **class** (this unit type across all sessions) · **ecosystem** (units exchange distilled
patterns through institutional memory).

Reliability scores per domain, age group, concept type, strategy, tool pattern, evidence quality,
safety, latency, cost, and long-term outcome feed routing. Capability discovery — a unit performing
well outside its declared role — produces **Evolution Proposals, never automatic privilege grants**.

> `EvolutionEngine` and `TwinRegistry` are implemented with deterministic shadow tests, but no
> product path reaches them. They are `PROTOTYPE`, not `PRODUCTION`.

## 17. Interoperability and Federation

UCI should interoperate with MCP servers, external agent runtimes, external memory systems, model
providers, workflow engines, browser automation, IDE agents, classroom systems, AR/VR runtimes, and
future cognitive protocols.

**Capability negotiation:** an external system declares who it is, what it can do, which protocols
and schemas it supports, what policies it requires, what data classifications it handles, what
observability it provides, and how it authenticates. The COS grants a capability envelope after
negotiation.

**Federation** — federated units, memory, classrooms, institute nodes, regional repositories,
curriculum evaluation — requires identity, trust, data sovereignty, and protocol compatibility.

The MCP manifestation is `ADOPTED` (ADR-0022, `apps/mcp`). Federation is `SPECIFICATION`.

## 18. Resilience and Security

### 18.1 Failure Taxonomy

Model outage · model degradation · tool failure · memory store failure · bus lag · worker crash ·
unit loop · deadlock · prompt injection · memory poisoning · region partition · cost spike · policy
misconfiguration · retrieval collapse · graph corruption · bad evolution rollout.

### 18.2 Mechanisms

Circuit breakers by model, tool, store, and unit type · bulkheads by workflow class · retry with
idempotency · dead-letter queues · quarantine · checkpoint and resume · memory snapshots · event
replay · graph repair · fallback model routing · graceful degradation · human escalation · evolution
rollback.

### 18.3 Degradation Modes

If vector retrieval fails → lexical and graph retrieval. If the live model fails → cached materials
and local revision mode. If the graph is degraded → last known snapshot. If the bus lags → pause
non-critical evolution and analytics. If the policy engine is unreachable → **deny high-risk
actions**, allow low-risk read-only work. If the unit population is overloaded → collapse to the core
set.

**Degradation is always visible, never silent.** A degraded response is stamped with its reason and
reduced confidence.

### 18.4 Zero-Trust Cognition

No cognitive unit is trusted by default. Every unit authenticates, declares capabilities, receives
leases, and emits auditable events. Primitives: cognitive identity · attestation chain · capability
envelope · context lease · intent lease · service identity · signed events · encrypted memory ·
secret isolation · prompt-injection detection · tool sandboxing · data classification · consent
ledger · audit log.

**Prompt injection defense layers:** classify external content as untrusted · separate instructions
from data · strip tool instructions from retrieved content · require tool calls to pass policy ·
track source provenance · detect suspicious instruction patterns · use least-privilege context
leases · quarantine compromised memory · require human review for high-impact side effects.

### 18.5 Data Rights

Consent-aware collection · export · deletion · redaction · regional control · child data
restrictions · guardian and educator access boundaries · collective anonymization.
**Security is not only defense; it is dignity for the people the system serves.**

The consent envelope and revoke→redaction cascade are `ADOPTED` (ADR-0054). Multi-tenant RLS
policies are **not implemented**: RLS is enabled on every table with zero policies, and the gateway
uses the service role, bypassing it. Tenant isolation is currently enforced by application code only.

---

# PART IV — LONG-HORIZON ARCHITECTURE

*Status: `RESEARCH` throughout. **This part is not law.** It is preserved because the thinking is
valuable and because deleting it would destroy real design work. Implementing any of it requires an
ADR that names the capability demanding it. Building from this part without that ADR violates the
no-speculative-architecture law.*

> **The agent-runtime research frontier lives in a dedicated corpus, not here.** How UCI's agents
> evolve into persistent, adaptive, governed **cognitive processes** over a programmable **Cognitive
> Environment** — the Living Agent thesis, the closed reflect→propose→govern loop, the Cognitive
> Process taxonomy (agent ⊂ process; *no hardcoded roster*), Recursive Cognitive Invocation, the
> Cognitive Scheduler, and the Prime-Agent/RLM/ACE synthesis — is developed in
> [`spec/research/living-cognitive-agents/`](../research/living-cognitive-agents/README.md) and its
> dual [`spec/research/persistent-cognitive-intelligence/`](../research/persistent-cognitive-intelligence/README.md).
> Both are `RESEARCH`, gated on ADRs; they graduate into Parts II–III of this document one capability
> at a time. This pointer exists so the law's reader knows where that frontier is worked out.

## 19. Kernel Internals

**Privilege model.** Kernel-mode cognition (identity, scheduling, governance, resource accounting,
leases, event validation, policy evaluation, recovery) versus user-mode cognition (units, reasoning
engines, workflows, tools, simulations). No user-mode unit may directly mutate kernel state; it must
request a typed syscall.

**Cognitive syscalls.** `COG_SPAWN` · `COG_SCHEDULE` · `COG_CONTEXT_LEASE` · `COG_MEMORY_MUTATE` ·
`COG_EVENT_PUBLISH` · `COG_TOOL_INVOKE` · `COG_REASON` · `COG_CHECKPOINT` · `COG_REPLAY` ·
`COG_FORK` · `COG_GOVERN` · `COG_EVOLVE`. Syscalls are where governance, observability,
replayability, and capability control become enforceable at the kernel boundary.

Also: cognitive privilege rings · trap handling · interrupt model · panic and recovery semantics ·
admission control · capability escalation and de-escalation · kernel audit events.
Owner: `spec/kernel-internals/cognition-syscalls.md`.

## 20. Cognitive IR, Compiler, and ISA

**Pipeline.** intent → interpretation → semantic task graph → **Cognitive IR** → orchestration graph
→ executable cognition DAG → scheduled fibers → events, traces, mutations.

**Cognitive IR** represents goals, constraints, concepts, dependencies, required evidence, required
memory, reasoning operations, tool operations, governance checkpoints, milestones, expected outputs,
risk class, and observability requirements.

**Compiler passes.** Intent normalization → goal decomposition → constraint extraction → concept and
memory binding → capability resolution → policy insertion → strategy selection → tool plan →
orchestration graph → cost/latency optimization → risk analysis → determinism annotation → runtime
lowering.

**Cognitive ISA.** `INTERPRET` · `DECOMPOSE` · `RETRIEVE` · `REASON` · `VERIFY` · `SIMULATE` ·
`REFLECT` · `CRITIQUE` · `ROUTE` · `SCHEDULE` · `MUTATE` · `CONSOLIDATE` · `CHECKPOINT` · `REPLAY` ·
`ESCALATE`.

*Rationale for research status: the current system compiles a goal into a concept DAG through a
model-backed curriculum unit. A formal IR and compiler become load-bearing only when plans must be
optimized, compared, and machine-rewritten — which requires the evolution loop to be live first.*

## 21. Scale, Distribution, and Economics

**Multi-region cognition.** Region types (primary, secondary, edge learning, offline, research,
governance) · replication strategy by data class · partition tolerance with bounded local autonomy,
HLC-queued local events, and post-reconnection conflict resolution.

**Beyond 10,000 units.** Avoid central supervisors · orchestration cells · shard by learner, class,
institution, region, domain · stateless units · durable state in stores and caches · event-driven
coordination · local blackboards · warm pools · capability-based scheduling · collapse under load ·
model routing and batching · async workflows.

**Population management.** Pool sizing · warm and cold starts · eviction · version rollout ·
quarantine · placement · cost optimization · capability coverage · load prediction.

**Load shedding.** Preserve active interactions and safety; pause background evolution and
analytics; defer consolidation; use cheaper models for low-risk tasks; reduce consensus; limit spawn
depth.

**Cognitive economics.** Reasoning budgets · token and compute accounting · priority economics ·
cost-aware routing · adaptive reasoning depth · semantic caching · inference minimization ·
energy-aware scheduling · low-cost fallback · budget lease renewal.

**Semantic caching.** Retrieval, reasoning-plan, explanation-pattern, decomposition, prerequisite,
tool-result, and evaluation caches. Every entry carries validity scope, adaptation constraints,
provenance, expiry, safety classification, and invalidation triggers.

**Cognitive networking stack.** A TCP/IP-like layering for distributed cognition: transport → event
transport → identity and trust → capability and policy → semantic routing → replication and
ordering → packet protocol → orchestration protocol → application cognition protocol.

## 22. Knowledge Quality and Epistemology

**Semantic consistency.** Beyond database consistency: claim compatibility · evidence sufficiency ·
confidence propagation · contradiction tolerance · source trust · temporal validity · context
dependence · pedagogical appropriateness. Semantic states: supported · weakly supported · contested ·
contradicted · outdated · context-dependent · unsafe to teach · requires review.

**Epistemology layer.** Belief objects · claim lifecycle · evidence lifecycle · confidence algebra ·
trust propagation · source reliability · contradiction handling · uncertainty representation ·
citation lineage · knowledge decay · frontier status. **Every claim taught should be representable as
a belief with evidence, confidence, validity scope, and provenance.**

> This is the closest research-tier section to production. The Claim Graph (ADR-0041) already
> implements epistemic status over cross-source claims, and
> `spec/research/persistent-cognitive-intelligence/` proposes generalizing it into a unified Belief
> primitive. That proposal is gated on per-learner calibration plus an ADR.

**Cognitive query engine.** A universal query layer across events, traces, memory, and world state,
combining temporal, graph, semantic, trace, causal, and policy-filtered querying — the analytics and
debugging language for cognition.

## 23. Simulation and Learning Science

**Simulation framework.** Synthetic learner lab · classroom lab · routing lab · memory corruption
lab · governance policy lab · mutation lab · failure lab · recursive-cognition safety lab.
Supporting offline replay, synthetic cohort generation, failure injection, policy testing, version
comparison, and pathway evaluation.

**Synthetic learners.** Models of prior knowledge, misconceptions, learning speed, cognitive load
tolerance, motivation, modality preference, language ability, forgetting curve, transfer ability, and
emotional response to failure. **Controlled test instruments, never replacements for real users.**

**Learning science layer.** Misconception topology · mastery transition mathematics · cognitive load
models · forgetting curves · spaced reinforcement · transfer maps · difficulty gradients ·
intervention policies · depth verification · velocity models. *Without this, "personalized learning"
remains prompt behavior rather than measurable infrastructure.* This layer belongs to the education
domain (`spec/product/domains/education/`), not to the substrate.

## 24. Housekeeping and Isolation

**Cognitive garbage collection.** Orphan units · zombie workflows · abandoned forks · expired leases ·
unreferenced summaries · dead semantic branches · stale versions · fragmented structures · duplicate
concept nodes · obsolete low-confidence claims. **GC is policy-aware and must never delete auditable
governance history or user-owned data without consent and retention checks.**

**Cognitive transactions.** Atomic single-store mutation · saga for distributed operations ·
two-phase commit only for narrow high-integrity kernel operations · compensating actions · semantic
rollback. Example: assessment accepted → mastery edge updated → episodic event committed → revision
schedule recalculated → timeline updated → metrics emitted. Partial failure rolls back mechanically
or emits compensating events.

**Distributed consensus.** Quorum for operational decisions · weighted epistemic consensus for
claims · Byzantine-aware for untrusted external units · human-chaired for high-risk contexts.
**Consensus preserves minority positions when uncertainty is meaningful.**

**Cognitive filesystem.** Concept-addressable storage with semantic directories, timeline snapshots,
provenance-linked objects, versioned artifacts, owned memory spaces, and access-controlled mounts —
e.g. `/learner/{id}/concepts/calculus/derivatives/mastery`.

**Cognitive hypervisor.** Runtime isolation for multi-tenancy, simulation sandboxes, version testing,
unsafe content containment, external federation, migration, and policy-specific environments.

**Recursive cognition stabilization.** Depth governors · self-reference detectors · loop breakers ·
entropy monitors · confidence collapse detectors · recursive hallucination lineage · spawn budgets ·
reflection limits · evolution sandboxing. **Recursive cognition should be powerful but bounded.**

**Formal failure semantics.** Each failure class — partial cognition, reasoning, evidence, retrieval,
mutation, semantic corruption, policy, orchestration instability, deadlock, recursive loop, model
degradation, tool fault, partition, evolution regression — defines detection, containment, recovery,
replay, and postmortem requirements.

**Cognitive benchmarking.** Continuous benchmarks for pedagogy, prerequisite quality, mastery
prediction, retrieval, long-horizon reasoning, disagreement, governance, replay determinism,
evolution safety, and cost — run on historical replay sets, synthetic learners, and controlled live
cohorts.

**Cognitive developer platform.** Cognition IDE · graph debugger · replay studio · orchestration
visualizer · protocol explorer · runtime inspector · semantic diff · memory lineage browser ·
manifest editor · evolution dashboard · policy decision explorer. *Without a developer layer, the
architecture becomes too complex to evolve safely.*

---

## Appendix A — What Was Superseded, and Why

Nothing below was deleted; all of it is preserved in `docs/history/architecture/`. It is listed here
so that its absence from the body is deliberate and traceable, not accidental.

| Superseded material | Source | Superseded by | Reason |
|---|---|---|---|
| Python dataclass implementations of CID, packet, HLC, quota, semaphore | v3.0 §2 | `spec/protocols/` JSON Schemas + `@inevitable/kernel`, `@inevitable/shared` | The codebase is TypeScript; JSON Schema is the canonical contract form (ADR-0003). The Python was illustrative and never normative |
| Technology picks: NATS, Neo4j, Qdrant-default, Redis, K3s, LiteLLM, Next.js 15, Socket.IO | v3.0 §23, §25.1 | ADR-0034 (Supabase-first Postgres), `spec/architecture/Tech-Stack.md` | Selection moved behind the eight-contract adapter seam; deferred graduations are recorded in ADR-0034 |
| "Weeks 1–52" Phase 0–4 roadmap | v3.0 §25.1 | `IMPLEMENTATION.md`, `spec/implementation-roadmaps/` | Status belongs in status documents; a roadmap inside an architecture doc goes stale silently |
| `COS_PRODUCTION_TARGETS` metric dictionary | v3.0 §25.2 | Capability records and `spec/observability/` | Targets are per-capability, evidence-bearing, and change often |
| The "18 Specialized Agent Pods" catalog and capability matrix | v3.0 §24.2, Appendix A | `packages/product-cognition/src/agent-catalog.ts` | The manifest catalog is the authority on which agents exist (§5.2). The prose list named ~10 agents that have no manifest |
| K3s deployment manifests and HPA autoscaling | v3.0 §23.2 | `spec/architecture/Tech-Stack.md`, deployment configs | Single-node deployment; premature |
| The "Document Status and Complementarity" truce clauses | both, opening | This document | The clause existed to suspend conflict detection between two rival documents. One document needs no truce |
| Recommended `spec/` folder tree | v4.0 §24.3 | `CLAUDE.md` §4 and the real `spec/` layout | The proposed tree named ~40 domains that were created empty and deleted in the 2026-08 reset |
| Duplicate coverage of §§1–26 | v3.0 entire | This document | 24 of 26 sections were the same section written twice |

## Appendix B — Section Mapping

For anyone following a citation into the archived originals:

| This document | v4.0 blueprint | v3.0 advanced-agent-architecture |
|---|---|---|
| §1 Philosophy | §1, Core Thesis | §1 |
| §2 Primitives | §2 | §2 |
| **§3 Architectural Laws** | **§25.4** | — |
| §4 Infrastructure | §3 | §23 |
| §5 Runtime | §4 | §3 |
| §6 Events | §5 | §4 |
| §7 Bus | §6 | §5 |
| §8 Orchestration | §7 | §6 |
| §9 Temporal | §8 | §7 |
| §10 World-state | §9 | §8 |
| §11 Execution/determinism | §26.3, §26.4, §26.8 | — |
| §12 Memory | §13, §26.9 | §12 |
| §13 Observability | §10 | §9 |
| §14 Governance | §11 | §10 |
| §15 Workflows | §15 | §14 |
| §16 Evolution | §12, §14 | §11, §13 |
| §17 Interop | §18 | §17 |
| §18 Resilience/security | §20, §21 | §19, §20 |
| §19 Kernel internals | §26.1, §26.2 | §26.1 |
| §20 IR/compiler/ISA | §26.5–26.7 | §26 |
| §21 Scale/economics | §19, §22, §26.19–26.21 | §18, §21 |
| §22 Epistemology | §26.13–26.15 | — |
| §23 Simulation | §26.16–26.18 | — |
| §24 Housekeeping | §26.10–26.12, §26.22–26.27 | — |

**Citation note.** References to `next-generation-cognitive-operating-system-blueprint#25.4` should
now point to `spec/architecture/uci-architecture.md#3-architectural-laws`.
