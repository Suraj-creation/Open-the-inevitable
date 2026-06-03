import { describe, it, expect } from "vitest";
import { ManualClock, SeededIdGenerator, GovernanceBlockedError } from "@inevitable/shared";
import { GovernanceEngine } from "@inevitable/governance";
import type { Policy } from "@inevitable/governance";
import { CapabilityService } from "../src/capability";

describe("CapabilityService", () => {
  it("authorizes tools and memory scopes within the envelope", () => {
    const clock = new ManualClock(1000);
    const svc = new CapabilityService({ clock, idGenerator: new SeededIdGenerator() });
    svc.grant({
      grantedTo: "cog-0123456789ab",
      grantedBy: "cog-aaaaaaaaaaaa",
      toolsAllowed: ["web_search"],
      memoryScopes: ["learner.semantic"],
      regionsAllowed: ["IND"],
      ttlMs: 60_000,
    });
    expect(svc.authorizeTool("cog-0123456789ab", "web_search")).toBe(true);
    expect(svc.authorizeTool("cog-0123456789ab", "send_email")).toBe(false);
    expect(svc.authorizeMemoryScope("cog-0123456789ab", "learner.semantic")).toBe(true);
    expect(svc.authorizeRegion("cog-0123456789ab", "SEA")).toBe(false);
  });

  it("denies everything once the envelope expires", () => {
    const clock = new ManualClock(1000);
    const svc = new CapabilityService({ clock, idGenerator: new SeededIdGenerator() });
    svc.grant({
      grantedTo: "cog-0123456789ab",
      grantedBy: "cog-aaaaaaaaaaaa",
      toolsAllowed: ["web_search"],
      ttlMs: 5_000,
    });
    expect(svc.authorizeTool("cog-0123456789ab", "web_search")).toBe(true);
    clock.advance(10_000);
    expect(svc.authorizeTool("cog-0123456789ab", "web_search")).toBe(false);
  });

  it("consults the governance hook before granting", () => {
    const blockGrants: Policy = {
      id: "TEST-BLOCK-GRANT",
      version: "1.0.0",
      type: "access",
      priority: 1,
      appliesTo: (req) => req.action === "capability.grant",
      evaluate: () => ({ decision: "block", reason: "grants disabled in test" }),
    };
    const svc = new CapabilityService({
      clock: new ManualClock(1000),
      idGenerator: new SeededIdGenerator(),
      governance: new GovernanceEngine([blockGrants], { idGenerator: new SeededIdGenerator() }),
    });
    expect(() =>
      svc.grant({ grantedTo: "cog-0123456789ab", grantedBy: "cog-aaaaaaaaaaaa" }),
    ).toThrow(GovernanceBlockedError);
  });
});
