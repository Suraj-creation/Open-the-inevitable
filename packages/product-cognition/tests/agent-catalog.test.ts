import { describe, expect, test } from "vitest";
import { loadManifest } from "@inevitable/runtime";
import { MVP_AGENT_MANIFESTS, minimalAgentSet } from "../src/agent-catalog";

describe("MVP agent catalog", () => {
  test("contains schema-valid manifests for the Phase 1E minimal agent set", () => {
    expect(minimalAgentSet()).toEqual([
      "supervisor",
      "curriculum",
      "explanation",
      "practice",
      "assessment",
      "revision",
      "memory",
      "intent",
      "research",
      "motivation",
      "reflection",
      "debate",
      "composer",
      "frameplanner",
      "imageplanner",
      "representation",
      "canonicalizer",
      "meaning",
      "claim",
      "synthesis",
      "frontier",
      "temporal",
      "creation",
    ]);

    for (const manifest of MVP_AGENT_MANIFESTS) {
      const loaded = loadManifest(manifest);
      expect(loaded.ok).toBe(true);
      expect(manifest.abi_version).toBe("1.0.0");
      expect(manifest.observability.required_events ?? []).not.toHaveLength(0);
    }
  });
});
