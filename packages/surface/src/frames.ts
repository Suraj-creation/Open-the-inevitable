/**
 * Cognitive Frames & the Minimal Complete Cognitive Representation (MCCR).
 *
 * A Cognitive Frame is a bounded, viewport-complete cognitive *state* — the unit of progressive
 * learning that fits one screen and transitions to the next. It carries only the MCCR: distilled
 * visual anchors that deserve persistent attention. The teaching prose lives in the separate
 * narration script (`NarrationScriptRecord`), never on the board.
 *
 * `diagram`/`table` elements are deterministic client-rendered projections (data only, no media
 * provider); only the `image` element touches a provider. Which frame is "active" is a client
 * projection over the choreographer cursor — never a field of canonical state (ADR-0007).
 *
 * Spec: spec/surface/cognitive-surface-runtime.md §4.7–§4.8; SRF-002 §4; ADR-0030.
 */

// ---------------------------------------------------------------------------
// MCCR element model
// ---------------------------------------------------------------------------

export const MCCR_ELEMENT_TYPES = [
  "core_concept",
  "definition",
  "key_formula",
  "diagram",
  "relationship",
  "mental_model",
  "table",
  "key_example",
  "memory_cue",
  "misconception",
  "image",
  "source_viewport",
  "process",
  "code",
] as const;

export type MccrElementType = (typeof MCCR_ELEMENT_TYPES)[number];

/** A node-graph/flow/axes/tree/cycle diagram rendered by a pure client function (no provider). */
export interface MccrDiagram {
  readonly kind: "node-graph" | "flow" | "axes" | "tree" | "cycle" | "none";
  readonly nodes: readonly {
    readonly id: string;
    readonly label: string;
    readonly group: string | null;
  }[];
  readonly edges: readonly {
    readonly from: string;
    readonly to: string;
    readonly relation: string | null;
  }[];
}

/** An out-of-band image artifact reference (binaries never enter events — SRF-004). */
export interface MccrImageArtifact {
  readonly artifact_id: string;
  readonly content_ref: string;
  readonly mime_type: string;
  readonly provider_id: string;
}

export type MccrElementContent =
  | { readonly kind: "text"; readonly text: string }
  | {
      readonly kind: "formula";
      readonly latex: string;
      readonly plain: string;
      /** A multi-line derivation (each entry one LaTeX line, top-to-bottom) — empty for a single
       *  formula. Rendered as a stacked derivation, closer to a textbook than a web page. */
      readonly lines: readonly string[];
      /** R4c (ADR-0058; CSE-018 §6 derivation grammar): optional transformation label per line
       *  ("substitute", "factor", …) — the step's cognitive reason, shown beside the line. Aligned
       *  by index with `lines`; a shorter/absent array leaves later lines unlabeled. */
      readonly line_labels?: readonly string[];
    }
  | {
      readonly kind: "relationship";
      readonly from: string;
      readonly to: string;
      readonly relation: string;
      readonly text: string;
    }
  | {
      /**
       * R4e (ADR-0058; CSE-018 §6 / CSE-013 dissolve grammar): a misconception rendered as a
       * *dissolve*, not a flat equals. `wrong` is the false belief stated exactly as the learner
       * holds it; `correction` is what is actually true. The surface shows wrong → correction (Law 2
       * Progressive Construction) so the learner watches the wrong model recede into the right one.
       * A legacy/degraded misconception (no structure) reads as plain `text` instead (back-compat).
       */
      readonly kind: "misconception";
      readonly wrong: string;
      readonly correction: string;
    }
  | { readonly kind: "diagram"; readonly diagram: MccrDiagram }
  | {
      /**
       * R4e (ADR-0058; CSE-018 §6 process/algorithm grammar): an ordered procedure the learner
       * follows — each step a concrete action, optionally with a clarifying `detail`. Rendered as a
       * numbered sequence that reveals one step at a time while spoken (like the derivation), so the
       * learner watches the process unfold rather than facing a wall of instructions.
       */
      readonly kind: "process";
      readonly steps: readonly {
        readonly text: string;
        readonly detail: string | null;
      }[];
    }
  | {
      /**
       * R4e (ADR-0058; CSE-018 §6 code grammar): real source the learner reads. `lines` preserves
       * indentation; a line's `note` is the annotation for a salient line (only the lines that carry
       * the lesson are annotated). Rendered as a monospace block that spotlights the annotated lines
       * as the narration reaches them — code as a first-class anchor, not prose in a box.
       */
      readonly kind: "code";
      readonly language: string;
      readonly lines: readonly {
        readonly text: string;
        readonly note: string | null;
      }[];
    }
  | {
      readonly kind: "table";
      readonly headers: readonly string[];
      readonly rows: readonly (readonly string[])[];
    }
  | {
      readonly kind: "image";
      readonly artifact: MccrImageArtifact | null;
      readonly alt: string;
      readonly prompt: string | null;
      /** One-line caption shown beneath the image (image-as-cognition, ADR-0030 Phase 4). */
      readonly caption: string | null;
      /** Callout labels annotating the illustration's salient parts (image-as-cognition). */
      readonly labels: readonly string[];
      /** R4e (ADR-0058; CSE-018 Law 9): the recorded reason this image earns its place — surfaced
       *  to the learner as causal transparency (F16). Null when no rationale was recorded. */
      readonly rationale?: string | null;
    }
  | {
      /**
       * An anchored evidence region from a bound Canonical Source Environment (CSE M5,
       * CSE-008 §3.2): the source's actual words on the board beside the distilled anchors,
       * in its own provenance channel. Bytes stay out-of-band; the region carries geometry
       * (page/bbox) for the Living Reference and the exact quote for preserved rendering.
       */
      readonly kind: "source_viewport";
      readonly source_version_id: string;
      readonly anchor_ref: string;
      readonly quote: string;
      readonly region: {
        readonly path: string;
        readonly page: number | null;
        readonly bbox: readonly [number, number, number, number] | null;
        readonly char_start: number;
        readonly char_end: number;
      };
    };

/** One distilled visual anchor. `element_id` is stable so a narration segment can spotlight it. */
export interface MccrElement {
  readonly element_id: string; // "el-" + id; matches narration focus.target_id
  readonly type: MccrElementType;
  readonly slot: string; // layout hint; a render projection only
  readonly reveal_order: number; // staged reveal (logical, not a clock)
  readonly concept_id: string | null;
  readonly content: MccrElementContent;
}

/** The Minimal Complete Cognitive Representation: the only thing shown on the board for a frame. */
export interface Mccr {
  readonly frame_id: string;
  readonly core_concept: MccrElement | null;
  readonly definition: MccrElement | null;
  readonly key_formula: MccrElement | null;
  readonly diagram: MccrElement | null;
  readonly relationship: MccrElement | null;
  readonly mental_model: MccrElement | null;
  readonly table: MccrElement | null;
  readonly key_example: MccrElement | null;
  readonly memory_cue: MccrElement | null;
  /** The common misconception this concept attracts, named so the learner can defuse it (F04). */
  readonly misconception: MccrElement | null;
  readonly image: MccrElement | null;
  /** Anchored source evidence on the board — the source's own words beside the distilled anchors (CSE M5). */
  readonly source_viewport: MccrElement | null;
  /** An ordered procedure/algorithm the learner follows, revealed step by step (R4e; CSE-018 §6). */
  readonly process: MccrElement | null;
  /** Real source the learner reads, annotated on its salient lines (R4e; CSE-018 §6). */
  readonly code: MccrElement | null;
  /** Flat, reveal-order index for O(1) targeting + rendering. */
  readonly elements: readonly MccrElement[];
}

// ---------------------------------------------------------------------------
// Frame layout (the planned skeleton, before content lands)
// ---------------------------------------------------------------------------

export interface FrameLayoutSlot {
  readonly element_id: string;
  readonly type: MccrElementType;
  readonly slot: string;
  readonly reveal_order: number;
}

/** The reserved layout of a frame — element ids/types/slots/reveal-order, no content yet. */
export interface FrameLayout {
  readonly archetype: string; // e.g. "concept-first" | "image-led" | "compare"
  readonly slots: readonly FrameLayoutSlot[];
}

// ---------------------------------------------------------------------------
// Cognitive Frame
// ---------------------------------------------------------------------------

export type CognitiveFrameStatus =
  | "planned"
  | "composed"
  | "speculative"
  | "invalidated"
  | "promoted";

/**
 * The pedagogical role of a frame (ADR-0055 D6) — a typed contract replacing the fragile
 * `title.startsWith("practice")` heuristic. `teach` is the default (an explanatory frame);
 * `practice`/`assessment`/`checkpoint` carry the answer affordance + grading semantics.
 */
export type FrameKind = "teach" | "practice" | "assessment" | "checkpoint";

export interface FrameProvenance {
  readonly planner_packet_id: string | null;
  readonly composer_packet_id: string | null;
  readonly producer_cid: string;
  readonly source_event_id: string | null;
  readonly world_state_nodes: readonly string[];
  readonly trace_id: string | null;
  readonly reason: string;
}

export interface CognitiveFrame {
  readonly frame_id: string; // "cfr-" + id
  readonly surface_id: string;
  readonly ordinal: number; // logical progression order (sparse — promotion-friendly)
  readonly status: CognitiveFrameStatus;
  /** Pedagogical role (ADR-0055 D6). Defaults to `teach` for pre-1.7.0 logs (title-heuristic era). */
  readonly kind: FrameKind;
  readonly concept_id: string | null;
  readonly title: string;
  /** The reserved layout (present from `planned`; carried through compose). */
  readonly layout: FrameLayout | null;
  /** Full MCCR; null until `composed` (the layout carries the planned skeleton). */
  readonly mccr: Mccr | null;
  readonly segment_ids: readonly string[]; // narration segments that voice this frame, in order
  readonly speculative_of: string | null; // set when promoted/invalidated from a speculative line
  readonly invalidation_reason: string | null;
  readonly trigger_assumption: string | null; // the bet a speculative frame rests on
  readonly provenance: FrameProvenance;
  readonly version: number; // 0 = planned-only; 1 = composed
  readonly hlc: string;
}

// ---------------------------------------------------------------------------
// Narration script + image decision records (separate from the on-screen MCCR)
// ---------------------------------------------------------------------------

export type NarrationIntent =
  | "introduce"
  | "build"
  | "illustrate"
  | "connect"
  | "check"
  | "reinforce";

/** One spoken teaching segment; `anchor_ref` names the MCCR slot it discusses. */
export interface NarrationScriptSegment {
  readonly segment_id: string;
  readonly anchor_ref: string | null; // an MccrElementType slot name, or null (whole frame)
  readonly intent: NarrationIntent;
  readonly text: string;
  readonly reveal_ids: readonly string[];
  readonly pause_after: boolean;
}

export interface NarrationScriptRecord {
  readonly script_id: string;
  readonly frame_id: string;
  readonly segments: readonly NarrationScriptSegment[];
  readonly hlc: string;
}

export interface ImageDecisionRecord {
  readonly frame_id: string;
  readonly helps: boolean;
  readonly modality: "image" | "none";
  readonly prompt: string | null;
  readonly rationale: string;
  readonly hlc: string;
}

/** Transient buffer of in-flight streamed MCCR element text, cleared by `surface.frame.composed`. */
export interface StreamingFrameElementBuffer {
  readonly frame_id: string;
  readonly element_id: string;
  readonly text: string;
  readonly last_seq: number;
}

// ---------------------------------------------------------------------------
// Defensive readers — reconstruct typed values from plain-JSON event payloads.
// Deterministic: same payload ⇒ byte-identical value (used by the surface fold).
// ---------------------------------------------------------------------------

type Raw = Record<string, unknown>;

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback = 0): number => (typeof v === "number" ? v : fallback);
const boolean = (v: unknown, fallback = false): boolean => (typeof v === "boolean" ? v : fallback);
const strOrNull = (v: unknown): string | null => (typeof v === "string" ? v : null);

function readDiagram(raw: Raw | undefined): MccrDiagram {
  const kind = str(raw?.["kind"], "none") as MccrDiagram["kind"];
  const nodesRaw = Array.isArray(raw?.["nodes"]) ? (raw?.["nodes"] as unknown[]) : [];
  const edgesRaw = Array.isArray(raw?.["edges"]) ? (raw?.["edges"] as unknown[]) : [];
  return {
    kind,
    nodes: nodesRaw.map((n) => {
      const nr = (n ?? {}) as Raw;
      return { id: str(nr["id"]), label: str(nr["label"]), group: strOrNull(nr["group"]) };
    }),
    edges: edgesRaw.map((e) => {
      const er = (e ?? {}) as Raw;
      return { from: str(er["from"]), to: str(er["to"]), relation: strOrNull(er["relation"]) };
    }),
  };
}

function readElementContent(type: MccrElementType, raw: Raw | undefined): MccrElementContent {
  const c = raw ?? {};
  const kind = str(c["kind"]);
  if (kind === "formula" || type === "key_formula") {
    const lineLabels = Array.isArray(c["line_labels"])
      ? (c["line_labels"] as unknown[]).map((l) => str(l))
      : undefined;
    return {
      kind: "formula",
      latex: str(c["latex"]),
      plain: str(c["plain"]),
      lines: Array.isArray(c["lines"])
        ? (c["lines"] as unknown[]).map((l) => str(l)).filter((l) => l.length > 0)
        : [],
      ...(lineLabels ? { line_labels: lineLabels } : {}),
    };
  }
  if (kind === "misconception") {
    // Only a composer that emitted the structured dissolve carries kind:"misconception"; a legacy
    // element is type:"misconception" with kind:"text" and falls through to the plain-text return.
    return { kind: "misconception", wrong: str(c["wrong"]), correction: str(c["correction"]) };
  }
  if (kind === "process" || type === "process") {
    const stepsRaw = Array.isArray(c["steps"]) ? (c["steps"] as unknown[]) : [];
    return {
      kind: "process",
      steps: stepsRaw
        .map((s) => {
          const so = (s ?? {}) as Raw;
          return { text: str(so["text"]), detail: strOrNull(so["detail"]) };
        })
        .filter((s) => s.text.length > 0),
    };
  }
  if (kind === "code" || type === "code") {
    const linesRaw = Array.isArray(c["lines"]) ? (c["lines"] as unknown[]) : [];
    return {
      kind: "code",
      language: str(c["language"], "text"),
      // Blank lines are preserved (code spacing); only non-object/non-string entries drop out.
      lines: linesRaw.map((l) => {
        const lo = (l ?? {}) as Raw;
        return { text: str(lo["text"]), note: strOrNull(lo["note"]) };
      }),
    };
  }
  if (kind === "relationship" || type === "relationship") {
    return {
      kind: "relationship",
      from: str(c["from"]),
      to: str(c["to"]),
      relation: str(c["relation"]),
      text: str(c["text"]),
    };
  }
  if (kind === "diagram" || type === "diagram") {
    return { kind: "diagram", diagram: readDiagram(c["diagram"] as Raw | undefined) };
  }
  if (kind === "table" || type === "table") {
    const headers = Array.isArray(c["headers"])
      ? (c["headers"] as unknown[]).map((h) => str(h))
      : [];
    const rowsRaw = Array.isArray(c["rows"]) ? (c["rows"] as unknown[]) : [];
    return {
      kind: "table",
      headers,
      rows: rowsRaw.map((r) => (Array.isArray(r) ? (r as unknown[]).map((cell) => str(cell)) : [])),
    };
  }
  if (kind === "source_viewport" || type === "source_viewport") {
    const regionRaw = (c["region"] ?? {}) as Raw;
    const bboxRaw = Array.isArray(regionRaw["bbox"]) ? (regionRaw["bbox"] as unknown[]) : null;
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
      kind: "source_viewport",
      source_version_id: str(c["source_version_id"]),
      anchor_ref: str(c["anchor_ref"]),
      quote: str(c["quote"]),
      region: {
        path: str(regionRaw["path"]),
        page: typeof regionRaw["page"] === "number" ? (regionRaw["page"] as number) : null,
        bbox,
        char_start: num(regionRaw["char_start"]),
        char_end: num(regionRaw["char_end"]),
      },
    };
  }
  if (kind === "image" || type === "image") {
    const artRaw = c["artifact"] as Raw | undefined;
    const artifact: MccrImageArtifact | null = artRaw
      ? {
          artifact_id: str(artRaw["artifact_id"]),
          content_ref: str(artRaw["content_ref"]),
          mime_type: str(artRaw["mime_type"]),
          provider_id: str(artRaw["provider_id"]),
        }
      : null;
    return {
      kind: "image",
      artifact,
      alt: str(c["alt"]),
      prompt: strOrNull(c["prompt"]),
      caption: strOrNull(c["caption"]),
      labels: Array.isArray(c["labels"])
        ? (c["labels"] as unknown[]).map((l) => str(l)).filter((l) => l.length > 0)
        : [],
      rationale: strOrNull(c["rationale"]),
    };
  }
  return { kind: "text", text: str(c["text"]) };
}

function readElement(raw: Raw | undefined): MccrElement | null {
  if (!raw) return null;
  const type = str(raw["type"]) as MccrElementType;
  if (!MCCR_ELEMENT_TYPES.includes(type)) return null;
  return {
    element_id: str(raw["element_id"]),
    type,
    slot: str(raw["slot"], type),
    reveal_order: num(raw["reveal_order"]),
    concept_id: strOrNull(raw["concept_id"]),
    content: readElementContent(type, raw["content"] as Raw | undefined),
  };
}

/** Reconstruct an MCCR from a plain-JSON payload. Builds the flat `elements` index deterministically. */
export function readMccr(raw: Raw | undefined, frameId: string): Mccr {
  const slot = (key: MccrElementType): MccrElement | null =>
    readElement(raw?.[key] as Raw | undefined);
  const core_concept = slot("core_concept");
  const definition = slot("definition");
  const key_formula = slot("key_formula");
  const diagram = slot("diagram");
  const relationship = slot("relationship");
  const mental_model = slot("mental_model");
  const table = slot("table");
  const key_example = slot("key_example");
  const memory_cue = slot("memory_cue");
  const misconception = slot("misconception");
  const image = slot("image");
  const source_viewport = slot("source_viewport");
  const process = slot("process");
  const code = slot("code");
  const elements = [
    core_concept,
    definition,
    key_formula,
    diagram,
    relationship,
    mental_model,
    table,
    key_example,
    memory_cue,
    misconception,
    image,
    source_viewport,
    process,
    code,
  ]
    .filter((e): e is MccrElement => e !== null)
    .sort((a, b) => a.reveal_order - b.reveal_order);
  return {
    frame_id: frameId,
    core_concept,
    definition,
    key_formula,
    diagram,
    relationship,
    mental_model,
    table,
    key_example,
    memory_cue,
    misconception,
    image,
    source_viewport,
    process,
    code,
    elements,
  };
}

export function readFrameLayout(raw: Raw | undefined): FrameLayout | null {
  if (!raw) return null;
  const slotsRaw = Array.isArray(raw["slots"]) ? (raw["slots"] as unknown[]) : [];
  return {
    archetype: str(raw["archetype"], "concept-first"),
    slots: slotsRaw.map((s) => {
      const sr = (s ?? {}) as Raw;
      return {
        element_id: str(sr["element_id"]),
        type: str(sr["type"]) as MccrElementType,
        slot: str(sr["slot"]),
        reveal_order: num(sr["reveal_order"]),
      };
    }),
  };
}

export function readNarrationScriptSegments(raw: unknown): readonly NarrationScriptSegment[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).map((s, i) => {
    const sr = (s ?? {}) as Raw;
    return {
      segment_id: str(sr["segment_id"], `seg-${i}`),
      anchor_ref: strOrNull(sr["anchor_ref"]),
      intent: str(sr["intent"], "build") as NarrationIntent,
      text: str(sr["text"]),
      reveal_ids: Array.isArray(sr["reveal_ids"])
        ? (sr["reveal_ids"] as unknown[]).map((r) => str(r))
        : [],
      pause_after: boolean(sr["pause_after"]),
    };
  });
}

export function readFrameProvenance(raw: Raw): FrameProvenance {
  return {
    planner_packet_id: strOrNull(raw["planner_packet_id"]),
    composer_packet_id: strOrNull(raw["composer_packet_id"]),
    producer_cid: str(raw["producer_cid"]),
    source_event_id: strOrNull(raw["source_event_id"]),
    world_state_nodes: Array.isArray(raw["world_state_nodes"])
      ? (raw["world_state_nodes"] as unknown[]).map((n) => str(n))
      : [],
    trace_id: strOrNull(raw["trace_id"]),
    reason: str(raw["reason"]),
  };
}
