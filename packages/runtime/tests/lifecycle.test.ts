import { describe, it, expect } from "vitest";
import { LifecycleMachine, isTerminalState, allowedTransitions } from "../src/lifecycle";

describe("LifecycleMachine", () => {
  it("follows the canonical activation path", () => {
    const m = new LifecycleMachine();
    for (const state of ["Admitted", "Scheduled", "Hydrating", "Ready"] as const) {
      expect(m.transition(state).ok).toBe(true);
    }
    expect(m.current).toBe("Ready");
    expect(m.history).toEqual(["Registered", "Admitted", "Scheduled", "Hydrating", "Ready"]);
  });

  it("rejects illegal transitions with an explainable error", () => {
    const m = new LifecycleMachine();
    const result = m.transition("Executing");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("E_INVALID_TRANSITION");
      expect(result.error.details).toMatchObject({ from: "Registered", to: "Executing" });
    }
    expect(m.current).toBe("Registered");
  });

  it("treats Retired and Quarantined as terminal", () => {
    expect(isTerminalState("Retired")).toBe(true);
    expect(isTerminalState("Quarantined")).toBe(true);
    expect(allowedTransitions("Retired")).toEqual([]);
    expect(isTerminalState("Ready")).toBe(false);
  });
});
