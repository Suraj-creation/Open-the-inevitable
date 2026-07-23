/**
 * FusedView — many sources reconciled into one understanding (CSE M9 T1; CSE-015).
 *
 * When ≥2 sources are bound, the learner can fuse the current concepts: a per-concept coverage map
 * across sources, corroboration where they overlap, each source's distinct emphasis, and honest
 * gaps where no source covers a concept. Fusion never blurs provenance — every treatment names its
 * source. On-demand (progressive, attention-driven — CSE-015 §4); a thin fetch container over the
 * pure `FusedViewPanel` so the projection is testable without a network.
 */
import { useState } from "react";
import { fuseSources, type FusionView } from "../api";

export function FusedView({
  surfaceId,
  conceptRefs,
  open,
  onClose,
}: {
  readonly surfaceId: string;
  readonly conceptRefs: readonly string[];
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const [fusion, setFusion] = useState<FusionView | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "empty">("idle");

  const run = (): void => {
    if (conceptRefs.length === 0) {
      setStatus("empty");
      return;
    }
    setStatus("loading");
    void fuseSources(surfaceId, conceptRefs)
      .then((f) => {
        setFusion(f);
        setStatus(f && f.concepts.length > 0 ? "ready" : "empty");
      })
      .catch(() => setStatus("empty"));
  };

  if (!open) return null;
  return (
    <div className="fused-overlay" role="dialog" aria-label="Fused understanding">
      <button type="button" className="fused-scrim" onClick={onClose} aria-label="Close" />
      <div className="fused-panel">
        <header className="fused-head">
          <span className="fused-eyebrow">Source Fusion</span>
          <h2 className="fused-title">One understanding, from every source</h2>
          <button type="button" className="overlay-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        {status === "idle" ? (
          <button type="button" className="fused-run" onClick={run}>
            Reconcile {conceptRefs.length} concept{conceptRefs.length === 1 ? "" : "s"} across your
            sources →
          </button>
        ) : null}
        {status === "loading" ? <p className="fused-note">Reconciling your sources…</p> : null}
        {status === "empty" ? (
          <p className="fused-note">
            Nothing to fuse yet — bind at least two sources that overlap.
          </p>
        ) : null}
        {fusion ? <FusedViewPanel fusion={fusion} /> : null}
      </div>
    </div>
  );
}

/** The pure projection (testable without a network). Corroboration + coverage + honest gaps. */
export function FusedViewPanel({ fusion }: { readonly fusion: FusionView }) {
  return (
    <div className="fused-body">
      {fusion.concepts.map((c) => {
        const covering = c.source_treatments.filter((t) => t.coverage !== "absent");
        const titleOf = (sid: string): string =>
          c.source_treatments.find((t) => t.source_version_id === sid)?.title ?? sid;
        const claimById = new Map((c.claims ?? []).map((cl) => [cl.claim_id, cl]));
        return (
          <section key={c.concept_ref} className="fused-concept" aria-label={c.concept_ref}>
            <div className="fused-concept-head">
              <h3 className="fused-concept-name">{c.concept_ref}</h3>
              {c.reconciliation.corroborated ? (
                <span className="fused-badge fused-badge--corroborated">
                  corroborated · {covering.length} sources
                </span>
              ) : (
                <span className="fused-badge">{covering.length} source</span>
              )}
              <span className="fused-confidence">{Math.round(c.confidence * 100)}%</span>
            </div>
            {c.synthesis ? (
              <div
                className="fused-synthesis"
                data-degraded={c.synthesis.degraded}
                aria-label="Fused explanation"
              >
                <p className="fused-synthesis-prose">{c.synthesis.prose}</p>
                <p className="fused-synthesis-meta">
                  woven from {c.synthesis.cited_source_ids.length} source
                  {c.synthesis.cited_source_ids.length === 1 ? "" : "s"}
                  {c.synthesis.acknowledges_disagreement ? " · surfaces a disagreement" : ""}
                  {c.synthesis.degraded ? " · alignment view (model unavailable)" : ""}
                </p>
              </div>
            ) : null}
            <ul className="fused-treatments">
              {c.source_treatments.map((t) => (
                <li
                  key={t.source_version_id}
                  className="fused-treatment"
                  data-coverage={t.coverage}
                >
                  <span className="fused-treatment-source">{t.title}</span>
                  <span className="fused-treatment-emphasis">{t.emphasis}</span>
                  <span className="fused-treatment-coverage">{t.coverage}</span>
                  {t.quote ? <p className="fused-treatment-quote">{t.quote}</p> : null}
                </li>
              ))}
            </ul>
            {c.claims && c.claims.length > 0 ? (
              <div className="fused-claims" aria-label="What each source claims">
                <h4 className="fused-claims-title">What each source claims</h4>
                <ul className="fused-claim-list">
                  {c.claims.map((cl) => (
                    <li key={cl.claim_id} className="fused-claim">
                      <span className="fused-claim-source">{titleOf(cl.source_version_id)}</span>
                      <span className="fused-claim-status" data-status={cl.epistemic_status}>
                        {cl.epistemic_status}
                      </span>
                      <p className="fused-claim-statement">{cl.statement}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {c.reconciliation.contradictions.length > 0 ? (
              <div className="fused-contradictions" aria-label="Cross-source disagreements">
                <h4 className="fused-contradictions-title">
                  Where the sources disagree — {c.reconciliation.contradictions.length}
                </h4>
                {c.reconciliation.contradictions.map((x, i) => {
                  const [a, b] = x.claim_ids;
                  const ca = a ? claimById.get(a) : undefined;
                  const cb = b ? claimById.get(b) : undefined;
                  return (
                    <div key={`${x.claim_ids.join("|")}-${i}`} className="fused-contradiction">
                      <span className="fused-nature" data-nature={x.nature}>
                        {x.nature}
                      </span>
                      {ca && cb ? (
                        <div className="fused-contradiction-pair">
                          <p className="fused-contradiction-side">
                            <strong>{titleOf(ca.source_version_id)}:</strong> {ca.statement}
                          </p>
                          <span className="fused-versus">vs</span>
                          <p className="fused-contradiction-side">
                            <strong>{titleOf(cb.source_version_id)}:</strong> {cb.statement}
                          </p>
                        </div>
                      ) : null}
                      {x.rationale ? <p className="fused-rationale">{x.rationale}</p> : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}
      {fusion.gaps.length > 0 ? (
        <section className="fused-gaps" aria-label="Coverage gaps">
          <h3 className="fused-section-title">Not covered by any source</h3>
          <p className="fused-gap-list">
            {fusion.gaps.map((g) => (
              <span key={g.concept_ref} className="fused-gap-chip">
                {g.concept_ref}
              </span>
            ))}
          </p>
        </section>
      ) : null}
    </div>
  );
}
