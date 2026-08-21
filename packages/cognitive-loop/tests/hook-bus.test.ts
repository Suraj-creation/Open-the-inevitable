/**
 * HookBus (spec 11 §5) — the live runtime-event channel — and its first real consumer: the
 * ModelRuntimeFaculty routes the model call through `pre-model-request` (observe/transform) and
 * `post-model-request` (observe). This is the interception seam that later carries policy, recording,
 * and cancellation, without the cognitive core importing any of them. All deterministic (fake model).
 */
import { describe, expect, it } from "vitest";
import type {
  ModelGenerationRequest,
  ModelGenerationResult,
  ModelRuntime,
} from "@inevitable/contracts";
import {
  ContextCompiler,
  HOOKS,
  HookBus,
  ModelRuntimeFaculty,
  constitutionFromManifest,
  seedPolicy,
  type CompiledContext,
} from "../src/index";

class CapturingModel implements ModelRuntime {
  public lastRequest: ModelGenerationRequest | null = null;
  constructor(private readonly text: string) {}
  generate(input: ModelGenerationRequest): Promise<ModelGenerationResult> {
    this.lastRequest = input;
    return Promise.resolve({ text: this.text, model: "fake-1", finishReason: "stop" });
  }
  embed(): Promise<number[]> {
    return Promise.resolve([]);
  }
}

const OUTPUT = JSON.stringify({
  summary: "s",
  confidence: 0.8,
  sections: [{ role: "insight", title: "T", text: "body" }],
});

function compiled(): CompiledContext {
  const constitution = constitutionFromManifest({ id: "agent.explanation", role: "Explains." });
  const policy = seedPolicy("agent.explanation", "cog-l", constitution.constitution_id);
  return new ContextCompiler().compile({
    constitution,
    policy,
    learner: { learner_cid: "cog-l", known_concepts: [], level: 0.3 },
    task: { task_id: "t-1", concept_id: "c", concept_title: "C", intent: "learn" },
  });
}

describe("HookBus — live interception channel", () => {
  it("runs handlers as a waterfall, transforming the payload", async () => {
    const bus = new HookBus();
    bus.on<number>("x", (n) => n + 1);
    bus.on<number>("x", (n) => n * 10);
    expect(await bus.run("x", 1)).toBe(20);
  });

  it("observe-only handlers (returning void) leave the payload unchanged", async () => {
    const bus = new HookBus();
    const seen: number[] = [];
    bus.on<number>("x", (n) => {
      seen.push(n);
    });
    expect(await bus.run("x", 5)).toBe(5);
    expect(seen).toEqual([5]);
  });

  it("unsubscribe removes a handler", async () => {
    const bus = new HookBus();
    const off = bus.on<number>("x", (n) => n + 100);
    off();
    expect(await bus.run("x", 1)).toBe(1);
  });
});

describe("ModelRuntimeFaculty — routed through the HookBus", () => {
  it("a pre-model-request handler transforms the request the model receives", async () => {
    const model = new CapturingModel(OUTPUT);
    const bus = new HookBus();
    bus.on<ModelGenerationRequest>(HOOKS.preModelRequest, (req) => ({
      ...req,
      system: `${req.system ?? ""}\nINTERCEPTED`,
    }));
    await new ModelRuntimeFaculty(model, bus).execute(compiled());
    expect(model.lastRequest?.system).toContain("INTERCEPTED");
  });

  it("a post-model-request handler observes the request and result (the recording seam)", async () => {
    const model = new CapturingModel(OUTPUT);
    const bus = new HookBus();
    const observed: Array<{ model: string; finishReason: string | undefined }> = [];
    bus.on<{ request: ModelGenerationRequest; result: ModelGenerationResult }>(
      HOOKS.postModelRequest,
      ({ result }) => {
        observed.push({ model: result.model, finishReason: result.finishReason });
      },
    );
    await new ModelRuntimeFaculty(model, bus).execute(compiled());
    expect(observed).toEqual([{ model: "fake-1", finishReason: "stop" }]);
  });

  it("behaves identically with no HookBus (backward compatible)", async () => {
    const output = await new ModelRuntimeFaculty(new CapturingModel(OUTPUT)).execute(compiled());
    expect(output.sections?.[0]?.role).toBe("insight");
  });
});
