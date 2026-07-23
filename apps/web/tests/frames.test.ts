/**
 * Pure frame-projection helpers (UCS, ADR-0030). The SET of frames is canonical; WHICH is active is
 * a client projection. These helpers must be pure and Node-free (mirrors surface-stream.test.ts).
 */
import { describe, expect, test } from "vitest";
import type { CognitiveFrame, Mccr, MccrElement, SurfaceState } from "@inevitable/surface/client";
import {
  activeFrame,
  activeFrameIndex,
  elementForFocus,
  frameElements,
  frameRole,
  framesByOrdinal,
  hasFrames,
  isPracticeFrame,
  nextFrame,
} from "../src/frames";

function el(type: MccrElement["type"], order: number, text: string): MccrElement {
  return {
    element_id: `el-${type}`,
    type,
    slot: type,
    reveal_order: order,
    concept_id: "fourier",
    content: { kind: "text", text },
  };
}

function mccr(frameId: string): Mccr {
  const core = el("core_concept", 0, "Fourier transform");
  const def = el("definition", 1, "Decomposes a signal into frequencies.");
  return {
    frame_id: frameId,
    core_concept: core,
    definition: def,
    key_formula: null,
    diagram: null,
    relationship: null,
    mental_model: null,
    table: null,
    key_example: null,
    memory_cue: null,
    misconception: null,
    image: null,
    source_viewport: null,
    process: null,
    code: null,
    elements: [core, def],
  };
}

function frame(id: string, ordinal: number): CognitiveFrame {
  return {
    frame_id: id,
    surface_id: "srf-1",
    ordinal,
    status: "composed",
    kind: "teach",
    concept_id: "fourier",
    title: `Frame ${id}`,
    layout: null,
    mccr: mccr(id),
    segment_ids: [],
    speculative_of: null,
    invalidation_reason: null,
    trigger_assumption: null,
    provenance: {
      planner_packet_id: null,
      composer_packet_id: "cp-1",
      producer_cid: "agent.composer",
      source_event_id: "evt-1",
      world_state_nodes: [],
      trace_id: null,
      reason: "composed",
    },
    version: 1,
    hlc: "hlc-1",
  };
}

function stateWith(frames: CognitiveFrame[]): SurfaceState {
  return { frames } as unknown as SurfaceState;
}

describe("frame projection helpers", () => {
  test("framesByOrdinal sorts by ordinal", () => {
    const state = stateWith([frame("cfr-b", 2000), frame("cfr-a", 1000)]);
    expect(framesByOrdinal(state).map((f) => f.frame_id)).toEqual(["cfr-a", "cfr-b"]);
  });

  test("activeFrame resolves the choreographer's frame, else the last", () => {
    const state = stateWith([frame("cfr-a", 1000), frame("cfr-b", 2000)]);
    expect(activeFrame(state, "cfr-a")?.frame_id).toBe("cfr-a");
    expect(activeFrame(state, null)?.frame_id).toBe("cfr-b"); // last by ordinal
    expect(activeFrame(state, "cfr-missing")?.frame_id).toBe("cfr-b"); // fallback
    expect(activeFrame(stateWith([]), "cfr-a")).toBeNull();
  });

  test("elementForFocus resolves an element id within a frame", () => {
    const f = frame("cfr-a", 1000);
    expect(elementForFocus(f, "el-definition")?.type).toBe("definition");
    expect(elementForFocus(f, "el-nope")).toBeNull();
    expect(elementForFocus(null, "el-definition")).toBeNull();
  });

  test("activeFrameIndex + nextFrame drive the deck transition / N+1 buffer", () => {
    const state = stateWith([frame("cfr-a", 1000), frame("cfr-b", 2000), frame("cfr-c", 3000)]);
    // Active resolves by frame_id; N+1 is the next by ordinal.
    expect(activeFrameIndex(state, "cfr-a")).toBe(0);
    expect(nextFrame(state, "cfr-a")?.frame_id).toBe("cfr-b");
    expect(nextFrame(state, "cfr-b")?.frame_id).toBe("cfr-c");
    // No N+1 past the last frame.
    expect(nextFrame(state, "cfr-c")).toBeNull();
    // No active id ⇒ the last frame is active, nothing buffered after it.
    expect(activeFrameIndex(state, null)).toBe(2);
    expect(nextFrame(state, null)).toBeNull();
    // Empty surface.
    expect(activeFrameIndex(stateWith([]), null)).toBe(-1);
    expect(nextFrame(stateWith([]), null)).toBeNull();
  });

  test("frameElements + hasFrames", () => {
    expect(frameElements(frame("cfr-a", 1000))).toHaveLength(2);
    expect(frameElements(null)).toEqual([]);
    expect(hasFrames(stateWith([frame("cfr-a", 1000)]))).toBe(true);
    expect(hasFrames(stateWith([]))).toBe(false);
    expect(hasFrames(null)).toBe(false);
  });

  test("frameRole/isPracticeFrame trust the typed kind, not the title (ADR-0055 D6)", () => {
    // A practice frame whose title does NOT start with "Practice" is still classified by kind —
    // the exact case the retired title heuristic silently mislabeled.
    const practice = { ...frame("cfr-p", 1000), kind: "practice", title: "Make it your own" };
    expect(frameRole(practice as CognitiveFrame)).toBe("practice");
    expect(isPracticeFrame(practice as CognitiveFrame)).toBe(true);

    // Checkpoint + assessment collapse to the assessment role; teach stays teach.
    expect(frameRole({ ...frame("cfr-c", 1), kind: "checkpoint" } as CognitiveFrame)).toBe(
      "assessment",
    );
    expect(frameRole({ ...frame("cfr-a", 1), kind: "assessment" } as CognitiveFrame)).toBe(
      "assessment",
    );
    expect(isPracticeFrame(frame("cfr-t", 1))).toBe(false); // kind: "teach"

    // Pre-1.7.0 replay: no `kind` ⇒ fall back to the title heuristic.
    const legacy = { ...frame("cfr-l", 1), title: "Practice — perceptrons" } as unknown as Record<
      string,
      unknown
    >;
    delete legacy["kind"];
    expect(isPracticeFrame(legacy as unknown as CognitiveFrame)).toBe(true);
  });
});
