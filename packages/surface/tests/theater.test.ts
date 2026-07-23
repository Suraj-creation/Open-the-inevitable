/**
 * CSE M7 T1 — the Cognitive Theater (Director + Scene; CSE-011/012, ADR-0033/0038).
 *
 * Covers the authored pedagogy FSM (`decideDirective` — deterministic state selection from folded
 * signals), behavioral affect inference (`inferAffect` — honest absence when there is no evidence),
 * and the `surface.director.*` / `surface.scene.*` fold slices including replay equivalence and the
 * scene evolution log (in-place mutation without a new ask).
 */
import { describe, expect, test } from "vitest";
import { InMemoryEventBus, createEvent } from "@inevitable/events";
import type { CognitiveEvent } from "@inevitable/protocols";
import { ManualClock, SeededIdGenerator, hlcInit, type Hlc } from "@inevitable/shared";
import { foldSurfaceEvents } from "../src/projection";
import { decideDirective, inferAffect, type DirectorSignals } from "../src/theater";

// ---------------------------------------------------------------------------
// The authored pedagogy FSM
// ---------------------------------------------------------------------------

function signals(overrides: Partial<DirectorSignals> = {}): DirectorSignals {
  return {
    conceptRef: "gradient-descent",
    conceptTitle: "Gradient Descent",
    mastered: false,
    lastGatePassed: null,
    inDescent: false,
    frontierSurfaced: false,
    affect: null,
    framesComposed: 1,
    isPractice: false,
    isAssessment: false,
    ...overrides,
  };
}

const IDS = { directiveId: "dir-1", hlc: "hlc-1" };

describe("decideDirective (authored pedagogy FSM — deterministic)", () => {
  test("confusion / frustration → struggling (slow down, support; desirable difficulty)", () => {
    expect(decideDirective(signals({ inDescent: true }), IDS).target_state).toBe("struggling");
    expect(decideDirective(signals({ affect: "frustrated" }), IDS).target_state).toBe("struggling");
    expect(decideDirective(signals({ affect: "overloaded" }), IDS).target_state).toBe("struggling");
    const d = decideDirective(signals({ inDescent: true }), IDS);
    expect(d.pacing.tempo).toBe("slow");
    expect(d.considered[0]?.alternative_state).toBe("practicing"); // names what it rejected
  });

  test("assessment frame → assessing; failed gate → practicing; practice frame → practicing", () => {
    expect(decideDirective(signals({ isAssessment: true }), IDS).target_state).toBe("assessing");
    expect(decideDirective(signals({ lastGatePassed: false }), IDS).target_state).toBe(
      "practicing",
    );
    expect(decideDirective(signals({ isPractice: true }), IDS).target_state).toBe("practicing");
  });

  test("mastered + frontier → mastering (brisk); mastered alone → consolidating (silence)", () => {
    const mastering = decideDirective(signals({ mastered: true, frontierSurfaced: true }), IDS);
    expect(mastering.target_state).toBe("mastering");
    expect(mastering.pacing.tempo).toBe("brisk");
    const consolidating = decideDirective(signals({ mastered: true }), IDS);
    expect(consolidating.target_state).toBe("consolidating");
    expect(consolidating.pacing.silence).toBe(true); // silence is a first-class output (L6)
  });

  test("opening beat → orienting; steady default → learning", () => {
    expect(decideDirective(signals({ framesComposed: 0 }), IDS).target_state).toBe("orienting");
    expect(decideDirective(signals(), IDS).target_state).toBe("learning");
  });

  test("is deterministic: identical signals ⇒ byte-identical directive (replay-safe)", () => {
    const s = signals({ isPractice: true });
    expect(decideDirective(s, IDS)).toEqual(decideDirective(s, IDS));
  });

  test("every directive carries rationale, a rejected alternative, and a confidence (L4)", () => {
    const d = decideDirective(signals(), IDS);
    expect(d.rationale.length).toBeGreaterThan(0);
    expect(d.considered.length).toBeGreaterThan(0);
    expect(d.confidence).toBeGreaterThan(0);
  });

  test("R2b: the Director points at the source region it teaches from (ADR-0057 D2)", () => {
    // Goal-mode (no source): the focus anchor stays null — pre-R2 behavior preserved.
    expect(decideDirective(signals(), IDS).focus.source_anchor_ref).toBeNull();
    // Source-mode: the resolved anchor flows onto the directive's focus (CSE-011 §4).
    const sourced = decideDirective(signals({ sourceAnchorRef: "anc-42" }), IDS);
    expect(sourced.focus.source_anchor_ref).toBe("anc-42");
    expect(sourced.focus.concept_ref).toBe("gradient-descent");
  });
});

describe("inferAffect (behavioral-only; honest absence)", () => {
  test("confusion → frustrated, mastery → confident, no evidence → null", () => {
    expect(
      inferAffect({ inDescent: true, lastGatePassed: null, mastered: false, framesComposed: 1 })
        ?.affect_state,
    ).toBe("frustrated");
    expect(
      inferAffect({ inDescent: false, lastGatePassed: false, mastered: false, framesComposed: 1 })
        ?.affect_state,
    ).toBe("frustrated");
    expect(
      inferAffect({ inDescent: false, lastGatePassed: null, mastered: true, framesComposed: 1 })
        ?.affect_state,
    ).toBe("confident");
    expect(
      inferAffect({ inDescent: false, lastGatePassed: null, mastered: false, framesComposed: 1 }),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Fold slices
// ---------------------------------------------------------------------------

interface Fixture {
  bus: InMemoryEventBus;
  emit: (eventType: string, payload: Record<string, unknown>) => Promise<CognitiveEvent>;
}

function makeFixture(seed = "theater-test"): Fixture {
  const clock = new ManualClock(Date.UTC(2026, 6, 11));
  const idGenerator = new SeededIdGenerator(seed);
  const bus = new InMemoryEventBus({ idGenerator });
  let hlc: Hlc = hlcInit("theater-emitter");
  const emit = async (
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<CognitiveEvent> => {
    const created = createEvent(
      {
        eventType,
        producerCid: "cog-theater",
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
  return { bus, emit };
}

const SURFACE = "srf-theater";

async function seedTheater(f: Fixture): Promise<void> {
  await f.emit("surface.created", {
    surface_id: SURFACE,
    learner_cid: "cog-theater",
    session_id: "intent-theater-001",
    goal: "Teach me gradient descent",
  });
  await f.emit("surface.director.directive", {
    surface_id: SURFACE,
    directive_id: "dir-1",
    scale: "concept",
    target_state: "orienting",
    pacing: { tempo: "measured", dwell_hint_ms: 2600, silence: false },
    intensity: "gentle",
    focus: { concept_ref: "gradient-descent", source_anchor_ref: null },
    rationale: "Getting oriented in Gradient Descent before the details.",
    considered: [
      { alternative_state: "learning", rejected_because: "load too high without orientation" },
    ],
    evidence_refs: [],
    confidence: 0.7,
  });
  await f.emit("surface.affect.observed", {
    surface_id: SURFACE,
    affect_state: "engaged",
    source: "behavioral-inference",
    signals: ["sustained-attention"],
    confidence: 0.4,
  });
  await f.emit("surface.scene.opened", {
    surface_id: SURFACE,
    scene_id: "scn-1",
    frame_ref: "cfr-1",
    concept_ref: "gradient-descent",
    state: "orienting",
    directive_ref: "dir-1",
    actors: [
      {
        actor_id: "act-core",
        kind: "text-anchor",
        content_ref: "el-core_concept",
        role: "protagonist",
        provenance_class: "inference",
        can_evolve: true,
      },
      {
        actor_id: "act-def",
        kind: "text-anchor",
        content_ref: "el-definition",
        role: "support",
        provenance_class: "inference",
        can_evolve: true,
      },
    ],
    lighting: { focus_actor_ref: "act-core", cdl_state: "orienting", recession: ["act-def"] },
  });
}

describe("surface.director.* / surface.scene.* fold slices", () => {
  test("folds directives, affect, and a scene with actors + lighting", async () => {
    const f = makeFixture();
    await seedTheater(f);
    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), SURFACE);
    expect(state).not.toBeNull();
    if (!state) return;

    expect(state.director_directives).toHaveLength(1);
    expect(state.latest_directive?.target_state).toBe("orienting");
    expect(state.latest_directive?.rationale).toContain("oriented");
    expect(state.latest_affect?.affect_state).toBe("engaged");

    expect(state.scenes).toHaveLength(1);
    const scene = state.scenes[0]!;
    expect(scene.frame_ref).toBe("cfr-1");
    expect(scene.actors).toHaveLength(2);
    expect(scene.actors[0]?.role).toBe("protagonist");
    expect(scene.lighting.focus_actor_ref).toBe("act-core");
    expect(scene.lighting.recession).toContain("act-def");
  });

  test("state.entered annotates the directive; a scene delta appends to the evolution log", async () => {
    const f = makeFixture();
    await seedTheater(f);
    await f.emit("surface.director.state.entered", {
      surface_id: SURFACE,
      directive_id: "dir-1",
      scale: "concept",
      state: "orienting",
      evidence_refs: ["frame:cfr-1"],
    });
    await f.emit("surface.scene.evolved", {
      surface_id: SURFACE,
      scene_id: "scn-1",
      delta_id: "scd-1",
      op: "reveal",
      cause: "director",
      payload: { actor_id: "act-def" },
    });
    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), SURFACE);
    expect(state?.latest_directive?.entered_state).toBe("orienting");
    const scene = state?.scenes[0];
    expect(scene?.evolution_log).toHaveLength(1);
    expect(scene?.evolution_log[0]?.op).toBe("reveal");
    expect(scene?.evolution_log[0]?.cause).toBe("director");
  });

  test("scene.closed marks closed, never removes (replay-preserving)", async () => {
    const f = makeFixture();
    await seedTheater(f);
    await f.emit("surface.scene.closed", {
      surface_id: SURFACE,
      scene_id: "scn-1",
      reason: "topic-move",
    });
    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), SURFACE);
    expect(state?.scenes).toHaveLength(1);
    expect(state?.scenes[0]?.closed).toBe(true);
  });

  test("replay equivalence: folding the same log twice is deep-equal", async () => {
    const f = makeFixture();
    await seedTheater(f);
    const log = f.bus.replay({ subject: "surface.>" });
    expect(foldSurfaceEvents(log, SURFACE)).toEqual(foldSurfaceEvents(log, SURFACE));
  });

  test("a log with no theater events folds to null theater slices (backward compat, L2)", async () => {
    const f = makeFixture();
    await f.emit("surface.created", {
      surface_id: SURFACE,
      learner_cid: "cog-theater",
      session_id: "intent-x",
      goal: "g",
    });
    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), SURFACE);
    expect(state?.director_directives).toHaveLength(0);
    expect(state?.latest_directive).toBeNull();
    expect(state?.scenes).toHaveLength(0);
  });
});
