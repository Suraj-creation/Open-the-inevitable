import type { ReactNode } from "react";
import type { SceneVisual } from "./cinematic";
import { InstrumentVisual } from "./InstrumentVisual";

export function CinematicChapter({
  title,
  visual,
  children,
}: {
  readonly title: string;
  readonly visual: SceneVisual;
  readonly children: ReactNode;
}) {
  return (
    <section className="cinematic-chapter" data-cinematic-chapter data-visual={visual}>
      <div className="cinematic-chapter-copy">
        <h2 className="site-h2">{title}</h2>
        {children}
      </div>
      <InstrumentVisual visual={visual} />
    </section>
  );
}
