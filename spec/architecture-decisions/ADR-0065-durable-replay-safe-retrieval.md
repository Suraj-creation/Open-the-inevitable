# ADR-0065 — Durable, replay-safe, cross-session retrieval

**Status:** Accepted (2026-08-16) · Implementation status: implemented (gateway wiring live-unverifiable
from an IPv4 network — see ADR-0034 note; store SQL proven by conformance + the migration-0004 live run)
Extends ADR-0034 (Supabase persistence), ADR-0012 (context-lease-bounded retrieval), the Model
Invocation Protocol (`spec/protocols/model-invocation-protocol.md`). Realizes the CLAUDE.md §3 law
*retrieval is half of memory*.

## Context

The 2026-08 audit found retrieval was the deepest gap: production built `new InMemoryVectorStore()`
per session (`apps/cli/src/wiring.ts`), so the semantic index died with the process — no
cross-session retrieval at all. Two blockers sat underneath:

1. **Embeddings were not replay-safe.** `RecordingModelRuntime.embed()` threw `E_MODEL_REPLAY_MISS`
   in replay mode ("not recorded in Phase 2B"). Persisting real (Gemini) embeddings would therefore
   break determinism (law 15) the moment replay hit an `embed()` call.
2. **Item metadata was session-local.** `ContextAssembler.assemble` reconstructed items from an
   in-memory `this.items` map, and `VectorStore.search` returned only `{id, score}`. Even with a
   durable store, a returning session had an empty item map and could retrieve nothing.

## Decision

**Replay-safe embeddings.** `RecordingModelRuntime.embed()` now records `model.embedding.recorded`
(record-before-use) and, in replay, resolves the recorded vector — keyed by the exact text, because
an embedding is a pure function of (text, model), so lookup is order-independent (unlike generate()'s
ordinals). Replay never re-invokes the provider; a seeded record→replay run reproduces byte-identical
retrieval.

**Payload round-trip.** `VectorStore.search` gains an optional `payload` on each hit (additive; no
caller breaks). `ContextAssembler.index` persists each item's metadata (`text`, `memoryLayer`,
`ownerUserId`, `confidence`) as the vector payload, and `assemble` reconstructs items from the
payload when the session map lacks them. This is what makes retrieval survive the process:
a later session over the same durable store retrieves what an earlier one indexed, with **no**
session-local state. The lease still bounds what is admitted (tier, user, budget, expiry).

**Durable store at the gateway.** `SurfaceHost` constructs a `PgVectorStore` when the Supabase
backend is configured (async attach folded into `ready`, mirroring the learner store), threaded
through `buildDemoSession` into the `ContextAssembler`; absent ⇒ the in-memory default. Per-learner
isolation is by the `context:<cid>` collection — a shared durable store never cross-serves one
learner's memory to another (defence in depth beside the lease's `allowed_users` filter).

## Rejected alternatives

- **Search returns no payload; keep item metadata in a side table** — a second round-trip and a
  second source of truth for the same fact. The payload already exists on the vector row.
- **Embedding ordinals like generate()** — embeddings are pure in their input, so text-keying is
  simpler and order-independent; two identical texts collapse to one record correctly.

## Explicitly deferred (documented, not silent)

- **pgvector dimension pin + ANN index.** The `vectors.embedding` column stays untyped `vector`
  (any dimension) with **no** ivfflat/hnsw index — a sequential scan, correct and fine at current
  scale. Pinning a dimension and adding an ANN index requires fixing a single embedding source
  (local FNV = 96-dim vs Gemini = higher-dim), which is coupled to deployment; deferring it is a
  scaling optimization, not a correctness gap. Tracked for a later migration once the embed source
  is fixed (the 0001 comment's "CSE-P2").
- **Richer memory→text extraction.** Items are still indexed on concept id/text; enriching the
  indexed surface (descriptions, evidence) is a separate quality slice.

Determinism, replay, the lease boundary, and the in-memory default are unchanged. Budget-0 / no-
backend behavior is byte-identical to before.
