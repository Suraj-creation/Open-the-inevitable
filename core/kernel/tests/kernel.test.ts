import { describe, expect, it } from "vitest";
import {
  type CausalRecord,
  canonicalJson,
  envelopePolicy,
  foldLedger,
  govern,
  joinLabels,
  KERNEL_KINDS,
  KindRegistry,
  ledgerViolations,
  ManualClock,
  modelUsage,
  orphanSettlements,
  unreconciled,
} from "../src/index.js";

let seq = 0;
const rec = (kind: string, data: unknown): CausalRecord => ({
  stream: "process/P1",
  seq: ++seq,
  kind,
  v: 1,
  at: "2026-01-01T00:00:00.000Z",
  processId: "P1",
  entityId: "L1",
  labels: [],
  causes: [],
  data,
});
const intended = (effectId: string, effectClass: string, key = effectId, attempt = 1) =>
  rec("effect.intended", {
    effectId,
    effectClass,
    action: "ask",
    idempotencyKey: key,
    attempt,
    payloadHash: "h",
  });

describe("canonical json", () => {
  it("is key-order independent and drops undefined members", () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: undefined } })).toBe(
      '{"a":{"d":[1,{"y":2,"z":1}]},"b":1}',
    );
  });
  it("rejects non-finite numbers", () => {
    expect(() => canonicalJson({ x: Number.NaN })).toThrow();
  });
});

describe("labels", () => {
  it("join is a sorted union, pure", () => {
    expect(joinLabels(["pii", "consent:learning"], ["pii"], [])).toEqual([
      "consent:learning",
      "pii",
    ]);
  });
});

describe("kind registry", () => {
  const registry = new KindRegistry(KERNEL_KINDS);
  it("fails closed on unknown kinds and versions", () => {
    expect(registry.validate({ kind: "effect.intended", v: 2, data: {} })[0]).toMatch(
      /unknown kind/,
    );
    expect(registry.validate({ kind: "nope", v: 1, data: {} })[0]).toMatch(/unknown kind/);
  });
  it("rejects unknown fields and wrong types", () => {
    const errs = registry.validate({
      kind: "effect.started",
      v: 1,
      data: { effectId: "e1", extra: 1 },
    });
    expect(errs.join()).toMatch(/unknown field extra/);
    expect(
      registry
        .validate({ kind: "effect.settled", v: 1, data: { effectId: "e1", outcome: "maybe" } })
        .join(),
    ).toMatch(/outcome/);
  });
});

describe("effect ledger", () => {
  it("classifies orphans: intended-only never ran; started external is unknown; started model call is abandoned", () => {
    const ledger = foldLedger([
      intended("x1", "external-communication"),
      intended("x2", "external-communication"),
      rec("effect.started", { effectId: "x2" }),
      intended("m1", "model-call"),
      rec("effect.started", { effectId: "m1" }),
    ]);
    const outcomes = Object.fromEntries(
      orphanSettlements(ledger).map((d) => [d.data.effectId, d.data.outcome]),
    );
    expect(outcomes).toEqual({ x1: "not_started", x2: "outcome_unknown", m1: "abandoned" });
  });

  it("settles exactly once and refuses to start twice", () => {
    const ledger = foldLedger([
      intended("x1", "external-communication"),
      rec("effect.started", { effectId: "x1" }),
      rec("effect.settled", { effectId: "x1", outcome: "completed" }),
    ]);
    expect(
      ledgerViolations(ledger, {
        kind: "effect.settled",
        v: 1,
        data: { effectId: "x1", outcome: "failed" },
      })[0],
    ).toMatch(/exactly once/);
    expect(
      ledgerViolations(ledger, { kind: "effect.started", v: 1, data: { effectId: "x1" } })[0],
    ).toMatch(/already/);
  });

  it("never retries an unknown outcome before reconciliation, and never resends what was delivered", () => {
    const base = [
      intended("x1", "external-communication", "ask:i-8"),
      rec("effect.started", { effectId: "x1" }),
      rec("effect.settled", { effectId: "x1", outcome: "outcome_unknown" }),
    ];
    const retry = {
      kind: "effect.intended",
      v: 1,
      data: {
        effectId: "x2",
        effectClass: "external-communication",
        action: "ask",
        idempotencyKey: "ask:i-8",
        attempt: 2,
        payloadHash: "h",
      },
    };
    expect(unreconciled(foldLedger(base))).toHaveLength(1);
    expect(ledgerViolations(foldLedger(base), retry)[0]).toMatch(/reconcile before retry/);
    const delivered = foldLedger([
      ...base,
      rec("effect.reconciled", { effectId: "x1", finding: "delivered", method: "outbox" }),
    ]);
    expect(ledgerViolations(delivered, retry)[0]).toMatch(/never resend/);
    const notDelivered = foldLedger([
      ...base,
      rec("effect.reconciled", { effectId: "x1", finding: "not_delivered", method: "outbox" }),
    ]);
    expect(ledgerViolations(notDelivered, retry)).toEqual([]);
  });

  it("meters model calls from settled usage, skipping calls that never ran", () => {
    const ledger = foldLedger([
      intended("m1", "model-call"),
      rec("effect.started", { effectId: "m1" }),
      rec("effect.settled", {
        effectId: "m1",
        outcome: "completed",
        usage: { inTokens: 100, outTokens: 20 },
      }),
      intended("m2", "model-call"),
      rec("effect.settled", { effectId: "m2", outcome: "not_started" }),
    ]);
    expect(modelUsage(ledger)).toEqual({ calls: 1, inTokens: 100, outTokens: 20 });
  });
});

describe("authority and governance", () => {
  const env = {
    actions: ["ask", "explain"],
    effectClasses: ["model-call", "external-communication"] as const,
    modelCallBudget: 2,
  };
  it("allows within the envelope and denies outside it or over budget", () => {
    expect(
      envelopePolicy(env, 0, { action: "ask", effectClass: "external-communication" }).decision,
    ).toBe("allow");
    expect(
      envelopePolicy(env, 0, { action: "transfer", effectClass: "external-communication" })
        .decision,
    ).toBe("deny");
    expect(envelopePolicy(env, 2, { action: "think", effectClass: "model-call" }).decision).toBe(
      "deny",
    );
  });
  it("treats a throwing or malformed policy as a denial", () => {
    expect(
      govern(() => {
        throw new Error("boom");
      }),
    ).toEqual({ decision: "deny", reason: "policy failed: boom" });
    expect(govern(() => ({}) as never).decision).toBe("deny");
  });
});

describe("clock", () => {
  it("advances deterministically", () => {
    const c = new ManualClock("2026-01-01T00:00:00.000Z");
    c.advance(86_400_000);
    expect(c.now()).toBe("2026-01-02T00:00:00.000Z");
  });
});
