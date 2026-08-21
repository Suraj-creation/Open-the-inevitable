-- 0004_learner_durability.sql
-- Durable learner identity + cross-surface cognition — completing ADR-0034 for DPS-003/DPS-004.
--
-- WHY: identity, the learner's surfaces, and their carried cognition lived only as JSON files under
-- COS_PERSIST_DIR. On the deployment tier that directory is EPHEMERAL, so a redeploy or an idle
-- spin-down erased every learner — returning visitors were rejected 401 because the registry holding
-- their minted api_key was gone. "Understanding compounds" is the product thesis; it cannot rest on
-- a disk that forgets. This migration gives identity and carried cognition a durable home.
--
-- SCOPE NOTE: `learner_world_nodes` / `learner_world_edges` are deliberately NOT the shared
-- `world_state_*` tables from 0001. Those are the tenant-wide graph projection. A learner's carried
-- cognition (DPS-004) is a different object: the portable, re-derivable subgraph of THEIR mastery
-- checkpoints and verified concepts, seeded into each new surface they open. Conflating the two
-- would make one learner's profile a mutation of the shared graph. `memory_mutations` (0001) is
-- reused as-is — it already carries `learner_cid` and tier, which is exactly the durable-tier slice.
--
-- Idempotent: safe to re-run. RLS on from creation (ADR-0034 lock 6): deny-by-default, the gateway
-- uses the service role. Version-controlled here as the source of truth (ADR-0034 lock 4).

-- ── Identity: the full registry record ───────────────────────────────────────────────────────
-- 0001 created `learners` with (cid, learner_id, tenant_id, trust_level, api_key, created_at).
-- The registry record also carries a display name, and last-seen supports resume ordering.
alter table learners add column if not exists display_name  text;
alter table learners add column if not exists last_seen_at  timestamptz;

create index if not exists learners_api_key_idx    on learners (api_key);
create index if not exists learners_tenant_idx     on learners (tenant_id, last_seen_at desc);

comment on table learners is
  'Durable learner identity (DPS-003/ADR-0010). api_key is the bearer credential minted once; '
  'losing this table is what caused the 401 lockout of returning learners on ephemeral disk.';

-- ── The learner's surfaces (resume-by-learner) ───────────────────────────────────────────────
create table if not exists learner_surfaces (
  tenant_id   text        not null default 'default',
  learner_id  text        not null,
  surface_id  text        not null,
  goal        text        not null,
  created_at  timestamptz not null default now(),
  primary key (tenant_id, learner_id, surface_id)
);
create index if not exists learner_surfaces_recent_idx
  on learner_surfaces (tenant_id, learner_id, created_at desc);

-- ── Carried cognition: the learner's durable subgraph (DPS-004) ──────────────────────────────
-- Idempotent by id so re-capturing an unchanged surface is a no-op and a concept is never
-- double-counted — the same merge semantics the file-backed profile had, now enforced by the PK.
create table if not exists learner_world_nodes (
  tenant_id   text        not null default 'default',
  learner_id  text        not null,
  node_id     text        not null,
  node_type   text        not null,              -- concept | mastery_checkpoint
  props       jsonb       not null default '{}',
  updated_at  timestamptz not null default now(),
  primary key (tenant_id, learner_id, node_id)
);
create index if not exists lwn_type_idx on learner_world_nodes (tenant_id, learner_id, node_type);

create table if not exists learner_world_edges (
  tenant_id   text        not null default 'default',
  learner_id  text        not null,
  edge_id     text        not null,
  from_node   text        not null,
  to_node     text        not null,
  edge_type   text        not null,              -- assesses | depends_on | ...
  props       jsonb       not null default '{}',
  updated_at  timestamptz not null default now(),
  primary key (tenant_id, learner_id, edge_id)
);
create index if not exists lwe_from_idx on learner_world_edges (tenant_id, learner_id, from_node);

-- `memory_mutations` (0001) already carries (mutation_id, tenant_id, learner_cid, tier, mutation,
-- hlc, committed_at) — exactly the durable-tier slice (semantic/procedural/reflective). It needs no
-- schema change here, only a writer. This migration is where it stops being a dead table.

-- ── RLS: on from creation, deny-by-default ───────────────────────────────────────────────────
alter table learner_surfaces    enable row level security;
alter table learner_world_nodes enable row level security;
alter table learner_world_edges enable row level security;
