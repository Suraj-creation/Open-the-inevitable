/**
 * HarnessExplainer — the harness→surface integration boundary (spec 11): the Cognitive Harness's
 * Context Compiler + ModelRuntimeFaculty produce a structured, role-tagged explanation mapped to
 * durable SemanticSections. Proven deterministically with a fake ModelRuntime (no live model call).
 */
import { describe, expect, it } from "vitest";
import type {
  ModelGenerationRequest,
  ModelGenerationResult,
  ModelRuntime,
} from "@inevitable/contracts";
import { HarnessExplainer } from "../src/harness-explainer";

class FakeModel implements ModelRuntime {
  constructor(private readonly text: string) {}
  generate(_input: ModelGenerationRequest): Promise<ModelGenerationResult> {
    return Promise.resolve({ text: this.text, model: "fake-1", finishReason: "stop" });
  }
  embed(): Promise<number[]> {
    return Promise.resolve([]);
  }
}

describe("HarnessExplainer — opt-in live harness→surface wiring", () => {
  it("produces a structured, role-tagged explanation from a real model faculty", async () => {
    const model = new FakeModel(
      JSON.stringify({
        summary: "Plants make food from light.",
        confidence: 0.85,
        sections: [
          { role: "intuition", title: "Intuition", text: "Think of a solar panel." },
          { role: "definition", title: "Definition", text: "Photosynthesis converts light." },
        ],
      }),
    );
    const explanation = await new HarnessExplainer(model).explain({
      learnerCid: "cog-l",
      concept: "photosynthesis",
      conceptTitle: "Photosynthesis",
    });

    expect(explanation.strategy).toBe("concrete-first");
    expect(explanation.summary).toContain("Plants make food");
    // "intuition" is coerced to the canonical EpistemicRole "insight" at the boundary.
    expect(explanation.sections.map((s) => s.role)).toEqual(["insight", "definition"]);
    expect(explanation.sections[0]?.key).toBe("section-0");
    expect(explanation.sections[0]?.text).toContain("solar panel");
  });
});
