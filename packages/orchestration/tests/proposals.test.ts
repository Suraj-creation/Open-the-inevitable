/**
 * ProposalBlackboard — typed proposal lifecycle for multi-agent arbitration.
 * Spec: spec/orchestration/DPS-008-proposal-blackboard.md, ADR-0018.
 */
import { describe, expect, test } from "vitest";
import { ProposalBlackboard } from "../src/proposals";

describe("ProposalBlackboard.propose", () => {
  test("stores a proposal and returns a ProposalEntry", () => {
    const board = new ProposalBlackboard();
    const entry = board.propose("expl:math", "cog-exp", { text: "hello" });
    expect(entry.key).toBe("expl:math");
    expect(entry.agentCid).toBe("cog-exp");
    expect(entry.value).toEqual({ text: "hello" });
  });

  test("multiple agents can propose for the same key", () => {
    const board = new ProposalBlackboard();
    board.propose("expl:math", "cog-exp", { text: "a" });
    board.propose("expl:math", "cog-rev", { text: "b" });
    const proposals = board.proposals("expl:math");
    expect(proposals).toHaveLength(2);
    expect(proposals[0]?.agentCid).toBe("cog-exp");
    expect(proposals[1]?.agentCid).toBe("cog-rev");
  });

  test("proposals for different keys are independent", () => {
    const board = new ProposalBlackboard();
    board.propose("expl:algebra", "cog-exp", { text: "a" });
    board.propose("expl:calculus", "cog-rev", { text: "b" });
    expect(board.proposals("expl:algebra")).toHaveLength(1);
    expect(board.proposals("expl:calculus")).toHaveLength(1);
  });

  test("returns empty array for a key with no proposals", () => {
    const board = new ProposalBlackboard();
    expect(board.proposals("expl:unknown")).toHaveLength(0);
  });

  test("version increments with each proposal", () => {
    const board = new ProposalBlackboard();
    expect(board.version()).toBe(0);
    board.propose("k", "a", 1);
    expect(board.version()).toBeGreaterThan(0);
  });
});

describe("ProposalBlackboard.arbitrate", () => {
  test("records an arbitration result", () => {
    const board = new ProposalBlackboard();
    board.propose("expl:math", "cog-exp", "x");
    board.propose("expl:math", "cog-rev", "y");
    const record = board.arbitrate("expl:math", "cog-exp", "higher confidence selected");
    expect(record.key).toBe("expl:math");
    expect(record.winnerCid).toBe("cog-exp");
    expect(record.reason).toBe("higher confidence selected");
  });

  test("arbitrations are append-only and accumulate", () => {
    const board = new ProposalBlackboard();
    board.arbitrate("k1", "a", "reason a");
    board.arbitrate("k2", "b", "reason b");
    const recs = board.arbitrations();
    expect(recs).toHaveLength(2);
    expect(recs[0]?.key).toBe("k1");
    expect(recs[1]?.key).toBe("k2");
  });

  test("arbitrations returns a snapshot (not a live ref)", () => {
    const board = new ProposalBlackboard();
    const before = board.arbitrations();
    board.arbitrate("k", "a", "r");
    expect(before).toHaveLength(0);
    expect(board.arbitrations()).toHaveLength(1);
  });

  test("timestamps are monotonically increasing", () => {
    const board = new ProposalBlackboard();
    const p = board.propose("k", "a", 1);
    const arb = board.arbitrate("k", "a", "r");
    expect(arb.timestamp).toBeGreaterThan(p.timestamp);
  });
});
