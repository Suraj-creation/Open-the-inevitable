import { describe, it, expect } from "vitest";
import { ManualClock } from "@inevitable/shared";
import { WorldStateGraph, type WorldStateDelta, type AppliedDelta } from "../src/index";

function graph(): WorldStateGraph {
  return new WorldStateGraph({ clock: new ManualClock(), acyclicEdgeTypes: ["prerequisite_of"] });
}

function concept(id: string): WorldStateDelta {
  return { kind: "upsert_node", id, type: "concept", props: { title: id } };
}
function prereq(id: string, from: string, to: string): WorldStateDelta {
  return { kind: "upsert_edge", id, from, to, type: "prerequisite_of" };
}

describe("WorldStateGraph — deltas & queries", () => {
  it("materializes nodes/edges and answers neighbor/type queries", () => {
    const g = graph();
    expect(g.apply(concept("calculus")).ok).toBe(true);
    expect(g.apply(concept("algebra")).ok).toBe(true);
    expect(g.apply(prereq("e1", "algebra", "calculus")).ok).toBe(true);

    expect(g.getNode("calculus")?.props.title).toBe("calculus");
    expect(
      g
        .nodesByType("concept")
        .map((n) => n.id)
        .sort(),
    ).toEqual(["algebra", "calculus"]);
    expect(g.neighbors("algebra", "prerequisite_of")).toEqual(["calculus"]);
    expect(g.version).toBe(3);
  });

  it("enforces acyclicity for DAG edge classes", () => {
    const g = graph();
    g.apply(concept("a"));
    g.apply(concept("b"));
    g.apply(concept("c"));
    expect(g.apply(prereq("ab", "a", "b")).ok).toBe(true);
    expect(g.apply(prereq("bc", "b", "c")).ok).toBe(true);
    const cyclic = g.apply(prereq("ca", "c", "a"));
    expect(cyclic.ok).toBe(false);
    if (!cyclic.ok) expect(cyclic.error.code).toBe("E_WORLD_STATE");
    expect(g.hasPath("a", "c", "prerequisite_of")).toBe(true);
    expect(g.hasPath("c", "a", "prerequisite_of")).toBe(false);
  });

  it("rejects removing a node with incident edges, allows it after edges go", () => {
    const g = graph();
    g.apply(concept("a"));
    g.apply(concept("b"));
    g.apply(prereq("ab", "a", "b"));
    expect(g.apply({ kind: "remove_node", id: "a" }).ok).toBe(false);
    expect(g.apply({ kind: "remove_edge", id: "ab" }).ok).toBe(true);
    expect(g.apply({ kind: "remove_node", id: "a" }).ok).toBe(true);
    expect(g.getNode("a")).toBeUndefined();
  });
});

describe("WorldStateGraph — determinism & snapshot", () => {
  const deltas: WorldStateDelta[] = [
    concept("a"),
    concept("b"),
    prereq("ab", "a", "b"),
    { kind: "set_node_prop", id: "a", key: "mastery", value: 0.5 },
  ];

  it("folds a delta sequence deterministically", () => {
    const g1 = graph();
    const g2 = graph();
    for (const d of deltas) g1.apply(d);
    for (const d of deltas) g2.apply(d);
    expect(JSON.stringify(g1.snapshot())).toEqual(JSON.stringify(g2.snapshot()));
  });

  it("round-trips through snapshot/restore", () => {
    const g = graph();
    for (const d of deltas) g.apply(d);
    const snap = g.snapshot();
    const restored = graph();
    restored.restore(snap);
    expect(restored.getNode("a")?.props.mastery).toBe(0.5);
    expect(restored.neighbors("a", "prerequisite_of")).toEqual(["b"]);
    expect(restored.version).toBe(snap.version);
  });

  it("notifies subscribers of applied deltas in order", () => {
    const g = graph();
    const seen: AppliedDelta[] = [];
    g.subscribe((a) => seen.push(a));
    g.apply(concept("a"));
    g.apply(concept("b"));
    expect(seen.map((a) => a.version)).toEqual([1, 2]);
    expect(seen[0]?.delta.kind).toBe("upsert_node");
  });
});
