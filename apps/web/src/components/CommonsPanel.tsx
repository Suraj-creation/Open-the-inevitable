/**
 * CommonsPanel — the knowledge commons (ADR-0053): what peers have made and shared, for you to build
 * on. The payoff of the contribution loop (ADR-0051) — collective intelligence made tangible. Only
 * CONSENTED contributed creations appear (learner sovereignty), each attributed to its author. Attach
 * one to your surface and it becomes an ordinary bound source you can teach from and fuse with your
 * own. A thin fetch container over the pure `CommonsBody` so the projection stays testable.
 */
import { useEffect, useState } from "react";
import { attachSource, fetchCommons, type CommonsEntryView } from "../api";

export function CommonsPanel({
  surfaceId,
  open,
  onClose,
}: {
  readonly surfaceId: string;
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const [entries, setEntries] = useState<readonly CommonsEntryView[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "empty">("idle");
  const [attached, setAttached] = useState<Set<string>>(() => new Set());
  const [attaching, setAttaching] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStatus("loading");
    let live = true;
    void fetchCommons()
      .then((c) => {
        if (!live) return;
        setEntries(c);
        setStatus(c.length > 0 ? "ready" : "empty");
      })
      .catch(() => live && setStatus("empty"));
    return () => {
      live = false;
    };
  }, [open]);

  const onAttach = (versionId: string): void => {
    setAttaching(versionId);
    void attachSource(surfaceId, versionId)
      .then((ok) => {
        if (ok) setAttached((prev) => new Set(prev).add(versionId));
      })
      .finally(() => setAttaching(null));
  };

  if (!open) return null;
  return (
    <div className="frontier-overlay" role="dialog" aria-label="Knowledge commons">
      <button type="button" className="fused-scrim" onClick={onClose} aria-label="Close" />
      <div className="commons-panel">
        <header className="fused-head">
          <span className="fused-eyebrow commons-eyebrow">Built by learners, for learners</span>
          <h2 className="fused-title">The knowledge commons</h2>
          <button type="button" className="overlay-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        {status === "loading" ? <p className="fused-note">Reading the commons…</p> : null}
        {status === "empty" ? (
          <p className="fused-note">
            Nothing here yet. When a learner completes a creation and consents to share it, it
            appears here for everyone to build on.
          </p>
        ) : null}
        {status === "ready" ? (
          <CommonsBody
            entries={entries}
            attached={attached}
            attaching={attaching}
            onAttach={onAttach}
          />
        ) : null}
      </div>
    </div>
  );
}

/** The pure projection (testable without a network): attributed contributed creations + attach. */
export function CommonsBody({
  entries,
  attached,
  attaching,
  onAttach,
}: {
  readonly entries: readonly CommonsEntryView[];
  readonly attached: ReadonlySet<string>;
  readonly attaching: string | null;
  readonly onAttach: (versionId: string) => void;
}) {
  return (
    <div className="commons-body">
      <p className="frontier-provenance">
        {entries.length} shared {entries.length === 1 ? "creation" : "creations"} · consented +
        attributed — attach one to learn from it or fuse it with your own
      </p>
      <ul className="commons-list">
        {entries.map((e) => {
          const isAttached = attached.has(e.source_version_id);
          return (
            <li key={e.source_version_id} className="commons-entry">
              <div className="commons-entry-head">
                <span className="commons-entry-kind">{e.kind}</span>
                <h3 className="commons-entry-title">{e.title}</h3>
              </div>
              <p className="commons-entry-meta">
                by {e.author_cid ?? "an anonymous learner"}
                {e.concept_refs.length > 0 ? ` · ${e.concept_refs.join(", ")}` : ""}
              </p>
              <button
                type="button"
                className="commons-attach-btn"
                onClick={() => onAttach(e.source_version_id)}
                disabled={isAttached || attaching === e.source_version_id}
              >
                {isAttached
                  ? "✓ Attached"
                  : attaching === e.source_version_id
                    ? "Attaching…"
                    : "Attach to my surface"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
