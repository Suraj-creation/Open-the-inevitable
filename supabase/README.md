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

## Connecting: use the pooler, not the direct host

**The direct host `db.<ref>.supabase.co` is IPv6-only — it has no A record at all.** It works from
IPv6-capable hosts (Render), but from an IPv4-only network the `pg` driver fails with
`ENOTFOUND`/`ENETUNREACH` and no amount of retrying helps. That is a network fact, not a bug.

Use the **session-mode pooler**, which is IPv4 and works everywhere including Render:

```
postgresql://postgres.<PROJECT_REF>:<URL-ENCODED-PASSWORD>@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
```

Three things bite here, in the order people hit them:

1. **The user must be tenant-qualified** — `postgres.<PROJECT_REF>`, not `postgres`. A bare
   `postgres` returns `tenant or user not found`.
2. **The region prefix is `aws-1`, not `aws-0`** for this project. The wrong prefix returns exactly
   the same `tenant or user not found`, which makes it look like a credential problem when it is a
   routing problem. Confirm from the dashboard (Connect → Session pooler) if it ever moves.
3. **Percent-encode the password.** An un-encoded special character makes the driver throw
   `TypeError: Invalid URL` before it ever opens a socket.

Port `5432` is session mode (broadest compatibility); `6543` is transaction mode. Both work; the
adapters use `5432`.

Verify the live path with the gated suites (they skip unless BOTH vars are set, so `pnpm verify`
stays offline):

```bash
COS_SUPABASE_LIVE=1 SUPABASE_DB_URL="<pooler url>" \
  npx vitest run apps/api/tests/learner-durability.test.ts packages/adapters/tests/supabase.test.ts
```

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
