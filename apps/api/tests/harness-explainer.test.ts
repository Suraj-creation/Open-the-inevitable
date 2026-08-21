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
import { InMemoryPolicyStore, type ExplanationStrategy } from "@inevitable/cognitive-loop";
import { HarnessExplainer } from "../src/harness-explainer";

const OK_OUTPUT = JSON.stringify({
  summary: "s",
  confidence: 0.8,
  sections: [{ role: "insight", title: "T", text: "body" }],
});

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

  it("emits a reconstructable ContextManifest (the reconstruction law, spec 11 §6)", async () => {
    const explanation = await new HarnessExplainer(new FakeModel(OK_OUTPUT)).explain({
      learnerCid: "cog-l",
      concept: "photosynthesis",
      conceptTitle: "Photosynthesis",
      mode: "student",
    });
    const m = explanation.manifest;
    expect(m.agent_id).toBe("agent.explanation");
    expect(m.constitution_version).toBe(1);
    expect(m.policy_version).toBe(1);
    expect(m.strategy).toBe("concrete-first");
    expect(m.goal_refs).toEqual(["photosynthesis"]);
    expect(m.capability_manifest).toContain("faculty");
    expect(m.system_sections.length).toBeGreaterThan(0);
    // "Why did the model see this?" — the policy Cognitive Object is captured in the manifest.
    expect(m.cognitive_object_refs).toContain(m.policy_ref);
  });
});

describe("HarnessExplainer — closed governed loop (accumulates per learner)", () => {
  it("adapts the teaching strategy across explain→feedback cycles and converges to the best", async () => {
    // The model output is fixed — the STRATEGY is chosen by the compiler from the policy, not the model.
    const loop = new HarnessExplainer(new FakeModel(OK_OUTPUT), {
      policies: new InMemoryPolicyStore(),
      lastStrategy: new Map<string, ExplanationStrategy>(),
    });
    const L = "cog-l";
    const ask = async (): Promise<string> =>
      (await loop.explain({ learnerCid: L, concept: "c", conceptTitle: "C" })).strategy;

    const s1 = await ask();
    loop.recordOutcome({ learnerCid: L, score: 0.2 }); // concrete-first taught poorly
    const s2 = await ask();
    loop.recordOutcome({ learnerCid: L, score: 0.2 }); // abstract-first taught poorly
    const s3 = await ask();
    loop.recordOutcome({ learnerCid: L, score: 0.9 }); // visual-first taught well
    const s4 = await ask();

    // Seed weights (=1) keep untried strategies preferred, so the loop explores all three, then the
    // governed policy converges on the one that taught well.
    expect([s1, s2, s3]).toEqual(["concrete-first", "abstract-first", "visual-first"]);
    expect(s4).toBe("visual-first");
    // Accumulation is real + observable: the Adaptive Policy version advanced past the seed.
    const version = (await loop.explain({ learnerCid: L, concept: "c", conceptTitle: "C" }))
      .policyVersion;
    expect(version).toBeGreaterThan(1);
  });

  it("keeps each learner's adaptation isolated (one learner never affects another)", async () => {
    const loop = new HarnessExplainer(new FakeModel(OK_OUTPUT), {
      policies: new InMemoryPolicyStore(),
      lastStrategy: new Map<string, ExplanationStrategy>(),
    });
    await loop.explain({ learnerCid: "cog-a", concept: "c", conceptTitle: "C" });
    loop.recordOutcome({ learnerCid: "cog-a", score: 0.1 });
    const bStrategy = (await loop.explain({ learnerCid: "cog-b", concept: "c", conceptTitle: "C" }))
      .strategy;
    expect(bStrategy).toBe("concrete-first"); // learner B starts fresh (seed), unaffected by A
  });

  it("feedback with no prior explanation is a visible no-op, not an error", () => {
    const loop = new HarnessExplainer(new FakeModel("{}"), {
      policies: new InMemoryPolicyStore(),
      lastStrategy: new Map<string, ExplanationStrategy>(),
    });
    const outcome = loop.recordOutcome({ learnerCid: "cog-x", score: 0.9 });
    expect(outcome.accepted).toBe(false);
    expect(outcome.strategy).toBeNull();
  });
});

class CapturingModel implements ModelRuntime {
  public lastSystem = "";
  generate(input: ModelGenerationRequest): Promise<ModelGenerationResult> {
    this.lastSystem = input.system ?? "";
    return Promise.resolve({ text: OK_OUTPUT, model: "fake-1", finishReason: "stop" });
  }
  embed(): Promise<number[]> {
    return Promise.resolve([]);
  }
}

describe("HarnessExplainer — F13 mode-aware cognition", () => {
  it("compiles a different teaching stance per product mode", async () => {
    const student = new CapturingModel();
    await new HarnessExplainer(student).explain({
      learnerCid: "cog-l",
      concept: "c",
      conceptTitle: "C",
      mode: "student",
    });
    const educator = new CapturingModel();
    await new HarnessExplainer(educator).explain({
      learnerCid: "cog-l",
      concept: "c",
      conceptTitle: "C",
      mode: "educator",
    });

    expect(student.lastSystem).toContain("genuinely understands");
    expect(educator.lastSystem).toContain("how to teach");
    expect(student.lastSystem).not.toEqual(educator.lastSystem);
  });

  it("defaults to student mode when unspecified", async () => {
    const model = new CapturingModel();
    await new HarnessExplainer(model).explain({
      learnerCid: "cog-l",
      concept: "c",
      conceptTitle: "C",
    });
    expect(model.lastSystem).toContain("genuinely understands");
  });
});
