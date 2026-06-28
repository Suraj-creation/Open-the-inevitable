/**
 * EnsemblePanel — the cognitive ensemble made observable (S1.4). Shows the competing proposals
 * agents put forward (with confidence), any surfaced disagreement, and the arbiter's synthesis —
 * so the learner watches cognition contend and resolve, not just a finished answer. A pure
 * projection of state.proposals / disagreements / syntheses.
 */
import type {
  DisagreementRecord,
  ProposalRecord,
  SynthesisRecord,
} from "@inevitable/surface/client";
import { identityFor } from "../agents";

export interface EnsemblePanelProps {
  readonly proposals: readonly ProposalRecord[];
  readonly disagreements: readonly DisagreementRecord[];
  readonly syntheses: readonly SynthesisRecord[];
}

export function EnsemblePanel({ proposals, disagreements, syntheses }: EnsemblePanelProps) {
  if (proposals.length === 0 && syntheses.length === 0) return null;
  // Most recent proposals first; cap to keep the rail calm.
  const recent = [...proposals].slice(-6).reverse();
  const latestSynthesis = syntheses[syntheses.length - 1];
  const disagreed = disagreements.length > 0;

  return (
    <section className="ensemble" aria-label="Cognitive ensemble">
      <h2 className="rail-title">
        Ensemble
        {disagreed && <span className="ensemble-flag">disagreement</span>}
      </h2>

      <ul className="proposal-list">
        {recent.map((p) => {
          const id = identityFor(p.agent_id);
          const pct = Math.round(Math.max(0, Math.min(1, p.confidence)) * 100);
          return (
            <li key={p.proposal_id} className="proposal">
              <span className="proposal-sigil" style={{ color: id.accent }}>
                {id.sigil}
              </span>
              <span className="proposal-body">
                <span className="proposal-head">
                  <span className="proposal-agent">{id.label}</span>
                  <span className="proposal-conf">{pct}%</span>
                </span>
                <span className="proposal-bar" aria-hidden>
                  <span style={{ width: `${pct}%`, background: id.accent }} />
                </span>
                {p.summary && <span className="proposal-summary">{p.summary}</span>}
              </span>
            </li>
          );
        })}
      </ul>

      {latestSynthesis && (
        <p className="synthesis" aria-live="polite">
          <span className="synthesis-mark" aria-hidden>
            ⟁
          </span>
          {latestSynthesis.rationale}
        </p>
      )}
    </section>
  );
}
