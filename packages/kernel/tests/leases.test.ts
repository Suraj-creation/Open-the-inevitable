import { describe, it, expect } from "vitest";
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";
import { ContextLeaseService } from "../src/context-lease";
import { IntentLeaseService } from "../src/intent-lease";

describe("ContextLeaseService", () => {
  it("grants a lease that authorizes only its memory layers while active", () => {
    const clock = new ManualClock(1000);
    const svc = new ContextLeaseService({ clock, idGenerator: new SeededIdGenerator() });
    const lease = svc.request({
      grantedTo: "cog-0123456789ab",
      memoryLayers: ["episodic", "semantic"],
      ttlMs: 10_000,
    });
    expect(svc.authorizeLayer(lease.lease_id, "episodic")).toBe(true);
    expect(svc.authorizeLayer(lease.lease_id, "procedural")).toBe(false);
    clock.advance(20_000);
    expect(svc.authorizeLayer(lease.lease_id, "episodic")).toBe(false);
  });

  it("renews and revokes context leases", () => {
    const clock = new ManualClock(1000);
    const svc = new ContextLeaseService({ clock, idGenerator: new SeededIdGenerator() });
    const lease = svc.request({ grantedTo: "cog-1", memoryLayers: ["working"], ttlMs: 5_000 });
    clock.advance(4_000);
    svc.renew(lease.lease_id, 10_000);
    clock.advance(6_000); // now 11000; renewed expiry was 5000+10000=15000
    expect(svc.isActive(lease.lease_id)).toBe(true);
    expect(svc.revoke(lease.lease_id)).toBe(true);
    expect(svc.isActive(lease.lease_id)).toBe(false);
  });
});

describe("IntentLeaseService", () => {
  it("creates a valid lease and expires it", () => {
    const clock = new ManualClock(1000);
    const svc = new IntentLeaseService({ clock, idGenerator: new SeededIdGenerator() });
    const lease = svc.create({
      ownerUserId: "user-42",
      interpretedGoal: "Learn calculus",
      confidence: 0.8,
      ttlMs: 10_000,
    });
    expect(svc.isValid(lease.intent_id)).toBe(true);
    clock.advance(20_000);
    expect(svc.isValid(lease.intent_id)).toBe(false);
  });

  it("revocation invalidates the lease even before expiry", () => {
    const clock = new ManualClock(1000);
    const svc = new IntentLeaseService({ clock, idGenerator: new SeededIdGenerator() });
    const lease = svc.create({
      ownerUserId: "user-42",
      interpretedGoal: "Learn calculus",
      confidence: 0.8,
      ttlMs: 100_000,
    });
    svc.revoke(lease.intent_id, "user changed goal");
    expect(svc.isValid(lease.intent_id)).toBe(false);
    const renewed = svc.renew(lease.intent_id, { ttlMs: 100_000, confidence: 0.9 });
    expect(renewed.ok && svc.isValid(lease.intent_id)).toBe(true);
  });
});
