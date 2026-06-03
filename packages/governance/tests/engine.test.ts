import { describe, it, expect } from "vitest";
import { SeededIdGenerator, GovernanceBlockedError } from "@inevitable/shared";
import { GovernanceEngine } from "../src/engine";
import { DEFAULT_POLICIES } from "../src/default-policies";
import { guard, assertAllowed } from "../src/middleware";
import type { GovernanceDecision } from "../src/policy";

function engineWithDefaults(onDecision?: (d: GovernanceDecision) => void) {
  return new GovernanceEngine(DEFAULT_POLICIES, {
    idGenerator: new SeededIdGenerator(),
    ...(onDecision ? { onDecision } : {}),
  });
}

describe("GovernanceEngine", () => {
  it("allows when no policy objects", () => {
    const engine = engineWithDefaults();
    const decision = engine.evaluate({
      subjectCid: "cog-0123456789ab",
      resource: "tool:web_search",
      action: "invoke",
    });
    expect(decision.decision).toBe("allow");
    expect(decision.policy_id).toBe("default-allow");
  });

  it("blocks PII in public output (GOV-001)", () => {
    const engine = engineWithDefaults();
    const decision = engine.evaluate({
      subjectCid: "cog-0123456789ab",
      resource: "response",
      action: "publish.student_facing",
      classification: "public",
      payload: { text: "contact me at jane@example.com" },
    });
    expect(decision.decision).toBe("block");
    expect(decision.policy_id).toBe("GOV-001-NO-PII");
  });

  it("routes low-confidence responses to review (GOV-002)", () => {
    const engine = engineWithDefaults();
    const decision = engine.evaluate({
      subjectCid: "cog-0123456789ab",
      resource: "response",
      action: "agent.response",
      payload: { confidence: 0.1, text: "maybe" },
    });
    expect(decision.decision).toBe("review");
    expect(decision.modified_payload).toMatchObject({ requires_human_review: true });
  });

  it("invokes the onDecision listener for auditing", () => {
    const seen: GovernanceDecision[] = [];
    const engine = engineWithDefaults((d) => seen.push(d));
    engine.evaluate({ subjectCid: "cog-0123456789ab", resource: "x", action: "y" });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.decision).toBe("allow");
  });

  it("evaluates lower-priority policies first", () => {
    const engine = engineWithDefaults();
    expect(engine.list().map((p) => p.id)).toEqual(["GOV-001-NO-PII", "GOV-002-LOW-CONF"]);
  });
});

describe("middleware", () => {
  it("guard reports allowed/requiresReview", () => {
    const engine = engineWithDefaults();
    const result = guard(engine, {
      subjectCid: "cog-0123456789ab",
      resource: "response",
      action: "agent.response",
      payload: { confidence: 0.1 },
    });
    expect(result.allowed).toBe(true);
    expect(result.requiresReview).toBe(true);
  });

  it("assertAllowed throws on block", () => {
    const engine = engineWithDefaults();
    expect(() =>
      assertAllowed(engine, {
        subjectCid: "cog-0123456789ab",
        resource: "response",
        action: "publish.student_facing",
        classification: "public",
        payload: { text: "ssn 123-45-6789" },
      }),
    ).toThrow(GovernanceBlockedError);
  });
});
