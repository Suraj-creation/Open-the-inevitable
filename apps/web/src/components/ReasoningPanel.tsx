/**
 * ReasoningPanel — the Observatory's window into *how* each agent reasoned (S-UCS, ADR-0029). For
 * every surfaced reasoning summary it shows the agent, strategy, decision, self-critique, confidence,
 * determinism level, and real latency (joined by work_id to the work-timing records). A pure projection
 * of state.agent_reasoning / agent_work_timings — nothing important about the reasoning stays hidden.
 */
import type { AgentReasoningRecord, AgentWorkTimingRecord } from "@inevitable/surface/client";
import { identityFor } from "../agents";

export interface ReasoningPanelProps {
  readonly reasoning: readonly AgentReasoningRecord[];
  readonly timings: readonly AgentWorkTimingRecord[];
}

export function ReasoningPanel({ reasoning, timings }: ReasoningPanelProps) {
  if (reasoning.length === 0) return null;
  const latencyByWork = new Map(timings.map((t) => [t.work_id, t.execution_ms] as const));
  // Most recent first; cap to keep the overlay calm.
  const recent = [...reasoning].slice(-8).reverse();

  return (
    <section className="reasoning-panel" aria-label="Agent reasoning">
      <h2 className="rail-title">Reasoning</h2>
      <ul className="reasoning-list">
        {recent.map((r, i) => {
          const id = identityFor(r.agent_id);
          const ms = r.work_id ? latencyByWork.get(r.work_id) : null;
          const pct = Math.round(Math.max(0, Math.min(1, r.confidence)) * 100);
          return (
            <li key={r.work_id ?? r.packet_id ?? `r-${i}`} className="reasoning-item">
              <div className="reasoning-head">
                <span className="reasoning-sigil" style={{ color: id.accent }}>
                  {id.sigil}
                </span>
                <span className="reasoning-agent">{id.label}</span>
                <span className="reasoning-strategy">{r.strategy}</span>
                <span className="reasoning-spacer" />
                {typeof ms === "number" && ms > 0 ? (
                  <span className="reasoning-latency">{ms}ms</span>
                ) : null}
                <span className="reasoning-det" title="determinism level">
                  {r.determinism_level}
                </span>
              </div>
              {r.decision ? <p className="reasoning-decision">{r.decision}</p> : null}
              {r.self_critique ? <p className="reasoning-critique">{r.self_critique}</p> : null}
              <span className="reasoning-conf" aria-label={`confidence ${pct}%`}>
                <span style={{ width: `${pct}%`, background: id.accent }} />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
