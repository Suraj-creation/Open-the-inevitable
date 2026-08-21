-- 0005_cognitive_policies.sql
-- Durable per-learner Adaptive Policy — the L1.5 gate for the Cognitive Harness loop (spec 11; ADR-0066).
--
-- WHY: the harness's governed learning loop (explain -> feedback -> reflect -> govern -> persist) adapts
-- a per-learner teaching-strategy policy that, until now, lived only in a host-level in-memory store —
-- it accumulated within a process but was ERASED on redeploy or idle spin-down. "Understanding
-- compounds" applies to how the system learns to teach each learner, not only to the learner's own
-- state; that adaptation cannot rest on a disk (or a heap) that forgets. This table gives the Adaptive
-- Policy a durable home so a learner's best-fit strategy survives restarts.
--
-- SHAPE NOTE: this is the DYNAMIC Cognitive Object (03 §1.2) — one addressable, versioned row per
-- (agent, learner), keyed by its stable `ref` (cog://policy/<agent>/<learner>). It is deliberately the
-- latest version only (an upsert), not an append-only lineage table: the in-process store keeps the live
-- object and the walking-skeleton's episode events already carry the per-change provenance. A durable
-- version lineage is a later step if replay of the policy's own history is ever required.
--
-- Idempotent: safe to re-run. RLS on from creation (ADR-0034 lock 6): deny-by-default, the gateway uses
-- the service role. Version-controlled here as the source of truth (ADR-0034 lock 4).

create table if not exists cognitive_policies (
  tenant_id              text        not null default 'default',
  ref                    text        not null,              -- cog://policy/<agent>/<learner>
  agent_id               text        not null,
  learner_cid            text        not null,
  constitution_id        text        not null,
  version                integer     not null,
  strategy_weights       jsonb       not null default '{}', -- { "<strategy>": <weight>, ... }
  derived_from_proposal  text,                              -- provenance: the accepted proposal (null for seed)
  parent_version         integer,                           -- provenance: the version this derived from
  updated_at             timestamptz not null default now(),
  primary key (tenant_id, ref)
);
create index if not exists cognitive_policies_learner_idx
  on cognitive_policies (tenant_id, learner_cid);

comment on table cognitive_policies is
  'Durable per-learner Adaptive Policy (spec 11 / ADR-0066): the versioned Cognitive Object the harness '
  'learning loop accumulates. One latest-version row per (agent, learner), keyed by its stable ref.';

alter table cognitive_policies enable row level security;
