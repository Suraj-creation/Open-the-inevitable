/**
 * planSourceRender (CSE-008; Slice 1) — the document is an AGENT-PLACED REGION of the Cognitive
 * Surface, not an always-on full-bleed reader. It appears only when the ACTIVE frame references the
 * source, is placed by the agent's viewport emphasis, and retires (hidden) otherwise.
 */
import { describe, expect, test } from "vitest";
import {
  planSourceRender,
  type SourceViewport,
  type SourceViewportPlanRecord,
  type ViewportEmphasis,
} from "../src/index";

function viewport(emphasis: ViewportEmphasis, page: number | null = 3): SourceViewport {
  return {
    viewport_id: `vp-${emphasis}`,
    anchor_ref: "a1",
    emphasis,
    ordinal: 0,
    region: { path: "p", page, bbox: null, char_start: 0, char_end: 10, quote: "q" },
  };
}

function plan(viewports: SourceViewport[]): SourceViewportPlanRecord {
  return { plan_id: "pl1", frame_id: "f1", source_version_id: "sv1", viewports, hlc: "0" };
}

describe("planSourceRender — the document as an agent-placed surface region (CSE-008)", () => {
  test("retires (hidden) when the active frame has no plan and no highlights", () => {
    const decision = planSourceRender({ plan: null, currentViewport: null, hasHighlights: false });
    expect(decision.visible).toBe(false);
    expect(decision.placement).toBe("hidden");
  });

  test("focus emphasis → spotlight (teaching FROM the doc), page-cited reason", () => {
    const vp = viewport("focus", 3);
    const decision = planSourceRender({
      plan: plan([vp]),
      currentViewport: vp,
      hasHighlights: false,
    });
    expect(decision.visible).toBe(true);
    expect(decision.placement).toBe("spotlight");
    expect(decision.reason).toContain("p.3");
  });

  test("context emphasis → beside (reference column)", () => {
    const vp = viewport("context");
    expect(
      planSourceRender({ plan: plan([vp]), currentViewport: vp, hasHighlights: false }).placement,
    ).toBe("beside");
  });

  test("orientation emphasis → corner (peripheral reference)", () => {
    const vp = viewport("orientation");
    expect(
      planSourceRender({ plan: plan([vp]), currentViewport: vp, hasHighlights: false }).placement,
    ).toBe("corner");
  });

  test("highlights alone (no plan) still surface the region, defaulting to beside", () => {
    const decision = planSourceRender({ plan: null, currentViewport: null, hasHighlights: true });
    expect(decision.visible).toBe(true);
    expect(decision.placement).toBe("beside");
  });
});
