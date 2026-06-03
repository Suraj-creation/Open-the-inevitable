import { describe, it, expect } from "vitest";
import { InMemoryMemoryStore, type MemoryMutation } from "../src/index";

const validMutation: MemoryMutation = {
  mutation_id: "mut-0000000000000001",
  proposer_cid: "cog-0123456789ab",
  memory_layer: "semantic",
  mutation_type: "add_fact",
  target: { concept_id: "calculus.derivatives" },
  evidence: [{ source: "textbook" }],
  confidence: 0.9,
} as MemoryMutation;

describe("InMemoryMemoryStore", () => {
  it("commits validated mutations and records history", () => {
    const store = new InMemoryMemoryStore();
    const result = store.commit(validMutation);
    expect(result.ok).toBe(true);
    expect(store.history()).toHaveLength(1);
  });

  it("rejects malformed mutations", () => {
    const store = new InMemoryMemoryStore();
    const bad = { ...validMutation, mutation_type: "frobnicate" } as unknown as MemoryMutation;
    const result = store.commit(bad);
    expect(result.ok).toBe(false);
    expect(store.history()).toHaveLength(0);
  });
});
