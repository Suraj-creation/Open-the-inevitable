/**
 * NarrationPlayer — exactly-once playback semantics under every race that used to duplicate or
 * silence narration (UCS, ADR-0007). Fake clock + fake audio: fully deterministic.
 */
import { describe, expect, it } from "vitest";
import {
  NarrationPlayer,
  createProgressStore,
  type AudioLike,
  type PlayerClock,
} from "../src/narration-player";

/** Deterministic clock: manual time, ordered timers, single-step frame loop. */
class FakeClock implements PlayerClock {
  t = 0;
  private nextId = 1;
  private timers: { id: number; at: number; fn: () => void }[] = [];
  private frames: { id: number; fn: () => void }[] = [];

  now(): number {
    return this.t;
  }
  setTimeout(fn: () => void, ms: number): unknown {
    const id = this.nextId++;
    this.timers.push({ id, at: this.t + ms, fn });
    return id;
  }
  clearTimeout(handle: unknown): void {
    this.timers = this.timers.filter((x) => x.id !== handle);
  }
  requestFrame(fn: () => void): unknown {
    const id = this.nextId++;
    this.frames.push({ id, fn });
    return id;
  }
  cancelFrame(handle: unknown): void {
    this.frames = this.frames.filter((x) => x.id !== handle);
  }
  /** Advance time, firing due timers, then run one frame pass. */
  tick(ms: number): void {
    this.t += ms;
    const due = this.timers.filter((x) => x.at <= this.t).sort((a, b) => a.at - b.at);
    this.timers = this.timers.filter((x) => x.at > this.t);
    for (const timer of due) timer.fn();
    this.runFrames();
  }
  runFrames(): void {
    const pass = this.frames;
    this.frames = [];
    for (const frame of pass) frame.fn();
  }
}

/** Minimal HTMLAudioElement stand-in honoring AbortSignal listener removal. */
class FakeAudio implements AudioLike {
  src = "";
  currentTime = 0;
  duration = 0;
  readyState = 0;
  playbackRate = 1;
  paused = true;
  playCalls = 0;
  rejectPlay = false;
  private listeners: { type: string; fn: () => void; signal?: AbortSignal }[] = [];

  play(): Promise<void> {
    this.playCalls += 1;
    this.paused = false;
    return this.rejectPlay ? Promise.reject(new Error("autoplay blocked")) : Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
  addEventListener(type: string, fn: () => void, options?: { signal?: AbortSignal }): void {
    const entry: { type: string; fn: () => void; signal?: AbortSignal } = { type, fn };
    if (options?.signal) entry.signal = options.signal;
    this.listeners.push(entry);
  }
  emit(type: string): void {
    for (const l of [...this.listeners]) {
      if (l.type !== type) continue;
      if (l.signal?.aborted) continue;
      l.fn();
    }
  }
  listenerCount(type: string): number {
    return this.listeners.filter((l) => l.type === type && !l.signal?.aborted).length;
  }
}

function harness(audio: FakeAudio | null = new FakeAudio()) {
  const clock = new FakeClock();
  const player = new NarrationPlayer(audio, clock);
  const completions: string[] = [];
  let progress = 0;
  const callbacks = {
    onProgress: (p: number) => {
      progress = p;
    },
    onComplete: (key: string) => {
      completions.push(key);
    },
  };
  return { clock, player, audio, completions, callbacks, progress: () => progress };
}

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("NarrationPlayer — exactly-once completion", () => {
  it("completes once on audio ended, even when ended fires repeatedly", () => {
    const h = harness();
    h.player.play({ key: "s1", voiceRef: "/media/a1", textMs: 5000 }, h.callbacks);
    h.audio!.emit("ended");
    h.audio!.emit("ended");
    h.audio!.emit("ended");
    expect(h.completions).toEqual(["s1"]);
  });

  it("watchdog rescues a silent stall; a late ended cannot double-complete", () => {
    const h = harness();
    h.player.play({ key: "s1", voiceRef: "/media/a1", textMs: 2000 }, h.callbacks);
    h.clock.tick(2000 + 4000 + 1); // expected + grace
    expect(h.completions).toEqual(["s1"]);
    h.audio!.emit("ended"); // straggler after watchdog completion
    expect(h.completions).toEqual(["s1"]);
  });

  it("re-entrant play() with the same key never restarts audio (fold-churn immunity)", () => {
    const h = harness();
    const seg = { key: "s1", voiceRef: "/media/a1", textMs: 5000 };
    h.player.play(seg, h.callbacks);
    expect(h.audio!.playCalls).toBe(1);
    h.player.play(seg, h.callbacks); // SSE event arrived → effect re-ran → same segment
    h.player.play(seg, h.callbacks);
    expect(h.audio!.playCalls).toBe(1);
    expect(h.completions).toEqual([]);
  });

  it("a completed segment never self-replays on re-entry (the repeat bug)", () => {
    const h = harness();
    const seg = { key: "s1", voiceRef: "/media/a1", textMs: 5000 };
    h.player.play(seg, h.callbacks);
    h.audio!.emit("ended");
    expect(h.completions).toEqual(["s1"]);
    const callsAfterEnd = h.audio!.playCalls;
    h.player.play(seg, h.callbacks); // new fold events keep arriving while the cursor holds
    h.player.play(seg, h.callbacks);
    expect(h.audio!.playCalls).toBe(callsAfterEnd); // audio never restarted
    expect(h.completions).toEqual(["s1"]); // completion never re-fired
  });

  it("switching segments aborts the old session's listeners", () => {
    const h = harness();
    h.player.play({ key: "s1", voiceRef: "/media/a1", textMs: 5000 }, h.callbacks);
    expect(h.audio!.listenerCount("ended")).toBe(1);
    h.player.play({ key: "s2", voiceRef: "/media/a2", textMs: 5000 }, h.callbacks);
    expect(h.audio!.listenerCount("ended")).toBe(1); // s1's listener aborted, only s2's lives
    h.audio!.emit("ended");
    expect(h.completions).toEqual(["s2"]);
  });
});

describe("NarrationPlayer — failure degradation", () => {
  it("audio error falls back to text pacing and still completes", () => {
    const h = harness();
    h.player.play({ key: "s1", voiceRef: "/media/missing", textMs: 3000 }, h.callbacks);
    h.audio!.emit("error"); // 404 / decode failure
    expect(h.audio!.paused).toBe(true);
    h.clock.tick(1500);
    expect(h.progress()).toBeGreaterThan(0.4); // caption keeps moving without audio
    expect(h.progress()).toBeLessThan(0.6);
    h.clock.tick(1600);
    h.clock.runFrames();
    expect(h.completions).toEqual(["s1"]);
  });

  it("blocked autoplay (play() rejection) falls back to text pacing", async () => {
    const h = harness();
    h.audio!.rejectPlay = true;
    h.player.play({ key: "s1", voiceRef: "/media/a1", textMs: 2000 }, h.callbacks);
    await flushMicrotasks();
    h.clock.tick(2100);
    h.clock.runFrames();
    expect(h.completions).toEqual(["s1"]);
  });

  it("plays text-only segments by reading time when no audio exists at all", () => {
    const h = harness(null);
    h.player.play({ key: "s1", voiceRef: null, textMs: 1000 }, h.callbacks);
    h.clock.tick(500);
    expect(h.progress()).toBeCloseTo(0.5, 1);
    h.clock.tick(600);
    h.clock.runFrames();
    expect(h.completions).toEqual(["s1"]);
  });
});

describe("NarrationPlayer — pause / resume / rate", () => {
  it("pause freezes text pacing; resume continues from the same position", () => {
    const h = harness(null);
    h.player.play({ key: "s1", voiceRef: null, textMs: 1000 }, h.callbacks);
    h.clock.tick(400);
    h.player.pause();
    h.clock.tick(5000); // paused time must not count (and watchdog must not fire)
    expect(h.completions).toEqual([]);
    h.player.play({ key: "s1", voiceRef: null, textMs: 1000 }, h.callbacks);
    h.clock.tick(100);
    expect(h.progress()).toBeCloseTo(0.5, 1);
    h.clock.tick(600);
    h.clock.runFrames();
    expect(h.completions).toEqual(["s1"]);
  });

  it("pause while voiced prevents the watchdog from completing a paused segment", () => {
    const h = harness();
    h.player.play({ key: "s1", voiceRef: "/media/a1", textMs: 1000 }, h.callbacks);
    h.player.pause();
    h.clock.tick(60_000);
    expect(h.completions).toEqual([]);
  });

  it("rate changes rescale text pacing live without restarting", () => {
    const h = harness(null);
    h.player.play({ key: "s1", voiceRef: null, textMs: 2000 }, h.callbacks);
    h.clock.tick(1000); // 50% at 1×
    h.player.setRate(2); // remaining 50% now takes 500ms
    h.clock.tick(550);
    h.clock.runFrames();
    expect(h.completions).toEqual(["s1"]);
  });

  it("audio progress is gated on readyState (a buffering element reports 0, not lies)", () => {
    const h = harness();
    h.player.play({ key: "s1", voiceRef: "/media/a1", textMs: 5000 }, h.callbacks);
    h.audio!.duration = 10;
    h.audio!.currentTime = 5;
    h.audio!.readyState = 1; // metadata only — not yet playable
    expect(h.player.progress()).toBe(0);
    h.audio!.readyState = 2;
    expect(h.player.progress()).toBeCloseTo(0.5, 5);
  });
});

describe("ProgressStore", () => {
  it("notifies subscribers only when the value changes", () => {
    const store = createProgressStore();
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });
    store.set(0.5);
    store.set(0.5);
    store.set(0.6);
    expect(notified).toBe(2);
    expect(store.get()).toBe(0.6);
  });
});
