/**
 * Source–surface projection (CSE M5, CSE-008; SRF-002 schema 1.6.0).
 *
 * The seam where a Canonical Source Environment becomes something the learner stands inside:
 * the **Semantic Viewport** (an expert gaze over anchored regions), the **Semantic Highlight**
 * (a typed role/amplitude/lifetime grammar — CDL owns the optics), and the **Attention Contract**
 * (narration segments bound to viewports/highlights, realized by the client choreographer).
 *
 * Everything here is pure and browser-safe (part of the client fold path): defensive readers
 * reconstruct typed records from plain-JSON payloads, and `planSourceProjection` is the
 * deterministic composer-role planner (blueprint decision: one compose→record→render path) —
 * given the same anchors + segment ids + id stream it produces byte-identical plans.
 *
 * Law (CSE-008 §12): only RESOLVED anchors enter a projection — an anchor that fails to resolve
 * is skipped upstream, never mis-highlighted. Every viewport/highlight therefore carries its
 * resolved region (path + page/bbox geometry + exact quote); clients never re-resolve.
 */

// ---------------------------------------------------------------------------
// Views (provider seam) and records (fold state)
// ---------------------------------------------------------------------------

/** A resolved region inside a source version — the geometry a client renders against. */
export interface SourceRegionView {
  readonly path: string;
  readonly page: number | null;
  readonly bbox: readonly [number, number, number, number] | null;
  readonly char_start: number;
  readonly char_end: number;
  /** The exact evidence text (preserved-quote rendering when geometry is unavailable). */
  readonly quote: string;
}

/** A resolved evidence anchor bound to a concept — what the provider seam yields. */
export interface SourceEvidenceAnchorView {
  readonly anchor_id: string;
  readonly source_version_id: string;
  readonly concept_ref: string;
  readonly granularity: string;
  readonly region: SourceRegionView;
}

/**
 * The session's source-evidence seam: resolved anchors for a concept across the surface's
 * attached sources. Wired by the host over the source environment store (anchors may be created
 * on demand — teaching attention drives canonicalization depth, CSE-003). Returning `[]` means
 * the frame simply has no source projection — honest absence, never a guess.
 */
/**
 * A concept's fused, cross-source understanding as surfaced to the session (CSE M9 / CSE-015; R5,
 * ADR-0060). A browser-safe view of the CSE `FusedSynthesis` + its per-source treatments — the host
 * adapts the source-environment type so `@inevitable/surface` needs no source-environment dependency.
 * Present only when ≥2 sources cover the concept and a real (non-degraded) synthesis exists.
 */
export interface FusedSynthesisView {
  readonly concept_ref: string;
  /** The woven explanation — grounded in the sources, each named inline (never outside knowledge). */
  readonly prose: string;
  /** Human-readable titles of the sources the synthesis cites. */
  readonly cited_sources: readonly string[];
  /** True when the synthesis surfaces a live cross-source disagreement (must not be smoothed away). */
  readonly acknowledges_disagreement: boolean;
  /** How many sources cover the concept (the fusion gate — ≥2). */
  readonly source_count: number;
  /** Each covering source's distinct emphasis — the complements fusion composes. */
  readonly treatments: readonly { readonly title: string; readonly emphasis: string }[];
}

export interface SourceEvidenceProvider {
  anchorsForConcept(
    conceptId: string,
    conceptTitle: string,
  ): Promise<readonly SourceEvidenceAnchorView[]>;
  /**
   * The concept's fused cross-source synthesis (R5, ADR-0060), or null when fewer than two sources
   * cover it / no non-degraded synthesis exists. Optional: a provider without it disables FUSION
   * MODE (teaching falls back to single-source/goal, unchanged).
   */
  fusedSynthesisForConcept?(
    conceptId: string,
    conceptTitle: string,
  ): Promise<FusedSynthesisView | null>;
}

/**
 * One grounded frontier entry as surfaced to the session (CSE M9 Frontier T1; CSE-006 §3.2). A
 * browser-safe view of the CSE `FrontierEntry` — the host adapts the source-environment type so
 * `@inevitable/surface` needs no source-environment dependency.
 */
export interface FrontierEntryView {
  readonly kind: string;
  readonly summary: string;
  readonly external_refs: readonly { readonly uri: string; readonly title: string }[];
}

/** A grounded frontier overlay for a concept (the provider seam yields this). */
export interface FrontierOverlayView {
  readonly concept_ref: string;
  readonly entries: readonly FrontierEntryView[];
  readonly degraded: boolean;
}

/**
 * The seam behind proactive frontier surfacing (CSE M9 LKS T1, ADR-0045): on verified mastery the
 * session asks for the *grounded* frontier of the mastered concept. Wired by the host over the CSE
 * frontier research (real web grounding). Returning null / an empty overlay means no citable
 * frontier — honest deferral, never a fabricated one.
 */
export interface SurfaceFrontierProvider {
  researchFrontier(conceptId: string, conceptTitle: string): Promise<FrontierOverlayView | null>;
}

/** A source environment bound to this surface (`surface.source.attached`). */
export interface SourceBindingRecord {
  readonly source_id: string;
  readonly source_version_id: string;
  readonly modality: string;
  readonly title: string;
  readonly layers_available: readonly string[];
  readonly content_ref: string;
  readonly hlc: string;
}

export type ViewportEmphasis = "focus" | "context" | "orientation";
export type ViewportChangeCause = "plan" | "learner" | "citation" | "resume";

/** One Semantic Viewport: a cognitively meaningful region, not an arbitrary crop (CSE-008 §4). */
export interface SourceViewport {
  readonly viewport_id: string;
  readonly anchor_ref: string;
  readonly emphasis: ViewportEmphasis;
  readonly ordinal: number;
  readonly region: SourceRegionView;
}

/** A planner-produced viewport sequence for a frame (`surface.source.viewport.planned`). */
export interface SourceViewportPlanRecord {
  readonly plan_id: string;
  readonly frame_id: string;
  readonly source_version_id: string;
  readonly viewports: readonly SourceViewport[];
  readonly hlc: string;
}

/** A realized/overridden viewport (`surface.source.viewport.changed`). Append-only history. */
export interface SourceViewportChangeRecord {
  readonly viewport_id: string;
  readonly plan_id: string | null;
  readonly source_version_id: string;
  readonly cause: ViewportChangeCause;
  readonly hlc: string;
}

export type SourceHighlightRole =
  | "concept"
  | "prerequisite"
  | "definition"
  | "misconception"
  | "mathematical-focus"
  | "evidence"
  | "citation"
  | "contrast"
  | "frontier"
  | "historical"
  | "curiosity";
export type SourceHighlightAmplitude = "whisper" | "active" | "focal";
export type SourceHighlightLifetime = "pulse" | "held" | "persistent-tint";
export type SourceProvenanceClass = "evidence" | "inference" | "frontier";

/** One semantic highlight (`surface.source.highlight.applied`); `cleared` set by bulk-clear. */
export interface SourceHighlightRecord {
  readonly highlight_id: string;
  readonly frame_id: string;
  readonly source_version_id: string;
  readonly anchor_ref: string;
  readonly role: SourceHighlightRole;
  readonly amplitude: SourceHighlightAmplitude;
  readonly lifetime: SourceHighlightLifetime;
  readonly provenance_class: SourceProvenanceClass;
  readonly decided_by: string;
  readonly region: SourceRegionView;
  readonly cleared: boolean;
  readonly hlc: string;
}

/** One attention-contract binding: a narration segment → viewport + highlights (CSE-008 §6.1). */
export interface SourceSyncBinding {
  readonly segment_id: string;
  readonly viewport_ref: string | null;
  readonly highlight_refs: readonly string[];
}

/** The attention contract instance for one frame (`surface.source.sync.bound`). */
export interface SourceSyncBindingRecord {
  readonly frame_id: string;
  readonly script_id: string;
  readonly bindings: readonly SourceSyncBinding[];
  readonly hlc: string;
}

// ---------------------------------------------------------------------------
// Source render decision — the document as an AGENT-PLACED REGION of the surface
// (CSE-008; "part of the surface, not over it")
// ---------------------------------------------------------------------------

/**
 * Where — and whether — the source document occupies the Cognitive Surface right now.
 * `hidden` = retired (not rendered); `spotlight` = the agent is teaching FROM the doc so it leads a
 * bounded region with cognition beside it; `beside` = a reference column; `corner` = a small
 * peripheral region. The document is never a full-bleed always-on reader.
 */
export type SourceRenderPlacement = "hidden" | "spotlight" | "beside" | "corner";

export interface SourceRenderDecision {
  readonly visible: boolean;
  readonly placement: SourceRenderPlacement;
  /** Why the region is shown or retired — traceable ("teaching from p.3" / "no source reference"). */
  readonly reason: string;
}

export interface PlanSourceRenderInput {
  /** The ACTIVE frame's viewport plan, if any — the agent's gaze into the source for this moment. */
  readonly plan: SourceViewportPlanRecord | null;
  /** The viewport driving prominence (its emphasis maps to placement). */
  readonly currentViewport: SourceViewport | null;
  /** Whether any uncleared highlights exist for the active frame. */
  readonly hasHighlights: boolean;
}

/**
 * Decide whether — and how — the source document occupies the surface for the ACTIVE frame (Slice 1,
 * CSE-008). Pure + deterministic. The region appears ONLY when this frame references the source (a
 * viewport plan or a highlight), is placed by the agent's viewport emphasis, and RETIRES (hidden)
 * otherwise. The agent emits semantic intent (viewport emphasis); the renderer realizes the placement
 * (directive §11) — the surface is a projection, never an always-on document panel.
 */
export function planSourceRender(input: PlanSourceRenderInput): SourceRenderDecision {
  const references = !!input.plan && input.plan.viewports.length > 0;
  if (!references && !input.hasHighlights) {
    return { visible: false, placement: "hidden", reason: "no source reference in this frame" };
  }
  const emphasis: ViewportEmphasis = input.currentViewport?.emphasis ?? "context";
  const placement: SourceRenderPlacement =
    emphasis === "focus" ? "spotlight" : emphasis === "orientation" ? "corner" : "beside";
  const page = input.currentViewport?.region.page ?? null;
  return {
    visible: true,
    placement,
    reason: page !== null ? `teaching from p.${page}` : "teaching from the source",
  };
}

// ---------------------------------------------------------------------------
// Defensive readers — plain-JSON payloads → typed records (deterministic, fold-grade)
// ---------------------------------------------------------------------------

type Raw = Record<string, unknown>;

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback = 0): number => (typeof v === "number" ? v : fallback);
const strOrNull = (v: unknown): string | null => (typeof v === "string" ? v : null);

export function readSourceRegion(raw: Raw | undefined): SourceRegionView {
  const bboxRaw = Array.isArray(raw?.["bbox"]) ? (raw?.["bbox"] as unknown[]) : null;
  const bbox =
    bboxRaw && bboxRaw.length === 4 && bboxRaw.every((n) => typeof n === "number")
      ? ([bboxRaw[0], bboxRaw[1], bboxRaw[2], bboxRaw[3]] as readonly [
          number,
          number,
          number,
          number,
        ])
      : null;
  return {
    path: str(raw?.["path"]),
    page: typeof raw?.["page"] === "number" ? (raw["page"] as number) : null,
    bbox,
    char_start: num(raw?.["char_start"]),
    char_end: num(raw?.["char_end"]),
    quote: str(raw?.["quote"]),
  };
}

export function readSourceBinding(payload: Raw, hlc: string): SourceBindingRecord {
  return {
    source_id: str(payload["source_id"]),
    source_version_id: str(payload["source_version_id"]),
    modality: str(payload["modality"]),
    title: str(payload["title"]),
    layers_available: Array.isArray(payload["layers_available"])
      ? (payload["layers_available"] as unknown[]).map((l) => str(l))
      : [],
    content_ref: str(payload["content_ref"]),
    hlc,
  };
}

export function readViewportPlan(payload: Raw, hlc: string): SourceViewportPlanRecord {
  const viewportsRaw = Array.isArray(payload["viewports"])
    ? (payload["viewports"] as unknown[])
    : [];
  return {
    plan_id: str(payload["plan_id"]),
    frame_id: str(payload["frame_id"]),
    source_version_id: str(payload["source_version_id"]),
    viewports: viewportsRaw.map((v, i) => {
      const vr = (v ?? {}) as Raw;
      return {
        viewport_id: str(vr["viewport_id"]),
        anchor_ref: str(vr["anchor_ref"]),
        emphasis: str(vr["emphasis"], "context") as ViewportEmphasis,
        ordinal: num(vr["ordinal"], i),
        region: readSourceRegion(vr["region"] as Raw | undefined),
      };
    }),
    hlc,
  };
}

export function readViewportChange(payload: Raw, hlc: string): SourceViewportChangeRecord {
  return {
    viewport_id: str(payload["viewport_id"]),
    plan_id: strOrNull(payload["plan_id"]),
    source_version_id: str(payload["source_version_id"]),
    cause: str(payload["cause"], "plan") as ViewportChangeCause,
    hlc,
  };
}

export function readSourceHighlight(payload: Raw, hlc: string): SourceHighlightRecord {
  return {
    highlight_id: str(payload["highlight_id"]),
    frame_id: str(payload["frame_id"]),
    source_version_id: str(payload["source_version_id"]),
    anchor_ref: str(payload["anchor_ref"]),
    role: str(payload["role"], "evidence") as SourceHighlightRole,
    amplitude: str(payload["amplitude"], "whisper") as SourceHighlightAmplitude,
    lifetime: str(payload["lifetime"], "held") as SourceHighlightLifetime,
    provenance_class: str(payload["provenance_class"], "evidence") as SourceProvenanceClass,
    decided_by: str(payload["decided_by"]),
    region: readSourceRegion(payload["region"] as Raw | undefined),
    cleared: false,
    hlc,
  };
}

export function readSyncBinding(payload: Raw, hlc: string): SourceSyncBindingRecord {
  const bindingsRaw = Array.isArray(payload["bindings"]) ? (payload["bindings"] as unknown[]) : [];
  return {
    frame_id: str(payload["frame_id"]),
    script_id: str(payload["script_id"]),
    bindings: bindingsRaw.map((b) => {
      const br = (b ?? {}) as Raw;
      return {
        segment_id: str(br["segment_id"]),
        viewport_ref: strOrNull(br["viewport_ref"]),
        highlight_refs: Array.isArray(br["highlight_refs"])
          ? (br["highlight_refs"] as unknown[]).map((h) => str(h))
          : [],
      };
    }),
    hlc,
  };
}

// ---------------------------------------------------------------------------
// The deterministic composer-role planner (CSE-008 §4.2; blueprint M5 decision)
// ---------------------------------------------------------------------------

/** A narration segment with the content the semantic binder needs (R2d, ADR-0057 D4). */
export interface PlanSourceSegment {
  readonly segment_id: string;
  /** The spoken text — matched against each anchor's quote for the semantic binding + gate. */
  readonly text: string;
  /** The MCCR slot this segment discusses (definition/misconception/…) — drives the highlight role. */
  readonly anchor_ref: string | null;
}

export interface PlanSourceProjectionInput {
  readonly frameId: string;
  readonly scriptId: string;
  /** Recorded narration segment ids, in voicing order (the contract's binding targets). */
  readonly segmentIds: readonly string[];
  /**
   * R2d (ADR-0057 D4): the segments with text + slot. When present, the planner binds each segment
   * to the anchor its text actually discusses (semantic), types the highlight role from the slot,
   * and gates a non-entailed binding to NO highlight. Absent ⇒ the legacy positional binding
   * (segment i → viewport min(i, last), role `evidence`) — byte-identical to pre-R2d.
   */
  readonly segments?: readonly PlanSourceSegment[];
  /** Resolved evidence anchors for the frame's concept (provider seam), in priority order. */
  readonly anchors: readonly SourceEvidenceAnchorView[];
  /** Id stream (the session's generator) — seeded ⇒ byte-identical plans on replay. */
  readonly hex: (bytes: number) => string;
}

/** MCCR slot → the semantic highlight role it lights on the source (R2d, ADR-0057 D4). */
const SLOT_ROLE: Record<string, SourceHighlightRole> = {
  definition: "definition",
  misconception: "misconception",
  key_formula: "mathematical-focus",
  relationship: "concept",
  core_concept: "concept",
  mental_model: "concept",
  key_example: "evidence",
  source_viewport: "evidence",
};

/** Significant lowercased word set (length > 3) — the atom of the lexical entailment measure. */
function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
}

/** Jaccard overlap of two word sets (0..1) — deterministic entailment proxy (no model). */
function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/**
 * A narration segment must share at least this much of its vocabulary with an anchor's quote to
 * light it (R2d, ADR-0057 D4). Below it, the segment lights NOTHING — a wrong highlight asserts
 * false evidence, worse than none (the audit's visual-authority risk). Low because narration
 * paraphrases: a couple of shared meaningful words is real signal.
 */
const ENTAILMENT_THRESHOLD = 0.08;

export interface PlannedSourceProjection {
  readonly plan: {
    readonly plan_id: string;
    readonly frame_id: string;
    readonly source_version_id: string;
    readonly viewports: readonly SourceViewport[];
  };
  readonly highlights: readonly Omit<SourceHighlightRecord, "cleared" | "hlc">[];
  readonly sync: {
    readonly frame_id: string;
    readonly script_id: string;
    readonly bindings: readonly SourceSyncBinding[];
  };
  readonly initialChange: {
    readonly viewport_id: string;
    readonly plan_id: string;
    readonly source_version_id: string;
    readonly cause: ViewportChangeCause;
  };
}

/** At most this many viewports per frame — guided attention, not a slideshow (CSE-008 §4.3). */
const MAX_VIEWPORTS_PER_FRAME = 3;

/**
 * Plan one frame's source projection from its resolved evidence anchors: a viewport per anchor
 * (first = `focus`, rest = `context`), a semantic highlight per viewport (first = `focal`/`held`,
 * rest = `whisper`/`persistent-tint` — one focal highlight at a time, CSE-008 §5.2), and the
 * attention contract binding narration segments to viewports in reading order (segment i → the
 * i-th viewport, clamped to the last — minimum dwell holds because a viewport persists across all
 * segments bound to it). Anchors must share one source version (the caller groups by source);
 * anchors beyond the first source are ignored here.
 *
 * Returns null when there are no anchors or no segments — no projection, honest absence.
 */
export function planSourceProjection(
  input: PlanSourceProjectionInput,
): PlannedSourceProjection | null {
  if (input.anchors.length === 0 || input.segmentIds.length === 0) return null;
  const first = input.anchors[0]!;
  const anchors = input.anchors
    .filter((a) => a.source_version_id === first.source_version_id)
    .slice(0, MAX_VIEWPORTS_PER_FRAME);

  // Ids are allocated planId → viewports → highlights, in this exact order in BOTH paths, so the
  // seeded id stream (and thus replay) is byte-identical to pre-R2d for the legacy positional path.
  const planId = `vpp-${input.hex(8)}`;
  const viewports: SourceViewport[] = anchors.map((a, i) => ({
    viewport_id: `vp-${input.hex(8)}`,
    anchor_ref: a.anchor_id,
    emphasis: i === 0 ? "focus" : "context",
    ordinal: i,
    region: a.region,
  }));
  const highlightIds = anchors.map(() => `hl-${input.hex(8)}`);

  // R2d (ADR-0057 D4): semantic binding + typed roles + entailment gate when segments are given;
  // otherwise the legacy positional binding (role `evidence`), byte-identical to pre-R2d.
  const semantic = input.segments && input.segments.length > 0 ? input.segments : null;
  const anchorWords = semantic ? anchors.map((a) => significantWords(a.region.quote)) : [];
  const matchIdxFor = (seg: PlanSourceSegment): number => {
    const sw = significantWords(seg.text);
    let bestIdx = 0;
    let bestScore = 0;
    anchorWords.forEach((aw, i) => {
      const score = overlap(sw, aw);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    });
    return bestScore >= ENTAILMENT_THRESHOLD ? bestIdx : -1; // gate: below threshold ⇒ light nothing
  };
  const matches = semantic ? semantic.map(matchIdxFor) : [];

  // Per-anchor highlight role: from the first segment that binds to it (its MCCR slot), else evidence.
  const roleFor = (anchorIdx: number): SourceHighlightRole => {
    if (!semantic) return "evidence";
    const boundSeg = semantic.find((_, si) => matches[si] === anchorIdx);
    const slot = boundSeg?.anchor_ref ?? null;
    return (slot && SLOT_ROLE[slot]) || "evidence";
  };

  const highlights = anchors.map((a, i) => ({
    highlight_id: highlightIds[i]!,
    frame_id: input.frameId,
    source_version_id: a.source_version_id,
    anchor_ref: a.anchor_id,
    role: roleFor(i),
    amplitude: (i === 0 ? "focal" : "whisper") as SourceHighlightAmplitude,
    lifetime: (i === 0 ? "held" : "persistent-tint") as SourceHighlightLifetime,
    provenance_class: "evidence" as SourceProvenanceClass,
    decided_by: semantic ? "semantic-binder" : "viewport-planner",
    region: a.region,
  }));

  const bindings: SourceSyncBinding[] = semantic
    ? semantic.map((seg, i) => {
        const ai = matches[i]!;
        if (ai < 0) {
          // Entailment gate: keep the pane oriented on the focus region, but light NO highlight —
          // a wrong highlight asserts false evidence (the audit's visual-authority risk).
          return {
            segment_id: seg.segment_id,
            viewport_ref: viewports[0]!.viewport_id,
            highlight_refs: [],
          };
        }
        return {
          segment_id: seg.segment_id,
          viewport_ref: viewports[ai]!.viewport_id,
          highlight_refs: [highlightIds[ai]!],
        };
      })
    : input.segmentIds.map((segmentId, i) => {
        const vi = Math.min(i, viewports.length - 1);
        return {
          segment_id: segmentId,
          viewport_ref: viewports[vi]!.viewport_id,
          highlight_refs: [highlightIds[vi]!],
        };
      });

  return {
    plan: {
      plan_id: planId,
      frame_id: input.frameId,
      source_version_id: first.source_version_id,
      viewports,
    },
    highlights,
    sync: { frame_id: input.frameId, script_id: input.scriptId, bindings },
    initialChange: {
      viewport_id: viewports[0]!.viewport_id,
      plan_id: planId,
      source_version_id: first.source_version_id,
      cause: "plan",
    },
  };
}
