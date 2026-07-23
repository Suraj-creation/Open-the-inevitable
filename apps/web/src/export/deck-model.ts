/**
 * Deck model — the pure projection from a folded SurfaceState to an exportable study artifact
 * (review §24 / issue 11: every learning session is downloadable knowledge, not a dead tab).
 *
 * One canonical frame ⇒ one slide: the MCCR anchors become typed slide blocks, the narration
 * script becomes speaker notes, the path becomes the cover. Framework-free and renderer-agnostic —
 * the .pptx renderer (and future PDF/Markdown/LaTeX exporters) all consume THIS model, so every
 * format derives from the same canonical frame model. Pure: same state ⇒ same model.
 */
import type {
  CognitiveFrame,
  MccrDiagram,
  MccrElement,
  SurfaceState,
} from "@inevitable/surface/client";
import { frameRole } from "../frames";

export type DeckBlock =
  | { readonly kind: "text"; readonly role: string; readonly label: string; readonly text: string }
  | {
      readonly kind: "formula";
      readonly plain: string;
      readonly latex: string;
      readonly lines: readonly string[];
      /** R4c (ADR-0058): transformation label per derivation line (aligned by index). */
      readonly line_labels?: readonly string[];
    }
  | {
      readonly kind: "table";
      readonly headers: readonly string[];
      readonly rows: readonly (readonly string[])[];
    }
  | {
      readonly kind: "relationship";
      readonly from: string;
      readonly to: string;
      readonly relation: string;
      readonly text: string;
    }
  | { readonly kind: "diagram"; readonly diagram: MccrDiagram }
  | {
      readonly kind: "image";
      readonly url: string;
      readonly alt: string;
      readonly caption: string | null;
      readonly labels: readonly string[];
    };

export interface DeckSlide {
  readonly title: string;
  readonly conceptId: string | null;
  readonly ordinal: number;
  /** Cognitive state of the frame (learning/practice/assessment/research) — the slide's accent. */
  readonly state: string;
  readonly blocks: readonly DeckBlock[];
  /** The narration script — the spoken teaching — as speaker notes. */
  readonly notes: string;
}

export interface DeckModel {
  readonly goal: string | null;
  readonly surfaceId: string;
  readonly path: readonly { readonly title: string; readonly status: string }[];
  readonly slides: readonly DeckSlide[];
}

/** Role labels mirrored from the board's visual grammar (TYPE_LABEL) — the deck speaks the same language. */
const LABELS: Record<string, string> = {
  definition: "Definition",
  mental_model: "Mental model",
  key_example: "Example",
  memory_cue: "Remember",
  misconception: "Watch out",
  process: "Steps",
  code: "Code",
};

function slideState(frame: CognitiveFrame): string {
  // Pedagogical role from the typed kind (ADR-0055 D6), title/archetype only as replay fallback.
  const role = frameRole(frame);
  if (role === "practice") return "practice";
  if (role === "assessment") return "assessment";
  const title = frame.title.toLowerCase();
  if (title.includes("research") || (frame.concept_id ?? "").includes("frontier"))
    return "research";
  return "learning";
}

function blockOf(element: MccrElement): DeckBlock | null {
  const content = element.content;
  switch (content.kind) {
    case "text":
      // core_concept becomes the slide title (handled by the caller), never a body block.
      if (element.type === "core_concept") return null;
      return {
        kind: "text",
        role: element.type,
        label: LABELS[element.type] ?? element.type,
        text: content.text,
      };
    case "formula":
      return {
        kind: "formula",
        plain: content.plain || content.latex,
        latex: content.latex,
        lines: content.lines,
        ...(content.line_labels ? { line_labels: content.line_labels } : {}),
      };
    case "misconception":
      // R4e: the exported deck flattens the dissolve into one line — the board's animation can't
      // survive a static slide, but the wrong→correction meaning must (never silently dropped).
      return {
        kind: "text",
        role: element.type,
        label: LABELS[element.type] ?? element.type,
        text: `✗ ${content.wrong} → ✓ ${content.correction}`,
      };
    case "process":
      // R4e: a static slide can't stage the steps, but the ordered procedure must survive — flatten
      // to a numbered text block (never silently dropped).
      return {
        kind: "text",
        role: element.type,
        label: LABELS[element.type] ?? element.type,
        text: content.steps
          .map((s, i) => `${i + 1}. ${s.text}${s.detail ? ` — ${s.detail}` : ""}`)
          .join("\n"),
      };
    case "code":
      // R4e: a static slide can't emphasize lines, but the source must survive verbatim — flatten
      // to a monospace text block (indentation preserved; notes appended as trailing comments).
      return {
        kind: "text",
        role: element.type,
        label: `${LABELS[element.type] ?? element.type} · ${content.language}`,
        text: content.lines.map((l) => (l.note ? `${l.text}    // ${l.note}` : l.text)).join("\n"),
      };
    case "table":
      return { kind: "table", headers: content.headers, rows: content.rows };
    case "relationship":
      return {
        kind: "relationship",
        from: content.from,
        to: content.to,
        relation: content.relation,
        text: content.text,
      };
    case "diagram":
      return content.diagram.nodes.length > 0
        ? { kind: "diagram", diagram: content.diagram }
        : null;
    case "image":
      return content.artifact
        ? {
            kind: "image",
            url: content.artifact.content_ref,
            alt: content.alt,
            caption: content.caption,
            labels: content.labels,
          }
        : null;
    default:
      return null;
  }
}

/** Build the exportable deck from folded state. Only surfaced frames (composed/promoted) export. */
export function buildDeckModel(state: SurfaceState): DeckModel {
  const scriptByFrame = new Map(state.narration_scripts.map((s) => [s.frame_id, s] as const));
  const slides = [...state.frames]
    .filter((f) => (f.status === "composed" || f.status === "promoted") && f.mccr !== null)
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((frame): DeckSlide => {
      const mccr = frame.mccr!;
      const core =
        mccr.core_concept?.content.kind === "text" ? mccr.core_concept.content.text : null;
      const blocks = mccr.elements.map(blockOf).filter((b): b is DeckBlock => b !== null);
      const script = scriptByFrame.get(frame.frame_id);
      const notes = script
        ? script.segments.map((s) => s.text).join("\n\n")
        : state.narration
            .filter((s) => s.frame_id === frame.frame_id)
            .map((s) => s.text)
            .join("\n\n");
      return {
        title: core ?? frame.title,
        conceptId: frame.concept_id,
        ordinal: frame.ordinal,
        state: slideState(frame),
        blocks,
        notes,
      };
    });
  return {
    goal: state.goal,
    surfaceId: state.surface_id,
    path: (state.timeline?.nodes ?? []).map((n) => ({ title: n.title, status: n.status })),
    slides,
  };
}
