/**
 * SystemGem — one calm, living point of light that carries ALL system state (CDL: light carries
 * meaning; chrome dissolves). It encodes ensemble activity (breathing), the contributing agent's
 * hue, connection state, and degradation (a quiet ember ring — honesty without alarm; the red
 * banner is gone). Clicking opens the Agent Observatory for the full detail. A projection of
 * state.presence + cognition_health; owns no truth.
 */
import type { AgentPresence } from "@inevitable/surface/client";
import { identityFor } from "../agents";
import type { ConnectionStatus } from "../useSurfaceStream";

export interface SystemGemProps {
  readonly presence: readonly AgentPresence[];
  readonly status: ConnectionStatus;
  readonly degradedUnits: readonly string[];
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

export function SystemGem({ presence, status, degradedUnits, active, onToggle }: SystemGemProps) {
  const busy = presence.some((p) => p.state !== "idle");
  const word = activityWord(presence);
  const degraded = degradedUnits.length > 0;
  // The gem takes the hue of the agent currently carrying cognition; otherwise the state light.
  const leading =
    presence.find((p) => p.state === "speaking") ??
    presence.find((p) => p.state === "contributing") ??
    presence.find((p) => p.state === "thinking") ??
    null;
  const hue = leading
    ? identityFor(leading.agent_id || leading.role).accent
    : "var(--stage-tint, var(--accent))";

  return (
    <div className="gem-cluster">
      <button
        type="button"
        className={`agents-btn gem ${active ? "is-active" : ""} ${busy ? "is-busy" : ""}`}
        data-degraded={degraded ? "true" : undefined}
        data-status={status}
        onClick={onToggle}
        aria-pressed={active}
        aria-label={`Agent Observatory — ${presence.length} agent${presence.length === 1 ? "" : "s"}, ${word}${degraded ? "; some cognition degraded to a deterministic path" : ""}`}
        title={
          degraded
            ? `Deterministic fallback: ${degradedUnits.join(", ")}. Open the Observatory for detail.`
            : `Agents ${word} — open the Observatory`
        }
      >
        <span className="gem-core" style={{ ["--gem-hue" as string]: hue }} aria-hidden />
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
      <span className={`conn conn-${status}`} role="status">
        <span className="conn-dot" aria-hidden />
        <span className="visually-hidden">connection {status}</span>
      </span>
      {degraded ? (
        <span className="visually-hidden" role="status">
          These agents fell back to a deterministic path: {degradedUnits.join(", ")}. Cognition is
          reduced.
        </span>
      ) : null}
    </div>
  );
}
