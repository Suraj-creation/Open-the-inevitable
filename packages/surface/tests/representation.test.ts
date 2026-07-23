/**
 * Representation Intelligence (CSE-018, ADR-0058) — R4a, the deterministic parity floor. The
 * `planRepresentation` pure function maps a frame's elements onto the hierarchy + epistemic-role
 * vocabulary, and `surface.representation.planned` folds into the `representations` slice, upserted
 * by frame_id. The plan is metadata over the same elements — parity with today's render.
 */
import { describe, expect, test } from "vitest";
import { InMemoryEventBus, createEvent } from "@inevitable/events";
import { ManualClock, SeededIdGenerator, hlcInit, type Hlc } from "@inevitable/shared";
import { foldSurfaceEvents } from "../src/projection";
import {
  epistemicRoleFor,
  expertiseFromMastery,
  hierarchyFor,
  planRepresentation,
} from "../src/representation";

describe("planRepresentation (R4a)", () => {
  test("maps element types to hierarchy + epistemic role (deterministic parity metadata)", () => {
    const plan = planRepresentation({
      frameId: "cfr-1",
      elements: [
        { element_id: "el-core", type: "core_concept" },
        { element_id: "el-def", type: "definition" },
        { element_id: "el-mis", type: "misconception" },
        { element_id: "el-cue", type: "memory_cue" },
        { element_id: "el-ex", type: "key_example" },
        { element_id: "el-src", type: "source_viewport" },
      ],
    });
    expect(plan.plan_kind).toBe("deterministic");
    expect(plan.exclusions).toEqual([]);
    const byId = Object.fromEntries(plan.composition.map((c) => [c.element_id, c]));
    expect(byId["el-core"]).toMatchObject({ hierarchy: "primary", epistemic_role: "canonical" });
    expect(byId["el-def"]).toMatchObject({ hierarchy: "primary", epistemic_role: "definition" });
    expect(byId["el-mis"]).toMatchObject({
      hierarchy: "supporting",
      epistemic_role: "misconception",
    });
    expect(byId["el-cue"]).toMatchObject({ hierarchy: "residue", epistemic_role: "memory-cue" });
    expect(byId["el-ex"]!.epistemic_role).toBe("example");
    expect(byId["el-src"]!.epistemic_role).toBe("evidence");
    // R4d density verdict (Law 3): 6 elements is within the budget of 8.
    expect(plan.density).toMatchObject({ count: 6, budget: 8, within_budget: true });
  });

  test("R4d: the density verdict flags an over-budget frame (Law 3 → split upstream)", () => {
    const elements = Array.from({ length: 10 }, (_, i) => ({
      element_id: `el-${i}`,
      type: "definition",
    }));
    const plan = planRepresentation({ frameId: "cfr-dense", elements });
    expect(plan.density.count).toBe(10);
    expect(plan.density.within_budget).toBe(false);
  });

  test("unknown element types fall back to supporting/observation (never crash)", () => {
    expect(hierarchyFor("mystery-slot")).toBe("supporting");
    expect(epistemicRoleFor("mystery-slot")).toBe("observation");
  });

  test("R4e (Law 8): an expert recedes scaffold supporting anchors to residue; adaptivity recorded", () => {
    const elements = [
      { element_id: "el-core", type: "core_concept" },
      { element_id: "el-ex", type: "key_example" }, // scaffold (example) — recedes for an expert
      { element_id: "el-mm", type: "mental_model" }, // scaffold (insight) — recedes for an expert
    ];
    const expert = planRepresentation({ frameId: "cfr-x", elements, expertise: "expert" });
    const byId = Object.fromEntries(expert.composition.map((c) => [c.element_id, c]));
    expect(byId["el-core"]!.hierarchy).toBe("primary"); // the concept never recedes
    expect(byId["el-ex"]!.hierarchy).toBe("residue"); // worked example → residue (expertise reversal)
    expect(byId["el-mm"]!.hierarchy).toBe("residue"); // analogy → residue
    expect(expert.adaptivity).toMatchObject({ expertise: "expert" });
    expect(expert.adaptivity?.note).toMatch(/expertise reversal/i);
  });

  test("R4e (Law 8): a novice keeps full scaffolding; no expertise ⇒ un-adapted floor (parity)", () => {
    const elements = [{ element_id: "el-ex", type: "key_example" }];
    const novice = planRepresentation({ frameId: "cfr-n", elements, expertise: "novice" });
    expect(novice.composition[0]!.hierarchy).toBe("supporting"); // scaffolding stays for a novice
    expect(novice.adaptivity).toMatchObject({ expertise: "novice" });

    const floor = planRepresentation({ frameId: "cfr-f", elements });
    expect(floor.composition[0]!.hierarchy).toBe("supporting");
    expect(floor.adaptivity).toBeNull(); // un-adapted floor — byte-parity with the pre-Law-8 plan
  });
});

describe("expertiseFromMastery (R5 — the live Law 8 signal)", () => {
  const node = (status: string, confidence: number | null) => ({ status, confidence });

  test("no mastery evidence ⇒ null (learner unknown → un-adapted floor)", () => {
    expect(expertiseFromMastery([])).toBeNull();
    expect(expertiseFromMastery([node("available", null), node("in_progress", null)])).toBeNull();
  });

  test("broad, high-confidence mastery ⇒ expert (scaffolding will compress)", () => {
    const nodes = [
      node("mastered", 0.9),
      node("mastered", 0.85),
      node("mastered", 0.88),
      node("in_progress", null),
    ];
    expect(expertiseFromMastery(nodes)).toBe("expert");
  });

  test("a single early checkpoint ⇒ novice", () => {
    expect(expertiseFromMastery([node("mastered", 0.7), node("available", null)])).toBe("novice");
  });

  test("moderate mastery ⇒ intermediate", () => {
    const nodes = [
      node("mastered", 0.72),
      node("mastered", 0.7),
      node("available", null),
      node("available", null),
    ];
    expect(expertiseFromMastery(nodes)).toBe("intermediate");
  });
});

describe("surface.representation.planned fold (R4a)", () => {
  test("folds into the representations slice, upserted by frame_id", async () => {
    const clock = new ManualClock(Date.UTC(2026, 6, 18));
    const idGenerator = new SeededIdGenerator("rep-fold");
    const bus = new InMemoryEventBus({ idGenerator });
    let hlc: Hlc = hlcInit("rep-emitter");
    const emit = async (eventType: string, payload: Record<string, unknown>): Promise<void> => {
      const created = createEvent(
        {
          eventType,
          producerCid: "cog-rep",
          producerType: "product.surface",
          payload,
          topic: `cos.${eventType}`,
          classification: "internal",
        },
        { clock, hlc, idGenerator },
      );
      hlc = created.hlc;
      await bus.publish(created.event);
    };

    await emit("surface.created", {
      surface_id: "srf-rep",
      learner_cid: "cog-rep",
      session_id: "intent-rep",
      goal: "Teach me entropy",
    });
    const plan = planRepresentation({
      frameId: "cfr-1",
      elements: [{ element_id: "el-core", type: "core_concept" }],
    });
    await emit("surface.representation.planned", {
      surface_id: "srf-rep",
      frame_id: "cfr-1",
      composition: plan.composition,
      exclusions: plan.exclusions,
      plan_kind: plan.plan_kind,
    });
    // A re-plan of the same frame upserts (never duplicates).
    await emit("surface.representation.planned", {
      surface_id: "srf-rep",
      frame_id: "cfr-1",
      composition: plan.composition,
      exclusions: [],
      plan_kind: "deterministic",
    });

    const state = foldSurfaceEvents(bus.replay({ subject: "surface.>" }), "srf-rep");
    expect(state?.representations).toHaveLength(1);
    expect(state?.representations[0]?.frame_id).toBe("cfr-1");
    expect(state?.representations[0]?.composition[0]).toMatchObject({
      element_id: "el-core",
      hierarchy: "primary",
      epistemic_role: "canonical",
    });
    // No adaptivity in the payload ⇒ null (un-adapted floor).
    expect(state?.representations[0]?.adaptivity).toBeNull();
  });

  test("R4e (Law 8): the fold reconstructs the adaptivity note when present", async () => {
    const clock = new ManualClock(Date.UTC(2026, 6, 23));
    const idGenerator = new SeededIdGenerator("rep-adapt");
    const bus = new InMemoryEventBus({ idGenerator });
    let hlc: Hlc = hlcInit("rep-adapt-emitter");
    const emit = async (eventType: string, payload: Record<string, unknown>): Promise<void> => {
      const created = createEvent(
        {
          eventType,
          producerCid: "cog-rep",
          producerType: "product.surface",
          payload,
          topic: `cos.${eventType}`,
          classification: "internal",
        },
        { clock, hlc, idGenerator },
      );
      hlc = created.hlc;
      await bus.publish(created.event);
    };
    await emit("surface.created", {
      surface_id: "srf-adapt",
      learner_cid: "cog-rep",
      session_id: "intent-adapt",
      goal: "Teach me entropy",
    });
    const plan = planRepresentation({
      frameId: "cfr-1",
      elements: [{ element_id: "el-ex", type: "key_example" }],
      expertise: "expert",
    });
    await emit("surface.representation.planned", {
      surface_id: "srf-adapt",
      frame_id: "cfr-1",
      composition: plan.composition,
      exclusions: plan.exclusions,
      plan_kind: plan.plan_kind,
      adaptivity: plan.adaptivity,
    });
    const state = foldSurfaceEvents(bus.replay({ subject: "surface.>" }), "srf-adapt");
    expect(state?.representations[0]?.adaptivity).toMatchObject({ expertise: "expert" });
    // The expert plan receded the worked example to residue (Law 8).
    expect(state?.representations[0]?.composition[0]?.hierarchy).toBe("residue");
  });
});
