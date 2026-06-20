/**
 * GOV-P03 capability gate (spec/kernel/capability-registry.md): opt-in by presence — enforces only
 * when the request carries a `capabilities` context; blocks a dispatch whose required capability is
 * absent/revoked; a no-op otherwise (existing governed paths unaffected).
 */
import { describe, expect, test } from "vitest";
import type { PolicyRequest } from "@inevitable/governance";
import { productDispatchCapabilityGate as gate } from "../src/product-dispatch-policies";

function request(over: Partial<PolicyRequest> & { action: string }): PolicyRequest {
  return {
    subjectCid: "cog-learner",
    resource: "product.cognition.dispatch",
    ...over,
  } as PolicyRequest;
}

describe("GOV-P03 — capability gate", () => {
  test("no-op when no capabilities context is present (opt-in)", () => {
    const req = request({ action: "dispatch.explanation", context: { trustLevel: 5 } });
    expect(gate.appliesTo(req)).toBe(false);
  });

  test("allows when the required capability is granted", () => {
    const req = request({
      action: "dispatch.explanation",
      context: { capabilities: ["dispatch.explanation", "dispatch.practice"] },
    });
    expect(gate.appliesTo(req)).toBe(true);
    expect(gate.evaluate(req).decision).toBe("allow");
  });

  test("blocks when the required capability is absent or revoked", () => {
    const req = request({
      action: "dispatch.explanation",
      context: { capabilities: ["dispatch.practice"] }, // explanation revoked
    });
    expect(gate.appliesTo(req)).toBe(true);
    const outcome = gate.evaluate(req);
    expect(outcome.decision).toBe("block");
    expect(outcome.evidence).toContain("GOV-P03");
  });
});
