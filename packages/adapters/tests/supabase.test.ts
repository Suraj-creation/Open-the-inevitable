/**
 * Supabase-first adapters (ADR-0034). Hermetic suites run the SAME conformance harness as the
 * in-memory reference against scripted fake pools keyed on the exported SQL surface (no driver,
 * no network). The live suite (real Postgres in ap-south-1) is gated on COS_SUPABASE_LIVE=1 +
 * SUPABASE_DB_URL so CI/verify stays offline.
 */
import { describe, expect, it } from "vitest";
import {
  PgVectorStore,
  PostgresEventTransport,
  PostgresRelationalStore,
  SupabaseStorageObjectStore,
  TRANSPORT_SQL,
  VECTOR_SQL,
  runEventTransportConformance,
  runVectorStoreConformance,
  type PgPoolLike,
} from "../src/index";

// ── Scripted fake pools (switch on the exact SQL constants, never regexes) ────────────────────

interface TransportRow {
  id: number;
  subject: string;
  sequence: number;
  event: unknown;
}

class FakeTransportPool implements PgPoolLike {
  private readonly rows: TransportRow[] = [];
  private nextId = 1;

  async query(sql: string, params: unknown[] = []): Promise<{ rows: unknown[] }> {
    if (sql === TRANSPORT_SQL.insert("transport_events")) {
      const [subject, eventJson] = params as [string, string];
      const max = this.rows
        .filter((r) => r.subject === subject)
        .reduce((m, r) => Math.max(m, r.sequence), -1);
      const sequence = max + 1;
      this.rows.push({ id: this.nextId++, subject, sequence, event: JSON.parse(eventJson) });
      return { rows: [{ sequence }] };
    }
    if (sql === TRANSPORT_SQL.replay("transport_events")) {
      const [from] = params as [number];
      return {
        rows: this.rows
          .filter((r) => r.sequence >= Number(from))
          .sort((a, b) => a.id - b.id)
          .map(({ subject, sequence, event }) => ({ subject, sequence, event })),
      };
    }
    throw new Error(`FakeTransportPool: unexpected SQL: ${sql}`);
  }
}

/** Simulates sequence-race conflicts: the first `conflicts` inserts return no row. */
class ContentiousPool implements PgPoolLike {
  private calls = 0;
  constructor(private readonly conflicts: number) {}

  async query(sql: string): Promise<{ rows: unknown[] }> {
    if (sql !== TRANSPORT_SQL.insert("transport_events")) {
      throw new Error(`ContentiousPool: unexpected SQL: ${sql}`);
    }
    this.calls++;
    if (this.calls <= this.conflicts) return { rows: [] };
    return { rows: [{ sequence: 0 }] };
  }
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

class FakeVectorPool implements PgPoolLike {
  private readonly items = new Map<
    string,
    { collection: string; id: string; vec: number[]; payload: unknown }
  >();

  async query(sql: string, params: unknown[] = []): Promise<{ rows: unknown[] }> {
    if (sql === VECTOR_SQL.upsert) {
      const [collection, id, literal, payload] = params as [string, string, string, string];
      this.items.set(`${collection}:${id}`, {
        collection,
        id,
        vec: JSON.parse(literal) as number[],
        payload: JSON.parse(payload),
      });
      return { rows: [] };
    }
    if (sql === VECTOR_SQL.search) {
      const [collection, literal, limit] = params as [string, string, number];
      const query = JSON.parse(literal) as number[];
      const rows = [...this.items.values()]
        .filter((item) => item.collection === collection)
        .map((item) => ({ id: item.id, score: cosine(item.vec, query) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, Number(limit));
      return { rows };
    }
    if (sql === VECTOR_SQL.remove) {
      const [collection, id] = params as [string, string];
      this.items.delete(`${collection}:${id}`);
      return { rows: [] };
    }
    throw new Error(`FakeVectorPool: unexpected SQL: ${sql}`);
  }
}

// ── Hermetic conformance (same harness as the in-memory reference) ────────────────────────────

describe("PostgresEventTransport (hermetic fake pool)", () => {
  it("satisfies the EventTransport conformance suite", async () => {
    await expect(
      runEventTransportConformance(() => PostgresEventTransport.fromPool(new FakeTransportPool())),
    ).resolves.toBeUndefined();
  });

  it("retries sequence-race conflicts and then succeeds", async () => {
    const transport = PostgresEventTransport.fromPool(new ContentiousPool(2));
    const result = await transport.publish("learn.session", {
      event_id: "evt-1",
    } as never);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.sequence).toBe(0);
  });

  it("reports contention honestly after exhausting retries", async () => {
    const transport = PostgresEventTransport.fromPool(new ContentiousPool(99));
    const result = await transport.publish("learn.session", { event_id: "evt-1" } as never);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect((result.error as { code: string }).code).toBe("E_ADAPTER_PUBLISH_CONTENTION");
    }
  });
});

describe("PgVectorStore (hermetic fake pool)", () => {
  it("satisfies the VectorStore conformance suite", async () => {
    await expect(
      runVectorStoreConformance(() => PgVectorStore.fromPool(new FakeVectorPool())),
    ).resolves.toBeUndefined();
  });
});

// ── Supabase Storage object store (injected fetch) ────────────────────────────────────────────

describe("SupabaseStorageObjectStore (injected fetch)", () => {
  function fakeStorage() {
    const objects = new Map<string, { bytes: Uint8Array; mime: string }>();
    const requests: string[] = [];
    const fetchImpl = async (
      url: string,
      init: { method?: string; headers?: Record<string, string>; body?: Uint8Array | string } = {},
    ) => {
      requests.push(`${init.method ?? "GET"} ${url}`);
      const respond = (
        status: number,
        bytes: Uint8Array = new Uint8Array(),
        mime = "text/plain",
      ) => ({
        ok: status >= 200 && status < 300,
        status,
        arrayBuffer: async (): Promise<ArrayBuffer> => {
          const copy = new ArrayBuffer(bytes.byteLength);
          new Uint8Array(copy).set(bytes);
          return copy;
        },
        headers: { get: (name: string) => (name.toLowerCase() === "content-type" ? mime : null) },
        text: async () => "",
      });
      if (url.endsWith("/storage/v1/bucket")) return respond(200);
      const marker = "/storage/v1/object/";
      const key = url.slice(url.indexOf(marker) + marker.length);
      if (init.method === "POST") {
        objects.set(key, {
          bytes: init.body as Uint8Array,
          mime: init.headers?.["Content-Type"] ?? "application/octet-stream",
        });
        return respond(200);
      }
      const found = objects.get(key);
      if (!found) return respond(404);
      return respond(200, found.bytes, found.mime);
    };
    return { fetchImpl, requests };
  }

  it("round-trips bytes with mime type and returns a storage:// content_ref", async () => {
    const { fetchImpl } = fakeStorage();
    const created = SupabaseStorageObjectStore.create({
      url: "https://fake.supabase.co",
      serviceRoleKey: "svc",
      fetchImpl,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const store = created.value;
    await store.ensureBucket();
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const put = await store.put("sources/abc.pdf", { bytes, mimeType: "application/pdf" });
    expect(put.ok).toBe(true);
    if (put.ok) expect(put.value.content_ref).toBe("storage://cos-media/sources/abc.pdf");
    const got = await store.get("sources/abc.pdf");
    expect(got.ok).toBe(true);
    if (got.ok) {
      expect([...got.value.bytes]).toEqual([1, 2, 3, 4]);
      expect(got.value.mimeType).toBe("application/pdf");
    }
  });

  it("misses honestly (404 → typed error) and refuses creation without credentials", async () => {
    const { fetchImpl } = fakeStorage();
    const created = SupabaseStorageObjectStore.create({
      url: "https://fake.supabase.co",
      serviceRoleKey: "svc",
      fetchImpl,
    });
    if (!created.ok) return;
    const miss = await created.value.get("absent/path");
    expect(miss.ok).toBe(false);
    const noCreds = SupabaseStorageObjectStore.create({ url: "", serviceRoleKey: "" });
    expect(noCreds.ok).toBe(false);
  });
});

// ── Live smoke (gated; never runs in CI/verify) ───────────────────────────────────────────────

const LIVE = process.env["COS_SUPABASE_LIVE"] === "1" && Boolean(process.env["SUPABASE_DB_URL"]);

describe.runIf(LIVE)("live Supabase conformance (gated: COS_SUPABASE_LIVE=1)", () => {
  const url = process.env["SUPABASE_DB_URL"] ?? "";

  it(
    "PostgresEventTransport passes conformance against real Postgres",
    { timeout: 60000 },
    async () => {
      const table = `transport_events_smoke_${Date.now()}`;
      const relational = await PostgresRelationalStore.connect({ connectionString: url });
      expect(relational.ok).toBe(true);
      if (!relational.ok) return;
      await relational.value.query(
        `CREATE TABLE IF NOT EXISTS ${table} (id bigserial primary key, subject text not null, ` +
          `sequence bigint not null, event jsonb not null, unique (subject, sequence))`,
      );
      const transport = await PostgresEventTransport.connect({ connectionString: url, table });
      expect(transport.ok).toBe(true);
      if (!transport.ok) return;
      try {
        await runEventTransportConformance(() => transport.value);
      } finally {
        await relational.value.query(`DROP TABLE IF EXISTS ${table}`);
        await transport.value.close();
        await relational.value.close();
      }
    },
  );

  it("PgVectorStore passes conformance against real pgvector", { timeout: 60000 }, async () => {
    const relational = await PostgresRelationalStore.connect({ connectionString: url });
    expect(relational.ok).toBe(true);
    if (!relational.ok) return;
    await relational.value.query("DELETE FROM vectors WHERE collection = 'concepts'");
    const store = await PgVectorStore.connect({ connectionString: url });
    expect(store.ok).toBe(true);
    if (!store.ok) return;
    try {
      await runVectorStoreConformance(() => store.value);
    } finally {
      await store.value.close();
      await relational.value.close();
    }
  });
});
