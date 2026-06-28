/**
 * EducatorOverlay — the educator analytics lens over a live surface.
 *
 * Renders when mode === "educator". Surfaces what the learner actually did and how the
 * cognitive evaluation layer scored each cycle: evaluation records (scorecard pass/fail +
 * dimension breakdown), depth-gate test results, agent routing decisions, and contribution
 * provenance. All data is read from SurfaceState — no new state, no new requests.
 *
 * Spec: spec/implementation-roadmaps/cognitive-surface-maturity.md S4.3.
 */
import type { DepthGateRecord, EvaluationRecord, SurfaceState } from "@inevitable/surface/client";

interface EvalCardProps {
  readonly record: EvaluationRecord;
}

function EvalCard({ record }: EvalCardProps) {
  const pct = Math.round(record.score * 100);
  return (
    <div
      className={`edu-eval-card${record.passed ? " edu-eval-card--pass" : " edu-eval-card--fail"}`}
    >
      <div className="edu-eval-header">
        <span className="edu-eval-concept">{record.concept_id}</span>
        <span
          className={`edu-eval-badge${record.passed ? " edu-eval-badge--pass" : " edu-eval-badge--fail"}`}
        >
          {record.passed ? "PASS" : "FAIL"} {pct}%
        </span>
      </div>
      <div className="edu-eval-scorecard">{record.scorecard_id}</div>
      <ul className="edu-eval-dims">
        {record.dimension_scores.map((d) => (
          <li key={d.name} className="edu-eval-dim">
            <span className="edu-eval-dim-name">{d.name}</span>
            <span className={`edu-eval-dim-score${d.passed ? " edu--pass" : " edu--fail"}`}>
              {Math.round(d.score * 100)}%
            </span>
            <span className="edu-eval-dim-evidence">{d.evidence}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface GateCardProps {
  readonly record: DepthGateRecord;
}

function GateCard({ record }: GateCardProps) {
  return (
    <div
      className={`edu-gate-card${record.passed ? " edu-gate-card--pass" : " edu-gate-card--fail"}`}
    >
      <div className="edu-gate-header">
        <span className="edu-gate-concept">{record.concept_id}</span>
        <span className="edu-gate-count">
          {record.passed_count}/{record.total_count} tests passed
        </span>
      </div>
      <ul className="edu-gate-tests">
        {record.tests.map((t, i) => (
          <li key={i} className={`edu-gate-test${t.passed ? " edu--pass" : " edu--fail"}`}>
            <span className="edu-gate-test-kind">{t.kind}</span>
            <span className="edu-gate-test-conf">{Math.round(t.confidence * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface EducatorOverlayProps {
  readonly state: SurfaceState;
}

export function EducatorOverlay({ state }: EducatorOverlayProps) {
  const hasEvals = state.evaluation_records.length > 0;
  const hasGates = state.depth_gates.length > 0;
  const hasRouting = state.routing_decisions.length > 0;

  return (
    <aside className="edu-overlay" aria-label="Educator analytics">
      <div className="edu-overlay-header">
        <span className="edu-overlay-eyebrow">Educator view</span>
        <span className="edu-overlay-mode">mode: educator</span>
      </div>

      {hasEvals && (
        <section className="edu-section">
          <h3 className="edu-section-title">Evaluation records</h3>
          <div className="edu-eval-list">
            {state.evaluation_records.map((r, i) => (
              <EvalCard key={`${r.concept_id}-${i}`} record={r} />
            ))}
          </div>
        </section>
      )}

      {hasGates && (
        <section className="edu-section">
          <h3 className="edu-section-title">Depth-gate breakdown</h3>
          <div className="edu-gate-list">
            {state.depth_gates.map((g, i) => (
              <GateCard key={`${g.concept_id}-${i}`} record={g} />
            ))}
          </div>
        </section>
      )}

      {hasRouting && (
        <section className="edu-section">
          <h3 className="edu-section-title">Agent routing</h3>
          <ul className="edu-routing-list">
            {state.routing_decisions.map((r, i) => (
              <li key={i} className="edu-routing-item">
                <span className="edu-routing-agent">{r.target_agent}</span>
                <span className="edu-routing-concept">{r.concept_id}</span>
                <span className="edu-routing-reason">{r.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {state.contributions.length > 0 && (
        <section className="edu-section">
          <h3 className="edu-section-title">Agent contributions</h3>
          <ul className="edu-contrib-list">
            {state.contributions.map((c, i) => (
              <li key={i} className="edu-contrib-item">
                <span className="edu-contrib-agent">{c.agent_id}</span>
                <span className="edu-contrib-blocks">{c.block_ids.length} block(s)</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!hasEvals && !hasGates && !hasRouting && (
        <p className="edu-empty">Waiting for the first cognitive cycle…</p>
      )}
    </aside>
  );
}
