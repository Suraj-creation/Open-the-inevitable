/**
 * IntentInferenceUnit — interprets a learner goal into a bounded, confidence-scored intent
 * (interpreted goal + scope + constraints) through the governed dispatch path.
 *
 * It is the F01/kernel intent-interpretation agent: a standard-trust agent (GOV-P01), it implements the
 * same `CognitiveUnit` ABI as `CurriculumUnit`/`ModelBackedUnit`, so the governance gate, scheduler
 * admission, OTel span, and D3 recording all apply unchanged. Model-backed with an inline deterministic
 * fallback, so offline/seeded runs still yield a real, deterministic interpretation.
 *
 * Spec: spec/kernel/intent-inference.md, spec/kernel/intent-lease.md,
 *       spec/protocols/model-invocation-protocol.md.
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

const SPEC_REF = "kernel/intent-inference";

export interface InferredIntent {
  readonly interpretedGoal: string;
  readonly scope: readonly string[];
  readonly constraints: readonly string[];
  readonly confidence: number;
}

export interface IntentInferenceUnitDeps {
  readonly manifest: AgentManifest;
  readonly model: ModelRuntime;
  readonly timeoutMs?: number;
  readonly idGenerator?: IdGenerator;
}

const OUTPUT_CONTRACT_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["interpreted_goal"],
  properties: {
    interpreted_goal: { type: "string", maxLength: 200 },
    scope: { type: "array", items: { type: "string", maxLength: 60 }, maxItems: 5 },
    constraints: { type: "array", items: { type: "string", maxLength: 100 }, maxItems: 3 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
};

function intentError(code: string, message: string, details?: Record<string, unknown>): CosError {
  return new CosError(code, message, { specRef: SPEC_REF, details });
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** A deterministic interpretation derived from the goal (the offline fallback). */
export function deterministicIntent(goal: string): InferredIntent {
  return {
    interpretedGoal: goal.trim() || "Understand the requested topic",
    scope: [],
    constraints: [],
    confidence: 0.5,
  };
}

/** Parse + validate the intent output contract. Throws E_MODEL_OUTPUT_MALFORMED on bad shape. */
export function parseIntentOutput(text: string): InferredIntent {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    throw intentError("E_MODEL_OUTPUT_MALFORMED", "intent output is not valid JSON", {
      sample: trimmed.slice(0, 200),
    });
  }
  const obj = raw as {
    interpreted_goal?: unknown;
    scope?: unknown;
    constraints?: unknown;
    confidence?: unknown;
  };
  const interpretedGoal =
    typeof obj.interpreted_goal === "string" ? obj.interpreted_goal.trim() : "";
  if (!interpretedGoal) {
    throw intentError("E_MODEL_OUTPUT_MALFORMED", "intent output missing interpreted_goal");
  }
  const scope = Array.isArray(obj.scope)
    ? obj.scope
        .filter((s): s is string => typeof s === "string")
        .map((s) => s.slice(0, 80))
        .slice(0, 5)
    : [];
  const constraints = Array.isArray(obj.constraints)
    ? obj.constraints
        .filter((s): s is string => typeof s === "string")
        .map((s) => s.slice(0, 120))
        .slice(0, 3)
    : [];
  const confidence = typeof obj.confidence === "number" ? clamp01(obj.confidence) : 0.7;
  return { interpretedGoal, scope, constraints, confidence };
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

function goalOf(packet: CognitionPacket): string {
  const content = (packet.content ?? {}) as Record<string, unknown>;
  if (typeof content["goal"] === "string" && content["goal"].trim()) return content["goal"];
  return packet.intent ?? "the topic";
}

export class IntentInferenceUnit implements CognitiveUnit {
  private readonly manifest: AgentManifest;
  private readonly model: ModelRuntime;
  private readonly timeoutMs: number;
  private readonly idGenerator: IdGenerator;
  private preparedLeaseId: string | null = null;

  constructor(deps: IntentInferenceUnitDeps) {
    this.manifest = deps.manifest;
    this.model = deps.model;
    this.timeoutMs = deps.timeoutMs ?? 20_000;
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
      const request = this.buildRequest(packet);
      const result = await this.withTimeout(this.model.generate(request));
      if (result.finishReason === "refusal" || result.finishReason === "safety") {
        throw intentError("E_MODEL_REFUSAL", `model refused generation (${result.finishReason})`, {
          invocation_key: request.invocation_key,
        });
      }
      if (result.finishReason === "max_tokens") {
        throw intentError(
          "E_MODEL_OUTPUT_TRUNCATED",
          "intent output cut off at token budget; JSON is incomplete",
          { invocation_key: request.invocation_key, text_length: result.text.length },
        );
      }
      const intent = parseIntentOutput(result.text);
      return {
        packets: [
          this.buildResponsePacket(packet, intent, { kind: "model-intent", model: result.model }),
        ],
        trace: this.buildTrace(packet, intent, result.model),
      };
    } catch (cause) {
      const code = cause instanceof CosError ? cause.code : "E_MODEL_UNAVAILABLE";
      const intent = deterministicIntent(goalOf(packet));
      return {
        packets: [
          this.buildResponsePacket(packet, intent, {
            kind: "deterministic-intent",
            model: "deterministic",
            fallbackReason: code,
          }),
        ],
        trace: this.buildTrace(packet, intent, "deterministic"),
      };
    }
  }

  private buildRequest(packet: CognitionPacket): ModelGenerationRequest {
    const goal = goalOf(packet);
    const system = [
      `You are "${this.manifest.id}". ${this.manifest.role}`,
      "Interpret the learner's goal into a bounded intent: a clear restatement of what they want to",
      "understand, the topical scope it touches, and any constraints implied by the phrasing.",
      "Respond with JSON only (no markdown fences) matching:",
      `{"interpreted_goal":"<clear restatement>","scope":["domain-or-topic"],"constraints":["constraint"],"confidence":0.0}`,
      "confidence is your 0..1 certainty that this interpretation matches the learner's actual intent.",
      "Keep scope to at most 5 items. Keep the entire response under 200 tokens.",
    ].join("\n");
    return {
      prompt: `Goal: ${goal}`,
      system,
      maxTokens: 2048,
      responseSchema: OUTPUT_CONTRACT_SCHEMA,
      invocation_key: `${this.manifest.id}:${packet.packet_id}:intent`,
    };
  }

  private buildResponsePacket(
    packet: CognitionPacket,
    intent: InferredIntent,
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
        interpreted_goal: intent.interpretedGoal,
        scope: [...intent.scope],
        constraints: [...intent.constraints],
        confidence: intent.confidence,
        model: meta.model,
        ...(meta.fallbackReason ? { fallback_reason: meta.fallbackReason } : {}),
        prepared_lease_id: this.preparedLeaseId,
      },
      evidence: [
        { kind: "intent-inference", source_packet_id: packet.packet_id, model: meta.model },
      ],
      confidence: intent.confidence,
      uncertainty_estimate: 1 - intent.confidence,
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
    intent: InferredIntent,
    model: string,
  ): ReasoningTrace {
    return {
      trace_id: packet.trace_id ?? "",
      producer_cid: this.manifest.id,
      session_id: packet.session_id ?? null,
      task_interpretation: `interpret goal "${goalOf(packet)}"`,
      strategy: "goal-interpretation",
      claims: [
        {
          claim_id: `${packet.packet_id}-claim-0`,
          statement: `interpreted as "${intent.interpretedGoal}" (scope ${intent.scope.length})`,
          confidence: intent.confidence,
        },
      ],
      decision: `produced an intent interpretation via ${model}`,
      uncertainty_estimate: 1 - intent.confidence,
      self_critique: null,
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
        reject(intentError("E_MODEL_TIMEOUT", `model call exceeded ${this.timeoutMs}ms`));
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
