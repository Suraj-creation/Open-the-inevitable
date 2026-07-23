/**
 * AssessmentUnit — the Grader (UCS; F14 depth-gate made real).
 *
 * Grades a learner's actual answer to a practice problem into a structured, evidence-bearing verdict:
 * whether they demonstrated the concept, a confidence, human feedback, and per-aspect depth-test
 * results (explanation/application/connection/teaching/edge_case) tied to WHAT THE LEARNER SAID. This
 * replaces the fabricated auto-pass — mastery is now earned from genuine learner evidence.
 *
 * Implements the same `CognitiveUnit` ABI as `ImagePlannerUnit`/`ModelBackedUnit`, so the governance
 * gate, scheduler admission, OTel span, and D3 recording all apply unchanged. Model-backed with a
 * deterministic fallback that is HONEST: offline it records the answer but does not fabricate a pass.
 *
 * Spec: spec/product/features/F14-assessment-mastery-depth.md; ADR-0030; model-invocation-protocol.
 */
import type {
  ModelGenerationRequest,
  ModelGenerationResult,
  ModelRuntime,
} from "@inevitable/contracts";
import type {
  AgentManifest,
  CognitionPacket,
  ContextLease,
  ReasoningTrace,
  UnitDescriptor,
  UnitLifecycleState,
} from "@inevitable/protocols";
import { SCHEMA_IDS } from "@inevitable/protocols";
import type {
  CognitiveHealth,
  CognitionFrame,
  CognitiveUnit,
  Emissions,
} from "@inevitable/runtime";
import { CosError, CryptoIdGenerator, newPacketId, type IdGenerator } from "@inevitable/shared";
import type { DepthTestKind, DepthTestResult } from "./learning-loop";

const SPEC_REF = "protocols/model-invocation-protocol";

const DEPTH_TEST_KINDS: ReadonlySet<string> = new Set([
  "explanation",
  "application",
  "connection",
  "teaching",
  "edge_case",
]);

/** The graded verdict on a learner's answer — genuine evidence, never fabricated. */
export interface AnswerAssessment {
  readonly passed: boolean;
  readonly confidence: number;
  readonly feedback: string;
  /** Per-aspect depth-test results grounded in what the learner actually wrote. */
  readonly tests: readonly DepthTestResult[];
  /** True when this is the honest offline fallback (recorded, ungraded) — the surface must say so. */
  readonly graded: boolean;
}

export interface AssessmentUnitDeps {
  readonly manifest: AgentManifest;
  readonly model: ModelRuntime;
  readonly timeoutMs?: number;
  readonly idGenerator?: IdGenerator;
}

const OUTPUT_CONTRACT_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["passed", "confidence"],
  properties: {
    passed: { type: "boolean" },
    confidence: { type: "number" },
    feedback: { type: "string" },
    tests: {
      type: "array",
      items: {
        type: "object",
        required: ["kind", "passed"],
        properties: {
          kind: { type: "string" },
          passed: { type: "boolean" },
          confidence: { type: "number" },
          evidence: { type: "string" },
        },
      },
    },
  },
};

function assessError(code: string, message: string, details?: Record<string, unknown>): CosError {
  return new CosError(code, message, { specRef: SPEC_REF, details });
}

function contentOf(packet: CognitionPacket): Record<string, unknown> {
  return (packet.content ?? {}) as Record<string, unknown>;
}

function fieldOf(packet: CognitionPacket, key: string): string {
  const v = contentOf(packet)[key];
  return typeof v === "string" ? v.trim() : "";
}

function conceptTitleOf(packet: CognitionPacket): string {
  return fieldOf(packet, "concept_title") || packet.intent || "the concept";
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** The honest deterministic verdict: offline we record the answer but never fabricate a pass. */
export function deterministicAssessment(): AnswerAssessment {
  return {
    passed: false,
    confidence: 0,
    feedback:
      "Your answer was recorded. Live grading is unavailable right now, so mastery is not verified.",
    tests: [],
    graded: false,
  };
}

/** Parse + validate the grader output. Throws E_MODEL_OUTPUT_MALFORMED on bad JSON. */
export function parseAnswerAssessment(text: string): AnswerAssessment {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    throw assessError("E_MODEL_OUTPUT_MALFORMED", "assessment output is not valid JSON", {
      sample: trimmed.slice(0, 200),
    });
  }
  const obj = (raw ?? {}) as Record<string, unknown>;
  const confidence = typeof obj["confidence"] === "number" ? clamp01(obj["confidence"]) : 0.5;
  const passed = obj["passed"] === true;
  const feedback = typeof obj["feedback"] === "string" ? obj["feedback"].trim() : "";
  const testsRaw = Array.isArray(obj["tests"]) ? obj["tests"] : [];
  const tests: DepthTestResult[] = [];
  for (const entry of testsRaw) {
    const t = (entry ?? {}) as Record<string, unknown>;
    const kind = typeof t["kind"] === "string" ? t["kind"].trim() : "";
    if (!DEPTH_TEST_KINDS.has(kind)) continue;
    tests.push({
      kind: kind as DepthTestKind,
      passed: t["passed"] === true,
      confidence: typeof t["confidence"] === "number" ? clamp01(t["confidence"]) : confidence,
      evidence: typeof t["evidence"] === "string" ? t["evidence"].trim() : "",
    });
  }
  return { passed, confidence, feedback, tests, graded: true };
}

function descriptorFromManifest(manifest: AgentManifest): UnitDescriptor {
  const memory = manifest.memory_access;
  return {
    unit_id: manifest.id,
    unit_type: manifest.id,
    version: manifest.version,
    abi_version: manifest.abi_version,
    capabilities: manifest.capabilities,
    input_schemas: [SCHEMA_IDS.cognitionPacket],
    output_schemas: [SCHEMA_IDS.cognitionPacket],
    policy_needs: manifest.policies,
    memory_scope_needs: [...(memory.read ?? []), ...(memory.write ?? [])],
    observability_contract: manifest.observability.required_events ?? [],
    resource_budget: manifest.resources,
    evolution_policy: "frozen",
  };
}

export class AssessmentUnit implements CognitiveUnit {
  private readonly manifest: AgentManifest;
  private readonly model: ModelRuntime;
  private readonly timeoutMs: number;
  private readonly idGenerator: IdGenerator;
  private preparedLeaseId: string | null = null;

  constructor(deps: AssessmentUnitDeps) {
    this.manifest = deps.manifest;
    this.model = deps.model;
    this.timeoutMs = deps.timeoutMs ?? 60_000;
    this.idGenerator = deps.idGenerator ?? new CryptoIdGenerator();
  }

  describe(): UnitDescriptor {
    return descriptorFromManifest(this.manifest);
  }

  prepare(lease: ContextLease): void {
    this.preparedLeaseId = lease.lease_id;
  }

  async execute(packet: CognitionPacket): Promise<Emissions> {
    try {
      return await this.executeWithModel(packet);
    } catch (cause) {
      const code = cause instanceof CosError ? cause.code : "E_MODEL_UNAVAILABLE";
      const verdict = deterministicAssessment();
      const response = this.buildResponsePacket(packet, verdict, {
        kind: "deterministic-assessment",
        model: "deterministic",
        fallbackReason: code,
      });
      return { packets: [response], trace: this.buildTrace(packet, verdict, "deterministic") };
    }
  }

  private async executeWithModel(packet: CognitionPacket): Promise<Emissions> {
    const request = this.buildRequest(packet);
    const result = await this.withTimeout(this.model.generate(request));
    if (result.finishReason === "refusal" || result.finishReason === "safety") {
      throw assessError("E_MODEL_REFUSAL", `model refused generation (${result.finishReason})`, {
        invocation_key: request.invocation_key,
      });
    }
    const verdict = parseAnswerAssessment(result.text);
    const response = this.buildResponsePacket(packet, verdict, {
      kind: "model-assessment",
      model: result.model,
    });
    return { packets: [response], trace: this.buildTrace(packet, verdict, result.model) };
  }

  private buildRequest(packet: CognitionPacket): ModelGenerationRequest {
    const title = conceptTitleOf(packet);
    const problem = fieldOf(packet, "problem");
    const answer = fieldOf(packet, "answer");
    const system = [
      `You are "${this.manifest.id}". ${this.manifest.role}`,
      "Grade the learner's answer to a practice problem HONESTLY and generously but truthfully. Judge",
      "genuine understanding, not wording. Return per-aspect depth-test results grounded in what the",
      "learner actually wrote — cite their words as evidence. Only mark an aspect passed if the answer",
      "genuinely demonstrates it; an empty or off-topic answer does not pass.",
      "Respond with JSON only (no markdown fences) matching:",
      '{"passed":true,"confidence":0.0,"feedback":"one or two supportive, specific sentences","tests":[{"kind":"explanation|application|connection|teaching|edge_case","passed":true,"confidence":0.0,"evidence":"what in the answer shows this"}]}',
      "passed is true iff the learner demonstrated real understanding of the concept.",
    ].join("\n");
    return {
      prompt: `Concept: ${title}\nProblem: ${problem}\nLearner's answer: ${answer}`,
      system,
      maxTokens: 2048,
      thinkingBudget: 512,
      responseSchema: OUTPUT_CONTRACT_SCHEMA,
      invocation_key: `${this.manifest.id}:${packet.packet_id}:grade`,
    };
  }

  private buildResponsePacket(
    packet: CognitionPacket,
    verdict: AnswerAssessment,
    meta: { kind: string; model: string; fallbackReason?: string },
  ): CognitionPacket {
    return {
      packet_id: newPacketId(this.idGenerator),
      schema_version: packet.schema_version,
      source_cid: packet.target_cid ?? this.manifest.id,
      target_cid: packet.source_cid,
      tenant_id: packet.tenant_id ?? null,
      session_id: packet.session_id ?? null,
      causation_id: packet.packet_id,
      correlation_id: packet.correlation_id ?? packet.packet_id,
      timestamp: packet.timestamp,
      hlc: packet.hlc,
      sequence_number: (packet.sequence_number ?? 0) + 1,
      packet_type: "response",
      intent: packet.intent ?? null,
      concept_ids: packet.concept_ids ?? [],
      domain_ids: packet.domain_ids ?? [],
      content: {
        handled_by: this.manifest.id,
        response_kind: meta.kind,
        assessment: verdict,
        model: meta.model,
        ...(meta.fallbackReason ? { fallback_reason: meta.fallbackReason } : {}),
        prepared_lease_id: this.preparedLeaseId,
      },
      evidence: [
        { kind: "answer-assessment", source_packet_id: packet.packet_id, model: meta.model },
      ],
      confidence: verdict.confidence,
      uncertainty_estimate: 1 - verdict.confidence,
      reasoning_depth: (packet.reasoning_depth ?? 0) + 1,
      classification: packet.classification ?? "internal",
      policy_tags: packet.policy_tags ?? [],
      requires_human_review: false,
      priority: packet.priority,
      expiry: packet.expiry ?? null,
      trace_id: packet.trace_id,
      span_id: packet.span_id,
    };
  }

  private buildTrace(
    packet: CognitionPacket,
    verdict: AnswerAssessment,
    model: string,
  ): ReasoningTrace {
    return {
      trace_id: packet.trace_id ?? "",
      producer_cid: this.manifest.id,
      session_id: packet.session_id ?? null,
      task_interpretation: `grade the learner's answer for "${conceptTitleOf(packet)}"`,
      strategy: "evidence-grounded-depth-grading",
      claims: [
        {
          claim_id: `${packet.packet_id}-claim-0`,
          statement: verdict.graded
            ? `graded ${verdict.tests.length} aspect(s); ${verdict.passed ? "passed" : "not yet"}`
            : "offline — answer recorded, not graded",
          confidence: verdict.confidence,
        },
      ],
      decision: verdict.graded
        ? `assessed the answer via ${model}: ${verdict.passed ? "mastery demonstrated" : "not yet"}`
        : "recorded the answer without grading (offline)",
      uncertainty_estimate: 1 - verdict.confidence,
      self_critique: verdict.graded
        ? null
        : "deterministic fallback — no grading; degradation is visible",
      determinism_level: model === "deterministic" ? "D2" : "D3",
    };
  }

  private async withTimeout(work: Promise<ModelGenerationResult>): Promise<ModelGenerationResult> {
    const timers = globalThis as {
      setTimeout?: (fn: () => void, ms: number) => unknown;
      clearTimeout?: (handle: unknown) => void;
    };
    if (!timers.setTimeout) return work;
    let handle: unknown;
    const timeout = new Promise<never>((_, reject) => {
      handle = timers.setTimeout!(() => {
        reject(assessError("E_MODEL_TIMEOUT", `model call exceeded ${this.timeoutMs}ms`));
      }, this.timeoutMs);
    });
    try {
      return await Promise.race([work, timeout]);
    } finally {
      timers.clearTimeout?.(handle);
    }
  }

  reflect(): string | null {
    return null;
  }

  checkpoint(): CognitionFrame {
    return {
      unitId: this.manifest.id,
      state: "Ready" as UnitLifecycleState,
      data: { preparedLeaseId: this.preparedLeaseId },
    };
  }

  restore(frame: CognitionFrame): void {
    this.preparedLeaseId =
      typeof frame.data["preparedLeaseId"] === "string" ? frame.data["preparedLeaseId"] : null;
  }

  shutdown(): void {
    this.preparedLeaseId = null;
  }

  health(): CognitiveHealth {
    return { runtime: "ok", drift: 0, confidence: 1, loadFactor: 0 };
  }
}
