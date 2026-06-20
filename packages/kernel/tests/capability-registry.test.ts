/**
 * CapabilityRegistry — fine-grained dynamic grant/revoke of named capabilities to subjects
 * (spec/kernel/capability-registry.md). The governance immune system: revoke takes effect immediately.
 */
import { describe, expect, test } from "vitest";
import { ManualClock } from "@inevitable/shared";
import { CapabilityRegistry } from "../src/capability-registry";

const SUBJECT = "cog-learner-1";

function registry(): CapabilityRegistry {
  return new CapabilityRegistry({ clock: new ManualClock(Date.UTC(2026, 5, 20)) });
}

describe("CapabilityRegistry", () => {
  test("grant makes a capability active; has/granted reflect it", () => {
    const reg = registry();
    reg.grant(SUBJECT, "dispatch.explanation", "kernel");
    expect(reg.has(SUBJECT, "dispatch.explanation")).toBe(true);
    expect(reg.granted(SUBJECT)).toEqual(["dispatch.explanation"]);
  });

  test("revoke takes effect immediately and removes it from the active set", () => {
    const reg = registry();
    reg.grant(SUBJECT, "dispatch.explanation");
    reg.grant(SUBJECT, "dispatch.practice");
    expect(reg.revoke(SUBJECT, "dispatch.explanation", "misuse")).toBe(true);
    expect(reg.has(SUBJECT, "dispatch.explanation")).toBe(false);
    expect(reg.granted(SUBJECT)).toEqual(["dispatch.practice"]);
  });

  test("re-granting a revoked capability re-activates it", () => {
    const reg = registry();
    reg.grant(SUBJECT, "dispatch.explanation");
    reg.revoke(SUBJECT, "dispatch.explanation", "temporary");
    expect(reg.has(SUBJECT, "dispatch.explanation")).toBe(false);
    reg.grant(SUBJECT, "dispatch.explanation");
    expect(reg.has(SUBJECT, "dispatch.explanation")).toBe(true);
  });

  test("revoking an unheld capability returns false", () => {
    const reg = registry();
    expect(reg.revoke(SUBJECT, "dispatch.explanation")).toBe(false);
  });

  test("list retains revoked grants for audit; granted does not", () => {
    const reg = registry();
    reg.grant(SUBJECT, "dispatch.explanation");
    reg.revoke(SUBJECT, "dispatch.explanation", "policy");
    const audit = reg.list(SUBJECT);
    expect(audit).toHaveLength(1);
    expect(audit[0]!.revokedReason).toBe("policy");
    expect(reg.granted(SUBJECT)).toEqual([]);
  });

  test("an unknown subject has no capabilities", () => {
    const reg = registry();
    expect(reg.has("nobody", "dispatch.explanation")).toBe(false);
    expect(reg.granted("nobody")).toEqual([]);
  });
});
