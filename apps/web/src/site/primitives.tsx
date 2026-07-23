/**
 * Site primitives — the CDL composition vocabulary for the public ecosystem pages. Every element
 * states its role (Canon/Gloss/Working/Whisper type; glass tiers; state light) and inherits the
 * token layer; pages compose these, never raw styles. Reveal-on-approach implements the CDL
 * `materialize` verb at structural amplitude (IntersectionObserver + CSS, reduced-motion safe).
 */
import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";

/** Reveal — children materialize when they enter the viewport (once; reduced-motion = instant). */
export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
}: {
  readonly children: ReactNode;
  readonly delay?: number;
  readonly as?: "div" | "section" | "figure" | "li";
  readonly className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.dataset["revealed"] = "true";
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.dataset["revealed"] = "true";
            io.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag
      // @ts-expect-error — polymorphic ref narrows awkwardly; the element is always an HTMLElement.
      ref={ref}
      className={`site-reveal ${className}`}
      data-revealed="false"
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}

/** PageHero — the page's still point: eyebrow whisper, Canon headline, Gloss lede. */
export function PageHero({
  eyebrow,
  canon,
  gloss,
  children,
}: {
  readonly eyebrow: string;
  readonly canon: ReactNode;
  readonly gloss?: ReactNode;
  readonly children?: ReactNode;
}) {
  return (
    <header className="page-hero">
      <Reveal>
        <span className="site-eyebrow">{eyebrow}</span>
      </Reveal>
      <Reveal delay={80}>
        <h1 className="site-canon">{canon}</h1>
      </Reveal>
      {gloss ? (
        <Reveal delay={160}>
          <p className="site-gloss site-gloss--lede">{gloss}</p>
        </Reveal>
      ) : null}
      {children}
    </header>
  );
}

/** Section — one idea per region: whisper kicker, Canon-scale heading, then composed content. */
export function Section({
  kicker,
  title,
  children,
  wide = false,
}: {
  readonly kicker?: string;
  readonly title?: ReactNode;
  readonly children: ReactNode;
  readonly wide?: boolean;
}) {
  return (
    <section className={`site-section${wide ? " site-section--wide" : ""}`}>
      {kicker ? (
        <Reveal>
          <span className="site-eyebrow">{kicker}</span>
        </Reveal>
      ) : null}
      {title ? (
        <Reveal delay={60}>
          <h2 className="site-h2">{title}</h2>
        </Reveal>
      ) : null}
      {children}
    </section>
  );
}

/** GlassCard — a quiet P3/P5 card for supporting ideas. */
export function GlassCard({
  title,
  children,
  hue,
}: {
  readonly title?: ReactNode;
  readonly children: ReactNode;
  readonly hue?: string;
}) {
  return (
    <div className="site-card" style={hue ? { ["--state-tint" as string]: hue } : undefined}>
      {title ? <h3 className="site-card-title">{title}</h3> : null}
      <div className="site-card-body">{children}</div>
    </div>
  );
}

/** Quote — a manifesto line given room to breathe (Canon voice, state edge-light). */
export function Quote({
  children,
  source,
}: {
  readonly children: ReactNode;
  readonly source?: string;
}) {
  return (
    <Reveal as="figure" className="site-quote-wrap">
      <blockquote className="site-quote">{children}</blockquote>
      {source ? <figcaption className="site-quote-source">{source}</figcaption> : null}
    </Reveal>
  );
}

/** NextStep — the ecosystem is one continuous journey: every page ends by opening the next. */
export function NextStep({
  to,
  title,
  cta,
}: {
  readonly to: string;
  readonly title: string;
  readonly cta: string;
}) {
  return (
    <Reveal className="site-next-wrap">
      <div className="site-next">
        <p className="site-next-title">{title}</p>
        <Link to={to} className="site-enter">
          {cta} <span aria-hidden>→</span>
        </Link>
      </div>
    </Reveal>
  );
}

/** LensFigure — a real product image framed in lens glass (the landing's material, reused). */
export function LensFigure({
  src,
  alt,
  caption,
}: {
  readonly src: string;
  readonly alt: string;
  readonly caption?: string;
}) {
  return (
    <Reveal as="figure" className="site-lens">
      <img src={src} alt={alt} loading="lazy" decoding="async" />
      {caption ? <figcaption className="site-lens-cap">{caption}</figcaption> : null}
    </Reveal>
  );
}
