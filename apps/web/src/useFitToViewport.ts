/**
 * useFitToViewport — keep a Cognitive Frame within one viewport with NO scrolling (UCS, ADR-0030).
 *
 * A frame is defined to fit one screen (overflow is a compose-time split, not a scrollbar). This is
 * the last line of defense: it measures the content against its container and, only if the content
 * genuinely overflows, applies ONE uniform downscale (floored, so text stays readable) — never a
 * scrollbar. Pure render projection; nothing here enters canonical state.
 */
import { useLayoutEffect, useRef, useState } from "react";

const FLOOR = 0.7;

export function useFitToViewport<C extends HTMLElement, I extends HTMLElement>(
  deps: unknown[],
): {
  containerRef: React.RefObject<C | null>;
  innerRef: React.RefObject<I | null>;
  scale: number;
} {
  const containerRef = useRef<C | null>(null);
  const innerRef = useRef<I | null>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;
    if (typeof ResizeObserver === "undefined") return;

    const measure = (): void => {
      // Measure intrinsic content size at scale 1 (offsetHeight is layout, unaffected by transform).
      const availH = container.clientHeight;
      const availW = container.clientWidth;
      const contentH = inner.scrollHeight;
      const contentW = inner.scrollWidth;
      if (contentH <= 0 || contentW <= 0 || availH <= 0 || availW <= 0) return;
      const fit = Math.min(1, availH / contentH, availW / contentW);
      setScale(Math.max(FLOOR, Number(fit.toFixed(3))));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    ro.observe(inner);
    return () => ro.disconnect();
  }, deps);

  return { containerRef, innerRef, scale };
}
