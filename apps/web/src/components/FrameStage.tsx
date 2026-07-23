/**
 * FrameStage — renders ONE Cognitive Frame as a viewport-complete cognitive state (UCS, ADR-0030).
 *
 * The board holds only the frame's Minimal Complete Cognitive Representation (MCCR) — distilled
 * anchors, never teaching prose. It never scrolls and never clips: if the anchors overflow one
 * viewport, the board RECOMPOSES — low-priority anchors fold into disclosure chips (CDL density
 * recomposition) and reopen on the focus plane on demand. As the narration plays, the
 * HighlightLayer spotlights the anchor being discussed while its siblings recede (depth of field
 * for attention). The active frame is chosen by the choreographer cursor (a client projection);
 * this component only renders.
 */
import { useEffect, useState } from "react";
import type { CognitiveFrame } from "@inevitable/surface/client";
import { frameElements, frameRole } from "../frames";
import { useDensityRecomposition } from "../useDensityRecomposition";
import { HighlightLayer } from "./HighlightLayer";
import { MccrElementView, TYPE_LABEL, type ElementAction } from "./MccrElement";

export function FrameStage({
  frame,
  highlightElementId,
  thinking,
  phase = "static",
  staged = false,
  revealedElementIds,
  anchoredElementIds,
  onElementAction,
  markedElementIds,
  recededElementIds,
  elementRoles,
  directedState,
}: {
  readonly frame: CognitiveFrame | null;
  readonly highlightElementId: string | null;
  readonly thinking: boolean;
  /** Transition role within the FrameDeck: the incoming frame "enter"s, the prior frame "exit"s. */
  readonly phase?: "enter" | "exit" | "static";
  /** When true, elements reveal progressively as the narration reaches them (active frame only). */
  readonly staged?: boolean;
  readonly revealedElementIds?: ReadonlySet<string>;
  readonly anchoredElementIds?: ReadonlySet<string>;
  /** Act on the lesson from a specific anchor (active frame only) — the board is manipulable (F16,
   *  CSE-014). The element id is passed so a Mark targets the anchor. */
  readonly onElementAction?: (kind: ElementAction, elementId: string) => void;
  /** Anchors the learner has marked (a scene evolution, CSE M8 T2) — rendered with a durable mark. */
  readonly markedElementIds?: ReadonlySet<string>;
  /** R3d (ADR-0057; CSE-012 §4): elements the Scene's lighting recedes (dimmed; the focus stands out). */
  readonly recededElementIds?: ReadonlySet<string>;
  /** R4b (ADR-0058; CSE-018 Law 5): per-element epistemic role + hierarchy from the RIA's plan. */
  readonly elementRoles?: ReadonlyMap<string, { role: string; hierarchy: string }>;
  /**
   * The Cognitive Director's target state for this frame's Scene (CSE M7 T1). When present it
   * drives the board's CDL hue — the Director conducts (ADR-0033 L1); the client only realizes it.
   * Absent (Theater off / pre-Director sessions) ⇒ the frame-title heuristic still tints the board.
   */
  readonly directedState?: CognitiveState | null;
}) {
  const elements = frameElements(frame);
  const { containerRef, innerRef, folded, scale } = useDensityRecomposition<
    HTMLElement,
    HTMLDivElement
  >(
    elements.map((e) => ({ id: e.element_id, type: e.type })),
    highlightElementId,
    // A streamed-in anchor re-opens the fold ledger: composition decisions are only durable
    // against the fully-materialized board.
    [frame?.frame_id, frame?.version, elements.length],
  );
  const visible = elements.filter((e) => !folded.has(e.element_id));
  const foldedElements = elements.filter((e) => folded.has(e.element_id));
  // A folded anchor reopens on the focus plane (P4) — never a scrollbar, never a squint.
  const [openedId, setOpenedId] = useState<string | null>(null);
  useEffect(() => setOpenedId(null), [frame?.frame_id]);
  const opened = foldedElements.find((e) => e.element_id === openedId) ?? null;

  const archetype = frame?.layout?.archetype ?? "concept-first";
  // Density drives composition: a 2–3 anchor frame centers and enlarges rather than floating two
  // thin strips in an empty column. `full` frames keep the standard grid.
  const density = visible.length <= 3 ? "sparse" : "full";
  // Title duplication (N14): the frame title and the core_concept anchor are often identical (every
  // pedagogical frame). Show the decorative <h1> only when it adds information beyond that anchor —
  // the core_concept element remains (it is the narration's "introduce" highlight target).
  const coreText = elements.find(
    (e) => e.type === "core_concept" && e.content.kind === "text",
  )?.content;
  const coreConceptText = coreText && coreText.kind === "text" ? coreText.text.trim() : "";
  const showTitle = !!frame?.title && frame.title.trim() !== coreConceptText;
  // Cognitive color language (review §16): the stage's lighting shifts with the KIND of thinking
  // this frame carries. When the Cognitive Director is conducting (CSE M7 T1) its directed state
  // is authoritative; otherwise the frame-title heuristic decides (backward-compatible, ADR-0033 L2).
  const cognitiveTint = directedState ?? frameTint(frame);

  if (!frame) {
    return (
      <section className="frame-stage frame-stage--empty">
        <div className="frame-empty-pulse" aria-hidden />
        <p className="frame-empty-text">{thinking ? "Composing…" : "The surface is ready."}</p>
      </section>
    );
  }

  return (
    <section
      className={`frame-stage${phase === "enter" ? " frame-stage--enter" : phase === "exit" ? " frame-stage--exit" : ""}`}
      ref={containerRef}
      aria-hidden={phase === "exit"}
      style={{ ["--stage-tint" as string]: `var(--tint-${cognitiveTint})` }}
      data-cognitive-state={cognitiveTint}
    >
      <div
        className="frame-fit"
        ref={innerRef}
        style={scale < 1 ? { transform: `scale(${scale})`, transformOrigin: "top center" } : {}}
      >
        {showTitle ? <h1 className="frame-title">{frame.title}</h1> : null}
        <div
          className="frame-grid"
          data-archetype={archetype}
          data-density={density}
          // Focus recession (CDL): while the narration spotlights one anchor, its siblings recede.
          data-focus={highlightElementId ? "true" : "false"}
          // The frame is a complete thought; if a frame is still composing it shows its skeleton.
          data-status={frame.status}
        >
          {visible.map((el) => (
            <MccrElementView
              key={el.element_id}
              element={el}
              active={el.element_id === highlightElementId}
              // Staged reveal: an element shows once the narration reaches it. The core concept and
              // any element no segment anchors (orphan) show immediately, so the board is never blank.
              revealed={
                !staged ||
                el.type === "core_concept" ||
                !(anchoredElementIds?.has(el.element_id) ?? false) ||
                (revealedElementIds?.has(el.element_id) ?? false)
              }
              marked={markedElementIds?.has(el.element_id) ?? false}
              // Recede a sibling actor only when it is NOT the element currently being spoken —
              // the active highlight always reads at full strength (never fight the narration).
              receded={
                (recededElementIds?.has(el.element_id) ?? false) &&
                el.element_id !== highlightElementId
              }
              {...(elementRoles?.get(el.element_id)
                ? {
                    epistemicRole: elementRoles.get(el.element_id)!.role,
                    hierarchy: elementRoles.get(el.element_id)!.hierarchy,
                  }
                : {})}
              {...(onElementAction ? { onAction: onElementAction } : {})}
            />
          ))}
          {foldedElements.length > 0 ? (
            <div className="mccr-folded" role="group" aria-label="More on this concept">
              {foldedElements.map((el) => (
                <button
                  key={el.element_id}
                  type="button"
                  className="mccr-fold-chip"
                  onClick={() => setOpenedId(el.element_id)}
                  aria-haspopup="dialog"
                >
                  <span className="mccr-fold-kind">{TYPE_LABEL[el.type] ?? el.type}</span>
                  <span aria-hidden> ↗</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {/* The moving marker tracks the narration; it measures within its own positioned ancestor
            (this .frame-fit) and divides out the fit scale, so it sits exactly over the anchor. */}
        <HighlightLayer containerRef={innerRef} elementId={highlightElementId} scale={scale} />
      </div>
      {/* The focus plane: a folded anchor, reopened — glass over the board, one idea forward. */}
      {opened ? (
        <div className="mccr-focus-layer" role="dialog" aria-label={TYPE_LABEL[opened.type]}>
          <button
            type="button"
            className="mccr-focus-scrim"
            onClick={() => setOpenedId(null)}
            aria-label="Close"
          />
          <div className="mccr-focus-card">
            <MccrElementView
              element={opened}
              active
              revealed
              {...(onElementAction ? { onAction: onElementAction } : {})}
            />
            <button
              type="button"
              className="overlay-close mccr-focus-close"
              onClick={() => setOpenedId(null)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export type CognitiveState =
  | "learning"
  | "practice"
  | "assessment"
  | "research"
  | "discovery"
  | "reflection"
  | "mastery"
  | "struggle";

/**
 * Map a Cognitive Director state (CSE-011 §3.1) to a CDL tint (CSE M7 T1). The Director names the
 * cognitive state; the CDL owns the hue — this is the seam where a directive becomes light.
 */
export function directorStateToTint(state: string | null | undefined): CognitiveState | null {
  switch (state) {
    case "orienting":
      return "discovery";
    case "learning":
      return "learning";
    case "practicing":
      return "practice";
    case "struggling":
      return "struggle";
    case "consolidating":
      return "reflection";
    case "assessing":
      return "assessment";
    case "mastering":
      return "mastery";
    default:
      return null;
  }
}

/**
 * The cognitive state a frame embodies — drives the stage tint. Derived from the frame's shape (its
 * title/archetype/concept), never a new canonical field: a pure client projection (ADR-0007).
 */
function frameTint(frame: CognitiveFrame | null): CognitiveState {
  if (!frame) return "learning";
  // Pedagogical role from the typed kind (ADR-0055 D6), title/archetype only as replay fallback.
  const role = frameRole(frame);
  if (role === "practice") return "practice";
  if (role === "assessment") return "assessment";
  const title = frame.title.toLowerCase();
  const concept = (frame.concept_id ?? "").toLowerCase();
  if (title.includes("research") || concept.includes("research") || concept.includes("frontier"))
    return "research";
  return "learning";
}
