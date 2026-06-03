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

  it("Qdrant / Neo4j / Postgres adapters report E_ADAPTER_UNAVAILABLE offline", async () => {
    const qdrant = await QdrantVectorStore.connect({ url: "http://localhost:6333" });
    const neo4j = await Neo4jGraphStore.connect({ url: "bolt://localhost:7687" });
    const postgres = await PostgresRelationalStore.connect({});
    for (const result of [qdrant, neo4j, postgres]) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("E_ADAPTER_UNAVAILABLE");
    }
  });
});
