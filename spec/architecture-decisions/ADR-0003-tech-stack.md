# ADR-0003: Foundational Technology Stack

**Status:** Accepted
**Date:** 2026-06-02
**Supersedes:** none
**Related:** [ADR-0001](ADR-0001-spec-first-cos-foundation.md), [ADR-0002](ADR-0002-reference-repo-learning-substrate.md)

## Context

The Inevitable is entering Phase 1B: foundational kernel, protocol, event, and runtime specs,
followed by Phase 1C package contracts. Before contracts are authored, the project must commit to
a primary implementation language and a contract representation strategy. The two architecture
constitutions express their primitives in Python (FastAPI, asyncio, pydantic), while the code
ownership skeleton (`packages/`, `apps/web`, `apps/api`) and the reference repos (`pi`, `paperclip`,
`hermes-agent`, `OpenMAIC`) lean toward a TypeScript/Node monorepo. The constitutions also state
the controlling principle directly: *"The architecture should specify contracts first and
implementation choices second"* and *"every major infrastructure dependency should sit behind an
adapter contract."* This ADR resolves the language and contract-representation question without
prematurely freezing infrastructure choices.

This decision is consequential and hard to reverse: it sets how schema examples are written in all
Phase 1B specs and what every Phase 1C package contract looks like.

## Decision

1. **Contracts are language-neutral.** The canonical representation of every protocol, event, and
   schema is **JSON Schema (Draft 2020-12)** stored in the protocol/schema registry. JSON Schema is
   the source of truth; all language bindings are generated from or validated against it.
2. **TypeScript is the primary implementation language** for the cognitive kernel, runtime,
   control-plane, orchestration, and experience layers. TypeScript types are **illustrative
   projections** of the canonical JSON Schema, not the source of truth.
3. **Polyglot cognitive units remain first-class.** Because contracts are neutral, Python (reasoning,
   ML, data-plane workers) and future Rust/Go (hot-path kernel services) units plug in through the
   [Cognitive Unit ABI](../protocols/cognitive-unit-abi.md) and the
   [Cognition Packet](../protocols/cognition-packet-protocol.md) /
   [Cognitive Event](../protocols/cognitive-event-protocol.md) protocols without rewriting the core.
4. **Infrastructure dependencies sit behind adapter contracts** (transport, workflow, graph, vector,
   relational, model, tool, observability). Concrete products are chosen per the constitutions'
   defaults but are swappable.

## Evaluation by Domain

Defaults synthesized from the two constitutions, kept behind adapter contracts so they are replaceable.

| Domain | Choice | Rationale | Adapter contract |
|---|---|---|---|
| Runtime / language | **TypeScript (Node, strict)**; Python for ML/data-plane workers | Single language across `packages/` + `apps/`; structural typing maps cleanly to JSON Schema; large async ecosystem. Python retained where the ML ecosystem is decisive. | n/a (language) |
| Contract representation | **JSON Schema 2020-12** + generated TS types (e.g. Zod/`json-schema-to-typescript`) | Neutral, validatable, registry-friendly, portable across languages. | Protocol/schema registry |
| API layer | **HTTP + WebSocket/SSE edge**, internal **gRPC/ConnectRPC** option | Realtime UX needs streaming; typed internal RPC for service-to-service. | API gateway adapter |
| Event infrastructure | **NATS JetStream** (primary), Kafka at high throughput, Redis Streams local | Hub-leaf topology fits multi-region; durable streams + replay; constitutions' default. | `publish/subscribe/replay/ack/dead-letter` |
| Workflow runtime | **Durable workflow engine** (Temporal-style), event-sourced fallback | Survives restarts/partitions; checkpoint/resume/signals/cancellation. | `start/signal/checkpoint/resume/cancel` |
| Graph memory | **Neo4j** (default), Memgraph/Kuzu candidates | World-state graph + prerequisite graphs; mature Cypher. | `query/mutate/diff/merge/snapshot` |
| Vector memory | **Qdrant** (default), pgvector for co-located | Semantic memory + semantic subscriptions. | `embed/upsert/search/filter/delete` |
| Relational store | **PostgreSQL 16 + pgvector**, CockroachDB at multi-region scale | Episodic memory, registries, transactional integrity, HLC-friendly. | `transaction/migration/snapshot` |
| Observability | **OpenTelemetry** + Langfuse + Prometheus/Grafana | Standard traces/metrics plus reasoning-native telemetry. | `trace/metric/log/cognitive-event` |
| Infrastructure | **Docker** → **K3s/Kubernetes**, service mesh later | Cognitive containers; HPA autoscaling; local-first dev. | deployment adapter |
| Agent-runtime isolation | **Container isolation** now; WASM/sandbox for untrusted units later | Capability-envelope enforcement; hypervisor direction for federation. | hypervisor/sandbox adapter |

## Alternatives Considered

- **Python-first kernel.** Matches the constitution code examples and the ML ecosystem. Rejected as
  *primary* because it diverges from the existing `packages/` monorepo skeleton and the
  experience/control-plane surfaces, fragmenting tooling. Retained for data-plane/reasoning workers.
- **Polyglot from day one (TS + Python + Protobuf).** Strongest long-term, but imposes high
  coordination cost in the foundation phase. Adopted *partially*: neutral contracts now, polyglot
  units enabled, but a single primary language to keep the kernel coherent.
- **Rust/Go kernel.** Best for deterministic hot paths and isolation. Deferred: premature for a
  spec-and-contracts phase; revisit for the deterministic execution engine and hypervisor via a
  future ADR. The adapter contracts keep this option open.

## Consequences

- **Scalability:** Neutral contracts + adapter boundaries allow swapping NATS→Kafka, Neo4j→Memgraph,
  and introducing Rust services without breaking the ABI.
- **Replay/determinism:** JSON Schema + versioned events make recorded packets/events portable and
  deterministically reconstructable across language runtimes (see determinism levels D0–D4).
- **Governance:** A single canonical schema gives one validation/enforcement point at the bus
  interceptor and protocol registry; no per-language schema drift.
- **Evolution:** New cognitive units in any language integrate via the ABI; language migration of a
  single service does not require a kernel rewrite.
- **Obligations:** Every protocol/event spec MUST include a canonical JSON Schema block. TS types in
  specs are explicitly marked illustrative. A schema-registry + codegen step is required in Phase 1C.
- **Reference-repo learning (ADR-0002):** Patterns from `pi` (TS evented harness), `paperclip`
  (control plane), and `hermes-agent` (persistent runtime) are now directly transferable.

## Open Questions

- Which durable-workflow engine (hosted Temporal vs. embedded event-sourced) becomes canonical — to
  be settled in the Phase 1D workflow spec + a follow-up ADR.
- WASM vs. container isolation boundary for untrusted/federated units — Phase 1E+ (cognitive
  hypervisor) ADR.
