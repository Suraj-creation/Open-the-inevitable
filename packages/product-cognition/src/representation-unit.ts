/**
 * RepresentationUnit — the Representation Intelligence Agent (RIA; CSE-018, ADR-0058).
 *
 * Runs AFTER the composer, BEFORE cinematography: given a frame's distilled elements (id + type) and
 * the learner's expertise, it assigns each element its epistemic role (the KIND of knowledge — Law 5)
 * and representational hierarchy (primary/supporting/residue — Law 1/3), names any element it would
 * leave off the board (the exclusion list), and records how it adapted to the learner (Law 8). It
 * NEVER draws or lays out — it plans over the closed MCCR vocabulary (ADR-0058 D2).
 *
 * Same `CognitiveUnit` ABI as the other model units, so governance/scheduler/OTel/D3 apply unchanged.
 * Model-backed with a DEGRADED-EMPTY fallback: on any failure it returns an empty composition, and the
 * caller (the surface session) falls back to its own deterministic `planRepresentation` — the parity
 * floor (ADR-0058 D3), so a model failure can never regress a frame.
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

const SPEC_REF = "source-environment/CSE-018-representation-intelligence";

const EPISTEMIC_ROLES = [
  "canonical",
  "definition",
  "reasoning",
  "example",
  "warning",
  "misconception",
  "insight",
  "memory-cue",
  "observation",
  "evidence",
  "structural",
] as const;
const HIERARCHIES = ["primary", "supporting", "residue"] as const;

export interface RepresentationElementAssignment {
  readonly element_id: string;
  readonly epistemic_role: string;
  readonly hierarchy: string;
}

/** The model's representation plan (roles/hierarchy/exclusions/adaptivity). Empty ⇒ use the floor. */
export interface RepresentationProduct {
  readonly composition: readonly RepresentationElementAssignment[];
  readonly exclusions: readonly string[];
  readonly adaptivity: string;
  readonly degraded: boolean;
}

export interface RepresentationUnitDeps {
  readonly manifest: AgentManifest;
  readonly model: ModelRuntime;
  readonly timeoutMs?: number;
  readonly idGenerator?: IdGenerator;
}

const OUTPUT_CONTRACT_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["composition"],
  properties: {
    composition: {
      type: "array",
      items: {
        type: "object",
        properties: {
          element_id: { type: "string" },
          epistemic_role: { type: "string" },
          hierarchy: { type: "string" },
        },
      },
    },
    exclusions: { type: "array", items: { type: "string" } },
    adaptivity: { type: "string" },
  },
};

function riaError(code: string, message: string, details?: Record<string, unknown>): CosError {
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

/** The frame's elements the RIA is planning over: `[{element_id, type}]`. */
function elementsOf(packet: CognitionPacket): { element_id: string; type: string }[] {
  const raw = contentOf(packet)["elements"];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => ({
      element_id: typeof e["element_id"] === "string" ? e["element_id"] : "",
      type: typeof e["type"] === "string" ? e["type"] : "",
    }))
    .filter((e) => e.element_id.length > 0);
}

/** The learner's expertise signal for expertise-reversal adaptation (Law 8); "" when unknown. */
function expertiseOf(packet: CognitionPacket): string {
  const v = contentOf(packet)["expertise"];
  return typeof v === "string" ? v.trim() : "";
}

/** The degraded fallback: empty composition ⇒ the caller uses its deterministic parity plan. */
export function degradedRepresentation(reason: string): RepresentationProduct {
  return { composition: [], exclusions: [], adaptivity: reason, degraded: true };
}

/** Parse + validate the RIA output contract against the known elements + vocabularies. */
export function parseRepresentation(
  text: string,
  knownIds: ReadonlySet<string>,
): RepresentationProduct {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    throw riaError("E_MODEL_OUTPUT_MALFORMED", "representation plan is not valid JSON", {
      sample: trimmed.slice(0, 200),
    });
  }
  const obj = (raw ?? {}) as Record<string, unknown>;
  const rawComp = Array.isArray(obj["composition"]) ? obj["composition"] : [];
  const composition: RepresentationElementAssignment[] = [];
  const seen = new Set<string>();
  for (const c of rawComp) {
    if (!c || typeof c !== "object") continue;
    const e = c as Record<string, unknown>;
    const id = typeof e["element_id"] === "string" ? e["element_id"] : "";
    // Only assign to elements the composer actually produced — never invent an element (grounding).
    if (!knownIds.has(id) || seen.has(id)) continue;
    const role = typeof e["epistemic_role"] === "string" ? e["epistemic_role"] : "observation";
    const hierarchy = typeof e["hierarchy"] === "string" ? e["hierarchy"] : "supporting";
    seen.add(id);
    composition.push({
      element_id: id,
      epistemic_role: (EPISTEMIC_ROLES as readonly string[]).includes(role) ? role : "observation",
      hierarchy: (HIERARCHIES as readonly string[]).includes(hierarchy) ? hierarchy : "supporting",
    });
  }
  const exclusions = Array.isArray(obj["exclusions"])
    ? (obj["exclusions"] as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const adaptivity = typeof obj["adaptivity"] === "string" ? obj["adaptivity"] : "";
  return { composition, exclusions, adaptivity, degraded: false };
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

export class RepresentationUnit implements CognitiveUnit {
  private readonly manifest: AgentManifest;
  private readonly model: ModelRuntime;
  private readonly timeoutMs: number;
  private readonly idGenerator: IdGenerator;
  private preparedLeaseId: string | null = null;

  constructor(deps: RepresentationUnitDeps) {
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
      const product = degradedRepresentation(code);
      return {
        packets: [
          this.buildResponsePacket(packet, product, {
            kind: "deterministic-representation",
            model: "deterministic",
            confidence: 0.5,
            fallbackReason: code,
          }),
        ],
        trace: this.buildTrace(packet, product, "deterministic"),
      };
    }
  }

  private async executeWithModel(packet: CognitionPacket): Promise<Emissions> {
    const request = this.buildRequest(packet);
    const result = await this.withTimeout(this.model.generate(request));
    if (result.finishReason === "refusal" || result.finishReason === "safety") {
      throw riaError("E_MODEL_REFUSAL", `model refused generation (${result.finishReason})`, {
        invocation_key: request.invocation_key,
      });
    }
    if (result.finishReason === "max_tokens") {
      throw riaError("E_MODEL_OUTPUT_TRUNCATED", "representation plan cut off at token budget", {
        invocation_key: request.invocation_key,
        text_length: result.text.length,
      });
    }
    const knownIds = new Set(elementsOf(packet).map((e) => e.element_id));
    const product = parseRepresentation(result.text, knownIds);
    return {
      packets: [
        this.buildResponsePacket(packet, product, {
          kind: "model-representation",
          model: result.model,
          confidence: 0.8,
        }),
      ],
      trace: this.buildTrace(packet, product, result.model),
    };
  }

  private buildRequest(packet: CognitionPacket): ModelGenerationRequest {
    const title = conceptTitleOf(packet);
    const elements = elementsOf(packet);
    const expertise = expertiseOf(packet);
    const system = [
      `You are "${this.manifest.id}". ${this.manifest.role}`,
      "You do NOT write content or lay out the screen. You classify each board element by the KIND of",
      "knowledge it carries and how central it is, so the design system can render it in a visual",
      "language the learner reads without labels. For every element assign:",
      `- epistemic_role: one of ${EPISTEMIC_ROLES.join(", ")}`,
      `- hierarchy: one of ${HIERARCHIES.join(", ")} (primary = the load-bearing idea; residue = a`,
      "  keepsake like a mnemonic).",
      "Name in `exclusions` anything you would leave OFF the board to protect focus (never hide a",
      "formula/example/misconception the concept truly needs — those stay). In `adaptivity` note in one",
      "phrase how you tuned for this learner (e.g. 'full scaffolding — novice' or 'terse — expert').",
      "Only assign roles to element_ids given below; never invent an element.",
      "Respond with JSON only (no markdown fences) matching:",
      '{"composition":[{"element_id":"…","epistemic_role":"…","hierarchy":"…"}],"exclusions":["…"],"adaptivity":"…"}',
    ].join("\n");
    const prompt = [
      `Concept: ${title}`,
      expertise ? `Learner expertise: ${expertise}` : "",
      `Board elements: ${elements.map((e) => `${e.element_id} (${e.type})`).join(", ")}`,
    ]
      .filter(Boolean)
      .join("\n");
    return {
      prompt,
      system,
      maxTokens: 2048,
      thinkingBudget: 512,
      responseSchema: OUTPUT_CONTRACT_SCHEMA,
      invocation_key: `${this.manifest.id}:${packet.packet_id}:plan`,
    };
  }

  private buildResponsePacket(
    packet: CognitionPacket,
    product: RepresentationProduct,
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
        representation: product,
        model: meta.model,
        ...(meta.fallbackReason ? { fallback_reason: meta.fallbackReason } : {}),
        prepared_lease_id: this.preparedLeaseId,
      },
      evidence: [{ kind: "representation", source_packet_id: packet.packet_id, model: meta.model }],
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
    product: RepresentationProduct,
    model: string,
  ): ReasoningTrace {
    return {
      trace_id: packet.trace_id ?? "",
      producer_cid: this.manifest.id,
      session_id: packet.session_id ?? null,
      task_interpretation: `assign epistemic roles for "${conceptTitleOf(packet)}"`,
      strategy: "classify-by-kind-and-centrality",
      claims: [
        {
          claim_id: `${packet.packet_id}-claim-0`,
          statement: product.degraded
            ? "degraded — caller uses the deterministic parity plan"
            : `assigned ${product.composition.length} element role(s)`,
          confidence: model === "deterministic" ? 0.5 : 0.8,
        },
      ],
      decision: product.degraded
        ? "declined a model plan; deterministic floor applies"
        : `planned representation via ${model}`,
      uncertainty_estimate: model === "deterministic" ? 0.5 : 0.2,
      self_critique: product.degraded ? "deterministic fallback — degradation is visible" : null,
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
        reject(riaError("E_MODEL_TIMEOUT", `model call exceeded ${this.timeoutMs}ms`));
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
