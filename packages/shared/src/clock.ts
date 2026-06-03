/**
 * Injectable clock. All time-dependent COS logic takes a {@link Clock} so that replay and
 * tests use a {@link ManualClock} for determinism (spec/replay/deterministic-replay.md,
 * spec/protocols/cognitive-event-protocol.md — time must be a controllable primitive).
 */
export interface Clock {
  /** Current physical time in milliseconds since the Unix epoch. */
  nowMs(): number;
}

/** Production clock backed by the host wall clock. */
export class SystemClock implements Clock {
  nowMs(): number {
    return Date.now();
  }
}

/** Deterministic clock for tests and replay. */
export class ManualClock implements Clock {
  constructor(private current: number = 0) {}
  nowMs(): number {
    return this.current;
  }
  set(ms: number): void {
    this.current = ms;
  }
  advance(ms: number): void {
    this.current += ms;
  }
}
