/**
 * Per-kind MCCR diagram layout (UCS, ADR-0030). Pure + deterministic: the planner's `kind` must
 * produce a distinct, replay-stable geometry (a flow is a row, a tree is layered) — never one ring.
 */
import { describe, expect, test } from "vitest";
import type { MccrDiagram } from "@inevitable/surface/client";
import { layoutDiagram } from "../src/components/MccrElement";

function diagram(
  kind: MccrDiagram["kind"],
  ids: string[],
  edges: [string, string][] = [],
): MccrDiagram {
  return {
    kind,
    nodes: ids.map((id) => ({ id, label: id, group: null })),
    edges: edges.map(([from, to]) => ({ from, to, relation: null })),
  };
}

describe("layoutDiagram", () => {
  test("is deterministic (same input → same positions)", () => {
    const d = diagram("node-graph", ["a", "b", "c"]);
    expect(layoutDiagram(d)).toEqual(layoutDiagram(d));
  });

  test("a flow lays nodes along a single horizontal row", () => {
    const pos = layoutDiagram(diagram("flow", ["a", "b", "c"]));
    const ys = pos.map((p) => p.y);
    expect(new Set(ys).size).toBe(1); // all on one row
    expect(pos[0]!.x).toBeLessThan(pos[1]!.x);
    expect(pos[1]!.x).toBeLessThan(pos[2]!.x);
  });

  test("a tree layers children below their parent", () => {
    const pos = layoutDiagram(diagram("tree", ["root", "child"], [["root", "child"]]));
    const root = pos.find((p) => p.id === "root")!;
    const child = pos.find((p) => p.id === "child")!;
    expect(child.y).toBeGreaterThan(root.y);
  });

  test("a node-graph places multiple nodes on a ring (distinct positions)", () => {
    const pos = layoutDiagram(diagram("node-graph", ["a", "b", "c", "d"]));
    const points = new Set(pos.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`));
    expect(points.size).toBe(4);
  });

  test("a single node is centered; empty yields nothing", () => {
    expect(layoutDiagram(diagram("node-graph", ["only"]))).toHaveLength(1);
    expect(layoutDiagram(diagram("node-graph", []))).toHaveLength(0);
  });

  test("a cycle orders nodes around the ring by the edge chain (arrows flow, never criss-cross)", () => {
    // Declared order a,c,b — but edges chain a→b→c→a, so ring order must be a,b,c.
    const d = diagram(
      "cycle",
      ["a", "c", "b"],
      [
        ["a", "b"],
        ["b", "c"],
        ["c", "a"],
      ],
    );
    const pos = layoutDiagram(d);
    const angleOf = (id: string): number => {
      const p = pos.find((x) => x.id === id)!;
      return Math.atan2(p.y - 95, p.x - 170); // around the 340×190 viewBox center
    };
    // Walking the chain a→b→c must advance monotonically around the circle (mod 2π).
    const a = angleOf("a");
    const b = angleOf("b");
    const c = angleOf("c");
    const step1 = (b - a + 2 * Math.PI) % (2 * Math.PI);
    const step2 = (c - b + 2 * Math.PI) % (2 * Math.PI);
    expect(step1).toBeCloseTo(step2, 5); // equal angular steps → the chain flows around the ring
    expect(layoutDiagram(d)).toEqual(pos); // deterministic
  });
});
