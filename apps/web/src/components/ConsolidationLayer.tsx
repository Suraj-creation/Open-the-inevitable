/**
 * ConsolidationLayer — the CDL `consolidate` motion (§7): when a concept becomes mastered, a mote
 * of that knowledge drifts and shrinks toward the Path (the constellation of everything learned) —
 * understanding becoming durable memory, made visible. A pure projection of timeline mastery
 * transitions; owns no truth. Honors prefers-reduced-motion (a brief fade in place).
 */
import { useEffect, useRef } from "react";

export interface Mote {
  readonly id: string;
  readonly title: string;
}

function ConsolidationMote({
  title,
  onDone,
}: {
  readonly title: string;
  readonly onDone: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== "function") {
      onDone();
      return;
    }
    const reduce =
      typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Target: the Path launcher (where the constellation of mastered concepts lives).
    const target = document.querySelector(".path-launcher")?.getBoundingClientRect();
    const start = el.getBoundingClientRect();
    const anim = reduce
      ? el.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 500, fill: "forwards" })
      : el.animate(
          [
            { transform: "translate(0,0) scale(1)", opacity: 0 },
            { opacity: 1, offset: 0.18 },
            target
              ? {
                  transform: `translate(${
                    target.left + target.width / 2 - (start.left + start.width / 2)
                  }px, ${target.top + target.height / 2 - (start.top + start.height / 2)}px) scale(0.18)`,
                  opacity: 0,
                }
              : { transform: "translateY(60px) scale(0.4)", opacity: 0 },
          ],
          { duration: 780, easing: "cubic-bezier(0.32, 0.72, 0, 1)", fill: "forwards" },
        );
    anim.onfinish = onDone;
    return () => anim.cancel();
  }, []);
  return (
    <div className="consolidate-mote" ref={ref}>
      <span className="consolidate-mote-glyph" aria-hidden>
        ✦
      </span>
      {title}
    </div>
  );
}

export function ConsolidationLayer({
  motes,
  onDone,
}: {
  readonly motes: readonly Mote[];
  readonly onDone: (id: string) => void;
}) {
  if (motes.length === 0) return null;
  return (
    <div className="consolidate-layer" aria-hidden>
      {motes.map((m) => (
        <ConsolidationMote key={m.id} title={m.title} onDone={() => onDone(m.id)} />
      ))}
    </div>
  );
}
