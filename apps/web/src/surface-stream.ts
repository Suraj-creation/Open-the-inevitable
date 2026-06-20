/**
 * Pure stream helpers — the browser's half of the replay-equivalence contract (SRF-005 §6.2).
 *
 * The viewport folds the streamed `surface.*` event log with the SAME `foldSurfaceEvents` the
 * runtime uses. These helpers are Node-free and framework-free so they can be unit-tested directly.
 * `StreamEvent` is derived from the fold's own signature, so the browser needs no protocol import.
 */
import { foldSurfaceEvents, type SurfaceState } from "@inevitable/surface/client";

/** The event shape the fold consumes, derived from its signature (no @inevitable/protocols import). */
export type StreamEvent = Parameters<typeof foldSurfaceEvents>[0] extends readonly (infer E)[]
  ? E
  : never;

/** Parse one SSE frame's `data:` line into an event, or null for comments/malformed frames. */
export function parseFrame(frame: string): StreamEvent | null {
  const dataLine = frame.split("\n").find((line) => line.startsWith("data:"));
  if (!dataLine) return null;
  try {
    return JSON.parse(dataLine.slice("data:".length).trim()) as StreamEvent;
  } catch {
    return null;
  }
}

/** Fold an accumulated event log into render-ready state — the viewport's single source. */
export function foldStream(events: readonly StreamEvent[]): SurfaceState | null {
  return foldSurfaceEvents(events);
}
