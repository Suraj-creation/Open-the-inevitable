/**
 * The eight understanding layers of a Canonical Source Environment, and the versioned layer
 * artifacts canonicalization produces.
 * Spec: spec/source-environment/CSE-002-canonical-source-representation.md §3.2.
 */
import type { LayerArtifactId, SourceVersionId } from "./ids";

/** The eight layers, in canonical order. L1–L6 are shared; L7–L8 are learner-conditioned. */
export const SOURCE_LAYERS = [
  "structural",
  "semantic",
  "visual",
  "temporal",
  "scientific",
  "citation",
  "meaning",
  "cognitive",
] as const;

export type SourceLayer = (typeof SOURCE_LAYERS)[number];

/** Layers computed once per source version and shared across learners (Principle Zero seam). */
export const SHARED_LAYERS: readonly SourceLayer[] = [
  "structural",
  "semantic",
  "visual",
  "temporal",
  "scientific",
  "citation",
];

/** Layers computed as shared candidates + per-learner selection (CSE-003). */
export const LEARNER_CONDITIONED_LAYERS: readonly SourceLayer[] = ["meaning", "cognitive"];

/**
 * One structural region of a source — the atom the structural layer is made of and the target
 * space structural/text-quote anchor selectors resolve into. `path` is a stable, human-legible
 * address (e.g. "h1-1/h2-2/para-3"); offsets index into the source's canonical text.
 */
export interface StructuralRegion {
  readonly path: string;
  readonly ordinal: number;
  readonly kind: "heading" | "paragraph" | "code" | "list" | "table" | "figure" | "other";
  readonly text: string;
  readonly char_start: number;
  readonly char_end: number;
  /** Extraction confidence 0..1 (OCR/vision regions may be < 1; native text is 1). */
  readonly confidence: number;
  /** Page number (1-based) for paginated modalities (PDF/EPUB) — enables region selectors. */
  readonly page?: number;
  /** Page-space bounding box [x, y, w, h] (PDF user units, origin bottom-left) — ADR-0036. */
  readonly bbox?: readonly [number, number, number, number];
}

/** Content of the visual (L3) layer for paginated modalities: page geometry the surface's
 * viewports/highlight overlays position against (ADR-0036). */
export interface VisualPage {
  readonly page: number;
  readonly width: number;
  readonly height: number;
  /** True when the page had no extractable text (scanned) — degraded, OCR pending. */
  readonly textless: boolean;
}

export interface VisualLayerContent {
  readonly pages: readonly VisualPage[];
}

/** Content of the structural (L1) layer. Other layers define their own content shapes. */
export interface StructuralLayerContent {
  readonly regions: readonly StructuralRegion[];
}

/**
 * A completed, versioned layer artifact. Artifacts are immutable; re-enrichment produces a
 * successor artifact (CSE-002 §4). `degraded` layers are usable but honestly marked — grounded
 * claims may not cite degraded-only regions.
 */
export interface SourceLayerArtifact {
  readonly artifact_id: LayerArtifactId;
  readonly source_version_id: SourceVersionId;
  readonly layer: SourceLayer;
  readonly schema_version: string;
  readonly confidence: number;
  readonly degraded: boolean;
  readonly degraded_reason: string | null;
  /** Producing adapter/unit identity (cid or adapter name) for provenance. */
  readonly produced_by: string;
  readonly content: unknown;
}

export function isSourceLayer(value: string): value is SourceLayer {
  return (SOURCE_LAYERS as readonly string[]).includes(value);
}

// ── L2 Semantic layer content (CSE-002 §3.2; constructed by governed cognition, M3) ───────────

/** A concept extracted from the source, grounded in the structural regions that evidence it. */
export interface SemanticConcept {
  /** kebab-case concept id (KG-compatible). */
  readonly concept_id: string;
  readonly label: string;
  /** Definition as expressed BY THIS SOURCE (evidence-grounded, not general knowledge). */
  readonly definition: string;
  /** Structural region paths evidencing this concept — every path MUST exist in L1. */
  readonly evidence_paths: readonly string[];
  /** Prerequisite relations among the extracted concept ids. */
  readonly prerequisites: readonly string[];
  readonly domain?: string;
  /** Natural depth layer 0–6 (F04 scale), when inferable. */
  readonly layer?: number;
}

export interface TermDefinition {
  readonly term: string;
  readonly definition: string;
  readonly evidence_path: string;
}

export interface SemanticLayerContent {
  readonly concepts: readonly SemanticConcept[];
  readonly terminology: readonly TermDefinition[];
}

// ── L7 Meaning layer content (CSE-003, the MRL; v1 kind set per ADR-0037) ─────────────────────

export const MEANING_UNIT_KINDS = [
  "intent",
  "analogy-map",
  "misconception-hypothesis",
  "conceptual-compression",
] as const;

export type MeaningUnitKind = (typeof MEANING_UNIT_KINDS)[number];

/**
 * One typed MeaningUnit (CSE-003 §3): system INFERENCE over evidence, never evidence itself —
 * provenance class is always `inference`, and every unit must be grounded: `source_anchors`
 * (structural region paths that exist in L1) and/or `concept_refs` (L2 concept ids) are the
 * grounding law's admission requirement (an ungrounded unit is dropped at the parser).
 */
export interface MeaningUnit {
  readonly unit_id: string;
  readonly kind: MeaningUnitKind;
  /** Structural region paths this meaning was inferred from — every path MUST exist in L1. */
  readonly source_anchors: readonly string[];
  /** Concept ids this unit is about (L2/KG-compatible). */
  readonly concept_refs: readonly string[];
  /** Kind-specific payload (CSE-003 §3 sketches); free-form but rendered inference-channel only. */
  readonly payload: Record<string, unknown>;
  readonly confidence: number;
  readonly produced_by: string;
}

export interface MeaningLayerContent {
  readonly units: readonly MeaningUnit[];
}

// ── L6 Citation layer content (CSE-002 §3.2) ──────────────────────────────────────────────────

export interface CitationReference {
  readonly ref_id: string;
  /** The reference as it appears in the source (raw string; never invented). */
  readonly raw: string;
  readonly title?: string;
  readonly year?: number;
  /** Structural region paths where this reference is cited — every path MUST exist in L1. */
  readonly cited_at_paths: readonly string[];
}

export interface CitationLayerContent {
  readonly references: readonly CitationReference[];
}

// ── L4 Temporal layer content (CSE-002 §3.2; the time dimension — video, M10 T3/ADR-0048) ──────

/** One timed segment: a structural region placed on the source's timeline (milliseconds). */
export interface TemporalSegment {
  /** The structural region this timing applies to (a `para-<n>` transcript cue). */
  readonly region_path: string;
  readonly start_ms: number;
  readonly end_ms: number;
}

/**
 * The L4 temporal layer: per-region timecodes for a time-based source (a video/audio transcript).
 * The substrate for the concept scrubber + the Temporal transformation (CSE-004). Real cue timings
 * only — never fabricated (an untimed transcript is the `text` modality, not `video`).
 */
export interface TemporalLayerContent {
  readonly segments: readonly TemporalSegment[];
  readonly duration_ms: number;
}
