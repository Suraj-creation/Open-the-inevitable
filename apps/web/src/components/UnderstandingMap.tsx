/**
 * UnderstandingMap — the learner's own mind made legible (CSE M6; CSE-005 §3.4, ADR-0037).
 *
 * A read-side projection over the learner's intelligence plane: episodes (units of lived
 * learning) and understanding deltas (what each session did to this mind), fetched from
 * `GET /api/learner/:id/understanding` (bearer-authed; this route IS the disclosure — nothing
 * here is covertly scored). Renders EVIDENCE, never a score: concepts touched per episode,
 * mastery movements, confusions opened/resolved, and blind spots (path concepts never engaged).
 * Pure view + thin fetch container, so the projection is testable without a network.
 */
import { useEffect, useState } from "react";
import type { SurfaceState } from "@inevitable/surface/client";

export interface EpisodeView {
  readonly artifact_id: string;
  readonly concept_refs?: readonly string[];
  readonly confusions?: readonly { description?: string; concept_ref?: string; state?: string }[];
  readonly outcome?: { summary?: string };
}

export interface DeltaView {
  readonly artifact_id: string;
  readonly concepts_touched?: readonly string[];
  readonly mastery_movements?: readonly { concept_ref?: string; direction?: string }[];
  readonly confusions_opened?: readonly string[];
  readonly confusions_resolved?: readonly string[];
}

export interface UnderstandingData {
  readonly episodes: readonly EpisodeView[];
  readonly deltas: readonly DeltaView[];
}

/** The learner credential persisted by api.ts (the same key; read-only here). */
function readCredential(): { learnerId: string; apiKey: string } | null {
  try {
    const raw = globalThis.localStorage?.getItem("inevitable.learner");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { learnerId?: string; apiKey?: string };
    return parsed.learnerId && parsed.apiKey
      ? { learnerId: parsed.learnerId, apiKey: parsed.apiKey }
      : null;
  } catch {
    return null;
  }
}

export function UnderstandingMap({
  open,
  onClose,
  state,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly state: SurfaceState | null;
}) {
  const [data, setData] = useState<UnderstandingData | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");

  useEffect(() => {
    if (!open || data) return;
    const cred = readCredential();
    if (!cred) {
      setStatus("unavailable");
      return;
    }
    setStatus("loading");
    let cancelled = false;
    void fetch(`/api/learner/${cred.learnerId}/understanding`, {
      headers: { Authorization: `Bearer ${cred.apiKey}` },
    })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setStatus("unavailable");
          return;
        }
        const json = (await res.json()) as UnderstandingData;
        setData({ episodes: json.episodes ?? [], deltas: json.deltas ?? [] });
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("unavailable"));
    return () => {
      cancelled = true;
    };
  }, [open, data]);

  if (!open) return null;
  return (
    <div className="umap-overlay" role="dialog" aria-label="Your understanding map">
      <button type="button" className="umap-scrim" onClick={onClose} aria-label="Close" />
      <div className="umap-panel">
        <header className="umap-head">
          <span className="umap-eyebrow">Understanding Map</span>
          <h2 className="umap-title">How your understanding is forming</h2>
          <button type="button" className="overlay-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        {status === "loading" ? <p className="umap-note">Reading your episodes…</p> : null}
        {status === "unavailable" ? (
          <p className="umap-note">
            Nothing distilled yet — finish a session and your episodes will appear here.
          </p>
        ) : null}
        {data ? <UnderstandingMapView data={data} state={state} /> : null}
      </div>
    </div>
  );
}

/** The pure projection (testable without a network). Evidence, never a score. */
export function UnderstandingMapView({
  data,
  state,
}: {
  readonly data: UnderstandingData;
  readonly state: SurfaceState | null;
}) {
  const touched = new Set(
    data.episodes.flatMap((e) => [...(e.concept_refs ?? [])]).map((c) => c.toLowerCase()),
  );
  const timelineNodes = state?.timeline?.nodes ?? [];
  // Blind spots: concepts on the learner's path never engaged in ANY episode (CSE-005 §3.4).
  const blindSpots = timelineNodes.filter((n) => !touched.has(n.concept_id.toLowerCase()));
  const movements = data.deltas.flatMap((d) => [...(d.mastery_movements ?? [])]);
  const advanced = movements.filter((m) => m.direction === "advanced");
  const opened = data.deltas.flatMap((d) => [...(d.confusions_opened ?? [])]);
  const resolved = data.deltas.flatMap((d) => [...(d.confusions_resolved ?? [])]);

  return (
    <div className="umap-body">
      <section className="umap-section" aria-label="Episodes">
        <h3 className="umap-section-title">Episodes — units of lived learning</h3>
        {data.episodes.length === 0 ? (
          <p className="umap-note">No episodes yet.</p>
        ) : (
          <ol className="umap-episodes">
            {data.episodes.map((e) => (
              <li key={e.artifact_id} className="umap-episode">
                <p className="umap-episode-summary">{e.outcome?.summary ?? "session"}</p>
                <p className="umap-episode-concepts">
                  {(e.concept_refs ?? []).map((c) => (
                    <span key={c} className="umap-chip">
                      {c}
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="umap-section" aria-label="Movements">
        <h3 className="umap-section-title">What moved</h3>
        <p className="umap-stat">
          <strong>{advanced.length}</strong> mastery advance{advanced.length === 1 ? "" : "s"}
          {advanced.length > 0 ? (
            <span className="umap-stat-detail">
              {" "}
              — {[...new Set(advanced.map((m) => m.concept_ref ?? ""))].join(", ")}
            </span>
          ) : null}
        </p>
        <p className="umap-stat">
          <strong>{resolved.length}</strong> confusion{resolved.length === 1 ? "" : "s"} resolved,{" "}
          <strong>{opened.length}</strong> still open
          {opened.length > 0 ? (
            <span className="umap-stat-detail"> — {[...new Set(opened)].join(", ")}</span>
          ) : null}
        </p>
      </section>

      {blindSpots.length > 0 ? (
        <section className="umap-section" aria-label="Blind spots">
          <h3 className="umap-section-title">Blind spots — on your path, not yet engaged</h3>
          <p className="umap-episode-concepts">
            {blindSpots.map((n) => (
              <span key={n.concept_id} className="umap-chip umap-chip--blind">
                {n.title}
              </span>
            ))}
          </p>
        </section>
      ) : null}
    </div>
  );
}
