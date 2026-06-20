/**
 * AgentPresence — the surface's cognitive ensemble, made visible. Each agent is a character with a
 * sigil, an accent, and a live activity state (idle/thinking/contributing/speaking). The speaker
 * glows. A projection of state.presence — the pub/sub seam that future sub-agents also join.
 */
import type { AgentPresence as Presence } from "@inevitable/surface/client";
import { identityFor } from "../agents";

export interface AgentPresenceProps {
  readonly presence: readonly Presence[];
}

const STATE_LABEL: Record<string, string> = {
  idle: "idle",
  thinking: "thinking",
  contributing: "contributing",
  speaking: "speaking",
};

export function AgentPresencePanel({ presence }: AgentPresenceProps) {
  return (
    <section className="presence" aria-label="Agents present">
      <h2 className="rail-title">Agents</h2>
      {presence.length === 0 ? (
        <p className="rail-empty">No agents have joined yet.</p>
      ) : (
        <ul className="presence-list">
          {presence.map((agent) => {
            const id = identityFor(agent.agent_id || agent.role);
            return (
              <li
                key={agent.agent_cid}
                className={`presence-card state-${agent.state}`}
                style={{ ["--agent-accent" as string]: id.accent }}
              >
                <span className="presence-sigil" style={{ color: id.accent }}>
                  {id.sigil}
                </span>
                <span className="presence-meta">
                  <span className="presence-name">{id.label}</span>
                  <span className="presence-state">
                    <span className="presence-dot" aria-hidden />
                    {STATE_LABEL[agent.state] ?? agent.state}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
