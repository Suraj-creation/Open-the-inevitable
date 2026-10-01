/**
 * Durable time. The world clock stamps records and drives validity and due times; it is injected so
 * tests can advance it (an expectation falls due, a claim's validity lapses) without waiting.
 */
export interface Clock {
  /** ISO-8601 UTC. */
  now(): string;
}

export const systemClock: Clock = { now: () => new Date().toISOString() };

export class ManualClock implements Clock {
  private ms: number;

  constructor(startIso = "2026-01-01T00:00:00.000Z") {
    this.ms = Date.parse(startIso);
    if (Number.isNaN(this.ms)) throw new Error(`ManualClock: bad instant ${startIso}`);
  }

  now(): string {
    return new Date(this.ms).toISOString();
  }

  advance(ms: number): void {
    this.ms += ms;
  }
}

export const DAY_MS = 86_400_000;

export function isPast(instantIso: string, nowIso: string): boolean {
  return Date.parse(instantIso) < Date.parse(nowIso);
}
