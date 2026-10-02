import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

/**
 * A real PostgreSQL for tests: the CI service when UCI_PG_URL is set, otherwise an embedded
 * PostgreSQL 17 (real binaries, real concurrency) started for the test file. Each suite gets its
 * own database.
 */
export interface PgServer {
  /** Create a fresh database and return its connection string. */
  database(name: string): Promise<string>;
  stop(): Promise<void>;
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, () => {
      const address = srv.address();
      const port = typeof address === "object" && address ? address.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

export async function startPg(): Promise<PgServer> {
  const external = process.env["UCI_PG_URL"];
  if (external) {
    const at = (db: string) => {
      const u = new URL(external);
      u.pathname = `/${db}`;
      return u.toString();
    };
    return {
      async database(name) {
        const admin = new pg.Client({ connectionString: external });
        await admin.connect();
        await admin.query(`drop database if exists ${name} with (force)`);
        await admin.query(`create database ${name}`);
        await admin.end();
        return at(name);
      },
      async stop() {},
    };
  }
  const dir = mkdtempSync(join(tmpdir(), "uci-pg-"));
  const port = await freePort();
  const server = new EmbeddedPostgres({
    databaseDir: dir,
    user: "uci",
    password: "uci",
    port,
    persistent: false,
    onLog: () => undefined,
    onError: () => undefined,
  });
  await server.initialise();
  await server.start();
  return {
    async database(name) {
      await server.createDatabase(name);
      return `postgres://uci:uci@localhost:${port}/${name}`;
    },
    async stop() {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
