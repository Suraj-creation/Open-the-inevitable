/**
 * LivingTimeline — the learner's path as a living spine, not a checklist. The concept currently
 * in focus glows and connects to the stage ("you are here"); mastery flows up the spine. A
 * projection of state.timeline; the focused concept comes from the choreographer's current focus.
 */
import type { TimelineProjection } from "@inevitable/surface/client";

export interface LivingTimelineProps {
  readonly timeline: TimelineProjection | null;
  readonly focusConceptId: string | null;
}

export function LivingTimeline({ timeline, focusConceptId }: LivingTimelineProps) {
  return (
    <aside className="rail rail-timeline" aria-label="Living timeline">
      <h2 className="rail-title">Path</h2>
      {timeline ? (
        <ol className="spine">
          {timeline.nodes.map((node) => {
            const active = node.concept_id === focusConceptId;
            return (
              <li
                key={node.node_id}
                className={`spine-node status-${node.status} ${active ? "is-here" : ""}`}
              >
                <span className="spine-mark" aria-hidden />
                <span className="spine-body">
                  <span className="spine-title">{node.title}</span>
                  <span className="spine-status">
                    {node.status.replace("_", " ")}
                    {node.milestone ? " · milestone" : ""}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rail-empty">A path will form as the surface plans your curriculum.</p>
      )}
    </aside>
  );
}
