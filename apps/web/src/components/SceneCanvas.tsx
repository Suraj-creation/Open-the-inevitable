/**
 * SceneCanvas — the spatial block canvas: F16's second surface projection (S4.4).
 *
 * Blocks from SurfaceState are placed in a freeform SVG stage. Auto-layout arranges
 * them in a grid; dragging overrides position (client-only, non-canonical per D5).
 * Blocks sharing concept_ids are connected with dashed concept edges. The focused
 * block glows. Mouse-wheel zoom and background-drag pan the viewport.
 *
 * Spec: spec/implementation-roadmaps/cognitive-surface-maturity.md S4.4.
 */
import { useCallback, useRef, useState } from "react";
import type { CognitionBlock, SurfaceFocus } from "@inevitable/surface/client";

const BLOCK_W = 220;
const BLOCK_H = 72;
const GAP_X = 48;
const GAP_Y = 36;
const COLS = 3;
const PAD = 40;
const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;

function autoPos(index: number): { x: number; y: number } {
  return {
    x: PAD + (index % COLS) * (BLOCK_W + GAP_X),
    y: PAD + Math.floor(index / COLS) * (BLOCK_H + GAP_Y),
  };
}

/**
 * Block type to its CDL state hue.
 *
 * This was a table of twelve raw hexes (#6366f1, #8b5cf6, #0ea5e9, ...) with no relationship to the
 * CDL palette at all — a second, invented colour system living inside one component. That is exactly
 * how a coherent visual language becomes an arbitrary rainbow, and it meant the same kind of
 * thinking was one colour on the board and a different colour on this canvas. Each type now names
 * the cognitive state it actually is, and the hue comes from the one palette (CDL v1 §4).
 */
const TYPE_STATE: Record<string, string> = {
  explanation: "--state-learning",
  concept: "--state-learning",
  practice: "--state-practice",
  assessment: "--state-assessment",
  research: "--state-research",
  memory: "--state-reflection",
  motivation: "--state-mastery",
  routing: "--ink-faint",
  debate: "--state-confusion",
  simulation: "--state-practice",
  code: "--state-research",
  timeline: "--state-discovery",
};

function typeColor(blockType: string): string {
  return `var(${TYPE_STATE[blockType] ?? "--ink-faint"})`;
}

interface BlockDrag {
  blockId: string;
  startMouseX: number;
  startMouseY: number;
  origX: number;
  origY: number;
}

interface PanDrag {
  startX: number;
  startY: number;
  origX: number;
  origY: number;
}

export interface SceneCanvasProps {
  readonly blocks: readonly CognitionBlock[];
  readonly focus: SurfaceFocus | null;
  readonly focusedBlockId: string | null;
  readonly onSelect: (blockId: string) => void;
}

export function SceneCanvas({ blocks, focus: _focus, focusedBlockId, onSelect }: SceneCanvasProps) {
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const blockDragRef = useRef<BlockDrag | null>(null);
  const panDragRef = useRef<PanDrag | null>(null);
  // True once a block drag moves beyond a small threshold — used to suppress the trailing click so a
  // drag no longer selects the block (and closes the whole overlay). Fixes review issue 15.
  const blockMovedRef = useRef(false);

  const getPos = useCallback(
    (blockId: string, index: number) => positions[blockId] ?? autoPos(index),
    [positions],
  );

  const onBlockMouseDown = useCallback(
    (e: React.MouseEvent, blockId: string, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      const pos = getPos(blockId, index);
      blockMovedRef.current = false;
      blockDragRef.current = {
        blockId,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        origX: pos.x,
        origY: pos.y,
      };
    },
    [getPos],
  );

  const onSvgMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (blockDragRef.current) return;
      panDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: pan.x,
        origY: pan.y,
      };
    },
    [pan],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (blockDragRef.current) {
        const rawDx = e.clientX - blockDragRef.current.startMouseX;
        const rawDy = e.clientY - blockDragRef.current.startMouseY;
        if (Math.abs(rawDx) > 3 || Math.abs(rawDy) > 3) blockMovedRef.current = true;
        const dx = rawDx / scale;
        const dy = rawDy / scale;
        const { blockId, origX, origY } = blockDragRef.current;
        setPositions((prev) => ({ ...prev, [blockId]: { x: origX + dx, y: origY + dy } }));
        return;
      }
      if (panDragRef.current) {
        setPan({
          x: panDragRef.current.origX + (e.clientX - panDragRef.current.startX),
          y: panDragRef.current.origY + (e.clientY - panDragRef.current.startY),
        });
      }
    },
    [scale],
  );

  const onMouseUp = useCallback(() => {
    blockDragRef.current = null;
    panDragRef.current = null;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s * (1 - e.deltaY * 0.001))));
  }, []);

  const edges: { fromIdx: number; toIdx: number }[] = [];
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const shared = blocks[i]!.concept_ids.some((id) => blocks[j]!.concept_ids.includes(id));
      if (shared) edges.push({ fromIdx: i, toIdx: j });
    }
  }

  const rowCount = Math.ceil(Math.max(blocks.length, 1) / COLS);
  const canvasW = PAD * 2 + COLS * (BLOCK_W + GAP_X) - GAP_X;
  const canvasH = PAD * 2 + rowCount * (BLOCK_H + GAP_Y) - GAP_Y;

  return (
    <aside className="rail rail-timeline" aria-label="Scene canvas">
      <div className="graph-head">
        <h2 className="rail-title">Scene</h2>
        <span className="scene-hint">drag · scroll to zoom</span>
      </div>
      <div className="graph-scroll scene-scroll">
        <svg
          className="scene-svg"
          viewBox={`0 0 ${canvasW} ${canvasH}`}
          onMouseDown={onSvgMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
          style={{ cursor: panDragRef.current ? "grabbing" : "default" }}
        >
          <defs>
            <filter id="scene-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="4"
                floodColor="var(--stage-tint, var(--state-learning))"
                floodOpacity="0.65"
              />
            </filter>
          </defs>

          <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>
            <g className="scene-edges" aria-hidden>
              {edges.map((edge, ei) => {
                const fb = blocks[edge.fromIdx]!;
                const tb = blocks[edge.toIdx]!;
                const fp = getPos(fb.block_id, edge.fromIdx);
                const tp = getPos(tb.block_id, edge.toIdx);
                return (
                  <line
                    key={ei}
                    className="scene-edge"
                    x1={fp.x + BLOCK_W / 2}
                    y1={fp.y + BLOCK_H / 2}
                    x2={tp.x + BLOCK_W / 2}
                    y2={tp.y + BLOCK_H / 2}
                  />
                );
              })}
            </g>

            <g className="scene-blocks">
              {blocks.map((block, i) => {
                const pos = getPos(block.block_id, i);
                const isFocused = block.block_id === focusedBlockId;
                const color = typeColor(block.block_type);
                const title =
                  block.title.length > 26 ? block.title.slice(0, 25) + "…" : block.title;
                return (
                  <g
                    key={block.block_id}
                    className={`scene-block${isFocused ? " scene-block--focus" : ""}`}
                    transform={`translate(${pos.x},${pos.y})`}
                    onMouseDown={(e) => onBlockMouseDown(e, block.block_id, i)}
                    onClick={() => {
                      // A drag must not be read as a click (which would select + close the overlay).
                      if (blockMovedRef.current) {
                        blockMovedRef.current = false;
                        return;
                      }
                      onSelect(block.block_id);
                    }}
                    filter={isFocused ? "url(#scene-glow)" : undefined}
                    role="button"
                    aria-label={block.title}
                    style={{ cursor: "grab" }}
                  >
                    <rect
                      width={BLOCK_W}
                      height={BLOCK_H}
                      rx={8}
                      className="scene-block-rect"
                      stroke={isFocused ? color : "transparent"}
                      strokeWidth={2}
                    />
                    <rect x={0} y={0} width={6} height={BLOCK_H} rx={4} fill={color} />
                    <text x={14} y={20} className="scene-block-type">
                      {block.block_type}
                    </text>
                    <text x={14} y={40} className="scene-block-title">
                      {title}
                    </text>
                    {block.concept_ids[0] ? (
                      <text x={14} y={58} className="scene-block-concept">
                        {block.concept_ids[0]}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          </g>

          {blocks.length === 0 ? (
            <text
              x="50%"
              y="50%"
              dominantBaseline="middle"
              textAnchor="middle"
              className="scene-empty"
            >
              Blocks appear as cognition unfolds
            </text>
          ) : null}
        </svg>
      </div>
    </aside>
  );
}
