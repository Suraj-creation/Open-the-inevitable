/**
 * CSE M9 Frontier T1 — the living-knowledge panel (CSE-006 §3.2). The pure projection renders each
 * frontier entry by kind, in the reserved research channel, with real clickable citations. Tested
 * without a network — the fetch container is a thin wrapper over this body.
 */
import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FrontierPanelBody } from "../src/components/FrontierPanel";
import type { FrontierView } from "../src/api";

const frontier: FrontierView = {
  overlay_id: "fov-1",
  concept_ref: "gradient-descent",
  source_version_id: "srcv-a",
  as_of: "2026-07-16T00:00:00Z",
  degraded: false,
  entries: [
    {
      kind: "latest-research",
      summary: "Adaptive step-size methods are an active research direction.",
      external_refs: [{ uri: "https://arxiv.org/abs/2401.1", title: "A 2024 Survey" }],
      as_of: "2026-07-16T00:00:00Z",
    },
    {
      kind: "open-question",
      summary: "Convergence on non-convex loss surfaces remains open.",
      external_refs: [{ uri: "https://example.edu/notes", title: "Lecture Notes" }],
      as_of: "2026-07-16T00:00:00Z",
    },
  ],
};

describe("FrontierPanelBody (CSE-006 §3.2 — the living edge, in its own channel)", () => {
  test("renders each entry by kind with its grounded, clickable citation", () => {
    const html = renderToStaticMarkup(<FrontierPanelBody frontier={frontier} />);
    expect(html).toContain("Latest research");
    expect(html).toContain("Open question");
    expect(html).toContain("Adaptive step-size methods");
    // Real citations render as external links (grounding is visible + verifiable).
    expect(html).toContain('href="https://arxiv.org/abs/2401.1"');
    expect(html).toContain("A 2024 Survey");
    // The source stays sacred — the frontier declares itself a separate channel.
    expect(html).toContain("the source stays sacred");
  });
});
