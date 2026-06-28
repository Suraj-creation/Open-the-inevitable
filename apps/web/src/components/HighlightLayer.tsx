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
  stageRef,
  elementId,
}: {
  readonly stageRef: React.RefObject<HTMLElement | null>;
  readonly elementId: string | null;
}) {
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !elementId) {
      setRect(null);
      return;
    }
    const target = stage.querySelector<HTMLElement>(`[data-element-id="${cssEscape(elementId)}"]`);
    if (!target) {
      setRect(null);
      return;
    }

    const measure = (): void => {
      const s = stage.getBoundingClientRect();
      const t = target.getBoundingClientRect();
      // Pad slightly so the marker reads as "around" the anchor.
      const pad = 6;
      setRect({
        top: t.top - s.top - pad,
        left: t.left - s.left - pad,
        width: t.width + pad * 2,
        height: t.height + pad * 2,
      });
    };

    measure();
    // Re-measure while the frame reveals/scales (the marker must track, not lag).
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(stage);
      ro.observe(target);
    }
    const raf = typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame(measure) : 0;
    return () => {
      ro?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [stageRef, elementId]);

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
