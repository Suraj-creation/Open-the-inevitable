-- 0001_core_substrate.sql
-- CSE / COS core substrate schema (ADR-0034: Supabase persistence graduation).
--
-- The append-only `events` table is the source of truth; world_state and memory are projections
-- rebuildable from it (blueprint §25.4 #9). Every table is tenant-scoped and has Row-Level
-- Security enabled from the first migration (ADR-0034 lock 6): with RLS enabled and no permissive
-- policy, only the service_role / postgres role (which the gateway uses) may read/write; anon and
-- authenticated roles get nothing until learner-scoped JWT policies are added when Supabase Auth
-- is wired. Source bytes never live here — only `content_ref` into Storage (CSE-002 §2, SRF-006).
--
-- Idempotent: safe to re-run. Applied via the Supabase Management API / MCP; kept version-
-- controlled here as the source of truth (ADR-0034 lock 4).

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists vector;      -- pgvector (VectorStore)

-- ── Event log (source of truth; EventTransport backend) ──────────────────────────────────────
create table if not exists events (
  seq             bigserial primary key,          -- monotonic sequence (EventTransport.publish → {sequence})
  event_id        text        not null unique,     -- the CognitiveEvent id
  event_type      text        not null,            -- e.g. surface.frame.composed
  family          text        not null,            -- e.g. surface, source, memory
  tenant_id       text        not null,
  learner_cid     text,
  correlation_id  text,
  causation_id    text,
  hlc             text        not null,            -- hybrid logical clock (ordering within tenant)
  payload         jsonb       not null,            -- the full CognitiveEvent envelope
  created_at      timestamptz not null default now()
);
create index if not exists events_family_idx        on events (family);
create index if not exists events_tenant_seq_idx     on events (tenant_id, seq);
create index if not exists events_correlation_idx    on events (correlation_id);
create index if not exists events_type_idx           on events (event_type);
comment on table events is 'Append-only cognitive event log — the canonical source of truth (ADR-0008/0034).';

-- ── Learner identity (DPS-003 / ADR-0010) ────────────────────────────────────────────────────
create table if not exists learners (
  cid          text        primary key,            -- cognitive identity
  learner_id   text        not null unique,
  tenant_id    text        not null,
  trust_level  int         not null default 1,
  api_key      text        unique,                 -- minted once; bearer for the gateway
  created_at   timestamptz not null default now()
);

-- ── World-state (GraphStore backend; deltas + materialized projection) ────────────────────────
create table if not exists world_state_deltas (
  seq         bigserial primary key,
  tenant_id   text        not null,
  delta       jsonb       not null,
  hlc         text        not null,
  created_at  timestamptz not null default now()
);
create index if not exists wsd_tenant_seq_idx on world_state_deltas (tenant_id, seq);

create table if not exists world_state_nodes (
  tenant_id   text        not null,
  node_id     text        not null,
  node_type   text        not null,               -- concept | mastery_checkpoint | source | ...
  props       jsonb       not null default '{}',
  version     int         not null default 1,
  updated_at  timestamptz not null default now(),
  primary key (tenant_id, node_id)
);
create index if not exists wsn_type_idx on world_state_nodes (tenant_id, node_type);

create table if not exists world_state_edges (
  tenant_id   text        not null,
  from_node   text        not null,
  to_node     text        not null,
  edge_type   text        not null,               -- depends_on | applies_to | bridges_to | ...
  props       jsonb       not null default '{}',
  primary key (tenant_id, from_node, to_node, edge_type)
);
create index if not exists wse_from_idx on world_state_edges (tenant_id, from_node);
create index if not exists wse_to_idx   on world_state_edges (tenant_id, to_node);

-- ── Memory (Memory Mutation Protocol; tiered) ────────────────────────────────────────────────
create table if not exists memory_mutations (
  seq          bigserial primary key,
  mutation_id  text        not null unique,
  tenant_id    text        not null,
  learner_cid  text        not null,
  tier         text        not null,              -- working|episodic|semantic|procedural|reflective|...
  mutation     jsonb       not null,
  hlc          text        not null,
  committed_at timestamptz not null default now()
);
create index if not exists mm_learner_tier_idx on memory_mutations (tenant_id, learner_cid, tier);

-- ── Media objects (durable seam; bytes live in Storage, referenced by content_ref) ────────────
create table if not exists media_objects (
  content_ref  text        primary key,            -- Storage path / key
  tenant_id    text        not null,
  mime         text        not null,
  bytes_size   bigint,
  sha256       text,
  created_at   timestamptz not null default now()
);

-- ── Vectors (VectorStore backend; pgvector). Dimension is pinned in a later migration once the
--    embedding source is fixed (CSE-P2); `vector` (unspecified dim) is stored now, indexed then. ─
create table if not exists vectors (
  id          text        not null,
  tenant_id   text        not null,
  collection  text        not null,
  embedding   vector,
  payload     jsonb       not null default '{}',
  primary key (tenant_id, collection, id)
);

-- ── Row-Level Security: on for every table from day one (ADR-0034 lock 6) ─────────────────────
alter table events              enable row level security;
alter table learners            enable row level security;
alter table world_state_deltas  enable row level security;
alter table world_state_nodes   enable row level security;
alter table world_state_edges   enable row level security;
alter table memory_mutations    enable row level security;
alter table media_objects       enable row level security;
alter table vectors             enable row level security;
-- No permissive policies yet: service_role (used by the gateway) bypasses RLS; anon/authenticated
-- are denied until learner-scoped JWT policies land with Supabase Auth. This is deny-by-default.
