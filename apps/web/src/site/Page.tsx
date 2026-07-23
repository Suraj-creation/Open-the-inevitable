/**
 * Page — the scaffold every ecosystem page inherits (CDL: one universe). Sets the document title +
 * meta description, grades the room with the page's cognitive-state hue, keeps the living
 * substrate present at ambient amplitude (Ambient canvas), restores scroll on route change, and
 * composes SiteNav + content + SiteFooter. Pages state their hue; they never set raw color.
 */
import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Ambient } from "./Ambient";
import { Cinema } from "./Cinema";
import { SiteFooter } from "./SiteFooter";
import { SiteNav } from "./SiteNav";

export function Page({
  title,
  description,
  hue = "#57c9de",
  seed = 7,
  cinema,
  cinemaPosition,
  children,
}: {
  readonly title: string;
  readonly description: string;
  /** The page's cognitive-state hue — grades the ambient light and state accents. */
  readonly hue?: string;
  readonly seed?: number;
  /** Documentary imagery for the page's deep field (public-domain, graded to the DNA). */
  readonly cinema?: string;
  readonly cinemaPosition?: string;
  readonly children: ReactNode;
}) {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = `${title} — The Inevitable`;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = description;
  }, [title, description]);

  // Arriving somewhere new in the world starts at its threshold.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="site-page" style={{ ["--state-tint" as string]: hue }}>
      <div className="site-field" aria-hidden>
        {cinema ? (
          <Cinema src={cinema} {...(cinemaPosition ? { position: cinemaPosition } : {})} />
        ) : null}
        <Ambient hue={hue} seed={seed} />
        <div className="site-field-grade" />
      </div>
      <SiteNav />
      <main className="site-main">{children}</main>
      <SiteFooter />
    </div>
  );
}
