import { describe, expect, test } from "vitest";
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";
import type { CreateTwinParams, TwinConsent, TwinSnapshot } from "../src/twin";
import { TwinRegistry } from "../src/twin";

const clock = new ManualClock(1_000_000);
const idGenerator = new SeededIdGenerator("twin-test");

function makeRegistry(publish?: (t: string, p: Record<string, unknown>) => void) {
  return new TwinRegistry({ clock, idGenerator, publish });
}

const consent: TwinConsent = {
  learnerId: "lnr-1",
  grantedAt: clock.nowMs(),
  allowedSurfaces: ["*"],
  allowedAgents: ["*"],
};

const snapshot: TwinSnapshot = {
  snapshotAt: clock.nowMs(),
  masteryMap: { "linear-algebra": { level: 2, confidence: 0.85 } },
  memoryDigest: [{ layer: "semantic", content: "linear algebra basics", weight: 3 }],
  goals: [],
};

const params: CreateTwinParams = {
  learnerId: "lnr-1",
  displayName: "My Cognitive Twin",
  consent,
  snapshot,
};

describe("TwinRegistry.create", () => {
  test("mints a new twin with status active", () => {
    const reg = makeRegistry();
    const twin = reg.create(params);
    expect(twin.status).toBe("active");
    expect(twin.learnerId).toBe("lnr-1");
    expect(twin.displayName).toBe("My Cognitive Twin");
    expect(twin.branchedFrom).toBeUndefined();
    expect(twin.terminatedAt).toBeUndefined();
    expect(twin.exportedAt).toBeUndefined();
  });

  test("twin has the supplied snapshot and consent", () => {
    const reg = makeRegistry();
    const twin = reg.create(params);
    expect(twin.snapshot.masteryMap["linear-algebra"]).toEqual({ level: 2, confidence: 0.85 });
    expect(twin.consent.allowedSurfaces).toEqual(["*"]);
  });

  test("emits twin.created event with correct payload", () => {
    const emitted: Array<[string, Record<string, unknown>]> = [];
    const reg = makeRegistry((t, p) => emitted.push([t, p]));
    const twin = reg.create(params);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]![0]).toBe("twin.created");
    expect(emitted[0]![1]["twin_id"]).toBe(twin.twinId);
    expect(emitted[0]![1]["learner_id"]).toBe("lnr-1");
    expect(emitted[0]![1]["status"]).toBe("active");
  });
});

describe("TwinRegistry.get", () => {
  test("returns the created twin by id", () => {
    const reg = makeRegistry();
    const twin = reg.create(params);
    expect(reg.get(twin.twinId)).toMatchObject({ twinId: twin.twinId });
  });

  test("returns undefined for unknown twinId", () => {
    const reg = makeRegistry();
    expect(reg.get("twin-unknown")).toBeUndefined();
  });
});

describe("TwinRegistry.list", () => {
  test("returns all twins for a learner in creation order", () => {
    const reg = makeRegistry();
    const t1 = reg.create(params);
    const t2 = reg.create({ ...params, displayName: "Twin B" });
    const list = reg.list("lnr-1");
    expect(list).toHaveLength(2);
    expect(list[0]!.twinId).toBe(t1.twinId);
    expect(list[1]!.twinId).toBe(t2.twinId);
  });

  test("returns empty array for unknown learner", () => {
    const reg = makeRegistry();
    expect(reg.list("lnr-unknown")).toHaveLength(0);
  });
});

describe("TwinRegistry.branch", () => {
  test("creates a new twin with branchedFrom pointer", () => {
    const reg = makeRegistry();
    const parent = reg.create(params);
    const branch = reg.branch(parent.twinId, "Branch A");
    expect(branch.branchedFrom).toBe(parent.twinId);
    expect(branch.twinId).not.toBe(parent.twinId);
    expect(branch.status).toBe("active");
    expect(branch.learnerId).toBe(parent.learnerId);
  });

  test("branch inherits consent from parent", () => {
    const reg = makeRegistry();
    const parent = reg.create(params);
    const branch = reg.branch(parent.twinId, "Branch A");
    expect(branch.consent).toEqual(parent.consent);
  });

  test("branch appears in list for the learner", () => {
    const reg = makeRegistry();
    const parent = reg.create(params);
    reg.branch(parent.twinId, "Branch A");
    expect(reg.list("lnr-1")).toHaveLength(2);
  });

  test("emits twin.branched event", () => {
    const emitted: Array<[string, Record<string, unknown>]> = [];
    const reg = makeRegistry((t, p) => emitted.push([t, p]));
    const parent = reg.create(params);
    const branch = reg.branch(parent.twinId, "Branch A");
    const branchEvent = emitted.find((e) => e[0] === "twin.branched");
    expect(branchEvent).toBeDefined();
    expect(branchEvent![1]["twin_id"]).toBe(branch.twinId);
    expect(branchEvent![1]["branched_from"]).toBe(parent.twinId);
  });

  test("parent twin is unchanged after branching", () => {
    const reg = makeRegistry();
    const parent = reg.create(params);
    reg.branch(parent.twinId, "Branch A");
    expect(reg.get(parent.twinId)?.status).toBe("active");
    expect(reg.get(parent.twinId)?.branchedFrom).toBeUndefined();
  });

  test("throws on unknown twinId", () => {
    const reg = makeRegistry();
    expect(() => reg.branch("twin-nope", "X")).toThrow("not found");
  });

  test("throws when branching a terminated twin", () => {
    const reg = makeRegistry();
    const twin = reg.create(params);
    reg.terminate(twin.twinId);
    expect(() => reg.branch(twin.twinId, "X")).toThrow("terminated");
  });
});

describe("TwinRegistry.export", () => {
  test("marks twin status as exported", () => {
    const reg = makeRegistry();
    const twin = reg.create(params);
    const exported = reg.export(twin.twinId);
    expect(exported.status).toBe("exported");
    expect(exported.exportedAt).toBeDefined();
  });

  test("emits twin.exported event", () => {
    const emitted: Array<[string, Record<string, unknown>]> = [];
    const reg = makeRegistry((t, p) => emitted.push([t, p]));
    const twin = reg.create(params);
    reg.export(twin.twinId);
    expect(emitted.some((e) => e[0] === "twin.exported")).toBe(true);
  });

  test("export is idempotent — repeated call returns current state without re-emitting", () => {
    const emitted: Array<[string, Record<string, unknown>]> = [];
    const reg = makeRegistry((t, p) => emitted.push([t, p]));
    const twin = reg.create(params);
    const first = reg.export(twin.twinId);
    const second = reg.export(twin.twinId);
    expect(second.exportedAt).toBe(first.exportedAt);
    expect(emitted.filter((e) => e[0] === "twin.exported")).toHaveLength(1);
  });

  test("throws when exporting a terminated twin", () => {
    const reg = makeRegistry();
    const twin = reg.create(params);
    reg.terminate(twin.twinId);
    expect(() => reg.export(twin.twinId)).toThrow("terminated");
  });
});

describe("TwinRegistry.terminate", () => {
  test("marks twin status as terminated with terminatedAt timestamp", () => {
    const reg = makeRegistry();
    const twin = reg.create(params);
    const terminated = reg.terminate(twin.twinId);
    expect(terminated.status).toBe("terminated");
    expect(terminated.terminatedAt).toBeDefined();
  });

  test("emits twin.terminated event", () => {
    const emitted: Array<[string, Record<string, unknown>]> = [];
    const reg = makeRegistry((t, p) => emitted.push([t, p]));
    const twin = reg.create(params);
    reg.terminate(twin.twinId);
    expect(emitted.some((e) => e[0] === "twin.terminated")).toBe(true);
  });

  test("terminate is idempotent — repeated call is a no-op", () => {
    const emitted: Array<[string, Record<string, unknown>]> = [];
    const reg = makeRegistry((t, p) => emitted.push([t, p]));
    const twin = reg.create(params);
    reg.terminate(twin.twinId);
    reg.terminate(twin.twinId); // second call
    expect(emitted.filter((e) => e[0] === "twin.terminated")).toHaveLength(1);
  });

  test("data (snapshot + consent) preserved on terminated twin", () => {
    const reg = makeRegistry();
    const twin = reg.create(params);
    reg.terminate(twin.twinId);
    const t = reg.get(twin.twinId);
    expect(t?.snapshot.masteryMap["linear-algebra"]).toBeDefined();
    expect(t?.consent.learnerId).toBe("lnr-1");
  });

  test("throws on unknown twinId", () => {
    const reg = makeRegistry();
    expect(() => reg.terminate("twin-nope")).toThrow("not found");
  });
});
