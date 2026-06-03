/**
 * Cognitive unit lifecycle FSM (13 states). Enforces documented transitions only — no undocumented
 * state changes (spec/meta/runtime-governance.md, spec/runtime/cognitive-unit-runtime.md).
 */
import { type Result, ok, err, InvalidTransitionError } from "@inevitable/shared";
import type { UnitLifecycleState } from "@inevitable/protocols";

export type { UnitLifecycleState };

const TRANSITIONS: Record<UnitLifecycleState, readonly UnitLifecycleState[]> = {
  Registered: ["Admitted", "Quarantined"],
  Admitted: ["Scheduled", "Quarantined"],
  Scheduled: ["Hydrating", "Quarantined"],
  Hydrating: ["Ready", "Suspended", "Quarantined"],
  Ready: ["Executing", "Suspended", "Retired", "Quarantined"],
  Executing: [
    "Checkpointing",
    "Reflecting",
    "Publishing",
    "Suspended",
    "Recovering",
    "Quarantined",
  ],
  Checkpointing: ["Executing", "Ready", "Suspended", "Recovering"],
  Reflecting: ["Publishing", "Ready", "Executing", "Quarantined"],
  Publishing: ["Ready", "Retired", "Suspended"],
  Suspended: ["Recovering", "Ready", "Retired", "Quarantined"],
  Recovering: ["Ready", "Executing", "Suspended", "Quarantined"],
  Retired: [],
  Quarantined: [],
};

export function allowedTransitions(from: UnitLifecycleState): readonly UnitLifecycleState[] {
  return TRANSITIONS[from];
}

export function isTerminalState(state: UnitLifecycleState): boolean {
  return TRANSITIONS[state].length === 0;
}

export class LifecycleMachine {
  private state: UnitLifecycleState;
  private readonly _history: UnitLifecycleState[];

  constructor(initial: UnitLifecycleState = "Registered") {
    this.state = initial;
    this._history = [initial];
  }

  get current(): UnitLifecycleState {
    return this.state;
  }

  get history(): readonly UnitLifecycleState[] {
    return this._history;
  }

  isTerminal(): boolean {
    return isTerminalState(this.state);
  }

  canTransition(to: UnitLifecycleState): boolean {
    return TRANSITIONS[this.state].includes(to);
  }

  transition(to: UnitLifecycleState): Result<UnitLifecycleState, InvalidTransitionError> {
    if (!this.canTransition(to)) {
      return err(
        new InvalidTransitionError(`Illegal lifecycle transition: ${this.state} -> ${to}`, {
          specRef: "spec/runtime/cognitive-unit-runtime.md",
          details: { from: this.state, to, allowed: TRANSITIONS[this.state] },
        }),
      );
    }
    this.state = to;
    this._history.push(to);
    return ok(to);
  }
}
