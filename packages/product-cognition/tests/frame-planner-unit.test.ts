/**
 * FramePlannerUnit — one concept → a sequence of progressive Cognitive Frames (UCS, ADR-0030).
 * Deterministic: stub models only.
 */
import { describe, expect, test } from "vitest";
import type { ModelRuntime } from "@inevitable/contracts";
import type { CognitionPacket } from "@inevitable/protocols";
import { SeededIdGenerator } from "@inevitable/shared";
import { MVP_AGENT_MANIFESTS } from "../src/agent-catalog";
import {
  FramePlannerUnit,
  deterministicPlan,
  parseFramePlan,
  type FramePlan,
} from "../src/frame-planner-unit";

const plannerManifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.frameplanner")!;

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

const GOOD_PLAN = JSON.stringify({
  frames: [
    {
      title: "Intuition: light through a prism",
      sub_focus: "the intuition that any signal is a sum of pure frequencies",
      archetype: "image-led",
      slots: ["core_concept", "mental_model"],
      intent: "introduce",
    },
    {
      title: "The transform, precisely",
      sub_focus: "the integral definition and what each symbol means",
      archetype: "formal",
      slots: ["definition", "key_formula"],
      intent: "deepen",
    },
    {
      title: "A worked example",
      sub_focus: "transforming a square wave step by step",
      archetype: "example-led",
      slots: ["core_concept", "key_example", "diagram"],
      intent: "illustrate",
    },
  ],
  pacing: { strategy: "progressive", notes: "intuition → formal → example" },
});

function packet(content: Record<string, unknown>): CognitionPacket {
  return {
    packet_id: "cp-000000000000000000000001",
    schema_version: "1.0.0",
    source_cid: "cog-learner",
    target_cid: "cog-frameplanner",
    tenant_id: null,
    session_id: "intent-001",
    causation_id: "intent-001",
    correlation_id: "cp-000000000000000000000002",
    timestamp: "2026-06-12T00:00:00.000Z",
    hlc: "00000000000000000000:0:test",
    sequence_number: 0,
    packet_type: "intent",
    intent: "plan",
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

describe("parseFramePlan", () => {
  test("parses a progressive multi-frame plan with validated archetypes/slots/intents", () => {
    const plan = parseFramePlan("```json\n" + GOOD_PLAN + "\n```", "Fourier transform", 5);
    expect(plan.frames).toHaveLength(3);
    expect(plan.frames[0]?.archetype).toBe("image-led");
    expect(plan.frames[0]?.intent).toBe("introduce");
    expect(plan.frames[1]?.slots).toEqual(["definition", "key_formula", "core_concept"]); // core forced in
    expect(plan.frames.map((f) => f.sub_focus).every((s) => s.length > 0)).toBe(true);
    expect(plan.pacing.strategy).toBe("progressive");
  });

  test("forces core_concept into every frame's slots and dedupes", () => {
    const plan = parseFramePlan(
      JSON.stringify({
        frames: [
          { title: "F", slots: ["definition", "definition", "table"] },
          { title: "G", slots: ["core_concept", "key_example"] },
        ],
      }),
      "X",
      5,
    );
    expect(plan.frames[0]?.slots).toEqual(["definition", "table", "core_concept"]);
    expect(plan.frames[1]?.slots).toEqual(["core_concept", "key_example"]);
  });

  test("drops invalid slots/archetypes/intents to safe defaults", () => {
    const plan = parseFramePlan(
      JSON.stringify({
        frames: [
          { title: "F", slots: ["bogus", "core_concept"], archetype: "spiral", intent: "x" },
        ],
      }),
      "X",
      5,
    );
    expect(plan.frames[0]?.slots).toEqual(["core_concept"]);
    expect(plan.frames[0]?.archetype).toBe("concept-first");
    expect(plan.frames[0]?.intent).toBe("build");
  });

  test("caps the plan at maxFrames", () => {
    const many = { frames: Array.from({ length: 9 }, (_, i) => ({ title: `F${i}` })) };
    const plan = parseFramePlan(JSON.stringify(many), "X", 3);
    expect(plan.frames).toHaveLength(3);
  });

  test("an empty/invalid frame list throws (the unit degrades to its deterministic fallback)", () => {
    expect(() => parseFramePlan(JSON.stringify({ frames: [] }), "Eigenvalues", 5)).toThrowError(
      /no frames/,
    );
    expect(() => parseFramePlan("not json", "X", 5)).toThrowError(/valid JSON/);
  });

  test("parses a single look-ahead bet with its trigger assumption (UCS Phase 3)", () => {
    const plan = parseFramePlan(
      JSON.stringify({
        frames: [{ title: "F", slots: ["core_concept"] }],
        lookahead: [
          {
            title: "Opening: the inverse transform",
            sub_focus: "reversing the transform to recover the signal",
            archetype: "formal",
            slots: ["core_concept", "key_formula"],
            trigger_assumption: "learner masters the forward transform and advances to the inverse",
          },
        ],
      }),
      "Fourier transform",
      5,
    );
    expect(plan.lookahead).toHaveLength(1);
    expect(plan.lookahead[0]?.title).toBe("Opening: the inverse transform");
    expect(plan.lookahead[0]?.archetype).toBe("formal");
    expect(plan.lookahead[0]?.slots).toEqual(["core_concept", "key_formula"]);
    expect(plan.lookahead[0]?.trigger_assumption).toContain("inverse");
  });

  test("drops look-ahead bets without a title or trigger, and caps at one (UCS Phase 3)", () => {
    const plan = parseFramePlan(
      JSON.stringify({
        frames: [{ title: "F", slots: ["core_concept"] }],
        lookahead: [
          { title: "no trigger" }, // dropped — no trigger_assumption
          { trigger_assumption: "no title" }, // dropped — no title
          { title: "Bet A", trigger_assumption: "learner advances to A" },
          { title: "Bet B", trigger_assumption: "learner advances to B" },
        ],
      }),
      "X",
      5,
    );
    expect(plan.lookahead).toHaveLength(1);
    expect(plan.lookahead[0]?.title).toBe("Bet A");
  });

  test("a plan with no lookahead yields an empty bet list", () => {
    const plan = parseFramePlan(GOOD_PLAN, "Fourier transform", 5);
    expect(plan.lookahead).toEqual([]);
  });
});

describe("deterministicPlan", () => {
  test("is deterministic and yields exactly one frame (Phase 1 parity)", () => {
    const a = deterministicPlan(packet({ concept_title: "Eigenvalues", goal: "Linear algebra" }));
    const b = deterministicPlan(packet({ concept_title: "Eigenvalues", goal: "Linear algebra" }));
    expect(a).toEqual(b);
    expect(a.frames).toHaveLength(1);
    expect(a.frames[0]?.title).toBe("Eigenvalues");
    expect(a.frames[0]?.slots).toEqual(["core_concept", "definition"]);
    expect(a.pacing.strategy).toBe("single-frame");
  });
});

describe("FramePlannerUnit", () => {
  test("valid model output becomes a model-plan response packet", async () => {
    const unit = new FramePlannerUnit({
      manifest: plannerManifest,
      model: stubModel(GOOD_PLAN),
      idGenerator: new SeededIdGenerator("plan"),
    });
    const emissions = await unit.execute(
      packet({ concept_title: "Fourier transform", goal: "Signal processing" }),
    );
    const content = emissions.packets?.[0]?.content as Record<string, unknown>;
    expect(content["response_kind"]).toBe("model-plan");
    const plan = content["frame_plan"] as FramePlan;
    expect(plan.frames).toHaveLength(3);
    expect(emissions.packets?.[0]?.confidence).toBe(0.82);
    expect(emissions.trace?.determinism_level).toBe("D3");
  });

  test("non-plan output falls back to a deterministic single-frame plan, visibly degraded", async () => {
    const unit = new FramePlannerUnit({
      manifest: plannerManifest,
      model: stubModel(JSON.stringify({ mccr: { core_concept: "x" } })),
      idGenerator: new SeededIdGenerator("plan-fb"),
    });
    const emissions = await unit.execute(
      packet({ concept_title: "Backpropagation", goal: "Deep learning" }),
    );
    const content = emissions.packets?.[0]?.content as Record<string, unknown>;
    expect(content["response_kind"]).toBe("deterministic-plan");
    const plan = content["frame_plan"] as FramePlan;
    expect(plan.frames).toHaveLength(1);
    expect(emissions.packets?.[0]?.confidence).toBeLessThanOrEqual(0.5);
  });

  test("a refusal falls back deterministically (never throws to the caller)", async () => {
    const unit = new FramePlannerUnit({
      manifest: plannerManifest,
      model: stubModel("", "refusal"),
      idGenerator: new SeededIdGenerator("plan-ref"),
    });
    const emissions = await unit.execute(packet({ concept_title: "Topology", goal: "Math" }));
    const content = emissions.packets?.[0]?.content as Record<string, unknown>;
    expect(content["response_kind"]).toBe("deterministic-plan");
    expect(content["fallback_reason"]).toBe("E_MODEL_REFUSAL");
  });

  test("a truncated response degrades with the truthful E_MODEL_OUTPUT_TRUNCATED reason", async () => {
    const unit = new FramePlannerUnit({
      manifest: plannerManifest,
      model: stubModel(GOOD_PLAN.slice(0, 40), "max_tokens"),
      idGenerator: new SeededIdGenerator("plan-trunc"),
    });
    const emissions = await unit.execute(packet({ concept_title: "Entropy", goal: "Physics" }));
    const content = emissions.packets?.[0]?.content as Record<string, unknown>;
    expect(content["response_kind"]).toBe("deterministic-plan");
    expect(content["fallback_reason"]).toBe("E_MODEL_OUTPUT_TRUNCATED");
  });

  test("maxFrames is enforced end-to-end through the unit", async () => {
    const many = JSON.stringify({
      frames: Array.from({ length: 8 }, (_, i) => ({ title: `F${i}`, slots: ["core_concept"] })),
    });
    const unit = new FramePlannerUnit({
      manifest: plannerManifest,
      model: stubModel(many),
      idGenerator: new SeededIdGenerator("plan-cap"),
      maxFrames: 2,
    });
    const emissions = await unit.execute(packet({ concept_title: "Graphs", goal: "CS" }));
    const content = emissions.packets?.[0]?.content as Record<string, unknown>;
    const plan = content["frame_plan"] as FramePlan;
    expect(plan.frames).toHaveLength(2);
  });
});
