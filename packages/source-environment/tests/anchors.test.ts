import { describe, expect, it } from "vitest";
import {
  createAnchor,
  resolveAnchor,
  type SourceAnchor,
  type StructuralLayerContent,
} from "../src/index";
import type { AnchorId, SourceVersionId } from "../src/ids";

const STRUCTURAL: StructuralLayerContent = {
  regions: [
    {
      path: "h1-1",
      ordinal: 0,
      kind: "heading",
      text: "Gradient Descent",
      char_start: 0,
      char_end: 18,
      confidence: 1,
    },
    {
      path: "h1-1/para-1",
      ordinal: 1,
      kind: "paragraph",
      text: "The learning rate controls the step size taken at each iteration.",
      char_start: 20,
      char_end: 86,
      confidence: 1,
    },
    {
      path: "h1-1/para-2",
      ordinal: 2,
      kind: "paragraph",
      text: "A large learning rate can cause divergence when curvature is high.",
      char_start: 88,
      char_end: 155,
      confidence: 1,
    },
  ],
};

function anchor(selectors: SourceAnchor["selectors"]): SourceAnchor {
  return {
    anchor_id: "anc-test" as AnchorId,
    source_version_id: "srcv-test" as SourceVersionId,
    selectors,
    granularity: "paragraph",
    concept_refs: [],
    created_by: "cog-test",
  };
}

describe("Source Anchor creation law (CSE-002 §5.2)", () => {
  it("requires at least two selectors of distinct types", () => {
    const one = createAnchor({
      anchor_id: "anc-1" as AnchorId,
      source_version_id: "srcv-1" as SourceVersionId,
      selectors: [{ type: "structural", path: "h1-1/para-1" }],
      granularity: "paragraph",
      created_by: "cog-test",
    });
    expect(one.ok).toBe(false);
    if (!one.ok) expect(one.error.code).toBe("E_SOURCE_ANCHOR_SELECTORS");

    const sameType = createAnchor({
      anchor_id: "anc-2" as AnchorId,
      source_version_id: "srcv-1" as SourceVersionId,
      selectors: [
        { type: "structural", path: "a" },
        { type: "structural", path: "b" },
      ],
      granularity: "paragraph",
      created_by: "cog-test",
    });
    expect(sameType.ok).toBe(false);
  });
});

describe("pure anchor resolution (CSE-002 §5.3)", () => {
  it("resolves via the structural selector and reports resolved_by", () => {
    const a = anchor([
      { type: "structural", path: "h1-1/para-1" },
      { type: "text-quote", exact: "learning rate controls" },
    ]);
    const r = resolveAnchor(a, STRUCTURAL);
    expect(r.status).toBe("resolved");
    if (r.status !== "resolved") return;
    expect(r.region.path).toBe("h1-1/para-1");
    expect(r.resolved_by).toBe("structural");
  });

  it("falls back to text-quote when the structural path is gone", () => {
    const a = anchor([
      { type: "structural", path: "h9-9/para-9" },
      { type: "text-quote", exact: "divergence when curvature is high" },
    ]);
    const r = resolveAnchor(a, STRUCTURAL);
    expect(r.status).toBe("resolved");
    if (r.status !== "resolved") return;
    expect(r.region.path).toBe("h1-1/para-2");
    expect(r.resolved_by).toBe("text-quote");
  });

  it("refuses to guess on ambiguous quotes without a disambiguator", () => {
    const a = anchor([
      { type: "structural", path: "h9-9/para-9" },
      { type: "text-quote", exact: "learning rate" }, // appears in two paragraphs
    ]);
    const r = resolveAnchor(a, STRUCTURAL);
    expect(r.status).toBe("miss");
  });

  it("disambiguates quotes via prefix", () => {
    const a = anchor([
      { type: "structural", path: "h9-9/para-9" },
      { type: "text-quote", exact: "learning rate", prefix: "A large " },
    ]);
    const r = resolveAnchor(a, STRUCTURAL);
    expect(r.status).toBe("resolved");
    if (r.status !== "resolved") return;
    expect(r.region.path).toBe("h1-1/para-2");
  });

  it("flags selector disagreement as unstable — never silently picks", () => {
    const a = anchor([
      { type: "structural", path: "h1-1/para-1" },
      { type: "text-quote", exact: "divergence when curvature is high" }, // para-2
    ]);
    const r = resolveAnchor(a, STRUCTURAL);
    expect(r.status).toBe("unstable");
    if (r.status !== "unstable") return;
    expect(r.candidates.length).toBe(2);
  });

  it("is a pure function: identical inputs yield identical results", () => {
    const a = anchor([
      { type: "structural", path: "h1-1/para-2" },
      { type: "text-quote", exact: "divergence when curvature is high" },
    ]);
    expect(resolveAnchor(a, STRUCTURAL)).toEqual(resolveAnchor(a, STRUCTURAL));
  });
});
