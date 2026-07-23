/**
 * AffectChip (R3e, ADR-0057; CSE-005 §3.5) — the system's read of the learner's state, made VISIBLE
 * and OPT-OUT-able. Affect is behavioral inference, never a hidden score: the learner can see what is
 * sensed and turn the display off. Also surfaces the attention budget when it runs low, so the
 * Director's move toward stillness/consolidation is legible rather than mysterious.
 */
import { useState } from "react";

const HIDE_KEY = "inevitable.affectHidden";

function readHidden(): boolean {
  try {
    return globalThis.localStorage?.getItem(HIDE_KEY) === "1";
  } catch {
    return false;
  }
}

export function AffectChip({
  affect,
  budget,
}: {
  readonly affect: { readonly affect_state: string } | null;
  readonly budget: { readonly remaining: string } | null;
}) {
  const [hidden, setHidden] = useState(readHidden);
  const lowBudget = budget?.remaining === "low" || budget?.remaining === "depleted";
  if (hidden || (!affect && !lowBudget)) return null;

  const optOut = (): void => {
    try {
      globalThis.localStorage?.setItem(HIDE_KEY, "1");
    } catch {
      /* storage unavailable — hide for this view regardless */
    }
    setHidden(true);
  };

  return (
    <span
      className="affect-chip"
      title="What the system senses from how you're working — behavioral only, never a score (CSE-005 §3.5). Turn it off with ×."
    >
      {affect ? (
        <span className={`affect-state affect-state--${affect.affect_state}`}>
          {affect.affect_state}
        </span>
      ) : null}
      {lowBudget ? <span className="affect-budget">attention {budget!.remaining}</span> : null}
      <button
        type="button"
        className="affect-optout"
        onClick={optOut}
        aria-label="Turn off the sensing display"
        title="Turn off the sensing display"
      >
        ×
      </button>
    </span>
  );
}
