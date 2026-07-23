/**
 * Landing — the continuous cognitive journey (CDL v2; storyboard in spec/design/proposals/).
 *
 * One world, one scroll clock. A fixed WebGL World sits behind a fixed stage of DOM/glass
 * still-points; a tall spacer provides the scroll distance. A single rAF driver eases the shared
 * `journey` clock and updates each still-point's opacity/transform directly (React stays off the
 * hot path → 60fps). The visitor travels through cognition — mote → curiosity → neuron → knowledge
 * graph → companion → ascent → civilization → the Inevitable — with no cuts, only transformation.
 *
 * Accessibility (CDL v2 §15): with prefers-reduced-motion or no WebGL, the journey renders as a
 * static illustrated narrative — every still point and its copy, readable, no canvas.
 */
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { JOURNEY_VH, MOVEMENTS, stillOpacityAt } from "../cdl/world";
import { SiteFooter } from "../site/SiteFooter";
import { SiteNav } from "../site/SiteNav";
import { journey, stepJourney } from "./progress";
import "./landing.css";

// The WebGL world is heavy; code-split it so the DOM/text layer (LCP) ships first.
const World = lazy(() => import("./World").then((m) => ({ default: m.World })));

function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function hasWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export interface LandingProps {
  /** Enter the surface — the CTA hands off to the real cognitive environment. */
  readonly onEnter: () => void;
}

/** The copy block for one movement (kinetic Canon, Gloss, ladder labels, or paradigm lines). */
function MovementCopy({
  index,
  onEnter,
}: {
  readonly index: number;
  readonly onEnter: () => void;
}) {
  const m = MOVEMENTS[index]!;
  const c = m.copy;
  const isFirst = index === 0;
  const isLast = index === MOVEMENTS.length - 1;
  return (
    <div className="still-inner" style={{ ["--state-tint" as string]: m.hue }}>
      {c.eyebrow ? <span className="still-eyebrow">{c.eyebrow}</span> : null}
      {c.lines ? (
        <div className="still-lines">
          {c.lines.map((line, i) => (
            <p
              key={i}
              className={`still-line${i === c.lines!.length - 1 ? " still-line--key" : ""}`}
            >
              {line}
            </p>
          ))}
        </div>
      ) : null}
      <h2 className={`still-canon${isLast ? " still-canon--wordmark" : ""}`}>{c.canon}</h2>
      {c.labels ? (
        <div className="still-labels">
          {c.labels.map((l) => (
            <span key={l} className="still-label">
              {l}
            </span>
          ))}
        </div>
      ) : null}
      {m.id === "M3" ? (
        <figure className="still-lens">
          <img
            src="/cinema/surface-still.webp"
            alt="The Cognitive Surface teaching 'Vector': a concept anchor, its definition lit by the narration, steering verbs, and the Thread of Understanding"
            loading="lazy"
            decoding="async"
          />
        </figure>
      ) : null}
      {c.gloss ? <p className="still-gloss">{c.gloss}</p> : null}
      {isFirst ? (
        <div className="still-cta-row">
          <button type="button" className="still-cta" onClick={onEnter}>
            Enter the surface <span aria-hidden>→</span>
          </button>
          <span className="still-scrollhint" aria-hidden>
            Scroll to begin ↓
          </span>
        </div>
      ) : null}
      {isLast ? (
        <div className="still-cta-row">
          <button type="button" className="still-cta still-cta--final" onClick={onEnter}>
            Enter the surface <span aria-hidden>→</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Landing({ onEnter }: LandingProps) {
  const [cinematic] = useState(() => !prefersReducedMotion() && hasWebGL());
  const stillRefs = useRef<(HTMLDivElement | null)[]>([]);
  const gradeRef = useRef<HTMLDivElement | null>(null);
  const spacerRef = useRef<HTMLDivElement | null>(null);
  // Documentary cinema beneath the transparent WebGL world: real public-domain imagery surfacing
  // at the movements it belongs to (the frontier's deep field at M5, civilization's lights at M6).
  const cinemaRefs = useRef<(HTMLImageElement | null)[]>([]);
  const CINEMA: readonly { movement: number; src: string; peak: number }[] = [
    { movement: 5, src: "/cinema/deep-field.webp", peak: 0.42 },
    { movement: 6, src: "/cinema/earth-night.webp", peak: 0.5 },
  ];

  useEffect(() => {
    if (!cinematic) return;
    let raf = 0;
    let last = performance.now();
    // The journey completes at the END OF THE SPACER, not the document — the footer that follows
    // adds scroll length without stretching the choreography.
    const maxScroll = () =>
      Math.max(
        1,
        (spacerRef.current?.offsetHeight ?? document.documentElement.scrollHeight) -
          window.innerHeight,
      );

    const onScroll = (): void => {
      journey.target = Math.max(0, Math.min(1, window.scrollY / maxScroll()));
    };
    const onPointer = (e: PointerEvent): void => {
      journey.px = (e.clientX / window.innerWidth - 0.5) * 2;
      journey.py = -(e.clientY / window.innerHeight - 0.5) * 2;
    };

    const loop = (now: number): void => {
      const dt = now - last;
      last = now;
      stepJourney(dt);
      const p = journey.current;
      for (let i = 0; i < stillRefs.current.length; i++) {
        const el = stillRefs.current[i];
        if (!el) continue;
        const o = stillOpacityAt(i, p);
        el.style.opacity = `${o}`;
        el.style.transform = `translateY(${(1 - o) * 20}px)`;
        el.style.pointerEvents = o > 0.6 ? "auto" : "none";
      }
      if (gradeRef.current) gradeRef.current.style.setProperty("--p", `${p}`);
      for (let c = 0; c < CINEMA.length; c++) {
        const img = cinemaRefs.current[c];
        const spec = CINEMA[c];
        if (img && spec) img.style.opacity = `${stillOpacityAt(spec.movement, p) * spec.peak}`;
      }
      raf = requestAnimationFrame(loop);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointer, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointer);
    };
  }, [cinematic]);

  const spacerStyle = useMemo(() => ({ height: `${JOURNEY_VH * 100}vh` }), []);

  // ── Static narrative (reduced-motion / no-WebGL): the whole story, readable, no canvas. ──
  if (!cinematic) {
    return (
      <div className="landing landing--static">
        <SiteNav onJourney />
        {MOVEMENTS.map((m, i) => (
          <section
            key={m.id}
            className="static-movement"
            style={{ ["--state-tint" as string]: m.hue }}
          >
            <MovementCopy index={i} onEnter={onEnter} />
          </section>
        ))}
        <SiteFooter />
      </div>
    );
  }

  // ── Cinematic journey. ──
  return (
    <div className="landing">
      <div className="landing-world" aria-hidden>
        {CINEMA.map((c, i) => (
          <img
            key={c.src}
            src={c.src}
            alt=""
            className="landing-cinema"
            loading="lazy"
            decoding="async"
            style={{ opacity: 0 }}
            ref={(el) => {
              cinemaRefs.current[i] = el;
            }}
          />
        ))}
        <Suspense fallback={null}>
          <World />
        </Suspense>
        <div className="landing-grade" ref={gradeRef} />
        <div className="landing-vignette" />
      </div>

      <SiteNav onJourney />

      {/* The fixed stage of still-points — one legible idea at a time, driven by the journey clock. */}
      <div className="landing-stage">
        {MOVEMENTS.map((m, i) => (
          <div
            key={m.id}
            className="still-point"
            data-movement={m.id}
            ref={(el) => {
              stillRefs.current[i] = el;
            }}
            style={{ opacity: i === 0 ? 1 : 0 }}
          >
            <MovementCopy index={i} onEnter={onEnter} />
          </div>
        ))}
      </div>

      {/* The scroll distance for the whole journey (the world + stage are fixed above it). */}
      <div className="landing-spacer" style={spacerStyle} aria-hidden ref={spacerRef} />

      {/* Past the journey's end, the world settles and the ecosystem opens. */}
      <div className="landing-after">
        <SiteFooter />
      </div>
    </div>
  );
}
