/**
 * Capability registry, integrated (spec/kernel/capability-registry.md). The governance immune system:
 * the learner is granted dispatch capabilities at session setup; revoking `dispatch.explanation` blocks
 * the explanation dispatch in a live learning cycle (no explanation block), while the rest proceeds.
 */
import { describe, expect, test } from "vitest";
import { NullModelRuntime } from "@inevitable/adapters";
import { buildDemoSession, demoAsk } from "../src/wiring";

const GOAL = "Teach me Neural Networks";

function build() {
  return buildDemoSession({ seed: "cap-a", modelFactory: () => new NullModelRuntime() });
}

describe("capability registry (integration)", () => {
  test("the learner is granted dispatch capabilities at setup", () => {
    const fixture = build();
    expect(fixture.capabilities.granted("cog-demo-learner")).toContain("dispatch.explanation");
    expect(fixture.capabilities.granted("cog-demo-learner")).toContain("dispatch.practice");
  });

  test("with the capability granted, an ask produces an explanation block", async () => {
    const fixture = build();
    await fixture.surface.start(GOAL);
    const asked = await fixture.surface.ask(demoAsk(GOAL));
    expect(asked.ok).toBe(true);
    if (!asked.ok) return;
    expect(asked.value.blocks.some((b) => b.block_type === "explanation")).toBe(true);
  });

  test("revoking dispatch.explanation blocks it in a live cycle (immune system)", async () => {
    const fixture = build();
    expect(fixture.capabilities.revoke("cog-demo-learner", "dispatch.explanation", "test")).toBe(
      true,
    );

    await fixture.surface.start(GOAL);
    const asked = await fixture.surface.ask(demoAsk(GOAL));
    expect(asked.ok).toBe(true);
    if (!asked.ok) return;
    // Explanation dispatch was blocked by GOV-P03 → no explanation block; the cycle still ran
    // (the supervisor routing block is present).
    expect(asked.value.blocks.some((b) => b.block_type === "explanation")).toBe(false);
    expect(asked.value.blocks.some((b) => b.block_type === "routing")).toBe(true);
  });
});
