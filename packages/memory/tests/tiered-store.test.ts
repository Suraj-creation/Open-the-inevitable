import { describe, it, expect } from "vitest";
import { SeededIdGenerator } from "@inevitable/shared";
import { TieredMemoryStore, type MemoryMutation } from "../src/index";

let counter = 0;
function mut(over: Partial<MemoryMutation>): MemoryMutation {
  return {
    mutation_id: `mut-${(counter++).toString(16).padStart(16, "0")}`,
    proposer_cid: "cog-000000000001",
    memory_layer: "semantic",
    mutation_type: "add_fact",
    target: { id: "concept:calculus" },
    evidence: [],
    confidence: 0.9,
    ...over,
  } as MemoryMutation;
}

describe("TieredMemoryStore", () => {
  it("commits validated mutations and projects current confidence", () => {
    const store = new TieredMemoryStore();
    const result = store.commit(mut({ confidence: 0.8 }));
    expect(result.ok).toBe(true);
    expect(store.confidenceOf("semantic", "concept:calculus")).toBe(0.8);
  });

  it("rejects malformed mutations (bad enum) without recording them", () => {
    const store = new TieredMemoryStore();
    const bad = mut({ mutation_type: "teleport" as MemoryMutation["mutation_type"] });
    const result = store.commit(bad);
    expect(result.ok).toBe(false);
    expect(store.history()).toHaveLength(0);
  });

  it("isolates tiers", () => {
    const store = new TieredMemoryStore();
    store.commit(mut({ memory_layer: "working", target: { id: "w1" }, confidence: 0.5 }));
    store.commit(mut({ memory_layer: "semantic", target: { id: "s1" }, confidence: 0.9 }));
    expect(store.byLayer("working").map((p) => p.targetId)).toEqual(["w1"]);
    expect(store.byLayer("semantic").map((p) => p.targetId)).toEqual(["s1"]);
    expect(store.history("working")).toHaveLength(1);
  });

  it("notifies subscribers of commits in order (distribution)", () => {
    const store = new TieredMemoryStore();
    const seen: string[] = [];
    store.subscribe((m) => seen.push(m.mutation_id));
    const a = store.commit(mut({})).ok ? store.history().at(-1)?.mutation_id : undefined;
    const b = store.commit(mut({})).ok ? store.history().at(-1)?.mutation_id : undefined;
    expect(seen).toEqual([a, b]);
  });

  it("redaction deactivates the projection but retains history", () => {
    const store = new TieredMemoryStore();
    store.commit(mut({ target: { id: "secret" }, confidence: 0.9 }));
    store.commit(mut({ target: { id: "secret" }, mutation_type: "redact_memory", confidence: 0 }));
    expect(store.projectionOf("semantic", "secret")?.active).toBe(false);
    expect(store.history("semantic").length).toBe(2);
  });

  it("reinforcement raises and decay lowers confidence via mutations", () => {
    const store = new TieredMemoryStore();
    store.commit(mut({ target: { id: "c" }, confidence: 0.5 }));
    store.commit(mut({ target: { id: "c" }, mutation_type: "reinforce_concept", confidence: 0.5 }));
    expect(store.confidenceOf("semantic", "c")).toBeCloseTo(0.75, 5);

    const ids = store.applyDecay("semantic", 0.5, "cog-000000000001", new SeededIdGenerator());
    expect(ids.length).toBeGreaterThan(0);
    expect(store.confidenceOf("semantic", "c")).toBeCloseTo(0.375, 5);
  });

  it("consolidation compresses while marking the target consolidated", () => {
    const store = new TieredMemoryStore();
    store.commit(
      mut({
        memory_layer: "episodic",
        target: { id: "ep:1" },
        mutation_type: "add_episode",
        confidence: 0.6,
      }),
    );
    store.commit(
      mut({
        memory_layer: "semantic",
        target: { id: "concept:x" },
        mutation_type: "consolidate_memory",
        confidence: 0.85,
      }),
    );
    const proj = store.projectionOf("semantic", "concept:x");
    expect(proj?.consolidated).toBe(true);
    expect(proj?.confidence).toBe(0.85);
  });
});
