# Technology Strategy — The Inevitable

**Status:** Canonical · living strategy document
**Owns:** the *why* and *where* of every technology choice in the platform
**Governed by:** `CLAUDE.md` §2 (Architectural Laws), `spec/next-generation-cognitive-operating-system-blueprint.md` §25.4
**Synthesizes the foundational decisions in:** ADR-0003 (tech stack), ADR-0004 (monorepo/tooling), ADR-0005 (infrastructure adapters), and every later ADR that named a technology.

---

## 0. How to read this document

This is not a dependency inventory. It is the **architectural reasoning** that determines which
technologies are appropriate for a Cognitive Operating System, and — more importantly — *where each
one is allowed to live*. The package manifests are the ground truth for what is installed; this
document is the ground truth for **why**, and for what may be added, deferred, or replaced.

For every technology the document answers the same questions: *What is it? Why is it here? What
architectural capability does it provide? What problem does it solve? What are the alternatives? Is
it replaceable? Where does it belong — substrate, product, application edge, or behind an adapter?*

The burden of proof is on **additions**. The default answer to "should we add technology X" is *no,
unless the architecture demands it and the addition can be expressed through a contract*. This
document exists so that future implementation decisions have a principled place to start, and so the
project does not accumulate technology by accident.

When this document and an ADR disagree, the ADR wins for the specific decision it records (ADRs are
dated, point-in-time law); this document is then wrong and must be updated. When this document and
the architecture invariants disagree, the **invariants win** — express the technology *through* the
invariant, never around it.

---

## 1. Technology Doctrine — the rules that choose technology

Every selection below is a consequence of these principles, not an independent preference. They are
derived directly from the constitution (`CLAUDE.md` §2) and the blueprint (§25.4).

1. **Contracts before implementations.** The canonical form of every protocol, event, and schema is
   **JSON Schema (Draft 2020-12)** in the schema registry; the canonical form of every infrastructure
   dependency is a **TypeScript adapter interface** in `@inevitable/contracts`. Implementations are
   downstream of contracts and are chosen second. (ADR-0003.)

2. **Adapters before direct dependencies.** No vendor SDK, transport, store, or model client is a
   substrate dependency. Each lives behind one of the eight adapter contracts and is loaded only at
   the deployment edge. *No vendor, model, transport, or store leaks past its adapter* (`CLAUDE.md` §2).

3. **Dependency direction points inward, always.** Manifestations depend on the substrate; the
   substrate depends on its contracts; contracts depend on nothing. A manifestation may never be
   imported by the substrate, and an adapter's internal client types may never cross the contract
   boundary. This is mechanically checkable and is checked (see §5, §6.13).

4. **Determinism and replayability are non-negotiable.** Every non-deterministic effect (model calls,
   tool calls, media synthesis) is **bounded at the adapter edge**: recorded as an event before use,
   resolved from the record on replay, never re-invoked. Any technology that cannot be recorded and
   replayed deterministically belongs behind a recording seam, not in the cognitive path.

5. **Offline-green is a hard build invariant.** `pnpm verify` (codegen → typecheck → test → lint →
   format) must pass with **zero live infrastructure** — no database, broker, model API, or network.
   A technology that cannot satisfy this is either provisioned at the edge (guarded dynamic import) or
   it does not enter the workspace.

6. **Governance, identity, and observability are kernel primitives, not libraries.** They are
   implemented *in the substrate*, not delegated to a vendor. External systems may receive their
   output (e.g. OpenTelemetry exports), but the policy engine, capability model, causal identity, and
   cognitive-analysis logic are ours and stay ours.

7. **Simplicity, and the burden of proof on additions.** Prefer a Node builtin to a dependency, a
   pure function to a service, a deferral to a premature commitment. The smallest viable surface that
   honours the architecture wins. Every dependency must justify its presence against this doctrine.

8. **Polyglot at the unit boundary, monoglot at the kernel.** TypeScript is the primary language for
   the kernel, runtime, orchestration, and experience layers because contracts are neutral and one
   language keeps the kernel coherent. Other languages (Python for ML/data-plane, future Rust/Go for
   hot paths) enter as **cognitive units through the ABI**, never by fragmenting the core. (ADR-0003.)

---

## 2. The Layering Model and the "Four Homes"

Every technology in the platform belongs to exactly one of four homes. Deciding the home *is* the
architectural decision; the product name is secondary.

| Home | What lives here | Dependency rule | Examples |
|---|---|---|---|
| **Substrate** | The cognitive OS primitives: contracts, reference semantics, kernel, runtime, memory, world-state, events, governance, scheduler, execution. | Depends only on contracts and other substrate packages. No vendor client, ever. | TypeScript, JSON Schema, HLC, the event bus, the policy engine, the world-state fold |
| **Adapters** | Concrete infrastructure bound to a contract. | Implements a contract; loads its client via guarded dynamic import; never imported by the substrate's cognitive path. | NATS, Neo4j, Qdrant, Postgres, Gemini, file/JSONL persistence |
| **Manifestations** | Surfaces that drive the substrate: API gateway, web client, CLI, SDK, MCP server, future apps. | Depend inward on the substrate (or only on the SDK). Never depended upon by the substrate. | `node:http` gateway, React/Vite client, the zero-dep SDK, the MCP stdio server |
| **Build & tooling plane** | Cross-cutting developer infrastructure that produces and verifies the other three. | Dev-time only; not shipped into the cognitive path. | pnpm, Turborepo, Vitest, ESLint/Prettier, codegen |

**The decision procedure for any new technology:**

- *Is it a cognitive primitive the OS must own?* → **substrate** (and own it; do not import a vendor).
- *Is it concrete infrastructure (a store, broker, model, tool)?* → **behind an adapter contract**,
  edge-provisioned, never a workspace dependency.
- *Is it a way for a user, agent, or external system to drive the OS?* → **manifestation**, depending
  inward only.
- *Does it only help us build/verify?* → **tooling plane**, dev-dependency only.

If a technology does not fit any home, that is strong evidence it should not be adopted yet.

**Scope boundary — this document maps how the COS *runs*, not how it *thinks*.** It owns
*infrastructure technology*: the stores, brokers, transports, models, and tooling that execute
cognition. It deliberately does **not** own the *cognitive architecture* — how the system reasons,
learns, evaluates, accumulates knowledge, researches, and improves itself. That stratum has its own
canonical map, [`Cognitive-Architecture.md`](./Cognitive-Architecture.md) (the forward-looking
companion to this document: *runs* vs *thinks*), which names the five emergent cognitive layers —
Capability, Evaluation, Knowledge, Research, Autonomous Improvement — and is deepened by the domain
specs (`spec/protocols/`, `spec/cognition/`, `spec/evaluation/`, `spec/evolution/`, …). The two strata
meet at the **inward seam** (§5A: the cognition protocols and the Cognitive Unit ABI). Where a
cognitive-architecture concern has direct technology consequences, this document names the seam and
points to the owning spec; it never restates the cognition design. An honest technology map must also
name its *blank regions* — the cognitive-architecture domains that are under-specified today are
surfaced in §7 and §9 and mapped in the companion, not hidden.

**The compositional layering (an architectural observation, not law).** Manifestations and products
do not call infrastructure; they compose **cognitive units**. Units are governed by the **Cognitive
Unit ABI**, exchange typed **cognition packets/events** over the bus, and reach infrastructure *only*
through the eight adapter contracts (§5). So the real layering is:
*products / surfaces → cognitive units → protocols + adapter contracts → infrastructure.* Note this
is **not** "capabilities compose contracts": a unit's declared *capabilities* are functional metadata
on the unit, not an interposed layer between units and contracts (see §5A on the two senses of
"capability"). The reusable building blocks are **units**, composed over **protocols**.

---

## 3. The Foundational Stack (what we use today, and why)

These are the choices that are *hard to reverse* and that everything else is built upon. They are
foundational precisely because they shape the contracts, not merely the implementations.

### 3.1 Language & runtime — TypeScript (strict ESM) on Node ≥ 20

- **Why:** one language across `packages/` and `apps/`; structural typing maps cleanly onto JSON
  Schema; a large async ecosystem; the reference repos and experience layer already lean this way.
- **Capability provided:** a single coherent kernel and runtime with generated, schema-checked types.
- **Problem solved:** avoids tooling fragmentation and per-language schema drift during the
  foundation phase.
- **Configuration:** TypeScript 5.7, `"type": "module"`, `moduleResolution: "Bundler"`,
  `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `isolatedModules`; shared `tsconfig.base.json`.
- **Alternatives:** Python-first kernel (matches the constitution prose and the ML ecosystem —
  rejected as *primary* for fragmentation; retained for ML/data-plane units); Rust/Go kernel (best
  for deterministic hot paths and isolation — deferred behind the ABI and adapter seam for a future
  ADR). (ADR-0003 §Alternatives.)
- **Replaceable?** The *primary language* is foundational and not casually replaceable. But the
  architecture is explicitly polyglot at the unit boundary, so a single hot-path service may be
  re-implemented in Rust/Go without a kernel rewrite.

### 3.2 Contract representation — JSON Schema (Draft 2020-12)

- **Why:** contracts must be language-neutral, validatable, registry-friendly, and portable across
  runtimes. JSON Schema is the **source of truth**; TypeScript types are illustrative projections
  generated from it. (ADR-0003 decision 1.)
- **Capability provided:** one canonical validation/enforcement point at the bus interceptor and the
  protocol registry; deterministically reconstructable, versioned events across language runtimes.
- **Tooling:** `ajv` 8 + `ajv-formats` validate at runtime and in tests; `json-schema-to-typescript`
  generates `src/generated/` (git-ignored, produced by `pnpm codegen`).
- **Alternatives:** Protobuf/Avro (stronger wire efficiency and codegen, heavier coordination cost,
  weaker fit for JSON-native event logs and human-readable replay) — not adopted; revisit only if a
  binary internal RPC plane (§6.13) is introduced.
- **Replaceable?** Foundational. The schema-as-truth principle is an invariant; the validator (`ajv`)
  is a replaceable implementation detail.

### 3.3 Monorepo, build & test — pnpm · Turborepo · Vitest

- **Why:** a contracts-first monorepo needs consistent build/typecheck/test/lint across many small
  packages with caching, but without heavy generator machinery. (ADR-0004.)
- **Stack:** **pnpm 9** (via Corepack) workspaces; **Turborepo** task graph with caching for
  `codegen/typecheck/test/lint/validate:schemas/build`; **Vitest 2** (node env, explicit imports);
  **ESLint 9** flat config + **typescript-eslint 8**; **Prettier 3**; **Husky 9** + lint-staged +
  commitlint (Conventional Commits, scope = package/domain); **tsx** for running TS entrypoints.
- **`node-linker=hoisted`:** a flat `node_modules` so shared dev tooling resolves from every package.
  Tradeoff: weaker isolation than pnpm's symlinked default (see §9, an assumption to revisit).
- **Capability provided:** `pnpm verify` reproduces the full CI gate locally and is the single
  definition of "green".
- **Alternatives:** Nx (richer task graph/generators, heavier — revisit if generator-driven
  scaffolding becomes valuable); npm workspaces (zero extra tooling, slower — the mental fallback).
- **Replaceable?** Tooling-plane; replaceable in principle, but stable and not worth churning.

### 3.4 Determinism primitives — Hybrid Logical Clocks, seeded ids & clocks

- **Why:** *time is ordered, not clocked* (§25.4-class invariant). Causal order, not wall-clock, is
  authoritative; replay must be exact.
- **Capability provided:** event sourcing, deterministic replay (D0–D3), causal tracing, and snapshot
  rehydration all rest on HLC ordering and seeded id/clock generation in `@inevitable/shared`.
- **Replaceable?** Foundational; these are substrate primitives, not dependencies.

---

## 4. Event Sourcing & Determinism as the Spine

Before the infrastructure, one architectural fact dominates every technology decision: **the
canonical record is an append-only event log, and all state is a pure fold of events.** World-state,
memory, and the cognitive surface are projections, not stores of record.

This is why the technology strategy looks the way it does:

- Stores (graph, vector, relational) are **materialized projections / caches** of the event log, not
  the source of truth — so they are swappable without data-model risk.
- Non-determinism is **bounded at the adapter edge.** `RecordingModelRuntime` wraps any
  `ModelRuntime`: in record mode it publishes a `model.output.recorded` event *before* returning the
  value; in replay mode it resolves from that event and **never re-invokes the provider** (fail-closed
  on a miss). The same seam applies to multimodal synthesis. This is determinism levels D0–D3 made
  concrete.
- Choreography and timing record **logical order and durations, never wall-clock positions**, so the
  same log replays to a byte-identical state on any machine. (ADR-0007.)

Any candidate technology is evaluated first against this spine: *can its effects be recorded and
replayed deterministically?* If not, it is confined behind a recording seam.

---

## 5. The Adapter Contracts — the substrate's seam to the world

`@inevitable/contracts` defines **exactly eight** infrastructure adapter interfaces. This set is the
complete list of places where the outside world is allowed to touch the cognitive OS. Adding a ninth
is a significant architectural act requiring an ADR.

The universal pattern (ADR-0005): a contract has (a) an **in-memory or pure-Node reference**
implementation that defines canonical semantics and is the offline default, and (b) zero or more
**edge adapters** whose heavy client is loaded via `requireOptional(specifier)` — a guarded dynamic
`import()`. An absent client returns a typed `E_ADAPTER_UNAVAILABLE`, so the workspace stays
offline-green. A **conformance harness** (`packages/adapters/src/conformance.ts`) defines correctness
once; every backend — in-memory, NATS, Postgres, Neo4j, Qdrant — must pass the same suite. Correctness
is defined by the reference, not by the vendor.

| Contract | Methods (shape) | Abstracts | Default candidate(s) | Implementations today |
|---|---|---|---|---|
| **`EventTransport`** | `publish` · `subscribe` · `replay(fromSequence)` | Durable event streaming | **NATS JetStream**; Kafka; Redis Streams | `InMemoryEventTransport` (reference), `FileEventTransport` (JSONL, `node:fs`), `NatsEventTransport` (edge) |
| **`WorkflowRuntime`** | `start` · `signal` · `checkpoint` · `resume` · `cancel` | Durable workflow execution | **Temporal-style** engine; event-sourced fallback | **Contract only — no backend yet** (the genuine gap; see §6.6, §9) |
| **`GraphStore`** | `query` · `mutate` · `snapshot` | Graph database | **Neo4j**; Memgraph; Kuzu | `Neo4jGraphStore` (edge). Reference graph semantics live in `@inevitable/world-state` (`WorldStateGraph`), not as a `GraphStore` impl |
| **`VectorStore`** | `upsert` · `search` · `delete` | Vector similarity search | **Qdrant**; pgvector; Weaviate | `InMemoryVectorStore` (reference), `QdrantVectorStore` (edge) |
| **`RelationalStore`** | `query(sql)` · `transaction` | ACID relational storage | **PostgreSQL 16 (+pgvector)**; CockroachDB | `PostgresRelationalStore` (edge). No in-memory reference yet |
| **`ModelRuntime`** | `generate` · `embed` | LLM generation + embeddings | capability-bound, vendor-agnostic | `NullModelRuntime` (deterministic), `GeminiModelRuntime` (edge), `RecordingModelRuntime` (D3 seam) |
| **`ToolRuntime`** | `discover` · `invoke` | Side-effecting tool ecosystems | MCP; gRPC; REST; local sandbox | `InMemoryToolRuntime` (governed: capability check + `tool.*` events) |
| **`ObservabilitySink`** | `trace(event)` · `metric` | Telemetry backends | **OpenTelemetry**; Langfuse; Prometheus | OTel bridge in `@inevitable/observability`; OTel SDK bootstrap in `services/data-plane` |

Two facts worth stating plainly, because they shape the roadmap:

- **The heavy clients are not workspace dependencies.** `nats`, `pg`, `neo4j-driver`, and
  `@qdrant/js-client-rest` appear nowhere in `package.json` — they are provisioned at the deployment
  edge. The substrate's only runtime dependencies are `@opentelemetry/api`, `ajv`/`ajv-formats`,
  `@google/genai` (edge-only, at the workspace root), and React/Vite (in `apps/web` alone).
- **`WorkflowRuntime` is the one contract with no implementation at all** — not even a reference.
  Durable orchestration currently relies on event sourcing + the in-process execution engine. This is
  the most significant production gap (§9).

### 5A. The inward seam — cognition protocols and the Cognitive Unit ABI

The eight adapter contracts face *outward*, at infrastructure. The substrate has an equally important
*inward* seam: the protocol contracts in `spec/protocols/` that compose **cognition itself**. They are
the technology answer to "how does the COS *think*?", exactly as §5's adapter table answers "how does
it *run*?".

| Protocol contract | Composes | Where |
|---|---|---|
| **Cognitive Unit ABI** | the plug-in contract every cognitive unit implements (lifecycle, descriptor, capabilities) | `spec/protocols/cognitive-unit-abi.md`, `@inevitable/runtime` |
| **Cognition Packet** | typed in-process exchange between units | `spec/protocols/cognition-packet-protocol.md` |
| **Cognitive Event** | the immutable bus envelope (identity, causation, HLC, classification) | `spec/protocols/cognitive-event-protocol.md`, `@inevitable/events` |
| **Memory Mutation** | the only legal way memory changes (§25.4 law 2) | `spec/protocols/memory-mutation-protocol.md`, `@inevitable/memory` |
| **Model Invocation** | the recorded, replayable model-call seam (D3) | `spec/protocols/model-invocation-protocol.md`, `@inevitable/adapters` |
| **Reasoning Trace** | the contract that makes reasoning observable/auditable | `spec/protocols/reasoning-trace-protocol.md` |

**This is where reusable cognitive capabilities actually live.** A *cognitive unit* is "the smallest
schedulable intelligence process" — intent inference, context assembly, curriculum projection,
explanation, mastery assessment, revision, memory commit, and so on. The implemented units are
catalogued in `MVP_AGENT_MANIFESTS` (`packages/product-cognition/src/agent-catalog.ts`). The concept
*is* first-class — under the name **cognitive unit**, not "capability service." Adding a reusable
cognitive capability means **adding a unit behind the ABI**, never adding a ninth adapter. Today units
are wired at composition roots rather than discovered through a dynamic registry; a runtime unit
registry — the **Capability Catalog** — is a natural future step (it does not yet exist). This inward
seam is the foundation of the **Cognitive Capability Layer** (Layer 1) in
[`Cognitive-Architecture.md`](./Cognitive-Architecture.md), which maps how reusable cognitive functions
compose into agents (ADR-0023).

> **Two senses of "capability" — do not conflate them.**
> (1) A **cognitive capability** is a *function a unit performs* — its `UnitDescriptor.capabilities`
> (e.g. `concept.explain`, `mastery.evaluate`, `intent.interpret`). This is the composition vocabulary.
> (2) A **capability envelope** (`spec/kernel/capability-envelope.md`, `CapabilityRegistry`) is a
> *governance grant* — what a unit is *permitted* to do (tools, memory scopes, models, cost ceilings),
> enforced at the kernel boundary. A unit must both *have* the cognitive capability and *be granted*
> the governing capability before it runs. These are orthogonal; the shared word is a known hazard and
> should be pinned by a glossary entry (`spec/glossary/` is currently empty).

---

## 6. Domain Technology Strategy

Each subsection maps **architectural capability → implied technology category → named candidate →
status → replaceability.** Status is one of `[adopted]` (in the cognitive path today), `[edge]`
(adapter exists, infra provisioned at deployment), `[contract-only]` (interface exists, no backend),
or `[deferred]` (not yet designed into code).

### 6.1 Events & messaging — the nervous system

- **Capability:** an immutable, causally-ordered, replayable event stream is *the* communication
  substrate. No component calls another directly; everything flows through the bus (§25.4 spirit).
- **Today `[adopted]`:** `@inevitable/events` provides the reference in-memory bus (HLC sequencing,
  pattern subscription, ordered replay, dead-letter, classification-driven retention).
- **Edge `[edge]`:** `NatsEventTransport` behind `EventTransport`. **NATS JetStream** is the default
  (hub-leaf topology for multi-region, durable streams + replay). **Kafka** at high throughput;
  **Redis Streams** for local. All swappable via the conformance-checked contract.
- **Replaceable?** Yes — the bus *semantics* are foundational; the broker is an adapter.

### 6.2 World-state & graph

- **Capability:** a single, versioned, event-sourced graph of all cognitive state — concepts,
  prerequisite DAGs, mastery, agents, orchestration. The knowledge graph is a *domain query layer over
  this graph*, not a separate store (ADR-0015).
- **Today `[adopted]`:** `@inevitable/world-state` (`WorldStateGraph`) folds typed deltas into a
  materialized, acyclicity-enforced graph with snapshot/restore — the in-memory reference semantics.
- **Edge `[edge]`:** `Neo4jGraphStore` behind `GraphStore`. **Neo4j** is the default (mature Cypher);
  **Memgraph** / **Kuzu** are candidates.
- **Replaceable?** Yes, with one caveat: `GraphStore.query/mutate` take raw query strings, so query
  *text* is dialect-coupled even though the client is swappable (see §9).

### 6.3 Memory substrate (multi-tier)

- **Capability:** durable, multi-tier cognition memory (working, episodic, semantic, procedural,
  reflective, and governance/collective tiers). Only durable tiers cross surfaces; session tiers are
  re-derivable. Memory changes only through typed memory mutations (§25.4 law 2).
- **Today `[adopted]`:** `@inevitable/memory` (`TieredMemoryStore`) — per-tier validated mutation logs,
  projections, decay, and subscription-based distribution, in-memory reference.
- **Tier → store mapping `[edge/deferred]`:** episodic → `RelationalStore` (**Postgres + pgvector**);
  semantic → `VectorStore` (**Qdrant**/pgvector); procedural → `GraphStore` (**Neo4j**, reusing
  world-state); working → fast cache (**Redis**, or in-process). Each is the same swappable adapter.
- **Replaceable?** Yes — the tier semantics are substrate; the backing stores are adapters.

### 6.4 Vector & retrieval

- **Capability:** semantic retrieval bounded by a `ContextLease` for adaptive, fail-closed
  working-memory assembly (ADR-0012).
- **Today `[adopted]`:** `@inevitable/context` (`ContextAssembler`) over a `VectorStore`, using a
  **deterministic local token-hash bag-of-words embedding** so retrieval is offline and replay-safe.
- **The real-embedding seam `[edge]`:** production-quality embeddings come through `ModelRuntime.embed`
  (`GeminiModelRuntime` implements it); the vector index is `QdrantVectorStore` or pgvector. The local
  embedding is a *correctness/replay* device, not a retrieval-quality choice (see §9).
- **Replaceable?** Both the embedding model and the vector store are adapters.

### 6.5 Relational & durable persistence

- **Capability:** the event log is the unit of durability; the system survives restarts and rehydrates
  live (ADR-0008/0009/0010/0011).
- **Today `[adopted]`:** `FileEventTransport` (append-only JSONL via `node:fs`) plus file-backed
  snapshots (`world.json`, `memory.json`) and a file media store — opt-in via `COS_PERSIST_DIR`, zero
  dependencies, conformance-checked against the in-memory reference. Learner identity and per-learner
  cognition persist as one JSON file per learner.
- **Edge `[edge]`:** `PostgresRelationalStore` behind `RelationalStore` for durable event log, audit,
  registries, and transactional integrity. **PostgreSQL 16** default; **CockroachDB** at multi-region.
- **Replaceable?** Yes — the file backend and Postgres backend are interchangeable adapters; the
  event-log-as-source-of-truth is the invariant.

### 6.6 Workflow & orchestration

- **Capability:** durable, checkpointable, signalable long-running cognition (no long-running workflow
  without an Intent Lease, §25.4 law 3).
- **Today `[adopted]`:** in-process orchestration — `@inevitable/orchestration` (`ProposalBlackboard`,
  `EvolutionEngine`) and `@inevitable/execution` (deterministic cognitive fibers + execution journal).
  Durability is provided by event sourcing, not by a workflow engine.
- **Gap `[contract-only]`:** `WorkflowRuntime` (Temporal-style: `start/signal/checkpoint/resume/cancel`)
  has no backend. The open question is whether the event-sourced fallback is sufficient or whether a
  **Temporal**-class engine (or a NATS-JetStream-backed durable engine) must be introduced — and when.
  This is the single largest production-readiness gap (§9, §10).
- **Replaceable?** It does not yet exist to replace; when adopted it must be behind the contract.

### 6.7 Model / AI infrastructure

- **Capability:** real cognition needs non-deterministic models; the OS needs determinism. Resolved by
  the **Model Invocation Protocol** and the recording seam.
- **Today `[adopted]`:** `ModelRuntime` (`generate`/`embed`) is the single, vendor-agnostic AI seam.
  `NullModelRuntime` is the deterministic offline default; `GeminiModelRuntime` (model
  `gemini-2.5-flash` via `@google/genai`, a guarded dynamic import, keyed by `GEMINI_API_KEY`) is the
  live provider; `RecordingModelRuntime` wraps either to realize D3 record→replay.
- **Deferred `[deferred]`:** streaming generation; tool-augmented invocation; multi-model
  routing/ensembles; a **second provider adapter**. Provider concentration on Gemini is a real risk the
  contract mitigates but does not eliminate — the recommended way to *prove* swappability is a second
  `ModelRuntime` (an Anthropic/Claude adapter is the natural, most-capable choice). (§9.)
- **Replaceable?** This is the whole point — the model is capability-bound, never vendor-bound.

### 6.8 Multimodal infrastructure

- **Capability:** the surface is multimodal (text, voice, image, video, simulation) through a
  **provider-agnostic** seam; no vendor SDK enters the surface runtime (SRF-004).
- **Today `[adopted]`:** a `ProviderRegistry` with typed provider interfaces; `NullVoiceRuntime`
  (deterministic) and `GeminiVoiceRuntime` (live). Media **binaries never enter the event log or
  world-state** — events carry only a reference + duration; bytes are served out-of-band from a media
  route. Non-deterministic outputs are recorded before use (the D3 seam again).
- **Deferred `[deferred]`:** Gemini (or other) image/video generation behind the same provider
  contracts; a durable **object store** (S3/GCS-class) for media at scale, behind a media-store seam.
- **Replaceable?** Yes — providers are registry entries; new modalities are entries, not rewrites.

### 6.9 Observability & cognitive analysis

- **Capability:** observability tracks not just system health but **reasoning quality** — drift,
  confidence calibration, disagreement, memory influence, learning outcomes (§25.4 spirit). No
  production cognitive unit without an observability contract (§25.4 law 10).
- **Today `[adopted]`:** `@inevitable/observability` provides the trace envelope, structured logger,
  metrics, an **OpenTelemetry** bridge (`@opentelemetry/api`), and the `CognitiveAnalysisEngine`
  (drift/calibration/outcome signals, ADR-0017). `services/data-plane` bootstraps the OTel SDK at the
  edge and sinks bus events to OTel.
- **Edge/deferred `[edge]`:** an OTel **Collector** plus backends — **Prometheus/Grafana** (metrics),
  **Tempo/Jaeger** (traces), **Langfuse** (reasoning-native LLM telemetry) — all behind the
  `ObservabilitySink` contract or standard OTel export. None are wired beyond the API today.
- **Replaceable?** The cognitive-analysis logic is substrate and stays ours; the telemetry backends are
  adapters/exports.

### 6.10 Governance, identity & security

- **Capability:** governance is a **kernel primitive**, enforced at every decision boundary (no
  side-effecting tool call without a governance decision; no agent runtime without manifest, identity,
  and capability envelope — §25.4 laws 5, 6). Identity is causal and non-delegable.
- **Today `[adopted]`:** `@inevitable/governance` (policy engine, decision records, enforcement
  middleware) and `@inevitable/kernel` (cognitive identity, capability envelope, `CapabilityRegistry`
  with dynamic grant/revoke, context/intent leases). Decisions are emitted as permanent audit events.
- **Deferred `[deferred]`:** **authentication / credentialed-user binding** (a learner is not yet bound
  to an authenticated principal) — the largest gap for any real deployment; **durable capability
  grants** (today in-memory); a secrets-management story for edge-provisioned credentials. These are
  product/edge concerns layered *on top of* the kernel's authorization model, never replacing it.
- **Replaceable?** The policy/identity model is foundational and ours; an external IdP (OIDC/OAuth)
  would sit behind an identity adapter when auth is introduced.

### 6.11 Real-time, streaming & the surface transport

- **Capability:** stream cognition to a viewport as it happens, resumably, with replay equivalence
  (client fold ≡ server state) (ADR-0006, SRF-005).
- **Today `[adopted]`:** **Server-Sent Events** down + **HTTP POST** (typed command envelope) up, over
  `node:http` — **zero new dependencies**, native `Last-Event-ID` resume, and a clean events-down /
  intents-up shape that mirrors the runtime.
- **Deferred `[deferred]`:** duplex **WebSocket/WebTransport** (only when true multi-writer interaction
  demands it); **CRDT** (e.g. Yjs/Automerge) for multi-user collaborative editing of the surface.
  Explicitly out of scope until the collaboration requirement is real.
- **Replaceable?** The transport is a manifestation choice; the canonical record (the `surface.*` event
  log) is transport-independent, so SSE→WebSocket is an additive change, not a rewrite.

### 6.12 Frontend / experience / rendering

- **Capability:** the Cognitive Surface — *the runtime is the product; the UI is a projection.* The
  client owns no truth; it folds the same events the server does.
- **Today `[adopted]`:** **React 19 + Vite 5** in `apps/web`, rendering through a **block-renderer
  registry keyed by `block_type`** (provider-agnostic; unknown types render typed placeholders).
  Layout, viewport, and transport state are client projections and never enter the canonical record.
- **Deferred `[deferred]`:** **Canvas/WebGL** for the spatial "Living-Canvas" projection of the surface
  (the scene-graph manifestation); richer animation/motion. These are additional *projections of the
  same substrate*, not new sources of truth.
- **Replaceable?** Entirely — the surface is a runtime; any renderer that consumes `surface.*` events is
  valid. React is a manifestation choice, not a substrate commitment.

### 6.13 Developer platform & external integration

- **Capability:** the substrate must be drivable by external systems *without* leaking internals — the
  proof of substrate-independence (§2, ADR-0022).
- **Today `[adopted]`:** `@inevitable/sdk` is a **zero-dependency** typed HTTP client (`CosClient`,
  injectable `fetch`); it imports nothing from `@inevitable/*` (verifiable: `grep "@inevitable"
  packages/sdk/src` is empty). `apps/mcp` is a stdio **MCP** server whose only COS import is the SDK,
  implemented as a hand-rolled **JSON-RPC 2.0** router (~70 lines, no `@modelcontextprotocol/sdk`),
  configured by `COS_API_URL`.
- **Deferred `[deferred]`:** adopting `@modelcontextprotocol/sdk` (when protocol breadth outweighs the
  zero-dependency proof); **gRPC/ConnectRPC** for internal service-to-service RPC (ADR-0003 named it as
  an option) when `services/` are deployed independently; auth at the SDK boundary.
- **Replaceable?** Manifestations are inherently disposable; the SDK is the stable inward contract.

### 6.14 Deployment & runtime isolation

- **Capability:** cognitive units run as portable, capability-enforced containers; the platform scales
  horizontally and runs local-first in development.
- **Direction `[deferred/edge]`:** **Docker** → **K3s/Kubernetes**, service mesh later (ADR-0003).
  `infrastructure/` holds environment/deploy/ops assets. Agent-runtime isolation is **container
  isolation now**, with **WASM/sandbox** for untrusted/federated units later (a future hypervisor ADR).
  None of this is materialized yet — it is directional and intentionally deferred until a deployable
  multi-service topology is needed.
- **Replaceable?** Deployment is an edge concern behind operational adapters; the substrate is
  deployment-agnostic by construction (offline-green, no infra dependency).

### 6.15 Testing & verification

- **Capability:** foundational work ships with unit, integration, governance, replay, and failure
  tests; nothing cognitive exists without observability hooks.
- **Today `[adopted]`:** **Vitest 2** across the workspace; the **conformance harness** (one suite per
  adopted contract); replay-equivalence tests (record→replay reproduces byte-identical state);
  governance-gate tests; deterministic offline runs via the `Null*` adapters.
- **Replaceable?** Tooling-plane; the *verification strategy* (conformance + replay + governance +
  failure) is the invariant, not the runner.

---

## 7. The Deferred Research Tier

These domains have specification folders and a clear cognitive intent, but **no implementation**, and
are consciously off the critical path (per `IMPLEMENTATION.md`). They are listed here so the burden of
proof is explicit: each names the trigger that would justify activating it.

| Domain | Envisioned capability | Implied technology category | Trigger to activate |
|---|---|---|---|
| `compiler` · `cognitive-ir` · `cognitive-isa` | Lowering intent → optimized cognitive plans | Compiler infrastructure (IR, pass framework, codegen) | Plan optimization becomes a measured bottleneck |
| `query-engine` | Temporal / causal / reasoning-path queries over the log | Query language + execution engine | Direct event/graph access stops scaling for introspection |
| `consensus` | Distributed/Byzantine agreement across nodes | Consensus protocol, quorum logic | Multi-node, multi-writer cognition becomes real |
| `cognitive-networking` · `networking` · `topology` | Cross-node transport, semantic routing, replication | Network stack, replication protocols | Distribution across regions is required |
| `economics` · `cognitive-economics` | Reasoning budgets, compute markets, cost routing | Cost models, market/allocation mechanisms | Resource contention needs market-based arbitration |
| `cognitive-filesystem` | Cognition-native, content-addressed, snapshotted storage | Virtual filesystem semantics (COW, semantic addressing) | Storage abstraction outgrows event-log + mutations |
| `federation` | External agents, federated memory, trust negotiation, data sovereignty | Federated-systems trust + partitioning | Cross-organization/regional cognition is required |
| `research` · `experimentation` | Research infrastructure: experiment registry, hypothesis/evidence tracking, research graph, finding extraction | Provenance + graph + registry over world-state/memory | The F10 research-mode *product feature* is built (it is fully specced but unimplemented). Today only the `EvolutionEngine`'s `evolution.experiment.*` events exist as a proto-experiment primitive |
| Architecture-level self-evolution | The platform evolving its own *structure and code* — not just pedagogy/config (which is built; see §6.6, §9.10) | Cognitive IR / compiler + codebase- and architecture-aware agents | A real evaluation layer (§9.9) **and** Cognitive IR exist, and governance is mature enough to gate structural change. Design/pseudocode only today (advanced-agent-architecture §11; blueprint §26.5) |
| `transactions` · `cognitive-gc` · `cognitive-safety` · `semantic-consistency` · `failure-semantics` · `epistemology` | Sagas/atomic mutations · compaction · self-modification limits · truth convergence · formal degraded modes · belief/uncertainty models | Distributed-systems + formal-methods techniques | The corresponding failure mode is observed at scale |

**Rule:** nothing from this tier is implemented "to be safe." It is implemented when the architecture
*forces* it, behind a contract, with a conformance/replay/governance test.

The `research`/`experimentation` and architecture-level self-evolution rows are the *infrastructure
shadows* of the **Research Layer** (Layer 4) and **Autonomous Improvement Layer** (Layer 5) in
[`Cognitive-Architecture.md`](./Cognitive-Architecture.md); their cognitive design, dependency order, and
activation triggers live there (ADR-0023). They appear here only to record that no infrastructure for
them is built today.

---

## 8. Foundational vs Optional — the load-bearing classification

| Foundational (changing it re-architects the system) | Optional / replaceable (behind a contract or a manifestation) |
|---|---|
| TypeScript as the primary kernel language | The specific model provider (Gemini today) |
| JSON Schema 2020-12 as canonical contract truth | The event broker (NATS / Kafka / Redis Streams) |
| Event sourcing + the pure-fold projection model | The graph store (Neo4j / Memgraph / Kuzu) |
| HLC causal ordering & deterministic replay (D0–D3) | The vector store (Qdrant / pgvector) |
| The eight-contract adapter seam itself | The relational store (Postgres / CockroachDB) |
| Kernel-native governance, identity, capabilities | The persistence backend (file/JSONL vs Postgres) |
| The Universal Cognitive Bus as the only inter-component path | The surface transport (SSE today; WebSocket later) |
| Inward dependency direction / substrate independence | The frontend framework (React) and any renderer |
| Offline-green build invariant | The observability backends (Prometheus/Grafana/Langfuse) |

If a proposed change touches the left column, it is an architectural decision requiring an ADR and a
coherence check against the invariants. If it touches the right column, it is a routine adapter or
manifestation choice — provided it is conformance-tested and stays offline-green.

---

## 9. Assumptions Challenged & Open Questions

The constitution asks that questionable assumptions be challenged rather than inherited. These are the
live ones.

1. **Hoisted `node_modules` (ADR-0004).** Chosen for simple shared-tooling resolution; it weakens
   dependency isolation. *Revisit before any package is published externally* — restore pnpm's
   symlinked layout and `tsc -b` composite emit at that point.

2. **No durable `WorkflowRuntime` backend.** The contract exists; nothing implements it. Long-running
   durability rests on event sourcing + in-process fibers. *Open question:* is the event-sourced
   fallback sufficient for crash/partition recovery of long workflows, or must a Temporal-class engine
   be adopted — and is it Temporal, or a NATS-JetStream-backed durable engine that reuses the broker we
   already default to? This is the top production-readiness gap.

3. **Deterministic local embedding ≠ retrieval quality.** The token-hash embedding exists for offline
   replay-safety, not relevance. Real retrieval requires `ModelRuntime.embed` + a real vector index.
   *Risk:* mistaking the local embedding for a retrieval-quality decision. The seam is correct; the
   quality is deferred.

4. **Hand-rolled MCP JSON-RPC vs `@modelcontextprotocol/sdk`.** The ~70-line router proves
   zero-dependency substrate independence beautifully, but will lag the MCP spec. *Open question:* at
   what point does protocol breadth (resources, prompts, streaming, auth) flip the burden of proof
   toward adopting the official SDK behind the same manifestation boundary?

5. **Single model provider (Gemini).** The `ModelRuntime` contract makes the model swappable, but only
   one real adapter exists, so swappability is asserted, not demonstrated. *Recommendation:* implement a
   second `ModelRuntime` adapter to prove it. An Anthropic/Claude adapter is the natural choice — it is
   the most capable current option and would validate the vendor-neutral contract end-to-end (record→
   replay must remain byte-identical across providers).

6. **Auth / identity binding is deferred.** Learner identity is durable but not bound to an
   authenticated principal. For any real multi-user deployment this is the first thing that must land,
   as an identity adapter feeding the existing kernel authorization model — *not* as a bolt-on.

7. **Raw query strings cross `GraphStore` and `RelationalStore`.** `query(cypher)` / `query(sql)` keep
   the *client* swappable but couple query *text* to a dialect. *Consider* a thin query-builder or a
   capability-scoped query layer if/when a backend swap is actually exercised, so the dialect coupling
   does not silently become lock-in.

8. **Observability backends are not wired past the API.** `@opentelemetry/api` and a data-plane sink
   exist; there is no Collector, dashboard, or trace store. Fine for now, but "we have observability"
   should not be overstated until an export path to a real backend is provisioned at the edge.

9. **There is no unifying evaluation / measurement architecture — the largest cognitive-architecture
   gap.** Evaluation today is three disconnected fragments: the `ShadowEvaluator` (evolution-only, a
   deterministic synthetic-learner projection — its formula is explicitly a placeholder), the
   `CognitiveAnalysisEngine` (post-hoc drift / calibration / outcome *observability*), and the
   `MasteryCheckpointRecorder` (per-learner verdicts) — plus the *infrastructure* conformance harness,
   which tests adapters, not cognition. The dedicated domains (`evaluation/`, `benchmarking/`,
   `cognitive-benchmarks/`, `synthetic-learners/`, `experimentation/`, `learning-science/`) are **empty
   placeholders**. Nothing benchmarks or regression-tests agents, reasoning, memory, retrieval,
   planning, or intent over time. This matters disproportionately because **the platform's two
   signature claims — *governed self-evolution* and *verified mastery* — both presuppose trustworthy
   evaluation.** This does **not** belong in this document; it is the **Cognitive Evaluation Layer**
   (Layer 2) of [`Cognitive-Architecture.md`](./Cognitive-Architecture.md) and will be deepened in a
   substantive `spec/evaluation/` owning spec plus an ADR when it activates. It is the recommended next
   cognitive-architecture investment, because it gates every layer above it (ADR-0023). (Flagged here
   only so the technology map names where the measurement layer plugs in.)

10. **Architecture-level self-improvement is unbuilt — and correctly deferred.** The platform can
    evolve *what it teaches* (the `EvolutionEngine`: pedagogy/config proposals, shadow-tested, governed,
    advisory-only). It cannot evolve *how it is built*: agent-persona / workflow self-optimization
    (advanced-agent-architecture §11) and the Cognitive IR the blueprint (§26.5) names as the
    prerequisite for self-improving architecture are design/pseudocode only. This is rightly downstream
    of §9.9 and Cognitive IR — trustworthy structural self-change requires a real evaluation layer
    first. It is the **Autonomous Improvement Layer** (Layer 5, deliberately last) in
    [`Cognitive-Architecture.md`](./Cognitive-Architecture.md); not a near-term addition (ADR-0023);
    tracked in §7.

11. **The "capability" terminology collision.** *Cognitive capability* (a unit's function) and
    *capability envelope* (a governance grant) share a word and are routinely conflated (§5A). Now
    resolved authoritatively in [`Cognitive-Architecture.md`](./Cognitive-Architecture.md) §4 (ADR-0023);
    the remaining low-effort step is a `spec/glossary/` entry pinning both terms (the folder is empty).

---

## 10. Adoption Posture (principle-driven, not dated)

How a technology earns its way in — independent of any particular sprint:

- **The gate for any addition:** (1) it implements or extends a contract; (2) it ships with a
  conformance/replay/governance test; (3) the workspace stays offline-green without it; (4) a major
  decision is recorded as an ADR; (5) it does not reverse the dependency direction.
- **The principled hardening order** (each step unblocks the next, and each is "promote an existing
  contract from reference/edge to provisioned", not "invent something new"):
  1. **Durable persistence** — Postgres behind `RelationalStore` / event log (the floor under
     everything). *Mostly in place via the file backend; Postgres is the scale step.*
  2. **Durable transport** — NATS JetStream behind `EventTransport` for multi-process/region.
  3. **Graph + vector stores** — Neo4j + Qdrant provisioned for real knowledge-graph and retrieval scale.
  4. **Durable workflow** — resolve the `WorkflowRuntime` gap (§9.2).
  5. **Multi-provider model** — a second `ModelRuntime` adapter to prove swappability (§9.5).
  6. **Authentication** — identity binding at the manifestation edge (§9.6).
- **A parallel cognitive-architecture track runs alongside, owned elsewhere.** The list above is
  *infrastructure* hardening. The cognitive layers have their own sequence — Capability →
  {Knowledge, Evaluation} → Research → Autonomous Improvement — mapped in
  [`Cognitive-Architecture.md`](./Cognitive-Architecture.md) (ADR-0023). The most urgent of these is a
  real **evaluation architecture** (§9.9, Layer 2), which gates trustworthy self-evolution and verified
  mastery. This document tracks only the *seam* where those layers meet infrastructure (the
  model/embedding adapters, the recording seam, the observability sinks).
- **Dated sequencing is not this document's job.** Phase plans live in
  `spec/implementation-roadmaps/`; current state and active frontier live in `IMPLEMENTATION.md`. This
  document states *what is appropriate and why*, not *when*.

---

## 11. Maintenance & Governance of this document

- **This is a strategy document, not a status document.** It must not accumulate "what shipped"
  inventories, version pins beyond what illustrates a decision, or dated narratives. Those belong in
  `IMPLEMENTATION.md`, `CHANGELOG.md`, and `docs/history/`.
- **Update it when the *strategy* changes:** a new adapter contract, a foundational-column change
  (§8), a resolved open question (§9), or a new domain crossing from deferred (§7) into the cognitive
  path. Routine version bumps do not touch this file.
- **Relationship to ADRs:** ADRs remain the authoritative, point-in-time decision records. This
  document is their synthesis and the place to start. A new infrastructure decision is still made *in
  an ADR* and then reflected here.
- **Altitude discipline:** if an edit would turn a *why/where* statement into a *what-we-built*
  statement, it belongs in another home. Keep this document about thinking, not bookkeeping.
