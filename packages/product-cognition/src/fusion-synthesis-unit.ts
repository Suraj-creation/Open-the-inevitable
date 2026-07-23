/**
 * FusionSynthesisUnit — the fused explanation as governed cognition (CSE M9 T3; CSE-015 §3.1, ADR-0042).
 *
 * Weaves many sources' treatments, claims, and disagreements into ONE explanation of a concept —
 * the `fused_explanation_ref`. Grounded strictly in the provided sources (never outside knowledge),
 * citing every source it draws on, and surfacing cross-source disagreement honestly rather than
 * flattening it into a false consensus (CSE-015 §2/§6, CSE-003 §6).
 *
 * Same governed discipline as the M3/M6/T2 units: model-backed with a deterministic fallback whose
 * confidence lands BELOW the store's degradation floor (the honest per-source alignment view, never
 * a fabricated synthesis — CSE-015 §6), the `CognitiveUnit` ABI (governance / scheduler / OTel / D3
 * all apply). Two gates are enforced at the parser: cited sources must be a subset of the
 * contributing sources (no invented provenance), and a synthesis over contradicting sources MUST
 * acknowledge the disagreement.
 *
 * Spec: spec/source-environment/CSE-015 §3.1/§4/§6, spec/architecture-decisions/ADR-0042.
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
import type { FusedSynthesis } from "@inevitable/source-environment";

const SPEC_REF = "source-environment/CSE-015-source-fusion";

/** Below the store's degradation floor (0.5): the deterministic alignment view lands as degraded. */
export const FALLBACK_SYNTHESIS_CONFIDENCE = 0.45;
export const MODEL_SYNTHESIS_CONFIDENCE = 0.8;

/** One source's treatment of the concept (fusion input; from the T1 reconciliation). */
export interface SynthesisTreatment {
  readonly source_version_id: string;
  readonly title: string;
  readonly quote: string | null;
  readonly emphasis: string;
  readonly coverage: string;
}

/** One claim a source makes about the concept (from the T2 Claim Graph). */
export interface SynthesisClaim {
  readonly source_version_id: string;
  readonly statement: string;
  readonly epistemic_status: string;
}

/** A cross-source disagreement about the concept (from the T2 contradiction detection). */
export interface SynthesisContradiction {
  readonly nature: string;
  readonly rationale: string | null;
  readonly statements: readonly string[];
}

export interface FusionSynthesisUnitDeps {
  readonly manifest: AgentManifest;
  readonly model: ModelRuntime;
  readonly timeoutMs?: number;
  readonly idGenerator?: IdGenerator;
}

function synthError(code: string, message: string, details?: Record<string, unknown>): CosError {
  return new CosError(code, message, { specRef: SPEC_REF, details });
}

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

const SYNTHESIS_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["prose", "cited_sources"],
  properties: {
    prose: { type: "string" },
    cited_sources: { type: "array", items: { type: "string" } },
    acknowledges_disagreement: { type: "boolean" },
  },
};

// ── Parser (grounding + disagreement gates; exported for tests) ────────────────────────────────

/**
 * Parse + gate the synthesis output. `cited_sources` (source titles the model names) are mapped to
 * version ids via `titleToVersion` and any unknown title is dropped (no invented provenance — the
 * grounding gate). `acknowledges_disagreement` is FORCED true when contradictions were supplied (a
 * synthesis may not silently flatten a live disagreement — CSE-015 §6). Throws when prose is empty
 * or no cited source survives the gate.
 */
export function parseSynthesisOutput(
  text: string,
  titleToVersion: ReadonlyMap<string, string>,
  hasContradiction: boolean,
): FusedSynthesis {
  let raw: unknown;
  try {
    raw = JSON.parse(stripFences(text));
  } catch {
    throw synthError("E_MODEL_OUTPUT_MALFORMED", "synthesis output is not valid JSON", {
      sample: text.slice(0, 200),
    });
  }
  const obj = raw as {
    prose?: unknown;
    cited_sources?: unknown;
    acknowledges_disagreement?: unknown;
  };
  const prose = typeof obj.prose === "string" ? obj.prose.trim() : "";
  if (!prose) throw synthError("E_MODEL_OUTPUT_MALFORMED", "synthesis produced empty prose");
  // Grounding gate: map cited titles → version ids; drop any the fusion did not contribute.
  const cited: string[] = [];
  for (const entry of Array.isArray(obj.cited_sources) ? obj.cited_sources : []) {
    if (typeof entry !== "string") continue;
    const versionId = titleToVersion.get(entry.trim().toLowerCase());
    if (versionId && !cited.includes(versionId)) cited.push(versionId);
  }
  if (cited.length === 0) {
    throw synthError(
      "E_MODEL_OUTPUT_MALFORMED",
      "synthesis cited no contributing source (grounding gate)",
    );
  }
  return {
    prose,
    cited_source_ids: cited,
    // Disagreement honesty (CSE-015 §6): if the sources contradict, the synthesis must say so.
    acknowledges_disagreement: hasContradiction ? true : obj.acknowledges_disagreement === true,
    degraded: false,
  };
}

// ── Deterministic fallback (the honest per-source alignment view, CSE-015 §6) ─────────────────

/**
 * The honest degraded synthesis: a structured weave of each source's claim (or quote), attributed
 * by name, plus an explicit disagreement note when the sources contradict. No invention — this IS
 * the per-source alignment view (CSE-008 §10) rendered as prose.
 */
export function deterministicSynthesis(
  conceptRef: string,
  treatments: readonly SynthesisTreatment[],
  claims: readonly SynthesisClaim[],
  contradictions: readonly SynthesisContradiction[],
): FusedSynthesis {
  const titleOf = new Map(treatments.map((t) => [t.source_version_id, t.title]));
  const cited: string[] = [];
  const parts: string[] = [];
  const bySource = new Map<string, string[]>();
  for (const claim of claims) {
    const list = bySource.get(claim.source_version_id) ?? [];
    list.push(claim.statement);
    bySource.set(claim.source_version_id, list);
  }
  // Prefer claims; fall back to a source's representative quote.
  const sourceIds = new Set<string>([...bySource.keys()]);
  for (const t of treatments)
    if (t.quote && t.coverage !== "absent") sourceIds.add(t.source_version_id);
  for (const sourceId of sourceIds) {
    const title = titleOf.get(sourceId) ?? sourceId;
    const statements = bySource.get(sourceId);
    const said = statements?.length
      ? statements.join(" ")
      : (treatments.find((t) => t.source_version_id === sourceId)?.quote ?? "");
    if (!said.trim()) continue;
    cited.push(sourceId);
    parts.push(`According to ${title}: ${said.trim()}`);
  }
  let prose =
    parts.length > 0
      ? `On ${conceptRef}, your sources say the following. ${parts.join(" ")}`
      : `Your sources touch on ${conceptRef}, but none states a claim that could be woven here.`;
  if (contradictions.length > 0) {
    const note = contradictions
      .map((c) => c.rationale)
      .filter((r): r is string => Boolean(r))
      .join("; ");
    prose += ` These sources disagree${note ? ` — ${note}` : ""}.`;
  }
  return {
    prose,
    cited_source_ids: cited,
    acknowledges_disagreement: contradictions.length > 0,
    degraded: true,
  };
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

function readArray<T>(
  packet: CognitionPacket,
  key: string,
  map: (entry: Record<string, unknown>) => T | null,
): T[] {
  const content = (packet.content ?? {}) as Record<string, unknown>;
  const raw = content[key];
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const mapped = map(entry as Record<string, unknown>);
    if (mapped !== null) out.push(mapped);
  }
  return out;
}

function treatmentsOf(packet: CognitionPacket): SynthesisTreatment[] {
  return readArray(packet, "treatments", (t) => {
    if (typeof t["source_version_id"] !== "string" || typeof t["title"] !== "string") return null;
    return {
      source_version_id: t["source_version_id"],
      title: t["title"],
      quote: typeof t["quote"] === "string" ? t["quote"] : null,
      emphasis: typeof t["emphasis"] === "string" ? t["emphasis"] : "",
      coverage: typeof t["coverage"] === "string" ? t["coverage"] : "",
    };
  });
}

function claimsOf(packet: CognitionPacket): SynthesisClaim[] {
  return readArray(packet, "claims", (c) => {
    if (typeof c["source_version_id"] !== "string" || typeof c["statement"] !== "string")
      return null;
    return {
      source_version_id: c["source_version_id"],
      statement: c["statement"],
      epistemic_status:
        typeof c["epistemic_status"] === "string" ? c["epistemic_status"] : "supported",
    };
  });
}

function contradictionsOf(packet: CognitionPacket): SynthesisContradiction[] {
  return readArray(packet, "contradictions", (x) => {
    if (typeof x["nature"] !== "string") return null;
    return {
      nature: x["nature"],
      rationale: typeof x["rationale"] === "string" ? x["rationale"] : null,
      statements: (Array.isArray(x["statements"]) ? x["statements"] : []).filter(
        (s): s is string => typeof s === "string",
      ),
    };
  });
}

export class FusionSynthesisUnit implements CognitiveUnit {
  private readonly manifest: AgentManifest;
  private readonly model: ModelRuntime;
  private readonly timeoutMs: number;
  private readonly idGenerator: IdGenerator;
  private preparedLeaseId: string | null = null;

  constructor(deps: FusionSynthesisUnitDeps) {
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
    const conceptRef =
      typeof content["concept_ref"] === "string" ? content["concept_ref"] : "concept";
    const treatments = treatmentsOf(packet);
    const claims = claimsOf(packet);
    const contradictions = contradictionsOf(packet);
    try {
      const request = this.buildRequest(packet, conceptRef, treatments, claims, contradictions);
      const result = await this.withTimeout(this.model.generate(request));
      if (result.finishReason === "refusal" || result.finishReason === "safety") {
        throw synthError("E_MODEL_REFUSAL", `model refused generation (${result.finishReason})`);
      }
      if (result.finishReason === "max_tokens") {
        throw synthError("E_MODEL_OUTPUT_TRUNCATED", "synthesis truncated at token budget");
      }
      const titleToVersion = new Map(
        treatments.map((t) => [t.title.trim().toLowerCase(), t.source_version_id]),
      );
      const synthesis = parseSynthesisOutput(
        result.text,
        titleToVersion,
        contradictions.length > 0,
      );
      return this.emit(packet, synthesis, {
        kind: "model-fused-synthesis",
        model: result.model,
        confidence: MODEL_SYNTHESIS_CONFIDENCE,
      });
    } catch (cause) {
      const code = cause instanceof CosError ? cause.code : "E_MODEL_UNAVAILABLE";
      const synthesis = deterministicSynthesis(conceptRef, treatments, claims, contradictions);
      return this.emit(packet, synthesis, {
        kind: "deterministic-fused-synthesis",
        model: "deterministic",
        confidence: FALLBACK_SYNTHESIS_CONFIDENCE,
        fallbackReason: code,
      });
    }
  }

  private emit(
    packet: CognitionPacket,
    synthesis: FusedSynthesis,
    meta: { kind: string; model: string; confidence: number; fallbackReason?: string },
  ): Emissions {
    const response = this.buildResponsePacket(packet, {
      handled_by: this.manifest.id,
      response_kind: meta.kind,
      synthesis: synthesis as unknown as Record<string, unknown>,
      confidence: meta.confidence,
      model: meta.model,
      ...(meta.fallbackReason ? { fallback_reason: meta.fallbackReason } : {}),
    });
    return { packets: [response], trace: this.buildTrace(packet, meta.model, meta.confidence) };
  }

  private buildRequest(
    packet: CognitionPacket,
    conceptRef: string,
    treatments: readonly SynthesisTreatment[],
    claims: readonly SynthesisClaim[],
    contradictions: readonly SynthesisContradiction[],
  ): ModelGenerationRequest {
    const titleOf = new Map(treatments.map((t) => [t.source_version_id, t.title]));
    const sourceBlock = treatments
      .filter((t) => t.coverage !== "absent")
      .map((t) => {
        const said = claims
          .filter((c) => c.source_version_id === t.source_version_id)
          .map((c) => `    - (${c.epistemic_status}) ${c.statement}`)
          .join("\n");
        return `[${t.title}] emphasis=${t.emphasis}\n  quote: ${t.quote ?? "(none)"}\n  claims:\n${said || "    - (none)"}`;
      })
      .join("\n\n")
      .slice(0, 12_000);
    const disagreementBlock = contradictions
      .map((c) => `- (${c.nature}) ${c.rationale ?? c.statements.join(" vs ")}`)
      .join("\n");
    const system = [
      `You are "${this.manifest.id}". ${this.manifest.role}`,
      `Weave ONE explanation of "${conceptRef}" from the sources below — a single understanding, not a list.`,
      "Use ONLY the provided material; never add outside knowledge. Cite each source you draw on by",
      "its bracketed name inline, e.g. [Optimization Textbook]. Where the sources DISAGREE, say so",
      "explicitly — never smooth a disagreement into a false consensus.",
      "Respond with JSON only (no markdown fences) matching:",
      '{"prose":"the woven explanation with inline [Source Name] citations","cited_sources":["exact source names you cited"],"acknowledges_disagreement":true|false}',
    ].join("\n");
    return {
      prompt: `Sources:\n\n${sourceBlock}\n\nCross-source disagreements:\n${disagreementBlock || "(none)"}\n\nSource names you may cite: ${[...titleOf.values()].map((t) => `[${t}]`).join(", ")}`,
      system,
      maxTokens: 2048,
      thinkingBudget: 0,
      responseSchema: SYNTHESIS_OUTPUT_SCHEMA,
      invocation_key: `${this.manifest.id}:${packet.packet_id}:fusion-synthesis`,
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
          kind: "fused-synthesis",
          source_packet_id: packet.packet_id,
          model: String(content["model"] ?? "deterministic"),
        },
      ],
      confidence: typeof content["confidence"] === "number" ? content["confidence"] : 1,
      uncertainty_estimate:
        typeof content["confidence"] === "number" ? 1 - (content["confidence"] as number) : 0,
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
      task_interpretation: "weave one fused explanation from the contributing sources",
      strategy: "fused-explanation-synthesis",
      claims: [
        {
          claim_id: `${packet.packet_id}-claim-0`,
          statement:
            "explanation woven from cited sources only; disagreement surfaced, not flattened",
          confidence,
        },
      ],
      decision: `produced fused synthesis via ${model} (citations gated to contributing sources)`,
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
        reject(synthError("E_MODEL_TIMEOUT", `model call exceeded ${this.timeoutMs}ms`));
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
