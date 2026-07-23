/**
 * DirectorBadge — the Cognitive Director made legible (CSE M7 T1; CSE-011, ADR-0033 L1/L4).
 *
 * The Director conducts, it never renders — this badge is the client *realizing* a directive: it
 * shows the current cognitive state + pace as a whisper chip in the top bar, and on demand opens
 * "why this pace" — the directive's rationale, the alternative it rejected, and its confidence
 * (every pedagogical decision is answerable, ADR-0033 L4). Pure projection of `latest_directive`;
 * nothing here writes canonical state.
 */
import { useState } from "react";
import type { DirectiveRecord } from "@inevitable/surface/client";

const STATE_LABEL: Record<string, string> = {
  orienting: "Orienting",
  learning: "Learning",
  practicing: "Practicing",
  struggling: "Working through it",
  consolidating: "Consolidating",
  assessing: "Checking depth",
  mastering: "Mastering",
};

const TEMPO_LABEL: Record<string, string> = {
  slow: "slow",
  measured: "measured",
  brisk: "brisk",
};

export function DirectorBadge({ directive }: { readonly directive: DirectiveRecord | null }) {
  const [open, setOpen] = useState(false);
  if (!directive) return null;
  const label = STATE_LABEL[directive.target_state] ?? directive.target_state;
  const tempo = directive.pacing.silence ? "a quiet beat" : TEMPO_LABEL[directive.pacing.tempo];

  return (
    <div className="director-badge">
      <button
        type="button"
        className="director-badge-chip"
        data-state={directive.target_state}
        onClick={() => setOpen((o) => !o)}
        title="Why this pace? — the Director's rationale"
        aria-expanded={open}
      >
        <span className="director-badge-dot" aria-hidden />
        {label} · {tempo}
      </button>
      {open ? (
        <div className="director-why" role="dialog" aria-label="Why this pace">
          <p className="director-why-rationale">{directive.rationale}</p>
          {directive.considered[0] ? (
            <p className="director-why-considered">
              Instead of{" "}
              <strong>
                {STATE_LABEL[directive.considered[0].alternative_state] ??
                  directive.considered[0].alternative_state}
              </strong>{" "}
              — {directive.considered[0].rejected_because}.
            </p>
          ) : null}
          <p className="director-why-meta">confidence {Math.round(directive.confidence * 100)}%</p>
        </div>
      ) : null}
    </div>
  );
}
