/**
 * TemporalResearchUnit — the Temporal Knowledge Model as governed cognition (CSE M9 TKM T1;
 * CSE-006 §3.3/§8, ADR-0044).
 *
 * Given a concept, researches its development through time via GOVERNED WEB SEARCH (the model
 * adapter's `webSearch` grounding), producing an ordered series of epistemic states — origin →
 * milestones → shifts → current debate → open problems. The grounding law is absolute (CSE-006
 * §4/§6): **no state without a real, fetchable citation**; and a date is never invented (`era` is
 * null when unknown). Timelines are HONESTLY SPARSE (§8): a niche concept yields a short strip, never
 * padded. The model call is D3-recorded (with its citations), so replay shows the timeline as it was
 * then.
 *
 * Spec: spec/source-environment/CSE-006 §3.3, spec/architecture-decisions/ADR-0044.
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
  EPISTEMIC_STATE_KINDS,
  isEpistemicStateKind,
  type EpistemicState,
  type FrontierExternalRef,
} from "@inevitable/source-environment";

const SPEC_REF = "source-environment/CSE-006-living-knowledge";

/** At most this many citations attach to a single state (T1: the search's grounded pool, capped). */
const MAX_REFS_PER_STATE = 4;

/** The canonical chronological rank of each phase (era ties break by phase, then model order). */
const KIND_ORDER: Record<string, number> = {
  origin: 0,
  milestone: 1,
  shift: 2,
  "current-debate": 3,
  "open-problem": 4,
};

export interface TemporalResearchUnitDeps {
  readonly manifest: AgentManifest;
  readonly model: ModelRuntime;
  readonly timeoutMs?: number;
  readonly idGenerator?: IdGenerator;
}

function temporalError(code: string, message: string, details?: Record<string, unknown>): CosError {
  return new CosError(code, message, { specRef: SPEC_REF, details });
}

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

/** The leading 4-digit year in an era string ("mid-1980s" → 1980), or null (never invented). */
function eraYear(era: string | null): number | null {
  if (!era) return null;
  const match = era.match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

// ── Parser (grounding law + chronological order; exported for tests) ──────────────────────────

/**
 * Parse epistemic states from the model text and ground them in the REAL citations returned by the
 * web search. Grounding law (CSE-006 §4/§6): no real citation ⇒ no state (empty is honest, never a
 * fabricated history). Valid {kind, label, summary} states are admitted, carry the grounded citation
 * pool (capped), and are ordered chronologically: by era year when parseable, else by phase rank,
 * with the model's order as the stable tiebreak. Unknown kinds / empty labels drop; a null era is
 * kept (unknown date, never invented — §8).
 */
export function parseEpistemicStates(
  text: string,
  citations: readonly FrontierExternalRef[],
  asOf: string,
): EpistemicState[] {
  if (citations.length === 0) return []; // the grounding law, first
  let raw: unknown;
  try {
    raw = JSON.parse(stripFences(text));
  } catch {
    return []; // unparseable grounded text ⇒ honest empty
  }
  const obj = raw as { states?: unknown };
  if (!Array.isArray(obj.states)) return [];
  const refs = citations.slice(0, MAX_REFS_PER_STATE);
  const seen = new Set<string>();
  const states: (EpistemicState & { _ord: number })[] = [];
  for (const state of obj.states) {
    const s = state as { kind?: unknown; label?: unknown; summary?: unknown; era?: unknown };
    const kind = typeof s.kind === "string" ? s.kind : "";
    const label = typeof s.label === "string" ? s.label.trim() : "";
    const summary = typeof s.summary === "string" ? s.summary.trim() : "";
    if (!isEpistemicStateKind(kind) || !label) continue;
    const dedupeKey = `${kind}:${label.slice(0, 80)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const era = typeof s.era === "string" && s.era.trim() ? s.era.trim() : null;
    states.push({
      kind,
      label,
      summary: summary || label,
      era,
      external_refs: refs,
      as_of: asOf,
      _ord: states.length,
    });
  }
  // Chronological order: era year first (undated states sink to their phase position), then phase
  // rank, then the model's original order — deterministic and stable.
  states.sort((a, b) => {
    const ya = eraYear(a.era);
    const yb = eraYear(b.era);
    if (ya !== null && yb !== null && ya !== yb) return ya - yb;
    if (ya !== null && yb === null) return -1;
    if (ya === null && yb !== null) return 1;
    const ka = KIND_ORDER[a.kind] ?? 9;
    const kb = KIND_ORDER[b.kind] ?? 9;
    if (ka !== kb) return ka - kb;
    return a._ord - b._ord;
  });
  return states.map(({ _ord, ...state }) => {
    void _ord;
    return state;
  });
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

export class TemporalResearchUnit implements CognitiveUnit {
  private readonly manifest: AgentManifest;
  private readonly model: ModelRuntime;
  private readonly timeoutMs: number;
  private readonly idGenerator: IdGenerator;
  private preparedLeaseId: string | null = null;

  constructor(deps: TemporalResearchUnitDeps) {
    this.manifest = deps.manifest;
    this.model = deps.model;
    this.timeoutMs = deps.timeoutMs ?? 45_000;
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
    const conceptRef = typeof content["concept_ref"] === "string" ? content["concept_ref"] : "";
    const asOf = typeof content["as_of"] === "string" ? content["as_of"] : packet.timestamp;
    const definition = typeof content["definition"] === "string" ? content["definition"] : "";
    if (!conceptRef) {
      throw temporalError("E_TIMELINE_NO_CONCEPT", "temporal research requires a concept_ref", {
        packet_id: packet.packet_id,
      });
    }
    try {
      const request = this.buildRequest(packet, conceptRef, definition);
      const result = await this.withTimeout(this.model.generate(request));
      if (result.finishReason === "refusal" || result.finishReason === "safety") {
        throw temporalError("E_MODEL_REFUSAL", `model refused generation (${result.finishReason})`);
      }
      const citations: FrontierExternalRef[] = (result.citations ?? []).map((c) => ({
        uri: c.uri,
        title: c.title,
      }));
      const states = parseEpistemicStates(result.text, citations, asOf);
      return this.emit(packet, states, {
        kind: "model-temporal-research",
        model: result.model,
        degraded: states.length === 0,
      });
    } catch (cause) {
      const code = cause instanceof CosError ? cause.code : "E_MODEL_UNAVAILABLE";
      return this.emit(packet, [], {
        kind: "timeline-unavailable",
        model: "none",
        degraded: true,
        fallbackReason: code,
      });
    }
  }

  private emit(
    packet: CognitionPacket,
    states: readonly EpistemicState[],
    meta: { kind: string; model: string; degraded: boolean; fallbackReason?: string },
  ): Emissions {
    const response = this.buildResponsePacket(packet, {
      handled_by: this.manifest.id,
      response_kind: meta.kind,
      states: states as unknown as Record<string, unknown>[],
      degraded: meta.degraded,
      model: meta.model,
      ...(meta.fallbackReason ? { fallback_reason: meta.fallbackReason } : {}),
    });
    return { packets: [response], trace: this.buildTrace(packet, meta.model, states.length) };
  }

  private buildRequest(
    packet: CognitionPacket,
    conceptRef: string,
    definition: string,
  ): ModelGenerationRequest {
    const system = [
      `You are "${this.manifest.id}". ${this.manifest.role}`,
      "Use web search to trace the concept's development THROUGH TIME. Report only real, grounded",
      "points — if you cannot ground a point (or its date) in what you found, omit it or leave era null.",
      "Order does not matter in your output; each point is classified by phase.",
      "Respond with JSON only (no markdown fences):",
      `{"states":[{"kind":"${EPISTEMIC_STATE_KINDS.join("|")}","label":"short title","summary":"one grounded sentence","era":"1986" or "2010s" or null}]}`,
      "2–8 states; state what the sources say, not prior knowledge; never invent a date.",
    ].join("\n");
    return {
      prompt: `Concept: ${conceptRef}${definition ? `\nContext: ${definition}` : ""}\n\nResearch its history and current state.`,
      system,
      maxTokens: 2048,
      // Web-grounded generation (ADR-0043): search tool + real citations, no responseSchema.
      webSearch: true,
      invocation_key: `${this.manifest.id}:${packet.packet_id}:timeline`,
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
          kind: "temporal-research",
          source_packet_id: packet.packet_id,
          model: String(content["model"]),
        },
      ],
      confidence: content["degraded"] ? 0.4 : 0.8,
      uncertainty_estimate: content["degraded"] ? 0.6 : 0.2,
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

  private buildTrace(packet: CognitionPacket, model: string, stateCount: number): ReasoningTrace {
    return {
      trace_id: packet.trace_id ?? "",
      producer_cid: this.manifest.id,
      session_id: packet.session_id ?? null,
      task_interpretation: "trace a concept's trajectory through time via governed web search",
      strategy: "web-grounded-temporal-research",
      claims: [
        {
          claim_id: `${packet.packet_id}-claim-0`,
          statement:
            "epistemic states admitted only when grounded; dates never invented; sparse-honest",
          confidence: stateCount > 0 ? 0.8 : 0.4,
        },
      ],
      decision: `produced ${stateCount} grounded epistemic states via ${model}`,
      uncertainty_estimate: stateCount > 0 ? 0.2 : 0.6,
      self_critique: null,
      determinism_level: model === "none" ? "D2" : "D3",
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
        reject(temporalError("E_MODEL_TIMEOUT", `model call exceeded ${this.timeoutMs}ms`));
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
