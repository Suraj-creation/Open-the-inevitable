/**
 * PostgresLearnerStore (DPS-003/DPS-004, migration 0004) — the store that makes identity and
 * carried cognition survive a redeploy.
 *
 * The fake pool is a tiny relational engine keyed on the exported SQL surface (no driver, no
 * network), so these assert real merge semantics — including the idempotency that the file-backed
 * profile got from a read-modify-write of a JSON blob and now gets from the primary key.
 */
import { describe, expect, it } from "vitest";
import { LEARNER_SQL, PostgresLearnerStore, type LearnerRow, type PgPoolLike } from "../src/index";

class FakeLearnerPool implements PgPoolLike {
  readonly learners = new Map<string, Record<string, unknown>>();
  readonly surfaces: Array<Record<string, unknown>> = [];
  readonly nodes = new Map<string, Record<string, unknown>>();
  readonly edges = new Map<string, Record<string, unknown>>();
  readonly mutations = new Map<string, Record<string, unknown>>();

  async query(sql: string, params: unknown[] = []): Promise<{ rows: unknown[] }> {
    const p = params as string[];
    switch (sql) {
      case LEARNER_SQL.upsert: {
        const [cid, learnerId, , trustLevel, apiKey, displayName, createdAt] = params as [
          string,
          string,
          string,
          number,
          string,
          string | null,
          string,
        ];
        this.learners.set(cid, {
          ...(this.learners.get(cid) ?? {}),
          cid,
          learner_id: learnerId,
          trust_level: trustLevel,
          api_key: apiKey,
          display_name: displayName,
          created_at: createdAt,
        });
        return { rows: [] };
      }
      case LEARNER_SQL.byId:
        return { rows: [...this.learners.values()].filter((l) => l["learner_id"] === p[1]) };
      case LEARNER_SQL.byApiKey:
        return { rows: [...this.learners.values()].filter((l) => l["api_key"] === p[1]) };
      case LEARNER_SQL.addSurface: {
        const key = `${p[1]}:${p[2]}`;
        const seen = this.surfaces.some((s) => `${s["learner_id"]}:${s["surface_id"]}` === key);
        if (!seen) {
          this.surfaces.push({
            learner_id: p[1],
            surface_id: p[2],
            goal: p[3],
            created_at: `2026-08-16T00:00:0${this.surfaces.length}Z`,
          });
        }
        return { rows: [] };
      }
      case LEARNER_SQL.surfaces:
        return { rows: this.surfaces.filter((s) => s["learner_id"] === p[1]).reverse() };
      case LEARNER_SQL.upsertNode:
        this.nodes.set(`${p[1]}:${p[2]}`, {
          learner_id: p[1],
          node_id: p[2],
          node_type: p[3],
          props: p[4],
        });
        return { rows: [] };
      case LEARNER_SQL.upsertEdge:
        this.edges.set(`${p[1]}:${p[2]}`, {
          learner_id: p[1],
          edge_id: p[2],
          from_node: p[3],
          to_node: p[4],
          edge_type: p[5],
          props: p[6],
        });
        return { rows: [] };
      case LEARNER_SQL.upsertMutation: {
        const mutationId = String(p[0]);
        if (!this.mutations.has(mutationId)) {
          this.mutations.set(mutationId, { mutation: p[4], learner_cid: p[2] });
        }
        return { rows: [] };
      }
      case LEARNER_SQL.nodes:
        return { rows: [...this.nodes.values()].filter((n) => n["learner_id"] === p[1]) };
      case LEARNER_SQL.edges:
        return { rows: [...this.edges.values()].filter((e) => e["learner_id"] === p[1]) };
      case LEARNER_SQL.mutations:
        return { rows: [...this.mutations.values()].filter((m) => m["learner_cid"] === p[1]) };
      case LEARNER_SQL.redactNodes:
        for (const [k, v] of this.nodes) if (v["learner_id"] === p[1]) this.nodes.delete(k);
        return { rows: [] };
      case LEARNER_SQL.redactEdges:
        for (const [k, v] of this.edges) if (v["learner_id"] === p[1]) this.edges.delete(k);
        return { rows: [] };
      case LEARNER_SQL.redactSurfaces: {
        for (let i = this.surfaces.length - 1; i >= 0; i -= 1) {
          if (this.surfaces[i]!["learner_id"] === p[1]) this.surfaces.splice(i, 1);
        }
        return { rows: [] };
      }
      case LEARNER_SQL.redactMutations:
        for (const [k, v] of this.mutations)
          if (v["learner_cid"] === p[1]) this.mutations.delete(k);
        return { rows: [] };
      case LEARNER_SQL.redact:
        for (const [k, v] of this.learners) if (v["learner_id"] === p[1]) this.learners.delete(k);
        return { rows: [] };
      default:
        throw new Error(`FakeLearnerPool: unexpected SQL: ${sql}`);
    }
  }
}

const LEARNER: LearnerRow = {
  learner_id: "lnr-abc",
  cid: "cog-abc",
  trust_level: 5,
  display_name: "Maya",
  created_at: "2026-08-16T00:00:00.000Z",
  api_key: "key-secret",
};

describe("PostgresLearnerStore (hermetic fake pool)", () => {
  it("round-trips identity — a returning learner is recognised by their bearer key", async () => {
    const store = PostgresLearnerStore.fromPool(new FakeLearnerPool());
    await store.upsert(LEARNER);

    // The production failure that motivated migration 0004: an ephemeral registry lost the api_key,
    // so returning learners were rejected 401. Resolution must not depend on process-local state.
    expect(await store.getByApiKey("key-secret")).toMatchObject({
      learner_id: "lnr-abc",
      cid: "cog-abc",
      trust_level: 5,
    });
    expect(await store.get("lnr-abc")).toMatchObject({ display_name: "Maya" });
    expect(await store.getByApiKey("wrong-key")).toBeNull();
    expect(await store.get("lnr-missing")).toBeNull();
  });

  it("survives a simulated restart: a NEW store over the same data resolves the learner", async () => {
    const pool = new FakeLearnerPool();
    const before = PostgresLearnerStore.fromPool(pool);
    await before.upsert(LEARNER);
    await before.recordSurface("lnr-abc", "srf-1", "Teach me entropy");

    // Process dies. Nothing survives in memory — only the store.
    const after = PostgresLearnerStore.fromPool(pool);
    expect(await after.getByApiKey("key-secret")).toMatchObject({ learner_id: "lnr-abc" });
    expect(await after.surfaces("lnr-abc")).toEqual([
      { surface_id: "srf-1", goal: "Teach me entropy", created_at: expect.any(String) },
    ]);
  });

  it("merges carried cognition idempotently — re-capturing an unchanged surface is a no-op", async () => {
    const store = PostgresLearnerStore.fromPool(new FakeLearnerPool());
    const seed = {
      nodes: [{ id: "concept:entropy", type: "concept", props: { title: "Entropy" } }],
      edges: [{ id: "e1", from: "mastery:1", to: "concept:entropy", type: "assesses", props: {} }],
      mutations: [{ mutation_id: "mut-1", memory_layer: "semantic", hlc: "h1", payload: { a: 1 } }],
    };
    await store.mergeCognition("lnr-abc", "cog-abc", seed);
    await store.mergeCognition("lnr-abc", "cog-abc", seed); // same surface re-captured

    const read = await store.readCognition("lnr-abc", "cog-abc");
    expect(read.nodes).toHaveLength(1); // never double-counted
    expect(read.edges).toHaveLength(1);
    expect(read.mutations).toHaveLength(1);
    expect(read.nodes[0]).toMatchObject({ id: "concept:entropy", props: { title: "Entropy" } });
    expect(read.mutations[0]).toMatchObject({ mutation_id: "mut-1" });
  });

  it("accumulates across surfaces — understanding compounds rather than resetting", async () => {
    const store = PostgresLearnerStore.fromPool(new FakeLearnerPool());
    await store.mergeCognition("lnr-abc", "cog-abc", {
      nodes: [{ id: "concept:entropy", type: "concept", props: {} }],
      edges: [],
      mutations: [{ mutation_id: "m1", memory_layer: "semantic", hlc: "h1" }],
    });
    await store.mergeCognition("lnr-abc", "cog-abc", {
      nodes: [{ id: "concept:free-energy", type: "concept", props: {} }],
      edges: [],
      mutations: [{ mutation_id: "m2", memory_layer: "procedural", hlc: "h2" }],
    });

    const read = await store.readCognition("lnr-abc", "cog-abc");
    expect(read.nodes.map((n) => n.id).sort()).toEqual(["concept:entropy", "concept:free-energy"]);
    expect(read.mutations).toHaveLength(2);
  });

  it("scopes cognition per learner — one learner never reads another subgraph", async () => {
    const store = PostgresLearnerStore.fromPool(new FakeLearnerPool());
    await store.mergeCognition("lnr-a", "cog-a", {
      nodes: [{ id: "concept:a", type: "concept", props: {} }],
      edges: [],
      mutations: [],
    });
    await store.mergeCognition("lnr-b", "cog-b", {
      nodes: [{ id: "concept:b", type: "concept", props: {} }],
      edges: [],
      mutations: [],
    });
    expect((await store.readCognition("lnr-a", "cog-a")).nodes.map((n) => n.id)).toEqual([
      "concept:a",
    ]);
    expect((await store.readCognition("lnr-b", "cog-b")).nodes.map((n) => n.id)).toEqual([
      "concept:b",
    ]);
  });

  it("redacts EVERY trace on request (right to erasure cascades — ADR-0064)", async () => {
    const store = PostgresLearnerStore.fromPool(new FakeLearnerPool());
    await store.upsert(LEARNER);
    await store.recordSurface("lnr-abc", "srf-1", "Teach me entropy");
    await store.mergeCognition("lnr-abc", "cog-abc", {
      nodes: [{ id: "concept:entropy", type: "concept", props: {} }],
      edges: [{ id: "e1", from: "a", to: "b", type: "assesses", props: {} }],
      mutations: [{ mutation_id: "m1", memory_layer: "semantic", hlc: "h1" }],
    });

    await store.redact("lnr-abc");

    // Identity gone, and nothing learner-scoped is left behind (not a soft hide).
    expect(await store.getByApiKey("key-secret")).toBeNull();
    expect(await store.get("lnr-abc")).toBeNull();
    expect(await store.surfaces("lnr-abc")).toEqual([]);
    const remnants = await store.readCognition("lnr-abc", "cog-abc");
    expect(remnants.nodes).toEqual([]);
    expect(remnants.edges).toEqual([]);
    expect(remnants.mutations).toEqual([]);
  });
});
