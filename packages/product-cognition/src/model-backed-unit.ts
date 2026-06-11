/**
 * ModelBackedUnit — Phase 2B real cognition through the governed dispatch path.
 *
 * A CognitiveUnit that produces model-generated content via an injected `ModelRuntime`
 * (interface-only dependency on @inevitable/contracts; provider SDKs live in packages/adapters).
 * It implements the same ABI as DeterministicMvpUnit, so it slots into ProductRuntimeDispatcher
 * unchanged: governance gate, scheduler admission, and OTel span all apply — there is no
 * separate "model path".
 *
 * Spec: spec/product/product-cognition-runtime.md §11 (Model-Backed Unit Contract),
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
import type { WorldStateGraph } from "@inevitable/world-state";

const SPEC_REF = "protocols/model-invocation-protocol";

export type ModelBackedRole = "explanation" | "practice" | "assessment";

export interface ModelBackedUnitDeps {
  readonly manifest: AgentManifest;
  readonly model: ModelRuntime;
  readonly role: ModelBackedRole;
  /** Deterministic fallback unit executed on any typed model failure (degradation stays visible). */
  readonly fallback?: CognitiveUnit;
  /** Optional world-state for concept-title enrichment of the prompt. */
  readonly world?: WorldStateGraph;
  readonly timeoutMs?: number;
  readonly idGenerator?: IdGenerator;
}

/** The JSON shape the model must return (PCR-001 §11 output contract). */
export interface ModelLayeredOutput {
  readonly layers: { readonly layer_0: string; readonly layer_1?: string };
  readonly summary: string;
  readonly confidence: number;
  readonly reasoning?: string;
}

const ROLE_INSTRUCTION: Record<ModelBackedRole, string> = {
  explanation:
    "Explain the concept so the learner genuinely understands it. Lead with intuition and story.",
  practice:
    "Generate one concrete practice task for the concept, with the expected approach. Lead with an intuitive framing of why this practice matters.",
  assessment:
    "Produce one mastery-probing question for the concept and describe what a passing answer demonstrates. Lead with the intuition being verified.",
};

const OUTPUT_CONTRACT_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["layers", "summary", "confidence"],
  properties: {
    layers: {
      type: "object",
      required: ["layer_0"],
      properties: { layer_0: { type: "string" }, layer_1: { type: "string" } },
    },
    summary: { type: "string" },
    confidence: { type: "number" },
    reasoning: { type: "string" },
  },
};

function modelError(code: string, message: string, details?: Record<string, unknown>): CosError {
  return new CosError(code, message, { specRef: SPEC_REF, details });
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** Strip optional markdown fences and parse/validate the layered output contract. */
export function parseModelLayeredOutput(text: string): ModelLayeredOutput {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    throw modelError("E_MODEL_OUTPUT_MALFORMED", "model output is not valid JSON", {
      sample: trimmed.slice(0, 200),
    });
  }
  const candidate = raw as Partial<ModelLayeredOutput> & { layers?: { layer_0?: unknown } };
  const layer0 = candidate.layers?.layer_0;
  if (typeof layer0 !== "string" || layer0.trim().length === 0) {
    throw modelError("E_MODEL_OUTPUT_MALFORMED", "model output is missing layers.layer_0");
  }
  if (typeof candidate.summary !== "string" || candidate.summary.trim().length === 0) {
    throw modelError("E_MODEL_OUTPUT_MALFORMED", "model output is missing summary");
  }
  const layer1 = candidate.layers && (candidate.layers as { layer_1?: unknown }).layer_1;
  return {
    layers: {
      layer_0: layer0,
      ...(typeof layer1 === "string" && layer1.trim().length > 0 ? { layer_1: layer1 } : {}),
    },
    summary: candidate.summary,
    confidence: clamp01(typeof candidate.confidence === "number" ? candidate.confidence : 0.5),
    ...(typeof candidate.reasoning === "string" ? { reasoning: candidate.reasoning } : {}),
  };
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

export class ModelBackedUnit implements CognitiveUnit {
  private readonly manifest: AgentManifest;
  private readonly model: ModelRuntime;
  private readonly role: ModelBackedRole;
  private readonly fallback: CognitiveUnit | undefined;
  private readonly world: WorldStateGraph | undefined;
  private readonly timeoutMs: number;
  private readonly idGenerator: IdGenerator;
  private preparedLeaseId: string | null = null;

  constructor(deps: ModelBackedUnitDeps) {
    this.manifest = deps.manifest;
    this.model = deps.model;
    this.role = deps.role;
    this.fallback = deps.fallback;
    this.world = deps.world;
    this.timeoutMs = deps.timeoutMs ?? 20_000;
    this.idGenerator = deps.idGenerator ?? new CryptoIdGenerator();
  }

  describe(): UnitDescriptor {
    return descriptorFromManifest(this.manifest);
  }

  prepare(lease: ContextLease): void {
    this.preparedLeaseId = lease.lease_id;
    this.fallback?.prepare(lease);
  }

  async execute(packet: CognitionPacket): Promise<Emissions> {
    try {
      return await this.executeWithModel(packet);
    } catch (cause) {
      const code = cause instanceof CosError ? cause.code : "E_MODEL_UNAVAILABLE";
      if (!this.fallback) throw cause;
      const emissions = await this.fallback.execute(packet);
      const packets = (emissions.packets ?? []).map((response) => ({
        ...response,
        content: {
          ...response.content,
          response_kind: "deterministic-fallback",
          fallback_reason: code,
        },
        confidence: Math.min(0.5, response.confidence ?? 0.5),
      }));
      return { ...emissions, packets };
    }
  }

  private async executeWithModel(packet: CognitionPacket): Promise<Emissions> {
    const request = this.buildRequest(packet);
    const result = await this.withTimeout(this.model.generate(request));
    if (result.finishReason === "refusal" || result.finishReason === "safety") {
      throw modelError("E_MODEL_REFUSAL", `model refused generation (${result.finishReason})`, {
        invocation_key: request.invocation_key,
      });
    }
    const parsed = parseModelLayeredOutput(result.text);
    const response = this.buildResponsePacket(packet, parsed, result);
    const trace = this.buildTrace(packet, parsed, result);
    return { packets: [response], trace };
  }

  private buildRequest(packet: CognitionPacket): ModelGenerationRequest {
    const conceptIds = packet.concept_ids ?? [];
    const conceptLines = conceptIds.map((id) => {
      const node = this.world?.getNode(`concept:${id}`) ?? this.world?.getNode(id);
      const title = node && typeof node.props["title"] === "string" ? node.props["title"] : id;
      return `- ${id}: ${title}`;
    });
    const content = (packet.content ?? {}) as Record<string, unknown>;
    const requestedLayer = typeof content["layer"] === "number" ? content["layer"] : 0;

    const system = [
      `You are "${this.manifest.id}". ${this.manifest.role}`,
      ROLE_INSTRUCTION[this.role],
      `Respond with JSON only (no markdown fences) matching:`,
      `{"layers":{"layer_0":"<Story/Intuition — mandatory, leads>","layer_1":"<Visual Understanding — described diagram/mental model>"},"summary":"<one-sentence essence>","confidence":<0..1>,"reasoning":"<why this explanation fits>"}`,
      requestedLayer >= 1
        ? "The learner asked to go deeper: layer_1 (Visual Understanding) is required."
        : "Include layer_1 when a visual mental model genuinely helps.",
    ].join("\n");

    const prompt = [
      `Intent: ${packet.intent ?? "learn"}`,
      conceptLines.length > 0 ? `Concepts:\n${conceptLines.join("\n")}` : "Concepts: (none given)",
      `Requested layer: ${requestedLayer}`,
    ].join("\n");

    return {
      prompt,
      system,
      maxTokens: 1024,
      responseSchema: OUTPUT_CONTRACT_SCHEMA,
      invocation_key: `${this.manifest.id}:${packet.packet_id}:${this.role}`,
    };
  }

  private buildResponsePacket(
    packet: CognitionPacket,
    parsed: ModelLayeredOutput,
    result: ModelGenerationResult,
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
        intent: packet.intent ?? null,
        concepts: packet.concept_ids ?? [],
        response_kind: "model-cognition",
        layers: parsed.layers,
        summary: parsed.summary,
        model: result.model,
        prepared_lease_id: this.preparedLeaseId,
      },
      evidence: [
        {
          kind: "model-generation",
          source_packet_id: packet.packet_id,
          model: result.model,
        },
      ],
      confidence: parsed.confidence,
      uncertainty_estimate: 1 - parsed.confidence,
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
    parsed: ModelLayeredOutput,
    result: ModelGenerationResult,
  ): ReasoningTrace {
    return {
      trace_id: packet.trace_id ?? "",
      producer_cid: this.manifest.id,
      session_id: packet.session_id ?? null,
      task_interpretation: `${this.role} for intent "${packet.intent ?? "learn"}"`,
      strategy: "retrieval-grounded",
      claims: [
        {
          claim_id: `${packet.packet_id}-claim-0`,
          statement: parsed.summary,
          confidence: parsed.confidence,
        },
      ],
      decision: `produced ${this.role} content via ${result.model}`,
      uncertainty_estimate: 1 - parsed.confidence,
      self_critique: parsed.reasoning ?? null,
      determinism_level: "D3",
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
        reject(modelError("E_MODEL_TIMEOUT", `model call exceeded ${this.timeoutMs}ms`));
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
