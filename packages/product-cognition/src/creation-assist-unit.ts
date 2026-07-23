/**
 * CreationAssistUnit — the assist grammar of Creative Cognition (CSE M11 T1; CSE-016 §3.2, ADR-0049).
 *
 * The system is a THINKING PARTNER, NOT A GHOSTWRITER (Constitution #5). This unit offers exactly four
 * disclosed assists over the learner's OWN creation, and **none of them can be the artifact**:
 *
 *  - `scaffold`   → an empty labelled STRUCTURE the learner fills (slots + hints; never content).
 *  - `critique`   → adversarial FINDINGS on the learner's draft (issues, not rewrites).
 *  - `provocation`→ generative QUESTIONS that widen the space (openings, never answers).
 *  - `reference`  → grounded POINTERS to concepts the learner can cite (never prose).
 *
 * The law is STRUCTURAL: each mode's output schema is slots / findings / questions / refs — there is
 * no prose/content/draft field for the model to put the learner's essay in, so even a model that
 * tried to ghostwrite has nowhere to write. Model-backed with deterministic fallbacks; every assist
 * carries `disclosed: true` + the agent cid.
 *
 * Spec: spec/source-environment/CSE-016 §2/§3.2, spec/architecture-decisions/ADR-0049.
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
  isCreationAssistKind,
  type CreationAssistKind,
  type CreationReferenceRef,
  type CritiqueFinding,
  type ScaffoldSlot,
} from "@inevitable/source-environment";

const SPEC_REF = "source-environment/CSE-016-creative-cognition";

export interface CreationAssistUnitDeps {
  readonly manifest: AgentManifest;
  readonly model: ModelRuntime;
  readonly timeoutMs?: number;
  readonly idGenerator?: IdGenerator;
}

/** The shape of the parsed assist (exactly one field set, matching the mode). */
export interface AssistProduct {
  readonly kind: CreationAssistKind;
  readonly slots?: readonly ScaffoldSlot[];
  readonly findings?: readonly CritiqueFinding[];
  readonly questions?: readonly string[];
  readonly refs?: readonly CreationReferenceRef[];
  readonly degraded: boolean;
}

function assistError(code: string, message: string, details?: Record<string, unknown>): CosError {
  return new CosError(code, message, { specRef: SPEC_REF, details });
}

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

const humanize = (ref: string): string =>
  ref
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

// ── Deterministic scaffolds (structure only — the honest offline fallback) ────────────────────

const SCAFFOLD_TEMPLATES: Record<string, readonly ScaffoldSlot[]> = {
  argument: [
    { label: "Claim", hint: "the single proposition you are defending" },
    { label: "Evidence", hint: "the facts/data that support the claim" },
    { label: "Counter-evidence", hint: "the strongest objection, stated fairly" },
    { label: "Rebuttal", hint: "why the claim survives that objection" },
    { label: "Conclusion", hint: "what follows if the claim holds" },
  ],
  essay: [
    { label: "Thesis", hint: "the one idea the essay argues" },
    { label: "Context", hint: "why this matters / what the reader needs first" },
    { label: "Body", hint: "each supporting point, in order, one paragraph each" },
    { label: "Conclusion", hint: "what the reader should now believe or do" },
  ],
  hypothesis: [
    { label: "Question", hint: "the specific thing you want to know" },
    { label: "Hypothesis", hint: "your testable proposed answer" },
    { label: "Prediction", hint: "what you'd observe if it is true" },
    { label: "Test", hint: "how you'd distinguish true from false" },
    { label: "Alternatives", hint: "other explanations you must rule out" },
  ],
  "experiment-design": [
    { label: "Question & hypothesis", hint: "what you're testing and your predicted answer" },
    { label: "Variables", hint: "independent / dependent / controlled" },
    { label: "Method", hint: "the procedure, reproducibly" },
    { label: "Analysis plan", hint: "how the data decides the hypothesis" },
    { label: "Threats to validity", hint: "confounds and how you mitigate them" },
  ],
  proof: [
    { label: "Statement", hint: "exactly what is to be proved" },
    { label: "Givens", hint: "assumptions/definitions you may use" },
    { label: "Strategy", hint: "the shape of the argument (direct/contradiction/induction)" },
    { label: "Steps", hint: "each inference, justified" },
    { label: "Conclusion", hint: "what was shown — QED" },
  ],
  proposal: [
    { label: "Problem", hint: "the need, made concrete" },
    { label: "Approach", hint: "what you propose to do" },
    { label: "Why it works", hint: "the mechanism / evidence it will succeed" },
    { label: "Risks", hint: "what could go wrong and your mitigation" },
    { label: "Plan", hint: "steps, milestones, what success looks like" },
  ],
};

const GENERIC_SCAFFOLD: readonly ScaffoldSlot[] = [
  { label: "Opening", hint: "frame the work and why it matters" },
  { label: "Development", hint: "the substance, in a deliberate order" },
  { label: "Close", hint: "what it amounts to / what follows" },
];

const GENERIC_PROVOCATIONS: readonly string[] = [
  "What would have to be false for this to break?",
  "What is the strongest counterargument — and does your work survive it?",
  "What are you assuming without having stated it?",
  "What adjacent field has already solved a version of this problem?",
];

const GENERIC_CRITIQUE: readonly CritiqueFinding[] = [
  {
    severity: "major",
    where: "(whole draft)",
    issue: "Some claims may lack explicit evidence or a citation.",
    suggestion: "Mark every assertion and attach its support; flag any that stand unsupported.",
  },
  {
    severity: "minor",
    where: "(whole draft)",
    issue: "Unstated assumptions may be doing hidden work.",
    suggestion: "List what you take for granted; decide which you must defend.",
  },
];

// ── Output contracts + parsers (no prose field anywhere — the no-ghostwriter law is structural) ──

const SCHEMAS: Record<CreationAssistKind, Record<string, unknown>> = {
  scaffold: {
    type: "object",
    required: ["slots"],
    properties: {
      slots: {
        type: "array",
        items: {
          type: "object",
          required: ["label", "hint"],
          properties: { label: { type: "string" }, hint: { type: "string" } },
        },
      },
    },
  },
  critique: {
    type: "object",
    required: ["findings"],
    properties: {
      findings: {
        type: "array",
        items: {
          type: "object",
          required: ["severity", "where", "issue", "suggestion"],
          properties: {
            severity: { type: "string", enum: ["minor", "major", "blocking"] },
            where: { type: "string" },
            issue: { type: "string" },
            suggestion: { type: "string" },
          },
        },
      },
    },
  },
  provocation: {
    type: "object",
    required: ["questions"],
    properties: { questions: { type: "array", items: { type: "string" } } },
  },
  reference: {
    type: "object",
    required: ["refs"],
    properties: {
      refs: {
        type: "array",
        items: {
          type: "object",
          required: ["label", "source"],
          properties: { label: { type: "string" }, source: { type: "string" } },
        },
      },
    },
  },
};

/** Parse an assist. Only the fields matching `mode` are read — a prose/content field, if the model
 * emitted one, is silently dropped (there is no schema slot for it). The no-ghostwriter law holds. */
export function parseAssist(mode: CreationAssistKind, text: string): AssistProduct {
  let raw: unknown;
  try {
    raw = JSON.parse(stripFences(text));
  } catch {
    throw assistError("E_MODEL_OUTPUT_MALFORMED", `${mode} assist output is not valid JSON`, {
      sample: text.slice(0, 200),
    });
  }
  const obj = raw as Record<string, unknown>;
  if (mode === "scaffold") {
    const slots = (Array.isArray(obj["slots"]) ? obj["slots"] : [])
      .map((s) => s as Record<string, unknown>)
      .filter((s) => typeof s["label"] === "string" && (s["label"] as string).trim())
      .map((s) => ({ label: (s["label"] as string).trim(), hint: String(s["hint"] ?? "").trim() }));
    if (slots.length === 0) throw assistError("E_MODEL_OUTPUT_MALFORMED", "scaffold had no slots");
    return { kind: "scaffold", slots, degraded: false };
  }
  if (mode === "critique") {
    const findings = (Array.isArray(obj["findings"]) ? obj["findings"] : [])
      .map((f) => f as Record<string, unknown>)
      .filter((f) => typeof f["issue"] === "string" && (f["issue"] as string).trim())
      .map((f) => ({
        severity: (["minor", "major", "blocking"].includes(String(f["severity"]))
          ? f["severity"]
          : "major") as CritiqueFinding["severity"],
        where: String(f["where"] ?? "(draft)").trim(),
        issue: (f["issue"] as string).trim(),
        suggestion: String(f["suggestion"] ?? "").trim(),
      }));
    // Empty findings is valid + honest ("no issues found"), not an error.
    return { kind: "critique", findings, degraded: false };
  }
  if (mode === "provocation") {
    const questions = (Array.isArray(obj["questions"]) ? obj["questions"] : [])
      .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
      .map((q) => q.trim());
    if (questions.length === 0)
      throw assistError("E_MODEL_OUTPUT_MALFORMED", "provocation had no questions");
    return { kind: "provocation", questions, degraded: false };
  }
  const refs = (Array.isArray(obj["refs"]) ? obj["refs"] : [])
    .map((r) => r as Record<string, unknown>)
    .filter((r) => typeof r["label"] === "string" && (r["label"] as string).trim())
    .map((r) => ({
      label: (r["label"] as string).trim(),
      source: String(r["source"] ?? "").trim(),
    }));
  return { kind: "reference", refs, degraded: false };
}

/** The deterministic, honest assist when the model is unavailable — structure/questions/refs only. */
export function deterministicAssist(
  mode: CreationAssistKind,
  kind: string,
  conceptRefs: readonly string[],
): AssistProduct {
  switch (mode) {
    case "scaffold":
      return {
        kind: "scaffold",
        slots: SCAFFOLD_TEMPLATES[kind] ?? GENERIC_SCAFFOLD,
        degraded: true,
      };
    case "provocation":
      return { kind: "provocation", questions: GENERIC_PROVOCATIONS, degraded: true };
    case "reference":
      return {
        kind: "reference",
        refs: conceptRefs.map((r) => ({ label: humanize(r), source: `concept:${r}` })),
        degraded: true,
      };
    case "critique":
    default:
      return { kind: "critique", findings: GENERIC_CRITIQUE, degraded: true };
  }
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

export class CreationAssistUnit implements CognitiveUnit {
  private readonly manifest: AgentManifest;
  private readonly model: ModelRuntime;
  private readonly timeoutMs: number;
  private readonly idGenerator: IdGenerator;
  private preparedLeaseId: string | null = null;

  constructor(deps: CreationAssistUnitDeps) {
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
    const content = (packet.content ?? {}) as Record<string, unknown>;
    const modeRaw = typeof content["mode"] === "string" ? content["mode"] : "scaffold";
    const mode: CreationAssistKind = isCreationAssistKind(modeRaw) ? modeRaw : "scaffold";
    const kind = typeof content["kind"] === "string" ? content["kind"] : "essay";
    const title = typeof content["title"] === "string" ? content["title"] : "";
    const draft = typeof content["draft"] === "string" ? content["draft"] : "";
    const conceptRefs = (
      Array.isArray(content["concept_refs"]) ? content["concept_refs"] : []
    ).filter((r): r is string => typeof r === "string");
    try {
      const request = this.buildRequest(packet, mode, kind, title, draft, conceptRefs);
      const result = await this.withTimeout(this.model.generate(request));
      if (result.finishReason === "refusal" || result.finishReason === "safety") {
        throw assistError("E_MODEL_REFUSAL", `model refused generation (${result.finishReason})`);
      }
      if (result.finishReason === "max_tokens") {
        throw assistError("E_MODEL_OUTPUT_TRUNCATED", "assist truncated at token budget");
      }
      const product = parseAssist(mode, result.text);
      return this.emit(packet, product, result.model);
    } catch (cause) {
      const code = cause instanceof CosError ? cause.code : "E_MODEL_UNAVAILABLE";
      const product = deterministicAssist(mode, kind, conceptRefs);
      return this.emit(packet, product, "deterministic", code);
    }
  }

  private emit(
    packet: CognitionPacket,
    product: AssistProduct,
    model: string,
    fallbackReason?: string,
  ): Emissions {
    const response = this.buildResponsePacket(packet, {
      handled_by: this.manifest.id,
      response_kind: `creation-${product.kind}`,
      assist: product as unknown as Record<string, unknown>,
      model,
      ...(fallbackReason ? { fallback_reason: fallbackReason } : {}),
    });
    return { packets: [response], trace: this.buildTrace(packet, product.kind, model) };
  }

  private buildRequest(
    packet: CognitionPacket,
    mode: CreationAssistKind,
    kind: string,
    title: string,
    draft: string,
    conceptRefs: readonly string[],
  ): ModelGenerationRequest {
    const about = `${kind}${title ? ` — "${title}"` : ""}${conceptRefs.length ? ` (concepts: ${conceptRefs.join(", ")})` : ""}`;
    const guard =
      "You are a thinking partner, NOT a ghostwriter. You must NOT write the learner's artifact or any" +
      " part of its prose. Respond with JSON only (no fences).";
    let instruction: string;
    if (mode === "scaffold") {
      instruction = `Produce an EMPTY structure for a ${about}: labelled slots the learner will fill, each with a one-line hint of what belongs there. No content, only the skeleton. JSON: {"slots":[{"label":"...","hint":"..."}]}`;
    } else if (mode === "critique") {
      instruction = `Adversarially review the learner's DRAFT below (a ${about}). Report weak links, missing evidence, unstated assumptions, and logical gaps as findings — never a rewrite. JSON: {"findings":[{"severity":"minor|major|blocking","where":"a short quote/section","issue":"...","suggestion":"a direction to fix, not replacement prose"}]}\n\nDRAFT:\n${draft.slice(0, 12_000)}`;
    } else if (mode === "provocation") {
      instruction = `Produce generative QUESTIONS that widen the learner's thinking about their ${about}${draft ? " and the draft below" : ""} — openings, never answers, never claims. JSON: {"questions":["...","..."]}${draft ? `\n\nDRAFT:\n${draft.slice(0, 8_000)}` : ""}`;
    } else {
      instruction = `From the concepts the learner is drawing on, list grounded pointers they could CITE in their ${about} — only the provided concepts, no outside sources, no prose. JSON: {"refs":[{"label":"...","source":"concept:<id>"}]}\n\nConcepts: ${conceptRefs.join(", ") || "(none provided)"}`;
    }
    return {
      prompt: instruction,
      system: `You are "${this.manifest.id}". ${this.manifest.role}\n${guard}`,
      maxTokens: 1536,
      thinkingBudget: 0,
      responseSchema: SCHEMAS[mode],
      invocation_key: `${this.manifest.id}:${packet.packet_id}:creation-${mode}`,
    };
  }

  private buildResponsePacket(
    packet: CognitionPacket,
    content: Record<string, unknown>,
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
        ...content,
        prepared_lease_id: this.preparedLeaseId,
        intent_lease_id:
          ((packet.content ?? {}) as Record<string, unknown>)["intent_lease_id"] ?? null,
      },
      evidence: [
        {
          kind: "creation-assist",
          source_packet_id: packet.packet_id,
          model: String(content["model"]),
        },
      ],
      confidence: 0.8,
      uncertainty_estimate: 0.2,
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

  private buildTrace(packet: CognitionPacket, mode: string, model: string): ReasoningTrace {
    return {
      trace_id: packet.trace_id ?? "",
      producer_cid: this.manifest.id,
      session_id: packet.session_id ?? null,
      task_interpretation: `offer a ${mode} assist for the learner's creation (never the artifact)`,
      strategy: `creation-${mode}`,
      claims: [
        {
          claim_id: `${packet.packet_id}-claim-0`,
          statement: "assist is structure/findings/questions/refs — never the learner's artifact",
          confidence: 0.9,
        },
      ],
      decision: `produced a ${mode} assist via ${model} (no-ghostwriter law structural)`,
      uncertainty_estimate: 0.1,
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
        reject(assistError("E_MODEL_TIMEOUT", `model call exceeded ${this.timeoutMs}ms`));
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
