# ADR-0012 — Context-Lease-Bounded Retrieval & Working-Memory Assembly

- **Status:** accepted
- **Date:** 2026-06-20
- **Deciders:** runtime-team
- **Supersedes:** —
- **Related:** [ADR-0011 (shared learner cognition)](./ADR-0011-shared-learner-cognition.md), [spec/persistence/context-lease-bounded-retrieval](../persistence/context-lease-bounded-retrieval.md), [spec/kernel/context-lease](../kernel/context-lease.md), [spec/memory/memory-tiers](../memory/memory-tiers.md), `@inevitable/context`, `@inevitable/adapters` (VectorStore), `apps/cli`, `apps/api`

## Context

DPS-004 made a learner's durable cognition present in every new surface, but nothing selects from it and
the per-session `ContextLease` (`memory_layers`, `allowed_users`, `token_budget`, `expires_at`) is
declared yet inert. A growing memory needs a bounded, relevance-ranked path into cognition, and the lease
needs to become an enforced boundary — the precondition for adaptive, grounded explanation (P3/F04).

## Decision

1. **A dedicated substrate package `@inevitable/context`.** A `ContextAssembler` indexes eligible memory
   items into a `VectorStore` (the `@inevitable/contracts` adapter; `InMemoryVectorStore` by default,
   Qdrant/pgvector later) and assembles a `WorkingMemoryContext` for a query, **bounded fail-closed by a
   `ContextLease`**: tier scope (`memory_layers`), user scope (`allowed_users`), token budget, and
   expiry. Exclusions are counted and reported (`excludedByLease`, `droppedForBudget`) — the boundary is
   observable, never silent. A focused package (matching world-state/memory/scheduler) is the right home;
   it depends only on shared/protocols/contracts (no cycle, no vendor leak).

2. **Deterministic local embedding, not a model `embed()` call.** Retrieval uses a token-hashing
   bag-of-words embedding so assembly is **replay-safe and offline** — the same (memory, query, lease)
   always yields the identical context. A model `embed()` is non-deterministic, empty under the
   NullModelRuntime, and would require the D3 recording seam; model-backed embeddings are a documented
   future refinement behind the same `ContextAssembler` seam. Only non-zero-similarity items are admitted
   (no off-topic padding).

3. **Assembly writes to the `working` tier (substrate-native distribution).** Selected items are
   committed as validated `working` memory mutations carrying `context_lease_ref` + the source mutation
   id. The working tier is the real-time distribution channel (memory-tiers), so an assembled context is
   distributed to subscribed agents on commit. `working` is session scratch and is excluded from DPS-004
   cross-surface capture, so an assembled context never leaks into the durable profile or another surface.

4. **Retrieve/bound/assemble now; consume in P3.** This decision deliberately stops at assembly. Making
   the explanation/curriculum agents *consume* the assembled working memory in their prompts (grounding
   on prior knowledge) is adaptive prompt assembly — P3/F04 depth. The lease-bounding is a real security
   primitive independent of consumption; splitting it keeps P2.4 contained and matches the roadmap.

5. **Exposed through the composition root.** `buildDemoSession` constructs the assembler (with an injected
   `InMemoryVectorStore`) and exposes `assembleContext(query)`; the gateway calls it on each `ask`. This
   reuses the established fixture seam (`DemoFixture`) that `apps/api` already consumes, rather than
   threading retrieval through the surface/loop internals.

## Consequences

**Positive:** the context lease becomes an enforced, auditable boundary (real per-learner, per-tier,
per-budget scoping of what cognition is in play); a growing durable memory has a bounded, relevance-ranked
path into working memory; the VectorStore contract gains its first real consumer (Qdrant/pgvector drop in
later); retrieval is fully deterministic/offline/replay-safe; the substrate for adaptive grounded
explanation (P3) exists.

**Negative / trade-offs:** the assembled working memory is **not yet consumed** by agent prompts (P3), so
the end-to-end "grounded explanation" payoff is one increment away; the deterministic embedding is a
bag-of-words approximation (no true semantic understanding) until model embeddings land; classification-
ceiling bounding is deferred (the `ContextLease` carries no ceiling — that lives on the capability
envelope, a future addition); re-assembling each `ask` appends working mutations (compaction deferred).

**Neutral:** retrieval rides on the in-memory VectorStore by default (no infra); a fresh learner assembles
an empty context (no-op); no new event family is added (assembly is recorded as working-tier mutations).
