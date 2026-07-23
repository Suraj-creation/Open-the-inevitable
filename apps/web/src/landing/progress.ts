/**
 * The journey clock — a tiny module singleton shared by the DOM driver and the WebGL world so both
 * are one choreography (CDL v2 §12), without routing scroll through React state on the hot path.
 * The scroll handler sets `target`; a single rAF loop eases `current` toward it; `useFrame` (WebGL)
 * and the DOM still-points both read `current`. Kept out of React to hold 60fps.
 */
export const journey = {
  /** Where the scroll says we are (0..1). */
  target: 0,
  /** The eased, rendered position (0..1) — what everything reads. */
  current: 0,
  /** Pointer parallax, -1..1 on each axis (subtle spatial life). */
  px: 0,
  py: 0,
};

/** Ease `current` toward `target` by a frame-rate-independent factor. Call once per rAF frame. */
export function stepJourney(dtMs: number): void {
  const k = 1 - Math.pow(0.0015, dtMs / 1000); // ~critically damped follow
  journey.current += (journey.target - journey.current) * k;
  if (Math.abs(journey.target - journey.current) < 1e-5) journey.current = journey.target;
}
