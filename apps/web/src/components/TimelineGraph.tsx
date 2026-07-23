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

const PAD = 44;
const NODE_W = 158;
const NODE_H = 42;

/** SVG text does not wrap or clip: truncate deterministically so labels can NEVER collide
    (audit B2); the full title lives in the node's <title> tooltip + aria-label. */
function fitLabel(text: string, max = 22): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

interface Placed {
  readonly node: SurfaceTimelineNode;
  /** Node CENTER (constellation layout). */
  readonly x: number;
  readonly y: number;
}

/**
 * A deterministic force-directed constellation (CDL: the path is a star map of understanding, not
 * a checklist). Fully pure + replay-safe: initial positions are seeded by index + layer (never
 * Math.random), the simulation runs a fixed iteration budget, so the same timeline always yields
 * the same map. Repulsion keeps node boxes from overlapping (labels can't collide), edges pull
 * related concepts together, a gentle layer bias keeps prerequisites flowing left→right, and a
 * weak center gravity keeps the constellation compact.
 */
function layout(timeline: TimelineProjection): {
  placed: readonly Placed[];
  byId: ReadonlyMap<string, Placed>;
  width: number;
  height: number;
} {
  const nodes = timeline.nodes;
  const n = nodes.length;
  const idx = new Map(nodes.map((node, i) => [node.concept_id, i] as const));
  const maxLayer = Math.max(1, ...nodes.map((nd) => nd.layer));

  // Seed: phyllotaxis spread (even, deterministic) nudged so higher layers start rightward.
  const GOLDEN = 2.399963229728653; // golden angle (radians)
  const xs = new Array<number>(n);
  const ys = new Array<number>(n);
  const SPREAD = 150;
  for (let i = 0; i < n; i++) {
    const r = SPREAD * Math.sqrt(i + 0.5);
    const a = i * GOLDEN;
    xs[i] = Math.cos(a) * r + (nodes[i]!.layer / maxLayer - 0.5) * 320;
    ys[i] = Math.sin(a) * r;
  }

  // Force simulation — fixed budget, cooling alpha. O(iters · n²); n is small (a curriculum).
  const IDEAL = 210; // ideal edge length
  const REPULSION = 46000;
  const ITERS = 320;
  const edges = timeline.edges
    .map((e) => [idx.get(e.from), idx.get(e.to)] as const)
    .filter((p): p is readonly [number, number] => p[0] !== undefined && p[1] !== undefined);

  for (let it = 0; it < ITERS; it++) {
    const alpha = 1 - it / ITERS;
    const fx = new Array<number>(n).fill(0);
    const fy = new Array<number>(n).fill(0);
    // Pairwise repulsion.
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = xs[i]! - xs[j]!;
        let dy = ys[i]! - ys[j]!;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          // Deterministic jitter for coincident seeds (no randomness).
          dx = (i - j) * 0.5 + 0.3;
          dy = (i + j) * 0.3 - 0.2;
          d2 = dx * dx + dy * dy;
        }
        const f = REPULSION / d2;
        const d = Math.sqrt(d2);
        const ux = dx / d;
        const uy = dy / d;
        fx[i]! += ux * f;
        fy[i]! += uy * f;
        fx[j]! -= ux * f;
        fy[j]! -= uy * f;
      }
    }
    // Edge attraction (springs toward the ideal length).
    for (const [a, b] of edges) {
      const dx = xs[b]! - xs[a]!;
      const dy = ys[b]! - ys[a]!;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - IDEAL) * 0.12;
      const ux = dx / d;
      const uy = dy / d;
      fx[a]! += ux * f;
      fy[a]! += uy * f;
      fx[b]! -= ux * f;
      fy[b]! -= uy * f;
    }
    for (let i = 0; i < n; i++) {
      // Gentle layer bias (x) + center gravity keep the map readable and compact.
      const targetX = (nodes[i]!.layer / maxLayer - 0.5) * 620;
      fx[i]! += (targetX - xs[i]!) * 0.02;
      fx[i]! += -xs[i]! * 0.006;
      fy[i]! += -ys[i]! * 0.01;
      const step = Math.min(30, 0.9 * alpha + 0.1);
      xs[i]! += Math.max(-40, Math.min(40, fx[i]! * step));
      ys[i]! += Math.max(-40, Math.min(40, fy[i]! * step));
    }
  }

  // Hard overlap resolution — guarantee node BOXES never touch (labels can't collide, ever).
  // Deterministic relaxation: separate any pair closer than the box footprint + a gutter.
  const MIN_DX = NODE_W + 24;
  const MIN_DY = NODE_H + 20;
  for (let pass = 0; pass < 24; pass++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = xs[j]! - xs[i]!;
        const dy = ys[j]! - ys[i]!;
        const overlapX = MIN_DX - Math.abs(dx);
        const overlapY = MIN_DY - Math.abs(dy);
        if (overlapX > 0 && overlapY > 0) {
          moved = true;
          // Push apart along the cheaper axis to separate the boxes.
          if (overlapX / MIN_DX < overlapY / MIN_DY) {
            const push = (overlapX / 2 + 0.5) * (dx >= 0 ? 1 : -1);
            xs[i]! -= push;
            xs[j]! += push;
          } else {
            const push = (overlapY / 2 + 0.5) * (dy >= 0 ? 1 : -1);
            ys[i]! -= push;
            ys[j]! += push;
          }
        }
      }
    }
    if (!moved) break;
  }

  // Normalize into a padded viewBox (account for node box extent).
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, xs[i]!);
    maxX = Math.max(maxX, xs[i]!);
    minY = Math.min(minY, ys[i]!);
    maxY = Math.max(maxY, ys[i]!);
  }
  if (!Number.isFinite(minX)) {
    minX = maxX = minY = maxY = 0;
  }
  const offX = PAD + NODE_W / 2 - minX;
  const offY = PAD + NODE_H / 2 - minY;
  const placed: Placed[] = [];
  const byId = new Map<string, Placed>();
  for (let i = 0; i < n; i++) {
    const p: Placed = { node: nodes[i]!, x: xs[i]! + offX, y: ys[i]! + offY };
    placed.push(p);
    byId.set(nodes[i]!.concept_id, p);
  }
  return {
    placed,
    byId,
    width: maxX - minX + NODE_W + PAD * 2,
    height: maxY - minY + NODE_H + PAD * 2,
  };
}

export function TimelineGraph({ timeline, focusConceptId, onJump, onBranch }: TimelineGraphProps) {
  // The learner's local pick (null until they choose) overrides the timeline's default entry point,
  // so the chips are live — they were previously inert because the timeline value always won (issue 15).
  const [localEntry, setLocalEntry] = useState<TimelineEntryPoint | null>(null);
  const entry = localEntry ?? timeline?.entry_point ?? "beginner";
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
                // Constellation edges connect node CENTERS with a gentle bow (a curved filament),
                // drawn behind the nodes.
                const mx = (from.x + to.x) / 2;
                const my = (from.y + to.y) / 2;
                const dx = to.x - from.x;
                const dy = to.y - from.y;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                const bow = Math.min(28, len * 0.12);
                const cx = mx + (-dy / len) * bow;
                const cy = my + (dx / len) * bow;
                return (
                  <path
                    key={`${edge.edge_type}:${edge.from}:${edge.to}`}
                    className={`edge edge-${edge.edge_type}`}
                    d={`M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`}
                    strokeDasharray={EDGE_DASH[edge.edge_type]}
                  />
                );
              })}
            </g>
            <g className="graph-nodes">
              {geo.placed.map(({ node, x, y }) => {
                const active = node.concept_id === focusConceptId;
                const suggested = node.status === "available" && node.layer <= ENTRY_LAYER[entry];
                // Node box is centered on (x, y).
                const bx = x - NODE_W / 2;
                const by = y - NODE_H / 2;
                return (
                  <g
                    key={node.node_id}
                    className={`gnode status-${node.status} ${active ? "is-here" : ""} ${
                      suggested ? "is-suggested" : ""
                    }`}
                    transform={`translate(${bx},${by})`}
                    onClick={() => onJump(node.concept_id)}
                    onKeyDown={(ev) => {
                      // Keyboard-activatable (a11y §17b): Enter/Space teach this concept.
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        onJump(node.concept_id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${node.title} — ${node.status}. Press Enter to learn this concept.`}
                  >
                    <title>{node.title}</title>
                    <rect className="gnode-box" width={NODE_W} height={NODE_H} rx={12} />
                    {node.confidence !== null && (
                      <rect
                        className="gnode-conf"
                        x={0}
                        y={NODE_H - 3}
                        width={NODE_W * Math.max(0, Math.min(1, node.confidence))}
                        height={3}
                      />
                    )}
                    <text className="gnode-title" x={11} y={18}>
                      {fitLabel(node.title)}
                    </text>
                    <text className="gnode-status" x={11} y={32}>
                      {node.status.replace("_", " ")}
                      {node.milestone ? " · ✦" : ""}
                    </text>
                    <text
                      className="gnode-branch"
                      x={NODE_W - 14}
                      y={18}
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
