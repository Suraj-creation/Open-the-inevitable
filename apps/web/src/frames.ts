/**
 * Pure, Node-free frame projection helpers for the viewport (UCS, ADR-0030).
 *
 * The SET of frames + their MCCR is canonical (folded into SurfaceState). WHICH frame is on screen
 * is a client projection over the choreographer cursor — these helpers only read folded state and
 * derive render-ready views. They never mutate canonical state (mirrors surface-stream.ts).
 */
import type { CognitiveFrame, MccrElement, SurfaceState } from "@inevitable/surface/client";

/** Canonical frames in render order (by ordinal, then fold order). Speculative frames are excluded. */
export function framesByOrdinal(state: SurfaceState | null): readonly CognitiveFrame[] {
  if (!state) return [];
  return [...state.frames].sort((a, b) => a.ordinal - b.ordinal);
}

/**
 * The frame to show: the one the choreographer is voicing (`activeFrameId`), else the last composed
 * frame, else null. Always resolves against the canonical `frames` slice.
 */
export function activeFrame(
  state: SurfaceState | null,
  activeFrameId: string | null,
): CognitiveFrame | null {
  const frames = framesByOrdinal(state);
  if (frames.length === 0) return null;
  if (activeFrameId) {
    const match = frames.find((f) => f.frame_id === activeFrameId);
    if (match) return match;
  }
  return frames[frames.length - 1] ?? null;
}

/**
 * The index of the active frame within the ordinal-sorted list: the one the choreographer is voicing,
 * else the last composed frame, else -1. The basis for cross-dissolve + N+1 buffering (UCS, ADR-0030).
 */
export function activeFrameIndex(state: SurfaceState | null, activeFrameId: string | null): number {
  const frames = framesByOrdinal(state);
  if (frames.length === 0) return -1;
  if (activeFrameId) {
    const i = frames.findIndex((f) => f.frame_id === activeFrameId);
    if (i >= 0) return i;
  }
  return frames.length - 1;
}

/**
 * The frame buffered next (N+1) after the active one — prepared off-stage so its image pre-warms and
 * its transition is instant. Null when the active frame is the last. Pure projection of folded state.
 */
export function nextFrame(
  state: SurfaceState | null,
  activeFrameId: string | null,
): CognitiveFrame | null {
  const frames = framesByOrdinal(state);
  const idx = activeFrameIndex(state, activeFrameId);
  if (idx < 0) return null;
  return frames[idx + 1] ?? null;
}

/** Resolve a focus target_id to the MCCR element it spotlights within a frame, or null. */
export function elementForFocus(
  frame: CognitiveFrame | null,
  elementId: string | null,
): MccrElement | null {
  if (!frame || !elementId || !frame.mccr) return null;
  return frame.mccr.elements.find((e) => e.element_id === elementId) ?? null;
}

/** The flat, reveal-ordered MCCR elements of a frame (empty when not yet composed). */
export function frameElements(frame: CognitiveFrame | null): readonly MccrElement[] {
  return frame?.mccr?.elements ?? [];
}

/** Whether the surface is rendering the UCS frame path (vs the legacy block path). */
export function hasFrames(state: SurfaceState | null): boolean {
  return (state?.frames.length ?? 0) > 0;
}
