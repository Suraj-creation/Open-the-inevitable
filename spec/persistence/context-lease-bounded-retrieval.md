```yaml
spec:
  title: Context-Lease-Bounded Retrieval & Working-Memory Assembly
  domain: persistence
  status: draft
  owner: runtime-team
  last_reviewed: 2026-06-20
  upstream_dependencies:
    - persistence/shared-learner-cognition
    - kernel/context-lease
    - memory/memory-tiers
    - interop/infrastructure-adapters
  downstream_dependencies:
    - product/features/F04-adaptive-explanation
    - product/features/F05-persistent-cognitive-memory
    - agents/agent-catalog
  related_protocols:
    - memory-mutation-protocol
    - context-lease
  related_events: []
  related_runtime_systems: [tiered-memory, context-assembler, vector-store, surface-session]
  related_governance_systems: [governance-kernel, context-lease]
  related_observability_systems: [cognitive-observability]
  semantic_tags: [retrieval, context, lease, working-memory, vector, embedding, bounded, learner]
  canonical_references:
    - next-generation-cognitive-operating-system-blueprint#8
    - architecture-decisions/ADR-0012-context-lease-bounded-retrieval
```

# Context-Lease-Bounded Retrieval & Working-Memory Assembly (DPS-005)

## Purpose

DPS-004 made a learner's durable cognition **present** in every new surface (prior mastery + semantic
memory seeded in). This spec makes it **usable on demand**: given a goal, assemble a *bounded* slice of
the learner's relevant prior knowledge into working memory — retrieved by semantic similarity and
**bounded by the learner's context lease** (which tiers, which users, how many tokens). It is the fifth
movement of the continuity arc (durability → state → identity → cognition → **retrieval**) and the
precondition for adaptive, grounded explanation (F04 depth, P3): an agent can only adapt to what the
learner knows if that knowledge is retrieved and bounded first.

## The gap it closes

After DPS-004 a returning learner's surface *holds* their durable knowledge, but nothing **selects**
from it: there is no retrieval, and nothing enforces the context lease that already exists on every
session (`memory_layers`, `allowed_users`, `token_budget`). So the lease is declared but inert, and a
growing memory has no bounded, relevance-ranked path into a prompt. This spec turns the lease into an
enforced boundary and adds the retrieval + assembly step.

## The lease is the boundary

Every session already carries a `ContextLease` (kernel/context-lease):
`{ lease_id, granted_to, memory_layers[], allowed_users[], token_budget, expires_at }`. Retrieval is
bounded by it, fail-closed:

- **Tier scope** — only items whose `memory_layer ∈ lease.memory_layers` are eligible. A lease that
  grants `["working","semantic"]` can never surface `procedural` or `governance` memory.
- **User scope** — only items whose owner ∈ `lease.allowed_users` are eligible (no cross-learner leak).
  An absent `allowed_users` means no user restriction (single-tenant default).
- **Token budget** — the assembled context never exceeds `lease.token_budget` (estimated). Relevance-
  ranked items are admitted greedily by score; the remainder are reported as *dropped for budget*, never
  silently truncated.
- **Expiry** — a lease past `expires_at` (relative to the session clock) assembles **nothing**.

What the lease excludes is **counted and reported** (`excludedByLease`, `droppedForBudget`) so the
boundary is observable, not invisible.

## Retrieval (VectorStore-backed, deterministic)

A `ContextAssembler` indexes eligible memory items into a `VectorStore` (the `@inevitable/contracts`
adapter — `InMemoryVectorStore` by default, Qdrant/pgvector later) keyed by a stable id, and ranks them
against the query by cosine similarity.

Embeddings use a **deterministic local embedding** (a token-hashing bag-of-words vector), not a model
`embed()` call. This is a deliberate choice: retrieval must be **replay-safe and offline** (a model
embedding is non-deterministic and would need the D3 recording seam, and is empty under the
NullModelRuntime). Model-backed embeddings — better semantic relevance, recorded for replay — are a
documented future refinement layered behind the same `ContextAssembler` seam. Determinism here means the
same (memory, query, lease) always assembles the identical context — required for replay.

Only items with **non-zero** similarity to the query are admitted (an off-topic query assembles an empty
context rather than padding with irrelevant memory).

## Working-memory assembly

The selected, bounded items are written into the **`working` tier** as validated memory mutations
(`add_fact`, `memory_layer: working`, `context_lease_ref: <lease_id>`, payload carrying the source
mutation id + relevance score). This is the substrate-native meaning of "assemble working memory": the
working tier is the distribution channel (memory-tiers §Runtime — every commit notifies subscribers in
real time), so an assembled context is *distributed* to subscribed agents the moment it is built. The
assembler also returns a `WorkingMemoryContext` (items, `tokensUsed`, `tokenBudget`, `droppedForBudget`,
`excludedByLease`) for inspection and audit.

Working-tier writes are **session scratch**: DPS-004 explicitly excludes `working` from cross-surface
capture, so an assembled context never leaks into the learner's durable profile or into another surface.

## What this spec does *not* do (the P3 boundary)

This spec **retrieves, bounds, and assembles**. It does **not** yet make the explanation/curriculum
agents *consume* the assembled working memory in their prompts — adaptive prompt assembly (grounding an
explanation in what the learner already knows) is **P3 / F04 depth**. The division is deliberate and
matches the roadmap: P2.4 is the bounded-retrieval substrate; P3 is the agent-side consumption. The
lease-bounding is a real security/governance primitive independent of consumption.

## Failure modes

- **No eligible memory** (a fresh learner): empty context; assembly is a no-op.
- **Expired lease**: empty context (fail-closed).
- **Off-topic query**: empty context (no zero-similarity padding).
- **Budget smaller than the top item**: that item is dropped for budget and reported; the context may be
  empty rather than over-budget (never exceed the lease).
- **Malformed memory item** (no indexable text): skipped, never fatal.

## Governance, observability, determinism

- The lease is enforced fail-closed; exclusions are counted and reported (auditable).
- Assembled working items carry `context_lease_ref` and the source mutation id — full provenance from
  assembled context back to the durable memory it came from.
- Deterministic embedding ⇒ assembly is replay-stable; no model/provider is invoked by retrieval.
- Assembly writes only to the `working` tier (session scratch); the canonical record and the durable
  learner profile are untouched.

## Verification

- **Relevance**: a query retrieves topically-matching memory above non-matching memory.
- **Tier bound**: items outside `lease.memory_layers` are never assembled (counted as excluded).
- **User bound**: with `allowed_users = [A]`, learner B's items are never assembled (no cross-learner
  leak).
- **Budget bound**: `tokensUsed ≤ token_budget`; over-budget relevant items are reported as dropped.
- **Expiry**: a past-expiry lease assembles nothing.
- **Determinism**: identical (memory, query, lease) ⇒ identical assembled context.
- **Integration**: a returning learner's new surface (DPS-004-seeded) assembles a non-empty,
  lease-bounded context drawn from their prior semantic memory.
- `pnpm verify` stays green fully offline (deterministic embedding; VectorStore is the in-memory
  reference).
```
