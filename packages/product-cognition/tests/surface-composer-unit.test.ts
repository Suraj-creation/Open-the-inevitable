/**
 * SurfaceComposerUnit — teaching content → MCCR + separate narration script + image decision
 * (UCS, ADR-0030). Deterministic: stub models only.
 */
import { describe, expect, test } from "vitest";
import type { ModelRuntime } from "@inevitable/contracts";
import type { CognitionPacket } from "@inevitable/protocols";
import { SeededIdGenerator } from "@inevitable/shared";
import { MVP_AGENT_MANIFESTS } from "../src/agent-catalog";
import {
  SurfaceComposerUnit,
  deterministicComposition,
  parseComposerOutput,
  type ComposerElement,
} from "../src/surface-composer-unit";

const composerManifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.composer")!;

function stubModel(text: string, finishReason?: "stop" | "refusal" | "max_tokens"): ModelRuntime {
  return {
    async generate() {
      return { text, model: "stub-model", finishReason: finishReason ?? ("stop" as const) };
    },
    async embed() {
      return [];
    },
  };
}

const GOOD_COMPOSITION = JSON.stringify({
  mccr: {
    core_concept: "Fourier transform",
    definition: "Decomposes a signal into the frequencies that compose it.",
    key_formula: {
      latex: "X(f)=\\int x(t)e^{-2\\pi i f t}dt",
      plain: "X of f equals the integral...",
    },
    diagram: {
      kind: "node-graph",
      nodes: [
        { id: "t", label: "time domain" },
        { id: "f", label: "frequency domain" },
      ],
      edges: [{ from: "t", to: "f", relation: "transforms to" }],
    },
    mental_model: "A prism splitting white light into colors.",
  },
  narration_script: {
    segments: [
      {
        text: "Imagine white light through a prism.",
        anchor_ref: "mental_model",
        intent: "introduce",
        pause_after: false,
      },
      {
        text: "The transform does that for any signal.",
        anchor_ref: "core_concept",
        intent: "build",
        pause_after: false,
      },
      {
        text: "Here's the integral that makes it precise.",
        anchor_ref: "key_formula",
        intent: "connect",
        pause_after: true,
      },
    ],
  },
  image_plan: {
    helps: true,
    prompt: "a prism splitting a waveform into sine components",
    rationale: "makes the decomposition concrete",
  },
});

function packet(content: Record<string, unknown>): CognitionPacket {
  return {
    packet_id: "cp-000000000000000000000001",
    schema_version: "1.0.0",
    source_cid: "cog-learner",
    target_cid: "cog-composer",
    tenant_id: null,
    session_id: "intent-001",
    causation_id: "intent-001",
    correlation_id: "cp-000000000000000000000002",
    timestamp: "2026-06-12T00:00:00.000Z",
    hlc: "00000000000000000000:0:test",
    sequence_number: 0,
    packet_type: "intent",
    intent: "compose",
    concept_ids: ["fourier"],
    domain_ids: [],
    content,
    evidence: [],
    confidence: 1,
    uncertainty_estimate: 0,
    reasoning_depth: 0,
    classification: "internal",
    policy_tags: [],
    requires_human_review: false,
    priority: 5,
    expiry: null,
    trace_id: "00000000000000000000000000000001",
    span_id: "0000000000000001",
  };
}

describe("parseComposerOutput", () => {
  test("builds MCCR elements with deterministic ids, reveal order, and typed content", () => {
    const parsed = parseComposerOutput("```json\n" + GOOD_COMPOSITION + "\n```", "fourier");
    const core = parsed.mccr.core_concept as ComposerElement;
    expect(core.element_id).toBe("el-core_concept");
    expect(core.reveal_order).toBe(0);
    expect(core.content).toEqual({ kind: "text", text: "Fourier transform" });
    expect((parsed.mccr.key_formula as ComposerElement).content).toMatchObject({ kind: "formula" });
    expect((parsed.mccr.diagram as ComposerElement).content).toMatchObject({ kind: "diagram" });
    // narration is SEPARATE and targets MCCR anchors
    expect(parsed.narration_script.segments).toHaveLength(3);
    expect(parsed.narration_script.segments[0]?.anchor_ref).toBe("mental_model");
    expect(parsed.image_plan.helps).toBe(true);
    expect(parsed.image_plan.modality).toBe("image");
  });

  test("R4c: carries key_formula.line_labels for the derivation grammar (ADR-0058)", () => {
    const parsed = parseComposerOutput(
      JSON.stringify({
        mccr: {
          core_concept: "Quadratic formula",
          definition: "The roots of ax²+bx+c.",
          key_formula: {
            latex: "x = ...",
            plain: "x equals",
            lines: ["ax^2+bx+c=0", "x^2 + (b/a)x = -c/a", "x = (-b ± √(b²-4ac))/2a"],
            line_labels: ["start", "divide by a", "complete the square"],
          },
        },
        narration_script: { segments: [{ text: "Derive it.", anchor_ref: "key_formula" }] },
      }),
      "quadratic",
    );
    const formula = parsed.mccr.key_formula as ComposerElement;
    expect(formula.content).toMatchObject({ kind: "formula" });
    expect((formula.content as { line_labels?: string[] }).line_labels).toEqual([
      "start",
      "divide by a",
      "complete the square",
    ]);
  });

  test("R4e: a structured misconception becomes the dissolve grammar (wrong→correction)", () => {
    const parsed = parseComposerOutput(
      JSON.stringify({
        mccr: {
          core_concept: "Entropy",
          definition: "A measure of dispersal of energy.",
          misconception: {
            wrong: "Entropy is disorder, like a messy room.",
            correction: "Entropy counts the microstates consistent with a macrostate.",
          },
        },
        narration_script: {
          segments: [{ text: "Watch the mistake.", anchor_ref: "misconception" }],
        },
      }),
      "entropy",
    );
    const misc = parsed.mccr.misconception as ComposerElement;
    expect(misc.content).toMatchObject({
      kind: "misconception",
      wrong: "Entropy is disorder, like a messy room.",
      correction: "Entropy counts the microstates consistent with a macrostate.",
    });
  });

  test("R4e: a legacy string misconception degrades to plain text (back-compat)", () => {
    const parsed = parseComposerOutput(
      JSON.stringify({
        mccr: {
          core_concept: "Entropy",
          definition: "A measure of dispersal of energy.",
          misconception: "It just means disorder.",
        },
        narration_script: { segments: [{ text: "A caution.", anchor_ref: "misconception" }] },
      }),
      "entropy",
    );
    const misc = parsed.mccr.misconception as ComposerElement;
    expect(misc.content).toMatchObject({ kind: "text", text: "It just means disorder." });
  });

  test("R4e: a one-sided misconception keeps the surviving half as text, no half-dissolve", () => {
    const parsed = parseComposerOutput(
      JSON.stringify({
        mccr: {
          core_concept: "Entropy",
          definition: "A measure of dispersal of energy.",
          misconception: { correction: "It is about microstate counting." },
        },
        narration_script: { segments: [{ text: "A caution.", anchor_ref: "misconception" }] },
      }),
      "entropy",
    );
    const misc = parsed.mccr.misconception as ComposerElement;
    expect(misc.content).toMatchObject({ kind: "text", text: "It is about microstate counting." });
  });

  test("R4e: a process becomes the ordered procedure grammar (steps with details)", () => {
    const parsed = parseComposerOutput(
      JSON.stringify({
        mccr: {
          core_concept: "Long division",
          definition: "An algorithm for dividing integers.",
          process: {
            steps: [
              { text: "Divide the leading digits", detail: "how many times does the divisor fit" },
              { text: "Multiply and subtract" },
              "Bring down the next digit",
            ],
          },
        },
        narration_script: { segments: [{ text: "Follow the steps.", anchor_ref: "process" }] },
      }),
      "long-division",
    );
    const proc = parsed.mccr.process as ComposerElement;
    expect(proc.content).toMatchObject({ kind: "process" });
    const steps = (proc.content as { steps: { text: string; detail: string | null }[] }).steps;
    expect(steps).toHaveLength(3);
    expect(steps[0]).toEqual({
      text: "Divide the leading digits",
      detail: "how many times does the divisor fit",
    });
    // A step given as a bare string is accepted as the step text.
    expect(steps[2]).toEqual({ text: "Bring down the next digit", detail: null });
  });

  test("R4e: an empty process yields no element (nothing to teach)", () => {
    const parsed = parseComposerOutput(
      JSON.stringify({
        mccr: { core_concept: "X", definition: "a def", process: { steps: [] } },
        narration_script: { segments: [{ text: "hi", anchor_ref: "core_concept" }] },
      }),
      "x",
    );
    expect(parsed.mccr.process).toBeUndefined();
  });

  test("R4e: code becomes the code grammar (language + lines, notes only where given)", () => {
    const parsed = parseComposerOutput(
      JSON.stringify({
        mccr: {
          core_concept: "Euclid's algorithm",
          definition: "Computes the GCD of two integers.",
          code: {
            language: "python",
            lines: [
              { text: "def gcd(a, b):", note: "the function" },
              { text: "    while b:", note: "loop until b is 0" },
              { text: "        a, b = b, a % b" },
              "    return a",
            ],
          },
        },
        narration_script: { segments: [{ text: "Read the code.", anchor_ref: "code" }] },
      }),
      "gcd",
    );
    const code = parsed.mccr.code as ComposerElement;
    expect(code.content).toMatchObject({ kind: "code", language: "python" });
    const lines = (code.content as { lines: { text: string; note: string | null }[] }).lines;
    expect(lines).toHaveLength(4);
    expect(lines[0]).toEqual({ text: "def gcd(a, b):", note: "the function" });
    // Indentation is preserved and an unannotated line has a null note.
    expect(lines[2]).toEqual({ text: "        a, b = b, a % b", note: null });
    // A bare string is accepted as the line text.
    expect(lines[3]).toEqual({ text: "    return a", note: null });
  });

  test("R4e: a code block with no real lines yields no element", () => {
    const parsed = parseComposerOutput(
      JSON.stringify({
        mccr: {
          core_concept: "X",
          definition: "a def",
          code: { language: "python", lines: [{ text: "  " }, ""] },
        },
        narration_script: { segments: [{ text: "hi", anchor_ref: "core_concept" }] },
      }),
      "x",
    );
    expect(parsed.mccr.code).toBeUndefined();
  });

  test("nulls a dangling anchor_ref that points at an empty slot", () => {
    const parsed = parseComposerOutput(
      JSON.stringify({
        mccr: { core_concept: "X", definition: "a def" },
        narration_script: {
          segments: [{ text: "About the diagram.", anchor_ref: "diagram", intent: "build" }],
        },
      }),
      "x",
    );
    // diagram slot was never filled → anchor_ref nulled to a whole-frame remark
    expect(parsed.narration_script.segments[0]?.anchor_ref).toBeNull();
  });

  test("rejects output missing a core_concept anchor or a narration script", () => {
    expect(() =>
      parseComposerOutput(
        JSON.stringify({
          mccr: { definition: "d" },
          narration_script: { segments: [{ text: "hi" }] },
        }),
        "x",
      ),
    ).toThrowError(/core_concept/);
    expect(() =>
      parseComposerOutput(
        JSON.stringify({ mccr: { core_concept: "C" }, narration_script: { segments: [] } }),
        "x",
      ),
    ).toThrowError(/narration/);
    expect(() => parseComposerOutput("not json", "x")).toThrowError(/valid JSON/);
  });

  test("image_plan.helps requires a concrete prompt", () => {
    const parsed = parseComposerOutput(
      JSON.stringify({
        mccr: { core_concept: "C", definition: "d" },
        narration_script: { segments: [{ text: "hi" }] },
        image_plan: { helps: true, rationale: "no prompt given" },
      }),
      "x",
    );
    expect(parsed.image_plan.helps).toBe(false);
    expect(parsed.image_plan.modality).toBe("none");
  });

  test("salvages a rich composition missing only core_concept when a fallback title is given", () => {
    const raw = JSON.stringify({
      mccr: { definition: "a crisp definition", mental_model: "a vivid analogy" },
      narration_script: { segments: [{ text: "hi", anchor_ref: "definition" }] },
    });
    // Without a fallback title the parser stays strict (the whole response is discarded).
    expect(() => parseComposerOutput(raw, "fourier")).toThrowError(/core_concept/);
    // With a title, the frame is salvaged: core_concept is synthesized, other anchors survive.
    const salvaged = parseComposerOutput(raw, "fourier", "Fourier transform");
    expect(salvaged.mccr.core_concept?.content).toEqual({
      kind: "text",
      text: "Fourier transform",
    });
    expect(salvaged.mccr.definition).toBeDefined();
    expect(salvaged.mccr.mental_model).toBeDefined();
  });

  test("does not fabricate a frame from an empty mccr even with a title", () => {
    const raw = JSON.stringify({
      mccr: {},
      narration_script: { segments: [{ text: "hi" }] },
    });
    expect(() => parseComposerOutput(raw, "x", "Some Title")).toThrowError(/core_concept/);
  });
});

describe("deterministicComposition", () => {
  test("is deterministic and yields a minimal, honest board with no media", () => {
    const a = deterministicComposition(
      packet({ concept_title: "Eigenvalues", goal: "Linear algebra" }),
    );
    const b = deterministicComposition(
      packet({ concept_title: "Eigenvalues", goal: "Linear algebra" }),
    );
    expect(a).toEqual(b);
    expect(a.mccr.core_concept?.content).toEqual({ kind: "text", text: "Eigenvalues" });
    expect(a.mccr.definition).toBeDefined();
    expect(a.narration_script.segments).toHaveLength(1);
    expect(a.image_plan.helps).toBe(false);
  });
});

/** A stub model that streams `text` in `chunks` pieces; its terminal chunk carries the whole result. */
function streamingStubModel(text: string, chunks = 8): ModelRuntime {
  const pieces: string[] = [];
  const size = Math.ceil(text.length / chunks);
  for (let i = 0; i < text.length; i += size) pieces.push(text.slice(i, i + size));
  return {
    async generate() {
      return { text, model: "stub-model", finishReason: "stop" as const };
    },
    async embed() {
      return [];
    },
    generateStream() {
      return {
        async *[Symbol.asyncIterator]() {
          for (const p of pieces) yield { textDelta: p };
          yield {
            textDelta: "",
            result: { text, model: "stub-model", finishReason: "stop" as const },
          };
        },
      };
    },
  };
}

describe("SurfaceComposerUnit — live streaming (ADR-0063 Phase B)", () => {
  test("reports each MCCR string anchor once, in document order, as the stream completes it", async () => {
    const unit = new SurfaceComposerUnit({
      manifest: composerManifest,
      model: streamingStubModel(GOOD_COMPOSITION),
      idGenerator: new SeededIdGenerator("comp-stream"),
    });
    const reported: Array<{ name: string; text: string }> = [];
    unit.setStreamSink({
      onElementComplete(name, text) {
        reported.push({ name, text });
      },
    });
    const emissions = await unit.execute(
      packet({ concept_title: "Fourier transform", goal: "Signal processing" }),
    );
    // String anchors only (core_concept/definition/mental_model), in order; structured ones skipped.
    expect(reported.map((r) => r.name)).toEqual(["core_concept", "definition", "mental_model"]);
    expect(reported[0]!.text).toBe("Fourier transform");
    expect(reported.some((r) => r.name === "key_formula" || r.name === "diagram")).toBe(false);
    // The final composition is IDENTICAL to the non-streamed path — streaming is a live reveal only.
    const content = emissions.packets?.[0]?.content as Record<string, unknown>;
    expect(content["response_kind"]).toBe("model-composition");
    const mccr = content["mccr"] as Record<string, ComposerElement>;
    expect(mccr["core_concept"]?.content).toEqual({ kind: "text", text: "Fourier transform" });
  });

  test("without a sink, a streaming-capable model still uses the whole-response path (no reports)", async () => {
    const unit = new SurfaceComposerUnit({
      manifest: composerManifest,
      model: streamingStubModel(GOOD_COMPOSITION),
      idGenerator: new SeededIdGenerator("comp-nosink"),
    });
    // no setStreamSink → deterministic whole-response path
    const emissions = await unit.execute(
      packet({ concept_title: "Fourier transform", goal: "Signal processing" }),
    );
    const content = emissions.packets?.[0]?.content as Record<string, unknown>;
    expect(content["response_kind"]).toBe("model-composition");
  });

  test("a sink but a NON-streaming model falls back to the whole-response path (no reports)", async () => {
    const reported: string[] = [];
    const unit = new SurfaceComposerUnit({
      manifest: composerManifest,
      model: stubModel(GOOD_COMPOSITION), // no generateStream
      idGenerator: new SeededIdGenerator("comp-fallback"),
    });
    unit.setStreamSink({
      onElementComplete(name) {
        reported.push(name);
      },
    });
    const emissions = await unit.execute(
      packet({ concept_title: "Fourier transform", goal: "Signal processing" }),
    );
    expect(reported).toEqual([]); // model can't stream ⇒ no deltas
    expect((emissions.packets?.[0]?.content as Record<string, unknown>)["response_kind"]).toBe(
      "model-composition",
    );
  });
});

describe("SurfaceComposerUnit", () => {
  test("valid model output becomes a model-composition response packet", async () => {
    const unit = new SurfaceComposerUnit({
      manifest: composerManifest,
      model: stubModel(GOOD_COMPOSITION),
      idGenerator: new SeededIdGenerator("comp"),
    });
    const emissions = await unit.execute(
      packet({ concept_title: "Fourier transform", goal: "Signal processing" }),
    );
    const content = emissions.packets?.[0]?.content as Record<string, unknown>;
    expect(content["response_kind"]).toBe("model-composition");
    const mccr = content["mccr"] as Record<string, ComposerElement>;
    expect(mccr["core_concept"]?.content).toEqual({ kind: "text", text: "Fourier transform" });
    const script = content["narration_script"] as { segments: unknown[] };
    expect(script.segments).toHaveLength(3);
    expect(emissions.packets?.[0]?.confidence).toBe(0.83);
    expect(emissions.trace?.determinism_level).toBe("D3");
  });

  test("FUSION MODE (R5, ADR-0060): a fused synthesis threads into the composer prompt", async () => {
    let captured: Record<string, unknown> | null = null;
    const model: ModelRuntime = {
      async generate(req) {
        captured = req as unknown as Record<string, unknown>;
        return { text: GOOD_COMPOSITION, model: "stub-model", finishReason: "stop" as const };
      },
      async embed() {
        return [];
      },
    };
    const unit = new SurfaceComposerUnit({
      manifest: composerManifest,
      model,
      idGenerator: new SeededIdGenerator("comp-fusion"),
    });
    await unit.execute(
      packet({
        concept_title: "Entropy",
        goal: "Thermodynamics",
        fused_synthesis: {
          prose: "Callen frames entropy as a state function; Feynman stresses microstate counting.",
          acknowledges_disagreement: true,
          treatments: [
            { title: "Callen", emphasis: "definition" },
            { title: "Feynman", emphasis: "intuition" },
          ],
        },
      }),
    );
    expect(captured).not.toBeNull();
    expect(String(captured!["system"])).toContain("FUSION MODE");
    expect(String(captured!["prompt"])).toContain("FUSED SYNTHESIS");
    expect(String(captured!["prompt"])).toContain("Callen frames entropy");
    expect(String(captured!["prompt"])).toContain("Callen (definition)");
    // acknowledges_disagreement surfaces the "don't smooth it" instruction.
    expect(String(captured!["prompt"])).toContain("DISAGREE");
  });

  test("no fused_synthesis ⇒ no FUSION MODE (composer prompt unchanged)", async () => {
    let captured: Record<string, unknown> | null = null;
    const model: ModelRuntime = {
      async generate(req) {
        captured = req as unknown as Record<string, unknown>;
        return { text: GOOD_COMPOSITION, model: "stub-model", finishReason: "stop" as const };
      },
      async embed() {
        return [];
      },
    };
    const unit = new SurfaceComposerUnit({
      manifest: composerManifest,
      model,
      idGenerator: new SeededIdGenerator("comp-nofusion"),
    });
    await unit.execute(packet({ concept_title: "Entropy", goal: "Thermodynamics" }));
    expect(String(captured!["system"])).not.toContain("FUSION MODE");
  });

  test("non-composition output falls back to deterministic composition, visibly degraded", async () => {
    const unit = new SurfaceComposerUnit({
      manifest: composerManifest,
      model: stubModel(JSON.stringify({ layers: { layer_0: "x" }, summary: "s" })),
      idGenerator: new SeededIdGenerator("comp-fb"),
    });
    const emissions = await unit.execute(
      packet({ concept_title: "Backpropagation", goal: "Deep learning" }),
    );
    const content = emissions.packets?.[0]?.content as Record<string, unknown>;
    expect(content["response_kind"]).toBe("deterministic-composition");
    expect(content["fallback_reason"]).toBe("E_MODEL_OUTPUT_MALFORMED");
    expect(emissions.packets?.[0]?.confidence).toBeLessThanOrEqual(0.5);
  });

  test("a truncated composition degrades with the truthful E_MODEL_OUTPUT_TRUNCATED reason", async () => {
    const unit = new SurfaceComposerUnit({
      manifest: composerManifest,
      model: stubModel('{"mccr":{"core_concept":"Entro', "max_tokens"),
      idGenerator: new SeededIdGenerator("comp-trunc"),
    });
    const emissions = await unit.execute(packet({ concept_title: "Entropy", goal: "Physics" }));
    const content = emissions.packets?.[0]?.content as Record<string, unknown>;
    expect(content["response_kind"]).toBe("deterministic-composition");
    expect(content["fallback_reason"]).toBe("E_MODEL_OUTPUT_TRUNCATED");
  });

  test("R2a: source excerpts reach the prompt in SOURCE MODE; goal-mode omits them (ADR-0057)", async () => {
    let captured: { prompt?: string; system?: string } | null = null;
    const capturing: ModelRuntime = {
      async generate(req: { prompt?: string; system?: string }) {
        captured = req;
        return { text: GOOD_COMPOSITION, model: "stub-model", finishReason: "stop" as const };
      },
      async embed() {
        return [];
      },
    };
    const unit = new SurfaceComposerUnit({
      manifest: composerManifest,
      model: capturing,
      idGenerator: new SeededIdGenerator("comp-src"),
    });

    // Source-fed: the passage text reaches the prompt and the SOURCE MODE directive engages.
    await unit.execute(
      packet({
        concept_title: "Entropy",
        goal: "Physics",
        source_excerpts: [
          {
            anchor_ref: "anc-1",
            quote: "Entropy measures the disorder of a system.",
            path: "para-3",
          },
        ],
      }),
    );
    expect(captured!.prompt).toContain("Entropy measures the disorder of a system.");
    expect(captured!.system).toContain("SOURCE MODE");

    // Goal-mode (no excerpts): the prompt stays source-free — nothing regresses.
    captured = null;
    await unit.execute(packet({ concept_title: "Entropy", goal: "Physics" }));
    expect(captured!.system).not.toContain("SOURCE MODE");
    expect(captured!.prompt).not.toContain("SOURCE PASSAGES");
  });

  test("depth bias steers the prompt without breaking the contract", async () => {
    const unit = new SurfaceComposerUnit({
      manifest: composerManifest,
      model: stubModel(GOOD_COMPOSITION),
      idGenerator: new SeededIdGenerator("comp-bias"),
      getDepthBias: () => 0.5,
    });
    const emissions = await unit.execute(
      packet({ concept_title: "Fourier transform", goal: "DSP" }),
    );
    const content = emissions.packets?.[0]?.content as Record<string, unknown>;
    expect(content["response_kind"]).toBe("model-composition");
  });
});
