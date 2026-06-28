/**
 * AgentsButton — the always-visible entry to the Agent Observatory (F09 §4.1). Instead of a permanent
 * agents rail, a compact control carries live status pills: one pulsing mark per present agent, tinted
 * by the agent's accent and animated by its activity state (thinking/contributing/speaking). It reveals
 * how much cognition is in flight without consuming the board. A projection of state.presence.
 */
import type { AgentPresence } from "@inevitable/surface/client";
import { identityFor } from "../agents";

export interface AgentsButtonProps {
  readonly presence: readonly AgentPresence[];
  readonly active: boolean;
  readonly onToggle: () => void;
}

/** A one-word activity summary for the ensemble, for the screen-reader label and the chip. */
function activityWord(presence: readonly AgentPresence[]): string {
  if (presence.some((p) => p.state === "speaking")) return "narrating";
  if (presence.some((p) => p.state === "contributing")) return "generating";
  if (presence.some((p) => p.state === "thinking")) return "thinking";
  return presence.length > 0 ? "ready" : "idle";
}

export function AgentsButton({ presence, active, onToggle }: AgentsButtonProps) {
  const busy = presence.some((p) => p.state !== "idle");
  const word = activityWord(presence);

  return (
    <button
      type="button"
      className={`agents-btn ${active ? "is-active" : ""} ${busy ? "is-busy" : ""}`}
      onClick={onToggle}
      aria-pressed={active}
      aria-label={`Agent Observatory — ${presence.length} agent${presence.length === 1 ? "" : "s"}, ${word}`}
    >
      <span className="agents-label">Agents</span>
      <span className="agents-pills" aria-hidden>
        {presence.length === 0 ? (
          <span className="agents-pill state-idle" />
        ) : (
          presence.slice(0, 6).map((p) => {
            const id = identityFor(p.agent_id || p.role);
            return (
              <span
                key={p.agent_cid}
                className={`agents-pill state-${p.state}`}
                style={{ ["--agent-accent" as string]: id.accent }}
              />
            );
          })
        )}
      </span>
      <span className="agents-word">{word}</span>
    </button>
  );
}
