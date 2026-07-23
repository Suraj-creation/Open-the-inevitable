/**
 * CSE M9 LKS T1 — the grounded proactive frontier block (ADR-0045). When verified mastery surfaces
 * a web-grounded frontier, the research block renders its cited entries (not the legacy ungrounded
 * frontier/gap/hypothesis breadcrumb). Tested through the block renderer registry, no network.
 */
import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { renderBlockBody } from "../src/blocks";
import type { CognitionBlock } from "@inevitable/surface/client";

function researchBlock(content: Record<string, unknown>): CognitionBlock {
  return {
    block_id: "blk-research-1",
    surface_id: "srf-1",
    block_type: "research",
    title: "Frontier — Gradient Descent",
    content,
    concept_ids: ["gradient-descent"],
    provenance: { agent_id: "frontier", agent_cid: "agent.frontier", reason: "test" },
    version: 1,
  } as unknown as CognitionBlock;
}

describe("ResearchBody — grounded proactive frontier (ADR-0045)", () => {
  test("renders cited grounded entries with external links", () => {
    const html = renderToStaticMarkup(
      renderBlockBody(
        researchBlock({
          grounded: true,
          entries: [
            {
              kind: "latest-research",
              summary: "Adaptive step-size methods are an active direction.",
              external_refs: [{ uri: "https://arxiv.org/abs/2401.1", title: "A 2024 Survey" }],
            },
          ],
        }),
      ),
    );
    expect(html).toContain("Latest research");
    expect(html).toContain("Adaptive step-size methods");
    expect(html).toContain('href="https://arxiv.org/abs/2401.1"');
    expect(html).toContain("the living edge, grounded in real sources");
  });

  test("still renders the legacy ungrounded breadcrumb when not grounded", () => {
    const html = renderToStaticMarkup(
      renderBlockBody(
        researchBlock({
          frontier: "Open problem X",
          gap: "No known algorithm",
          source_note: "Based on recent literature",
        }),
      ),
    );
    expect(html).toContain("Open problem X");
    expect(html).toContain("Based on recent literature");
  });
});
