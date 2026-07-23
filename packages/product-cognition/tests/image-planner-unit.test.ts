/**
 * ImagePlannerUnit — the image-as-cognition decision (UCS, ADR-0030; Phase 4).
 * Deterministic: stub models only.
 */
import { describe, expect, test } from "vitest";
import type { ModelRuntime } from "@inevitable/contracts";
import type { CognitionPacket } from "@inevitable/protocols";
import { MVP_AGENT_MANIFESTS } from "../src/agent-catalog";
import {
  ImagePlannerUnit,
  deterministicImagePlan,
  parseImagePlan,
  type ImagePlan,
} from "../src/image-planner-unit";

const imageManifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.imageplanner")!;

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

function packet(content: Record<string, unknown>): CognitionPacket {
  return {
    packet_id: "cp-000000000000000000000001",
    schema_version: "1.0.0",
    source_cid: "cog-composer",
    target_cid: "cog-imageplanner",
    tenant_id: null,
    session_id: "intent-001",
    causation_id: "intent-001",
    correlation_id: "cp-000000000000000000000002",
    timestamp: "2026-06-12T00:00:00.000Z",
    hlc: "00000000000000000000:0:test",
    sequence_number: 0,
    packet_type: "intent",
    intent: "plan-image",
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

describe("parseImagePlan", () => {
  test("parses a helpful image plan with prompt, caption, and deduped/capped labels", () => {
    const plan = parseImagePlan(
      "```json\n" +
        JSON.stringify({
          helps: true,
          prompt: "a prism splitting white light into a spectrum",
          rationale: "the spatial split carries the intuition",
          caption: "White light separates into constituent frequencies",
          labels: ["incoming light", "prism", "prism", "spectrum", "a", "b", "c"],
        }) +
        "\n```",
      6,
    );
    expect(plan.helps).toBe(true);
    expect(plan.modality).toBe("image");
    expect(plan.prompt).toContain("prism");
    expect(plan.caption).toContain("frequencies");
    // deduped ("prism" once) and capped at 6
    expect(plan.labels).toEqual(["incoming light", "prism", "spectrum", "a", "b", "c"]);
  });

  test("helps=true without a prompt collapses to a no-image decision", () => {
    const plan = parseImagePlan(JSON.stringify({ helps: true, caption: "x" }), 6);
    expect(plan.helps).toBe(false);
    expect(plan.modality).toBe("none");
    expect(plan.prompt).toBeNull();
    expect(plan.caption).toBeNull();
    expect(plan.labels).toEqual([]);
  });

  test("an explicit no-image decision carries no caption/labels", () => {
    const plan = parseImagePlan(
      JSON.stringify({ helps: false, rationale: "the diagram anchor suffices" }),
      6,
    );
    expect(plan.helps).toBe(false);
    expect(plan.rationale).toContain("diagram");
    expect(plan.labels).toEqual([]);
  });

  test("invalid JSON throws E_MODEL_OUTPUT_MALFORMED", () => {
    expect(() => parseImagePlan("not json", 6)).toThrowError(/valid JSON/);
  });
});

describe("deterministicImagePlan", () => {
  test("never fabricates media (helps=false)", () => {
    const plan = deterministicImagePlan();
    expect(plan.helps).toBe(false);
    expect(plan.prompt).toBeNull();
    expect(plan.labels).toEqual([]);
  });
});

async function runPlan(unit: ImagePlannerUnit, p: CognitionPacket): Promise<ImagePlan> {
  const emissions = await unit.execute(p);
  const content = (emissions.packets?.[0]?.content ?? {}) as Record<string, unknown>;
  return content["image_plan"] as ImagePlan;
}

describe("ImagePlannerUnit", () => {
  test("decides an explanatory image via the model", async () => {
    const unit = new ImagePlannerUnit({
      manifest: imageManifest,
      model: stubModel(
        JSON.stringify({
          helps: true,
          prompt: "vectors as arrows transformed by a matrix grid",
          rationale: "spatial reshaping is hard to say in words",
          caption: "A matrix reshapes every vector at once",
          labels: ["input vector", "grid", "output vector"],
        }),
      ),
    });
    const plan = await runPlan(
      unit,
      packet({ concept_title: "Linear maps", sub_focus: "geometry" }),
    );
    expect(plan.helps).toBe(true);
    expect(plan.labels).toEqual(["input vector", "grid", "output vector"]);
    expect(plan.caption).toContain("reshapes");
  });

  test("degrades deterministically when the model refuses (no fabricated media)", async () => {
    const unit = new ImagePlannerUnit({
      manifest: imageManifest,
      model: stubModel("", "refusal"),
    });
    const emissions = await unit.execute(packet({ concept_title: "Linear maps" }));
    const content = (emissions.packets?.[0]?.content ?? {}) as Record<string, unknown>;
    expect(content["response_kind"]).toBe("deterministic-image-plan");
    expect((content["image_plan"] as ImagePlan).helps).toBe(false);
    expect(emissions.trace?.determinism_level).toBe("D2");
  });

  test("a truncated decision degrades with the truthful E_MODEL_OUTPUT_TRUNCATED reason", async () => {
    const unit = new ImagePlannerUnit({
      manifest: imageManifest,
      model: stubModel('{"helps":tr', "max_tokens"),
    });
    const emissions = await unit.execute(packet({ concept_title: "Linear maps" }));
    const content = (emissions.packets?.[0]?.content ?? {}) as Record<string, unknown>;
    expect(content["response_kind"]).toBe("deterministic-image-plan");
    expect(content["fallback_reason"]).toBe("E_MODEL_OUTPUT_TRUNCATED");
  });

  test("refine mode is recorded as a refine reasoning kind", async () => {
    const unit = new ImagePlannerUnit({
      manifest: imageManifest,
      model: stubModel(
        JSON.stringify({ helps: true, prompt: "clearer prism diagram", labels: ["prism"] }),
      ),
    });
    const emissions = await unit.execute(
      packet({
        concept_title: "Fourier",
        mode: "refine",
        feedback: "the first image was too busy",
      }),
    );
    const content = (emissions.packets?.[0]?.content ?? {}) as Record<string, unknown>;
    expect(content["response_kind"]).toBe("model-image-refine");
  });
});
