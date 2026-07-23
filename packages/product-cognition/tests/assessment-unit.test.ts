/**
 * AssessmentUnit — the Grader (F14 depth-gate made real). Deterministic: stub models only.
 */
import { describe, expect, test } from "vitest";
import type { ModelRuntime } from "@inevitable/contracts";
import type { CognitionPacket } from "@inevitable/protocols";
import { MVP_AGENT_MANIFESTS } from "../src/agent-catalog";
import {
  AssessmentUnit,
  deterministicAssessment,
  parseAnswerAssessment,
  type AnswerAssessment,
} from "../src/assessment-unit";

const manifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.assessment")!;

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

function packet(content: Record<string, unknown>): CognitionPacket {
  return {
    packet_id: "cp-000000000000000000000001",
    schema_version: "1.0.0",
    source_cid: "cog-surface",
    target_cid: "cog-assessment",
    tenant_id: null,
    session_id: "intent-001",
    causation_id: "intent-001",
    correlation_id: "cp-000000000000000000000002",
    timestamp: "2026-06-12T00:00:00.000Z",
    hlc: "00000000000000000000:0:test",
    sequence_number: 0,
    packet_type: "intent",
    intent: "grade-answer",
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

describe("parseAnswerAssessment", () => {
  test("parses a graded verdict with per-aspect depth tests", () => {
    const v = parseAnswerAssessment(
      "```json\n" +
        JSON.stringify({
          passed: true,
          confidence: 0.82,
          feedback: "You captured the core idea well.",
          tests: [
            {
              kind: "application",
              passed: true,
              confidence: 0.85,
              evidence: "applied the formula",
            },
            { kind: "bogus", passed: true, evidence: "ignored" },
          ],
        }) +
        "\n```",
    );
    expect(v.graded).toBe(true);
    expect(v.passed).toBe(true);
    expect(v.confidence).toBeCloseTo(0.82);
    expect(v.tests).toHaveLength(1); // the invalid kind is dropped
    expect(v.tests[0]?.kind).toBe("application");
  });

  test("clamps confidence and defaults a missing feedback", () => {
    const v = parseAnswerAssessment(JSON.stringify({ passed: false, confidence: 5 }));
    expect(v.confidence).toBe(1);
    expect(v.passed).toBe(false);
    expect(v.feedback).toBe("");
  });

  test("invalid JSON throws E_MODEL_OUTPUT_MALFORMED", () => {
    expect(() => parseAnswerAssessment("not json")).toThrowError(/valid JSON/);
  });
});

describe("deterministicAssessment", () => {
  test("is honest: records the answer but never fabricates a pass", () => {
    const v = deterministicAssessment();
    expect(v.passed).toBe(false);
    expect(v.graded).toBe(false);
    expect(v.tests).toEqual([]);
  });
});

async function runGrade(unit: AssessmentUnit, p: CognitionPacket): Promise<AnswerAssessment> {
  const emissions = await unit.execute(p);
  const content = (emissions.packets?.[0]?.content ?? {}) as Record<string, unknown>;
  return content["assessment"] as AnswerAssessment;
}

describe("AssessmentUnit", () => {
  test("grades a real answer into an evidence-bearing verdict", async () => {
    const unit = new AssessmentUnit({
      manifest,
      model: stubModel(
        JSON.stringify({
          passed: true,
          confidence: 0.8,
          feedback: "Solid — you explained why the bias shifts the threshold.",
          tests: [
            { kind: "explanation", passed: true, confidence: 0.8, evidence: "defined the neuron" },
          ],
        }),
      ),
    });
    const v = await runGrade(
      unit,
      packet({
        concept_title: "Perceptron",
        problem: "What does the bias do?",
        answer: "It shifts the activation threshold.",
      }),
    );
    expect(v.graded).toBe(true);
    expect(v.passed).toBe(true);
    expect(v.tests[0]?.evidence).toContain("neuron");
  });

  test("degrades honestly when the model refuses (records, does not fabricate a pass)", async () => {
    const unit = new AssessmentUnit({ manifest, model: stubModel("", "refusal") });
    const emissions = await unit.execute(packet({ concept_title: "Perceptron", answer: "x" }));
    const content = (emissions.packets?.[0]?.content ?? {}) as Record<string, unknown>;
    expect(content["response_kind"]).toBe("deterministic-assessment");
    const v = content["assessment"] as AnswerAssessment;
    expect(v.passed).toBe(false);
    expect(v.graded).toBe(false);
    expect(emissions.trace?.determinism_level).toBe("D2");
  });
});
