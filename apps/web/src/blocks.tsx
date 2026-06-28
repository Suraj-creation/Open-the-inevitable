/**
 * Block-renderer registry — the seam that keeps the surface provider-agnostic forever (ADR-0006).
 *
 * Renderers key on `block_type`, NEVER on the producing model/provider. The browser cannot tell
 * Gemini from a research agent from memory; everything is a typed Cognition Block. Adding a modality
 * is a registry entry, not a rewrite; an unregistered type falls back to prose (forward-compatible,
 * mirroring the fold). Layout/composition is a projection concern (SRF-001 §2).
 */
import type { ReactNode } from "react";
import type { CognitionBlock, CognitionBlockType } from "@inevitable/surface/client";

type BlockRenderer = (block: CognitionBlock) => ReactNode;

const MEDIA: Partial<Record<CognitionBlockType, { glyph: string; label: string }>> = {
  image: { glyph: "▦", label: "Image" },
  video: { glyph: "▷", label: "Motion" },
  voice: { glyph: "𝄞", label: "Voice" },
  simulation: { glyph: "◍", label: "Simulation" },
};

const LAYER_LABEL: Record<string, string> = {
  layer_0: "Intuition",
  layer_1: "Visual model",
  layer_2: "Formal",
  layer_3: "Depth",
};

/** The lead text of a block, for chips and peripheral context. */
export function blockLede(block: CognitionBlock): string {
  const summary = block.content["summary"];
  if (typeof summary === "string" && summary.trim()) return summary.trim();
  const text = block.content["text"];
  if (typeof text === "string" && text.trim()) return text.trim();
  const reason = block.content["reason"];
  if (typeof reason === "string" && reason.trim()) return reason.trim();
  return block.title;
}

function ProseBody({ block }: { block: CognitionBlock }): ReactNode {
  const summary =
    typeof block.content["summary"] === "string" ? (block.content["summary"] as string) : null;
  const layers = block.content["layers"] as Record<string, unknown> | undefined;
  const text = typeof block.content["text"] === "string" ? (block.content["text"] as string) : null;
  if (!summary && !layers && !text) {
    return <p className="block-meta-note">processed · awaiting generated content</p>;
  }
  return (
    <>
      {summary ? <p className="block-lede">{summary}</p> : null}
      {text && !summary ? <p className="block-lede">{text}</p> : null}
      {layers ? (
        <div className="layers">
          {Object.keys(layers)
            .sort()
            .map((key) =>
              typeof layers[key] === "string" ? (
                <div key={key} className="layer">
                  <span className="layer-tag">{LAYER_LABEL[key] ?? key}</span>
                  <p className="layer-text">{layers[key] as string}</p>
                </div>
              ) : null,
            )}
        </div>
      ) : null}
    </>
  );
}

function RoutingBody({ block }: { block: CognitionBlock }): ReactNode {
  const target = block.content["target_agent"];
  const reason = block.content["reason"];
  return (
    <p className="block-lede">
      Routed to <strong>{typeof target === "string" ? target : "—"}</strong>
      {typeof reason === "string" ? ` — ${reason}` : null}
    </p>
  );
}

const DEPTH_LABEL: Record<string, string> = {
  explanation: "Explain",
  application: "Apply",
  connection: "Connect",
  teaching: "Teach",
  edge_case: "Edge case",
};

function AssessmentBody({ block }: { block: CognitionBlock }): ReactNode {
  const passed = block.content["passed"] === true;
  const depthGate = block.content["depth_gate"] as
    | { passed: boolean; passed_count: number; total_count: number; tests: unknown[] }
    | undefined;

  return (
    <>
      <p className="block-lede">
        <span className={`verdict ${passed ? "verdict-pass" : "verdict-open"}`}>
          {passed ? "Mastery recorded" : "Not yet mastered"}
        </span>{" "}
        · confidence {Math.round(block.confidence * 100)}%
      </p>
      {depthGate && (
        <div className="depth-gate">
          <span className="depth-gate-score">
            {depthGate.passed_count}/{depthGate.total_count} depth tests passed
          </span>
          <ol className="depth-tests">
            {depthGate.tests.map((t) => {
              const tr = t as { kind: string; passed: boolean; confidence: number };
              return (
                <li
                  key={tr.kind}
                  className={`depth-test depth-test--${tr.passed ? "pass" : "fail"}`}
                >
                  <span className="depth-test-glyph">{tr.passed ? "✓" : "✗"}</span>
                  <span className="depth-test-label">{DEPTH_LABEL[tr.kind] ?? tr.kind}</span>
                  <span className="depth-test-conf">{Math.round(tr.confidence * 100)}%</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </>
  );
}

function MediaSlot({ block }: { block: CognitionBlock }): ReactNode {
  const meta = MEDIA[block.block_type];
  const artifact = block.content["artifact"] as
    | { content_ref?: string; mime_type?: string }
    | undefined;
  const alt = typeof block.content["alt"] === "string" ? block.content["alt"] : block.title;
  if (artifact?.content_ref) {
    return (
      <div className="media-slot media-slot--loaded" aria-label={alt}>
        <img src={artifact.content_ref} alt={alt} className="media-img" loading="lazy" />
      </div>
    );
  }
  return (
    <div className="media-slot" aria-label={`${meta?.label ?? block.block_type} slot`}>
      <span className="media-glyph">{meta?.glyph ?? "○"}</span>
      <span className="media-label">{meta?.label ?? block.block_type}</span>
      <span className="media-state">awaiting generation</span>
    </div>
  );
}

interface MapNode {
  readonly id: string;
  readonly title: string;
  readonly layer: number;
  readonly status: string;
}
interface MapEdge {
  readonly from: string;
  readonly to: string;
  readonly type: string;
}

/**
 * ConceptMapBody — a structured visual (SRF-006 §4): cognition you can *see*. A deterministic,
 * client-rendered SVG mini-map of the focus concept and its neighbourhood (depth-layered, typed
 * edges, focus highlighted). No provider, no media event — pure projection of the block's data.
 */
function ConceptMapBody({ block }: { block: CognitionBlock }): ReactNode {
  const map = block.content["map"] as
    | { focus?: string; nodes?: MapNode[]; edges?: MapEdge[] }
    | undefined;
  if (!map?.nodes?.length) return <ProseBody block={block} />;

  const COLW = 134;
  const ROWH = 50;
  const PAD = 16;
  const NW = 108;
  const NH = 34;
  const byLayer = new Map<number, MapNode[]>();
  for (const n of map.nodes) {
    const arr = byLayer.get(n.layer) ?? [];
    arr.push(n);
    byLayer.set(n.layer, arr);
  }
  const pos = new Map<string, { x: number; y: number }>();
  let maxRow = 0;
  let maxLayer = 0;
  for (const [lyr, ns] of [...byLayer.entries()].sort((a, b) => a[0] - b[0])) {
    ns.forEach((n, row) => {
      pos.set(n.id, { x: PAD + lyr * COLW, y: PAD + row * ROWH });
      maxRow = Math.max(maxRow, row);
      maxLayer = Math.max(maxLayer, lyr);
    });
  }
  const width = PAD * 2 + maxLayer * COLW + NW;
  const height = PAD * 2 + maxRow * ROWH + NH;

  return (
    <div className="conceptmap">
      <svg
        className="conceptmap-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label="Concept map"
      >
        <g>
          {(map.edges ?? []).map((e) => {
            const f = pos.get(e.from);
            const t = pos.get(e.to);
            if (!f || !t) return null;
            return (
              <line
                key={`${e.type}:${e.from}:${e.to}`}
                className={`cm-edge cm-${e.type}`}
                x1={f.x + NW}
                y1={f.y + NH / 2}
                x2={t.x}
                y2={t.y + NH / 2}
              />
            );
          })}
        </g>
        <g>
          {map.nodes.map((n) => {
            const p = pos.get(n.id);
            if (!p) return null;
            return (
              <g
                key={n.id}
                className={`cm-node status-${n.status} ${n.id === map.focus ? "is-focus" : ""}`}
                transform={`translate(${p.x},${p.y})`}
              >
                <rect width={NW} height={NH} rx={8} />
                <text className="cm-title" x={8} y={20}>
                  {n.title}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

function ResearchBody({ block }: { block: CognitionBlock }): ReactNode {
  const frontier = typeof block.content["frontier"] === "string" ? block.content["frontier"] : null;
  const gap = typeof block.content["gap"] === "string" ? block.content["gap"] : null;
  const hypothesis =
    typeof block.content["hypothesis_seed"] === "string" ? block.content["hypothesis_seed"] : null;
  const sourceNote =
    typeof block.content["source_note"] === "string" ? block.content["source_note"] : null;
  return (
    <div className="research-body">
      {frontier && (
        <div className="research-row">
          <span className="research-tag">Frontier</span>
          <p className="research-text">{frontier}</p>
        </div>
      )}
      {gap && (
        <div className="research-row">
          <span className="research-tag">Open gap</span>
          <p className="research-text">{gap}</p>
        </div>
      )}
      {hypothesis && (
        <div className="research-row">
          <span className="research-tag">Hypothesis</span>
          <p className="research-text research-hypothesis">{hypothesis}</p>
        </div>
      )}
      {sourceNote && <p className="research-source">{sourceNote}</p>}
    </div>
  );
}

function MotivationBody({ block }: { block: CognitionBlock }): ReactNode {
  const message =
    typeof block.content["message"] === "string" ? block.content["message"] : block.title;
  const confidence =
    typeof block.content["confidence"] === "number" ? block.content["confidence"] : null;
  return (
    <div className="motivation-body">
      <p className="motivation-message">{message}</p>
      {confidence !== null && (
        <p className="motivation-conf">
          Confidence: <strong>{Math.round(confidence * 100)}%</strong>
        </p>
      )}
    </div>
  );
}

const RENDERERS: Partial<Record<CognitionBlockType, BlockRenderer>> = {
  routing: (b) => <RoutingBody block={b} />,
  assessment: (b) => <AssessmentBody block={b} />,
  concept: (b) => <ConceptMapBody block={b} />,
  research: (b) => <ResearchBody block={b} />,
  motivation: (b) => <MotivationBody block={b} />,
  image: (b) => <MediaSlot block={b} />,
  video: (b) => <MediaSlot block={b} />,
  voice: (b) => <MediaSlot block={b} />,
  simulation: (b) => <MediaSlot block={b} />,
};

/** Render one block's body via the registry, defaulting to prose. */
export function renderBlockBody(block: CognitionBlock): ReactNode {
  const renderer = RENDERERS[block.block_type] ?? ((b: CognitionBlock) => <ProseBody block={b} />);
  return renderer(block);
}
