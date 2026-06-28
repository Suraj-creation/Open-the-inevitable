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
  "image",
] as const;

export type MccrElementType = (typeof MCCR_ELEMENT_TYPES)[number];

/** A node-graph/flow/axes/tree diagram rendered by a pure client function (no provider). */
export interface MccrDiagram {
  readonly kind: "node-graph" | "flow" | "axes" | "tree" | "none";
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
  | { readonly kind: "formula"; readonly latex: string; readonly plain: string }
  | {
      readonly kind: "relationship";
      readonly from: string;
      readonly to: string;
      readonly relation: string;
      readonly text: string;
    }
  | { readonly kind: "diagram"; readonly diagram: MccrDiagram }
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
  readonly image: MccrElement | null;
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
    return { kind: "formula", latex: str(c["latex"]), plain: str(c["plain"]) };
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
    return { kind: "image", artifact, alt: str(c["alt"]), prompt: strOrNull(c["prompt"]) };
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
  const image = slot("image");
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
    image,
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
    image,
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
