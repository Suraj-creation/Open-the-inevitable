```yaml
spec:
  title: Infrastructure Adapters & Conformance Harness
  domain: interop
  status: draft
  owner: infrastructure-team
  last_reviewed: 2026-06-02
  upstream_dependencies:
    - architecture-decisions/ADR-0005-infrastructure-adapters
    - protocols/cognitive-event-protocol
  downstream_dependencies:
    - services/event-bus
    - storage/store-backends
  related_protocols: [cognitive-event-protocol]
  related_events: []
  related_runtime_systems: [event-transport, graph-store, vector-store, relational-store]
  related_governance_systems: [governance-kernel]
  related_observability_systems: [observability-sink]
  semantic_tags: [adapters, conformance, nats, postgres, neo4j, qdrant, transport, stores, swappable]
  canonical_references: [architecture-decisions/ADR-0005-infrastructure-adapters]
```

# Infrastructure Adapters & Conformance Harness

## Purpose

Define how concrete backends (NATS, Postgres, Neo4j, Qdrant) implement the `@inevitable/contracts`
interfaces, and the **conformance harness** that guarantees every adapter preserves the canonical
semantics established by the in-memory reference implementations. Decision context:
[ADR-0005](../architecture-decisions/ADR-0005-infrastructure-adapters.md).

## Canonical Semantics (the contract under test)

- **EventTransport** — `publish(subject, event)` assigns a monotonic per-subject sequence and delivers
  to every active subscriber whose subject pattern matches; `subscribe` returns an unsubscribe handle;
  `replay(subject, fromSequence)` yields matching events in ascending sequence order. This mirrors the
  in-memory bus (`@inevitable/events`) exactly — the bus is the reference.
- **GraphStore** — `mutate` then `query` reflects writes; `snapshot(label)` is durable/restorable.
- **VectorStore** — `upsert` then `search` returns the upserted id ranked by similarity; `delete`
  removes it from subsequent searches.
- **RelationalStore** — `query` reflects committed writes; `transaction(fn)` is atomic (all-or-nothing).

## Adapter Catalog

| Adapter | Contract | Client (optional dep) | Status |
|---|---|---|---|
| `InMemoryEventTransport` | EventTransport | — | reference |
| `NatsEventTransport` | EventTransport | `nats` | wired, infra-gated |
| `InMemoryGraphStore` / `Neo4jGraphStore` | GraphStore | `neo4j-driver` | reference / wired |
| `InMemoryVectorStore` / `QdrantVectorStore` | VectorStore | `@qdrant/js-client-rest` | reference / wired |
| `InMemoryRelationalStore` / `PostgresRelationalStore` | RelationalStore | `pg` | reference / wired |

## Dependency-Optional Loading

Real clients are `optionalDependencies` loaded via a guarded dynamic `import()` at construction. Absent
client/infra → construction returns a typed `Result` error; the workspace still typechecks, lints, and
tests offline (ADR-0005 §3). No vendor type crosses the adapter boundary.

## Conformance Harness

Backend-agnostic test functions (`runEventTransportConformance(makeAdapter)`, `runGraphStoreConformance`,
…) assert the canonical semantics. The in-memory adapters pass them in the default offline pipeline;
the same suite runs against live NATS/Postgres/Neo4j/Qdrant in an infrastructure-provisioned pipeline.

## Governance, Failure, Testing, Evolution

- Adapters publish/deliver governed events unchanged; classification is preserved end-to-end.
- Connection loss → typed errors + bounded retry at the call site; never silent data loss.
- Tests: every adapter passes its conformance suite; offline pipeline runs in-memory adapters; live
  pipeline (Docker/service-containers) runs real backends.
- Evolution: new backends = new adapter module + harness pass. Kafka/Redis transports, pgvector vector
  store, and Memgraph/Kuzu graph stores are future additions behind the same contracts.
