/**
 * CSE M8 T2 — Knowledge Cinematography (CSE-013, ADR-0039) + the Interaction Grammar (CSE-014).
 *
 * Covers: the pure `planShots` composer-role planner (establish → spotlights / hold), the mandatory
 * reduced-motion realization coverage (accessibility conformance), `interpretIntent` determinism +
 * classification, and the `surface.shot.planned` / `surface.intent.expressed` / learner-caused
 * `surface.scene.evolved` fold slices.
 */
import { describe, expect, test } from "vitest";
import { InMemoryEventBus, createEvent } from "@inevitable/events";
import type { CognitiveEvent } from "@inevitable/protocols";
import { ManualClock, SeededIdGenerator, hlcInit, type Hlc } from "@inevitable/shared";
import { foldSurfaceEvents } from "../src/projection";
import {
  REDUCED_MOTION_REALIZATION,
  SHOT_KINDS,
  planShots,
  type PlanShotsInput,
} from "../src/cinematography";
import { INTERACTION_GRAMMAR, interpretIntent } from "../src/interaction";

// ---------------------------------------------------------------------------
// planShots — the composer-role shot planner
// ---------------------------------------------------------------------------

function shotInput(overrides: Partial<PlanShotsInput> = {}): PlanShotsInput {
  const gen = new SeededIdGenerator("shots");
  return {
    sceneId: "scn-1",
    actors: [
      { actor_id: "act-core", role: "protagonist", content_ref: "el-core_concept" },
      { actor_id: "act-def", role: "support", content_ref: "el-definition" },
    ],
    directive: { target_state: "learning", intensity: "normal", silence: false },
    segments: [
      { segment_id: "seg-0", element_id: "el-core_concept" },
      { segment_id: "seg-1", element_id: "el-definition" },
      { segment_id: "seg-2", element_id: null },
    ],
    hex: (bytes) => gen.hex(bytes),
    ...overrides,
  };
}

describe("planShots (cinematography — deterministic composer role)", () => {
  test("opens with an establish shot, then a spotlight per narration segment that names an actor", () => {
    const shots = planShots(shotInput());
    expect(shots[0]?.kind).toBe("establish");
    const spotlights = shots.filter((s) => s.kind === "spotlight");
    expect(spotlights).toHaveLength(2); // el-core_concept + el-definition; the null segment is skipped
    expect(spotlights[0]?.subject).toBe("act-core");
    expect(spotlights[0]?.narration_anchor_ref).toBe("seg-0"); // the camera follows the voice
    expect(shots.every((s) => s.intent.length > 0)).toBe(true); // every move means something (§2)
  });

  test("a demanding or silent directive holds still instead of spotlighting (ADR-0033 L6)", () => {
    const demanding = planShots(
      shotInput({
        directive: { target_state: "assessing", intensity: "demanding", silence: false },
      }),
    );
    expect(demanding.map((s) => s.kind)).toEqual(["establish", "hold"]);
    const silent = planShots(
      shotInput({
        directive: { target_state: "consolidating", intensity: "gentle", silence: true },
      }),
    );
    expect(silent.some((s) => s.kind === "hold")).toBe(true);
    expect(silent.some((s) => s.kind === "spotlight")).toBe(false);
  });

  test("is deterministic: same inputs + id stream ⇒ byte-identical shot list", () => {
    const a = planShots(shotInput());
    const b = planShots(shotInput());
    expect(a).toEqual(b);
  });

  test("every shot kind has a reduced-motion realization (accessibility conformance, CSE-013 §6)", () => {
    for (const kind of SHOT_KINDS) {
      expect(REDUCED_MOTION_REALIZATION[kind]).toBeDefined();
      expect(REDUCED_MOTION_REALIZATION[kind].length).toBeGreaterThan(0);
    }
    // The table has no stray keys beyond the vocabulary.
    expect(Object.keys(REDUCED_MOTION_REALIZATION).sort()).toEqual([...SHOT_KINDS].sort());
    // Every planned shot carries its discrete realization inline.
    expect(planShots(shotInput()).every((s) => s.reduced_motion.length > 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// interpretIntent — the interaction grammar
// ---------------------------------------------------------------------------

describe("interpretIntent (interaction grammar — deterministic)", () => {
  test("classifies Mark / Ask / Navigate / Govern-flow and routes each", () => {
    expect(interpretIntent("annotate", "el-def").cls).toBe("mark");
    expect(interpretIntent("annotate", "el-def").routing).toBe("scene-annotate");
    expect(interpretIntent("ask_simpler", "el-core").cls).toBe("ask");
    expect(interpretIntent("ask_simpler", "el-core").routing).toBe("enrichment-reframe");
    expect(interpretIntent("jump", "gradient-descent").routing).toBe("director");
    expect(interpretIntent("interrupt", null).cls).toBe("govern-flow");
  });

  test("an unknown kind degrades to a safe ask-why at the target, never a guessed intent (§7)", () => {
    const i = interpretIntent("frobnicate", "el-x");
    expect(i.cls).toBe("ask");
    expect(i.cognitive_intent).toContain("el-x");
  });

  test("a free-text note enriches the intent string but never changes the routing", () => {
    const withNote = interpretIntent("ask_why", "el-core", "but what about edge cases?");
    expect(withNote.routing).toBe("enrichment-reframe");
    expect(withNote.cognitive_intent).toContain("edge cases");
    expect(withNote.cognitive_intent).toContain("el-core");
  });

  test("is deterministic + the grammar has all seven classes", () => {
    expect(interpretIntent("circle", "el-a")).toEqual(interpretIntent("circle", "el-a"));
    const classes = new Set(Object.values(INTERACTION_GRAMMAR).map((e) => e.cls));
    expect(classes).toEqual(
      new Set(["attend", "mark", "ask", "reason", "express", "navigate", "govern-flow"]),
    );
  });
});

// ---------------------------------------------------------------------------
// Fold slices
// ---------------------------------------------------------------------------

interface Fixture {
  bus: InMemoryEventBus;
  emit: (t: string, p: Record<string, unknown>) => Promise<CognitiveEvent>;
}
function makeFixture(seed = "cine-test"): Fixture {
  const clock = new ManualClock(Date.UTC(2026, 6, 12));
  const idGenerator = new SeededIdGenerator(seed);
  const bus = new InMemoryEventBus({ idGenerator });
  let hlc: Hlc = hlcInit("cine-emitter");
  const emit = async (t: string, p: Record<string, unknown>): Promise<CognitiveEvent> => {
    const created = createEvent(
      {
        eventType: t,
        producerCid: "cog-cine",
        producerType: "product.surface",
        payload: p,
        topic: `cos.${t}`,
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

const SURFACE = "srf-cine";

describe("surface.shot.* / surface.intent.expressed / learner scene delta fold slices", () => {
  async function seed(f: Fixture): Promise<void> {
    await f.emit("surface.created", {
      surface_id: SURFACE,
      learner_cid: "cog-cine",
      session_id: "intent-cine-001",
      goal: "Teach me shots",
    });
    await f.emit("surface.scene.opened", {
      surface_id: SURFACE,
      scene_id: "scn-1",
      frame_ref: "cfr-1",
      concept_ref: "shots",
      state: "learning",
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
      ],
      lighting: { focus_actor_ref: "act-core", cdl_state: "learning", recession: [] },
    });
    await f.emit("surface.shot.planned", {
      surface_id: SURFACE,
      shot_id: "sht-1",
      scene_ref: "scn-1",
      kind: "establish",
      subject: "act-core",
      intent: "orient before detail",
      narration_anchor_ref: null,
      reduced_motion: "show the whole scene at once, no zoom",
      cause: "scene",
    });
    await f.emit("surface.shot.planned", {
      surface_id: SURFACE,
      shot_id: "sht-2",
      scene_ref: "scn-1",
      kind: "spotlight",
      subject: "act-core",
      intent: "follow the voice",
      narration_anchor_ref: "seg-0",
      reduced_motion: "instant highlight of the subject; siblings dimmed",
      cause: "cinematography",
    });
  }

  test("shots append to their scene's shot list; a learner mark evolves the scene in place", async () => {
    const f = makeFixture();
    await seed(f);
    await f.emit("surface.intent.expressed", {
      surface_id: SURFACE,
      interaction_id: "ix-1",
      kind: "annotate",
      class: "mark",
      cognitive_intent: "annotate el-core_concept",
      target_anchor_ref: "el-core_concept",
    });
    await f.emit("surface.scene.evolved", {
      surface_id: SURFACE,
      scene_id: "scn-1",
      delta_id: "scd-1",
      op: "annotate",
      cause: "learner",
      payload: { kind: "annotate", target_anchor_ref: "el-core_concept" },
      interaction_ref: "ix-1",
    });

    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), SURFACE);
    const scene = state?.scenes[0];
    expect(scene?.shots).toHaveLength(2);
    expect(scene?.shots[0]?.kind).toBe("establish");
    expect(scene?.shots[1]?.narration_anchor_ref).toBe("seg-0");
    // The learner-caused evolution landed in the scene's evolution log with its interaction ref.
    expect(scene?.evolution_log).toHaveLength(1);
    expect(scene?.evolution_log[0]?.cause).toBe("learner");
    expect(scene?.evolution_log[0]?.interaction_ref).toBe("ix-1");
    // The typed intent folded.
    expect(state?.expressed_intents).toHaveLength(1);
    expect(state?.expressed_intents[0]?.cls).toBe("mark");
  });

  test("replay equivalence: folding the same log twice is deep-equal", async () => {
    const f = makeFixture();
    await seed(f);
    const log = f.bus.replay({ subject: "surface.>" });
    expect(foldSurfaceEvents(log, SURFACE)).toEqual(foldSurfaceEvents(log, SURFACE));
  });
});
