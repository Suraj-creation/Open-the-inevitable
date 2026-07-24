/**
 * EpisodesPanel — the session's learning arc, made visible (R5, ADR-0061). Each episode is one
 * concept's teaching arc (the surfaced frames, the pedagogical roles it moved through, and its
 * mastery outcome). A pure projection over folded state via `deriveEpisodes` — it owns no truth.
 * The episode containing the frame being voiced is marked current (the resume anchor).
 */
import { deriveEpisodes, type SurfaceState } from "@inevitable/surface/client";

const ARC_LABEL: Record<string, string> = {
  teach: "taught",
  practice: "practiced",
  assessment: "assessed",
  checkpoint: "checkpoint",
};

export function EpisodesPanel({
  state,
  activeFrameId = null,
}: {
  readonly state: SurfaceState | null;
  readonly activeFrameId?: string | null;
}) {
  const episodes = deriveEpisodes(state);
  return (
    <section className="episodes-panel" aria-label="Session episodes">
      <h2 className="rail-title">Episodes</h2>
      {episodes.length === 0 ? (
        <p className="episodes-empty">
          No episodes yet — this session's arc begins with the first lesson.
        </p>
      ) : (
        <ol className="episodes-list">
          {episodes.map((ep) => {
            const current = activeFrameId ? ep.frame_ids.includes(activeFrameId) : false;
            return (
              <li
                key={ep.episode_id}
                className="episode"
                data-status={ep.status}
                {...(current ? { "data-current": "true" } : {})}
              >
                <span className="episode-title">{ep.title}</span>
                <span className="episode-arc">
                  {ep.arc.map((k) => ARC_LABEL[k] ?? k).join(" → ")}
                </span>
                <span className="episode-status" data-status={ep.status}>
                  {ep.status === "mastered"
                    ? `mastered${ep.confidence != null ? ` · ${Math.round(ep.confidence * 100)}%` : ""}`
                    : "in progress"}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
