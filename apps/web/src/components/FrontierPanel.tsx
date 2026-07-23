/**
 * FrontierPanel — the living-knowledge overlay (CSE M9 Frontier T1; CSE-006 §3.2).
 *
 * On demand, connects the concept the learner is studying to the current edge of its field — latest
 * research, open questions, competing theories, future directions — each grounded in a real,
 * clickable citation. The source stays sacred: the frontier renders in its OWN reserved provenance
 * channel (CDL research state), never annotating over evidence. Honest by construction — when no
 * citable frontier is found, it says so (never a fabricated edge). A thin fetch container over the
 * pure `FrontierPanelBody` so the projection is testable without a network.
 */
import { useState } from "react";
import { researchFrontier, type FrontierView } from "../api";

const KIND_LABEL: Record<string, string> = {
  "latest-research": "Latest research",
  practice: "In practice",
  "alternative-explanation": "Alternative view",
  "open-question": "Open question",
  "competing-theory": "Competing theory",
  interdisciplinary: "Interdisciplinary",
  "future-direction": "Future direction",
};

export function FrontierPanel({
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
  const [frontier, setFrontier] = useState<FrontierView | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "empty">("idle");

  const run = (): void => {
    if (!conceptRef) {
      setStatus("empty");
      return;
    }
    setStatus("loading");
    void researchFrontier(surfaceId, conceptRef)
      .then((f) => {
        setFrontier(f);
        setStatus(f && f.entries.length > 0 ? "ready" : "empty");
      })
      .catch(() => setStatus("empty"));
  };

  if (!open) return null;
  return (
    <div className="frontier-overlay" role="dialog" aria-label="Living knowledge frontier">
      <button type="button" className="fused-scrim" onClick={onClose} aria-label="Close" />
      <div className="frontier-panel">
        <header className="fused-head">
          <span className="fused-eyebrow frontier-eyebrow">Living knowledge</span>
          <h2 className="fused-title">The frontier of {conceptTitle}</h2>
          <button type="button" className="overlay-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        {status === "idle" ? (
          <button type="button" className="fused-run" onClick={run}>
            Research the current frontier of {conceptTitle} on the web →
          </button>
        ) : null}
        {status === "loading" ? (
          <p className="fused-note">
            Searching the frontier — grounding every point in a real source…
          </p>
        ) : null}
        {status === "empty" ? (
          <p className="fused-note">
            No citable frontier found for this concept — nothing is shown rather than an ungrounded
            guess.
          </p>
        ) : null}
        {frontier && frontier.entries.length > 0 ? <FrontierPanelBody frontier={frontier} /> : null}
      </div>
    </div>
  );
}

/** The pure projection (testable without a network). Entries by kind, each with real citations. */
export function FrontierPanelBody({ frontier }: { readonly frontier: FrontierView }) {
  return (
    <div className="frontier-body">
      <p className="frontier-provenance">
        Frontier overlay · the source stays sacred — this is the living edge, in its own channel
      </p>
      <ul className="frontier-entries">
        {frontier.entries.map((e, i) => (
          <li key={`${e.kind}-${i}`} className="frontier-entry" data-kind={e.kind}>
            <span className="frontier-kind">{KIND_LABEL[e.kind] ?? e.kind}</span>
            <p className="frontier-summary">{e.summary}</p>
            {e.external_refs.length > 0 ? (
              <p className="frontier-refs">
                {e.external_refs.map((r, j) => (
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
          </li>
        ))}
      </ul>
    </div>
  );
}
