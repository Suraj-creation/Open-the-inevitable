-- 0002_sources.sql
-- (a) EventTransport backing table (ADR-0034): per-subject monotonic sequences from 0, whole
--     CognitiveEvent as jsonb, global insertion order via `id` for replay ordering. This table is
--     the durable seam behind @inevitable/contracts EventTransport; the 0001 `events` table
--     remains the richer canonical-log read model for the future gateway cutover.
-- (b) Durable home for the CSE M1 primitives (CSE-002): sources, content-addressed versions,
--     layer artifacts, anchors, anchor migrations, consent envelopes.
-- RLS on every table (ADR-0034 lock 6): deny-by-default; the gateway uses the service role.
-- Idempotent; version-controlled here as the source of truth (ADR-0034 lock 4).

-- ── (a) Event transport ──────────────────────────────────────────────────────────────────────
create table if not exists transport_events (
  id          bigserial primary key,             -- global insertion order (replay yields in id order)
  subject     text   not null,
  sequence    bigint not null,                    -- per-subject, monotonic from 0
  event       jsonb  not null,                    -- the full CognitiveEvent envelope
  created_at  timestamptz not null default now(),
  unique (subject, sequence)
);
create index if not exists transport_events_subject_idx on transport_events (subject, sequence);

-- ── (b) CSE sources domain ───────────────────────────────────────────────────────────────────
create table if not exists sources (
  source_id   text primary key,
  tenant_id   text not null default 'default',
  created_at  timestamptz not null default now()
);

create table if not exists source_versions (
  version_id     text primary key,
  source_id      text not null references sources (source_id),
  tenant_id      text not null default 'default',
  modality       text not null,
  content_ref    text not null,                   -- out-of-band bytes (Storage); never inline
  content_hash   text not null,                   -- sha-256; shared-layer cache key
  provenance     jsonb not null,
  supersedes     text,
  registered_hlc text not null,
  created_at     timestamptz not null default now(),
  unique (source_id, content_hash)                -- registration idempotency (CSE-002 §3.1)
);
create index if not exists source_versions_source_idx on source_versions (source_id);
create index if not exists source_versions_hash_idx   on source_versions (content_hash);

create table if not exists layer_artifacts (
  artifact_id     text primary key,
  version_id      text not null references source_versions (version_id),
  tenant_id       text not null default 'default',
  layer           text not null,                  -- structural | semantic | ... (CSE-002 §3.2)
  schema_version  text not null,
  confidence      real not null,
  degraded        boolean not null default false,
  degraded_reason text,
  produced_by     text not null,
  content         jsonb,                          -- small layer contents inline…
  content_ref     text,                           -- …large ones out-of-band in Storage
  created_at      timestamptz not null default now()
);
create index if not exists layer_artifacts_version_idx on layer_artifacts (version_id, layer);

create table if not exists anchors (
  anchor_id    text primary key,
  version_id   text not null references source_versions (version_id),
  tenant_id    text not null default 'default',
  selectors    jsonb not null,                    -- ≥2 distinct selector types (CSE-002 §5.2)
  granularity  text not null,
  concept_refs jsonb not null default '[]',
  created_by   text not null,
  created_at   timestamptz not null default now()
);
create index if not exists anchors_version_idx on anchors (version_id);

create table if not exists anchor_migrations (
  id           bigserial primary key,
  tenant_id    text not null default 'default',
  anchor_id    text not null,
  from_version text not null,
  to_version   text not null,
  status       text not null check (status in ('resolved', 'moved', 'orphaned')),
  created_at   timestamptz not null default now()
);

create table if not exists consent_envelopes (
  consent_ref  text primary key,
  tenant_id    text not null default 'default',
  participants jsonb not null,                    -- [{person_ref, scope, granted_at, expires}]
  capture_scope jsonb not null default '{}',
  retention    text,
  status       text not null default 'granted' check (status in ('granted', 'revoked')),
  granted_at   timestamptz not null default now(),
  revoked_at   timestamptz
);

-- ── RLS: on for every table (deny-by-default; service role bypasses) ─────────────────────────
alter table transport_events  enable row level security;
alter table sources           enable row level security;
alter table source_versions   enable row level security;
alter table layer_artifacts   enable row level security;
alter table anchors           enable row level security;
alter table anchor_migrations enable row level security;
alter table consent_envelopes enable row level security;
