/**
 * ImagePlannerUnit — the Image Agent (UCS, ADR-0030; Phase 4).
 *
 * Owns the image-as-cognition decision, promoted out of the Surface Composer's inline `image_plan`.
 * Given a concept, its teaching focus, and the frame's distilled anchors, it decides in one reasoning
 * pass whether a generated illustration genuinely aids understanding, and — when it does — constructs
 * the generation prompt, a concise caption, and the callout labels that turn a picture into an
 * *explanatory* image (image + caption + labels living in the concept's region). It also supports a
 * `refine` mode: re-planning a prompt from learner/quality feedback after a first generation.
 *
 * Implements the same `CognitiveUnit` ABI as `SurfaceComposerUnit`/`ModelBackedUnit`, so the
 * governance gate, scheduler admission, OTel span, and D3 recording all apply unchanged. Model-backed
 * with a deterministic fallback (helps=false) so offline/seeded runs never fabricate media and stay
 * byte-identical on replay.
 *
 * Spec: spec/surface/inline-multimodal-artifacts.md; SRF-004/SRF-006; ADR-0030.
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

/** The image decision — whether an image helps, plus the prompt + explanatory caption/labels. */
export interface ImagePlan {
  readonly helps: boolean;
  readonly modality: "image" | "none";
  readonly prompt: string | null;
  readonly rationale: string;
  /** A one-line caption shown beneath the image (image-as-cognition). Null when no image. */
  readonly caption: string | null;
  /** Callout labels that annotate the illustration's salient parts (≤ 6). Empty when no image. */
  readonly labels: readonly string[];
}

export interface ImagePlannerUnitDeps {
  readonly manifest: AgentManifest;
  readonly model: ModelRuntime;
  readonly timeoutMs?: number;
  readonly idGenerator?: IdGenerator;
  /** Hard cap on callout labels (density; default 6). */
  readonly maxLabels?: number;
}

const DEFAULT_MAX_LABELS = 6;

const OUTPUT_CONTRACT_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["helps"],
  properties: {
    helps: { type: "boolean" },
    prompt: { type: "string" },
    rationale: { type: "string" },
    caption: { type: "string" },
    labels: { type: "array", items: { type: "string" } },
  },
};

function plannerError(code: string, message: string, details?: Record<string, unknown>): CosError {
  return new CosError(code, message, { specRef: SPEC_REF, details });
}

function contentOf(packet: CognitionPacket): Record<string, unknown> {
  return (packet.content ?? {}) as Record<string, unknown>;
}

function conceptTitleOf(packet: CognitionPacket): string {
  const content = contentOf(packet);
  for (const key of ["concept_title", "title", "goal"]) {
    const v = content[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return packet.intent ?? "the concept";
}

function subFocusOf(packet: CognitionPacket): string {
  const content = contentOf(packet);
  return typeof content["sub_focus"] === "string" ? content["sub_focus"].trim() : "";
}

/** The composer's anchor summary (what is already on the board) so the image complements, not repeats. */
function anchorsOf(packet: CognitionPacket): string {
  const content = contentOf(packet);
  const raw = content["anchors"];
  if (Array.isArray(raw)) return raw.filter((a): a is string => typeof a === "string").join(", ");
  if (typeof raw === "string") return raw;
  return "";
}

/** Refine mode: the feedback (learner confusion / quality note) the new prompt must address. */
function feedbackOf(packet: CognitionPacket): string {
  const content = contentOf(packet);
  return typeof content["feedback"] === "string" ? content["feedback"].trim() : "";
}

function isRefine(packet: CognitionPacket): boolean {
  return contentOf(packet)["mode"] === "refine";
}

/** The honest deterministic decision: an offline planner never fabricates media. */
export function deterministicImagePlan(): ImagePlan {
  return {
    helps: false,
    modality: "none",
    prompt: null,
    rationale: "deterministic image planner does not fabricate generated media",
    caption: null,
    labels: [],
  };
}

/** Parse + validate the image-plan output contract. Throws E_MODEL_OUTPUT_MALFORMED on bad JSON. */
export function parseImagePlan(text: string, maxLabels: number): ImagePlan {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    throw plannerError("E_MODEL_OUTPUT_MALFORMED", "image plan is not valid JSON", {
      sample: trimmed.slice(0, 200),
    });
  }
  const obj = (raw ?? {}) as Record<string, unknown>;
  const helpsRaw = obj["helps"] === true;
  const prompt =
    helpsRaw && typeof obj["prompt"] === "string" && obj["prompt"].trim()
      ? obj["prompt"].trim()
      : null;
  // helps is true only when a concrete prompt backs it (a decision without a prompt is a "no").
  const helps = helpsRaw && prompt !== null;
  const rationale = typeof obj["rationale"] === "string" ? obj["rationale"] : "";
  if (!helps) {
    // Preserve the model's rationale for observability (why text/diagram sufficed), but plan no media.
    return { helps: false, modality: "none", prompt: null, rationale, caption: null, labels: [] };
  }
  const caption =
    typeof obj["caption"] === "string" && obj["caption"].trim() ? obj["caption"].trim() : null;
  const labelsRaw = Array.isArray(obj["labels"]) ? obj["labels"] : [];
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const l of labelsRaw) {
    if (typeof l !== "string") continue;
    const label = l.trim();
    if (label && !seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
    if (labels.length >= maxLabels) break;
  }
  return { helps: true, modality: "image", prompt, rationale, caption, labels };
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

export class ImagePlannerUnit implements CognitiveUnit {
  private readonly manifest: AgentManifest;
  private readonly model: ModelRuntime;
  private readonly timeoutMs: number;
  private readonly idGenerator: IdGenerator;
  private readonly maxLabels: number;
  private preparedLeaseId: string | null = null;

  constructor(deps: ImagePlannerUnitDeps) {
    this.manifest = deps.manifest;
    this.model = deps.model;
    this.timeoutMs = deps.timeoutMs ?? 20_000;
    this.idGenerator = deps.idGenerator ?? new CryptoIdGenerator();
    this.maxLabels = Math.max(1, deps.maxLabels ?? DEFAULT_MAX_LABELS);
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
      const plan = deterministicImagePlan();
      const response = this.buildResponsePacket(packet, plan, {
        kind: "deterministic-image-plan",
        model: "deterministic",
        confidence: 0.5,
        fallbackReason: code,
      });
      return { packets: [response], trace: this.buildTrace(packet, plan, "deterministic") };
    }
  }

  private async executeWithModel(packet: CognitionPacket): Promise<Emissions> {
    const request = this.buildRequest(packet);
    const result = await this.withTimeout(this.model.generate(request));
    if (result.finishReason === "refusal" || result.finishReason === "safety") {
      throw plannerError("E_MODEL_REFUSAL", `model refused generation (${result.finishReason})`, {
        invocation_key: request.invocation_key,
      });
    }
    const plan = parseImagePlan(result.text, this.maxLabels);
    const response = this.buildResponsePacket(packet, plan, {
      kind: isRefine(packet) ? "model-image-refine" : "model-image-plan",
      model: result.model,
      confidence: 0.8,
    });
    return { packets: [response], trace: this.buildTrace(packet, plan, result.model) };
  }

  private buildRequest(packet: CognitionPacket): ModelGenerationRequest {
    const title = conceptTitleOf(packet);
    const subFocus = subFocusOf(packet);
    const anchors = anchorsOf(packet);
    const refine = isRefine(packet);
    const feedback = feedbackOf(packet);
    const system = [
      `You are "${this.manifest.id}". ${this.manifest.role}`,
      "Decide whether a GENERATED illustration genuinely aids understanding of this frame — many",
      "concepts are better served by the board's text/diagram anchors alone. An image earns its place",
      "only when spatial/visual structure carries meaning words cannot. When it does, write a concrete",
      "generation prompt, a one-line caption, and 2–6 callout labels naming the parts a learner should",
      "notice (this makes it an EXPLANATORY image, not decoration). The image must COMPLEMENT the board",
      "anchors, never merely repeat them.",
      refine
        ? "REFINE MODE: a first image fell short. Revise the prompt to directly address the feedback."
        : "",
      "Respond with JSON only (no markdown fences) matching:",
      '{"helps":true,"prompt":"a concrete illustration prompt","rationale":"why it helps (or why not)","caption":"one-line caption","labels":["part A","part B"]}',
      'If an image does NOT help, respond exactly {"helps":false,"rationale":"why text/diagram suffices"}.',
    ]
      .filter(Boolean)
      .join("\n");
    const promptLines = [
      `Concept: ${title}`,
      subFocus ? `This frame teaches: ${subFocus}` : "",
      anchors ? `Board anchors already present: ${anchors}` : "",
      refine && feedback ? `Feedback to address: ${feedback}` : "",
    ].filter(Boolean);
    return {
      prompt: promptLines.join("\n"),
      system,
      maxTokens: 1024,
      responseSchema: OUTPUT_CONTRACT_SCHEMA,
      invocation_key: `${this.manifest.id}:${packet.packet_id}:${refine ? "refine" : "decide"}`,
    };
  }

  private buildResponsePacket(
    packet: CognitionPacket,
    plan: ImagePlan,
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
        image_plan: plan,
        model: meta.model,
        ...(meta.fallbackReason ? { fallback_reason: meta.fallbackReason } : {}),
        prepared_lease_id: this.preparedLeaseId,
      },
      evidence: [{ kind: "image-plan", source_packet_id: packet.packet_id, model: meta.model }],
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

  private buildTrace(packet: CognitionPacket, plan: ImagePlan, model: string): ReasoningTrace {
    return {
      trace_id: packet.trace_id ?? "",
      producer_cid: this.manifest.id,
      session_id: packet.session_id ?? null,
      task_interpretation: `decide whether an image aids "${conceptTitleOf(packet)}"`,
      strategy: isRefine(packet) ? "refine-image-prompt-from-feedback" : "decide-then-prompt",
      claims: [
        {
          claim_id: `${packet.packet_id}-claim-0`,
          statement: plan.helps
            ? `image planned with ${plan.labels.length} callout label(s)`
            : "no image — board anchors suffice",
          confidence: model === "deterministic" ? 0.5 : 0.8,
        },
      ],
      decision: plan.helps ? `planned an explanatory image via ${model}` : "declined an image",
      uncertainty_estimate: model === "deterministic" ? 0.5 : 0.2,
      self_critique:
        model === "deterministic"
          ? "deterministic fallback — no media planned; degradation is visible"
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
        reject(plannerError("E_MODEL_TIMEOUT", `model call exceeded ${this.timeoutMs}ms`));
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
