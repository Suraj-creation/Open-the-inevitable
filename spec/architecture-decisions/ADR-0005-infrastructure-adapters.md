# ADR-0005 — Infrastructure Adapters & Conformance Harness

- **Status:** accepted
- **Date:** 2026-06-02
- **Deciders:** runtime-team, infrastructure-team
- **Supersedes:** —
- **Related:** [ADR-0003 (tech stack)](./ADR-0003-tech-stack.md), [ADR-0004 (monorepo & tooling)](./ADR-0004-monorepo-and-tooling.md), `packages/contracts`, [spec/interop/infrastructure-adapters](../interop/infrastructure-adapters.md)

## Context

ADR-0003 mandates *contracts-first*: every infrastructure dependency sits behind an interface in
`@inevitable/contracts` (`EventTransport`, `GraphStore`, `VectorStore`, `RelationalStore`,
`ModelRuntime`, `ToolRuntime`, `WorkflowRuntime`, `ObservabilitySink`) so backends are swappable. Phase
1D must deliver concrete adapters — a NATS event transport, plus Postgres / Neo4j / Qdrant stores —
without (a) coupling the substrate to any vendor, (b) breaking `pnpm verify` in environments where the
heavy client libraries and live infrastructure are absent, or (c) letting adapters drift from the
canonical semantics defined by the in-memory reference implementations.

## Decision

1. **A dedicated `@inevitable/adapters` package** hosts all concrete adapters plus a **conformance
   harness**. The in-memory `InMemoryEventBus` (`@inevitable/events`) is the **reference semantics**; a
   reference in-memory adapter for each contract defines canonical behavior and must pass the harness.
2. **The conformance harness is the contract test.** It is a set of backend-agnostic test functions
   that exercise an adapter against the canonical semantics (publish→deliver→replay ordering for
   transport; upsert/query/delete for stores). Every adapter — in-memory, NATS, Postgres, Neo4j,
   Qdrant — must pass the *same* suite. "A NATS transport with the in-memory bus as reference
   semantics" means precisely this: NATS is correct iff it passes the harness the in-memory adapter
   passes.
3. **Real client libraries are dependency-optional and provisioned at the edge.** NATS/pg/neo4j/Qdrant
   clients are **not** workspace dependencies — they are installed in the deployment image and loaded
   via a guarded dynamic `import()` (with a variable specifier) at construction time. If the client (or
   live infra) is absent, `connect()` returns a typed `E_ADAPTER_UNAVAILABLE` error; it never breaks
   typecheck/lint/test of the workspace. This keeps the default pipeline green fully offline (no
   registry access) while the same code runs for real once the dependency and infrastructure are
   present. (Implemented by `@inevitable/adapters` via `requireOptional()`.)
4. **No vendor types leak past the adapter boundary.** Each adapter narrows the loosely-typed client
   to a minimal local interface and exposes only the `@inevitable/contracts` surface.

## Consequences

**Positive:** backends are swappable and independently testable; correctness is defined once and
enforced uniformly; the substrate verifies offline; live integration tests can run the identical
harness in an infra-provisioned environment (CI service containers or local Docker).

**Negative / trade-offs:** dynamic import means client type-safety is enforced at the narrow adapter
seam rather than by the compiler across the boundary; live integration coverage requires provisioned
infrastructure and is therefore gated/optional in the default pipeline (documented, not silent).

**Neutral:** adapters are versioned with their contracts; adding a backend = a new adapter module + a
harness pass, no change to consumers.
