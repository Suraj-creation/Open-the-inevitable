/**
 * Context-lease-bounded retrieval (DPS-005): the lease is the boundary, enforced fail-closed.
 * Covers relevance ranking, tier/user/budget bounding, expiry, and determinism. The VectorStore here is
 * a faithful inline cosine store (the integration path uses the real InMemoryVectorStore via the CLI).
 */
import { describe, expect, test } from "vitest";
import type { VectorStore } from "@inevitable/contracts";
import type { ContextLease } from "@inevitable/protocols";
import { ContextAssembler, type RetrievableMemoryItem } from "../src/index";

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
    na += (a[i] ?? 0) ** 2;
    nb += (b[i] ?? 0) ** 2;
  }
  return na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
}

class TestVectors implements VectorStore {
  private readonly m = new Map<string, number[]>();
  async upsert(_c: string, id: string, vector: number[]): Promise<void> {
    this.m.set(id, vector);
  }
  async search(
    _c: string,
    vector: number[],
    limit: number,
  ): Promise<Array<{ id: string; score: number }>> {
    return [...this.m.entries()]
      .map(([id, v]) => ({ id, score: cosine(vector, v) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(0, limit));
  }
  async delete(_c: string, id: string): Promise<void> {
    this.m.delete(id);
  }
}

function lease(overrides: Partial<ContextLease> = {}): ContextLease {
  return {
    lease_id: "lease-test",
    granted_to: "cog-learner",
    memory_layers: ["working", "semantic"],
    allowed_users: ["user-a"],
    token_budget: 16_000,
    granted_by: "kernel",
    expires_at: "2030-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function item(
  over: Partial<RetrievableMemoryItem> & { id: string; text: string },
): RetrievableMemoryItem {
  return {
    memoryLayer: "semantic",
    ownerUserId: "user-a",
    confidence: 0.9,
    ...over,
  };
}

async function freshAssembler(items: RetrievableMemoryItem[]): Promise<ContextAssembler> {
  const a = new ContextAssembler({ vectors: new TestVectors() });
  await a.index(items);
  return a;
}

describe("DPS-005 — ContextAssembler (lease-bounded retrieval)", () => {
  test("ranks by relevance and excludes off-topic memory", async () => {
    const a = await freshAssembler([
      item({ id: "m1", text: "photosynthesis chlorophyll light energy" }),
      item({ id: "m2", text: "recursion stack base case call" }),
    ]);
    const ctx = await a.assemble({ query: "photosynthesis light", lease: lease() });
    expect(ctx.items.map((i) => i.id)).toEqual(["m1"]); // recursion item is off-topic ⇒ excluded
    expect(ctx.items[0]!.score).toBeGreaterThan(0);
  });

  test("tier bound: items outside lease.memory_layers are excluded (and counted)", async () => {
    const a = await freshAssembler([
      item({ id: "sem", text: "gradient descent optimization", memoryLayer: "semantic" }),
      item({ id: "proc", text: "gradient descent optimization", memoryLayer: "procedural" }),
    ]);
    const ctx = await a.assemble({ query: "gradient descent", lease: lease() }); // allows semantic only
    expect(ctx.items.map((i) => i.id)).toEqual(["sem"]);
    expect(ctx.excludedByLease).toBe(1);
  });

  test("user bound: another learner's memory is never assembled", async () => {
    const a = await freshAssembler([
      item({ id: "mine", text: "neural networks perceptron", ownerUserId: "user-a" }),
      item({ id: "theirs", text: "neural networks perceptron", ownerUserId: "user-b" }),
    ]);
    const ctx = await a.assemble({
      query: "neural networks",
      lease: lease({ allowed_users: ["user-a"] }),
    });
    expect(ctx.items.map((i) => i.id)).toEqual(["mine"]);
    expect(ctx.excludedByLease).toBe(1);
  });

  test("budget bound: tokensUsed never exceeds the budget; the rest are dropped", async () => {
    const a = await freshAssembler([
      item({ id: "m1", text: "photosynthesis light reactions calvin cycle" }),
      item({ id: "m2", text: "photosynthesis chlorophyll absorption spectrum" }),
    ]);
    // Tiny token_budget: only the single top-ranked item can fit.
    const ctx = await a.assemble({ query: "photosynthesis", lease: lease({ token_budget: 11 }) });
    expect(ctx.tokensUsed).toBeLessThanOrEqual(11);
    expect(ctx.items.length).toBe(1);
    expect(ctx.droppedForBudget).toBeGreaterThanOrEqual(1);
  });

  test("expiry: a past-expiry lease assembles nothing", async () => {
    const a = await freshAssembler([item({ id: "m1", text: "photosynthesis light" })]);
    const ctx = await a.assemble({
      query: "photosynthesis",
      lease: lease({ expires_at: "2020-01-01T00:00:00.000Z" }),
      nowMs: Date.parse("2026-06-20T00:00:00.000Z"),
    });
    expect(ctx.leaseExpired).toBe(true);
    expect(ctx.items).toEqual([]);
  });

  test("deterministic: identical (memory, query, lease) ⇒ identical assembly", async () => {
    const items = [
      item({ id: "m1", text: "photosynthesis chlorophyll light" }),
      item({ id: "m2", text: "linear algebra vectors matrices" }),
    ];
    const a = await freshAssembler(items);
    const b = await freshAssembler(items);
    const q = { query: "photosynthesis light", lease: lease() };
    expect(await a.assemble(q)).toEqual(await b.assemble(q));
  });

  test("empty index ⇒ empty context (no-op)", async () => {
    const a = await freshAssembler([]);
    const ctx = await a.assemble({ query: "anything", lease: lease() });
    expect(ctx.items).toEqual([]);
    expect(ctx.leaseExpired).toBe(false);
  });
});

// A collection-aware shared store — faithful to InMemoryVectorStore / PgVectorStore, which both key
// by (collection, id). Stands in for a DURABLE store: it survives across ContextAssembler instances,
// exactly as PgVectorStore survives across sessions/redeploys (same conformance).
class SharedVectors implements VectorStore {
  private readonly m = new Map<string, Map<string, { vector: number[]; payload?: object }>>();
  private col(c: string) {
    let x = this.m.get(c);
    if (!x) this.m.set(c, (x = new Map()));
    return x;
  }
  async upsert(
    c: string,
    id: string,
    vector: number[],
    payload?: Record<string, unknown>,
  ): Promise<void> {
    this.col(c).set(id, { vector, ...(payload ? { payload } : {}) });
  }
  async search(c: string, vector: number[], limit: number) {
    return [...this.col(c).entries()]
      .map(([id, r]) => ({
        id,
        score: cosine(vector, r.vector),
        ...(r.payload ? { payload: r.payload as Record<string, unknown> } : {}),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(0, limit));
  }
  async delete(c: string, id: string): Promise<void> {
    this.col(c).delete(id);
  }
}

describe("ADR-0065 — durable, cross-session, per-learner retrieval", () => {
  test("a later session retrieves what an earlier one indexed (durable store survives the session)", async () => {
    const durable = new SharedVectors();
    const collection = "context:cog-maya";

    // Session 1: index the learner's semantic memory, then the process ends (assembler discarded).
    const session1 = new ContextAssembler({ vectors: durable, collection });
    await session1.index([
      item({ id: "m1", text: "entropy measures disorder" }),
      item({ id: "m2", text: "the boltzmann relation counts microstates" }),
    ]);

    // Session 2: a BRAND-NEW assembler over the SAME durable store — nothing carried in memory.
    // It must still retrieve the earlier session's knowledge (this is the whole point of durability).
    const session2 = new ContextAssembler({ vectors: durable, collection });
    const ctx = await session2.assemble({ query: "entropy microstates", lease: lease() });
    expect(ctx.items.length).toBeGreaterThan(0);
    expect(ctx.items.map((i) => i.id)).toContain("m2");
  });

  test("per-learner collection isolates learners on a shared durable store", async () => {
    const durable = new SharedVectors();
    const maya = new ContextAssembler({ vectors: durable, collection: "context:cog-maya" });
    const arjun = new ContextAssembler({ vectors: durable, collection: "context:cog-arjun" });
    await maya.index([item({ id: "maya-1", text: "maya studied gradient descent" })]);
    await arjun.index([item({ id: "arjun-1", text: "arjun studied gradient descent" })]);

    // Arjun's assembler must NEVER surface Maya's memory, even for an identical query.
    const ctx = await arjun.assemble({ query: "gradient descent", lease: lease() });
    const ids = ctx.items.map((i) => i.id);
    expect(ids).toContain("arjun-1");
    expect(ids).not.toContain("maya-1");
  });
});
