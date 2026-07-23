# `supabase/` — backend migrations & config (ADR-0034)

The Supabase-first backend for The Inevitable. Postgres is the deployment-edge implementation of
the `RelationalStore`, `VectorStore`, `EventTransport`, and media contracts
(`@inevitable/contracts`), selected behind the adapter seam — the substrate never imports
`@supabase/*` or a Postgres driver (they load via guarded dynamic import at the edge).

## Migrations

`migrations/*.sql` are the **version-controlled source of truth** for the schema (ADR-0034 lock 4).
They are idempotent and applied to the linked project. Two ways to apply:

- **Supabase MCP server** (registered in `../.mcp.json`) — authenticate once via `claude /mcp`,
  then the agent applies/queries directly.
- **Supabase CLI:** `npx supabase link --project-ref $SUPABASE_PROJECT_REF` then
  `npx supabase db push` (needs the DB password / direct connection).
- **Management API** (used for the initial bootstrap over HTTPS):
  `POST https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query`
  with `{ "query": "<sql>" }` and `Authorization: Bearer $SUPABASE_ACCESS_TOKEN`.

## Secrets

All credentials live in the gitignored root `.env` (`SUPABASE_PROJECT_REF`,
`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_URL`). Never commit them; never put
them in `.mcp.json` (the MCP server uses OAuth). Rotate any secret that has been exposed.

## Schema (0001_core_substrate)

The core substrate: `events` (append-only source of truth), `learners`, `world_state_*`
(deltas + materialized graph projection), `memory_mutations`, `media_objects`, `vectors`. RLS is
enabled on every table from the first migration (deny-by-default; the gateway uses the service
role). CSE-specific tables (sources, layers, anchors, episodes) arrive with CSE-P1/P2 per the
roadmap.
