/**
 * useDensityRecomposition — the no-scroll law WITHOUT shrinking or clipping (CDL: density
 * recomposition doctrine). A frame is one viewport-complete thought; if its anchors overflow the
 * viewport at full type size, the lowest-priority anchors FOLD into disclosure chips (progressive
 * disclosure — the germane stays, the supporting reveals on demand) until the board fits. Text
 * never renders below its role size; anchors are never cut. A uniform downscale survives only as
 * the very last resort (floor 0.85) for a frame that still overflows with nothing left to fold.
 * Pure render projection; nothing here enters canonical state (ADR-0007).
 */
import { useLayoutEffect, useRef, useState } from "react";

/** Fold order: the least structurally-critical anchors yield first. */
const FOLD_ORDER: readonly string[] = [
  "memory_cue",
  "table",
  "misconception",
  "key_example",
  "process",
  "code",
  "relationship",
  "diagram",
  "mental_model",
  "key_formula",
];

/** Anchors that never fold: the concept itself, its definition, and the illustration. */
const PROTECTED_TYPES = new Set(["core_concept", "definition", "image"]);

const SCALE_FLOOR = 0.85;

/** Free space (px) required before a folded anchor is invited back onto the board. */
const UNFOLD_HEADROOM = 170;

export interface FoldCandidate {
  readonly id: string;
  readonly type: string;
}

export function useDensityRecomposition<C extends HTMLElement, I extends HTMLElement>(
  candidates: readonly FoldCandidate[],
  /** The element the narration is spotlighting — always kept on the board. */
  highlightId: string | null,
  deps: unknown[],
): {
  containerRef: React.RefObject<C | null>;
  innerRef: React.RefObject<I | null>;
  folded: ReadonlySet<string>;
  scale: number;
} {
  const containerRef = useRef<C | null>(null);
  const innerRef = useRef<I | null>(null);
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set());
  const [scale, setScale] = useState(1);
  // Anti-oscillation ledger: an anchor folded twice stays folded (no fold/unfold flicker).
  const foldCounts = useRef(new Map<string, number>());

  // A new frame (or version, or a streamed-in anchor) recomposes from scratch — folds made
  // against a half-materialized board (image shimmer, pending anchors) must not persist.
  useLayoutEffect(() => {
    setFolded(new Set());
    setScale(1);
    foldCounts.current = new Map();
  }, deps);

  // If the narration spotlights a folded anchor, the board recomposes around it — the spoken
  // idea is always visible (synchronized narration is the surface's core contract).
  useLayoutEffect(() => {
    if (highlightId && folded.has(highlightId)) {
      setFolded(new Set());
      setScale(1);
    }
  }, [highlightId, folded]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;
    if (typeof ResizeObserver === "undefined") return;

    const recompose = (): void => {
      // Available space is the container's content box (clientHeight includes padding).
      const cs = getComputedStyle(container);
      const availH =
        container.clientHeight -
        (parseFloat(cs.paddingTop) || 0) -
        (parseFloat(cs.paddingBottom) || 0);
      const availW =
        container.clientWidth -
        (parseFloat(cs.paddingLeft) || 0) -
        (parseFloat(cs.paddingRight) || 0);
      const contentH = inner.scrollHeight;
      const contentW = inner.scrollWidth;
      if (contentH <= 0 || contentW <= 0 || availH <= 0 || availW <= 0) return;
      const overflows = contentH > availH || contentW > availW;
      if (!overflows) {
        // Room to breathe again (the viewport grew, an image settled): invite the most recently
        // folded anchor back. The headroom scales with the viewport (a large screen unfolds sooner,
        // a small one stays conservative) so growth is tracked responsively, not in one coarse step
        // — while the fold-twice ledger still prevents oscillation.
        const headroom = Math.max(90, Math.min(UNFOLD_HEADROOM, availH * 0.22));
        if (folded.size > 0 && availH - contentH > headroom) {
          const last = [...folded][folded.size - 1];
          if (last && (foldCounts.current.get(last) ?? 0) < 2) {
            setFolded((prev) => {
              const next = new Set(prev);
              next.delete(last);
              return next;
            });
          }
        }
        return;
      }
      // Fold ONE more anchor (the effect re-runs after the render settles, converging stepwise).
      const next = FOLD_ORDER.map((type) =>
        candidates.find(
          (c) =>
            c.type === type &&
            !folded.has(c.id) &&
            !PROTECTED_TYPES.has(c.type) &&
            c.id !== highlightId,
        ),
      ).find((c) => c !== undefined);
      if (next) {
        foldCounts.current.set(next.id, (foldCounts.current.get(next.id) ?? 0) + 1);
        setFolded((prev) => new Set(prev).add(next.id));
        return;
      }
      // Nothing left to fold: the last-resort uniform downscale (floored — readable, never tiny).
      const fit = Math.min(1, availH / contentH, availW / contentW);
      setScale(Math.max(SCALE_FLOOR, Number(fit.toFixed(3))));
    };

    recompose();
    const ro = new ResizeObserver(recompose);
    ro.observe(container);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [candidates, folded, highlightId, scale]);

  return { containerRef, innerRef, folded, scale };
}
