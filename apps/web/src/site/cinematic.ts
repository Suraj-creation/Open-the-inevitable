/**
 * The vocabulary of cinematic scenes for the public site's narrative chapters. Each value names a
 * beat in the story the landing pages tell; `InstrumentVisual` maps it to a decorative mark field and
 * `CinematicChapter` carries it on `data-visual` for CDL-driven styling. This is the closed set — the
 * union both components type against (the module they import as `./cinematic`).
 */
export type SceneVisual =
  | "field"
  | "ascent"
  | "constitution"
  | "surface"
  | "sources"
  | "topology"
  | "frontier"
  | "timeline"
  | "settle";
