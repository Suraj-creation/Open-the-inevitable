/**
 * MeaningRepresentationUnit — MRL v1 as governed cognition (CSE-003, ADR-0037; CSE M6).
 *
 * Constructs the L7 `meaning` layer: typed MeaningUnits modeling what a passage is trying to do
 * to a mind. V1 kind set (ADR-0037 decision 1): `intent`, `analogy-map`,
 * `misconception-hypothesis`, `conceptual-compression`. Same governed discipline as the M3
 * canonicalizer: a PRIVILEGED agent (it reshapes shared understanding), model-backed with a
 * deterministic fallback whose confidence lands BELOW the store's degradation floor — fallback
 * meaning is recorded as honest `source.layer.degraded`, never dressed up as full inference.
 *
 * Grounding law (CSE-003 §2/§6): meaning is INFERENCE and says so — every unit must cite
 * structural region paths that exist and/or concept ids from the input vocabulary; the parser
 * DROPS ungrounded citations, and a unit left with neither anchors nor concepts is discarded.
 * The deterministic fallback produces only compressions + intent (analogies and misconception
 * hypotheses without a model would be invention, not degradation).
 *
 * Spec: spec/source-environment/CSE-003, spec/architecture-decisions/ADR-0037.
 */
import type { ModelGenerationRequest, ModelRuntime } from "@inevitable/contracts";
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
  CognitionFrame,
  CognitiveHealth,
  CognitiveUnit,
  Emissions,
} from "@inevitable/runtime";
import { CosError, CryptoIdGenerator, newPacketId, type IdGenerator } from "@inevitable/shared";
import {
  MEANING_UNIT_KINDS,
  type MeaningLayerContent,
  type MeaningUnit,
  type MeaningUnitKind,
} from "@inevitable/source-environment";
import type { RegionInput } from "./source-canonicalizer-unit";

const SPEC_REF = "source-environment/CSE-003-meaning-representation-layer";

/** Below the store's degradation floor (0.5): deterministic meaning lands visibly degraded. */
export const FALLBACK_MEANING_CONFIDENCE = 0.45;
export const MODEL_MEANING_CONFIDENCE = 0.8;

/** The concept vocabulary the unit reasons over (L2 extraction output, or curriculum seeds). */
export interface ConceptInput {
  readonly concept_id: string;
  readonly label: string;
  readonly definition?: string;
}

export interface MeaningRepresentationUnitDeps {
  readonly manifest: AgentManifest;
  readonly model: ModelRuntime;
  readonly timeoutMs?: number;
  readonly idGenerator?: IdGenerator;
}

function meaningError(code: string, message: string, details?: Record<string, unknown>): CosError {
  return new CosError(code, message, { specRef: SPEC_REF, details });
}

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

const kebab = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// ── Output contract ────────────────────────────────────────────────────────────────────────────

const MEANING_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["units"],
  properties: {
    units: {
      type: "array",
      items: {
        type: "object",
        required: ["kind", "payload"],
        properties: {
          kind: { type: "string", enum: [...MEANING_UNIT_KINDS] },
          source_anchors: { type: "array", items: { type: "string" } },
          concept_refs: { type: "array", items: { type: "string" } },
          payload: { type: "object" },
          confidence: { type: "number" },
        },
      },
    },
  },
};

// ── Parser (grounding-validated; exported for tests) ──────────────────────────────────────────

/**
 * Parse + ground-validate the meaning layer output. Anchors not in `validPaths` and concept refs
 * not in `validConcepts` are dropped; a unit left with neither is discarded (meaning must be
 * inference OVER evidence). Throws E_MODEL_OUTPUT_MALFORMED on structural violations or when no
 * unit survives grounding.
 */
export function parseMeaningLayerOutput(
  text: string,
  validPaths: ReadonlySet<string>,
  validConcepts: ReadonlySet<string>,
  producedBy: string,
): MeaningLayerContent {
  let raw: unknown;
  try {
    raw = JSON.parse(stripFences(text));
  } catch {
    throw meaningError("E_MODEL_OUTPUT_MALFORMED", "meaning layer output is not valid JSON", {
      sample: text.slice(0, 200),
    });
  }
  const obj = raw as { units?: unknown };
  if (!Array.isArray(obj.units)) {
    throw meaningError("E_MODEL_OUTPUT_MALFORMED", "meaning layer output missing units array");
  }
  const units: MeaningUnit[] = [];
  for (const entry of obj.units) {
    const u = entry as {
      kind?: unknown;
      source_anchors?: unknown;
      concept_refs?: unknown;
      payload?: unknown;
      confidence?: unknown;
    };
    const kind = typeof u.kind === "string" ? (u.kind as MeaningUnitKind) : null;
    if (!kind || !MEANING_UNIT_KINDS.includes(kind)) continue;
    if (typeof u.payload !== "object" || u.payload === null || Array.isArray(u.payload)) continue;
    // Grounding: drop hallucinated anchors/concepts; a unit with neither is discarded entirely.
    const anchors = (Array.isArray(u.source_anchors) ? u.source_anchors : [])
      .filter((p): p is string => typeof p === "string")
      .filter((p) => validPaths.has(p));
    const conceptRefs = (Array.isArray(u.concept_refs) ? u.concept_refs : [])
      .filter((c): c is string => typeof c === "string")
      .map(kebab)
      .filter((c) => validConcepts.has(c));
    if (anchors.length === 0 && conceptRefs.length === 0) continue;
    const confidence =
      typeof u.confidence === "number" ? Math.min(1, Math.max(0, u.confidence)) : 0.7;
    units.push({
      unit_id: `mrl-${kind}-${units.length + 1}`,
      kind,
      source_anchors: anchors,
      concept_refs: conceptRefs,
      payload: u.payload as Record<string, unknown>,
      confidence,
      produced_by: producedBy,
    });
  }
  if (units.length === 0) {
    throw meaningError(
      "E_MODEL_OUTPUT_MALFORMED",
      "meaning layer output had no grounded units (all anchors/concepts invalid or empty)",
    );
  }
  return { units };
}

// ── Deterministic fallback (honest degraded meaning) ──────────────────────────────────────────

/**
 * Deterministic MRL: `conceptual-compression` per concept (truncation of the source's own
 * definition — fidelity note says exactly what was dropped) plus one `intent` unit from the
 * first heading. NO analogies or misconception hypotheses — those would be invention, and the
 * fallback's contract is degradation, never fabrication (CSE-003 §7).
 */
export function deterministicMeaningLayer(
  regions: readonly RegionInput[],
  concepts: readonly ConceptInput[],
  producedBy: string,
): MeaningLayerContent {
  const units: MeaningUnit[] = [];
  const firstHeading = regions.find((r) => r.kind === "heading");
  if (firstHeading) {
    units.push({
      unit_id: `mrl-intent-${units.length + 1}`,
      kind: "intent",
      source_anchors: [firstHeading.path],
      concept_refs: [],
      payload: {
        target: `orient the reader to ${firstHeading.text.trim().slice(0, 80)}`,
        register: "define",
      },
      confidence: FALLBACK_MEANING_CONFIDENCE,
      produced_by: producedBy,
    });
  }
  for (const concept of concepts) {
    const definition = (concept.definition ?? "").trim();
    if (!definition) continue;
    units.push({
      unit_id: `mrl-conceptual-compression-${units.length + 1}`,
      kind: "conceptual-compression",
      source_anchors: [],
      concept_refs: [concept.concept_id],
      payload: {
        text: definition.slice(0, 140),
        fidelity_notes:
          "deterministic truncation of the source's own definition — nuance beyond 140 chars dropped",
      },
      confidence: FALLBACK_MEANING_CONFIDENCE,
      produced_by: producedBy,
    });
  }
  return { units };
}

// ── The unit ───────────────────────────────────────────────────────────────────────────────────

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

function regionsOf(packet: CognitionPacket): RegionInput[] {
  const content = (packet.content ?? {}) as Record<string, unknown>;
  const raw = content["regions"];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      const r = entry as { path?: unknown; kind?: unknown; text?: unknown };
      if (typeof r.path !== "string" || typeof r.text !== "string") return null;
      return { path: r.path, kind: typeof r.kind === "string" ? r.kind : "other", text: r.text };
    })
    .filter((r): r is RegionInput => r !== null);
}

function conceptsOf(packet: CognitionPacket): ConceptInput[] {
  const content = (packet.content ?? {}) as Record<string, unknown>;
  const raw = content["concepts"];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      const c = entry as { concept_id?: unknown; label?: unknown; definition?: unknown };
      if (typeof c.concept_id !== "string" || typeof c.label !== "string") return null;
      return {
        concept_id: kebab(c.concept_id),
        label: c.label,
        ...(typeof c.definition === "string" ? { definition: c.definition } : {}),
      };
    })
    .filter((c): c is ConceptInput => c !== null);
}

export class MeaningRepresentationUnit implements CognitiveUnit {
  private readonly manifest: AgentManifest;
  private readonly model: ModelRuntime;
  private readonly timeoutMs: number;
  private readonly idGenerator: IdGenerator;
  private preparedLeaseId: string | null = null;

  constructor(deps: MeaningRepresentationUnitDeps) {
    this.manifest = deps.manifest;
    this.model = deps.model;
    this.timeoutMs = deps.timeoutMs ?? 30_000;
    this.idGenerator = deps.idGenerator ?? new CryptoIdGenerator();
  }

  describe(): UnitDescriptor {
    return descriptorFromManifest(this.manifest);
  }

  prepare(lease: ContextLease): void {
    this.preparedLeaseId = lease.lease_id;
  }

  async execute(packet: CognitionPacket): Promise<Emissions> {
    const regions = regionsOf(packet);
    const concepts = conceptsOf(packet);
    if (regions.length === 0) {
      throw meaningError("E_SOURCE_NOT_CANONICALIZED", "packet carries no structural regions", {
        packet_id: packet.packet_id,
      });
    }
    try {
      return await this.executeWithModel(packet, regions, concepts);
    } catch (cause) {
      const code = cause instanceof CosError ? cause.code : "E_MODEL_UNAVAILABLE";
      const content = deterministicMeaningLayer(regions, concepts, this.manifest.id);
      const response = this.buildResponsePacket(packet, content, {
        kind: "deterministic-meaning-layer",
        model: "deterministic",
        confidence: FALLBACK_MEANING_CONFIDENCE,
        fallbackReason: code,
      });
      return {
        packets: [response],
        trace: this.buildTrace(packet, "deterministic", FALLBACK_MEANING_CONFIDENCE),
      };
    }
  }

  private async executeWithModel(
    packet: CognitionPacket,
    regions: readonly RegionInput[],
    concepts: readonly ConceptInput[],
  ): Promise<Emissions> {
    const request = this.buildRequest(packet, regions, concepts);
    const result = await this.withTimeout(this.model.generate(request));
    if (result.finishReason === "refusal" || result.finishReason === "safety") {
      throw meaningError("E_MODEL_REFUSAL", `model refused generation (${result.finishReason})`);
    }
    if (result.finishReason === "max_tokens") {
      throw meaningError("E_MODEL_OUTPUT_TRUNCATED", "meaning output truncated at token budget");
    }
    const validPaths = new Set(regions.map((r) => r.path));
    const validConcepts = new Set(concepts.map((c) => c.concept_id));
    const content = parseMeaningLayerOutput(
      result.text,
      validPaths,
      validConcepts,
      this.manifest.id,
    );
    const response = this.buildResponsePacket(packet, content, {
      kind: "model-meaning-layer",
      model: result.model,
      confidence: MODEL_MEANING_CONFIDENCE,
    });
    return {
      packets: [response],
      trace: this.buildTrace(packet, result.model, MODEL_MEANING_CONFIDENCE),
    };
  }

  private buildRequest(
    packet: CognitionPacket,
    regions: readonly RegionInput[],
    concepts: readonly ConceptInput[],
  ): ModelGenerationRequest {
    const regionBlock = regions
      .map((r) => `[${r.path}] (${r.kind})\n${r.text}`)
      .join("\n\n")
      .slice(0, 14_000);
    const conceptBlock = concepts.map((c) => `- ${c.concept_id}: ${c.label}`).join("\n");
    const system = [
      `You are "${this.manifest.id}". ${this.manifest.role}`,
      "Model what these passages are TRYING TO DO TO A MIND — the Meaning Representation Layer.",
      "Produce units of exactly these kinds: intent, analogy-map, misconception-hypothesis,",
      "conceptual-compression. Respond with JSON only (no markdown fences) matching:",
      '{"units":[{"kind":"intent|analogy-map|misconception-hypothesis|conceptual-compression",' +
        '"source_anchors":["region paths from the input"],"concept_refs":["concept ids from the list"],' +
        '"payload":{...},"confidence":0.0}]}',
      "Payload shapes:",
      '  intent: {"target":"what the passage wants the reader to believe/do","register":"persuade|define|derive|warn"}',
      '  analogy-map: {"target_domain":"familiar system","correspondence":"source ↔ target mapping","breaks_at":"where the analogy fails"}',
      '  misconception-hypothesis: {"wrong_model":"the predictable wrong belief","diagnostic_probe":"a question exposing it","repair_route":"how to correct it"}',
      '  conceptual-compression: {"text":"shortest faithful restatement","fidelity_notes":"what the compression drops"}',
      "Rules: 2–8 units; every unit MUST cite source_anchors from the input paths and/or",
      "concept_refs from the concept list (ungrounded units are discarded); meaning is inference",
      "over THIS source, never outside knowledge presented as the source's claim.",
    ].join("\n");
    return {
      prompt: `Concepts:\n${conceptBlock || "(none extracted)"}\n\nSource regions:\n\n${regionBlock}`,
      system,
      maxTokens: 4096,
      // Structured-output call: thinking starves the visible JSON (proven live at M3/ADR-0031).
      thinkingBudget: 0,
      responseSchema: MEANING_OUTPUT_SCHEMA,
      invocation_key: `${this.manifest.id}:${packet.packet_id}:meaning-layer`,
    };
  }

  private buildResponsePacket(
    packet: CognitionPacket,
    content: MeaningLayerContent,
    meta: { kind: string; model: string; confidence: number; fallbackReason?: string },
  ): CognitionPacket {
    const conceptIds = [...new Set(content.units.flatMap((u) => [...u.concept_refs]))];
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
      concept_ids: conceptIds.length > 0 ? conceptIds : (packet.concept_ids ?? []),
      domain_ids: packet.domain_ids ?? [],
      content: {
        handled_by: this.manifest.id,
        response_kind: meta.kind,
        layer: "meaning",
        layer_content: content as unknown as Record<string, unknown>,
        confidence: meta.confidence,
        model: meta.model,
        ...(meta.fallbackReason ? { fallback_reason: meta.fallbackReason } : {}),
        prepared_lease_id: this.preparedLeaseId,
        intent_lease_id:
          ((packet.content ?? {}) as Record<string, unknown>)["intent_lease_id"] ?? null,
      },
      evidence: [
        {
          kind: "meaning-layer-construction",
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

  private buildTrace(packet: CognitionPacket, model: string, confidence: number): ReasoningTrace {
    return {
      trace_id: packet.trace_id ?? "",
      producer_cid: this.manifest.id,
      session_id: packet.session_id ?? null,
      task_interpretation: "construct the meaning representation layer (MRL v1) from L1/L2",
      strategy: "meaning-unit-inference",
      claims: [
        {
          claim_id: `${packet.packet_id}-claim-0`,
          statement: "meaning units inferred, grounding-validated against region paths + concepts",
          confidence,
        },
      ],
      decision: `produced meaning layer via ${model} (units grounded or discarded)`,
      uncertainty_estimate: 1 - confidence,
      self_critique: null,
      determinism_level: model === "deterministic" ? "D2" : "D3",
    };
  }

  private async withTimeout<T>(work: Promise<T>): Promise<T> {
    const timers = globalThis as {
      setTimeout?: (fn: () => void, ms: number) => unknown;
      clearTimeout?: (handle: unknown) => void;
    };
    if (!timers.setTimeout) return work;
    let handle: unknown;
    const timeout = new Promise<never>((_, reject) => {
      handle = timers.setTimeout!(() => {
        reject(meaningError("E_MODEL_TIMEOUT", `model call exceeded ${this.timeoutMs}ms`));
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
