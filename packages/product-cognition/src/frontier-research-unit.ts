/**
 * FrontierResearchUnit — the living-knowledge overlay as governed cognition (CSE M9 Frontier T1;
 * CSE-006 §3.2/§4/§6, ADR-0043).
 *
 * Given a concept, researches the current frontier via GOVERNED WEB SEARCH (the model adapter's
 * `webSearch` grounding), producing typed frontier entries — latest research, open questions,
 * competing theories, future directions. The grounding law is absolute here: **no frontier entry
 * exists without a real, fetchable citation** (CSE-006 §4/§6). When the search returns no real
 * citation (no model, no web, or nothing found), the overlay is honestly EMPTY — never a fabricated
 * frontier with an invented URL. The model call is D3-recorded (with its citations), so replay shows
 * the frontier as it was then (time-travel honesty, CSE-006 §4).
 *
 * Spec: spec/source-environment/CSE-006 §3.2, spec/architecture-decisions/ADR-0043.
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
  FRONTIER_ENTRY_KINDS,
  isFrontierEntryKind,
  type FrontierEntry,
  type FrontierExternalRef,
} from "@inevitable/source-environment";

const SPEC_REF = "source-environment/CSE-006-living-knowledge";

/** At most this many citations attach to a single entry (T1: the search's grounded pool, capped). */
const MAX_REFS_PER_ENTRY = 4;

export interface FrontierResearchUnitDeps {
  readonly manifest: AgentManifest;
  readonly model: ModelRuntime;
  readonly timeoutMs?: number;
  readonly idGenerator?: IdGenerator;
}

function frontierError(code: string, message: string, details?: Record<string, unknown>): CosError {
  return new CosError(code, message, { specRef: SPEC_REF, details });
}

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

// ── Parser (grounding law; exported for tests) ────────────────────────────────────────────────

/**
 * Parse frontier entries from the model text and ground them in the REAL citations returned by the
 * web search. The grounding law (CSE-006 §4/§6): if there are no real citations, NO entry survives
 * (honest empty — never a fabricated frontier). Otherwise each valid {kind, summary} entry is
 * admitted and carries the grounded citation pool (capped). Unknown kinds / empty summaries drop.
 * Lenient: search-grounded output is free text, not schema-validated JSON.
 */
export function parseFrontierEntries(
  text: string,
  citations: readonly FrontierExternalRef[],
  asOf: string,
): FrontierEntry[] {
  // The grounding law comes first: no real citation ⇒ no frontier, whatever the model wrote.
  if (citations.length === 0) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(stripFences(text));
  } catch {
    return []; // unparseable grounded text ⇒ honest empty, never a guess
  }
  const obj = raw as { entries?: unknown };
  if (!Array.isArray(obj.entries)) return [];
  const refs = citations.slice(0, MAX_REFS_PER_ENTRY);
  const entries: FrontierEntry[] = [];
  const seen = new Set<string>();
  for (const entry of obj.entries) {
    const e = entry as { kind?: unknown; summary?: unknown };
    const kind = typeof e.kind === "string" ? e.kind : "";
    const summary = typeof e.summary === "string" ? e.summary.trim() : "";
    if (!isFrontierEntryKind(kind) || !summary) continue;
    const dedupeKey = `${kind}:${summary.slice(0, 80)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    entries.push({ kind, summary, external_refs: refs, as_of: asOf });
  }
  return entries;
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

export class FrontierResearchUnit implements CognitiveUnit {
  private readonly manifest: AgentManifest;
  private readonly model: ModelRuntime;
  private readonly timeoutMs: number;
  private readonly idGenerator: IdGenerator;
  private preparedLeaseId: string | null = null;

  constructor(deps: FrontierResearchUnitDeps) {
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
      throw frontierError("E_FRONTIER_NO_CONCEPT", "frontier research requires a concept_ref", {
        packet_id: packet.packet_id,
      });
    }
    try {
      const request = this.buildRequest(packet, conceptRef, definition);
      const result = await this.withTimeout(this.model.generate(request));
      if (result.finishReason === "refusal" || result.finishReason === "safety") {
        throw frontierError("E_MODEL_REFUSAL", `model refused generation (${result.finishReason})`);
      }
      const citations: FrontierExternalRef[] = (result.citations ?? []).map((c) => ({
        uri: c.uri,
        title: c.title,
      }));
      const entries = parseFrontierEntries(result.text, citations, asOf);
      return this.emit(packet, entries, {
        kind: "model-frontier-research",
        model: result.model,
        // Grounded but empty (no citations found) is honest, not a failure — mark degraded so the
        // learner sees "no frontier found", never a blank pretending research succeeded.
        degraded: entries.length === 0,
      });
    } catch (cause) {
      const code = cause instanceof CosError ? cause.code : "E_MODEL_UNAVAILABLE";
      // Honest empty: no web ⇒ no frontier, never fabricated (CSE-006 §6).
      return this.emit(packet, [], {
        kind: "frontier-unavailable",
        model: "none",
        degraded: true,
        fallbackReason: code,
      });
    }
  }

  private emit(
    packet: CognitionPacket,
    entries: readonly FrontierEntry[],
    meta: { kind: string; model: string; degraded: boolean; fallbackReason?: string },
  ): Emissions {
    const response = this.buildResponsePacket(packet, {
      handled_by: this.manifest.id,
      response_kind: meta.kind,
      entries: entries as unknown as Record<string, unknown>[],
      degraded: meta.degraded,
      model: meta.model,
      ...(meta.fallbackReason ? { fallback_reason: meta.fallbackReason } : {}),
    });
    return { packets: [response], trace: this.buildTrace(packet, meta.model, entries.length) };
  }

  private buildRequest(
    packet: CognitionPacket,
    conceptRef: string,
    definition: string,
  ): ModelGenerationRequest {
    const system = [
      `You are "${this.manifest.id}". ${this.manifest.role}`,
      "Use web search to find the CURRENT FRONTIER of the concept. Report real, recent points only —",
      "if you cannot ground a point in what you found, omit it. Prefer primary/recent sources.",
      "Respond with JSON only (no markdown fences), classifying each point by kind:",
      `{"entries":[{"kind":"${FRONTIER_ENTRY_KINDS.join("|")}","summary":"one grounded sentence"}]}`,
      "2–8 entries; the summary states what the sources say, not your prior knowledge.",
    ].join("\n");
    return {
      prompt: `Concept: ${conceptRef}${definition ? `\nContext: ${definition}` : ""}\n\nResearch its current frontier.`,
      system,
      maxTokens: 2048,
      // Web-grounded generation: attaches the search tool + returns real citations (ADR-0043).
      // Mutually exclusive with responseSchema, so this call parses lenient text.
      webSearch: true,
      invocation_key: `${this.manifest.id}:${packet.packet_id}:frontier`,
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
          kind: "frontier-research",
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

  private buildTrace(packet: CognitionPacket, model: string, entryCount: number): ReasoningTrace {
    return {
      trace_id: packet.trace_id ?? "",
      producer_cid: this.manifest.id,
      session_id: packet.session_id ?? null,
      task_interpretation: "research the current frontier of a concept via governed web search",
      strategy: "web-grounded-frontier-research",
      claims: [
        {
          claim_id: `${packet.packet_id}-claim-0`,
          statement:
            "frontier entries admitted only when backed by a real citation; empty is honest",
          confidence: entryCount > 0 ? 0.8 : 0.4,
        },
      ],
      decision: `produced ${entryCount} grounded frontier entries via ${model}`,
      uncertainty_estimate: entryCount > 0 ? 0.2 : 0.6,
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
        reject(frontierError("E_MODEL_TIMEOUT", `model call exceeded ${this.timeoutMs}ms`));
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
