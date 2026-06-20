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

function AssessmentBody({ block }: { block: CognitionBlock }): ReactNode {
  const passed = block.content["passed"] === true;
  return (
    <p className="block-lede">
      <span className={`verdict ${passed ? "verdict-pass" : "verdict-open"}`}>
        {passed ? "Mastery recorded" : "Not yet mastered"}
      </span>{" "}
      · confidence {Math.round(block.confidence * 100)}%
    </p>
  );
}

function MediaSlot({ block }: { block: CognitionBlock }): ReactNode {
  const media = MEDIA[block.block_type];
  return (
    <div className="media-slot" aria-label={`${media?.label ?? block.block_type} slot`}>
      <span className="media-glyph">{media?.glyph ?? "○"}</span>
      <span className="media-label">{media?.label ?? block.block_type}</span>
      <span className="media-state">awaiting generation</span>
    </div>
  );
}

const RENDERERS: Partial<Record<CognitionBlockType, BlockRenderer>> = {
  routing: (b) => <RoutingBody block={b} />,
  assessment: (b) => <AssessmentBody block={b} />,
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
