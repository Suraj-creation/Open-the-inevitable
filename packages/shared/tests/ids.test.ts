import { describe, it, expect } from "vitest";
import { newCid, isCid, SeededIdGenerator, newPacketId, newEventId } from "../src/ids";

describe("identifiers", () => {
  it("generates well-formed CIDs", () => {
    const cid = newCid();
    expect(isCid(cid)).toBe(true);
    expect(cid).toMatch(/^cog-[0-9a-f]{12}$/);
  });

  it("rejects malformed CIDs", () => {
    expect(isCid("agent-1")).toBe(false);
    expect(isCid("cog-XYZ")).toBe(false);
  });

  it("is deterministic with a seeded generator (replay-safe)", () => {
    const a = new SeededIdGenerator();
    const b = new SeededIdGenerator();
    expect(newCid(a)).toBe(newCid(b));
    expect(newPacketId(a)).toBe(newPacketId(b));
  });

  it("produces distinct prefixes per id type", () => {
    const gen = new SeededIdGenerator();
    expect(newPacketId(gen)).toMatch(/^cp-/);
    expect(newEventId(gen)).toMatch(/^evt-/);
  });
});
