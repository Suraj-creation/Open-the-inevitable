/**
 * SourceCognitionPanel — the source plane's reasoning made visible (CSE M12 T1; ADR-0050).
 *
 * "The runtime is the product; cognition becomes visible." This is the deep-transparency read of the
 * Cognitive Source Environment: what it built, doubted, grounded, and honestly degraded — layer
 * health (confidence + degraded), activity across the cognition families (claims, contradictions,
 * fusion, frontier, timeline, creation), the count of real D3 model calls, and a provenance-bearing
 * activity feed. Read-only (observation never mutates cognition). A thin fetch container over the pure
 * `SourceCognitionBody` so the projection stays testable without a network.
 */
import { useEffect, useState } from "react";
import { fetchSourceCognition, type SourceCognitionView } from "../api";

const ACTIVITY_LABELS: readonly {
  readonly key: keyof SourceCognitionView["activity"];
  readonly label: string;
}[] = [
  { key: "versions_registered", label: "Sources" },
  { key: "layers_constructed", label: "Layers built" },
  { key: "layers_degraded", label: "Layers degraded" },
  { key: "claims_recorded", label: "Claims" },
  { key: "contradictions_detected", label: "Contradictions" },
  { key: "fusions_composed", label: "Fusions" },
  { key: "syntheses", label: "Syntheses" },
  { key: "frontier_updates", label: "Frontier" },
  { key: "timeline_updates", label: "Timelines" },
  { key: "creations_started", label: "Creations" },
  { key: "creation_assists", label: "Assists" },
];

export function SourceCognitionPanel({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const [cognition, setCognition] = useState<SourceCognitionView | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "empty">("idle");

  useEffect(() => {
    if (!open) return;
    setStatus("loading");
    let live = true;
    void fetchSourceCognition()
      .then((c) => {
        if (!live) return;
        setCognition(c);
        setStatus(c && c.total_events > 0 ? "ready" : "empty");
      })
      .catch(() => live && setStatus("empty"));
    return () => {
      live = false;
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="frontier-overlay" role="dialog" aria-label="Source cognition">
      <button type="button" className="fused-scrim" onClick={onClose} aria-label="Close" />
      <div className="cognition-panel">
        <header className="fused-head">
          <span className="fused-eyebrow cognition-eyebrow">The runtime, made visible</span>
          <h2 className="fused-title">How the source environment reasoned</h2>
          <button type="button" className="overlay-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        {status === "loading" ? <p className="fused-note">Reading the source plane…</p> : null}
        {status === "empty" ? (
          <p className="fused-note">
            No source cognition yet — register a source or fuse, and its reasoning appears here,
            grounded and honest.
          </p>
        ) : null}
        {cognition && status === "ready" ? <SourceCognitionBody cognition={cognition} /> : null}
      </div>
    </div>
  );
}

/** The pure projection (testable without a network): activity tiles, layer health, and the feed. */
export function SourceCognitionBody({ cognition }: { readonly cognition: SourceCognitionView }) {
  return (
    <div className="cognition-body">
      <p className="frontier-provenance">
        {cognition.total_events} cognition events · {cognition.model_invocations} model calls (D3) ·{" "}
        {cognition.degraded_count} degraded — surfaced, never hidden
      </p>

      {cognition.cache.hits + cognition.cache.misses > 0 ? (
        <p className="cognition-cache">
          Cache: {cognition.cache.hits} hits / {cognition.cache.misses} misses ·{" "}
          {Math.round(cognition.cache.hit_rate * 100)}% hit rate — memoized cognition,
          replay-identical
        </p>
      ) : null}

      <ul className="cognition-tiles">
        {ACTIVITY_LABELS.map(({ key, label }) => (
          <li key={key} className="cognition-tile" data-empty={cognition.activity[key] === 0}>
            <span className="cognition-tile-count">{cognition.activity[key]}</span>
            <span className="cognition-tile-label">{label}</span>
          </li>
        ))}
      </ul>

      {cognition.layers.length > 0 ? (
        <section className="cognition-section">
          <h3 className="cognition-section-title">Layer health</h3>
          <ul className="cognition-layers">
            {cognition.layers.map((l) => (
              <li
                key={`${l.version_id}-${l.layer}`}
                className="cognition-layer"
                data-degraded={l.degraded}
              >
                <span className="cognition-layer-name">{l.layer}</span>
                <span className="cognition-layer-conf">{Math.round(l.confidence * 100)}%</span>
                {l.degraded ? <span className="cognition-layer-badge">degraded</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="cognition-section">
        <h3 className="cognition-section-title">Recent reasoning</h3>
        <ol className="cognition-feed">
          {cognition.recent.map((e, i) => (
            <li key={`${e.at}-${i}`} className="cognition-entry" data-degraded={e.degraded}>
              <span className="cognition-entry-producer">{e.producer_cid}</span>
              <span className="cognition-entry-summary">{e.summary}</span>
              {e.confidence !== null ? (
                <span className="cognition-entry-conf">{Math.round(e.confidence * 100)}%</span>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
