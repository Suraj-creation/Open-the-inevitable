-- 0003_intelligence.sql
-- The Intelligence Plane's physical manifestation (ADR-0035, CIP-001 §4.1): ONE canonical table
-- for every IntelligenceArtifact kind — the envelope is the schema; kind-specific structure lives
-- in `body` (jsonb). Artifacts are versioned (supersedes), provenance-linked to chronicle
-- segments, quarantinable, and re-derivable by replay. RLS from day one: learner-scoped rows are
-- isolated; deletion cascade is enforced by the redaction path (G1), not soft hides.
-- Idempotent; version-controlled source of truth (ADR-0034 lock 4).

create table if not exists intelligence_artifacts (
  artifact_id     text primary key,                 -- int-…
  tenant_id       text not null default 'default',
  kind            text not null,                    -- taxonomy kind (CIP-001 §5)
  regime          text not null check (regime in ('learner', 'shared')),
  learner_cid     text,                             -- required when regime='learner'
  body            jsonb not null,
  confidence      real not null,
  method          text not null,                    -- distiller id
  method_version  text not null,                    -- re-distillation supersedes, never overwrites
  provenance_refs jsonb not null default '[]',      -- chronicle segment refs (event ids/ranges)
  supersedes      text,
  decay_policy    text not null default 'none',
  consumers       jsonb not null default '[]',      -- named consumers (admission law)
  quarantined     boolean not null default false,
  distilled_hlc   text not null,
  created_at      timestamptz not null default now(),
  constraint learner_scope_has_cid check (regime <> 'learner' or learner_cid is not null)
);
create index if not exists intel_kind_idx    on intelligence_artifacts (tenant_id, kind);
create index if not exists intel_learner_idx on intelligence_artifacts (tenant_id, learner_cid, kind);
create index if not exists intel_method_idx  on intelligence_artifacts (method, method_version);

alter table intelligence_artifacts enable row level security;
