import { describe, it, expect } from "vitest";
import { ADAPTER_CONTRACTS } from "../src/index";

describe("adapter contracts", () => {
  it("declares the full set of pluggable infrastructure adapters (ADR-0003)", () => {
    expect(ADAPTER_CONTRACTS).toContain("EventTransport");
    expect(ADAPTER_CONTRACTS).toContain("GraphStore");
    expect(ADAPTER_CONTRACTS).toContain("VectorStore");
    expect(ADAPTER_CONTRACTS).toContain("ModelRuntime");
    expect(ADAPTER_CONTRACTS).toHaveLength(8);
    expect(new Set(ADAPTER_CONTRACTS).size).toBe(ADAPTER_CONTRACTS.length);
  });
});
