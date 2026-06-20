import { describe, expect, test } from "vitest";
import { foldStream, parseFrame, type StreamEvent } from "../src/surface-stream";

function ev(eventType: string, payload: Record<string, unknown>, seq: number): StreamEvent {
  return {
    event_id: `evt-${seq}`,
    event_type: eventType,
    hlc: `hlc-${seq}`,
    sequence: seq,
    payload,
  } as unknown as StreamEvent;
}

function minimalBlock() {
  return {
    block_id: "blk-1",
    surface_id: "srf-1",
    block_type: "explanation",
    version: 1,
    created_at: "2026-06-12T00:00:00.000Z",
    hlc: "hlc-2",
    title: "What is a perceptron",
    content: { summary: "A linear classifier." },
    concept_ids: ["perceptron"],
    classification: "internal",
    confidence: 0.9,
    provenance: {
      packet_id: "cp-1",
      producer_cid: "cog-exp",
      agent_id: "explanation",
      source_event_id: null,
      world_state_nodes: [],
      memory_mutation_id: null,
      trace_id: "trace-1",
      reason: "explain the requested concept",
    },
  };
}

describe("surface-stream — the browser folds the same log the runtime does", () => {
  test("foldStream reconstructs SurfaceState from streamed surface.* events", () => {
    const events = [
      ev(
        "surface.created",
        { surface_id: "srf-1", session_id: "sess-1", learner_cid: "cog-l", goal: "Teach me X" },
        1,
      ),
      ev("surface.block.generated", { surface_id: "srf-1", block: minimalBlock() }, 2),
    ];
    const state = foldStream(events);
    expect(state?.surface_id).toBe("srf-1");
    expect(state?.goal).toBe("Teach me X");
    expect(state?.blocks.length).toBe(1);
    expect(state?.blocks[0]?.title).toBe("What is a perceptron");
    // The fold enriches provenance with the announcing event id (same on server and client).
    expect(state?.blocks[0]?.provenance.source_event_id).toBe("evt-2");
  });

  test("parseFrame extracts the event from a data line and ignores comments", () => {
    const frame = `id: 5\nevent: surface\ndata: ${JSON.stringify({ event_type: "surface.created", payload: {} })}`;
    expect(parseFrame(frame)?.event_type).toBe("surface.created");
    expect(parseFrame(": snapshot-complete")).toBeNull();
  });
});
