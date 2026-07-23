import { describe, expect, it } from "vitest";
import type { CognitiveEvent } from "@inevitable/protocols";
import { foldSourceCognition, SOURCE_EVENT_TYPES } from "../src/index";

/**
 * Deep-transparency projection (CSE M12 T1, ADR-0050): the source plane's cognition folds into an
 * observable summary — activity counts, layer health (confidence + HONEST degradation), D3 model
 * calls, and provenance-bearing recent entries. Pure + deterministic (fold twice ⇒ deep-equal).
 */

let seq = 0;
function evt(
  event_type: string,
  payload: Record<string, unknown>,
  producer_cid = "cog-source-fusion",
): CognitiveEvent {
  seq += 1;
  return {
    event_id: `e-${seq}`,
    event_type,
    schema_version: "1.0.0",
    timestamp: "2026-07-17T00:00:00.000Z",
    hlc: `hlc-${String(seq).padStart(4, "0")}`,
    sequence: seq,
    producer_cid,
    producer_type: "product.source-environment",
    payload,
    classification: "internal",
  };
}

function scenario(): CognitiveEvent[] {
  return [
    evt(
      SOURCE_EVENT_TYPES.versionRegistered,
      { modality: "markdown", version_id: "v1" },
      "cog-source-hub",
    ),
    evt(
      SOURCE_EVENT_TYPES.layerConstructed,
      { version_id: "v1", layer: "structural", confidence: 1 },
      "cog-source-hub",
    ),
    evt(
      SOURCE_EVENT_TYPES.layerConstructed,
      { version_id: "v1", layer: "semantic", confidence: 0.82 },
      "cog-source-hub",
    ),
    evt(
      SOURCE_EVENT_TYPES.layerDegraded,
      { version_id: "v1", layer: "citation", confidence: 0.4, reason: "below floor" },
      "cog-source-hub",
    ),
    evt(
      "model.output.recorded",
      { invocation_key: "k1", provider: "gemini", response: { model: "gemini-2.5-flash" } },
      "cog-source-hub",
    ),
    evt(
      SOURCE_EVENT_TYPES.claimRecorded,
      { statement: "Gradient descent minimizes a loss.", epistemic_status: "asserted" },
      "cog-source-claim",
    ),
    evt(
      SOURCE_EVENT_TYPES.contradictionDetected,
      { nature: "interpretive", source_version_ids: ["v1", "v2"] },
      "cog-source-claim",
    ),
    evt(SOURCE_EVENT_TYPES.fusionSynthesized, {
      concept_ref: "gradient-descent",
      acknowledges_disagreement: true,
      degraded: false,
    }),
    evt(
      SOURCE_EVENT_TYPES.frontierUpdated,
      { concept_ref: "transformers", entry_count: 3, citation_count: 3, degraded: false },
      "cog-source-frontier",
    ),
    evt(
      SOURCE_EVENT_TYPES.timelineUpdated,
      { concept_ref: "ai", state_count: 0, citation_count: 0, degraded: true },
      "cog-source-temporal",
    ),
    evt(
      SOURCE_EVENT_TYPES.creationStarted,
      { creation_id: "crt-1", kind: "essay" },
      "cog-source-creation",
    ),
    evt(
      SOURCE_EVENT_TYPES.creationEvolved,
      { creation_id: "crt-1", assist_kind: "scaffold", degraded: false },
      "cog-source-creation",
    ),
    evt(
      SOURCE_EVENT_TYPES.creationCritiqued,
      { creation_id: "crt-1", assist_kind: "critique", degraded: true },
      "cog-source-creation",
    ),
    evt(
      SOURCE_EVENT_TYPES.creationCompleted,
      { creation_id: "crt-1", kind: "essay", assist_count: 2 },
      "cog-source-creation",
    ),
    evt(
      SOURCE_EVENT_TYPES.creationContributed,
      { creation_id: "crt-1", kind: "essay", source_version_id: "sv-9", assist_count: 2 },
      "cog-source-creation",
    ),
    evt(
      SOURCE_EVENT_TYPES.consentGranted,
      { consent_ref: "consent:creation:crt-1", source_version_id: "sv-9", scope: "commons" },
      "cog-source-consent",
    ),
    evt(
      SOURCE_EVENT_TYPES.consentRevoked,
      { consent_ref: "consent:creation:crt-1", source_version_id: "sv-9" },
      "cog-source-consent",
    ),
    evt(
      SOURCE_EVENT_TYPES.redactionCascaded,
      {
        consent_ref: "consent:creation:crt-1",
        source_version_id: "sv-9",
        redacted_counts: { commons_entries: 1, content_withheld: 1 },
      },
      "cog-source-consent",
    ),
    // Noise the projection must ignore (not a source.* or model event).
    evt("surface.frame.composed", { frame_id: "f1" }, "cog-surface"),
  ];
}

describe("foldSourceCognition — deep-transparency projection", () => {
  it("counts activity per cognition family and ignores non-source/non-model events", () => {
    const state = foldSourceCognition(scenario());
    expect(state.activity.versions_registered).toBe(1);
    expect(state.activity.layers_constructed).toBe(2);
    expect(state.activity.layers_degraded).toBe(1);
    expect(state.activity.claims_recorded).toBe(1);
    expect(state.activity.contradictions_detected).toBe(1);
    expect(state.activity.syntheses).toBe(1);
    expect(state.activity.frontier_updates).toBe(1);
    expect(state.activity.timeline_updates).toBe(1);
    expect(state.activity.creations_started).toBe(1);
    expect(state.activity.creation_assists).toBe(2); // evolved + critiqued
    expect(state.activity.creations_completed).toBe(1);
    expect(state.activity.creations_contributed).toBe(1);
    expect(state.activity.consents_granted).toBe(1);
    expect(state.activity.consents_revoked).toBe(1);
    expect(state.activity.redactions).toBe(1);
    // The surface.* noise event is excluded from the source-plane transparency read.
    expect(state.total_events).toBe(18);
  });

  it("surfaces layer health with confidence and HONEST degradation", () => {
    const state = foldSourceCognition(scenario());
    const citation = state.layers.find((l) => l.layer === "citation");
    expect(citation).toEqual({
      version_id: "v1",
      layer: "citation",
      confidence: 0.4,
      degraded: true,
    });
    const semantic = state.layers.find((l) => l.layer === "semantic");
    expect(semantic?.degraded).toBe(false);
    expect(semantic?.confidence).toBe(0.82);
  });

  it("counts D3 model invocations and degraded cognition steps", () => {
    const state = foldSourceCognition(scenario());
    expect(state.model_invocations).toBe(1);
    // degraded steps: the degraded citation layer + the degraded timeline + the degraded critique assist.
    expect(state.degraded_count).toBe(3);
  });

  it("returns recent entries newest-first, provenance-bearing, capped by recentLimit", () => {
    const state = foldSourceCognition(scenario(), { recentLimit: 3 });
    expect(state.recent).toHaveLength(3);
    // Newest first: the last cognition event in the log (redaction.cascaded) leads.
    expect(state.recent[0]?.event_type).toBe(SOURCE_EVENT_TYPES.redactionCascaded);
    expect(state.recent[0]?.producer_cid).toBe("cog-source-consent");
    expect(state.recent[0]?.summary).toContain("redaction");
    // Ordering is by the log's HLC key.
    expect(state.recent[0]?.at).toMatch(/^hlc-/);
  });

  it("is deterministic — folding the same log twice is deep-equal (replay equivalence)", () => {
    const log = scenario();
    expect(foldSourceCognition(log)).toEqual(foldSourceCognition(log));
  });

  it("an empty log yields a zeroed, honest state (never a fabricated summary)", () => {
    const state = foldSourceCognition([]);
    expect(state.total_events).toBe(0);
    expect(state.model_invocations).toBe(0);
    expect(state.layers).toEqual([]);
    expect(state.recent).toEqual([]);
    expect(state.activity.claims_recorded).toBe(0);
    // Cache telemetry defaults to zeroed when no live stats are injected (M12 T2).
    expect(state.cache).toEqual({ hits: 0, misses: 0, hit_rate: 0, by_kind: {} });
  });

  it("echoes injected cache telemetry (M12 T2 — live counter, not folded from the log)", () => {
    const cache = {
      hits: 3,
      misses: 1,
      hit_rate: 0.75,
      by_kind: { fusion: { hits: 2, misses: 1 }, frontier: { hits: 1, misses: 0 } },
    };
    const log = scenario();
    const state = foldSourceCognition(log, { cache });
    expect(state.cache).toEqual(cache);
    // The fold stays pure: same events + same cache ⇒ deep-equal.
    expect(foldSourceCognition(log, { cache })).toEqual(state);
  });
});
