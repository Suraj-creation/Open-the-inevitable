/**
 * ModelRuntimeFaculty — the real model faculty inside the harness (spec 11): it drives the Context
 * Compiler's model_request through an injected ModelRuntime and returns typed, role-tagged sections.
 * Proven deterministically with a fake ModelRuntime — no live model call. This is the "model as a
 * replaceable faculty" seam made real, and the prerequisite for wiring the harness to the gateway.
 */
import { CosError } from "@inevitable/shared";
import type {
  ModelGenerationRequest,
  ModelGenerationResult,
  ModelRuntime,
} from "@inevitable/contracts";
import { describe, expect, it } from "vitest";
import {
  ContextCompiler,
  ModelRuntimeFaculty,
  constitutionFromManifest,
  parseModelFacultyOutput,
  seedPolicy,
  type CompiledContext,
  type LearnerState,
} from "../src/index";

class FakeModel implements ModelRuntime {
  public lastRequest: ModelGenerationRequest | null = null;
  constructor(
    private readonly text: string,
    private readonly finishReason: ModelGenerationResult["finishReason"] = "stop",
  ) {}
  generate(input: ModelGenerationRequest): Promise<ModelGenerationResult> {
    this.lastRequest = input;
    return Promise.resolve({ text: this.text, model: "fake-1", finishReason: this.finishReason });
  }
  embed(): Promise<number[]> {
    return Promise.resolve([]);
  }
}

function compiledFor(): CompiledContext {
  const constitution = constitutionFromManifest({
    id: "agent.explanation",
    role: "Explains concepts.",
  });
  const learner: LearnerState = { learner_cid: "cog-l", known_concepts: [], level: 0.3 };
  const policy = seedPolicy("agent.explanation", "cog-l", constitution.constitution_id);
  return new ContextCompiler().compile({
    constitution,
    policy,
    learner,
    task: {
      task_id: "t-1",
      concept_id: "photosynthesis",
      concept_title: "Photosynthesis",
      intent: "learn",
    },
  });
}

describe("ModelRuntimeFaculty — real model faculty inside the harness (11)", () => {
  it("drives compiled.model_request and returns typed, role-tagged sections", async () => {
    const model = new FakeModel(
      JSON.stringify({
        summary: "Plants turn light into food.",
        confidence: 0.9,
        sections: [
          { role: "insight", title: "Intuition", text: "Think of a solar panel." },
          {
            role: "definition",
            title: "Definition",
            text: "Photosynthesis converts light energy.",
          },
        ],
      }),
    );
    const output = await new ModelRuntimeFaculty(model).execute(compiledFor());

    expect(output.strategy).toBe("concrete-first");
    expect(output.confidence).toBe(0.9);
    expect(output.sections?.map((s) => s.role)).toEqual(["insight", "definition"]);
    expect(output.content).toContain("Plants turn light");
    // It actually drove the compiled model request (a real seam, not a stub).
    expect(model.lastRequest?.invocation_key).toBe("agent.explanation:t-1:explanation");
  });

  it("the compiled request carries the structured-output contract", () => {
    const compiled = compiledFor();
    expect(compiled.model_request.responseSchema).toBeDefined();
    expect(compiled.system).toContain("Respond with JSON only");
    expect(compiled.system).toContain('"sections"');
  });

  it("throws a typed error on a refusal (degradation stays visible)", async () => {
    const faculty = new ModelRuntimeFaculty(new FakeModel("{}", "refusal"));
    await expect(faculty.execute(compiledFor())).rejects.toBeInstanceOf(CosError);
  });

  it("parseModelFacultyOutput tolerates fences and rejects malformed / empty output", () => {
    const parsed = parseModelFacultyOutput(
      '```json\n{"sections":[{"role":"insight","text":"x"}]}\n```',
    );
    expect(parsed.sections).toHaveLength(1);
    expect(parsed.sections[0]?.role).toBe("insight");
    expect(() => parseModelFacultyOutput("not json")).toThrow(CosError);
    expect(() => parseModelFacultyOutput('{"sections":[]}')).toThrow(CosError);
  });
});
