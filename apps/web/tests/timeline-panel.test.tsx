/**
 * CSE M9 TKM T1 — the Concept Timeline panel (CSE-006 §3.3). The pure projection renders the
 * concept's ordered epistemic states with their eras and grounded citations, in the reserved
 * research channel. Tested without a network — the fetch container wraps this body.
 */
import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TimelineBody } from "../src/components/TimelinePanel";
import type { TimelineView } from "../src/api";

const timeline: TimelineView = {
  timeline_id: "tkm-1",
  concept_ref: "backpropagation",
  source_version_id: null,
  as_of: "2026-07-16T00:00:00Z",
  degraded: false,
  states: [
    {
      kind: "origin",
      label: "Roots in control theory",
      summary: "Chain-rule optimization predates neural networks.",
      era: "1960s",
      external_refs: [
        { uri: "https://en.wikipedia.org/wiki/Backpropagation", title: "Backpropagation" },
      ],
      as_of: "2026-07-16T00:00:00Z",
    },
    {
      kind: "open-problem",
      label: "Biological plausibility",
      summary: "Whether the brain does something like backprop is debated.",
      era: null,
      external_refs: [{ uri: "https://example.edu/bio", title: "Bio Notes" }],
      as_of: "2026-07-16T00:00:00Z",
    },
  ],
};

describe("TimelineBody (CSE-006 §3.3 — the concept through time)", () => {
  test("renders ordered states with eras, kinds, and grounded citations", () => {
    const html = renderToStaticMarkup(<TimelineBody timeline={timeline} />);
    expect(html).toContain("Origin");
    expect(html).toContain("1960s");
    expect(html).toContain("Roots in control theory");
    expect(html).toContain("Open problem");
    expect(html).toContain("Biological plausibility");
    // Real citations render as external links.
    expect(html).toContain('href="https://en.wikipedia.org/wiki/Backpropagation"');
    // The temporal overlay declares itself grounded + honestly sparse.
    expect(html).toContain("honestly sparse");
  });
});
