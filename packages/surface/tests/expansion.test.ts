/**
 * Progressive deepening (Phase 2B): surface.explanation.expanded is the typed modification —
 * the fold merges deepened layers into the block and bumps its version.
 * Spec: spec/surface/cognitive-surface-runtime.md §6.1 step 3.
 */
import { describe, expect, test } from "vitest";
import { createEvent, InMemoryEventBus } from "@inevitable/events";
import { hlcInit, ManualClock, SeededIdGenerator } from "@inevitable/shared";
import { createCognitionBlock } from "../src/blocks";
import { foldSurfaceEvents } from "../src/projection";

function harness() {
  const clock = new ManualClock(Date.UTC(2026, 5, 12));
  const idGenerator = new SeededIdGenerator("expansion");
  const bus = new InMemoryEventBus({ idGenerator });
  let hlc = hlcInit("expansion-test");
  const emit = async (eventType: string, payload: Record<string, unknown>) => {
    const created = createEvent(
      { eventType, producerCid: "cog-test", producerType: "test", payload },
      { clock, hlc, idGenerator },
    );
    hlc = created.hlc;
    await bus.publish(created.event);
  };
  return { clock, idGenerator, bus, emit };
}

describe("foldSurfaceEvents — surface.explanation.expanded", () => {
  test("merges deepened layers into the block and increments its version", async () => {
    const { clock, idGenerator, bus, emit } = harness();
    const block = createCognitionBlock(
      {
        surface_id: "srf-exp",
        block_type: "explanation",
        title: "Explanation — Gradient Descent",
        content: { layers: { layer_0: "Walk downhill." }, summary: "s" },
        concept_ids: ["gradient-descent"],
        classification: "internal",
        confidence: 0.9,
        provenance: {
          packet_id: "cp-000000000000000000000001",
          producer_cid: "cog-exp",
          agent_id: "explanation",
          world_state_nodes: [],
          memory_mutation_id: null,
          trace_id: null,
          reason: "test",
        },
      },
      { clock, idGenerator, hlc: "0:0:test" },
    );
    if (!block.ok) throw block.error;

    await emit("surface.created", {
      surface_id: "srf-exp",
      learner_cid: "cog-learner",
      session_id: "intent-1",
      goal: "g",
    });
    await emit("surface.block.generated", { surface_id: "srf-exp", block: block.value });
    await emit("surface.explanation.expanded", {
      surface_id: "srf-exp",
      block_id: block.value.block_id,
      layer: 1,
      layers: { layer_1: "Picture a hillside in fog." },
      summary: "deepened",
      packet_id: "cp-000000000000000000000002",
      agent_id: "explanation",
    });

    const state = foldSurfaceEvents(bus.replay({ subject: "surface.>" }), "srf-exp");
    expect(state).not.toBeNull();
    const folded = state!.blocks[0]!;
    expect(folded.version).toBe(2);
    const layers = folded.content["layers"] as Record<string, unknown>;
    expect(layers["layer_0"]).toBe("Walk downhill."); // original preserved
    expect(layers["layer_1"]).toBe("Picture a hillside in fog."); // deepening merged
  });

  test("an expansion for an unknown block changes nothing but the version counter", async () => {
    const { bus, emit } = harness();
    await emit("surface.created", {
      surface_id: "srf-exp2",
      learner_cid: "cog-learner",
      session_id: "intent-1",
      goal: null,
    });
    await emit("surface.explanation.expanded", {
      surface_id: "srf-exp2",
      block_id: "blk-missing",
      layer: 1,
      layers: { layer_1: "x" },
    });
    const state = foldSurfaceEvents(bus.replay({ subject: "surface.>" }), "srf-exp2");
    expect(state?.blocks).toHaveLength(0);
    expect(state?.version).toBe(2);
  });
});
