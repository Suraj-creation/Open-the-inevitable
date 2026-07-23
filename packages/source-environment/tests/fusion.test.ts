/**
 * CSE M9 T1 — Source Fusion + the Claim primitive (CSE-015, CSE-006, ADR-0040).
 *
 * Covers deterministic reconciliation (coverage, corroboration ≥2 sources, complements, bounded
 * confidence), honest gap detection, and the contradiction detector that NEVER fabricates —
 * returning [] absent claim data, and honoring cross-source `contradicts` edges when present.
 */
import { describe, expect, it } from "vitest";
import {
  detectContradictions,
  detectGaps,
  reconcileConcept,
  type Claim,
  type SourceTreatment,
} from "../src/fusion";

function treatment(overrides: Partial<SourceTreatment> = {}): SourceTreatment {
  return {
    source_version_id: "srcv-a",
    title: "Source A",
    anchor_refs: ["anc-1"],
    emphasis: "definition",
    coverage: "full",
    quote: "Gradient descent steps against the gradient.",
    ...overrides,
  };
}

describe("reconcileConcept (deterministic reconciliation, CSE-015 §3)", () => {
  it("corroborates when ≥2 sources cover the concept; composes their distinct emphases", () => {
    const fused = reconcileConcept("gradient-descent", [
      treatment({ source_version_id: "srcv-a", emphasis: "definition" }),
      treatment({ source_version_id: "srcv-b", emphasis: "intuition", title: "Source B" }),
    ]);
    expect(fused.reconciliation.corroborated).toBe(true);
    expect(fused.reconciliation.corroborating_source_ids).toEqual(["srcv-a", "srcv-b"]);
    expect(fused.reconciliation.complements.map((c) => c.aspect)).toEqual([
      "definition",
      "intuition",
    ]);
    expect(fused.confidence).toBeGreaterThan(0.6);
    // Provenance is never blurred — every treatment stays on the fused concept.
    expect(fused.source_treatments).toHaveLength(2);
  });

  it("a single covering source is not corroborated; absent-only coverage ⇒ 0 confidence", () => {
    const single = reconcileConcept("entropy", [treatment()]);
    expect(single.reconciliation.corroborated).toBe(false);
    expect(single.confidence).toBeGreaterThan(0);
    const none = reconcileConcept("entropy", [treatment({ coverage: "absent", anchor_refs: [] })]);
    expect(none.confidence).toBe(0);
    expect(none.reconciliation.corroborated).toBe(false);
  });

  it("is deterministic: same treatments ⇒ byte-identical FusedConcept", () => {
    const ts = [treatment(), treatment({ source_version_id: "srcv-b" })];
    expect(reconcileConcept("c", ts)).toEqual(reconcileConcept("c", ts));
  });

  it("never fabricates a contradiction — T1 passes none, so reconciliation carries []", () => {
    const fused = reconcileConcept("c", [treatment(), treatment({ source_version_id: "srcv-b" })]);
    expect(fused.reconciliation.contradictions).toEqual([]);
  });
});

describe("detectGaps (honest coverage gaps, CSE-015 §3.3)", () => {
  it("names target concepts no fused source covers, and only those", () => {
    const covered = reconcileConcept("gradient-descent", [treatment()]);
    const uncovered = reconcileConcept("backprop", [
      treatment({ coverage: "absent", anchor_refs: [] }),
    ]);
    const gaps = detectGaps(["gradient-descent", "backprop", "convexity"], [covered, uncovered]);
    expect(gaps.map((g) => g.concept_ref).sort()).toEqual(["backprop", "convexity"]);
    expect(gaps[0]?.suggested_action.length).toBeGreaterThan(0);
  });
});

describe("detectContradictions (honest — never fabricated, CSE-006 §2/§6)", () => {
  it("returns [] when there is no claim data", () => {
    expect(detectContradictions([])).toEqual([]);
  });

  it("returns [] when claims agree or come from the same source", () => {
    const claims: Claim[] = [
      {
        claim_id: "clm-1",
        statement: "A",
        anchors: ["anc-1"],
        about_concepts: ["a"],
        source_version_id: "srcv-a",
        epistemic_status: "supported",
        edges: [{ type: "contradicts", target_claim: "clm-2", evidence_anchors: [] }],
      },
      {
        claim_id: "clm-2",
        statement: "not A",
        anchors: ["anc-2"],
        about_concepts: ["a"],
        source_version_id: "srcv-a", // SAME source — not a cross-source contradiction
        epistemic_status: "supported",
        edges: [],
      },
    ];
    expect(detectContradictions(claims)).toEqual([]);
  });

  it("surfaces a cross-source contradiction from a `contradicts` edge, labeled interpretive", () => {
    const claims: Claim[] = [
      {
        claim_id: "clm-1",
        statement: "A",
        anchors: ["anc-1"],
        about_concepts: ["a"],
        source_version_id: "srcv-a",
        epistemic_status: "contested",
        edges: [{ type: "contradicts", target_claim: "clm-2", evidence_anchors: [] }],
      },
      {
        claim_id: "clm-2",
        statement: "not A",
        anchors: ["anc-2"],
        about_concepts: ["a"],
        source_version_id: "srcv-b",
        epistemic_status: "contested",
        edges: [],
      },
    ];
    const found = detectContradictions(claims);
    expect(found).toHaveLength(1);
    expect(found[0]?.source_version_ids).toEqual(["srcv-a", "srcv-b"]);
    expect(found[0]?.nature).toBe("interpretive"); // never presented as empirical/factual in T1
  });
});
