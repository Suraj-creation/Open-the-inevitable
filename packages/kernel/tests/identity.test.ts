import { describe, it, expect } from "vitest";
import { ManualClock, SeededIdGenerator, isCid } from "@inevitable/shared";
import { IdentityService } from "../src/identity";

function service() {
  return new IdentityService({
    clock: new ManualClock(1000),
    idGenerator: new SeededIdGenerator(),
  });
}

describe("IdentityService", () => {
  it("issues schema-valid identities", () => {
    const id = service().issue({ unitType: "agent", capabilities: ["a"], trustLevel: 8 });
    expect(isCid(id.cid)).toBe(true);
    expect(id.trust_level).toBe(8);
    expect(id.created_at).toBe("1970-01-01T00:00:01.000Z");
  });

  it("clamps trust to [0,10]", () => {
    const svc = service();
    expect(svc.issue({ unitType: "agent", trustLevel: 99 }).trust_level).toBe(10);
    expect(svc.issue({ unitType: "agent", trustLevel: -5 }).trust_level).toBe(0);
  });

  it("spawns a child with decremented trust, lineage, and capability subset", () => {
    const svc = service();
    const parent = svc.issue({ unitType: "agent", capabilities: ["a", "b"], trustLevel: 8 });
    const result = svc.spawnChild(parent.cid, { unitType: "subagent", capabilities: ["a"] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.trust_level).toBe(7);
      expect(result.value.parent_cid).toBe(parent.cid);
      expect(result.value.lineage).toEqual([parent.cid]);
    }
  });

  it("rejects child capabilities not held by the parent", () => {
    const svc = service();
    const parent = svc.issue({ unitType: "agent", capabilities: ["a"], trustLevel: 5 });
    const result = svc.spawnChild(parent.cid, { unitType: "subagent", capabilities: ["c"] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("E_CAPABILITY_DENIED");
  });

  it("rejects spawning from an unknown parent", () => {
    const result = service().spawnChild("cog-ffffffffffff", { unitType: "subagent" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("E_NOT_FOUND");
  });

  it("adjusts trust within bounds and revokes", () => {
    const svc = service();
    const id = svc.issue({ unitType: "agent", trustLevel: 5 });
    const up = svc.adjustTrust(id.cid, 10);
    expect(up.ok && up.value.trust_level).toBe(10);
    expect(svc.revoke(id.cid)).toBe(true);
    expect(svc.has(id.cid)).toBe(false);
  });
});
