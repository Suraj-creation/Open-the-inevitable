/**
 * Choreography producer (Phase 2D-S2): the surface speaks and directs attention.
 *
 * Verifies the pure segmenter, narration text collection, and that SurfaceChoreographer emits
 * presence → narration.segment(s) → presence, which fold into the choreography slice exactly.
 */
import { describe, expect, test } from "vitest";
import { InMemoryEventBus, createEvent } from "@inevitable/events";
import { ManualClock, SeededIdGenerator, hlcInit, type Hlc } from "@inevitable/shared";
import type { CognitionBlock } from "../src/blocks";
import { SurfaceChoreographer, collectNarrationTexts, segmentNarration } from "../src/narration";
import { foldSurfaceEvents } from "../src/projection";

function explanationBlock(content: Record<string, unknown>): CognitionBlock {
  return {
    block_id: "blk-exp",
    surface_id: "srf-narr",
    block_type: "explanation",
    version: 1,
    created_at: "2026-06-14T00:00:00.000Z",
    hlc: "hlc-1",
    title: "Explanation — Perceptron",
    content,
    concept_ids: ["perceptron"],
    classification: "internal",
    confidence: 0.9,
    provenance: {
      packet_id: "cp-1",
      producer_cid: "cog-exp",
      agent_id: "explanation",
      source_event_id: null,
      world_state_nodes: ["concept:perceptron"],
      memory_mutation_id: null,
      trace_id: "trace-1",
      reason: "explanation agent response",
    },
  };
}

describe("segmentNarration", () => {
  test("empty text yields no segments", () => {
    expect(segmentNarration("")).toEqual([]);
    expect(segmentNarration("   \n  ")).toEqual([]);
  });

  test("merges short sentences up to maxLen and keeps order", () => {
    // Default maxLen merges the whole passage into one spoken segment.
    expect(segmentNarration("A signal. A sum. Of rotations.")).toEqual([
      "A signal. A sum. Of rotations.",
    ]);
    // A tighter budget packs whole sentences without breaking them.
    expect(segmentNarration("A signal. A sum. Of rotations.", 20)).toEqual([
      "A signal. A sum.",
      "Of rotations.",
    ]);
  });

  test("hard-splits a single over-long sentence on a word boundary", () => {
    const long = "alpha beta gamma delta epsilon zeta eta theta";
    const out = segmentNarration(long, 20);
    expect(out.length).toBeGreaterThan(1);
    expect(out.every((s) => s.length <= 20)).toBe(true);
    expect(out.join(" ")).toBe(long);
  });
});

describe("collectNarrationTexts", () => {
  test("summary then explanation layers in sorted order", () => {
    const block = explanationBlock({
      summary: "A perceptron weighs inputs.",
      layers: { layer_1: "Visual model.", layer_0: "Intuition first." },
    });
    expect(collectNarrationTexts(block)).toEqual([
      "A perceptron weighs inputs.",
      "Intuition first.",
      "Visual model.",
    ]);
  });

  test("falls back to a plain text field when no summary/layers", () => {
    expect(collectNarrationTexts(explanationBlock({ text: "Plain content." }))).toEqual([
      "Plain content.",
    ]);
  });
});

describe("SurfaceChoreographer.narrateBlock", () => {
  async function seededSurface(): Promise<{ bus: InMemoryEventBus; choreo: SurfaceChoreographer }> {
    const clock = new ManualClock(Date.UTC(2026, 5, 14));
    const idGenerator = new SeededIdGenerator("narration-test");
    const bus = new InMemoryEventBus({ idGenerator });
    let hlc: Hlc = hlcInit("narration-seed");
    const created = createEvent(
      {
        eventType: "surface.created",
        producerCid: "cog-learner",
        producerType: "product.surface",
        payload: {
          surface_id: "srf-narr",
          learner_cid: "cog-learner",
          session_id: "i-1",
          goal: "g",
        },
        topic: "cos.surface.created",
        classification: "internal",
      },
      { clock, hlc, idGenerator },
    );
    hlc = created.hlc;
    await bus.publish(created.event);
    const choreo = new SurfaceChoreographer({ bus, clock, idGenerator, nodeId: "narration-test" });
    return { bus, choreo };
  }

  test("emits presence(speaking) → narration segments (focused on the block) → presence(contributing)", async () => {
    const { bus, choreo } = await seededSurface();
    await choreo.narrateBlock({
      surface_id: "srf-narr",
      block: explanationBlock({ summary: "A perceptron weighs inputs. Then it fires." }),
      agent_cid: "cog-exp",
      agent_id: "explanation",
      role: "explainer",
      concept_id: "perceptron",
    });

    const events = bus.replay({ subject: "surface.>" }).map((e) => e.event_type);
    expect(events[0]).toBe("surface.created");
    expect(events).toContain("surface.presence.updated");
    expect(events).toContain("surface.narration.segment");

    const state = foldSurfaceEvents(bus.replay({ subject: "surface.>" }), "srf-narr");
    expect(state?.narration.length).toBeGreaterThanOrEqual(1);
    // narration is ordered and focuses the block being explained
    expect(state?.narration[0]?.sequence).toBe(0);
    expect(state?.narration.every((s) => s.focus?.target_id === "blk-exp")).toBe(true);
    expect(state?.focus?.target_id).toBe("blk-exp");
    // the agent's final visible state is "contributing" (it finished speaking)
    const presence = state?.presence.find((p) => p.agent_cid === "cog-exp");
    expect(presence?.state).toBe("contributing");
    expect(presence?.role).toBe("explainer");
    // no voice synthesizer ⇒ text-only, deterministic
    expect(state?.narration.every((s) => s.voice === null)).toBe(true);
  });

  test("emits nothing for a block with no narratable text", async () => {
    const { bus, choreo } = await seededSurface();
    await choreo.narrateBlock({
      surface_id: "srf-narr",
      block: explanationBlock({}),
      agent_cid: "cog-exp",
      agent_id: "explanation",
      role: "explainer",
      concept_id: "perceptron",
    });
    const state = foldSurfaceEvents(bus.replay({ subject: "surface.>" }), "srf-narr");
    expect(state?.narration).toHaveLength(0);
    expect(state?.presence).toHaveLength(0);
  });
});
