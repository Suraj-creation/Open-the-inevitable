/**
 * CompositionPanel — the Observatory's window into the frame composition pipeline (UCS, ADR-0030).
 *
 * Surfaces the progressive Cognitive Frame sequence the learner is moving through: each frame's
 * status, its MCCR anchors (the distilled board content), a density check against the ~6-anchor budget,
 * and the image decision behind it. The look-ahead sub-list shows discardable speculative frames the
 * planner prepared (Phase 3) — recorded for observability, never surfaced to the learner until promoted.
 * A pure projection of folded state — nothing about the composition stays hidden (F09 §4.1).
 */
import type {
  CognitiveFrame,
  ImageDecisionRecord,
  NarrationScriptRecord,
} from "@inevitable/surface/client";

/** The anchor budget that keeps one frame to one viewport (ADR-0030 density law). */
const DENSITY_BUDGET = 6;

export interface CompositionPanelProps {
  readonly frames: readonly CognitiveFrame[];
  readonly speculative: readonly CognitiveFrame[];
  readonly imageDecisions: readonly ImageDecisionRecord[];
  readonly narrationScripts: readonly NarrationScriptRecord[];
  readonly activeFrameId: string | null;
}

function anchorCount(frame: CognitiveFrame): number {
  if (frame.mccr) return frame.mccr.elements.length;
  return frame.layout?.slots.length ?? 0;
}

function anchorTypes(frame: CognitiveFrame): string[] {
  if (frame.mccr) return frame.mccr.elements.map((e) => e.type);
  return frame.layout?.slots.map((s) => s.type) ?? [];
}

export function CompositionPanel({
  frames,
  speculative,
  imageDecisions,
  narrationScripts,
  activeFrameId,
}: CompositionPanelProps) {
  if (frames.length === 0 && speculative.length === 0) return null;
  const sorted = [...frames].sort((a, b) => a.ordinal - b.ordinal);
  const imageByFrame = new Map(imageDecisions.map((d) => [d.frame_id, d] as const));
  const scriptByFrame = new Map(narrationScripts.map((s) => [s.frame_id, s] as const));
  const liveSpeculative = speculative.filter((f) => f.status === "speculative");

  return (
    <section className="composition-panel" aria-label="Frame composition">
      <h2 className="rail-title">Composition</h2>
      <ol className="composition-list">
        {sorted.map((f, i) => {
          const count = anchorCount(f);
          const dense = count > DENSITY_BUDGET;
          const img = imageByFrame.get(f.frame_id);
          const segs = scriptByFrame.get(f.frame_id)?.segments.length ?? f.segment_ids.length;
          const isActive = f.frame_id === activeFrameId;
          return (
            <li
              key={f.frame_id}
              className={`composition-item${isActive ? " composition-item--active" : ""}`}
              data-status={f.status}
            >
              <div className="composition-head">
                <span className="composition-ord">{i + 1}</span>
                <span className="composition-title">{f.title || f.concept_id || f.frame_id}</span>
                <span className="composition-spacer" />
                <span className="composition-status">{f.status}</span>
              </div>
              <div className="composition-anchors">
                {anchorTypes(f).map((t, j) => (
                  <span key={`${t}-${j}`} className="composition-anchor">
                    {t}
                  </span>
                ))}
              </div>
              <div className="composition-meta">
                <span className={`composition-density${dense ? " composition-density--over" : ""}`}>
                  {count}/{DENSITY_BUDGET} anchors{dense ? " — over budget" : ""}
                </span>
                {segs > 0 ? <span className="composition-segs">{segs} narration</span> : null}
                {img ? (
                  <span className="composition-image">{img.helps ? "image ✓" : "no image"}</span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {liveSpeculative.length > 0 ? (
        <div className="composition-lookahead">
          <h3 className="composition-subtitle">Look-ahead (speculative)</h3>
          <ul className="composition-spec-list">
            {liveSpeculative.map((f) => (
              <li key={f.frame_id} className="composition-spec-item">
                <span className="composition-title">{f.title || f.concept_id}</span>
                {f.trigger_assumption ? (
                  <span className="composition-assumption">if: {f.trigger_assumption}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
