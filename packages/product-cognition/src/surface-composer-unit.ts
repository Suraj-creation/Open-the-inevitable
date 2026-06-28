/**
 * SurfaceComposerUnit — the Surface Composer agent (UCS, ADR-0030).
 *
 * Distills teaching content into THREE coherent artifacts in one reasoning pass:
 *  1. the Minimal Complete Cognitive Representation (MCCR) — distilled visual anchors shown on the
 *     board (core concept, definition, key formula, diagram, relationship, mental model, table,
 *     key example, memory cue);
 *  2. a SEPARATE paced narration script — the spoken teaching (intuition, analogy, story), whose
 *     segments target MCCR anchors via `anchor_ref`;
 *  3. an image decision — whether an illustration helps, and the prompt to generate it.
 *
 * The board becomes visual memory; the voice becomes the teacher. One model call keeps the shown
 * and the spoken coherent (no divergence). Implements the same `CognitiveUnit` ABI as
 * `ModelBackedUnit`, so the governance gate, scheduler admission, OTel span, and D3 recording all
 * apply unchanged. Model-backed with a deterministic world-state fallback so offline/seeded runs
 * still yield a real, deterministic frame.
 *
 * Spec: spec/surface/cognitive-surface-runtime.md §4.7–§4.8; ADR-0030; model-invocation-protocol.
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

// ---------------------------------------------------------------------------
// Output contract (plain shapes — the surface package folds these into a CognitiveFrame)
// ---------------------------------------------------------------------------

/** The canonical reveal order of MCCR slots (deterministic). */
const SLOT_ORDER = [
  "core_concept",
  "definition",
  "key_formula",
  "diagram",
  "relationship",
  "mental_model",
  "table",
  "key_example",
  "memory_cue",
] as const;

type ComposerSlot = (typeof SLOT_ORDER)[number];

/** An MCCR element in the shape the surface fold (`readMccr`) expects. */
export interface ComposerElement {
  readonly element_id: string;
  readonly type: ComposerSlot;
  readonly slot: string;
  readonly reveal_order: number;
  readonly concept_id: string | null;
  readonly content: Record<string, unknown>;
}

export interface ComposerNarrationSegment {
  readonly text: string;
  readonly anchor_ref: ComposerSlot | null;
  readonly intent: "introduce" | "build" | "illustrate" | "connect" | "check" | "reinforce";
  readonly pause_after: boolean;
}

export interface ComposerImagePlan {
  readonly helps: boolean;
  readonly modality: "image" | "none";
  readonly prompt: string | null;
  readonly rationale: string;
}

export interface ComposerOutput {
  /** Keyed by slot name; only the slots the composer chose to fill are present (others null). */
  readonly mccr: Partial<Record<ComposerSlot, ComposerElement>>;
  readonly narration_script: { readonly segments: readonly ComposerNarrationSegment[] };
  readonly image_plan: ComposerImagePlan;
}

export interface SurfaceComposerUnitDeps {
  readonly manifest: AgentManifest;
  readonly model: ModelRuntime;
  readonly timeoutMs?: number;
  readonly idGenerator?: IdGenerator;
  /** Live depth bias (P5.2): >0 favors deeper/formal anchors, <0 favors intuition. */
  readonly getDepthBias?: () => number;
}

const TEXT_SLOTS: ReadonlySet<string> = new Set([
  "core_concept",
  "definition",
  "mental_model",
  "key_example",
  "memory_cue",
]);

const VALID_INTENTS: ReadonlySet<string> = new Set([
  "introduce",
  "build",
  "illustrate",
  "connect",
  "check",
  "reinforce",
]);

const OUTPUT_CONTRACT_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["mccr", "narration_script"],
  properties: {
    mccr: {
      type: "object",
      properties: {
        core_concept: { type: "string" },
        definition: { type: "string" },
        mental_model: { type: "string" },
        key_example: { type: "string" },
        memory_cue: { type: "string" },
        key_formula: {
          type: "object",
          properties: { latex: { type: "string" }, plain: { type: "string" } },
        },
        relationship: {
          type: "object",
          properties: {
            from: { type: "string" },
            to: { type: "string" },
            relation: { type: "string" },
            text: { type: "string" },
          },
        },
        diagram: {
          type: "object",
          properties: {
            kind: { type: "string" },
            nodes: { type: "array", items: { type: "object" } },
            edges: { type: "array", items: { type: "object" } },
          },
        },
        table: {
          type: "object",
          properties: {
            headers: { type: "array", items: { type: "string" } },
            rows: { type: "array", items: { type: "array", items: { type: "string" } } },
          },
        },
      },
    },
    narration_script: {
      type: "object",
      required: ["segments"],
      properties: {
        segments: {
          type: "array",
          items: {
            type: "object",
            required: ["text"],
            properties: {
              text: { type: "string" },
              anchor_ref: { type: "string" },
              intent: { type: "string" },
              pause_after: { type: "boolean" },
            },
          },
        },
      },
    },
    image_plan: {
      type: "object",
      properties: {
        helps: { type: "boolean" },
        prompt: { type: "string" },
        rationale: { type: "string" },
      },
    },
  },
};

function composerError(code: string, message: string, details?: Record<string, unknown>): CosError {
  return new CosError(code, message, { specRef: SPEC_REF, details });
}

function conceptIdOf(packet: CognitionPacket): string {
  const content = (packet.content ?? {}) as Record<string, unknown>;
  if (typeof content["concept_id"] === "string" && content["concept_id"].trim()) {
    return content["concept_id"];
  }
  return packet.concept_ids?.[0] ?? "concept";
}

function conceptTitleOf(packet: CognitionPacket): string {
  const content = (packet.content ?? {}) as Record<string, unknown>;
  for (const key of ["concept_title", "title", "goal"]) {
    const v = content[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return packet.intent ?? "the concept";
}

function goalOf(packet: CognitionPacket): string {
  const content = (packet.content ?? {}) as Record<string, unknown>;
  if (typeof content["goal"] === "string" && content["goal"].trim()) return content["goal"];
  return packet.intent ?? conceptTitleOf(packet);
}

function buildElement(
  slot: ComposerSlot,
  content: Record<string, unknown>,
  conceptId: string,
): ComposerElement {
  return {
    element_id: `el-${slot}`,
    type: slot,
    slot,
    reveal_order: SLOT_ORDER.indexOf(slot),
    concept_id: conceptId,
    content,
  };
}

/** A deterministic, honest MCCR derived from the concept (the fallback composition). */
export function deterministicComposition(packet: CognitionPacket): ComposerOutput {
  const conceptId = conceptIdOf(packet);
  const title = conceptTitleOf(packet);
  const goal = goalOf(packet);
  const mccr: Partial<Record<ComposerSlot, ComposerElement>> = {
    core_concept: buildElement("core_concept", { kind: "text", text: title }, conceptId),
    definition: buildElement(
      "definition",
      { kind: "text", text: `${title} — a foundational concept on the path to ${goal}.` },
      conceptId,
    ),
  };
  return {
    mccr,
    narration_script: {
      segments: [
        {
          text: `Let's build an understanding of ${title}.`,
          anchor_ref: "core_concept",
          intent: "introduce",
          pause_after: false,
        },
      ],
    },
    image_plan: {
      helps: false,
      modality: "none",
      prompt: null,
      rationale: "deterministic composition does not plan generated media",
    },
  };
}

/** Parse + validate the composer output contract. Throws E_MODEL_OUTPUT_MALFORMED on bad shape. */
export function parseComposerOutput(text: string, conceptId: string): ComposerOutput {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    throw composerError("E_MODEL_OUTPUT_MALFORMED", "composer output is not valid JSON", {
      sample: trimmed.slice(0, 200),
    });
  }
  const obj = raw as { mccr?: unknown; narration_script?: unknown; image_plan?: unknown };
  const mccrRaw = (obj.mccr ?? {}) as Record<string, unknown>;
  const mccr: Partial<Record<ComposerSlot, ComposerElement>> = {};

  for (const slot of SLOT_ORDER) {
    const value = mccrRaw[slot];
    if (value === undefined || value === null) continue;
    const content = elementContentFrom(slot, value);
    if (content) mccr[slot] = buildElement(slot, content, conceptId);
  }
  // The board must be non-empty: require at least a core concept.
  if (!mccr.core_concept) {
    throw composerError(
      "E_MODEL_OUTPUT_MALFORMED",
      "composer output is missing a core_concept anchor",
    );
  }

  const scriptRaw = (obj.narration_script ?? {}) as { segments?: unknown };
  const segmentsRaw = Array.isArray(scriptRaw.segments) ? scriptRaw.segments : [];
  const segments: ComposerNarrationSegment[] = [];
  for (const entry of segmentsRaw) {
    const s = (entry ?? {}) as Record<string, unknown>;
    const segText = typeof s["text"] === "string" ? s["text"].trim() : "";
    if (!segText) continue;
    const anchorRaw = typeof s["anchor_ref"] === "string" ? s["anchor_ref"].trim() : "";
    // A dangling anchor_ref (points at a slot the composer left empty) is nulled out (ADR-0030 risk #6).
    const anchor_ref =
      anchorRaw &&
      (SLOT_ORDER as readonly string[]).includes(anchorRaw) &&
      mccr[anchorRaw as ComposerSlot]
        ? (anchorRaw as ComposerSlot)
        : null;
    const intentRaw = typeof s["intent"] === "string" ? s["intent"].trim() : "";
    const intent = (
      VALID_INTENTS.has(intentRaw) ? intentRaw : "build"
    ) as ComposerNarrationSegment["intent"];
    segments.push({
      text: segText,
      anchor_ref,
      intent,
      pause_after: typeof s["pause_after"] === "boolean" ? s["pause_after"] : false,
    });
  }
  if (segments.length === 0) {
    // A frame with no spoken teaching is invalid — the voice is the teacher.
    throw composerError("E_MODEL_OUTPUT_MALFORMED", "composer output produced no narration script");
  }

  const imgRaw = (obj.image_plan ?? {}) as Record<string, unknown>;
  const helps = typeof imgRaw["helps"] === "boolean" ? imgRaw["helps"] : false;
  const prompt =
    helps && typeof imgRaw["prompt"] === "string" && imgRaw["prompt"].trim()
      ? imgRaw["prompt"].trim()
      : null;
  const image_plan: ComposerImagePlan = {
    helps: helps && prompt !== null,
    modality: helps && prompt !== null ? "image" : "none",
    prompt,
    rationale: typeof imgRaw["rationale"] === "string" ? imgRaw["rationale"] : "",
  };

  return { mccr, narration_script: { segments }, image_plan };
}

/** Coerce a raw slot value into the MCCR element content discriminated union. */
function elementContentFrom(slot: ComposerSlot, value: unknown): Record<string, unknown> | null {
  if (TEXT_SLOTS.has(slot)) {
    const txt = typeof value === "string" ? value.trim() : "";
    return txt ? { kind: "text", text: txt } : null;
  }
  const v = (value ?? {}) as Record<string, unknown>;
  if (slot === "key_formula") {
    const latex = typeof v["latex"] === "string" ? v["latex"] : "";
    const plain = typeof v["plain"] === "string" ? v["plain"] : "";
    return latex || plain ? { kind: "formula", latex, plain: plain || latex } : null;
  }
  if (slot === "relationship") {
    const from = typeof v["from"] === "string" ? v["from"] : "";
    const to = typeof v["to"] === "string" ? v["to"] : "";
    if (!from || !to) return null;
    return {
      kind: "relationship",
      from,
      to,
      relation: typeof v["relation"] === "string" ? v["relation"] : "",
      text: typeof v["text"] === "string" ? v["text"] : "",
    };
  }
  if (slot === "diagram") {
    const kind = typeof v["kind"] === "string" ? v["kind"] : "none";
    const nodes = Array.isArray(v["nodes"]) ? v["nodes"] : [];
    const edges = Array.isArray(v["edges"]) ? v["edges"] : [];
    if (nodes.length === 0) return null;
    return { kind: "diagram", diagram: { kind, nodes, edges } };
  }
  if (slot === "table") {
    const headers = Array.isArray(v["headers"]) ? v["headers"] : [];
    const rows = Array.isArray(v["rows"]) ? v["rows"] : [];
    if (headers.length === 0 && rows.length === 0) return null;
    return { kind: "table", headers, rows };
  }
  return null;
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

export class SurfaceComposerUnit implements CognitiveUnit {
  private readonly manifest: AgentManifest;
  private readonly model: ModelRuntime;
  private readonly timeoutMs: number;
  private readonly idGenerator: IdGenerator;
  private readonly getDepthBias: () => number;
  private preparedLeaseId: string | null = null;

  constructor(deps: SurfaceComposerUnitDeps) {
    this.manifest = deps.manifest;
    this.model = deps.model;
    this.timeoutMs = deps.timeoutMs ?? 20_000;
    this.idGenerator = deps.idGenerator ?? new CryptoIdGenerator();
    this.getDepthBias = deps.getDepthBias ?? (() => 0);
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
      const composition = deterministicComposition(packet);
      const response = this.buildResponsePacket(packet, composition, {
        kind: "deterministic-composition",
        model: "deterministic",
        confidence: 0.5,
        fallbackReason: code,
      });
      return { packets: [response], trace: this.buildTrace(packet, composition, "deterministic") };
    }
  }

  private async executeWithModel(packet: CognitionPacket): Promise<Emissions> {
    const request = this.buildRequest(packet);
    const result = await this.withTimeout(this.model.generate(request));
    if (result.finishReason === "refusal" || result.finishReason === "safety") {
      throw composerError("E_MODEL_REFUSAL", `model refused generation (${result.finishReason})`, {
        invocation_key: request.invocation_key,
      });
    }
    const composition = parseComposerOutput(result.text, conceptIdOf(packet));
    const response = this.buildResponsePacket(packet, composition, {
      kind: "model-composition",
      model: result.model,
      confidence: 0.83,
    });
    return { packets: [response], trace: this.buildTrace(packet, composition, result.model) };
  }

  private buildRequest(packet: CognitionPacket): ModelGenerationRequest {
    const title = conceptTitleOf(packet);
    const goal = goalOf(packet);
    const bias = this.getDepthBias();
    const depthGuidance =
      bias > 0.15
        ? "Favor formal precision: include the key formula and a structured diagram or table."
        : bias < -0.15
          ? "Favor intuition: keep anchors spare; prefer a mental model and a vivid example."
          : "Balance intuition and precision.";
    const system = [
      `You are "${this.manifest.id}". ${this.manifest.role}`,
      "The BOARD must hold only the Minimal Complete Cognitive Representation (MCCR): the distilled",
      "visual anchors a learner should keep in view. The VOICE (narration script) carries the actual",
      "teaching — intuition, analogy, story, reasoning. NEVER put teaching prose on the board, and",
      "NEVER merely restate the board in the narration. They are complementary: the board is memory,",
      "the voice is the teacher.",
      "Respond with JSON only (no markdown fences) matching:",
      '{"mccr":{"core_concept":"short noun phrase","definition":"one crisp sentence","key_formula":{"latex":"...","plain":"spoken form"},"diagram":{"kind":"node-graph|flow|axes|tree","nodes":[{"id":"n1","label":"..."}],"edges":[{"from":"n1","to":"n2","relation":"..."}]},"relationship":{"from":"A","to":"B","relation":"...","text":"..."},"mental_model":"a vivid analogy in a phrase","table":{"headers":["..."],"rows":[["..."]]},"key_example":"one tight worked instance","memory_cue":"a mnemonic"},"narration_script":{"segments":[{"text":"spoken teaching sentence","anchor_ref":"core_concept|definition|key_formula|diagram|relationship|mental_model|table|key_example|memory_cue","intent":"introduce|build|illustrate|connect|check|reinforce","pause_after":false}]},"image_plan":{"helps":true,"prompt":"a concrete illustration prompt","rationale":"why it helps"}}',
      "Rules: core_concept and definition are REQUIRED; every other MCCR slot is OPTIONAL — include a",
      "slot ONLY when it earns its place on the board (omit or null otherwise). Keep total anchors ≤ 6",
      "so one frame fits one screen. Each narration segment's anchor_ref must name a slot you filled",
      "(or be omitted for a whole-frame remark). 3–6 narration segments. image_plan.helps is true only",
      "when a generated illustration genuinely aids understanding (then give a concrete prompt).",
      depthGuidance,
    ].join("\n");
    return {
      prompt: `Concept to teach: ${title}\nLearner goal: ${goal}`,
      system,
      maxTokens: 4096,
      responseSchema: OUTPUT_CONTRACT_SCHEMA,
      invocation_key: `${this.manifest.id}:${packet.packet_id}:compose`,
    };
  }

  private buildResponsePacket(
    packet: CognitionPacket,
    composition: ComposerOutput,
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
      concept_ids: packet.concept_ids ?? [],
      domain_ids: packet.domain_ids ?? [],
      content: {
        handled_by: this.manifest.id,
        response_kind: meta.kind,
        mccr: composition.mccr,
        narration_script: composition.narration_script,
        image_plan: composition.image_plan,
        model: meta.model,
        ...(meta.fallbackReason ? { fallback_reason: meta.fallbackReason } : {}),
        prepared_lease_id: this.preparedLeaseId,
      },
      evidence: [
        { kind: "surface-composition", source_packet_id: packet.packet_id, model: meta.model },
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
    composition: ComposerOutput,
    model: string,
  ): ReasoningTrace {
    const anchorCount = Object.keys(composition.mccr).length;
    const segmentCount = composition.narration_script.segments.length;
    return {
      trace_id: packet.trace_id ?? "",
      producer_cid: this.manifest.id,
      session_id: packet.session_id ?? null,
      task_interpretation: `compose a Cognitive Frame for "${conceptTitleOf(packet)}"`,
      strategy: "distill-board-anchors + author-separate-narration",
      claims: [
        {
          claim_id: `${packet.packet_id}-claim-0`,
          statement: `${anchorCount} MCCR anchors, ${segmentCount} narration segments, image ${composition.image_plan.helps ? "planned" : "not planned"}`,
          confidence: model === "deterministic" ? 0.5 : 0.83,
        },
      ],
      decision: `composed an MCCR + narration split via ${model}`,
      uncertainty_estimate: model === "deterministic" ? 0.5 : 0.17,
      self_critique:
        model === "deterministic"
          ? "deterministic fallback — minimal board, no media; degradation is visible"
          : null,
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
        reject(composerError("E_MODEL_TIMEOUT", `model call exceeded ${this.timeoutMs}ms`));
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
