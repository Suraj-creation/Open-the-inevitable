/**
 * FramePlannerUnit — the Frame Planner agent (UCS, ADR-0030; Phase 2).
 *
 * Decomposes one concept into a SEQUENCE of progressive Cognitive Frames — each a viewport-complete
 * cognitive *state* that teaches one slice (intuition → definition → worked example → connection)
 * and transitions to the next. The planner only decides the *shape* of the lesson: per-frame title,
 * teaching angle (`sub_focus`), layout archetype, and which MCCR slots the frame will fill. The
 * Surface Composer then distills each frame's actual MCCR + narration (one composer call per frame).
 *
 * Implements the same `CognitiveUnit` ABI as `SurfaceComposerUnit`/`ModelBackedUnit`, so the
 * governance gate, scheduler admission, OTel span, and D3 recording all apply unchanged. Model-backed
 * with a deterministic single-frame fallback so offline/seeded runs still yield a real, deterministic
 * plan (reproducing the Phase 1 single-frame behaviour).
 *
 * Spec: spec/surface/cognitive-surface-runtime.md §4.7; SRF-002 §4 (`surface.frame.planned`); ADR-0030.
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
// Output contract (plain shapes — the surface session turns these into surface.frame.planned events)
// ---------------------------------------------------------------------------

/** The MCCR slots a frame may reserve in its layout (image is decided by the composer's image_plan). */
export const PLANNABLE_SLOTS = [
  "core_concept",
  "definition",
  "key_formula",
  "diagram",
  "relationship",
  "mental_model",
  "table",
  "key_example",
  "misconception",
  "memory_cue",
] as const;

export type PlannableSlot = (typeof PLANNABLE_SLOTS)[number];

export const FRAME_ARCHETYPES = [
  "concept-first",
  "image-led",
  "compare",
  "formal",
  "example-led",
] as const;

export type FrameArchetype = (typeof FRAME_ARCHETYPES)[number];

export const PLANNER_FRAME_INTENTS = [
  "introduce",
  "build",
  "illustrate",
  "connect",
  "deepen",
  "summarize",
] as const;

export type PlannerFrameIntent = (typeof PLANNER_FRAME_INTENTS)[number];

/** One planned Cognitive Frame: its title, teaching angle, layout archetype, and reserved slots. */
export interface PlannerFrameEntry {
  readonly title: string;
  /** The slice of the concept this frame teaches — threaded into the composer so frames differ. */
  readonly sub_focus: string;
  readonly archetype: FrameArchetype;
  readonly slots: readonly PlannableSlot[];
  readonly intent: PlannerFrameIntent;
}

/**
 * A discardable look-ahead bet (UCS, ADR-0030; Phase 3): the opening frame the planner *predicts*
 * the learner will need NEXT (after mastering this concept), plus the `trigger_assumption` the bet
 * rests on. The surface session may speculatively pre-compose it within the governed look-ahead
 * budget; it is recorded but never surfaced until a real signal promotes it, and invalidated the
 * moment the learner diverges. The session binds the entry to the actual next concept in the path.
 */
export interface LookaheadEntry {
  readonly title: string;
  readonly sub_focus: string;
  readonly archetype: FrameArchetype;
  readonly slots: readonly PlannableSlot[];
  /** The bet this speculation rests on, e.g. "learner masters X and advances to Y". */
  readonly trigger_assumption: string;
}

export interface FramePlan {
  readonly frames: readonly PlannerFrameEntry[];
  /** Speculative next-step frames (Phase 3). Empty in the deterministic fallback. */
  readonly lookahead: readonly LookaheadEntry[];
  readonly pacing: { readonly strategy: string; readonly notes: string };
}

export interface FramePlannerUnitDeps {
  readonly manifest: AgentManifest;
  readonly model: ModelRuntime;
  readonly timeoutMs?: number;
  readonly idGenerator?: IdGenerator;
  /** Live depth bias (P5.2): >0 favors more, deeper frames; <0 favors a tighter, shorter sequence. */
  readonly getDepthBias?: () => number;
  /** Hard cap on frames per concept (density / no-overwhelm). Default 5. */
  readonly maxFrames?: number;
}

const DEFAULT_MAX_FRAMES = 5;
const DEFAULT_SLOTS: readonly PlannableSlot[] = ["core_concept", "definition"];

const VALID_SLOTS: ReadonlySet<string> = new Set(PLANNABLE_SLOTS);
const VALID_ARCHETYPES: ReadonlySet<string> = new Set(FRAME_ARCHETYPES);
const VALID_INTENTS: ReadonlySet<string> = new Set(PLANNER_FRAME_INTENTS);

const OUTPUT_CONTRACT_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["frames"],
  properties: {
    frames: {
      type: "array",
      items: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string" },
          sub_focus: { type: "string" },
          archetype: { type: "string" },
          slots: { type: "array", items: { type: "string" } },
          intent: { type: "string" },
        },
      },
    },
    lookahead: {
      type: "array",
      items: {
        type: "object",
        required: ["title", "trigger_assumption"],
        properties: {
          title: { type: "string" },
          sub_focus: { type: "string" },
          archetype: { type: "string" },
          slots: { type: "array", items: { type: "string" } },
          trigger_assumption: { type: "string" },
        },
      },
    },
    pacing: {
      type: "object",
      properties: { strategy: { type: "string" }, notes: { type: "string" } },
    },
  },
};

function plannerError(code: string, message: string, details?: Record<string, unknown>): CosError {
  return new CosError(code, message, { specRef: SPEC_REF, details });
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

/** One anchored source passage the frame is taught FROM (R2a, ADR-0057 D1). */
interface SourceExcerpt {
  readonly anchor_ref: string;
  readonly quote: string;
  readonly path: string;
}

/** Read the source excerpts threaded into the packet (empty ⇒ goal-mode; nothing changes). */
function sourceExcerptsOf(packet: CognitionPacket): SourceExcerpt[] {
  const raw = ((packet.content ?? {}) as Record<string, unknown>)["source_excerpts"];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => ({
      anchor_ref: typeof e["anchor_ref"] === "string" ? e["anchor_ref"] : "",
      quote: typeof e["quote"] === "string" ? e["quote"] : "",
      path: typeof e["path"] === "string" ? e["path"] : "",
    }))
    .filter((e) => e.quote.trim().length > 0);
}

/** Format the excerpts as a numbered, path-labeled block for the prompt. */
function sourceBlock(excerpts: readonly SourceExcerpt[]): string {
  return excerpts.map((e, i) => `[${i + 1}] ${e.path || "passage"}: "${e.quote}"`).join("\n");
}

/** Normalize + validate a raw slot list into ordered, deduped plannable slots (core_concept first). */
function sanitizeSlots(raw: unknown): PlannableSlot[] {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const slots: PlannableSlot[] = [];
  for (const entry of list) {
    if (typeof entry !== "string") continue;
    const slot = entry.trim();
    if (VALID_SLOTS.has(slot) && !seen.has(slot)) {
      seen.add(slot);
      slots.push(slot as PlannableSlot);
    }
  }
  if (slots.length === 0) return [...DEFAULT_SLOTS];
  // The board must always anchor on a core concept (appended so the model's intended order is kept).
  if (!seen.has("core_concept")) slots.push("core_concept");
  return slots;
}

/** A deterministic, honest single-frame plan (the fallback) — reproduces Phase 1 behaviour. */
export function deterministicPlan(packet: CognitionPacket): FramePlan {
  return {
    frames: [
      {
        title: conceptTitleOf(packet),
        sub_focus: "",
        archetype: "concept-first",
        slots: [...DEFAULT_SLOTS],
        intent: "introduce",
      },
    ],
    lookahead: [],
    pacing: { strategy: "single-frame", notes: "deterministic fallback — one frame per concept" },
  };
}

/** Parse + validate one look-ahead bet; returns null when it lacks a title or trigger assumption. */
function parseLookaheadEntry(entry: unknown): LookaheadEntry | null {
  const e = (entry ?? {}) as Record<string, unknown>;
  const title = typeof e["title"] === "string" ? e["title"].trim() : "";
  const trigger = typeof e["trigger_assumption"] === "string" ? e["trigger_assumption"].trim() : "";
  if (!title || !trigger) return null;
  const archetypeRaw = typeof e["archetype"] === "string" ? e["archetype"].trim() : "";
  const archetype = (
    VALID_ARCHETYPES.has(archetypeRaw) ? archetypeRaw : "concept-first"
  ) as FrameArchetype;
  return {
    title,
    sub_focus: typeof e["sub_focus"] === "string" ? e["sub_focus"].trim() : "",
    archetype,
    slots: sanitizeSlots(e["slots"]),
    trigger_assumption: trigger,
  };
}

/** Parse + validate the frame-plan output contract. Throws E_MODEL_OUTPUT_MALFORMED on bad shape. */
export function parseFramePlan(text: string, conceptTitle: string, maxFrames: number): FramePlan {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    throw plannerError("E_MODEL_OUTPUT_MALFORMED", "frame plan is not valid JSON", {
      sample: trimmed.slice(0, 200),
    });
  }
  const obj = raw as { frames?: unknown; pacing?: unknown };
  const framesRaw = Array.isArray(obj.frames) ? obj.frames : [];
  const frames: PlannerFrameEntry[] = [];
  for (const entry of framesRaw) {
    const e = (entry ?? {}) as Record<string, unknown>;
    const title = typeof e["title"] === "string" ? e["title"].trim() : "";
    if (!title) continue;
    const archetypeRaw = typeof e["archetype"] === "string" ? e["archetype"].trim() : "";
    const archetype = (
      VALID_ARCHETYPES.has(archetypeRaw) ? archetypeRaw : "concept-first"
    ) as FrameArchetype;
    const intentRaw = typeof e["intent"] === "string" ? e["intent"].trim() : "";
    const intent = (VALID_INTENTS.has(intentRaw) ? intentRaw : "build") as PlannerFrameIntent;
    frames.push({
      title,
      sub_focus: typeof e["sub_focus"] === "string" ? e["sub_focus"].trim() : "",
      archetype,
      slots: sanitizeSlots(e["slots"]),
      intent,
    });
    if (frames.length >= maxFrames) break;
  }
  if (frames.length === 0) {
    // A plan with no parseable frames is invalid — let the unit degrade to its deterministic
    // single-frame fallback (observable via `fallback_reason`), mirroring the composer.
    throw plannerError("E_MODEL_OUTPUT_MALFORMED", "frame plan produced no frames", {
      concept: conceptTitle,
    });
  }
  const lookaheadRaw = Array.isArray((obj as { lookahead?: unknown }).lookahead)
    ? (obj as { lookahead: unknown[] }).lookahead
    : [];
  const lookahead: LookaheadEntry[] = [];
  for (const entry of lookaheadRaw) {
    const parsed = parseLookaheadEntry(entry);
    if (parsed) lookahead.push(parsed);
    // Look-ahead is a bounded buffer, not a lesson — one bet is enough to pre-warm the next step.
    if (lookahead.length >= 1) break;
  }
  const pacingRaw = (obj.pacing ?? {}) as Record<string, unknown>;
  return {
    frames,
    lookahead,
    pacing: {
      strategy: typeof pacingRaw["strategy"] === "string" ? pacingRaw["strategy"] : "progressive",
      notes: typeof pacingRaw["notes"] === "string" ? pacingRaw["notes"] : "",
    },
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

export class FramePlannerUnit implements CognitiveUnit {
  private readonly manifest: AgentManifest;
  private readonly model: ModelRuntime;
  private readonly timeoutMs: number;
  private readonly idGenerator: IdGenerator;
  private readonly getDepthBias: () => number;
  private readonly maxFrames: number;
  private preparedLeaseId: string | null = null;

  constructor(deps: FramePlannerUnitDeps) {
    this.manifest = deps.manifest;
    this.model = deps.model;
    this.timeoutMs = deps.timeoutMs ?? 60_000;
    this.idGenerator = deps.idGenerator ?? new CryptoIdGenerator();
    this.getDepthBias = deps.getDepthBias ?? (() => 0);
    this.maxFrames = Math.max(1, deps.maxFrames ?? DEFAULT_MAX_FRAMES);
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
      const plan = deterministicPlan(packet);
      const response = this.buildResponsePacket(packet, plan, {
        kind: "deterministic-plan",
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
    if (result.finishReason === "max_tokens") {
      throw plannerError(
        "E_MODEL_OUTPUT_TRUNCATED",
        "frame plan cut off at token budget; JSON is incomplete",
        { invocation_key: request.invocation_key, text_length: result.text.length },
      );
    }
    const plan = parseFramePlan(result.text, conceptTitleOf(packet), this.maxFrames);
    const response = this.buildResponsePacket(packet, plan, {
      kind: "model-plan",
      model: result.model,
      confidence: 0.82,
    });
    return { packets: [response], trace: this.buildTrace(packet, plan, result.model) };
  }

  private buildRequest(packet: CognitionPacket): ModelGenerationRequest {
    const title = conceptTitleOf(packet);
    const goal = goalOf(packet);
    const excerpts = sourceExcerptsOf(packet);
    const bias = this.getDepthBias();
    const depthGuidance =
      bias > 0.15
        ? `Decompose generously: ${Math.min(this.maxFrames, 4)}–${this.maxFrames} frames, each a distinct slice, building to formal depth.`
        : bias < -0.15
          ? "Keep it tight: 1–2 frames, intuition-first, only the essentials."
          : `Use 2–${Math.min(this.maxFrames, 4)} progressive frames.`;
    const system = [
      `You are "${this.manifest.id}". ${this.manifest.role}`,
      "Decompose ONE concept into a SEQUENCE of progressive Cognitive Frames. Each frame is a",
      "viewport-complete cognitive STATE that teaches one slice and transitions to the next — never a",
      "scrolling document. A good sequence moves from intuition → precise definition → worked example",
      "→ connection/edge-cases, but adapt to the concept. Each frame names a `sub_focus` (the exact",
      "slice it teaches) so a downstream composer can distill DIFFERENT anchors for each.",
      "Respond with JSON only (no markdown fences) matching:",
      '{"frames":[{"title":"short frame title","sub_focus":"the precise slice this frame teaches","archetype":"concept-first|image-led|compare|formal|example-led","slots":["core_concept","definition","key_formula","diagram","relationship","mental_model","table","key_example","misconception","memory_cue"],"intent":"introduce|build|illustrate|connect|deepen|summarize"}],"lookahead":[{"title":"opening frame of the likely NEXT step","sub_focus":"what that next step introduces","archetype":"concept-first","slots":["core_concept"],"trigger_assumption":"learner masters this concept and advances"}],"pacing":{"strategy":"progressive","notes":"why this sequence"}}',
      `Rules: 1–${this.maxFrames} frames (fewer is better — never pad). Each frame's \`slots\` lists ONLY`,
      "the MCCR anchors that frame will actually fill (≤ 7 per frame so it fits one screen); always",
      "include core_concept. A frame should carry a COMPLETE slice — formula, worked example, and the",
      "misconception it attracts belong on the board, not behind a link. Order frames so understanding",
      "compounds. The FIRST frame introduces; the LAST consolidates. Distinct sub_focus per frame —",
      "no two frames teach the same slice.",
      "`lookahead` (0 or 1 entries): the OPENING frame you predict the learner will need NEXT once they",
      "master this concept, with the `trigger_assumption` behind the bet. Omit it if the next step is",
      "unclear. It is discardable — a pre-warm hint, never part of this lesson.",
      // R2a (ADR-0057 D1): when the frame is taught FROM a source, decompose THE PASSAGE.
      ...(excerpts.length > 0
        ? [
            "SOURCE MODE: you are teaching FROM the document passage(s) below. Decompose THIS passage",
            "into frames — each frame teaches a slice OF the passage, in its reading order. Anchor every",
            "`sub_focus` to what the passage actually says; never introduce material it does not cover.",
          ]
        : []),
      depthGuidance,
    ].join("\n");
    const sourceSuffix =
      excerpts.length > 0
        ? `\n\nSOURCE PASSAGES (decompose these, in order):\n${sourceBlock(excerpts)}`
        : "";
    return {
      prompt: `Concept to decompose into frames: ${title}\nLearner goal: ${goal}${sourceSuffix}`,
      system,
      // Enough room for a multi-frame plan + a bounded thinking phase; at 2048 with uncapped
      // thinking on gemini-2.5-flash the response was starved to empty text → 100% fallback.
      maxTokens: 4096,
      thinkingBudget: 1024,
      responseSchema: OUTPUT_CONTRACT_SCHEMA,
      invocation_key: `${this.manifest.id}:${packet.packet_id}:plan`,
    };
  }

  private buildResponsePacket(
    packet: CognitionPacket,
    plan: FramePlan,
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
        frame_plan: plan,
        model: meta.model,
        ...(meta.fallbackReason ? { fallback_reason: meta.fallbackReason } : {}),
        prepared_lease_id: this.preparedLeaseId,
      },
      evidence: [{ kind: "frame-plan", source_packet_id: packet.packet_id, model: meta.model }],
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

  private buildTrace(packet: CognitionPacket, plan: FramePlan, model: string): ReasoningTrace {
    const frameCount = plan.frames.length;
    return {
      trace_id: packet.trace_id ?? "",
      producer_cid: this.manifest.id,
      session_id: packet.session_id ?? null,
      task_interpretation: `decompose "${conceptTitleOf(packet)}" into progressive Cognitive Frames`,
      strategy: "progressive-frame-decomposition",
      claims: [
        {
          claim_id: `${packet.packet_id}-claim-0`,
          statement: `${frameCount} frame(s): ${plan.frames.map((f) => f.title).join(" → ")}`,
          confidence: model === "deterministic" ? 0.5 : 0.82,
        },
      ],
      decision: `planned a ${frameCount}-frame sequence via ${model}`,
      uncertainty_estimate: model === "deterministic" ? 0.5 : 0.18,
      self_critique:
        model === "deterministic"
          ? "deterministic fallback — a single frame; no decomposition; degradation is visible"
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
