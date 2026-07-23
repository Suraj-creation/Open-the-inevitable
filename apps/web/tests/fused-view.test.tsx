/**
 * CSE M9 T1 — the Fused view (CSE-015). The pure projection renders corroboration where sources
 * overlap, each source's treatment (provenance never blurred), and honest coverage gaps. Tested
 * without a network — the fetch container is a thin wrapper over this panel.
 */
import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FusedViewPanel } from "../src/components/FusedView";
import type { FusionView } from "../src/api";

const fusion: FusionView = {
  concept_refs: ["gradient-descent", "backpropagation"],
  source_version_ids: ["srcv-a", "srcv-b"],
  concepts: [
    {
      concept_ref: "gradient-descent",
      source_treatments: [
        {
          source_version_id: "srcv-a",
          title: "Optimization Textbook",
          anchor_refs: ["anc-1"],
          emphasis: "definition",
          coverage: "full",
          quote: "Gradient descent steps against the gradient.",
        },
        {
          source_version_id: "srcv-b",
          title: "ML Lecture Notes",
          anchor_refs: ["anc-2"],
          emphasis: "intuition",
          coverage: "partial",
          quote: "It follows the steepest downhill direction.",
        },
      ],
      reconciliation: {
        corroborated: true,
        corroborating_source_ids: ["srcv-a", "srcv-b"],
        complements: [
          { aspect: "definition", from_source: "srcv-a" },
          { aspect: "intuition", from_source: "srcv-b" },
        ],
        contradictions: [],
      },
      confidence: 0.75,
    },
  ],
  gaps: [{ concept_ref: "backpropagation", reason: "no attached source covers this concept" }],
};

describe("FusedViewPanel (CSE-015 — one understanding from many sources)", () => {
  test("renders corroboration, both sources' treatments (provenance named), and confidence", () => {
    const html = renderToStaticMarkup(<FusedViewPanel fusion={fusion} />);
    expect(html).toContain("gradient-descent");
    expect(html).toContain("corroborated");
    // Every source is named — fusion never blurs provenance (CSE-015 §2).
    expect(html).toContain("Optimization Textbook");
    expect(html).toContain("ML Lecture Notes");
    expect(html).toContain("75%");
    // Each source's distinct emphasis is composed.
    expect(html).toContain("definition");
    expect(html).toContain("intuition");
  });

  test("names honest coverage gaps — a concept no source covers, never a blank", () => {
    const html = renderToStaticMarkup(<FusedViewPanel fusion={fusion} />);
    expect(html).toContain("Not covered by any source");
    expect(html).toContain("backpropagation");
  });

  test("M9 T2 — surfaces each source's claims and a typed cross-source contradiction", () => {
    const withClaims: FusionView = {
      ...fusion,
      concepts: [
        {
          ...fusion.concepts[0]!,
          claims: [
            {
              claim_id: "srcv-a::clm-1",
              statement: "Gradient descent always converges to the global minimum.",
              source_version_id: "srcv-a",
              epistemic_status: "supported",
              anchor_refs: ["anc-1"],
            },
            {
              claim_id: "srcv-b::clm-1",
              statement: "Gradient descent can stall at a local minimum.",
              source_version_id: "srcv-b",
              epistemic_status: "contested",
              anchor_refs: ["anc-2"],
            },
          ],
          reconciliation: {
            ...fusion.concepts[0]!.reconciliation,
            contradictions: [
              {
                claim_ids: ["srcv-a::clm-1", "srcv-b::clm-1"],
                source_version_ids: ["srcv-a", "srcv-b"],
                nature: "interpretive",
                rationale: "one asserts global convergence, the other local stalls",
              },
            ],
          },
        },
      ],
      gaps: [],
    };
    const html = renderToStaticMarkup(<FusedViewPanel fusion={withClaims} />);
    // Both sources' claims render, each attributed to its source (provenance).
    expect(html).toContain("What each source claims");
    expect(html).toContain("always converges to the global minimum");
    expect(html).toContain("can stall at a local minimum");
    // The disagreement is shown, typed by nature — never presented as factual without cause.
    expect(html).toContain("Where the sources disagree");
    expect(html).toContain("interpretive");
    expect(html).toContain("one asserts global convergence");
  });

  test("M9 T3 — renders the fused explanation as the concept headline, citing sources", () => {
    const withSynthesis: FusionView = {
      ...fusion,
      concepts: [
        {
          ...fusion.concepts[0]!,
          synthesis: {
            prose:
              "Gradient descent minimizes loss by stepping against the gradient [Optimization Textbook]; intuitively it rolls downhill [ML Lecture Notes].",
            cited_source_ids: ["srcv-a", "srcv-b"],
            acknowledges_disagreement: false,
            degraded: false,
          },
        },
      ],
      gaps: [],
    };
    const html = renderToStaticMarkup(<FusedViewPanel fusion={withSynthesis} />);
    expect(html).toContain("stepping against the gradient");
    expect(html).toContain("woven from 2 sources");
  });

  test("a single-source concept is not shown as corroborated", () => {
    const single: FusionView = {
      ...fusion,
      concepts: [
        {
          ...fusion.concepts[0]!,
          source_treatments: [fusion.concepts[0]!.source_treatments[0]!],
          reconciliation: { ...fusion.concepts[0]!.reconciliation, corroborated: false },
        },
      ],
      gaps: [],
    };
    const html = renderToStaticMarkup(<FusedViewPanel fusion={single} />);
    expect(html).not.toContain("corroborated");
  });
});
