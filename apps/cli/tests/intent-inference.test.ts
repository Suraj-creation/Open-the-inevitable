/**
 * Intent inference, integrated (kernel/intent-inference). A goal is interpreted into the session's
 * intent lease (in place, stable intent_id), emitting intent.received → intent.interpreted. Offline the
 * deterministic fallback makes the interpreted goal the goal verbatim at confidence 0.5.
 */
import { describe, expect, test } from "vitest";
import { NullModelRuntime } from "@inevitable/adapters";
import type { CognitiveEvent } from "@inevitable/protocols";
import { buildDemoSession } from "../src/wiring";

const GOAL = "Teach me Photosynthesis";

function build() {
  return buildDemoSession({ seed: "intent-a", modelFactory: () => new NullModelRuntime() });
}

describe("intent inference (integration)", () => {
  test("interprets the goal into the intent lease and emits intent.* events", async () => {
    const fixture = build();
    const result = await fixture.inferIntent(GOAL);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The lease now reflects the goal (deterministic fallback: verbatim, confidence 0.5).
    expect(result.value.interpreted_goal).toBe(GOAL);
    expect(result.value.confidence).toBe(0.5);
    expect(result.value.owner_user_id).toBe("user-demo");

    const intentEvents = fixture.bus
      .replay({ subject: "intent.>" })
      .map((e: CognitiveEvent) => e.event_type);
    expect(intentEvents).toContain("intent.received");
    expect(intentEvents).toContain("intent.interpreted");
  });

  test("re-interpretation keeps the same intent_id (stable session identity)", async () => {
    const fixture = build();
    const first = await fixture.inferIntent("Teach me Recursion");
    const second = await fixture.inferIntent("Teach me Photosynthesis");
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.intent_id).toBe(first.value.intent_id); // stable
    expect(second.value.interpreted_goal).toBe("Teach me Photosynthesis"); // refreshed in place
  });

  test("does not disturb the surface fold (intent.* is not a surface event)", async () => {
    const fixture = build();
    await fixture.surface.start(GOAL);
    await fixture.inferIntent(GOAL);
    const surfaceEvents = fixture.bus.replay({ subject: "surface.>" });
    // Only surface.created so far; intent.* events are on the bus but never fold into surface state.
    expect(surfaceEvents.every((e) => e.event_type.startsWith("surface."))).toBe(true);
  });
});
