/**
 * useChoreographer — the client's playback projection over the folded SurfaceState.
 *
 * Analogous to OpenMAIC's PlaybackEngine, but it reads OUR events: it maintains a cursor over
 * `state.narration` and paces through segments. All audio lifecycle lives in NarrationPlayer
 * (exactly-once per segment; epoch-guarded async edges) — this hook only decides WHICH segment
 * should be playing and WHEN to advance. It owns NO truth: the cursor is client-only UI state and
 * never re-enters the canonical record (SRF-001 §4.5/§4.6, ADR-0007).
 *
 * Structural law learned from the "narration repeats" bug class: the playback effect depends on
 * the current segment's IDENTITY (segment_id + voice ref + mode), never on the folded segments
 * array — a new SSE event must never be able to restart audio. New segments streaming in advance a
 * held cursor through the arrival effect instead.
 *
 * In "live" mode it auto-advances as new segments stream in (cognition unfolding now); the learner
 * can pause and scrub (replay) at any time.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NarrationSegment, SurfaceFocus, SurfaceState } from "@inevitable/surface/client";
import { NarrationPlayer, createProgressStore, type ProgressStore } from "./narration-player";

export type PlaybackMode = "idle" | "playing" | "paused";

export interface ChoreographyView {
  readonly segments: readonly NarrationSegment[];
  readonly cursor: number;
  readonly current: NarrationSegment | null;
  readonly focus: SurfaceFocus | null;
  readonly speakingBlockId: string | null;
  /** The Cognitive Frame the current narration segment voices (UCS, ADR-0030) — client projection. */
  readonly activeFrameId: string | null;
  /** The MCCR element the current segment spotlights (UCS, ADR-0030) — drives the moving highlight. */
  readonly highlightElementId: string | null;
  /** Active-frame elements the narration has revealed so far (staged reveal, UCS, ADR-0030). */
  readonly revealedElementIds: ReadonlySet<string>;
  /** Active-frame elements any of its narration segments reference (orphans reveal immediately). */
  readonly frameAnchoredElementIds: ReadonlySet<string>;
  readonly mode: PlaybackMode;
  readonly isPlaying: boolean;
  readonly atEnd: boolean;
  /** Playback progress within the current segment, 0..1, as an external store — subscribed at the
   *  caption leaf so the progress clock never re-renders the surface tree (client projection). */
  readonly progressStore: ProgressStore;
  readonly speed: number;
  readonly play: () => void;
  readonly pause: () => void;
  readonly toggle: () => void;
  readonly next: () => void;
  readonly prev: () => void;
  readonly scrubTo: (index: number) => void;
  readonly setSpeed: (speed: number) => void;
}

/** The teaching hold after a segment composed with `pause_after` (the teacher's pause). */
const PAUSE_AFTER_MS = 1400;

/** The Director's pacing for the current beat (CSE-011 §3.2), as folded onto the latest directive. */
export interface DirectivePacingView {
  readonly tempo: "slow" | "measured" | "brisk";
  readonly dwell_hint_ms: number;
  readonly silence: boolean;
}

/**
 * R3b (ADR-0057): the teaching hold between segments, PACED BY THE DIRECTOR (CSE-011). The base
 * teacher's-pause is scaled by tempo (slow dwells longer, brisk moves on); `silence: true` makes the
 * surface fall deliberately still even on a segment not marked `pause_after` — "silence is a
 * first-class output" (CSE-011 §9). With no directive the hold is the legacy constant (unchanged).
 * Pure + deterministic — the unit seam for the pacing behavior.
 */
export function pacingHoldMs(pacing: DirectivePacingView | null, pauseAfter: boolean): number {
  if (!pacing) return pauseAfter ? PAUSE_AFTER_MS : 0;
  const factor = pacing.tempo === "slow" ? 1.5 : pacing.tempo === "brisk" ? 0.7 : 1;
  if (pauseAfter) return Math.round(PAUSE_AFTER_MS * factor);
  // Deliberate stillness on an unmarked segment when the Director calls for silence (consolidating).
  if (pacing.silence) return Math.round(PAUSE_AFTER_MS * 0.6 * factor);
  return 0;
}

/** Reading-time estimate for a text segment (ms), clamped — used when a segment has no audio. */
function estimateMs(text: string): number {
  return Math.min(9000, Math.max(1600, text.length * 42));
}

function durationMs(segment: NarrationSegment | null): number {
  if (!segment) return 0;
  return segment.voice?.duration_ms && segment.voice.duration_ms > 0
    ? segment.voice.duration_ms
    : estimateMs(segment.text);
}

export function useChoreographer(state: SurfaceState | null): ChoreographyView {
  const segments = useMemo(() => state?.narration ?? [], [state]);
  const [cursor, setCursor] = useState(0);
  const [mode, setMode] = useState<PlaybackMode>("idle");
  const [speed, setSpeed] = useState(1);

  const progressStore = useMemo(() => createProgressStore(), []);
  const playerRef = useRef<NarrationPlayer | null>(null);

  // Latest-value refs so completion callbacks never close over stale segment/cursor state.
  const totalRef = useRef(0);
  totalRef.current = segments.length;
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  const current = segments[cursor] ?? null;
  const segKey = current?.segment_id ?? null;
  const voiceRef = current?.voice?.content_ref ?? null;
  const pauseAfterRef = useRef(false);
  pauseAfterRef.current = current?.pause_after ?? false;
  // R3b (ADR-0057): the Director's current pacing drives the inter-segment hold — kept in a ref so
  // the completion callback reads the live value without re-subscribing (CSE-011 §3.2).
  const pacingRef = useRef<DirectivePacingView | null>(null);
  pacingRef.current = (state?.latest_directive?.pacing as DirectivePacingView | undefined) ?? null;
  /** The segment key whose playback has completed — the arrival effect advances a held cursor. */
  const completedKeyRef = useRef<string | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // One audio element + one player for the surface's whole life.
  useEffect(() => {
    const audio = typeof Audio !== "undefined" ? new Audio() : null;
    if (audio) audio.preload = "auto";
    playerRef.current = new NarrationPlayer(audio);
    return () => {
      playerRef.current?.dispose();
      playerRef.current = null;
    };
  }, []);

  const clearAdvance = useCallback(() => {
    if (advanceTimer.current !== null) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  }, []);

  /** Exactly-once cursor advancement: one pending advance at a time, clamped to the log. */
  const scheduleAdvance = useCallback((ms: number) => {
    if (advanceTimer.current !== null) return;
    advanceTimer.current = setTimeout(() => {
      advanceTimer.current = null;
      setCursor((c) => Math.min(c + 1, Math.max(0, totalRef.current - 1)));
    }, ms);
  }, []);

  const handleComplete = useCallback(
    (key: string) => {
      completedKeyRef.current = key;
      if (cursorRef.current < totalRef.current - 1) {
        scheduleAdvance(pacingHoldMs(pacingRef.current, pauseAfterRef.current));
      }
      // Last segment: hold — the arrival effect advances when new segments stream in.
    },
    [scheduleAdvance],
  );

  // First narration begins the live unfolding automatically.
  useEffect(() => {
    if (segments.length > 0 && mode === "idle") {
      setCursor(0);
      setMode("playing");
    }
  }, [segments.length, mode]);

  // Keep the cursor in range as the log evolves.
  useEffect(() => {
    if (cursor > segments.length - 1) setCursor(Math.max(0, segments.length - 1));
  }, [segments.length, cursor]);

  // Drive playback. Depends on the current segment's IDENTITY only — fold churn (new events, new
  // array identities) can never reach the audio element. The player is idempotent per key, so even
  // a re-run with the same key is a no-op rather than a restart.
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (mode !== "playing" || !segKey || !current) {
      player.pause();
      return;
    }
    player.play(
      { key: segKey, voiceRef, textMs: durationMs(current) },
      { onProgress: progressStore.set, onComplete: handleComplete },
    );
    // No cleanup: session transitions are handled by the next play()/pause(); disposal on unmount.
    // (`current` is intentionally not a dep — it is keyed by segKey; fold churn must not re-run this.)
  }, [mode, segKey, voiceRef, handleComplete, progressStore]);

  // Rate changes apply live — never restart a segment.
  useEffect(() => {
    playerRef.current?.setRate(speed);
  }, [speed]);

  // Arrival: a held, completed segment flows onward the moment new segments stream in (and a
  // resumed segment that had already completed advances immediately).
  const total = segments.length;
  useEffect(() => {
    if (mode !== "playing" || !segKey) return;
    if (completedKeyRef.current === segKey && cursor < total - 1) scheduleAdvance(0);
  }, [total, cursor, mode, segKey, scheduleAdvance]);

  const atEnd = cursor >= segments.length - 1;

  const play = useCallback(() => setMode("playing"), []);
  const pause = useCallback(() => {
    clearAdvance();
    setMode("paused");
  }, [clearAdvance]);
  const toggle = useCallback(() => {
    clearAdvance();
    setMode((m) => (m === "playing" ? "paused" : "playing"));
  }, [clearAdvance]);
  const next = useCallback(() => {
    clearAdvance();
    setMode("paused");
    setCursor((c) => Math.min(c + 1, segments.length - 1));
  }, [segments.length, clearAdvance]);
  const prev = useCallback(() => {
    clearAdvance();
    setMode("paused");
    setCursor((c) => Math.max(c - 1, 0));
  }, [clearAdvance]);
  const scrubTo = useCallback(
    (index: number) => {
      clearAdvance();
      setMode("paused");
      setCursor(Math.max(0, Math.min(index, segments.length - 1)));
    },
    [segments.length, clearAdvance],
  );

  // The spotlight: the current segment's focus directive, falling back to the surface's focus.
  const focus = current?.focus ?? state?.focus ?? null;
  const speakingBlockId = mode === "playing" && current ? current.block_id : null;
  // UCS (ADR-0030): which frame is on screen + which MCCR element is spotlit are pure projections of
  // the cursor — never logged. The active frame is the one the current segment voices (or the latest).
  const activeFrameId =
    current?.frame_id ??
    (state?.frames.length ? (state.frames[state.frames.length - 1]?.frame_id ?? null) : null);
  const highlightElementId =
    current?.focus?.target_type === "element" ? current.focus.target_id : null;

  // Staged reveal (UCS, ADR-0030): the active frame's MCCR elements arrive AS the narration reaches
  // them — "cognition unfolds before your eyes." `revealed` accumulates every element the active
  // frame's segments up to the cursor have surfaced; `anchored` is every element any of its segments
  // reference (so an un-anchored orphan element is shown immediately rather than hidden forever).
  const { revealedElementIds, frameAnchoredElementIds } = useMemo(() => {
    const revealed = new Set<string>();
    const anchored = new Set<string>();
    segments.forEach((seg, i) => {
      if (seg.frame_id !== activeFrameId) return;
      for (const id of seg.reveal_ids) {
        anchored.add(id);
        if (i <= cursor) revealed.add(id);
      }
    });
    return { revealedElementIds: revealed, frameAnchoredElementIds: anchored };
  }, [segments, cursor, activeFrameId]);

  return {
    segments,
    cursor,
    current,
    focus,
    speakingBlockId,
    activeFrameId,
    highlightElementId,
    revealedElementIds,
    frameAnchoredElementIds,
    mode,
    isPlaying: mode === "playing",
    atEnd,
    progressStore,
    speed,
    play,
    pause,
    toggle,
    next,
    prev,
    scrubTo,
    setSpeed,
  };
}
