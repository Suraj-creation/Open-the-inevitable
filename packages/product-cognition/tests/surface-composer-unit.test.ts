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

function stubModel(text: string, finishReason?: "stop" | "refusal"): ModelRuntime {
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
