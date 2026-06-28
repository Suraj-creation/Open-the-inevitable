/**
 * FrameStage — renders ONE Cognitive Frame as a viewport-complete cognitive state (UCS, ADR-0030).
 *
 * The board holds only the frame's Minimal Complete Cognitive Representation (MCCR) — distilled
 * anchors, never teaching prose. It never scrolls: the frame is sized to fit one viewport, and a
 * uniform downscale catches any residual overflow (useFitToViewport). As the narration plays, the
 * HighlightLayer spotlights the MCCR element being discussed. The active frame is chosen by the
 * choreographer cursor (a client projection); this component only renders.
 */
import { useRef } from "react";
import type { CognitiveFrame } from "@inevitable/surface/client";
import { frameElements } from "../frames";
import { useFitToViewport } from "../useFitToViewport";
import { HighlightLayer } from "./HighlightLayer";
import { MccrElementView } from "./MccrElement";

export function FrameStage({
  frame,
  highlightElementId,
  thinking,
  phase = "static",
}: {
  readonly frame: CognitiveFrame | null;
  readonly highlightElementId: string | null;
  readonly thinking: boolean;
  /** Transition role within the FrameDeck: the incoming frame "enter"s, the prior frame "exit"s. */
  readonly phase?: "enter" | "exit" | "static";
}) {
  const { containerRef, innerRef, scale } = useFitToViewport<HTMLDivElement, HTMLDivElement>([
    frame?.frame_id,
    frame?.version,
  ]);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const elements = frameElements(frame);
  const archetype = frame?.layout?.archetype ?? "concept-first";

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
    >
      <div
        className="frame-fit"
        ref={innerRef}
        style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}
      >
        {frame.title ? <h1 className="frame-title">{frame.title}</h1> : null}
        <div
          className="frame-grid"
          data-archetype={archetype}
          ref={gridRef}
          // The frame is a complete thought; if a frame is still composing it shows its skeleton.
          data-status={frame.status}
        >
          {elements.map((el) => (
            <MccrElementView
              key={el.element_id}
              element={el}
              active={el.element_id === highlightElementId}
            />
          ))}
        </div>
        {/* The moving marker tracks the narration over the grid (reduced-motion: snaps). */}
        <HighlightLayer stageRef={gridRef} elementId={highlightElementId} />
      </div>
    </section>
  );
}
