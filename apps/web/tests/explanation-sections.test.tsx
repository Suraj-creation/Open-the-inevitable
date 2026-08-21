/**
 * Structured Semantic Explanation render (surface slice): the explanation block renders its typed,
 * role-tagged sections with `data-epistemic-role` so the CDL styles each token-driven (never raw CSS
 * from the agent), and falls back to the legacy layers prose for blocks that predate structuring.
 */
import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { renderBlockBody } from "../src/blocks";
import type { CognitionBlock } from "@inevitable/surface/client";

function explanationBlock(content: Record<string, unknown>): CognitionBlock {
  return {
    block_id: "blk-explain-1",
    surface_id: "srf-1",
    block_type: "explanation",
    title: "Photosynthesis",
    content,
    concept_ids: ["photosynthesis"],
    provenance: { agent_id: "explanation", agent_cid: "agent.explanation", reason: "test" },
    version: 1,
  } as unknown as CognitionBlock;
}

describe("ProseBody — Structured Semantic Explanation sections (token-driven, role-tagged)", () => {
  test("renders sections with data-epistemic-role (styled token-driven by the CDL)", () => {
    const html = renderToStaticMarkup(
      renderBlockBody(
        explanationBlock({
          summary: "How plants make food.",
          sections: [
            {
              key: "layer_0",
              role: "insight",
              title: "Intuition & story",
              text: "Think of a solar panel.",
              order: 0,
            },
            {
              key: "layer_2",
              role: "definition",
              title: "Definition",
              text: "Photosynthesis converts light into chemical energy.",
              order: 1,
            },
          ],
        }),
      ),
    );
    expect(html).toContain('data-epistemic-role="insight"');
    expect(html).toContain('data-epistemic-role="definition"');
    expect(html).toContain("Think of a solar panel.");
    expect(html).toContain("Definition");
    // The role label is present so colour is never the sole carrier of meaning (accessibility).
    expect(html).toContain("Intuition");
    expect(html).toContain("How plants make food.");
    // No raw colour comes from the renderer — styling is token-driven via data-epistemic-role.
    expect(html).not.toContain("background-color");
  });

  test("falls back to legacy layers prose when a block has no sections (back-compat)", () => {
    const html = renderToStaticMarkup(
      renderBlockBody(explanationBlock({ layers: { layer_0: "Legacy intuition text." } })),
    );
    expect(html).toContain("Legacy intuition text.");
    expect(html).not.toContain("data-epistemic-role");
  });
});
