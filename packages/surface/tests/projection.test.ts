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
});
