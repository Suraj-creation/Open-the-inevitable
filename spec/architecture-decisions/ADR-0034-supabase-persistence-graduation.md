# ADR-0034: Persistence Graduation — Supabase-First Postgres-Backed Adapters

**Status:** Accepted
**Date:** 2026-07-10
**Related:** ADR-0003 (tech stack), ADR-0005 (infrastructure adapters), ADR-0008 (durable
persistence), ADR-0009 (continuity/rehydration), ADR-0010 (durable learner identity), ADR-0032
(CSE domain), CSE-002 (canonical source representation), `spec/architecture/Tech-Stack.md`

## Context

The cognitive path is production-grade in logic but its durable substrate is minimal: an
append-only JSONL `FileEventTransport` + `FileMediaStore` (ADR-0008), with in-memory reference
implementations for everything else (world-state graph, vector store, relational store). To make
the Cognitive Source Environment real — ingesting real PDFs, videos, and papers; storing source
bytes, layers, anchors, episodes, learner identity, and vectors durably; serving many learners —
the system needs a real backend.

`spec/architecture/Tech-Stack.md` names an eight-adapter target with defaults NATS JetStream,
Temporal, Neo4j, Qdrant, Postgres+pgvector, Gemini, MCP, OTel. Standing up all of that is
disproportionate for the current stage (single builder, pre-scale) and would slow CSE delivery.
The architecture is event-sourced and projection-based, which makes a **Postgres-centric backend a
natural and sufficient fit**: an append-only event table is the source of truth; world-state,
vectors, and read models are projections over it.

The founder has chosen **Supabase-first, controlled via the official Supabase MCP server**.
Supabase provides managed Postgres 15, pgvector, S3-compatible Storage, Auth, and Realtime — which
collapses five adapter concerns into one platform while remaining fully behind the existing
contract seam (`@inevitable/contracts`), so CLAUDE.md §2 (no vendor past its adapter) holds.

## Decision

Adopt **Supabase as the default deployment-edge backend**, implemented as new adapters behind the
existing eight contracts, with the heavy clients loaded only at the edge via guarded dynamic
import — never as workspace dependencies.

**Contract → Supabase mapping:**

| Contract (`@inevitable/contracts`) | Today | Supabase-first adapter | Deferred graduation |
|---|---|---|---|
| `RelationalStore` | in-memory | `SupabasePostgresStore` (Postgres 15) | CockroachDB |
| `VectorStore` | `InMemoryVectorStore` | `PgVectorStore` (pgvector extension) | Qdrant |
| `EventTransport` | `FileEventTransport` (JSONL) | `PostgresEventTransport` (append-only `events` table + `pg_notify`/Realtime for live subscribe; `replay` = ordered SELECT) | NATS JetStream |
| Media store (durable seam, ADR-0008) | `FileMediaStore` | `SupabaseStorageMediaStore` (S3-compatible buckets; `content_ref` per CSE-002/SRF-006) | R2/S3 |
| Learner identity (DPS-003/ADR-0010) | custom `LearnerRegistry` | Postgres-backed registry; optionally Supabase Auth for sessions | — |
| `GraphStore` (world-state) | in-memory delta fold | **Postgres-backed:** deltas in a table + materialized projection; graph queries via recursive CTEs (world-state is *already* a fold, so no graph DB is required) | Neo4j |
| `WorkflowRuntime` | contract-only | **deferred** (not needed for CSE-P1..P3) | Temporal |
| `ModelRuntime` | Gemini (guarded import) | unchanged | — |
| `ObservabilitySink` | OTel edge | unchanged (+ optional Langfuse) | — |

**Binding locks:**

1. **The substrate never imports `@supabase/*` or `pg`.** Supabase adapters live in
   `packages/adapters/src/supabase.ts` (edge tier, beside `durable.ts`); heavy clients
   (`@supabase/supabase-js`, and a Postgres driver) are loaded via guarded dynamic `import()` like
   `@google/genai`, and appear in no package's `dependencies`. Selection is at the deployment edge
   (`apps/api`) via env (`COS_BACKEND=supabase|file|memory`).
2. **Every Supabase adapter passes the existing conformance harness** (`packages/adapters/src/conformance.ts`)
   — it is a drop-in for the in-memory reference, proven by the same tests. In-memory stays the
   offline default; the full stack must still run and test with zero network (hermetic).
3. **The event table is the source of truth.** World-state, vectors, and all read models are
   projections rebuildable from it; replay determinism (ADR-0008/0009) is preserved — Supabase
   changes *where* the log lives, never *that the log is canonical*.
4. **Schema lives in version-controlled migrations** under `supabase/migrations/`, applied via the
   Supabase MCP server / CLI. No ad-hoc dashboard schema changes. RLS policies are part of the
   migration set.
5. **Secrets never enter the repo or events.** Service-role keys, DB URLs, and the MCP personal
   access token live in gitignored `.env`/MCP config; source bytes live in Storage, referenced by
   `content_ref` (bytes never enter the canonical event record — CSE-002 §2, SRF-006).
6. **Multi-tenancy from day one.** Every row (events, sources, layers, anchors, episodes,
   learners) carries a tenant/learner scope enforced by Postgres Row-Level Security, so learner
   governance (CSE-002 §8 consent, CSE-005 §7 forgetting) is enforced at the database, not only in
   application code.

## Alternatives Considered

- **Full Tech-Stack.md stack now (NATS + Neo4j + Qdrant + Temporal + Postgres).** Rejected for
  this stage: five services to operate and pay for, disproportionate pre-scale, and slower to CSE
  delivery. Retained as the documented graduation target (the adapter seam makes each a
  swap-in-place, not a rewrite).
- **Neon/serverless Postgres + separate Qdrant + separate object store.** Rejected: more moving
  parts and no unified control surface for agent-driven build; Supabase's MCP server + Storage +
  Auth is a better fit for "deep, end-to-end control."
- **Keep FileEventTransport, add Postgres only for read models.** Rejected: splits the source of
  truth; a single Postgres event log is simpler and keeps replay clean.
- **Neo4j for world-state now.** Rejected: world-state is already a delta fold; Postgres + recursive
  CTEs serve the current graph queries (decompose, neighbors, learner state) well past current
  scale. Neo4j is the documented graduation when traversal complexity demands it.

## Conformance to the ten invariants (blueprint §25.4)

Persistence is substrate, but the relevant invariants: **#2** memory writes remain Memory
Mutations (Postgres is where committed mutations land, not a bypass); **#9** no hidden state — the
Postgres event table *is* the event source, and projections are derived, not authoritative;
**#5/#6** Supabase access (SQL, Storage, Auth) is a governed adapter behind capability envelopes,
with RLS as defense-in-depth; replay (ADR-0008/0009) and observability (OTel) are unchanged. No
invariant is weakened; several (governance enforcement, tenant isolation) are strengthened by RLS.

## Consequences

**Positive.** CSE can persist real sources, layers, anchors, episodes, vectors, and identities
durably and multi-tenant; the event-sourced design maps cleanly onto Postgres; five concerns are
managed by one platform with an MCP control surface the agent can drive end-to-end; the adapter
seam means graduating any single concern (events→NATS, graph→Neo4j, vectors→Qdrant) later is a
localized swap, not a migration; RLS makes learner governance enforceable at the data layer.

**Costs / risks.** A new vendor behind the seam (mitigated: strictly adapter-bound, conformance-
tested, in-memory default retained); Postgres-as-event-bus has throughput limits vs. NATS
(mitigated: fine pre-scale; graduation path documented); Postgres-as-graph has traversal limits vs.
Neo4j (mitigated: current queries are shallow; graduation documented); operational dependence on a
managed provider (mitigated: standard Postgres + S3 semantics keep exit cost low; migrations and
data are portable).

**Traceability.** New adapters + conformance coverage; `supabase/migrations/`; env selection in
`apps/api`; the CSE implementation roadmap
(`spec/implementation-roadmaps/cse-cognitive-theater-and-backend.md`) sequences the build;
Tech-Stack.md updated to record Supabase as the current default edge with the graduation table.

## Open Questions

- Auth: adopt Supabase Auth for learner sessions vs. keep the custom `LearnerRegistry` on Postgres
  (leaning: custom registry on Postgres first — it already encodes trust levels and API keys —
  with Supabase Auth considered when human/social features (F11) arrive).
- Event throughput ceiling on Postgres+`pg_notify` before NATS is warranted — measure under load.
- Whether `PgVectorStore` and the graph projection share one Postgres instance or split early for
  isolation — start shared; split on contention.
- Realtime path: Supabase Realtime channels vs. the existing SSE gateway reading from Postgres —
  leaning: keep the SSE gateway (SRF-005) reading the Postgres log; revisit Realtime for
  co-presence.
