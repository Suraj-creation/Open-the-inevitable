/**
 * CSE M5 — source–surface projection (CSE-008; SRF-002 schema 1.6.0).
 *
 * Covers the pure composer-role planner (`planSourceProjection`) and the six `surface.source.*`
 * fold slices: attached / viewport.planned / viewport.changed / highlight.applied / .cleared /
 * sync.bound — including replay equivalence (same log ⇒ deep-equal state) and the
 * clear-marks-never-removes law.
 */
import { describe, expect, test } from "vitest";
import { InMemoryEventBus, createEvent } from "@inevitable/events";
import type { CognitiveEvent } from "@inevitable/protocols";
import { ManualClock, SeededIdGenerator, hlcInit, type Hlc } from "@inevitable/shared";
import { foldSurfaceEvents } from "../src/projection";
import { planSourceProjection, type SourceEvidenceAnchorView } from "../src/source-projection";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Fixture {
  bus: InMemoryEventBus;
  emit: (eventType: string, payload: Record<string, unknown>) => Promise<CognitiveEvent>;
}

function makeFixture(seed = "source-projection-test"): Fixture {
  const clock = new ManualClock(Date.UTC(2026, 6, 10));
  const idGenerator = new SeededIdGenerator(seed);
  const bus = new InMemoryEventBus({ idGenerator });
  let hlc: Hlc = hlcInit("source-proj-emitter");
  const emit = async (
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<CognitiveEvent> => {
    const created = createEvent(
      {
        eventType,
        producerCid: "cog-source-learner",
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

const SURFACE = "srf-source";

function anchorView(overrides: Partial<SourceEvidenceAnchorView> = {}): SourceEvidenceAnchorView {
  return {
    anchor_id: "anc-000000000001",
    source_version_id: "srcv-aaaaaaaaaaaa",
    concept_ref: "entropy",
    granularity: "paragraph",
    region: {
      path: "p1/blk-2",
      page: 1,
      bbox: [72, 600, 400, 60],
      char_start: 24,
      char_end: 96,
      quote: "Entropy counts the number of microscopic configurations of a system.",
    },
    ...overrides,
  };
}

function seededHex(seed = "planner"): (bytes: number) => string {
  const generator = new SeededIdGenerator(seed);
  return (bytes) => generator.hex(bytes);
}

// ---------------------------------------------------------------------------
// planSourceProjection — the pure composer-role planner
// ---------------------------------------------------------------------------

describe("planSourceProjection", () => {
  test("returns null on no anchors or no segments (honest absence, never a guess)", () => {
    expect(
      planSourceProjection({
        frameId: "cfr-1",
        scriptId: "nsc-1",
        segmentIds: ["nsc-1-s0"],
        anchors: [],
        hex: seededHex(),
      }),
    ).toBeNull();
    expect(
      planSourceProjection({
        frameId: "cfr-1",
        scriptId: "nsc-1",
        segmentIds: [],
        anchors: [anchorView()],
        hex: seededHex(),
      }),
    ).toBeNull();
  });

  test("plans focus-first viewports, one focal highlight, and clamped segment bindings", () => {
    const anchors = [
      anchorView(),
      anchorView({
        anchor_id: "anc-000000000002",
        region: { ...anchorView().region, path: "p1/h-1" },
      }),
    ];
    const planned = planSourceProjection({
      frameId: "cfr-1",
      scriptId: "nsc-1",
      segmentIds: ["nsc-1-s0", "nsc-1-s1", "nsc-1-s2"],
      anchors,
      hex: seededHex(),
    });
    expect(planned).not.toBeNull();
    if (!planned) return;

    // Viewports: first = focus, rest = context; regions carried whole (clients never re-resolve).
    expect(planned.plan.viewports).toHaveLength(2);
    expect(planned.plan.viewports[0]?.emphasis).toBe("focus");
    expect(planned.plan.viewports[1]?.emphasis).toBe("context");
    expect(planned.plan.viewports[0]?.region.quote).toContain("Entropy counts");

    // One focal highlight at a time (CSE-008 §5.2); evidence provenance channel.
    expect(planned.highlights[0]?.amplitude).toBe("focal");
    expect(planned.highlights.filter((h) => h.amplitude === "focal")).toHaveLength(1);
    expect(planned.highlights.every((h) => h.provenance_class === "evidence")).toBe(true);

    // Attention contract: segment i → viewport min(i, last) — minimum dwell holds at the tail.
    expect(planned.sync.bindings).toHaveLength(3);
    expect(planned.sync.bindings[0]?.viewport_ref).toBe(planned.plan.viewports[0]?.viewport_id);
    expect(planned.sync.bindings[1]?.viewport_ref).toBe(planned.plan.viewports[1]?.viewport_id);
    expect(planned.sync.bindings[2]?.viewport_ref).toBe(planned.plan.viewports[1]?.viewport_id);

    // The initial realization is the plan's first step.
    expect(planned.initialChange.viewport_id).toBe(planned.plan.viewports[0]?.viewport_id);
    expect(planned.initialChange.cause).toBe("plan");
  });

  test("is deterministic: same anchors + segments + id stream ⇒ byte-identical plan", () => {
    const input = {
      frameId: "cfr-1",
      scriptId: "nsc-1",
      segmentIds: ["nsc-1-s0", "nsc-1-s1"],
      anchors: [anchorView()],
    };
    const a = planSourceProjection({ ...input, hex: seededHex("same") });
    const b = planSourceProjection({ ...input, hex: seededHex("same") });
    expect(a).toEqual(b);
  });

  test("R2d: binds each segment to the anchor it discusses, typed by slot (ADR-0057 D4)", () => {
    const anchors = [
      anchorView({
        anchor_id: "anc-def",
        region: {
          ...anchorView().region,
          path: "p1/def",
          quote: "Entropy counts the number of microscopic configurations of a system.",
        },
      }),
      anchorView({
        anchor_id: "anc-mis",
        region: {
          ...anchorView().region,
          path: "p1/mis",
          quote:
            "A common error is treating entropy as mere untidiness rather than configurations.",
        },
      }),
    ];
    const planned = planSourceProjection({
      frameId: "cfr-1",
      scriptId: "nsc-1",
      segmentIds: ["nsc-1-s0", "nsc-1-s1"],
      segments: [
        {
          segment_id: "nsc-1-s0",
          text: "Entropy counts the microscopic configurations of a system.",
          anchor_ref: "definition",
        },
        {
          segment_id: "nsc-1-s1",
          text: "A common error treats entropy as untidiness rather than configurations.",
          anchor_ref: "misconception",
        },
      ],
      anchors,
      hex: seededHex(),
    });
    if (!planned) throw new Error("expected a plan");
    // Semantic binding: the definition segment lights the definition anchor; the misconception
    // segment lights the misconception anchor — NOT positional (s0→vp0, s1→vp1 only because meaning).
    const s0 = planned.sync.bindings[0]!;
    const s1 = planned.sync.bindings[1]!;
    const vpOf = (aid: string) =>
      planned.plan.viewports.find((v) => v.anchor_ref === aid)!.viewport_id;
    expect(s0.viewport_ref).toBe(vpOf("anc-def"));
    expect(s1.viewport_ref).toBe(vpOf("anc-mis"));
    // Roles are typed from the segment's MCCR slot, not hardcoded evidence.
    const roleOf = (aid: string) => planned.highlights.find((h) => h.anchor_ref === aid)!.role;
    expect(roleOf("anc-def")).toBe("definition");
    expect(roleOf("anc-mis")).toBe("misconception");
    expect(planned.highlights.every((h) => h.decided_by === "semantic-binder")).toBe(true);
  });

  test("R2d: the entailment gate lights NOTHING for an unsupported segment (ADR-0057 D4)", () => {
    const planned = planSourceProjection({
      frameId: "cfr-1",
      scriptId: "nsc-1",
      segmentIds: ["nsc-1-s0"],
      segments: [
        {
          // Talks about something the anchor never mentions — must not light the wrong region.
          segment_id: "nsc-1-s0",
          text: "Photosynthesis converts sunlight into chemical energy inside chloroplasts.",
          anchor_ref: "definition",
        },
      ],
      anchors: [anchorView()], // quote is about entropy/configurations
      hex: seededHex(),
    });
    if (!planned) throw new Error("expected a plan");
    // The viewport still orients on the focus region, but NO highlight fires (never a wrong pointer).
    expect(planned.sync.bindings[0]?.viewport_ref).toBe(planned.plan.viewports[0]?.viewport_id);
    expect(planned.sync.bindings[0]?.highlight_refs).toEqual([]);
  });

  test("ignores anchors from a second source version (one plan, one source)", () => {
    const planned = planSourceProjection({
      frameId: "cfr-1",
      scriptId: "nsc-1",
      segmentIds: ["nsc-1-s0"],
      anchors: [anchorView(), anchorView({ anchor_id: "anc-x", source_version_id: "srcv-other" })],
      hex: seededHex(),
    });
    expect(planned?.plan.viewports).toHaveLength(1);
    expect(planned?.plan.source_version_id).toBe("srcv-aaaaaaaaaaaa");
  });
});

// ---------------------------------------------------------------------------
// Fold slices
// ---------------------------------------------------------------------------

async function seedSurfaceWithProjection(f: Fixture): Promise<void> {
  await f.emit("surface.created", {
    surface_id: SURFACE,
    learner_cid: "cog-source-learner",
    session_id: "intent-source-001",
    goal: "Teach me entropy from this book",
  });
  await f.emit("surface.source.attached", {
    surface_id: SURFACE,
    source_id: "src-book",
    source_version_id: "srcv-aaaaaaaaaaaa",
    modality: "pdf",
    title: "Statistical Mechanics",
    layers_available: ["structural", "visual", "semantic"],
    content_ref: "gateway:/api/sources/srcv-aaaaaaaaaaaa/content",
  });
  await f.emit("surface.source.viewport.planned", {
    surface_id: SURFACE,
    plan_id: "vpp-1",
    frame_id: "cfr-1",
    source_version_id: "srcv-aaaaaaaaaaaa",
    viewports: [
      {
        viewport_id: "vp-1",
        anchor_ref: "anc-000000000001",
        emphasis: "focus",
        ordinal: 0,
        region: anchorView().region,
      },
    ],
  });
  await f.emit("surface.source.highlight.applied", {
    surface_id: SURFACE,
    highlight_id: "hl-1",
    frame_id: "cfr-1",
    source_version_id: "srcv-aaaaaaaaaaaa",
    anchor_ref: "anc-000000000001",
    role: "evidence",
    amplitude: "focal",
    lifetime: "held",
    provenance_class: "evidence",
    decided_by: "viewport-planner",
    region: anchorView().region,
  });
  await f.emit("surface.source.sync.bound", {
    surface_id: SURFACE,
    frame_id: "cfr-1",
    script_id: "nsc-1",
    bindings: [{ segment_id: "nsc-1-s0", viewport_ref: "vp-1", highlight_refs: ["hl-1"] }],
  });
  await f.emit("surface.source.viewport.changed", {
    surface_id: SURFACE,
    viewport_id: "vp-1",
    plan_id: "vpp-1",
    source_version_id: "srcv-aaaaaaaaaaaa",
    cause: "plan",
  });
}

describe("surface.source.* fold slices", () => {
  test("folds the full projection chain into typed state slices", async () => {
    const f = makeFixture();
    await seedSurfaceWithProjection(f);
    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), SURFACE);
    expect(state).not.toBeNull();
    if (!state) return;

    expect(state.sources).toHaveLength(1);
    expect(state.sources[0]?.modality).toBe("pdf");
    expect(state.sources[0]?.layers_available).toContain("semantic");

    expect(state.viewport_plans).toHaveLength(1);
    expect(state.viewport_plans[0]?.viewports[0]?.region.bbox).toEqual([72, 600, 400, 60]);
    expect(state.viewport_plans[0]?.viewports[0]?.region.page).toBe(1);

    expect(state.source_highlights).toHaveLength(1);
    expect(state.source_highlights[0]?.role).toBe("evidence");
    expect(state.source_highlights[0]?.cleared).toBe(false);

    expect(state.sync_bindings).toHaveLength(1);
    expect(state.sync_bindings[0]?.bindings[0]?.viewport_ref).toBe("vp-1");

    expect(state.viewport_changes).toHaveLength(1);
    expect(state.viewport_changes[0]?.cause).toBe("plan");
  });

  test("re-attachment and re-planning upsert (SSE redelivery never duplicates)", async () => {
    const f = makeFixture();
    await seedSurfaceWithProjection(f);
    // Redeliver the attach + plan with identical ids.
    await f.emit("surface.source.attached", {
      surface_id: SURFACE,
      source_id: "src-book",
      source_version_id: "srcv-aaaaaaaaaaaa",
      modality: "pdf",
      title: "Statistical Mechanics",
      layers_available: ["structural", "visual", "semantic"],
      content_ref: "gateway:/api/sources/srcv-aaaaaaaaaaaa/content",
    });
    await f.emit("surface.source.sync.bound", {
      surface_id: SURFACE,
      frame_id: "cfr-1",
      script_id: "nsc-1",
      bindings: [{ segment_id: "nsc-1-s0", viewport_ref: "vp-1", highlight_refs: ["hl-1"] }],
    });
    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), SURFACE);
    expect(state?.sources).toHaveLength(1);
    expect(state?.sync_bindings).toHaveLength(1);
  });

  test("highlight.cleared marks by scope and never removes (replay-preserving)", async () => {
    const f = makeFixture();
    await seedSurfaceWithProjection(f);
    await f.emit("surface.source.highlight.applied", {
      surface_id: SURFACE,
      highlight_id: "hl-2",
      frame_id: "cfr-2",
      source_version_id: "srcv-aaaaaaaaaaaa",
      anchor_ref: "anc-000000000002",
      role: "definition",
      amplitude: "whisper",
      lifetime: "persistent-tint",
      provenance_class: "evidence",
      decided_by: "viewport-planner",
      region: anchorView().region,
    });
    // Clear by frame scope: only cfr-1's highlight is marked.
    await f.emit("surface.source.highlight.cleared", {
      surface_id: SURFACE,
      scope: { frame_id: "cfr-1" },
    });
    const state = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), SURFACE);
    expect(state?.source_highlights).toHaveLength(2);
    expect(state?.source_highlights.find((h) => h.highlight_id === "hl-1")?.cleared).toBe(true);
    expect(state?.source_highlights.find((h) => h.highlight_id === "hl-2")?.cleared).toBe(false);

    // Clear by explicit ids.
    await f.emit("surface.source.highlight.cleared", {
      surface_id: SURFACE,
      scope: { highlight_ids: ["hl-2"] },
    });
    const after = foldSurfaceEvents(f.bus.replay({ subject: "surface.>" }), SURFACE);
    expect(after?.source_highlights.every((h) => h.cleared)).toBe(true);
  });

  test("replay equivalence: folding the same log twice is deep-equal", async () => {
    const f = makeFixture();
    await seedSurfaceWithProjection(f);
    const log = f.bus.replay({ subject: "surface.>" });
    expect(foldSurfaceEvents(log, SURFACE)).toEqual(foldSurfaceEvents(log, SURFACE));
  });
});
