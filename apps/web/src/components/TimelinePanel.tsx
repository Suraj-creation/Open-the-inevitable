/**
 * TimelinePanel — the Temporal Knowledge Model (CSE M9 TKM T1; CSE-006 §3.3).
 *
 * On demand, traces the concept the learner is studying through time — origin, milestones, paradigm
 * shifts, current debate, open problems — as an ordered vertical strip, each state grounded in a
 * real, clickable citation. Honestly sparse: a niche concept shows a short strip, never padded
 * history (CSE-006 §8). Renders in the reserved research channel (the source stays sacred). A thin
 * fetch container over the pure `TimelineBody` so the projection is testable without a network.
 */
import { useState } from "react";
import { researchTimeline, type TimelineView } from "../api";

const KIND_LABEL: Record<string, string> = {
  origin: "Origin",
  milestone: "Milestone",
  shift: "Paradigm shift",
  "current-debate": "Current debate",
  "open-problem": "Open problem",
};

export function TimelinePanel({
  surfaceId,
  conceptRef,
  conceptTitle,
  open,
  onClose,
}: {
  readonly surfaceId: string;
  readonly conceptRef: string;
  readonly conceptTitle: string;
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const [timeline, setTimeline] = useState<TimelineView | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "empty">("idle");

  const run = (): void => {
    if (!conceptRef) {
      setStatus("empty");
      return;
    }
    setStatus("loading");
    void researchTimeline(surfaceId, conceptRef)
      .then((t) => {
        setTimeline(t);
        setStatus(t && t.states.length > 0 ? "ready" : "empty");
      })
      .catch(() => setStatus("empty"));
  };

  if (!open) return null;
  return (
    <div className="frontier-overlay" role="dialog" aria-label="Concept timeline">
      <button type="button" className="fused-scrim" onClick={onClose} aria-label="Close" />
      <div className="frontier-panel">
        <header className="fused-head">
          <span className="fused-eyebrow frontier-eyebrow">Through time</span>
          <h2 className="fused-title">The trajectory of {conceptTitle}</h2>
          <button type="button" className="overlay-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        {status === "idle" ? (
          <button type="button" className="fused-run" onClick={run}>
            Trace {conceptTitle} through time — origin to open problems →
          </button>
        ) : null}
        {status === "loading" ? (
          <p className="fused-note">
            Tracing the concept's history — grounding every point in a real source…
          </p>
        ) : null}
        {status === "empty" ? (
          <p className="fused-note">
            No citable history found for this concept — a short or empty strip is shown, never a
            padded timeline.
          </p>
        ) : null}
        {timeline && timeline.states.length > 0 ? <TimelineBody timeline={timeline} /> : null}
      </div>
    </div>
  );
}

/** The pure projection (testable without a network). Ordered states with eras + real citations. */
export function TimelineBody({ timeline }: { readonly timeline: TimelineView }) {
  return (
    <div className="timeline-body">
      <p className="frontier-provenance">
        Temporal overlay · the concept through time, grounded — honestly sparse where the record
        thins
      </p>
      <ol className="timeline-states">
        {timeline.states.map((s, i) => (
          <li key={`${s.kind}-${i}`} className="timeline-state" data-kind={s.kind}>
            <div className="timeline-marker" aria-hidden />
            <div className="timeline-state-body">
              <div className="timeline-state-head">
                {s.era ? <span className="timeline-era">{s.era}</span> : null}
                <span className="timeline-kind">{KIND_LABEL[s.kind] ?? s.kind}</span>
              </div>
              <p className="timeline-label">{s.label}</p>
              <p className="timeline-summary">{s.summary}</p>
              {s.external_refs.length > 0 ? (
                <p className="frontier-refs">
                  {s.external_refs.map((r, j) => (
                    <a
                      key={r.uri}
                      className="frontier-ref"
                      href={r.uri}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {r.title || `source ${j + 1}`}
                    </a>
                  ))}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
