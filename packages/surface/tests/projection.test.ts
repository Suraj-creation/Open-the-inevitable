import { describe, expect, test } from "vitest";
import { InMemoryEventBus, createEvent } from "@inevitable/events";
import type { CognitiveEvent } from "@inevitable/protocols";
import { ManualClock, SeededIdGenerator, hlcInit, type Hlc } from "@inevitable/shared";
import { AgentContributionRuntime } from "../src/contribution";
import { foldSurfaceEvents } from "../src/projection";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Fixture {
  bus: InMemoryEventBus;
  contributions: AgentContributionRuntime;
  emit: (eventType: string, payload: Record<string, unknown>) => Promise<CognitiveEvent>;
}

function makeFixture(seed = "projection-test"): Fixture {
  const clock = new ManualClock(Date.UTC(2026, 5, 11));
  const idGenerator = new SeededIdGenerator(seed);
  const bus = new InMemoryEventBus({ idGenerator });
  const contributions = new AgentContributionRuntime({
    bus,
    clock,
    idGenerator,
    nodeId: "projection-test",
  });
  let hlc: Hlc = hlcInit("projection-test-emitter");
  const emit = async (
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<CognitiveEvent> => {
    const created = createEvent(
      {
        eventType,
        producerCid: "cog-projection-learner",
        producerType: "product.surface",
        payload,
        topic: `cos.${eventType}`,
        classification: "internal",
      },
      { clock, hlc, idGenerator },
    );
    hlc = created.hlc;
    await bus.publish(created.event);
    return created.event;
  };
  return { bus, contributions, emit };
}

async function seedSurface(f: Fixture, surfaceId = "srf-proj"): Promise<void> {
  await f.emit("surface.created", {
    surface_id: surfaceId,
    learner_cid: "cog-projection-learner",
    session_id: "intent-proj-001",
    goal: "Teach me Fourier analysis",
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("foldSurfaceEvents", () => {
  test("returns null when no surface.created exists", () => {
    expect(foldSurfaceEvents([])).toBeNull();
  });

  test("folds created → block.generated → closed into final state", async () => {
    const f = makeFixture();
    await seedSurface(f);

    const block = await f.contributions.contribute({
      surface_id: "srf-proj",
      agent_id: "explanation",
      agent_cid: "cog-exp-proj",
      block_type: "explanation",
      title: "Fourier intuition",
      content: { text: "A signal is a sum of rotations." },
      concept_ids: ["fourier"],
      reason: "test contribution",
    });
    expect(block.ok).toBe(true);
    await f.emit("surface.session.closed", {
      surface_id: "srf-proj",
      block_count: 1,
      reason: "done",
    });

    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-proj");
    expect(state).not.toBeNull();
    expect(state?.status).toBe("closed");
    expect(state?.goal).toBe("Teach me Fourier analysis");
    expect(state?.blocks).toHaveLength(1);
    expect(state?.blocks[0]?.title).toBe("Fourier intuition");
    expect(state?.agents_joined).toEqual(["cog-exp-proj"]);
    expect(state?.contributions).toHaveLength(1);
    // source_event_id enriched at fold time from the announcing event
    expect(state?.blocks[0]?.provenance.source_event_id).toBeTruthy();
  });

  test("block.modified replaces content and increments version", async () => {
    const f = makeFixture("projection-modify");
    await seedSurface(f);
    const block = await f.contributions.contribute({
      surface_id: "srf-proj",
      agent_id: "explanation",
      agent_cid: "cog-exp-proj",
      block_type: "explanation",
      title: "Draft",
      content: { text: "v1" },
      concept_ids: [],
      reason: "test",
    });
    if (!block.ok) throw block.error;

    await f.emit("surface.block.modified", {
      surface_id: "srf-proj",
      block_id: block.value.block_id,
      version: 2,
      content: { text: "v2 — refined" },
      reason: "agent refined the explanation",
    });

    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-proj");
    expect(state?.blocks[0]?.version).toBe(2);
    expect(state?.blocks[0]?.content["text"]).toBe("v2 — refined");
  });

  test("memory.attached marks the block as memory-backed", async () => {
    const f = makeFixture("projection-memory");
    await seedSurface(f);
    const block = await f.contributions.contribute({
      surface_id: "srf-proj",
      agent_id: "assessment",
      agent_cid: "cog-assess-proj",
      block_type: "assessment",
      title: "Checkpoint",
      content: {},
      concept_ids: [],
      reason: "test",
    });
    if (!block.ok) throw block.error;

    await f.emit("surface.memory.attached", {
      surface_id: "srf-proj",
      block_id: block.value.block_id,
      mutation_id: "mut-abc123",
      memory_layer: "semantic",
    });

    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-proj");
    expect(state?.blocks[0]?.provenance.memory_mutation_id).toBe("mut-abc123");
  });

  test("reasoning.recorded appends routing decisions", async () => {
    const f = makeFixture("projection-routing");
    await seedSurface(f);
    await f.emit("surface.reasoning.recorded", {
      surface_id: "srf-proj",
      decision: { target_agent: "explanation", reason: "no prior evidence", concept_id: "fourier" },
      producer_cid: "agent.supervisor",
    });

    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-proj");
    expect(state?.routing_decisions).toHaveLength(1);
    expect(state?.routing_decisions[0]?.target_agent).toBe("explanation");
  });

  test("unknown surface.* subtypes fold into version count only (forward compatible)", async () => {
    const f = makeFixture("projection-unknown");
    await seedSurface(f);
    const before = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-proj");
    await f.emit("surface.hologram.materialized", { surface_id: "srf-proj", shape: "torus" });
    const after = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-proj");

    expect(after?.version).toBe((before?.version ?? 0) + 1);
    expect(after?.blocks).toEqual(before?.blocks);
    expect(after?.status).toBe("active");
  });

  test("events for other surfaces are ignored", async () => {
    const f = makeFixture("projection-isolation");
    await seedSurface(f, "srf-one");
    await f.emit("surface.created", {
      surface_id: "srf-two",
      learner_cid: "cog-other",
      session_id: "intent-other",
      goal: null,
    });
    await f.emit("surface.reasoning.recorded", {
      surface_id: "srf-two",
      decision: { target_agent: "practice", reason: "other surface", concept_id: "x" },
      producer_cid: "agent.supervisor",
    });

    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-one");
    expect(state?.surface_id).toBe("srf-one");
    expect(state?.routing_decisions).toHaveLength(0);
  });

  test("narration.segment appends in order and carries focus into state.focus", async () => {
    const f = makeFixture("projection-narration");
    await seedSurface(f);
    await f.emit("surface.narration.segment", {
      surface_id: "srf-proj",
      segment_id: "seg-1",
      block_id: "blk-x",
      concept_id: "fourier",
      sequence: 0,
      text: "A signal is a sum of rotations.",
      focus: { target_type: "block", target_id: "blk-x", spotlight: true },
      reveal_ids: ["el-1"],
      voice: {
        artifact_id: "art-1",
        content_ref: "mem://art-1",
        duration_ms: 4200,
        provider_id: "null",
      },
    });

    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-proj");
    expect(state?.narration).toHaveLength(1);
    expect(state?.narration[0]?.text).toBe("A signal is a sum of rotations.");
    expect(state?.narration[0]?.voice?.duration_ms).toBe(4200);
    expect(state?.narration[0]?.reveal_ids).toEqual(["el-1"]);
    // a segment-carried focus moves the surface's attention
    expect(state?.focus?.target_id).toBe("blk-x");
    expect(state?.focus?.spotlight).toBe(true);
  });

  test("focus.changed replaces the current focus", async () => {
    const f = makeFixture("projection-focus");
    await seedSurface(f);
    await f.emit("surface.focus.changed", {
      surface_id: "srf-proj",
      sequence: 0,
      focus: { target_type: "concept", target_id: "fourier", reason: "now explaining the core" },
    });
    await f.emit("surface.focus.changed", {
      surface_id: "srf-proj",
      sequence: 1,
      focus: { target_type: "block", target_id: "blk-2", reason: "look at the diagram" },
    });

    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-proj");
    expect(state?.focus?.target_type).toBe("block");
    expect(state?.focus?.target_id).toBe("blk-2");
    expect(state?.focus?.reason).toBe("look at the diagram");
  });

  test("presence.updated upserts by agent_cid (latest state wins, no duplicates)", async () => {
    const f = makeFixture("projection-presence");
    await seedSurface(f);
    await f.emit("surface.presence.updated", {
      surface_id: "srf-proj",
      agent_cid: "cog-exp",
      agent_id: "explanation",
      role: "explainer",
      state: "thinking",
    });
    await f.emit("surface.presence.updated", {
      surface_id: "srf-proj",
      agent_cid: "cog-soc",
      agent_id: "socratic",
      role: "socratic",
      state: "idle",
    });
    await f.emit("surface.presence.updated", {
      surface_id: "srf-proj",
      agent_cid: "cog-exp",
      agent_id: "explanation",
      role: "explainer",
      state: "speaking",
      block_id: "blk-x",
    });

    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-proj");
    expect(state?.presence).toHaveLength(2);
    const exp = state?.presence.find((p) => p.agent_cid === "cog-exp");
    expect(exp?.state).toBe("speaking");
    expect(exp?.block_id).toBe("blk-x");
  });

  test("choreography events satisfy replay equivalence (deep-equal under re-fold)", async () => {
    const f = makeFixture("projection-choreo-replay");
    await seedSurface(f);
    await f.emit("surface.presence.updated", {
      surface_id: "srf-proj",
      agent_cid: "cog-exp",
      agent_id: "explanation",
      role: "explainer",
      state: "speaking",
    });
    await f.emit("surface.narration.segment", {
      surface_id: "srf-proj",
      segment_id: "seg-1",
      sequence: 0,
      text: "Segment one.",
      focus: { target_type: "concept", target_id: "fourier", spotlight: true },
    });
    await f.emit("surface.focus.changed", {
      surface_id: "srf-proj",
      sequence: 1,
      focus: { target_type: "block", target_id: "blk-1", reason: "next" },
    });

    const events = f.bus.replay({ subject: "surface.>" });
    expect(foldSurfaceEvents(events, "srf-proj")).toEqual(foldSurfaceEvents(events, "srf-proj"));
  });

  test("fold is pure and deterministic: same events ⇒ deep-equal state", async () => {
    const f = makeFixture("projection-pure");
    await seedSurface(f);
    await f.contributions.contribute({
      surface_id: "srf-proj",
      agent_id: "practice",
      agent_cid: "cog-prc-proj",
      block_type: "practice",
      title: "Exercise",
      content: { problem: "Compute the DFT of [1,0,0,0]" },
      concept_ids: ["fourier"],
      reason: "test",
    });

    const events = f.bus.replay({ subject: "surface.>" });
    expect(foldSurfaceEvents(events, "srf-proj")).toEqual(foldSurfaceEvents(events, "srf-proj"));
  });

  test("surface.agent.disagreed is folded into disagreements[]", async () => {
    const f = makeFixture("projection-disagreement");
    await seedSurface(f, "srf-dis");

    await f.emit("surface.agent.disagreed", {
      surface_id: "srf-dis",
      agent_cids: ["cog-exp-demo", "challenger"],
      topic: "explanation:gradient-descent",
      concept_id: "gradient-descent",
      resolution: { winner: "explanation", reason: "primary explanation selected" },
    });

    const events = f.bus.replay({ subject: "surface.>" });
    const state = foldSurfaceEvents(events, "srf-dis")!;
    expect(state.disagreements).toHaveLength(1);
    expect(state.disagreements[0]?.topic).toBe("explanation:gradient-descent");
    expect(state.disagreements[0]?.resolution.winner).toBe("explanation");
    expect(state.disagreements[0]?.agent_cids).toEqual(["cog-exp-demo", "challenger"]);
  });

  test("multiple disagreements accumulate in order", async () => {
    const f = makeFixture("projection-multi-dis");
    await seedSurface(f, "srf-mdis");

    await f.emit("surface.agent.disagreed", {
      surface_id: "srf-mdis",
      agent_cids: ["a", "b"],
      topic: "explanation:algebra",
      concept_id: "algebra",
      resolution: { winner: "a", reason: "r1" },
    });
    await f.emit("surface.agent.disagreed", {
      surface_id: "srf-mdis",
      agent_cids: ["c", "d"],
      topic: "explanation:calculus",
      concept_id: "calculus",
      resolution: { winner: "c", reason: "r2" },
    });

    const events = f.bus.replay({ subject: "surface.>" });
    const state = foldSurfaceEvents(events, "srf-mdis")!;
    expect(state.disagreements).toHaveLength(2);
    expect(state.disagreements[0]?.concept_id).toBe("algebra");
    expect(state.disagreements[1]?.concept_id).toBe("calculus");
  });

  test("disagreements array starts empty on surface.created", async () => {
    const f = makeFixture("projection-empty-dis");
    await seedSurface(f, "srf-edis");

    const events = f.bus.replay({ subject: "surface.>" });
    const state = foldSurfaceEvents(events, "srf-edis")!;
    expect(state.disagreements).toEqual([]);
  });
});
