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

  // S3.1 — research readiness gate fold (ADR-0026)

  test("research_frontiers and motivation_surfaced are initialized empty/false (S3.1)", async () => {
    const f = makeFixture("projection-research-init");
    await seedSurface(f, "srf-ri");

    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-ri")!;
    expect(state.research_frontiers).toEqual([]);
    expect(state.motivation_surfaced).toBe(false);
    expect(state.evaluation_records).toEqual([]);
    expect(state.mode).toBe("student");
  });

  test("frontier.detected appends a record with surfaced=false (S3.1)", async () => {
    const f = makeFixture("projection-frontier-detected");
    await seedSurface(f, "srf-fd");

    await f.emit("surface.research.frontier.detected", {
      surface_id: "srf-fd",
      concept_id: "fourier",
      confidence: 0.82,
      gate_passed: true,
    });

    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-fd")!;
    expect(state.research_frontiers).toHaveLength(1);
    expect(state.research_frontiers[0]?.concept_id).toBe("fourier");
    expect(state.research_frontiers[0]?.trigger_confidence).toBe(0.82);
    expect(state.research_frontiers[0]?.trigger_gate_passed).toBe(true);
    expect(state.research_frontiers[0]?.surfaced).toBe(false);
  });

  test("frontier.detected → frontier.surfaced flips surfaced to true (S3.1 D3)", async () => {
    const f = makeFixture("projection-frontier-surfaced");
    await seedSurface(f, "srf-fs");

    await f.emit("surface.research.frontier.detected", {
      surface_id: "srf-fs",
      concept_id: "fourier",
      confidence: 0.85,
      gate_passed: true,
    });
    await f.emit("surface.research.frontier.surfaced", {
      surface_id: "srf-fs",
      concept_id: "fourier",
      frontier: "Active open problem: efficient computation of the NDFT",
      gap: "No O(n log n) algorithm for non-uniform grids",
      hypothesis_seed: "Could sparse-grid FFT generalise to arbitrary node placement?",
      source_note: "Based on recent numerical analysis literature",
    });

    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-fs")!;
    expect(state.research_frontiers).toHaveLength(1);
    expect(state.research_frontiers[0]?.surfaced).toBe(true);
    expect(state.research_frontiers[0]?.concept_id).toBe("fourier");
  });

  test("LKS T1: a grounded surfaced frontier folds its grounded flag + cited entries (ADR-0045)", async () => {
    const f = makeFixture("projection-frontier-grounded");
    await seedSurface(f, "srf-fg");

    await f.emit("surface.research.frontier.detected", {
      surface_id: "srf-fg",
      concept_id: "gradient-descent",
      confidence: 0.9,
      gate_passed: true,
    });
    await f.emit("surface.research.frontier.surfaced", {
      surface_id: "srf-fg",
      concept_id: "gradient-descent",
      grounded: true,
      entries: [
        {
          kind: "latest-research",
          summary: "Adaptive step-size methods are an active direction.",
          external_refs: [{ uri: "https://arxiv.org/abs/2401.1", title: "A 2024 Survey" }],
        },
      ],
    });

    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-fg")!;
    const record = state.research_frontiers[0];
    expect(record?.surfaced).toBe(true);
    expect(record?.grounded).toBe(true);
    expect(record?.entries?.[0]?.kind).toBe("latest-research");
    expect(record?.entries?.[0]?.external_refs[0]?.uri).toBe("https://arxiv.org/abs/2401.1");
  });

  test("frontier.deferred counts toward version only — no record appended (S3.1)", async () => {
    const f = makeFixture("projection-frontier-deferred");
    await seedSurface(f, "srf-fdefer");

    await f.emit("surface.research.frontier.deferred", {
      surface_id: "srf-fdefer",
      concept_id: "fourier",
      confidence: 0.62,
      reason: "confidence below research readiness threshold",
    });

    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-fdefer")!;
    expect(state.research_frontiers).toHaveLength(0);
    // version was still incremented (event consumed)
    expect(state.version).toBeGreaterThan(1);
  });

  test("motivation.surfaced sets motivation_surfaced=true (S3.3)", async () => {
    const f = makeFixture("projection-motivation");
    await seedSurface(f, "srf-mot");

    await f.emit("surface.motivation.surfaced", {
      surface_id: "srf-mot",
      concept_id: "fourier",
      message: "You are making great progress!",
    });

    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-mot")!;
    expect(state.motivation_surfaced).toBe(true);
  });

  // S4.2 — evaluation records fold (ADR-0027)

  test("evaluation.recorded appends to evaluation_records (S4.2)", async () => {
    const f = makeFixture("projection-eval-recorded");
    await seedSurface(f, "srf-ev");

    await f.emit("surface.evaluation.recorded", {
      surface_id: "srf-ev",
      concept_id: "fourier",
      scorecard_id: "explanation-v1",
      score: 0.82,
      passed: true,
      dimension_scores: [
        { name: "explanation", score: 0.9, passed: true, evidence: "explanation test passed" },
      ],
      hlc: "2026-06-25T00:00:00.000Z:0:srf-ev",
    });

    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-ev")!;
    expect(state.evaluation_records).toHaveLength(1);
    expect(state.evaluation_records[0]?.concept_id).toBe("fourier");
    expect(state.evaluation_records[0]?.scorecard_id).toBe("explanation-v1");
    expect(state.evaluation_records[0]?.score).toBe(0.82);
    expect(state.evaluation_records[0]?.passed).toBe(true);
  });

  test("mode defaults to student and surface.mode.set updates it (S4.3)", async () => {
    const f = makeFixture("projection-mode");
    await seedSurface(f, "srf-mode");

    const stateBefore = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-mode")!;
    expect(stateBefore.mode).toBe("student");

    await f.emit("surface.mode.set", { surface_id: "srf-mode", mode: "educator" });

    const stateAfter = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-mode")!;
    expect(stateAfter.mode).toBe("educator");
  });

  // S4.4 — scene-graph projection fold

  test("current_projection defaults to timeline and surface.projection.switched updates it (S4.4)", async () => {
    const f = makeFixture("projection-proj-switch");
    await seedSurface(f, "srf-proj-sw");

    const before = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-proj-sw")!;
    expect(before.current_projection).toBe("timeline");

    await f.emit("surface.projection.switched", {
      surface_id: "srf-proj-sw",
      from: "timeline",
      to: "scene",
    });

    const after = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-proj-sw")!;
    expect(after.current_projection).toBe("scene");
  });

  test("surface.scene.block.placed is observational only — no state mutation, version incremented (S4.4)", async () => {
    const f = makeFixture("projection-scene-placed");
    await seedSurface(f, "srf-scene");

    const before = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-scene")!;

    await f.emit("surface.scene.block.placed", {
      surface_id: "srf-scene",
      block_id: "blk-x",
      x: 40,
      y: 40,
      width: 220,
      height: 72,
    });

    const after = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-scene")!;
    expect(after.version).toBe(before.version + 1);
    expect(after.current_projection).toBe("timeline");
    expect(after.blocks).toHaveLength(0);
  });

  // --- S-UCS: streaming deltas + agent observability (ADR-0028 / ADR-0029) ----------------------

  test("surface.agent.reasoning.summary appends to agent_reasoning (S-UCS, ADR-0029)", async () => {
    const f = makeFixture("projection-reasoning");
    await seedSurface(f, "srf-rsn");
    await f.emit("surface.agent.reasoning.summary", {
      surface_id: "srf-rsn",
      agent_cid: "cog-exp",
      agent_id: "explanation",
      packet_id: "cp-1",
      work_id: "wk-1",
      task_interpretation: "explain supervised learning",
      strategy: "retrieval-grounded",
      decision: "produced explanation content via gemini-2.5-flash",
      self_critique: "could add a counter-example",
      confidence: 0.82,
      determinism_level: "D3",
    });
    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-rsn")!;
    expect(state.agent_reasoning).toHaveLength(1);
    expect(state.agent_reasoning[0]?.strategy).toBe("retrieval-grounded");
    expect(state.agent_reasoning[0]?.confidence).toBe(0.82);
    expect(state.agent_reasoning[0]?.work_id).toBe("wk-1");
  });

  test("surface.agent.work.timing upserts agent_work_timings by work_id (S-UCS, ADR-0029)", async () => {
    const f = makeFixture("projection-timing");
    await seedSurface(f, "srf-tmg");
    await f.emit("surface.agent.work.timing", {
      surface_id: "srf-tmg",
      agent_cid: "cog-exp",
      agent_id: "explanation",
      work_id: "wk-1",
      packet_id: "cp-1",
      work_type: "student_interaction",
      status: "executing",
      execution_ms: 0,
    });
    await f.emit("surface.agent.work.timing", {
      surface_id: "srf-tmg",
      agent_cid: "cog-exp",
      agent_id: "explanation",
      work_id: "wk-1",
      packet_id: "cp-1",
      work_type: "student_interaction",
      status: "completed",
      execution_ms: 1240,
    });
    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-tmg")!;
    // Upsert by work_id: one record, latest status + latency.
    expect(state.agent_work_timings).toHaveLength(1);
    expect(state.agent_work_timings[0]?.status).toBe("completed");
    expect(state.agent_work_timings[0]?.execution_ms).toBe(1240);
  });

  test("streaming deltas fold to the SAME settled state as a whole-block emit (S-UCS, ADR-0028)", async () => {
    // Replay equivalence: a streamed block and a whole-block emit must converge byte-identically.
    const streamed = makeFixture("projection-delta-stream");
    await seedSurface(streamed, "srf-d");
    await streamed.emit("surface.block.delta", {
      surface_id: "srf-d",
      block_id: "blk-stream-1",
      seq: 0,
      text_delta: "Supervised learning ",
    });
    await streamed.emit("surface.block.delta", {
      surface_id: "srf-d",
      block_id: "blk-stream-1",
      seq: 1,
      text_delta: "teaches from labeled data.",
    });
    // Mid-stream prefix exposes the partial buffer.
    const midState = foldSurfaceEvents(streamed.bus.replay({ subject: "surface.>" }), "srf-d")!;
    expect(midState.streaming_blocks).toHaveLength(1);
    expect(midState.streaming_blocks[0]?.text).toBe(
      "Supervised learning teaches from labeled data.",
    );
    expect(midState.blocks).toHaveLength(0);

    // The whole block lands with the SAME block_id and clears the buffer.
    await streamed.emit("surface.block.generated", {
      surface_id: "srf-d",
      block: {
        block_id: "blk-stream-1",
        surface_id: "srf-d",
        block_type: "explanation",
        version: 1,
        created_at: "2026-06-11T00:00:00.000Z",
        hlc: "hlc-x",
        title: "Supervised learning",
        content: { summary: "Supervised learning teaches from labeled data." },
        concept_ids: ["supervised-learning"],
        classification: "internal",
        confidence: 0.9,
        provenance: {
          packet_id: "cp-1",
          producer_cid: "cog-exp",
          agent_id: "explanation",
          source_event_id: null,
          world_state_nodes: [],
          memory_mutation_id: null,
          trace_id: null,
          reason: "streamed explanation",
        },
      },
    });
    const streamedSettled = foldSurfaceEvents(
      streamed.bus.replay({ subject: "surface.>" }),
      "srf-d",
    )!;

    // A second surface that emits ONLY the whole block (no deltas).
    const whole = makeFixture("projection-delta-whole");
    await seedSurface(whole, "srf-d");
    await whole.emit("surface.block.generated", {
      surface_id: "srf-d",
      block: {
        block_id: "blk-stream-1",
        surface_id: "srf-d",
        block_type: "explanation",
        version: 1,
        created_at: "2026-06-11T00:00:00.000Z",
        hlc: "hlc-x",
        title: "Supervised learning",
        content: { summary: "Supervised learning teaches from labeled data." },
        concept_ids: ["supervised-learning"],
        classification: "internal",
        confidence: 0.9,
        provenance: {
          packet_id: "cp-1",
          producer_cid: "cog-exp",
          agent_id: "explanation",
          source_event_id: null,
          world_state_nodes: [],
          memory_mutation_id: null,
          trace_id: null,
          reason: "streamed explanation",
        },
      },
    });
    const wholeSettled = foldSurfaceEvents(whole.bus.replay({ subject: "surface.>" }), "srf-d")!;

    // Settled state converges: the transient buffer is cleared and the canonical block content is
    // identical (source_event_id differs because the announcing event differs across logs, by design).
    expect(streamedSettled.streaming_blocks).toHaveLength(0);
    expect(streamedSettled.streaming_blocks).toEqual(wholeSettled.streaming_blocks);
    expect(streamedSettled.blocks).toHaveLength(1);
    expect(streamedSettled.blocks[0]?.block_id).toBe(wholeSettled.blocks[0]?.block_id);
    expect(streamedSettled.blocks[0]?.title).toBe(wholeSettled.blocks[0]?.title);
    expect(streamedSettled.blocks[0]?.content).toEqual(wholeSettled.blocks[0]?.content);
  });

  test("contributeStreaming emits ordered deltas (shared block_id) then the whole block (S-UCS)", async () => {
    const f = makeFixture("projection-contrib-stream");
    await seedSurface(f, "srf-cs");
    const block = await f.contributions.contributeStreaming(
      {
        surface_id: "srf-cs",
        agent_id: "explanation",
        agent_cid: "cog-exp",
        block_type: "explanation",
        title: "Streamed",
        content: { summary: "Alpha beta gamma." },
        concept_ids: ["c"],
        reason: "streamed test",
      },
      ["Alpha ", "beta ", "gamma."],
      0, // no pacing in tests — deltas emit immediately, then the whole block
    );
    if (!block.ok) throw block.error;

    const events = f.bus.replay({ subject: "surface.>" });
    const deltas = events.filter((e) => e.event_type === "surface.block.delta");
    expect(deltas).toHaveLength(3);
    // All deltas reference the SAME block_id as the eventual whole block.
    for (const d of deltas) {
      expect((d.payload as Record<string, unknown>)["block_id"]).toBe(block.value.block_id);
    }

    const state = foldSurfaceEvents(events, "srf-cs")!;
    // Settled: buffer cleared by the whole block; canonical content intact.
    expect(state.streaming_blocks).toHaveLength(0);
    expect(state.blocks).toHaveLength(1);
    expect(state.blocks[0]?.content["summary"]).toBe("Alpha beta gamma.");
  });

  // --- UCS: Cognitive Frames + MCCR + narration split (ADR-0030) -----------------------------

  const sampleMccr = (frameId = "cfr-1") => ({
    core_concept: {
      element_id: "el-c",
      type: "core_concept",
      slot: "headline",
      reveal_order: 0,
      concept_id: "fourier",
      content: { kind: "text", text: "Fourier transform" },
    },
    definition: {
      element_id: "el-d",
      type: "definition",
      slot: "definition",
      reveal_order: 1,
      concept_id: "fourier",
      content: { kind: "text", text: "Decomposes a signal into frequencies." },
    },
    key_formula: {
      element_id: "el-f",
      type: "key_formula",
      slot: "formula",
      reveal_order: 2,
      concept_id: "fourier",
      content: { kind: "formula", latex: "X(f)=\\int x(t)e^{-2\\pi i f t}dt", plain: "X(f) = ..." },
    },
    diagram: {
      element_id: "el-g",
      type: "diagram",
      slot: "diagram",
      reveal_order: 3,
      concept_id: "fourier",
      content: {
        kind: "diagram",
        diagram: {
          kind: "node-graph",
          nodes: [
            { id: "t", label: "time" },
            { id: "f", label: "frequency" },
          ],
          edges: [{ from: "t", to: "f", relation: "transforms to" }],
        },
      },
    },
    _frame_id: frameId,
  });

  const emitComposed = (f: Fixture, surfaceId: string, frameId = "cfr-1") =>
    f.emit("surface.frame.composed", {
      surface_id: surfaceId,
      frame_id: frameId,
      ordinal: 1000,
      concept_id: "fourier",
      title: "What the Fourier transform is",
      mccr: sampleMccr(frameId),
      confidence: 0.83,
      reasoning: "led with intuition, anchored the formula",
      composer_packet_id: "cp-compose-1",
      producer_cid: "cog-composer",
      reason: "composed focus frame",
      world_state_nodes: ["concept:fourier"],
    });

  test("frame slices initialize empty on surface.created (UCS)", async () => {
    const f = makeFixture("frame-init");
    await seedSurface(f, "srf-fi");
    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-fi")!;
    expect(state.frames).toEqual([]);
    expect(state.speculative_frames).toEqual([]);
    expect(state.narration_scripts).toEqual([]);
    expect(state.image_decisions).toEqual([]);
    expect(state.streaming_frame_elements).toEqual([]);
  });

  test("surface.frame.composed folds a frame with full MCCR (UCS)", async () => {
    const f = makeFixture("frame-composed");
    await seedSurface(f, "srf-fc");
    await emitComposed(f, "srf-fc");
    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-fc")!;
    expect(state.frames).toHaveLength(1);
    const frame = state.frames[0]!;
    expect(frame.status).toBe("composed");
    expect(frame.ordinal).toBe(1000);
    expect(frame.mccr?.core_concept?.content).toEqual({ kind: "text", text: "Fourier transform" });
    expect(frame.mccr?.key_formula?.content).toMatchObject({ kind: "formula" });
    // diagram stays structured data — a deterministic client projection, never media.
    const diagram = frame.mccr?.diagram?.content;
    expect(diagram?.kind).toBe("diagram");
    // flat reveal-order index is built deterministically
    expect(frame.mccr?.elements.map((e) => e.element_id)).toEqual(["el-c", "el-d", "el-f", "el-g"]);
    expect(frame.provenance.source_event_id).toBeTruthy();
  });

  test("R4e: a structured misconception folds as the dissolve grammar; a legacy one stays text", async () => {
    const f = makeFixture("frame-misconception");
    await seedSurface(f, "srf-misc");
    await f.emit("surface.frame.composed", {
      surface_id: "srf-misc",
      frame_id: "cfr-m",
      ordinal: 1000,
      concept_id: "entropy",
      title: "Entropy",
      mccr: {
        core_concept: {
          element_id: "el-c",
          type: "core_concept",
          slot: "headline",
          reveal_order: 0,
          concept_id: "entropy",
          content: { kind: "text", text: "Entropy" },
        },
        // Structured dissolve — the fold must reconstruct wrong + correction.
        misconception: {
          element_id: "el-m",
          type: "misconception",
          slot: "aside",
          reveal_order: 1,
          concept_id: "entropy",
          content: {
            kind: "misconception",
            wrong: "Entropy is mess.",
            correction: "It counts microstates.",
          },
        },
        _frame_id: "cfr-m",
      },
      confidence: 0.8,
      reasoning: "named the trap",
      composer_packet_id: "cp-compose-m",
      producer_cid: "cog-composer",
      reason: "composed",
      world_state_nodes: ["concept:entropy"],
    });
    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-misc")!;
    expect(state.frames[0]!.mccr?.misconception?.content).toEqual({
      kind: "misconception",
      wrong: "Entropy is mess.",
      correction: "It counts microstates.",
    });

    // A legacy misconception element (type misconception, kind text) must stay plain text.
    const g = makeFixture("frame-misconception-legacy");
    await seedSurface(g, "srf-misc2");
    await g.emit("surface.frame.composed", {
      surface_id: "srf-misc2",
      frame_id: "cfr-m2",
      ordinal: 1000,
      concept_id: "entropy",
      title: "Entropy",
      mccr: {
        core_concept: {
          element_id: "el-c",
          type: "core_concept",
          slot: "headline",
          reveal_order: 0,
          concept_id: "entropy",
          content: { kind: "text", text: "Entropy" },
        },
        misconception: {
          element_id: "el-m",
          type: "misconception",
          slot: "aside",
          reveal_order: 1,
          concept_id: "entropy",
          content: { kind: "text", text: "It just means disorder." },
        },
        _frame_id: "cfr-m2",
      },
      confidence: 0.8,
      reasoning: "named the trap",
      composer_packet_id: "cp-compose-m2",
      producer_cid: "cog-composer",
      reason: "composed",
      world_state_nodes: ["concept:entropy"],
    });
    const legacy = foldSurfaceEvents(g.bus.replay({ subject: "surface.>" }), "srf-misc2")!;
    expect(legacy.frames[0]!.mccr?.misconception?.content).toEqual({
      kind: "text",
      text: "It just means disorder.",
    });
  });

  test("R4e (Law 9): the fold carries an image element's recorded rationale onto the board", async () => {
    const f = makeFixture("frame-image-rationale");
    await seedSurface(f, "srf-img");
    await f.emit("surface.frame.composed", {
      surface_id: "srf-img",
      frame_id: "cfr-img",
      ordinal: 1000,
      concept_id: "entropy",
      title: "Entropy",
      mccr: {
        core_concept: {
          element_id: "el-c",
          type: "core_concept",
          slot: "headline",
          reveal_order: 0,
          concept_id: "entropy",
          content: { kind: "text", text: "Entropy" },
        },
        image: {
          element_id: "el-image",
          type: "image",
          slot: "image",
          reveal_order: 9,
          concept_id: "entropy",
          content: {
            kind: "image",
            artifact: {
              artifact_id: "art-1",
              content_ref: "blob:art-1",
              mime_type: "image/png",
              provider_id: "prov-1",
            },
            alt: "Illustration of Entropy",
            prompt: "energy dispersing",
            caption: "Energy dispersing",
            labels: [],
            rationale: "Shows dispersal the formula alone hides.",
          },
        },
        _frame_id: "cfr-img",
      },
      confidence: 0.8,
      reasoning: "an image earns its place",
      composer_packet_id: "cp-compose-img",
      producer_cid: "cog-composer",
      reason: "composed",
      world_state_nodes: ["concept:entropy"],
    });
    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-img")!;
    const image = state.frames[0]!.mccr?.image?.content;
    expect(image?.kind).toBe("image");
    expect(image && "rationale" in image ? image.rationale : undefined).toBe(
      "Shows dispersal the formula alone hides.",
    );
  });

  test("R4e: the fold reconstructs a process element's ordered steps (process grammar)", async () => {
    const f = makeFixture("frame-process");
    await seedSurface(f, "srf-proc");
    await f.emit("surface.frame.composed", {
      surface_id: "srf-proc",
      frame_id: "cfr-proc",
      ordinal: 1000,
      concept_id: "long-division",
      title: "Long division",
      mccr: {
        core_concept: {
          element_id: "el-c",
          type: "core_concept",
          slot: "headline",
          reveal_order: 0,
          concept_id: "long-division",
          content: { kind: "text", text: "Long division" },
        },
        process: {
          element_id: "el-process",
          type: "process",
          slot: "process",
          reveal_order: 8,
          concept_id: "long-division",
          content: {
            kind: "process",
            steps: [
              { text: "Divide", detail: "leading digits" },
              { text: "Multiply and subtract", detail: null },
              { text: "Bring down", detail: null },
            ],
          },
        },
        _frame_id: "cfr-proc",
      },
      confidence: 0.8,
      reasoning: "showed the procedure",
      composer_packet_id: "cp-compose-proc",
      producer_cid: "cog-composer",
      reason: "composed",
      world_state_nodes: ["concept:long-division"],
    });
    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-proc")!;
    const proc = state.frames[0]!.mccr?.process?.content;
    expect(proc?.kind).toBe("process");
    const steps = proc && proc.kind === "process" ? proc.steps : [];
    expect(steps.map((s) => s.text)).toEqual(["Divide", "Multiply and subtract", "Bring down"]);
    expect(steps[0]!.detail).toBe("leading digits");
  });

  test("R4e: the fold reconstructs a code element's language + lines (code grammar)", async () => {
    const f = makeFixture("frame-code");
    await seedSurface(f, "srf-code");
    await f.emit("surface.frame.composed", {
      surface_id: "srf-code",
      frame_id: "cfr-code",
      ordinal: 1000,
      concept_id: "gcd",
      title: "Euclid's algorithm",
      mccr: {
        core_concept: {
          element_id: "el-c",
          type: "core_concept",
          slot: "headline",
          reveal_order: 0,
          concept_id: "gcd",
          content: { kind: "text", text: "Euclid's algorithm" },
        },
        code: {
          element_id: "el-code",
          type: "code",
          slot: "code",
          reveal_order: 9,
          concept_id: "gcd",
          content: {
            kind: "code",
            language: "python",
            lines: [
              { text: "def gcd(a, b):", note: "the function" },
              { text: "    while b:", note: null },
              { text: "        a, b = b, a % b", note: null },
            ],
          },
        },
        _frame_id: "cfr-code",
      },
      confidence: 0.8,
      reasoning: "showed the source",
      composer_packet_id: "cp-compose-code",
      producer_cid: "cog-composer",
      reason: "composed",
      world_state_nodes: ["concept:gcd"],
    });
    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-code")!;
    const code = state.frames[0]!.mccr?.code?.content;
    expect(code?.kind).toBe("code");
    if (code && code.kind === "code") {
      expect(code.language).toBe("python");
      // Indentation preserved; the note survives on the annotated line only.
      expect(code.lines[2]!.text).toBe("        a, b = b, a % b");
      expect(code.lines[0]!.note).toBe("the function");
      expect(code.lines[1]!.note).toBeNull();
    }
  });

  test("planned → composed converges to the same frame entry as composed-only (UCS)", async () => {
    const planned = makeFixture("frame-planned");
    await seedSurface(planned, "srf-pc");
    await planned.emit("surface.frame.planned", {
      surface_id: "srf-pc",
      frame_id: "cfr-1",
      ordinal: 1000,
      concept_id: "fourier",
      title: "What the Fourier transform is",
      mccr_layout: {
        archetype: "concept-first",
        slots: [{ element_id: "el-c", type: "core_concept", slot: "headline", reveal_order: 0 }],
      },
      planner_packet_id: "cp-plan-1",
      producer_cid: "cog-planner",
      reason: "planned focus frame",
    });
    await emitComposed(planned, "srf-pc");
    const plannedState = foldSurfaceEvents(planned.bus.replay({ subject: "surface.>" }), "srf-pc")!;

    const composedOnly = makeFixture("frame-composed-only");
    await seedSurface(composedOnly, "srf-pc");
    await emitComposed(composedOnly, "srf-pc");
    const composedState = foldSurfaceEvents(
      composedOnly.bus.replay({ subject: "surface.>" }),
      "srf-pc",
    )!;

    // The frame entries converge (source_event_id differs across logs, by design — like blocks).
    expect(plannedState.frames).toHaveLength(1);
    const a = plannedState.frames[0]!;
    const b = composedState.frames[0]!;
    expect(a.status).toBe("composed");
    expect(a.version).toBe(b.version);
    expect(a.ordinal).toBe(b.ordinal);
    expect(a.title).toBe(b.title);
    expect(a.mccr).toEqual(b.mccr);
  });

  test("frame element deltas fold to the SAME settled frame as a whole compose (UCS)", async () => {
    const streamed = makeFixture("frame-delta");
    await seedSurface(streamed, "srf-fd");
    await streamed.emit("surface.frame.element.delta", {
      surface_id: "srf-fd",
      frame_id: "cfr-1",
      element_id: "el-d",
      seq: 0,
      text_delta: "Decomposes a signal ",
    });
    await streamed.emit("surface.frame.element.delta", {
      surface_id: "srf-fd",
      frame_id: "cfr-1",
      element_id: "el-d",
      seq: 1,
      text_delta: "into frequencies.",
    });
    // Mid-stream prefix exposes the partial element buffer.
    const mid = foldSurfaceEvents(streamed.bus.replay({ subject: "surface.>" }), "srf-fd")!;
    expect(mid.streaming_frame_elements).toHaveLength(1);
    expect(mid.streaming_frame_elements[0]?.text).toBe("Decomposes a signal into frequencies.");
    expect(mid.frames).toHaveLength(0);

    await emitComposed(streamed, "srf-fd");
    const streamedSettled = foldSurfaceEvents(
      streamed.bus.replay({ subject: "surface.>" }),
      "srf-fd",
    )!;

    const whole = makeFixture("frame-whole");
    await seedSurface(whole, "srf-fd");
    await emitComposed(whole, "srf-fd");
    const wholeSettled = foldSurfaceEvents(whole.bus.replay({ subject: "surface.>" }), "srf-fd")!;

    // Transient buffer cleared; the composed frame converges.
    expect(streamedSettled.streaming_frame_elements).toEqual([]);
    expect(streamedSettled.streaming_frame_elements).toEqual(wholeSettled.streaming_frame_elements);
    expect(streamedSettled.frames[0]?.mccr).toEqual(wholeSettled.frames[0]?.mccr);
  });

  test("narration.script.produced and narration.segment frame-linking (UCS)", async () => {
    const f = makeFixture("frame-script");
    await seedSurface(f, "srf-ns");
    await emitComposed(f, "srf-ns");
    await f.emit("surface.narration.script.produced", {
      surface_id: "srf-ns",
      frame_id: "cfr-1",
      script_id: "nsc-1",
      segments: [
        {
          segment_id: "seg-1",
          anchor_ref: "core_concept",
          intent: "introduce",
          text: "Here's the big idea.",
          reveal_ids: ["el-c"],
          pause_after: false,
        },
        {
          segment_id: "seg-2",
          anchor_ref: "key_formula",
          intent: "build",
          text: "Now the formula.",
          reveal_ids: ["el-f"],
          pause_after: true,
        },
      ],
    });
    // The choreographer voices the script as ordinary narration segments targeting MCCR elements.
    await f.emit("surface.narration.segment", {
      surface_id: "srf-ns",
      segment_id: "seg-1",
      frame_id: "cfr-1",
      anchor_ref: "core_concept",
      intent: "introduce",
      concept_id: "fourier",
      sequence: 0,
      text: "Here's the big idea.",
      focus: { target_type: "element", target_id: "el-c", spotlight: true },
      reveal_ids: ["el-c"],
    });

    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-ns")!;
    expect(state.narration_scripts).toHaveLength(1);
    expect(state.narration_scripts[0]?.segments).toHaveLength(2);
    expect(state.narration_scripts[0]?.segments[1]?.anchor_ref).toBe("key_formula");
    // segment links to the frame and spotlights an MCCR element
    expect(state.frames[0]?.segment_ids).toEqual(["seg-1"]);
    expect(state.narration[0]?.frame_id).toBe("cfr-1");
    expect(state.focus?.target_type).toBe("element");
    expect(state.focus?.target_id).toBe("el-c");
  });

  test("image.decided appends to image_decisions (UCS)", async () => {
    const f = makeFixture("frame-image");
    await seedSurface(f, "srf-img");
    await f.emit("surface.image.decided", {
      surface_id: "srf-img",
      frame_id: "cfr-1",
      helps: true,
      modality: "image",
      prompt: "A rotating phasor decomposing a square wave",
      rationale: "a visual makes the time↔frequency mapping concrete",
    });
    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-img")!;
    expect(state.image_decisions).toHaveLength(1);
    expect(state.image_decisions[0]?.helps).toBe(true);
    expect(state.image_decisions[0]?.prompt).toContain("phasor");
  });

  test("speculation prepared → invalidated: absent from frames[] for every prefix (UCS)", async () => {
    const f = makeFixture("frame-spec-invalid");
    await seedSurface(f, "srf-sp");
    await f.emit("surface.frame.speculation.prepared", {
      surface_id: "srf-sp",
      frame_id: "cfr-spec-1",
      speculative_of: "cfr-1",
      concept_id: "convolution",
      trigger_assumption: "mastery>=0.75",
      mccr: sampleMccr("cfr-spec-1"),
      planner_packet_id: "cp-plan-2",
      producer_cid: "cog-planner",
      reason: "look-ahead",
    });
    const afterPrepared = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-sp")!;
    expect(afterPrepared.speculative_frames).toHaveLength(1);
    expect(afterPrepared.frames).toHaveLength(0); // never surfaced

    await f.emit("surface.frame.speculation.invalidated", {
      surface_id: "srf-sp",
      frame_id: "cfr-spec-1",
      reason: "learner asked an unexpected question",
    });
    const afterInvalid = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-sp")!;
    expect(afterInvalid.speculative_frames[0]?.status).toBe("invalidated");
    expect(afterInvalid.speculative_frames[0]?.invalidation_reason).toContain("unexpected");
    expect(afterInvalid.frames).toHaveLength(0); // still absent
  });

  test("speculation prepared → promoted: copied into frames[] (UCS)", async () => {
    const f = makeFixture("frame-spec-promote");
    await seedSurface(f, "srf-pr");
    await f.emit("surface.frame.speculation.prepared", {
      surface_id: "srf-pr",
      frame_id: "cfr-spec-2",
      speculative_of: "cfr-1",
      concept_id: "convolution",
      trigger_assumption: "mastery>=0.75",
      mccr: sampleMccr("cfr-spec-2"),
      planner_packet_id: "cp-plan-3",
      producer_cid: "cog-planner",
      reason: "look-ahead",
    });
    await f.emit("surface.frame.promoted", {
      surface_id: "srf-pr",
      frame_id: "cfr-spec-2",
      ordinal: 2000,
    });
    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), "srf-pr")!;
    expect(state.frames).toHaveLength(1);
    expect(state.frames[0]?.status).toBe("promoted");
    expect(state.frames[0]?.ordinal).toBe(2000);
    expect(state.frames[0]?.mccr?.core_concept?.content).toEqual({
      kind: "text",
      text: "Fourier transform",
    });
  });

  test("a frame-bearing log folds purely (same events ⇒ deep-equal state) (UCS)", async () => {
    const f = makeFixture("frame-pure");
    await seedSurface(f, "srf-fp");
    await emitComposed(f, "srf-fp");
    await f.emit("surface.narration.script.produced", {
      surface_id: "srf-fp",
      frame_id: "cfr-1",
      script_id: "nsc-1",
      segments: [
        {
          segment_id: "seg-1",
          anchor_ref: "core_concept",
          intent: "introduce",
          text: "Idea.",
          reveal_ids: ["el-c"],
          pause_after: false,
        },
      ],
    });
    const events = f.bus.replay({ subject: "surface.>" });
    expect(foldSurfaceEvents(events, "srf-fp")).toEqual(foldSurfaceEvents(events, "srf-fp"));
  });
});
