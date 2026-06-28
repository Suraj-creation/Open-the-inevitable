/**
 * ResearchUnit — Post-mastery research frontier agent (F10, ADR-0026).
 *
 * Activates when a learner has verified mastery at the research-readiness threshold (S3.1).
 * Maps the active frontier, an open gap, a seed hypothesis, and a source note for the mastered
 * concept. Same CognitiveUnit ABI as CurriculumUnit: governed dispatch, D3 recording, OTel
 * span, deterministic fallback for offline / NullModelRuntime paths.
 *
 * Spec: spec/product/features/F10-research-innovation-acceleration.md,
 *       spec/architecture-decisions/ADR-0026-research-mode-and-readiness-gating.md.
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

const SPEC_REF = "spec/architecture-decisions/ADR-0026-research-mode-and-readiness-gating";

export interface ResearchOutput {
  readonly frontier: string;
  readonly gap: string;
  readonly hypothesis_seed: string;
  readonly source_note: string;
}

export interface ResearchUnitDeps {
  readonly manifest: AgentManifest;
  readonly model: ModelRuntime;
  readonly timeoutMs?: number;
  readonly idGenerator?: IdGenerator;
}

const OUTPUT_CONTRACT_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["frontier", "gap", "hypothesis_seed", "source_note"],
  properties: {
    frontier: { type: "string" },
    gap: { type: "string" },
    hypothesis_seed: { type: "string" },
    source_note: { type: "string" },
  },
};

function researchError(code: string, message: string, details?: Record<string, unknown>): CosError {
  return new CosError(code, message, { specRef: SPEC_REF, details });
}

/** Deterministic frontier scaffold for offline / NullModelRuntime runs. */
export function deterministicResearch(conceptTitle: string, domain: string): ResearchOutput {
  const d = domain || "this field";
  return {
    frontier: `Researchers in ${d} are actively extending ${conceptTitle} to handle edge cases, scale to larger systems, and bridge to adjacent domains.`,
    gap: `A key open problem is how to generalise the core principles of ${conceptTitle} beyond the conditions assumed in classical treatments.`,
    hypothesis_seed: `Could the constraints that define ${conceptTitle} be relaxed without losing its essential properties?`,
    source_note: `Survey recent literature in ${d} for open problems sections and workshop proceedings.`,
  };
}

function conceptTitleOf(packet: CognitionPacket): string {
  const c = (packet.content ?? {}) as Record<string, unknown>;
  if (typeof c["concept_title"] === "string" && c["concept_title"].trim())
    return c["concept_title"];
  return packet.intent ?? "the concept";
}

function domainOf(packet: CognitionPacket): string {
  const c = (packet.content ?? {}) as Record<string, unknown>;
  if (typeof c["domain"] === "string" && c["domain"].trim()) return c["domain"];
  return "";
}

/** Parse + validate the research output contract. Throws E_MODEL_OUTPUT_MALFORMED on bad shape. */
export function parseResearchOutput(text: string): ResearchOutput {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    throw researchError(
      "E_MODEL_OUTPUT_MALFORMED",
      "E_MODEL_OUTPUT_MALFORMED: research output is not valid JSON",
      {
        sample: trimmed.slice(0, 200),
      },
    );
  }
  const obj = raw as Record<string, unknown>;
  const frontier = typeof obj["frontier"] === "string" ? obj["frontier"].trim() : "";
  const gap = typeof obj["gap"] === "string" ? obj["gap"].trim() : "";
  const hypothesis_seed =
    typeof obj["hypothesis_seed"] === "string" ? obj["hypothesis_seed"].trim() : "";
  const source_note = typeof obj["source_note"] === "string" ? obj["source_note"].trim() : "";
  if (!frontier || !gap || !hypothesis_seed || !source_note) {
    throw researchError(
      "E_MODEL_OUTPUT_MALFORMED",
      "E_MODEL_OUTPUT_MALFORMED: research output is missing one or more required fields",
      {
        frontier: !!frontier,
        gap: !!gap,
        hypothesis_seed: !!hypothesis_seed,
        source_note: !!source_note,
      },
    );
  }
  return { frontier, gap, hypothesis_seed, source_note };
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

function buildResponsePacket(
  packet: CognitionPacket,
  research: ResearchOutput,
  meta: { kind: string; model: string; confidence: number; fallbackReason?: string },
  manifest: AgentManifest,
  idGenerator: IdGenerator,
  preparedLeaseId: string | null,
): CognitionPacket {
  return {
    packet_id: newPacketId(idGenerator),
    schema_version: packet.schema_version,
    source_cid: packet.target_cid ?? manifest.id,
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
      handled_by: manifest.id,
      response_kind: meta.kind,
      frontier: research.frontier,
      gap: research.gap,
      hypothesis_seed: research.hypothesis_seed,
      source_note: research.source_note,
      model: meta.model,
      ...(meta.fallbackReason ? { fallback_reason: meta.fallbackReason } : {}),
      prepared_lease_id: preparedLeaseId,
    },
    evidence: [
      {
        kind: "research-frontier-generation",
        source_packet_id: packet.packet_id,
        model: meta.model,
      },
    ],
    confidence: meta.confidence,
    uncertainty_estimate: 1 - meta.confidence,
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

function buildTrace(
  packet: CognitionPacket,
  research: ResearchOutput,
  model: string,
  manifest: AgentManifest,
): ReasoningTrace {
  return {
    trace_id: packet.trace_id ?? "",
    producer_cid: manifest.id,
    session_id: packet.session_id ?? null,
    task_interpretation: `research frontier for concept "${conceptTitleOf(packet)}"`,
    strategy: "frontier-mapping",
    claims: [
      {
        claim_id: `${packet.packet_id}-claim-0`,
        statement: research.frontier.slice(0, 80),
        confidence: model === "deterministic" ? 0.5 : 0.8,
      },
    ],
    decision: `produced a research frontier via ${model}`,
    uncertainty_estimate: model === "deterministic" ? 0.5 : 0.2,
    self_critique: null,
    determinism_level: model === "deterministic" ? "D2" : "D3",
  };
}

export class ResearchUnit implements CognitiveUnit {
  private readonly manifest: AgentManifest;
  private readonly model: ModelRuntime;
  private readonly timeoutMs: number;
  private readonly idGenerator: IdGenerator;
  private preparedLeaseId: string | null = null;

  constructor(deps: ResearchUnitDeps) {
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
      return await this.executeWithModel(packet);
    } catch (cause) {
      const code = cause instanceof CosError ? cause.code : "E_MODEL_UNAVAILABLE";
      const conceptTitle = conceptTitleOf(packet);
      const domain = domainOf(packet);
      const research = deterministicResearch(conceptTitle, domain);
      const response = buildResponsePacket(
        packet,
        research,
        {
          kind: "deterministic-research",
          model: "deterministic",
          confidence: 0.5,
          fallbackReason: code,
        },
        this.manifest,
        this.idGenerator,
        this.preparedLeaseId,
      );
      return {
        packets: [response],
        trace: buildTrace(packet, research, "deterministic", this.manifest),
      };
    }
  }

  private async executeWithModel(packet: CognitionPacket): Promise<Emissions> {
    const request = this.buildRequest(packet);
    const result = await this.withTimeout(this.model.generate(request));
    if (result.finishReason === "refusal" || result.finishReason === "safety") {
      throw researchError("E_MODEL_REFUSAL", `model refused generation (${result.finishReason})`, {
        invocation_key: request.invocation_key,
      });
    }
    const research = parseResearchOutput(result.text);
    const response = buildResponsePacket(
      packet,
      research,
      { kind: "model-research", model: result.model, confidence: 0.8 },
      this.manifest,
      this.idGenerator,
      this.preparedLeaseId,
    );
    return {
      packets: [response],
      trace: buildTrace(packet, research, result.model, this.manifest),
    };
  }

  private buildRequest(packet: CognitionPacket): ModelGenerationRequest {
    const conceptTitle = conceptTitleOf(packet);
    const domain = domainOf(packet);
    const content = (packet.content ?? {}) as Record<string, unknown>;
    const context =
      typeof content["context"] === "string"
        ? content["context"]
        : `the learner just mastered ${conceptTitle}`;
    const system = [
      `You are "${this.manifest.id}". ${this.manifest.role}`,
      `Context: ${context}`,
      "For the given concept, identify:",
      "1. A specific active research frontier (what researchers are actively working on now).",
      "2. A concrete open gap or unsolved problem in this area.",
      "3. A seed hypothesis a curious student could explore (start with 'What if...' or 'Could...').",
      "4. A brief source note (where to look, e.g. 'Survey recent literature in [domain] for open problems sections').",
      "Respond with JSON only (no markdown fences) matching:",
      '{"frontier":"...","gap":"...","hypothesis_seed":"...","source_note":"..."}',
      "Rules: frontier 1–2 sentences; gap 1–2 sentences; hypothesis_seed 1 sentence; source_note ≤ 30 words.",
      ...(domain ? [`Domain: ${domain}`] : []),
    ].join("\n");
    return {
      prompt: `Concept: ${conceptTitle}`,
      system,
      maxTokens: 512,
      responseSchema: OUTPUT_CONTRACT_SCHEMA,
      invocation_key: `${this.manifest.id}:${packet.packet_id}:research`,
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
        reject(researchError("E_MODEL_TIMEOUT", `model call exceeded ${this.timeoutMs}ms`));
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
