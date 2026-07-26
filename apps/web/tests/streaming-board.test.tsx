/**
 * StreamingBoard + FrameDeck streaming fallback (ADR-0063 Phase B): the board forms live from the
 * transient `streaming_frame_elements` buffer before a frame composes.
 */
import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SurfaceState } from "@inevitable/surface/client";
import { StreamingBoard } from "../src/components/StreamingBoard";
import { FrameDeck } from "../src/components/FrameDeck";

type StreamEl = SurfaceState["streaming_frame_elements"][number];

function el(name: string, text: string, seq: number): StreamEl {
  return { frame_id: "cfr-1", element_id: `el-${name}`, text, last_seq: seq };
}

describe("StreamingBoard (ADR-0063 Phase B)", () => {
  test("renders forming anchors in seq order with a live caret + humanized labels", () => {
    const html = renderToStaticMarkup(
      <StreamingBoard
        elements={[
          el("definition", "The study of vectors.", 1),
          el("core_concept", "Linear algebra", 0),
        ]}
      />,
    );
    // Ordered by last_seq: core_concept (0) appears before definition (1).
    expect(html.indexOf("Linear algebra")).toBeLessThan(html.indexOf("The study of vectors."));
    expect(html).toContain("core concept"); // el-core_concept → humanized label
    expect(html).toContain("mccr-forming-caret");
    expect(html).toContain("The board is forming"); // aria-label
  });

  test("renders nothing when the buffer is empty", () => {
    expect(renderToStaticMarkup(<StreamingBoard elements={[]} />)).toBe("");
  });
});

describe("FrameDeck streaming fallback (ADR-0063 Phase B)", () => {
  const baseState = {
    frames: [],
    scenes: [],
    prerequisite_descents: [],
    representations: [],
  };

  test("no active frame + a streaming buffer ⇒ the forming board (not the Composing pulse)", () => {
    const state = {
      ...baseState,
      streaming_frame_elements: [el("core_concept", "Entropy", 0)],
    } as unknown as SurfaceState;
    const html = renderToStaticMarkup(
      <FrameDeck state={state} activeFrameId={null} highlightElementId={null} thinking />,
    );
    expect(html).toContain("Entropy");
    expect(html).toContain("frame-stage--forming");
    expect(html).not.toContain("frame-empty-pulse"); // the bare "Composing…" pulse is replaced
  });

  test("no active frame + empty buffer ⇒ the Composing pulse (unchanged behavior)", () => {
    const state = {
      ...baseState,
      streaming_frame_elements: [],
    } as unknown as SurfaceState;
    const html = renderToStaticMarkup(
      <FrameDeck state={state} activeFrameId={null} highlightElementId={null} thinking />,
    );
    expect(html).toContain("frame-empty-pulse");
    expect(html).not.toContain("frame-stage--forming");
  });
});
