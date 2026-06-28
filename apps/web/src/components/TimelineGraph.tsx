/**
 * TimelineGraph — the concept timeline as a navigable cognitive graph, not a checklist (S1.4).
 *
 * A pure projection of `state.timeline`: nodes are laid out by depth layer (0–6, left→right),
 * typed edges are drawn distinctly (prerequisite spine solid; dependency/application/research/
 * bridge/frontier dashed). Nodes are clickable — a click jumps focus there; the ⤳ affordance
 * branches exploration. An entry-point selector highlights suggested starting nodes (a client
 * projection; mastery truth is unchanged). Layout/selection never enter the canonical record.
 */
import { useMemo, useState } from "react";
import type {
  SurfaceTimelineEdge,
  SurfaceTimelineNode,
  TimelineEntryPoint,
  TimelineProjection,
} from "@inevitable/surface/client";

export interface TimelineGraphProps {
  readonly timeline: TimelineProjection | null;
  readonly focusConceptId: string | null;
  readonly onJump: (conceptId: string) => void;
  readonly onBranch: (conceptId: string) => void;
}

const ENTRY_LAYER: Record<TimelineEntryPoint, number> = {
  beginner: 0,
  intermediate: 2,
  advanced: 4,
  research: 6,
};
const ENTRIES: readonly TimelineEntryPoint[] = ["beginner", "intermediate", "advanced", "research"];

const EDGE_DASH: Record<SurfaceTimelineEdge["edge_type"], string | undefined> = {
  prerequisite_of: undefined,
  depends_on: undefined,
  applies_to: "5 4",
  research_adjacent: "2 5",
  bridges_to: "7 5",
  frontier_of: "1 6",
};

const COL_W = 150;
const ROW_H = 64;
const PAD = 28;
const NODE_W = 116;
const NODE_H = 40;

interface Placed {
  readonly node: SurfaceTimelineNode;
  readonly x: number;
  readonly y: number;
}

function layout(timeline: TimelineProjection): {
  placed: readonly Placed[];
  byId: ReadonlyMap<string, Placed>;
  width: number;
  height: number;
} {
  // Column per layer; stack nodes within a layer in topological order.
  const byLayer = new Map<number, SurfaceTimelineNode[]>();
  for (const node of timeline.nodes) {
    const arr = byLayer.get(node.layer) ?? [];
    arr.push(node);
    byLayer.set(node.layer, arr);
  }
  const placed: Placed[] = [];
  const byId = new Map<string, Placed>();
  let maxRow = 0;
  for (const [lyr, nodes] of [...byLayer.entries()].sort((a, b) => a[0] - b[0])) {
    nodes.forEach((node, row) => {
      const p: Placed = { node, x: PAD + lyr * COL_W, y: PAD + row * ROW_H };
      placed.push(p);
      byId.set(node.concept_id, p);
      maxRow = Math.max(maxRow, row);
    });
  }
  const maxLayer = Math.max(0, ...timeline.nodes.map((n) => n.layer));
  return {
    placed,
    byId,
    width: PAD * 2 + maxLayer * COL_W + NODE_W,
    height: PAD * 2 + maxRow * ROW_H + NODE_H,
  };
}

export function TimelineGraph({ timeline, focusConceptId, onJump, onBranch }: TimelineGraphProps) {
  const [localEntry, setLocalEntry] = useState<TimelineEntryPoint>("beginner");
  const entry = timeline?.entry_point ?? localEntry;
  const geo = useMemo(() => (timeline ? layout(timeline) : null), [timeline]);

  return (
    <aside className="rail rail-timeline" aria-label="Concept graph">
      <div className="graph-head">
        <h2 className="rail-title">Path</h2>
        <div className="entry-picker" role="group" aria-label="Entry point">
          {ENTRIES.map((e) => (
            <button
              key={e}
              type="button"
              className={`entry-chip ${e === entry ? "is-active" : ""}`}
              onClick={() => setLocalEntry(e)}
              title={`Start from ${e}`}
            >
              {e[0]?.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {!timeline || !geo ? (
        <p className="rail-empty">A path will form as the surface plans your curriculum.</p>
      ) : (
        <div className="graph-scroll">
          <svg
            className="graph-svg"
            viewBox={`0 0 ${geo.width} ${geo.height}`}
            width={geo.width}
            height={geo.height}
            role="group"
            aria-label="Concept graph"
          >
            <g className="graph-edges">
              {timeline.edges.map((edge) => {
                const from = geo.byId.get(edge.from);
                const to = geo.byId.get(edge.to);
                if (!from || !to) return null;
                return (
                  <line
                    key={`${edge.edge_type}:${edge.from}:${edge.to}`}
                    className={`edge edge-${edge.edge_type}`}
                    x1={from.x + NODE_W}
                    y1={from.y + NODE_H / 2}
                    x2={to.x}
                    y2={to.y + NODE_H / 2}
                    strokeDasharray={EDGE_DASH[edge.edge_type]}
                  />
                );
              })}
            </g>
            <g className="graph-nodes">
              {geo.placed.map(({ node, x, y }) => {
                const active = node.concept_id === focusConceptId;
                const suggested = node.status === "available" && node.layer <= ENTRY_LAYER[entry];
                return (
                  <g
                    key={node.node_id}
                    className={`gnode status-${node.status} ${active ? "is-here" : ""} ${
                      suggested ? "is-suggested" : ""
                    }`}
                    transform={`translate(${x},${y})`}
                    onClick={() => onJump(node.concept_id)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${node.title} — ${node.status}`}
                  >
                    <rect className="gnode-box" width={NODE_W} height={NODE_H} rx={9} />
                    {node.confidence !== null && (
                      <rect
                        className="gnode-conf"
                        x={0}
                        y={NODE_H - 3}
                        width={NODE_W * Math.max(0, Math.min(1, node.confidence))}
                        height={3}
                      />
                    )}
                    <text className="gnode-title" x={9} y={17}>
                      {node.title}
                    </text>
                    <text className="gnode-status" x={9} y={31}>
                      {node.status.replace("_", " ")}
                      {node.milestone ? " · ✦" : ""}
                    </text>
                    <text
                      className="gnode-branch"
                      x={NODE_W - 12}
                      y={17}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onBranch(node.concept_id);
                      }}
                      aria-label={`Branch from ${node.title}`}
                    >
                      ⤳
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      )}
    </aside>
  );
}
