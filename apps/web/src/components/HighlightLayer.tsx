/**
 * HighlightLayer — the teacher's marker (UCS, ADR-0030).
 *
 * ONE absolutely-positioned, soft-contrast box that measures the spotlit MCCR element and animates
 * its transform/size to sit over it — "a marker moving under the sentence being explained" — as the
 * narration cursor advances. It only ever wraps one atomic anchor (MCCR elements are anchors, not
 * paragraphs). Pure client projection over the choreographer cursor; nothing enters canonical state.
 * Honors prefers-reduced-motion: the box snaps instead of sliding.
 */
import { useEffect, useState } from "react";

interface Rect {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

export function HighlightLayer({
  containerRef,
  elementId,
  scale = 1,
}: {
  /** The marker's positioned ancestor (`.frame-fit`) — measurements are relative to THIS box, and
   *  the target is queried within it, so the marker sits exactly over the anchor. */
  readonly containerRef: React.RefObject<HTMLElement | null>;
  readonly elementId: string | null;
  /** The fit-to-viewport scale applied to the container; measured screen deltas are divided by it so
   *  the marker's local transform is not scaled twice. */
  readonly scale?: number;
}) {
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !elementId) {
      setRect(null);
      return;
    }
    const target = container.querySelector<HTMLElement>(
      `[data-element-id="${cssEscape(elementId)}"]`,
    );
    if (!target) {
      setRect(null);
      return;
    }

    const measure = (): void => {
      const c = container.getBoundingClientRect();
      const t = target.getBoundingClientRect();
      // getBoundingClientRect is post-transform (scaled) screen space; the marker lives INSIDE the
      // scaled container, so convert the delta back to the container's local (unscaled) coordinates.
      const k = scale > 0 ? scale : 1;
      const pad = 6;
      setRect({
        top: (t.top - c.top) / k - pad,
        left: (t.left - c.left) / k - pad,
        width: t.width / k + pad * 2,
        height: t.height / k + pad * 2,
      });
    };

    measure();
    // Re-measure while the frame reveals/scales (the marker must track, not lag).
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(container);
      ro.observe(target);
    }
    const raf = typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame(measure) : 0;
    return () => {
      ro?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [containerRef, elementId, scale]);

  if (!rect) return null;
  return (
    <div
      className="frame-highlight"
      aria-hidden
      style={{
        transform: `translate(${rect.left}px, ${rect.top}px)`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      }}
    />
  );
}

/** Minimal CSS.escape fallback for attribute-selector safety (element ids are `el-<slot>`). */
function cssEscape(value: string): string {
  const g = globalThis as { CSS?: { escape?: (v: string) => string } };
  if (g.CSS?.escape) return g.CSS.escape(value);
  return value.replace(/["\\\]]/g, "\\$&");
}
