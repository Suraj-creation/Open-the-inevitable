import { describe, it, expect } from "vitest";
import {
  InMemoryEventTransport,
  InMemoryVectorStore,
  NatsEventTransport,
  QdrantVectorStore,
  Neo4jGraphStore,
  PostgresRelationalStore,
  runEventTransportConformance,
  runVectorStoreConformance,
} from "../src/index";

describe("reference adapters — conformance", () => {
  it("InMemoryEventTransport satisfies the EventTransport conformance suite", async () => {
    await expect(
      runEventTransportConformance(() => new InMemoryEventTransport()),
    ).resolves.toBeUndefined();
  });

  it("InMemoryVectorStore satisfies the VectorStore conformance suite", async () => {
    await expect(
      runVectorStoreConformance(() => new InMemoryVectorStore()),
    ).resolves.toBeUndefined();
  });
});

describe("dependency-optional adapters — graceful absence (offline)", () => {
  it("NATS transport reports E_ADAPTER_UNAVAILABLE when the client is not installed", async () => {
    const result = await NatsEventTransport.connect({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("E_ADAPTER_UNAVAILABLE");
  });

  it("Qdrant / Neo4j adapters report E_ADAPTER_UNAVAILABLE offline", async () => {
    const qdrant = await QdrantVectorStore.connect({ url: "http://localhost:6333" });
    const neo4j = await Neo4jGraphStore.connect({ url: "bolt://localhost:7687" });
    for (const result of [qdrant, neo4j]) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("E_ADAPTER_UNAVAILABLE");
    }
  });

  it("Postgres adapter connects once `pg` is provisioned at the root edge (ADR-0034)", async () => {
    // `pg` joined the workspace root alongside @google/genai for the Supabase-first backend
    // (ADR-0034). Pool construction is lazy — no connection is attempted until a query — so
    // connect() succeeds offline. Graceful absence remains proven by the NATS/Qdrant/Neo4j cases.
    const postgres = await PostgresRelationalStore.connect({});
    expect(postgres.ok).toBe(true);
    if (postgres.ok) await postgres.value.close();
  });
});
