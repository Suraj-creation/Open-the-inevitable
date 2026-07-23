/**
 * SourceCanonicalizerUnit — canonicalization as governed cognition (CSE M3, ADR-0032).
 *
 * Constructs the deeper understanding layers of a Canonical Source Environment through the same
 * governed dispatch path as every other unit: a PRIVILEGED agent (it reshapes the shared
 * knowledge graph, like `curriculum` — GOV-P01 trust ≥ 3), the `CognitiveUnit` ABI (governance
 * gate, scheduler admission, OTel span, D3 recording all apply unchanged), model-backed with a
 * deterministic fallback whose confidence lands BELOW the store's floor — so fallback layers are
 * recorded as honest `source.layer.degraded`, never dressed up as full extraction.
 *
 * Grounding law (CSE-002 Grounded / CSE-003 §6): every extracted concept/reference must cite
 * structural region paths that actually exist — the parsers DROP evidence paths not present in
 * the input region set (anti-hallucination at the contract boundary), and a concept with no
 * surviving evidence is discarded entirely.
 *
 * Spec: spec/source-environment/CSE-002 §3.2/§4/§6, spec/protocols/model-invocation-protocol.md.
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
  CitationLayerContent,
  CitationReference,
  SemanticConcept,
  SemanticLayerContent,
} from "@inevitable/source-environment";

const SPEC_REF = "source-environment/CSE-002-canonical-source-representation";

/** Confidence assigned to deterministic fallbacks — deliberately below the store's default
 * degradation floor (0.5) so fallback layers land as `source.layer.degraded` (honest). */
export const FALLBACK_LAYER_CONFIDENCE = 0.45;
export const MODEL_LAYER_CONFIDENCE = 0.85;

export type CanonicalizableLayer = "semantic" | "citation";

/** The region slice the unit reasons over (path-addressed, so evidence stays anchorable). */
export interface RegionInput {
  readonly path: string;
  readonly kind: string;
  readonly text: string;
}

export interface SourceCanonicalizerUnitDeps {
  readonly manifest: AgentManifest;
  readonly model: ModelRuntime;
  readonly timeoutMs?: number;
  readonly idGenerator?: IdGenerator;
}

function layerError(code: string, message: string, details?: Record<string, unknown>): CosError {
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

const SEMANTIC_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["concepts"],
  properties: {
    concepts: {
      type: "array",
      items: {
        type: "object",
        required: ["concept_id", "label", "definition", "evidence_paths"],
        properties: {
          concept_id: { type: "string" },
          label: { type: "string" },
          definition: { type: "string" },
          evidence_paths: { type: "array", items: { type: "string" } },
          prerequisites: { type: "array", items: { type: "string" } },
          domain: { type: "string" },
          layer: { type: "number" },
        },
      },
    },
    terminology: {
      type: "array",
      items: {
        type: "object",
        required: ["term", "definition", "evidence_path"],
        properties: {
          term: { type: "string" },
          definition: { type: "string" },
          evidence_path: { type: "string" },
        },
      },
    },
  },
};

const CITATION_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["references"],
  properties: {
    references: {
      type: "array",
      items: {
        type: "object",
        required: ["ref_id", "raw", "cited_at_paths"],
        properties: {
          ref_id: { type: "string" },
          raw: { type: "string" },
          title: { type: "string" },
          year: { type: "number" },
          cited_at_paths: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

// ── Parsers (grounding-validated; exported for tests) ─────────────────────────────────────────

/**
 * Parse + ground-validate the semantic layer output. Evidence paths not in `validPaths` are
 * dropped; concepts left with no evidence are discarded; prerequisites referencing unknown or
 * self ids are cleaned. Throws E_MODEL_OUTPUT_MALFORMED on structural violations.
 */
export function parseSemanticLayerOutput(
  text: string,
  validPaths: ReadonlySet<string>,
): SemanticLayerContent {
  let raw: unknown;
  try {
    raw = JSON.parse(stripFences(text));
  } catch {
    throw layerError("E_MODEL_OUTPUT_MALFORMED", "semantic layer output is not valid JSON", {
      sample: text.slice(0, 200),
    });
  }
  const obj = raw as { concepts?: unknown; terminology?: unknown };
  if (!Array.isArray(obj.concepts)) {
    throw layerError("E_MODEL_OUTPUT_MALFORMED", "semantic layer output missing concepts array");
  }
  const seen = new Set<string>();
  const concepts: SemanticConcept[] = [];
  for (const entry of obj.concepts) {
    const c = entry as {
      concept_id?: unknown;
      label?: unknown;
      definition?: unknown;
      evidence_paths?: unknown;
      prerequisites?: unknown;
      domain?: unknown;
      layer?: unknown;
    };
    const id = typeof c.concept_id === "string" ? kebab(c.concept_id) : "";
    const label = typeof c.label === "string" ? c.label.trim() : "";
    const definition = typeof c.definition === "string" ? c.definition.trim() : "";
    if (!id || !label || !definition || seen.has(id)) continue;
    // Grounding: drop hallucinated evidence; a concept with zero surviving evidence is discarded.
    const evidence = (Array.isArray(c.evidence_paths) ? c.evidence_paths : [])
      .filter((p): p is string => typeof p === "string")
      .filter((p) => validPaths.has(p));
    if (evidence.length === 0) continue;
    seen.add(id);
    const prerequisites = (Array.isArray(c.prerequisites) ? c.prerequisites : []).filter(
      (p): p is string => typeof p === "string",
    );
    const layer =
      typeof c.layer === "number" ? Math.min(6, Math.max(0, Math.round(c.layer))) : undefined;
    concepts.push({
      concept_id: id,
      label,
      definition,
      evidence_paths: evidence,
      prerequisites,
      ...(typeof c.domain === "string" && c.domain.trim() ? { domain: c.domain.trim() } : {}),
      ...(layer !== undefined ? { layer } : {}),
    });
  }
  if (concepts.length === 0) {
    throw layerError(
      "E_MODEL_OUTPUT_MALFORMED",
      "semantic layer output had no grounded concepts (all evidence paths invalid or empty)",
    );
  }
  const ids = new Set(concepts.map((c) => c.concept_id));
  const cleaned = concepts.map((c) => ({
    ...c,
    prerequisites: c.prerequisites.map(kebab).filter((p) => ids.has(p) && p !== c.concept_id),
  }));
  const terminology = (Array.isArray(obj.terminology) ? obj.terminology : [])
    .map((entry) => {
      const t = entry as { term?: unknown; definition?: unknown; evidence_path?: unknown };
      const term = typeof t.term === "string" ? t.term.trim() : "";
      const definition = typeof t.definition === "string" ? t.definition.trim() : "";
      const path = typeof t.evidence_path === "string" ? t.evidence_path : "";
      if (!term || !definition || !validPaths.has(path)) return null;
      return { term, definition, evidence_path: path };
    })
    .filter((t): t is { term: string; definition: string; evidence_path: string } => t !== null);
  return { concepts: cleaned, terminology };
}

/** Parse + ground-validate the citation layer output (same grounding law). */
export function parseCitationLayerOutput(
  text: string,
  validPaths: ReadonlySet<string>,
): CitationLayerContent {
  let raw: unknown;
  try {
    raw = JSON.parse(stripFences(text));
  } catch {
    throw layerError("E_MODEL_OUTPUT_MALFORMED", "citation layer output is not valid JSON", {
      sample: text.slice(0, 200),
    });
  }
  const obj = raw as { references?: unknown };
  if (!Array.isArray(obj.references)) {
    throw layerError("E_MODEL_OUTPUT_MALFORMED", "citation layer output missing references array");
  }
  const seen = new Set<string>();
  const references: CitationReference[] = [];
  for (const entry of obj.references) {
    const r = entry as {
      ref_id?: unknown;
      raw?: unknown;
      title?: unknown;
      year?: unknown;
      cited_at_paths?: unknown;
    };
    const refId = typeof r.ref_id === "string" ? kebab(r.ref_id) : "";
    const rawText = typeof r.raw === "string" ? r.raw.trim() : "";
    if (!refId || !rawText || seen.has(refId)) continue;
    const citedAt = (Array.isArray(r.cited_at_paths) ? r.cited_at_paths : [])
      .filter((p): p is string => typeof p === "string")
      .filter((p) => validPaths.has(p));
    seen.add(refId);
    references.push({
      ref_id: refId,
      raw: rawText,
      cited_at_paths: citedAt,
      ...(typeof r.title === "string" && r.title.trim() ? { title: r.title.trim() } : {}),
      ...(typeof r.year === "number" ? { year: Math.round(r.year) } : {}),
    });
  }
  return { references };
}

// ── Deterministic fallbacks (honest degraded layers) ──────────────────────────────────────────

/** Heading-derived concepts: each heading becomes a concept evidenced by itself + the regions
 * under it; definition = the first following paragraph. Deterministic; no invention. */
export function deterministicSemanticLayer(regions: readonly RegionInput[]): SemanticLayerContent {
  const concepts: SemanticConcept[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];
    if (!region || region.kind !== "heading") continue;
    const id = kebab(region.text);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const under = regions.filter(
      (r) => r.path === region.path || r.path.startsWith(`${region.path}/`),
    );
    const firstParagraph = under.find((r) => r.kind === "paragraph");
    concepts.push({
      concept_id: id,
      label: region.text.trim(),
      definition: (firstParagraph?.text ?? region.text).slice(0, 280),
      evidence_paths: under.map((r) => r.path),
      prerequisites: [],
    });
  }
  if (concepts.length === 0) {
    const first = regions[0];
    if (first) {
      concepts.push({
        concept_id: kebab(first.text.slice(0, 40)) || "source-content",
        label: first.text.slice(0, 60),
        definition: first.text.slice(0, 280),
        evidence_paths: [first.path],
        prerequisites: [],
      });
    }
  }
  return { concepts, terminology: [] };
}

/** Regex-harvested references: (Author, 1999) / [12]-style markers; no model, no invention. */
export function deterministicCitationLayer(regions: readonly RegionInput[]): CitationLayerContent {
  const references: CitationReference[] = [];
  const seen = new Set<string>();
  // Year range 1500–2099: scholarly citations reach well before 1900 (e.g. Boltzmann, 1877).
  const pattern = /\(([A-Z][A-Za-z\-'\s&.]+?,\s*(1[5-9]|20)\d{2}[a-z]?)\)|\[(\d{1,3})\]/g;
  for (const region of regions) {
    for (const match of region.text.matchAll(pattern)) {
      const raw = match[1] ?? `[${match[3]}]`;
      const refId = kebab(raw).slice(0, 60) || `ref-${references.length + 1}`;
      const existing = references.find((r) => r.ref_id === refId);
      if (existing) {
        if (!existing.cited_at_paths.includes(region.path)) {
          references[references.indexOf(existing)] = {
            ...existing,
            cited_at_paths: [...existing.cited_at_paths, region.path],
          };
        }
        continue;
      }
      if (seen.has(refId)) continue;
      seen.add(refId);
      references.push({ ref_id: refId, raw, cited_at_paths: [region.path] });
    }
  }
  return { references };
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

function layerOf(packet: CognitionPacket): CanonicalizableLayer {
  const content = (packet.content ?? {}) as Record<string, unknown>;
  return content["layer"] === "citation" ? "citation" : "semantic";
}

export class SourceCanonicalizerUnit implements CognitiveUnit {
  private readonly manifest: AgentManifest;
  private readonly model: ModelRuntime;
  private readonly timeoutMs: number;
  private readonly idGenerator: IdGenerator;
  private preparedLeaseId: string | null = null;

  constructor(deps: SourceCanonicalizerUnitDeps) {
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
    const layer = layerOf(packet);
    const regions = regionsOf(packet);
    if (regions.length === 0) {
      throw layerError("E_SOURCE_NOT_CANONICALIZED", "packet carries no structural regions", {
        packet_id: packet.packet_id,
      });
    }
    try {
      return await this.executeWithModel(packet, layer, regions);
    } catch (cause) {
      const code = cause instanceof CosError ? cause.code : "E_MODEL_UNAVAILABLE";
      const content =
        layer === "semantic"
          ? deterministicSemanticLayer(regions)
          : deterministicCitationLayer(regions);
      const response = this.buildResponsePacket(packet, layer, content, {
        kind: `deterministic-${layer}-layer`,
        model: "deterministic",
        confidence: FALLBACK_LAYER_CONFIDENCE,
        fallbackReason: code,
      });
      return {
        packets: [response],
        trace: this.buildTrace(packet, layer, "deterministic", FALLBACK_LAYER_CONFIDENCE),
      };
    }
  }

  private async executeWithModel(
    packet: CognitionPacket,
    layer: CanonicalizableLayer,
    regions: readonly RegionInput[],
  ): Promise<Emissions> {
    const request = this.buildRequest(packet, layer, regions);
    const result = await this.withTimeout(this.model.generate(request));
    if (result.finishReason === "refusal" || result.finishReason === "safety") {
      throw layerError("E_MODEL_REFUSAL", `model refused generation (${result.finishReason})`);
    }
    if (result.finishReason === "max_tokens") {
      throw layerError("E_MODEL_OUTPUT_TRUNCATED", "layer output truncated at token budget");
    }
    const validPaths = new Set(regions.map((r) => r.path));
    const content =
      layer === "semantic"
        ? parseSemanticLayerOutput(result.text, validPaths)
        : parseCitationLayerOutput(result.text, validPaths);
    const response = this.buildResponsePacket(packet, layer, content, {
      kind: `model-${layer}-layer`,
      model: result.model,
      confidence: MODEL_LAYER_CONFIDENCE,
    });
    return {
      packets: [response],
      trace: this.buildTrace(packet, layer, result.model, MODEL_LAYER_CONFIDENCE),
    };
  }

  private buildRequest(
    packet: CognitionPacket,
    layer: CanonicalizableLayer,
    regions: readonly RegionInput[],
  ): ModelGenerationRequest {
    const regionBlock = regions
      .map((r) => `[${r.path}] (${r.kind})\n${r.text}`)
      .join("\n\n")
      .slice(0, 16_000);
    const system =
      layer === "semantic"
        ? [
            `You are "${this.manifest.id}". ${this.manifest.role}`,
            "Extract the concepts THIS SOURCE actually teaches, grounded in its regions.",
            "Respond with JSON only (no markdown fences) matching:",
            '{"concepts":[{"concept_id":"kebab-case","label":"Human Label","definition":"as defined by THIS source","evidence_paths":["region paths that evidence it"],"prerequisites":["other concept_id"],"domain":"mathematics","layer":2}],"terminology":[{"term":"...","definition":"...","evidence_path":"region path"}]}',
            "Rules: 3–10 concepts; definitions restate what the SOURCE says (never outside",
            "knowledge); evidence_paths MUST be paths from the input (anything else is discarded);",
            "prerequisites only among your extracted concept_ids; acyclic.",
          ].join("\n")
        : [
            `You are "${this.manifest.id}". ${this.manifest.role}`,
            "Extract the references/citations THIS SOURCE contains, with where they are cited.",
            "Respond with JSON only (no markdown fences) matching:",
            '{"references":[{"ref_id":"kebab-case","raw":"the reference string exactly as it appears","title":"...","year":1997,"cited_at_paths":["region paths where cited"]}]}',
            "Rules: only references that actually appear in the text (never invent); raw is",
            "verbatim; cited_at_paths MUST be paths from the input.",
          ].join("\n");
    return {
      prompt: `Source regions:\n\n${regionBlock}`,
      system,
      maxTokens: 4096,
      // Structured-output call: an uncapped thinking phase starves the visible JSON and truncates
      // at max_tokens (proven live at M3; same finding as ADR-0031). Disable thinking entirely.
      thinkingBudget: 0,
      responseSchema: layer === "semantic" ? SEMANTIC_OUTPUT_SCHEMA : CITATION_OUTPUT_SCHEMA,
      invocation_key: `${this.manifest.id}:${packet.packet_id}:${layer}-layer`,
    };
  }

  private buildResponsePacket(
    packet: CognitionPacket,
    layer: CanonicalizableLayer,
    content: SemanticLayerContent | CitationLayerContent,
    meta: { kind: string; model: string; confidence: number; fallbackReason?: string },
  ): CognitionPacket {
    const conceptIds =
      "concepts" in content
        ? content.concepts.map((c) => c.concept_id)
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
        handled_by: this.manifest.id,
        response_kind: meta.kind,
        layer,
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
          kind: `${layer}-layer-construction`,
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

  private buildTrace(
    packet: CognitionPacket,
    layer: CanonicalizableLayer,
    model: string,
    confidence: number,
  ): ReasoningTrace {
    return {
      trace_id: packet.trace_id ?? "",
      producer_cid: this.manifest.id,
      session_id: packet.session_id ?? null,
      task_interpretation: `construct the ${layer} understanding layer from structural regions`,
      strategy: `${layer}-layer-extraction`,
      claims: [
        {
          claim_id: `${packet.packet_id}-claim-0`,
          statement: `${layer} layer extracted, grounding-validated against region paths`,
          confidence,
        },
      ],
      decision: `produced ${layer} layer via ${model} (evidence paths validated against L1)`,
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
        reject(layerError("E_MODEL_TIMEOUT", `model call exceeded ${this.timeoutMs}ms`));
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
