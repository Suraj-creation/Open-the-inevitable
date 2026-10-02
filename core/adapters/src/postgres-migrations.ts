import { createHash } from "node:crypto";
import type pg from "pg";

/**
 * The Postgres schema of the causal store, as ordered, checksummed migrations. `{schema}` is
 * substituted at apply time; the checksum is taken over the template, so the same migration has
 * the same identity in every schema. A migration, once applied, never changes: a checksum mismatch
 * refuses to start rather than silently diverge.
 */
export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: "causal store v2",
    sql: `
      create table {schema}.streams (
        stream text primary key,
        token bigint not null default 0,
        owner text not null default '',
        head bigint not null default 0
      );
      create table {schema}.records (
        stream text not null,
        seq bigint not null,
        kind text not null,
        v integer not null,
        at text not null,
        process_id text not null,
        entity_id text not null,
        labels text not null,
        causes text not null,
        data text not null,
        primary key (stream, seq)
      );
      create table {schema}.admissions (
        stream text not null,
        key text not null,
        seq bigint not null,
        primary key (stream, key)
      );
      create table {schema}.evidence (
        entity_id text not null,
        hash text not null,
        media_type text not null,
        content text,
        labels text not null,
        forgotten boolean not null default false,
        primary key (entity_id, hash)
      );
    `,
  },
];

const checksum = (m: Migration): string =>
  createHash("sha256").update(m.sql.replace(/\r\n/g, "\n").trim()).digest("hex");

const IDENT = /^[a-z_][a-z0-9_]*$/;

/** Validate a schema name: it is spliced into SQL, so only plain lowercase identifiers are allowed. */
export function schemaIdent(schema: string): string {
  if (!IDENT.test(schema))
    throw new Error(`schema name ${JSON.stringify(schema)} is not a plain identifier`);
  return schema;
}

export interface MigrationReport {
  readonly applied: readonly number[];
  readonly current: number;
}

/**
 * Apply pending migrations in one transaction under an advisory lock, so concurrent starters
 * serialise and exactly one applies each migration. Refuses on a checksum mismatch.
 */
export async function migrate(pool: pg.Pool, schema: string): Promise<MigrationReport> {
  const s = schemaIdent(schema);
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [`uci-migrations:${s}`]);
    await client.query(`create schema if not exists ${s}`);
    await client.query(
      `create table if not exists ${s}.schema_migrations (
        version integer primary key, name text not null, checksum text not null,
        applied_at timestamptz not null default now()
      )`,
    );
    const done = new Map(
      (
        await client.query<{ version: number; checksum: string }>(
          `select version, checksum from ${s}.schema_migrations`,
        )
      ).rows.map((r) => [r.version, r.checksum]),
    );
    const applied: number[] = [];
    for (const m of MIGRATIONS) {
      const recorded = done.get(m.version);
      if (recorded !== undefined) {
        if (recorded !== checksum(m))
          throw new Error(
            `migration ${m.version} (${m.name}) changed after it was applied to ${s}: refusing to start`,
          );
        continue;
      }
      await client.query(m.sql.replaceAll("{schema}", s));
      await client.query(
        `insert into ${s}.schema_migrations (version, name, checksum) values ($1, $2, $3)`,
        [m.version, m.name, checksum(m)],
      );
      applied.push(m.version);
    }
    await client.query("commit");
    return { applied, current: MIGRATIONS.at(-1)?.version ?? 0 };
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
