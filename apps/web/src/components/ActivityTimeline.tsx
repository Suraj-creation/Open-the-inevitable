/**
 * ActivityTimeline — the cognitive pipeline made legible (F09 §4.1). The workflow chips
 * (route → explain → map → practice → assess → illustrate …) evolve from static facets into a compact,
 * ordered, clickable activity strip: each step carries its agent's sigil and a verb, the active step is
 * emphasized, and clicking a step brings that cognition to the stage. A pure projection of the surface's
 * recent blocks.
 */
import type { CognitionBlock } from "@inevitable/surface/client";
import { identityFor } from "../agents";

export interface ActivityTimelineProps {
  /** Recent blocks in chronological order (oldest → newest). */
  readonly blocks: readonly CognitionBlock[];
  readonly activeId: string | null;
  readonly onSelect: (blockId: string) => void;
}

const STAGE_LABEL: Record<string, string> = {
  routing: "Route",
  explanation: "Explain",
  concept: "Map",
  practice: "Practice",
  assessment: "Assess",
  image: "Illustrate",
  video: "Animate",
  simulation: "Simulate",
  voice: "Narrate",
  research: "Research",
  motivation: "Encourage",
  memory: "Recall",
  debate: "Debate",
};

export function ActivityTimeline({ blocks, activeId, onSelect }: ActivityTimelineProps) {
  if (blocks.length === 0) return null;
  return (
    <nav className="activity-timeline" aria-label="Cognitive pipeline">
      {blocks.map((b, i) => {
        const id = identityFor(b.provenance.agent_id ?? b.provenance.producer_cid);
        const label = STAGE_LABEL[b.block_type] ?? b.block_type;
        return (
          <span key={b.block_id} className="activity-seg">
            {i > 0 ? (
              <span className="activity-arrow" aria-hidden>
                →
              </span>
            ) : null}
            <button
              type="button"
              className={`activity-step ${b.block_id === activeId ? "is-active" : ""}`}
              style={{ ["--agent-accent" as string]: id.accent }}
              onClick={() => onSelect(b.block_id)}
              aria-current={b.block_id === activeId}
              title={`${id.label} — ${label}`}
            >
              <span className="activity-sigil" style={{ color: id.accent }}>
                {id.sigil}
              </span>
              <span className="activity-label">{label}</span>
            </button>
          </span>
        );
      })}
    </nav>
  );
}
