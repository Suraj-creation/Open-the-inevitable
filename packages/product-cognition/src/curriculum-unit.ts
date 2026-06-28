/**
 * CurriculumUnit — Phase 2D curriculum generation through the governed dispatch path.
 *
 * Turns a learner *goal* into a prerequisite-ordered concept DAG so the living timeline is
 * generated, not seeded. It is the F02/F03 curriculum agent: a privileged agent (GOV-P01 trust
 * gate), it implements the same `CognitiveUnit` ABI as `ModelBackedUnit`, so the governance gate,
 * scheduler admission, OTel span, and D3 recording all apply unchanged. Model-backed with an inline
 * deterministic scaffold fallback, so offline/seeded runs still yield a real, deterministic timeline.
 *
 * Spec: spec/product/product-cognition-runtime.md §12 (Curriculum Generation Contract),
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

const SPEC_REF = "protocols/model-invocation-protocol";

export interface CurriculumConcept {
  readonly id: string;
  readonly title: string;
  readonly prerequisites: readonly string[];
  /** Natural depth layer 0–6 (0=intuition … 6=research). Seeded into the KG for adaptive prompting. */
  readonly layer?: number;
  /** Domain label (e.g. "mathematics", "machine-learning"). Seeded into the KG as graph context. */
  readonly domain?: string;
}

/** A typed cross-concept edge beyond the prerequisite spine (SRF-003, S2.4). */
export interface CurriculumEdge {
  readonly from: string;
  readonly to: string;
  /** depends_on | applies_to | research_adjacent | bridges_to | frontier_of */
  readonly type: string;
}

export interface GeneratedCurriculum {
  readonly concepts: readonly CurriculumConcept[];
  readonly focusConceptId: string;
  readonly explanationPrompt?: string;
  readonly practicePrompt?: string;
  /** Optional informational edges that enrich the cognitive graph beyond the prerequisite spine. */
  readonly edges?: readonly CurriculumEdge[];
}

export interface CurriculumUnitDeps {
  readonly manifest: AgentManifest;
  readonly model: ModelRuntime;
  readonly timeoutMs?: number;
  readonly idGenerator?: IdGenerator;
}

const OUTPUT_CONTRACT_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["concepts", "focus_concept_id"],
  properties: {
    concepts: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "title"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          prerequisites: { type: "array", items: { type: "string" } },
          layer: { type: "number" },
          domain: { type: "string" },
        },
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        required: ["from", "to", "type"],
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          type: { type: "string" },
        },
      },
    },
    focus_concept_id: { type: "string" },
    explanation_prompt: { type: "string" },
    practice_prompt: { type: "string" },
  },
};

function curriculumError(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): CosError {
  return new CosError(code, message, { specRef: SPEC_REF, details });
}

/** kebab-case slug for deterministic concept ids; never empty. */
export function curriculumSlug(goal: string): string {
  const slug = goal
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "topic";
}

/** A deterministic, acyclic 3-node scaffold derived from the goal (the fallback curriculum). */
export function deterministicCurriculum(goal: string): GeneratedCurriculum {
  const slug = curriculumSlug(goal);
  const topic = goal.trim() || "the topic";
  return {
    concepts: [
      { id: `foundations-of-${slug}`, title: `Foundations of ${topic}`, prerequisites: [] },
      {
        id: `core-of-${slug}`,
        title: `Core of ${topic}`,
        prerequisites: [`foundations-of-${slug}`],
      },
      { id: `applying-${slug}`, title: `Applying ${topic}`, prerequisites: [`core-of-${slug}`] },
    ],
    focusConceptId: `foundations-of-${slug}`,
  };
}

/** Parse + validate the curriculum output contract. Throws E_MODEL_OUTPUT_MALFORMED on bad shape. */
export function parseCurriculumOutput(text: string): GeneratedCurriculum {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    throw curriculumError("E_MODEL_OUTPUT_MALFORMED", "curriculum output is not valid JSON", {
      sample: trimmed.slice(0, 200),
    });
  }
  const obj = raw as {
    concepts?: unknown;
    edges?: unknown;
    focus_concept_id?: unknown;
    explanation_prompt?: unknown;
    practice_prompt?: unknown;
  };
  if (!Array.isArray(obj.concepts) || obj.concepts.length === 0) {
    throw curriculumError(
      "E_MODEL_OUTPUT_MALFORMED",
      "curriculum output is missing a non-empty concepts array",
    );
  }
  const seen = new Set<string>();
  const concepts: CurriculumConcept[] = [];
  for (const entry of obj.concepts) {
    const candidate = entry as {
      id?: unknown;
      title?: unknown;
      prerequisites?: unknown;
      layer?: unknown;
      domain?: unknown;
    };
    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    const prerequisites = Array.isArray(candidate.prerequisites)
      ? candidate.prerequisites.filter((p): p is string => typeof p === "string")
      : [];
    const layer =
      typeof candidate.layer === "number"
        ? Math.min(6, Math.max(0, Math.round(candidate.layer)))
        : undefined;
    const domain =
      typeof candidate.domain === "string" && candidate.domain.trim()
        ? candidate.domain.trim()
        : undefined;
    concepts.push({
      id,
      title,
      prerequisites,
      ...(layer !== undefined ? { layer } : {}),
      ...(domain ? { domain } : {}),
    });
  }
  if (concepts.length === 0) {
    throw curriculumError("E_MODEL_OUTPUT_MALFORMED", "curriculum output had no valid concepts");
  }
  const ids = new Set(concepts.map((c) => c.id));
  // Drop prerequisites referencing unknown ids or self (the model may hallucinate a ref).
  const cleaned = concepts.map((c) => ({
    ...c,
    prerequisites: c.prerequisites.filter((p) => ids.has(p) && p !== c.id),
  }));
  // Parse typed cross-concept edges (S2.4); drop unknown types or refs to unknown concept ids.
  const VALID_EDGE_TYPES = new Set([
    "depends_on",
    "applies_to",
    "research_adjacent",
    "bridges_to",
    "frontier_of",
  ]);
  const edges: CurriculumEdge[] = [];
  if (Array.isArray(obj.edges)) {
    for (const entry of obj.edges) {
      const e = entry as { from?: unknown; to?: unknown; type?: unknown };
      const from = typeof e.from === "string" ? e.from.trim() : "";
      const to = typeof e.to === "string" ? e.to.trim() : "";
      const type = typeof e.type === "string" ? e.type.trim() : "";
      if (!from || !to || !type || !ids.has(from) || !ids.has(to) || !VALID_EDGE_TYPES.has(type))
        continue;
      edges.push({ from, to, type });
    }
  }
  let focus = typeof obj.focus_concept_id === "string" ? obj.focus_concept_id.trim() : "";
  if (!ids.has(focus)) {
    const root = cleaned.find((c) => c.prerequisites.length === 0);
    focus = (root ?? cleaned[0]!).id;
  }
  return {
    concepts: cleaned,
    focusConceptId: focus,
    ...(edges.length > 0 ? { edges } : {}),
    ...(typeof obj.explanation_prompt === "string" && obj.explanation_prompt.trim()
      ? { explanationPrompt: obj.explanation_prompt }
      : {}),
    ...(typeof obj.practice_prompt === "string" && obj.practice_prompt.trim()
      ? { practicePrompt: obj.practice_prompt }
      : {}),
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

function goalOf(packet: CognitionPacket): string {
  const content = (packet.content ?? {}) as Record<string, unknown>;
  if (typeof content["goal"] === "string" && content["goal"].trim()) return content["goal"];
  return packet.intent ?? "the topic";
}

export class CurriculumUnit implements CognitiveUnit {
  private readonly manifest: AgentManifest;
  private readonly model: ModelRuntime;
  private readonly timeoutMs: number;
  private readonly idGenerator: IdGenerator;
  private preparedLeaseId: string | null = null;

  constructor(deps: CurriculumUnitDeps) {
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
      // Deterministic scaffold — degradation is visible, never silent.
      const curriculum = deterministicCurriculum(goalOf(packet));
      const response = this.buildResponsePacket(packet, curriculum, {
        kind: "deterministic-curriculum",
        model: "deterministic",
        confidence: 0.5,
        fallbackReason: code,
      });
      return { packets: [response], trace: this.buildTrace(packet, curriculum, "deterministic") };
    }
  }

  private async executeWithModel(packet: CognitionPacket): Promise<Emissions> {
    const request = this.buildRequest(packet);
    const result = await this.withTimeout(this.model.generate(request));
    if (result.finishReason === "refusal" || result.finishReason === "safety") {
      throw curriculumError(
        "E_MODEL_REFUSAL",
        `model refused generation (${result.finishReason})`,
        {
          invocation_key: request.invocation_key,
        },
      );
    }
    const curriculum = parseCurriculumOutput(result.text);
    const response = this.buildResponsePacket(packet, curriculum, {
      kind: "model-curriculum",
      model: result.model,
      confidence: 0.85,
    });
    return { packets: [response], trace: this.buildTrace(packet, curriculum, result.model) };
  }

  private buildRequest(packet: CognitionPacket): ModelGenerationRequest {
    const goal = goalOf(packet);
    const system = [
      `You are "${this.manifest.id}". ${this.manifest.role}`,
      "Decompose the learner's goal into a prerequisite-ordered concept DAG: the minimal set of",
      "concepts that, learned in dependency order, take a motivated beginner to the goal.",
      "Respond with JSON only (no markdown fences) matching:",
      `{"concepts":[{"id":"kebab-case-id","title":"Human Title","prerequisites":["other-id"],"layer":2,"domain":"mathematics"}],"edges":[{"from":"concept-a","to":"concept-b","type":"applies_to"}],"focus_concept_id":"first-foundational-id","explanation_prompt":"<for the focus concept>","practice_prompt":"<one practice task>"}`,
      "Rules: 5–8 concepts; ids are unique kebab-case; every prerequisite is another concept's id;",
      "the graph is acyclic; order foundational concepts first; focus_concept_id has no prerequisites.",
      "layer: 0=intuition, 1=visual, 2=conceptual, 3=mathematical, 4=applied, 5=advanced, 6=research.",
      'domain: e.g. "mathematics", "physics", "biology", "machine-learning", "programming".',
      "edges: optional informational links beyond prerequisites (depends_on | applies_to | research_adjacent | bridges_to | frontier_of).",
    ].join("\n");
    return {
      prompt: `Goal: ${goal}`,
      system,
      // A 5–8 concept DAG plus a reasoning model's "thinking" tokens overruns a small budget and
      // truncates the JSON (finishReason: max_tokens) — give the structured output room to complete.
      maxTokens: 4096,
      responseSchema: OUTPUT_CONTRACT_SCHEMA,
      invocation_key: `${this.manifest.id}:${packet.packet_id}:curriculum`,
    };
  }

  private buildResponsePacket(
    packet: CognitionPacket,
    curriculum: GeneratedCurriculum,
    meta: { kind: string; model: string; confidence: number; fallbackReason?: string },
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
      concept_ids: curriculum.concepts.map((c) => c.id),
      domain_ids: packet.domain_ids ?? [],
      content: {
        handled_by: this.manifest.id,
        response_kind: meta.kind,
        concepts: curriculum.concepts.map((c) => ({
          id: c.id,
          title: c.title,
          prerequisites: c.prerequisites,
          ...(c.layer !== undefined ? { layer: c.layer } : {}),
          ...(c.domain ? { domain: c.domain } : {}),
        })),
        ...(curriculum.edges?.length ? { edges: curriculum.edges } : {}),
        focus_concept_id: curriculum.focusConceptId,
        ...(curriculum.explanationPrompt
          ? { explanation_prompt: curriculum.explanationPrompt }
          : {}),
        ...(curriculum.practicePrompt ? { practice_prompt: curriculum.practicePrompt } : {}),
        model: meta.model,
        ...(meta.fallbackReason ? { fallback_reason: meta.fallbackReason } : {}),
        prepared_lease_id: this.preparedLeaseId,
      },
      evidence: [
        { kind: "curriculum-generation", source_packet_id: packet.packet_id, model: meta.model },
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

  private buildTrace(
    packet: CognitionPacket,
    curriculum: GeneratedCurriculum,
    model: string,
  ): ReasoningTrace {
    return {
      trace_id: packet.trace_id ?? "",
      producer_cid: this.manifest.id,
      session_id: packet.session_id ?? null,
      task_interpretation: `curriculum for goal "${goalOf(packet)}"`,
      strategy: "prerequisite-decomposition",
      claims: [
        {
          claim_id: `${packet.packet_id}-claim-0`,
          statement: `${curriculum.concepts.length} concepts; focus ${curriculum.focusConceptId}`,
          confidence: model === "deterministic" ? 0.5 : 0.85,
        },
      ],
      decision: `produced a ${curriculum.concepts.length}-concept curriculum via ${model}`,
      uncertainty_estimate: model === "deterministic" ? 0.5 : 0.15,
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
        reject(curriculumError("E_MODEL_TIMEOUT", `model call exceeded ${this.timeoutMs}ms`));
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
