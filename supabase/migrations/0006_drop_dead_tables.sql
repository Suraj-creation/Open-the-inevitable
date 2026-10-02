-- 0006 — drop the eleven legacy tables that no code reads or writes.
--
-- Verified dead by search at commit 5acbfab (no SQL, adapter or route touches them): events,
-- world_state_deltas, world_state_nodes, world_state_edges, media_objects (0001) and sources,
-- source_versions, layer_artifacts, anchors, anchor_migrations, consent_envelopes (0002).
--
-- Safety, by construction:
--   * one transaction: either every table goes or none does;
--   * refuses unless every table that exists is empty (no data is ever dropped);
--   * children before parents (layer_artifacts and anchors reference source_versions, which
--     references sources) and never CASCADE, so any dependency these migrations do not show
--     fails the migration instead of being dropped with it.
-- Live tables (learners, learner_*, memory_mutations, vectors, intelligence_artifacts,
-- transport_events, cognitive_policies) are untouched.

begin;

do $$
declare
  t text;
  n bigint;
begin
  foreach t in array array[
    'layer_artifacts', 'anchor_migrations', 'anchors', 'source_versions', 'sources',
    'consent_envelopes', 'world_state_edges', 'world_state_nodes', 'world_state_deltas',
    'events', 'media_objects'
  ] loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('select count(*) from public.%I', t) into n;
      if n > 0 then
        raise exception 'refusing to drop public.%: it holds % rows', t, n;
      end if;
    end if;
  end loop;
end $$;

drop table if exists public.layer_artifacts restrict;
drop table if exists public.anchor_migrations restrict;
drop table if exists public.anchors restrict;
drop table if exists public.source_versions restrict;
drop table if exists public.sources restrict;
drop table if exists public.consent_envelopes restrict;
drop table if exists public.world_state_edges restrict;
drop table if exists public.world_state_nodes restrict;
drop table if exists public.world_state_deltas restrict;
drop table if exists public.events restrict;
drop table if exists public.media_objects restrict;

commit;
