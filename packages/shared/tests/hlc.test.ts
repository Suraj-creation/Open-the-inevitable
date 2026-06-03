import { describe, it, expect } from "vitest";
import {
  hlcInit,
  hlcTick,
  hlcReceive,
  hlcCompare,
  hlcHappensBefore,
  hlcToString,
  hlcParse,
} from "../src/hlc";
import { ManualClock } from "../src/clock";

describe("HybridLogicalClock", () => {
  it("advances physical time when the wall clock moves forward", () => {
    const clock = new ManualClock(1000);
    const t0 = hlcInit("node-a");
    const t1 = hlcTick(t0, clock);
    expect(t1.physicalMs).toBe(1000);
    expect(t1.logical).toBe(0);
  });

  it("increments the logical counter when the wall clock is unchanged", () => {
    const clock = new ManualClock(1000);
    let t = hlcInit("node-a");
    t = hlcTick(t, clock); // physical 1000, logical 0
    t = hlcTick(t, clock); // same wall time -> logical 1
    t = hlcTick(t, clock); // logical 2
    expect(t.physicalMs).toBe(1000);
    expect(t.logical).toBe(2);
  });

  it("merges a remote clock and stays causally after it", () => {
    const clock = new ManualClock(500);
    const local = hlcTick(hlcInit("node-a"), clock); // 500/0
    const remote = { physicalMs: 900, logical: 3, nodeId: "node-b" };
    const merged = hlcReceive(local, remote, clock);
    expect(merged.physicalMs).toBe(900);
    expect(merged.logical).toBe(4);
    expect(hlcHappensBefore(remote, merged)).toBe(true);
  });

  it("produces a lexicographically sortable, round-trippable string", () => {
    const a = { physicalMs: 1000, logical: 2, nodeId: "node-a" };
    const b = { physicalMs: 1000, logical: 10, nodeId: "node-a" };
    expect(hlcToString(a) < hlcToString(b)).toBe(true);
    expect(hlcCompare(a, b)).toBeLessThan(0);
    expect(hlcParse(hlcToString(a))).toEqual(a);
  });
});
