/**
 * useChoreographer — the client's playback projection over the folded SurfaceState.
 *
 * Analogous to OpenMAIC's PlaybackEngine, but it reads OUR events: it maintains a cursor over
 * `state.narration` and paces through segments. When a segment carries synthesized voice, the
 * audio's own `ended`/`currentTime` is the ground truth for advancing (ADR-0007); text-only
 * segments fall back to a reading-time estimate. It owns NO truth: the cursor is client-only UI
 * state and never re-enters the canonical record (SRF-001 §4.5/§4.6).
 *
 * In "live" mode it auto-advances as new segments stream in (cognition unfolding now); the learner
 * can pause and scrub (replay) at any time.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NarrationSegment, SurfaceFocus, SurfaceState } from "@inevitable/surface/client";

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
  readonly mode: PlaybackMode;
  readonly isPlaying: boolean;
  readonly atEnd: boolean;
  /** Playback progress within the current segment, 0..1 — drives word-level highlight (client projection). */
  readonly progress: number;
  readonly speed: number;
  readonly play: () => void;
  readonly pause: () => void;
  readonly toggle: () => void;
  readonly next: () => void;
  readonly prev: () => void;
  readonly scrubTo: (index: number) => void;
  readonly setSpeed: (speed: number) => void;
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
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const segCount = useRef(0);
  segCount.current = segments.length;

  // One audio element for narration playback; its `ended` event drives advance (audio = truth).
  useEffect(() => {
    if (typeof Audio === "undefined") return;
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;
    const onEnded = (): void => setCursor((c) => Math.min(c + 1, segCount.current - 1));
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.pause();
      audio.removeEventListener("ended", onEnded);
      audioRef.current = null;
    };
  }, []);

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

  // Drive playback: prefer real audio (ended = ground truth); else pace text by reading time.
  useEffect(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const audio = audioRef.current;
    const seg = segments[cursor] ?? null;
    const voiceRef = seg?.voice?.content_ref ?? null;

    if (audio && voiceRef) {
      if (!audio.src.endsWith(voiceRef)) audio.src = voiceRef;
      audio.playbackRate = Math.max(0.5, Math.min(2, speed));
      if (mode === "playing") void audio.play().catch(() => undefined);
      else audio.pause();
      return; // advance happens on the audio 'ended' event
    }

    audio?.pause();
    if (mode !== "playing") return;
    if (cursor >= segments.length - 1) return; // caught up — wait for new segments
    const dwell = durationMs(seg) / Math.max(0.25, speed);
    timer.current = setTimeout(() => setCursor((c) => Math.min(c + 1, segments.length - 1)), dwell);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [mode, cursor, segments, speed]);

  // Word-level highlight (client projection, ADR-0007): interpolate progress across the current
  // segment — the audio's `currentTime` when voiced, else elapsed/reading-time. Never canonical.
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    setProgress(0);
    if (mode !== "playing") return;
    if (typeof requestAnimationFrame === "undefined") return;
    const seg = segments[cursor] ?? null;
    if (!seg) return;
    const audio = audioRef.current;
    const voiceRef = seg.voice?.content_ref ?? null;
    const dwell = durationMs(seg) / Math.max(0.25, speed);
    const startedAt = typeof performance !== "undefined" ? performance.now() : 0;
    let raf = 0;
    const tick = (): void => {
      let p: number;
      if (audio && voiceRef && audio.duration > 0) {
        p = audio.currentTime / audio.duration;
      } else {
        const now = typeof performance !== "undefined" ? performance.now() : startedAt + dwell;
        p = dwell > 0 ? (now - startedAt) / dwell : 1;
      }
      setProgress(Math.max(0, Math.min(1, p)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, cursor, segments, speed]);

  const current = segments[cursor] ?? null;
  const atEnd = cursor >= segments.length - 1;

  const play = useCallback(() => setMode("playing"), []);
  const pause = useCallback(() => setMode("paused"), []);
  const toggle = useCallback(() => setMode((m) => (m === "playing" ? "paused" : "playing")), []);
  const next = useCallback(() => {
    setMode("paused");
    setCursor((c) => Math.min(c + 1, segments.length - 1));
  }, [segments.length]);
  const prev = useCallback(() => {
    setMode("paused");
    setCursor((c) => Math.max(c - 1, 0));
  }, []);
  const scrubTo = useCallback(
    (index: number) => {
      setMode("paused");
      setCursor(Math.max(0, Math.min(index, segments.length - 1)));
    },
    [segments.length],
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

  return {
    segments,
    cursor,
    current,
    focus,
    speakingBlockId,
    activeFrameId,
    highlightElementId,
    mode,
    isPlaying: mode === "playing",
    atEnd,
    progress,
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
