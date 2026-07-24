/**
 * Multi-source Living Reference (Phase 3, E; ADR-0062). When two or more documents are attached, the
 * source pane offers a switcher across all of them, marks the one currently being taught, and lets
 * the learner browse the others — the original sources remain the primary foundation, all reachable.
 */
import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SurfaceState } from "@inevitable/surface/client";
import { SourceReference } from "../src/components/SourceReference";

function makeState(
  sources: { source_version_id: string; title: string; modality: string }[],
  plans: { frame_id: string; source_version_id: string }[] = [],
): SurfaceState {
  return {
    sources,
    viewport_plans: plans.map((p) => ({ ...p, viewports: [] })),
    sync_bindings: [],
    source_highlights: [],
    narration: [],
    narration_scripts: [],
  } as unknown as SurfaceState;
}

describe("SourceReference multi-source switcher (Phase 3, E)", () => {
  test("with ≥2 attached documents, offers a switcher across all and marks the taught one", () => {
    const state = makeState(
      [
        { source_version_id: "srcv-callen", title: "Callen — Thermodynamics", modality: "text" },
        { source_version_id: "srcv-feynman", title: "Feynman Lectures", modality: "text" },
      ],
      [{ frame_id: "cfr-1", source_version_id: "srcv-callen" }],
    );
    const html = renderToStaticMarkup(
      <SourceReference state={state} activeFrameId="cfr-1" currentSegmentId={null} />,
    );
    expect(html).toContain("source-switcher");
    expect(html).toContain("Callen"); // both documents are reachable
    expect(html).toContain("Feynman");
    // The taught source (the plan's) is marked; the pane title is the taught source by default.
    expect(html).toContain('data-taught="true"');
  });

  test("with a single source, no switcher is shown (nothing to switch between)", () => {
    const state = makeState(
      [{ source_version_id: "srcv-1", title: "Only Doc", modality: "text" }],
      [{ frame_id: "cfr-1", source_version_id: "srcv-1" }],
    );
    const html = renderToStaticMarkup(
      <SourceReference state={state} activeFrameId="cfr-1" currentSegmentId={null} />,
    );
    expect(html).not.toContain("source-switcher");
  });
});
