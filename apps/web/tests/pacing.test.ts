/**
 * R3b (ADR-0057) — the Director paces playback. The inter-segment hold is scaled by tempo and made
 * deliberately still on `silence`, replacing the fixed 1400 ms constant. Pure + deterministic.
 */
import { describe, expect, test } from "vitest";
import { pacingHoldMs, type DirectivePacingView } from "../src/useChoreographer";

const pacing = (o: Partial<DirectivePacingView>): DirectivePacingView => ({
  tempo: "measured",
  dwell_hint_ms: 3200,
  silence: false,
  ...o,
});

describe("pacingHoldMs", () => {
  test("no directive ⇒ the legacy hold (1400 on pause_after, 0 otherwise) — nothing regresses", () => {
    expect(pacingHoldMs(null, true)).toBe(1400);
    expect(pacingHoldMs(null, false)).toBe(0);
  });

  test("tempo scales the teacher's pause: slow dwells longer, brisk moves on", () => {
    const slow = pacingHoldMs(pacing({ tempo: "slow" }), true);
    const measured = pacingHoldMs(pacing({ tempo: "measured" }), true);
    const brisk = pacingHoldMs(pacing({ tempo: "brisk" }), true);
    expect(slow).toBeGreaterThan(measured);
    expect(measured).toBeGreaterThan(brisk);
    expect(measured).toBe(1400);
  });

  test("silence makes the surface fall still even on an unmarked segment (CSE-011 §9)", () => {
    expect(pacingHoldMs(pacing({ silence: true }), false)).toBeGreaterThan(0);
    // Without silence, an unmarked segment advances immediately.
    expect(pacingHoldMs(pacing({ silence: false }), false)).toBe(0);
  });
});
