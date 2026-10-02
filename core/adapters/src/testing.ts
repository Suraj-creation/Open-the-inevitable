/** Test support only: never imported by production code (embedded-postgres is a dev dependency). */
import { existsSync, rmSync } from "node:fs";
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

/** `suite` names the persistent local cluster (one per concurrently running test file). */
export async function startPg(suite: string): Promise<PgServer> {
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
  // One persistent cluster per suite, kept between runs: initdb (heavy) happens once per machine,
  // later runs only start the server, so local verification stays fast on a busy machine.
  const dir = join(tmpdir(), `uci-embedded-pg-${suite}`);
  const port = await freePort();
  const server = new EmbeddedPostgres({
    databaseDir: dir,
    user: "uci",
    password: "uci",
    port,
    persistent: true,
    // The store stores text faithfully: the cluster must be UTF8 whatever the host locale is.
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => undefined,
    onError: () => undefined,
  });
  if (!existsSync(join(dir, "PG_VERSION"))) {
    rmSync(dir, { recursive: true, force: true });
    await server.initialise();
  }
  try {
    await server.start();
  } catch {
    // A run that was killed leaves its lock file behind: clear it and start once more.
    rmSync(join(dir, "postmaster.pid"), { force: true });
    await server.start();
  }
  const url = (db: string) => `postgres://uci:uci@localhost:${port}/${db}`;
  return {
    async database(name) {
      const admin = new pg.Client({ connectionString: url("postgres") });
      await admin.connect();
      await admin.query(`drop database if exists ${name} with (force)`);
      await admin.query(`create database ${name}`);
      await admin.end();
      return url(name);
    },
    async stop() {
      await server.stop();
    },
  };
}
