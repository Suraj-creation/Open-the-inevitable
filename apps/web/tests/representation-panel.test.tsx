/**
 * RepresentationPanel (ADR-0058 §5) — the RIA's plan made inspectable. Verifies the panel surfaces
 * plan_kind, the density verdict, the Law-8 adaptivity note, per-element role/hierarchy, and the
 * exclusion list; that it prefers the active frame's plan; and that it degrades honestly to a
 * "no plan yet" note. Pure projection — no truth of its own.
 */
import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { RepresentationPlan } from "@inevitable/surface/client";
import { RepresentationPanel } from "../src/components/RepresentationPanel";

function plan(overrides: Partial<RepresentationPlan> = {}): RepresentationPlan {
  return {
    frame_id: "cfr-1",
    composition: [
      { element_id: "el-core_concept", hierarchy: "primary", epistemic_role: "canonical" },
      { element_id: "el-key_example", hierarchy: "residue", epistemic_role: "example" },
    ],
    exclusions: ["a tangential aside"],
    density: { count: 2, budget: 8, within_budget: true },
    plan_kind: "model",
    adaptivity: { expertise: "expert", note: "Compressed — scaffolding receded." },
    hlc: "",
    ...overrides,
  } as RepresentationPlan;
}

describe("RepresentationPanel (ADR-0058 §5)", () => {
  test("surfaces plan_kind, density, adaptivity, roles/hierarchy, and exclusions", () => {
    const html = renderToStaticMarkup(
      <RepresentationPanel representations={[plan()]} activeFrameId="cfr-1" />,
    );
    expect(html).toContain("model");
    expect(html).toContain("2/8 anchors");
    expect(html).toContain("expert");
    expect(html).toContain("Compressed — scaffolding receded.");
    expect(html).toContain("core concept"); // el- prefix stripped, underscores spaced
    expect(html).toContain('data-epistemic-role="canonical"');
    expect(html).toContain('data-hierarchy="residue"'); // the receded example
    expect(html).toContain("a tangential aside");
  });

  test("flags an over-budget frame (Law 3 split signal)", () => {
    const html = renderToStaticMarkup(
      <RepresentationPanel
        representations={[plan({ density: { count: 11, budget: 8, within_budget: false } })]}
        activeFrameId="cfr-1"
      />,
    );
    expect(html).toContain("rep-density--over");
    expect(html).toContain("11/8 anchors");
  });

  test("prefers the active frame's plan over the latest", () => {
    const plans = [
      plan({ frame_id: "cfr-1", adaptivity: { expertise: "novice", note: "Full scaffolding." } }),
      plan({ frame_id: "cfr-2", adaptivity: { expertise: "expert", note: "Compressed." } }),
    ];
    const html = renderToStaticMarkup(
      <RepresentationPanel representations={plans} activeFrameId="cfr-1" />,
    );
    expect(html).toContain("Full scaffolding.");
    expect(html).not.toContain("Compressed.");
  });

  test("degrades to an honest 'no plan' note when there is none", () => {
    const html = renderToStaticMarkup(<RepresentationPanel representations={[]} />);
    expect(html).toContain("rep-empty");
    expect(html).toContain("floor");
  });
});
