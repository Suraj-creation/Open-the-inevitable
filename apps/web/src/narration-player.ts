/**
 * NarrationPlayer — the single owner of narration audio playback (UCS, ADR-0007).
 *
 * Exactly-once semantics, framework-free. Every past duplicate/silent/stalled narration traced to
 * the same root: playback lifecycle spread across a React effect that re-ran on every fold change,
 * re-invoking `audio.play()` on an already-ended element (which restarts it from zero — the
 * "narration repeats twice" bug) and leaking stale `ended`/watchdog callbacks. This class closes
 * that hole structurally:
 *
 *   - One playback SESSION per (segment key). Re-entrant `play()` with the same key is idempotent:
 *     playing → no-op; paused → resume; completed → no-op (a finished segment never self-replays).
 *   - An epoch counter + AbortController guard every async edge (`ended`, `error`, rejected
 *     `play()`, watchdog, rAF loop) so a callback from a previous session can never complete or
 *     advance the current one.
 *   - Completion fires EXACTLY once per segment, no matter how many paths race to it
 *     (`ended` × N, watchdog, text pacing) — all funnel through one idempotent `complete()`.
 *   - Audio failure (404, decode error, blocked autoplay, silent stall) degrades to reading-time
 *     pacing — the surface can never freeze with a dead speaker, and the caption keeps moving.
 *   - The progress clock is the audio element's own `currentTime / duration` (ground truth), gated
 *     on `readyState` so a still-buffering element doesn't lie; text pacing uses the injected clock.
 *
 * The player owns NO canonical truth (SRF-001 §4.5): which segment plays is handed in; progress and
 * completion are reported out. Clock and audio are injected so the whole state machine is testable
 * with fake time.
 */

export interface AudioLike {
  src: string;
  currentTime: number;
  readonly duration: number;
  readonly readyState: number;
  playbackRate: number;
  play(): Promise<void>;
  pause(): void;
  addEventListener(type: string, listener: () => void, options?: { signal?: AbortSignal }): void;
}

export interface PlayerClock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  requestFrame(fn: () => void): unknown;
  cancelFrame(handle: unknown): void;
}

export interface SegmentSpec {
  /** Stable identity (segment_id) — the unit of exactly-once playback + completion. */
  readonly key: string;
  /** Out-of-band audio URL (SRF-005 media route), or null for a text-only segment. */
  readonly voiceRef: string | null;
  /** Expected duration in ms (voice duration_ms, else reading-time estimate) — paces text
   *  fallback and arms the watchdog. */
  readonly textMs: number;
}

export interface PlayerCallbacks {
  /** Playback progress 0..1 within the segment — drives the word-synced caption. */
  readonly onProgress: (progress: number) => void;
  /** The segment finished (audio ended, text pacing elapsed, or watchdog rescue) — exactly once. */
  readonly onComplete: (key: string) => void;
}

/** Extra time past the expected duration before the watchdog declares a silent stall. */
const WATCHDOG_GRACE_MS = 4000;

const noopProgress = (_p: number): void => {};
const noopComplete = (_k: string): void => {};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function clampAudioRate(rate: number): number {
  return Math.max(0.5, Math.min(2, rate));
}

function clampTextRate(rate: number): number {
  return Math.max(0.25, rate);
}

export function defaultPlayerClock(): PlayerClock {
  const hasRaf = typeof requestAnimationFrame !== "undefined";
  return {
    now: () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    requestFrame: (fn) => (hasRaf ? requestAnimationFrame(fn) : setTimeout(fn, 33)),
    cancelFrame: (handle) => {
      if (hasRaf) cancelAnimationFrame(handle as number);
      else clearTimeout(handle as ReturnType<typeof setTimeout>);
    },
  };
}

export class NarrationPlayer {
  private readonly audio: AudioLike | null;
  private readonly clock: PlayerClock;
  private epoch = 0;
  private seg: SegmentSpec | null = null;
  private playing = false;
  /** Pacing by reading time — text-only segments and every audio-failure fallback. */
  private usingText = false;
  private paceStart = 0;
  /** Progress (0..1) accrued before the current pacing run (pause/resume, rate change, fallback). */
  private paceOffset = 0;
  private rate = 1;
  private lastCompletedKey: string | null = null;
  private abort: AbortController | null = null;
  private watchdogHandle: unknown = null;
  private frameHandle: unknown = null;
  private onProgress: (p: number) => void = noopProgress;
  private onComplete: (key: string) => void = noopComplete;

  constructor(audio: AudioLike | null, clock: PlayerClock = defaultPlayerClock()) {
    this.audio = audio;
    this.clock = clock;
  }

  /** Begin (or resume) the given segment. Idempotent per key: never restarts, never double-plays. */
  play(seg: SegmentSpec, callbacks: PlayerCallbacks): void {
    this.onProgress = callbacks.onProgress;
    this.onComplete = callbacks.onComplete;

    if (this.seg?.key === seg.key) {
      if (this.lastCompletedKey === seg.key) return; // finished — a segment never self-replays
      if (this.playing) return; // already live — a fold-churn re-entry must not restart audio
      this.resume();
      return;
    }

    // Fresh session: invalidate every callback belonging to the previous one.
    this.teardown();
    this.seg = seg;
    this.playing = true;
    this.usingText = !(seg.voiceRef && this.audio);
    this.paceOffset = 0;
    this.paceStart = this.clock.now();
    const epoch = ++this.epoch;

    if (!this.usingText && this.audio && seg.voiceRef) {
      const audio = this.audio;
      if (!audio.src || !audio.src.endsWith(seg.voiceRef)) audio.src = seg.voiceRef;
      else audio.currentTime = 0; // deliberate re-teach of the same artifact starts at the top
      audio.playbackRate = clampAudioRate(this.rate);
      this.abort = typeof AbortController !== "undefined" ? new AbortController() : null;
      const options = this.abort ? { signal: this.abort.signal } : undefined;
      audio.addEventListener(
        "ended",
        this.guardFor(epoch, () => this.complete()),
        options,
      );
      // A 404/decode error must not strand the learner: pace the words by reading time instead.
      audio.addEventListener(
        "error",
        this.guardFor(epoch, () => this.fallbackToText()),
        options,
      );
      // Blocked autoplay (or any play() rejection) degrades the same way.
      void audio.play().catch(this.guardFor(epoch, () => this.fallbackToText()));
      this.armWatchdog();
    }
    this.startLoop();
  }

  /** Pause playback, preserving position; `play()` with the same key resumes. */
  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    if (this.usingText) this.paceOffset = this.progress();
    this.audio?.pause();
    this.stopTimers(); // the watchdog must never complete a paused segment
  }

  /** Change playback rate live — no restart, pacing rescales from the current position. */
  setRate(rate: number): void {
    if (this.usingText && this.playing) {
      this.paceOffset = this.progress();
      this.paceStart = this.clock.now();
    }
    this.rate = rate;
    if (this.audio) this.audio.playbackRate = clampAudioRate(rate);
  }

  /** Current progress 0..1 — audio ground truth when available, else pacing clock. */
  progress(): number {
    const seg = this.seg;
    if (!seg) return 0;
    if (!this.usingText && this.audio) {
      const a = this.audio;
      // readyState < HAVE_CURRENT_DATA ⇒ still buffering: hold rather than run ahead of silence.
      if (a.duration > 0 && a.readyState >= 2) return clamp01(a.currentTime / a.duration);
      return clamp01(this.paceOffset);
    }
    const dwell = seg.textMs / clampTextRate(this.rate);
    return clamp01(this.paceOffset + (this.clock.now() - this.paceStart) / Math.max(1, dwell));
  }

  dispose(): void {
    this.teardown();
    this.seg = null;
    this.playing = false;
    this.onProgress = noopProgress;
    this.onComplete = noopComplete;
  }

  private resume(): void {
    this.playing = true;
    if (this.usingText) {
      this.paceStart = this.clock.now();
    } else if (this.audio && this.seg?.voiceRef) {
      const epoch = this.epoch;
      void this.audio.play().catch(this.guardFor(epoch, () => this.fallbackToText()));
      this.armWatchdog();
    }
    this.startLoop();
  }

  private fallbackToText(): void {
    if (!this.seg || this.lastCompletedKey === this.seg.key) return;
    this.paceOffset = this.progress();
    this.usingText = true;
    this.paceStart = this.clock.now();
    this.audio?.pause();
  }

  private complete(): void {
    const seg = this.seg;
    if (!seg || this.lastCompletedKey === seg.key) return;
    this.lastCompletedKey = seg.key;
    this.stopTimers();
    this.playing = false;
    this.onProgress(1);
    this.onComplete(seg.key);
  }

  private armWatchdog(): void {
    if (this.watchdogHandle !== null) this.clock.clearTimeout(this.watchdogHandle);
    const seg = this.seg;
    if (!seg) return;
    const expected = seg.textMs / clampAudioRate(this.rate);
    const epoch = this.epoch;
    this.watchdogHandle = this.clock.setTimeout(() => {
      this.watchdogHandle = null;
      if (this.epoch === epoch && this.playing) this.complete();
    }, expected + WATCHDOG_GRACE_MS);
  }

  private startLoop(): void {
    if (this.frameHandle !== null) this.clock.cancelFrame(this.frameHandle);
    const epoch = this.epoch;
    const step = (): void => {
      if (this.epoch !== epoch || !this.playing) return;
      const p = this.progress();
      this.onProgress(p);
      if (this.usingText && p >= 1) {
        this.complete();
        return;
      }
      this.frameHandle = this.clock.requestFrame(step);
    };
    this.frameHandle = this.clock.requestFrame(step);
  }

  private stopTimers(): void {
    if (this.watchdogHandle !== null) {
      this.clock.clearTimeout(this.watchdogHandle);
      this.watchdogHandle = null;
    }
    if (this.frameHandle !== null) {
      this.clock.cancelFrame(this.frameHandle);
      this.frameHandle = null;
    }
  }

  private teardown(): void {
    this.abort?.abort();
    this.abort = null;
    this.stopTimers();
    this.audio?.pause();
  }

  private guardFor(epoch: number, fn: () => void): () => void {
    return () => {
      if (this.epoch === epoch) fn();
    };
  }
}

/** A tiny external store for narration progress — subscribed at the leaf (word caption) so the
 *  60 Hz progress clock re-renders one component, never the whole surface tree. */
export interface ProgressStore {
  subscribe(listener: () => void): () => void;
  get(): number;
  set(value: number): void;
}

export function createProgressStore(): ProgressStore {
  let value = 0;
  const listeners = new Set<() => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get: () => value,
    set(next) {
      if (next === value) return;
      value = next;
      for (const listener of listeners) listener();
    },
  };
}
