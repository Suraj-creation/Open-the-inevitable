import { describe, it, expect } from "vitest";
import { loadManifest } from "../src/manifest";

const validManifest = {
  id: "uli-agent",
  version: "1.0.0",
  abi_version: "1.0.0",
  role: "universal-learning-intelligence",
  capabilities: ["prerequisite.discover"],
  memory_access: { read: ["learner.semantic"], write: ["learner.episodic"] },
  policies: ["education.depth_guarantee"],
  resources: { max_child_units: 8 },
  observability: { required_events: ["reasoning.started", "reasoning.completed"] },
};

describe("loadManifest", () => {
  it("accepts a schema-valid, ABI-compatible manifest", () => {
    const result = loadManifest(validManifest);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.id).toBe("uli-agent");
  });

  it("rejects a manifest missing required fields", () => {
    const { id: _omitted, ...missing } = validManifest;
    const result = loadManifest(missing);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("E_PROTOCOL_VALIDATION");
  });

  it("rejects an ABI-incompatible manifest", () => {
    const result = loadManifest({ ...validManifest, abi_version: "2.0.0" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("incompatible");
  });
});
