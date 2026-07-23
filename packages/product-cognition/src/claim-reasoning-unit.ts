/**
 * ClaimReasoningUnit — the Claim Graph as governed cognition (CSE M9 T2; CSE-006 §3.1, ADR-0041).
 *
 * One PRIVILEGED agent (`claim`), two modes — the `SourceCanonicalizerUnit` precedent (semantic /
 * citation discriminated by `layer`):
 *
 *  - `extract`: from a source's structural regions (+ its concept vocabulary), extract the claims
 *    THIS SOURCE actually makes — each typed by epistemic status and GROUNDED (every claim cites
 *    region anchors that exist and/or concept ids from the input; the parser drops hallucinated
 *    grounding and discards a claim left with neither). Deterministic fallback: one `supported`
 *    claim per covered concept, stated from the source's own words — honest degraded, no invention.
 *
 *  - `contrast`: given claims from DIFFERENT sources about SHARED concepts, detect genuine
 *    cross-source contradictions and classify each `nature` (empirical | interpretive | value).
 *    Deterministic fallback: NONE — honest absence. A fabricated contradiction is worse than a
 *    missed one (CSE-006 §2/§6); same-source pairs are never a cross-source contradiction; a
 *    value/interpretive disagreement is never presented as a factual (empirical) one.
 *
 * Same governed discipline as the M3 canonicalizer / M6 meaning unit: model-backed with a
 * deterministic fallback whose confidence lands BELOW the store's degradation floor, the
 * `CognitiveUnit` ABI (governance gate, scheduler admission, OTel span, D3 recording all apply).
 *
 * Spec: spec/source-environment/CSE-006 §3.1, spec/architecture-decisions/ADR-0041.
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
import type {
  Claim,
  ClaimEpistemicStatus,
  Contradiction,
  ContradictionNature,
} from "@inevitable/source-environment";
import type { RegionInput } from "./source-canonicalizer-unit";
import type { ConceptInput } from "./meaning-representation-unit";

const SPEC_REF = "source-environment/CSE-006-living-knowledge";

/** Below the store's degradation floor (0.5): deterministic claims land visibly degraded. */
export const FALLBACK_CLAIM_CONFIDENCE = 0.45;
export const MODEL_CLAIM_CONFIDENCE = 0.8;

export type ClaimMode = "extract" | "contrast";

const EPISTEMIC_STATUSES: readonly ClaimEpistemicStatus[] = [
  "established",
  "supported",
  "contested",
  "speculative",
  "superseded",
];

const CONTRADICTION_NATURES: readonly ContradictionNature[] = [
  "empirical",
  "interpretive",
  "value",
];

/** One claim as fed to `contrast` — the cross-source comparison input (already namespaced). */
export interface ClaimForContrast {
  readonly claim_id: string;
  readonly statement: string;
  readonly source_version_id: string;
  readonly about_concepts: readonly string[];
}

export interface ClaimReasoningUnitDeps {
  readonly manifest: AgentManifest;
  readonly model: ModelRuntime;
  readonly timeoutMs?: number;
  readonly idGenerator?: IdGenerator;
}

function claimError(code: string, message: string, details?: Record<string, unknown>): CosError {
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

// ── Output contracts ───────────────────────────────────────────────────────────────────────────

const EXTRACT_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["claims"],
  properties: {
    claims: {
      type: "array",
      items: {
        type: "object",
        required: ["statement"],
        properties: {
          statement: { type: "string" },
          source_anchors: { type: "array", items: { type: "string" } },
          concept_refs: { type: "array", items: { type: "string" } },
          epistemic_status: { type: "string", enum: [...EPISTEMIC_STATUSES] },
        },
      },
    },
  },
};

const CONTRAST_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["contradictions"],
  properties: {
    contradictions: {
      type: "array",
      items: {
        type: "object",
        required: ["claim_id_a", "claim_id_b", "nature"],
        properties: {
          claim_id_a: { type: "string" },
          claim_id_b: { type: "string" },
          nature: { type: "string", enum: [...CONTRADICTION_NATURES] },
          rationale: { type: "string" },
        },
      },
    },
  },
};

// ── Parsers (grounding-validated; exported for tests) ─────────────────────────────────────────

/**
 * Parse + ground-validate `extract` output. Anchors not in `validPaths` and concept refs not in
 * `validConcepts` are dropped; a claim left with neither is discarded (a claim must be grounded —
 * CSE-006 §3.1). Claim ids are local (`clm-<n>`); the service namespaces them per source version.
 * Throws E_MODEL_OUTPUT_MALFORMED on structural violations or when no claim survives grounding.
 */
export function parseClaimExtractionOutput(
  text: string,
  validPaths: ReadonlySet<string>,
  validConcepts: ReadonlySet<string>,
  sourceVersionId: string,
): Claim[] {
  let raw: unknown;
  try {
    raw = JSON.parse(stripFences(text));
  } catch {
    throw claimError("E_MODEL_OUTPUT_MALFORMED", "claim extraction output is not valid JSON", {
      sample: text.slice(0, 200),
    });
  }
  const obj = raw as { claims?: unknown };
  if (!Array.isArray(obj.claims)) {
    throw claimError("E_MODEL_OUTPUT_MALFORMED", "claim extraction output missing claims array");
  }
  const claims: Claim[] = [];
  for (const entry of obj.claims) {
    const c = entry as {
      statement?: unknown;
      source_anchors?: unknown;
      concept_refs?: unknown;
      epistemic_status?: unknown;
    };
    const statement = typeof c.statement === "string" ? c.statement.trim() : "";
    if (!statement) continue;
    // Grounding: drop hallucinated anchors/concepts; a claim with neither is discarded entirely.
    const anchors = (Array.isArray(c.source_anchors) ? c.source_anchors : [])
      .filter((p): p is string => typeof p === "string")
      .filter((p) => validPaths.has(p));
    const aboutConcepts = (Array.isArray(c.concept_refs) ? c.concept_refs : [])
      .filter((r): r is string => typeof r === "string")
      .map(kebab)
      .filter((r) => validConcepts.has(r));
    if (anchors.length === 0 && aboutConcepts.length === 0) continue;
    const status: ClaimEpistemicStatus =
      typeof c.epistemic_status === "string" &&
      EPISTEMIC_STATUSES.includes(c.epistemic_status as ClaimEpistemicStatus)
        ? (c.epistemic_status as ClaimEpistemicStatus)
        : "supported";
    claims.push({
      claim_id: `clm-${claims.length + 1}`,
      statement,
      anchors,
      about_concepts: aboutConcepts,
      source_version_id: sourceVersionId,
      epistemic_status: status,
      edges: [],
    });
  }
  if (claims.length === 0) {
    throw claimError(
      "E_MODEL_OUTPUT_MALFORMED",
      "claim extraction output had no grounded claims (all anchors/concepts invalid or empty)",
    );
  }
  return claims;
}

/**
 * Parse + validate `contrast` output into cross-source contradictions. Honest by construction:
 * both claim ids must be known AND from DIFFERENT sources (same-source pairs and unknown ids are
 * dropped); an empty set is valid (no error — honest absence). Nature defaults to `interpretive`
 * (never presents a disagreement as empirical/factual without the model saying so). Deterministic
 * over its input; duplicate pairs collapse.
 */
export function parseContradictionOutput(
  text: string,
  claimsById: ReadonlyMap<string, ClaimForContrast>,
): Contradiction[] {
  let raw: unknown;
  try {
    raw = JSON.parse(stripFences(text));
  } catch {
    throw claimError("E_MODEL_OUTPUT_MALFORMED", "contradiction output is not valid JSON", {
      sample: text.slice(0, 200),
    });
  }
  const obj = raw as { contradictions?: unknown };
  if (!Array.isArray(obj.contradictions)) {
    throw claimError(
      "E_MODEL_OUTPUT_MALFORMED",
      "contradiction output missing contradictions array",
    );
  }
  const seen = new Set<string>();
  const contradictions: Contradiction[] = [];
  for (const entry of obj.contradictions) {
    const f = entry as {
      claim_id_a?: unknown;
      claim_id_b?: unknown;
      nature?: unknown;
      rationale?: unknown;
    };
    const a = typeof f.claim_id_a === "string" ? claimsById.get(f.claim_id_a) : undefined;
    const b = typeof f.claim_id_b === "string" ? claimsById.get(f.claim_id_b) : undefined;
    if (!a || !b) continue; // unknown claim id — never fabricate
    if (a.claim_id === b.claim_id) continue;
    if (a.source_version_id === b.source_version_id) continue; // same source — not cross-source
    const key = [a.claim_id, b.claim_id].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    const nature: ContradictionNature =
      typeof f.nature === "string" &&
      CONTRADICTION_NATURES.includes(f.nature as ContradictionNature)
        ? (f.nature as ContradictionNature)
        : "interpretive";
    contradictions.push({
      claim_ids: [a.claim_id, b.claim_id].sort(),
      source_version_ids: [a.source_version_id, b.source_version_id].sort(),
      nature,
      ...(typeof f.rationale === "string" && f.rationale.trim()
        ? { rationale: f.rationale.trim().slice(0, 240) }
        : {}),
    });
  }
  return contradictions;
}

// ── Deterministic fallback (honest degraded extraction; contrast has none) ────────────────────

/**
 * Deterministic claim extraction: one `supported` claim per covered concept, stated from the
 * source's own definition (grounded on the concept ref). No cross edges, no invention (CSE-006 §6).
 * Falls back to one claim per heading when no concept vocabulary is available.
 */
export function deterministicClaimExtraction(
  regions: readonly RegionInput[],
  concepts: readonly ConceptInput[],
  sourceVersionId: string,
): Claim[] {
  const claims: Claim[] = [];
  for (const concept of concepts) {
    // Only the source's own definition is a real claim — the bare label is a topic, not an
    // assertion. Absent a definition we fall through to heading claims (honest degradation).
    const definition = concept.definition?.trim();
    if (!definition) continue;
    claims.push({
      claim_id: `clm-${claims.length + 1}`,
      statement: definition.slice(0, 200),
      anchors: [],
      about_concepts: [concept.concept_id],
      source_version_id: sourceVersionId,
      epistemic_status: "supported",
      edges: [],
    });
  }
  if (claims.length === 0) {
    for (const region of regions) {
      if (region.kind !== "heading" || !region.text.trim()) continue;
      claims.push({
        claim_id: `clm-${claims.length + 1}`,
        statement: region.text.trim().slice(0, 200),
        anchors: [region.path],
        about_concepts: [],
        source_version_id: sourceVersionId,
        epistemic_status: "supported",
        edges: [],
      });
    }
  }
  return claims;
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

function modeOf(packet: CognitionPacket): ClaimMode {
  const content = (packet.content ?? {}) as Record<string, unknown>;
  return content["mode"] === "contrast" ? "contrast" : "extract";
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

function claimsForContrastOf(packet: CognitionPacket): ClaimForContrast[] {
  const content = (packet.content ?? {}) as Record<string, unknown>;
  const raw = content["claims"];
  if (!Array.isArray(raw)) return [];
  const claims: ClaimForContrast[] = [];
  for (const entry of raw) {
    const c = entry as {
      claim_id?: unknown;
      statement?: unknown;
      source_version_id?: unknown;
      about_concepts?: unknown;
    };
    if (typeof c.claim_id !== "string" || typeof c.statement !== "string") continue;
    if (typeof c.source_version_id !== "string") continue;
    claims.push({
      claim_id: c.claim_id,
      statement: c.statement,
      source_version_id: c.source_version_id,
      about_concepts: (Array.isArray(c.about_concepts) ? c.about_concepts : []).filter(
        (r): r is string => typeof r === "string",
      ),
    });
  }
  return claims;
}

export class ClaimReasoningUnit implements CognitiveUnit {
  private readonly manifest: AgentManifest;
  private readonly model: ModelRuntime;
  private readonly timeoutMs: number;
  private readonly idGenerator: IdGenerator;
  private preparedLeaseId: string | null = null;

  constructor(deps: ClaimReasoningUnitDeps) {
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
    return modeOf(packet) === "contrast"
      ? this.executeContrast(packet)
      : this.executeExtract(packet);
  }

  // ── extract ────────────────────────────────────────────────────────────────────────────────

  private async executeExtract(packet: CognitionPacket): Promise<Emissions> {
    const regions = regionsOf(packet);
    const concepts = conceptsOf(packet);
    const versionId = this.versionIdOf(packet);
    if (regions.length === 0) {
      throw claimError("E_SOURCE_NOT_CANONICALIZED", "packet carries no structural regions", {
        packet_id: packet.packet_id,
      });
    }
    try {
      const request = this.buildExtractRequest(packet, regions, concepts);
      const result = await this.withTimeout(this.model.generate(request));
      this.guardFinish(result.finishReason);
      const validPaths = new Set(regions.map((r) => r.path));
      const validConcepts = new Set(concepts.map((c) => c.concept_id));
      const claims = parseClaimExtractionOutput(result.text, validPaths, validConcepts, versionId);
      return this.emitExtract(packet, claims, {
        kind: "model-claim-extraction",
        model: result.model,
        confidence: MODEL_CLAIM_CONFIDENCE,
      });
    } catch (cause) {
      const code = cause instanceof CosError ? cause.code : "E_MODEL_UNAVAILABLE";
      const claims = deterministicClaimExtraction(regions, concepts, versionId);
      return this.emitExtract(packet, claims, {
        kind: "deterministic-claim-extraction",
        model: "deterministic",
        confidence: FALLBACK_CLAIM_CONFIDENCE,
        fallbackReason: code,
      });
    }
  }

  private emitExtract(
    packet: CognitionPacket,
    claims: readonly Claim[],
    meta: { kind: string; model: string; confidence: number; fallbackReason?: string },
  ): Emissions {
    const conceptIds = [...new Set(claims.flatMap((c) => [...c.about_concepts]))];
    const response = this.buildResponsePacket(packet, {
      handled_by: this.manifest.id,
      response_kind: meta.kind,
      mode: "extract",
      claims: claims as unknown as Record<string, unknown>[],
      confidence: meta.confidence,
      model: meta.model,
      ...(meta.fallbackReason ? { fallback_reason: meta.fallbackReason } : {}),
      concept_ids: conceptIds,
    });
    return {
      packets: [response],
      trace: this.buildTrace(packet, "extract", meta.model, meta.confidence),
    };
  }

  // ── contrast ───────────────────────────────────────────────────────────────────────────────

  private async executeContrast(packet: CognitionPacket): Promise<Emissions> {
    const claims = claimsForContrastOf(packet);
    // Fewer than two sources ⇒ no cross-source contradiction is possible. Honest empty, no model call.
    const sources = new Set(claims.map((c) => c.source_version_id));
    if (claims.length < 2 || sources.size < 2) {
      return this.emitContrast(packet, [], { model: "deterministic", noComparison: true });
    }
    try {
      const request = this.buildContrastRequest(packet, claims);
      const result = await this.withTimeout(this.model.generate(request));
      this.guardFinish(result.finishReason);
      const byId = new Map(claims.map((c) => [c.claim_id, c]));
      const contradictions = parseContradictionOutput(result.text, byId);
      return this.emitContrast(packet, contradictions, { model: result.model });
    } catch (cause) {
      // Honest absence: contrast NEVER fabricates on failure (CSE-006 §2/§6).
      const code = cause instanceof CosError ? cause.code : "E_MODEL_UNAVAILABLE";
      return this.emitContrast(packet, [], { model: "deterministic", fallbackReason: code });
    }
  }

  private emitContrast(
    packet: CognitionPacket,
    contradictions: readonly Contradiction[],
    meta: { model: string; fallbackReason?: string; noComparison?: boolean },
  ): Emissions {
    const response = this.buildResponsePacket(packet, {
      handled_by: this.manifest.id,
      response_kind: meta.noComparison ? "no-comparison" : "cross-source-contrast",
      mode: "contrast",
      contradictions: contradictions as unknown as Record<string, unknown>[],
      model: meta.model,
      ...(meta.fallbackReason ? { fallback_reason: meta.fallbackReason } : {}),
    });
    return { packets: [response], trace: this.buildTrace(packet, "contrast", meta.model, 1) };
  }

  // ── requests ───────────────────────────────────────────────────────────────────────────────

  private buildExtractRequest(
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
      "Extract the CLAIMS this source actually makes — assertions it commits to, not mere topics.",
      "Respond with JSON only (no markdown fences) matching:",
      '{"claims":[{"statement":"the shortest faithful statement of the claim","source_anchors":["region paths that assert it"],"concept_refs":["concept ids from the list this claim is about"],"epistemic_status":"established|supported|contested|speculative|superseded"}]}',
      "Rules: 2–10 claims; the statement restates what THIS SOURCE asserts (never outside",
      "knowledge); every claim MUST cite source_anchors from the input paths and/or concept_refs",
      "from the concept list (ungrounded claims are discarded); epistemic_status reflects how the",
      "source frames it (a hedged/‘some argue’ claim is contested or speculative, not established).",
    ].join("\n");
    return {
      prompt: `Concepts:\n${conceptBlock || "(none extracted)"}\n\nSource regions:\n\n${regionBlock}`,
      system,
      maxTokens: 4096,
      // Structured-output call: thinking starves the visible JSON (proven live at M3/ADR-0031).
      thinkingBudget: 0,
      responseSchema: EXTRACT_OUTPUT_SCHEMA,
      invocation_key: `${this.manifest.id}:${packet.packet_id}:claim-extract`,
    };
  }

  private buildContrastRequest(
    packet: CognitionPacket,
    claims: readonly ClaimForContrast[],
  ): ModelGenerationRequest {
    const claimBlock = claims
      .map(
        (c) =>
          `${c.claim_id} [source ${c.source_version_id}] (about: ${c.about_concepts.join(", ") || "?"}): ${c.statement}`,
      )
      .join("\n")
      .slice(0, 14_000);
    const system = [
      `You are "${this.manifest.id}". ${this.manifest.role}`,
      "Compare claims from DIFFERENT sources. Report ONLY genuine contradictions — where the",
      "claims cannot both be true as stated. Do NOT report mere differences in emphasis, wording,",
      "or scope, and NEVER invent a contradiction. If none exist, return an empty list.",
      "Respond with JSON only (no markdown fences) matching:",
      '{"contradictions":[{"claim_id_a":"id from the list","claim_id_b":"id from a DIFFERENT source","nature":"empirical|interpretive|value","rationale":"one sentence, neutral — no winner declared"}]}',
      "nature: empirical = a factual/observational disagreement; interpretive = differing readings",
      "of the same facts; value = differing normative stances. When unsure, prefer interpretive —",
      "never label a disagreement empirical (factual) unless the claims make opposing factual assertions.",
      "Only pair claims from different sources; same-source pairs are not contradictions.",
    ].join("\n");
    return {
      prompt: `Claims to compare:\n\n${claimBlock}`,
      system,
      maxTokens: 2048,
      thinkingBudget: 0,
      responseSchema: CONTRAST_OUTPUT_SCHEMA,
      invocation_key: `${this.manifest.id}:${packet.packet_id}:claim-contrast`,
    };
  }

  // ── packet plumbing ──────────────────────────────────────────────────────────────────────────

  private guardFinish(finishReason: string | undefined): void {
    if (finishReason === "refusal" || finishReason === "safety") {
      throw claimError("E_MODEL_REFUSAL", `model refused generation (${finishReason})`);
    }
    if (finishReason === "max_tokens") {
      throw claimError("E_MODEL_OUTPUT_TRUNCATED", "claim output truncated at token budget");
    }
  }

  private versionIdOf(packet: CognitionPacket): string {
    const content = (packet.content ?? {}) as Record<string, unknown>;
    return typeof content["version_id"] === "string" ? content["version_id"] : "unknown-version";
  }

  private buildResponsePacket(
    packet: CognitionPacket,
    content: Record<string, unknown>,
  ): CognitionPacket {
    const conceptIds = Array.isArray(content["concept_ids"])
      ? (content["concept_ids"] as string[])
      : (packet.concept_ids ?? []);
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
      concept_ids: conceptIds,
      domain_ids: packet.domain_ids ?? [],
      content: {
        ...content,
        prepared_lease_id: this.preparedLeaseId,
        intent_lease_id:
          ((packet.content ?? {}) as Record<string, unknown>)["intent_lease_id"] ?? null,
      },
      evidence: [
        {
          kind: `claim-${content["mode"]}`,
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

  private buildTrace(
    packet: CognitionPacket,
    mode: ClaimMode,
    model: string,
    confidence: number,
  ): ReasoningTrace {
    return {
      trace_id: packet.trace_id ?? "",
      producer_cid: this.manifest.id,
      session_id: packet.session_id ?? null,
      task_interpretation:
        mode === "extract"
          ? "extract the claims this source makes, grounded in its regions/concepts"
          : "detect genuine cross-source contradictions between claims (never fabricated)",
      strategy: mode === "extract" ? "claim-extraction" : "cross-source-contrast",
      claims: [
        {
          claim_id: `${packet.packet_id}-claim-0`,
          statement:
            mode === "extract"
              ? "claims extracted, grounding-validated against region paths + concepts"
              : "contradictions reported only for cross-source pairs, honest-absence otherwise",
          confidence,
        },
      ],
      decision:
        mode === "extract"
          ? `produced claims via ${model} (ungrounded claims discarded)`
          : `produced cross-source contradictions via ${model} (same-source/unknown dropped)`,
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
        reject(claimError("E_MODEL_TIMEOUT", `model call exceeded ${this.timeoutMs}ms`));
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
