/**
 * StreamingBoard — the board FORMING in real time (UCS, ADR-0063 Phase B).
 *
 * While the Surface Composer streams a frame, its MCCR string anchors arrive one at a time as
 * `surface.frame.element.delta` and fold into the transient `streaming_frame_elements` buffer. This
 * renders that buffer as ghost anchors with a live caret, so the learner watches understanding take
 * shape *before* the frame composes — instead of staring at a "Composing…" pulse. It is a pure
 * projection of transient state: the moment `surface.frame.composed` lands, the buffer clears and the
 * real FrameStage takes over (the settled board is always the composed frame, never these previews).
 */
import type { SurfaceState } from "@inevitable/surface/client";

type StreamingElement = SurfaceState["streaming_frame_elements"][number];

/** `el-core_concept` → `core_concept`. */
function slotOf(elementId: string): string {
  return elementId.startsWith("el-") ? elementId.slice(3) : elementId;
}

/** A human label for a forming anchor, e.g. `el-mental_model` → `mental model`. */
function labelOf(elementId: string): string {
  return slotOf(elementId).replace(/_/g, " ");
}

export function StreamingBoard({ elements }: { readonly elements: readonly StreamingElement[] }) {
  if (elements.length === 0) return null;
  // Anchors appear in the order the model produced them (monotone seq), so the board builds top-down.
  const ordered = [...elements].sort((a, b) => a.last_seq - b.last_seq);
  return (
    <section
      className="frame-stage frame-stage--forming"
      aria-live="polite"
      aria-label="The board is forming"
    >
      <div className="frame-fit">
        <div className="frame-grid" data-density="full" data-status="composing">
          {ordered.map((el) => (
            <article
              key={el.element_id}
              className="mccr-el mccr-el--forming"
              data-type={slotOf(el.element_id)}
            >
              <span className="mccr-forming-label">{labelOf(el.element_id)}</span>
              <p className="mccr-forming-text">
                {el.text}
                <span className="mccr-forming-caret" aria-hidden>
                  ▍
                </span>
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
