/**
 * CSE M10 T3 — the video modality adapter (ADR-0048). A timed transcript (WebVTT/SRT/JSON) becomes
 * structural regions (one per cue, in time order) + the L4 temporal layer (per-region timecodes).
 * Deterministic; real cue timings only (an untimed transcript is refused — that's the text modality).
 */
import { describe, expect, it } from "vitest";
import { InMemoryEventBus } from "@inevitable/events";
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";
import {
  SourceEnvironmentStore,
  VideoTranscriptAdapter,
  type SourceProvenance,
  type TemporalLayerContent,
} from "../src/index";

const VTT = `WEBVTT

00:00:00.000 --> 00:00:05.000
Gradient descent minimizes a loss function.

00:00:05.000 --> 00:00:10.500
The learning rate controls the step size taken at each iteration.
`;

const SRT = `1
00:00:00,000 --> 00:00:05,000
Gradient descent minimizes a loss function.

2
00:00:05,000 --> 00:00:10,500
The learning rate controls the step size.
`;

const JSONT = JSON.stringify([
  { start: 0, end: 5, text: "Gradient descent minimizes a loss function." },
  { start: 5, end: 10.5, text: "The learning rate controls the step size." },
]);

function parse(content: string) {
  const result = new VideoTranscriptAdapter().parse(content);
  if (!result.ok) throw result.error;
  return result.value;
}

describe("VideoTranscriptAdapter (M10 T3)", () => {
  it("parses WebVTT into cue regions + an L4 temporal layer with real timecodes", () => {
    const parsed = parse(VTT);
    expect(parsed.structural.regions).toHaveLength(2);
    expect(parsed.structural.regions[0]?.text).toContain("Gradient descent minimizes");
    expect(parsed.temporal).toBeDefined();
    const t = parsed.temporal!;
    expect(t.segments).toHaveLength(2);
    expect(t.segments[0]).toMatchObject({ start_ms: 0, end_ms: 5000 });
    expect(t.segments[1]).toMatchObject({ start_ms: 5000, end_ms: 10500 });
    // Each temporal segment references a real structural region path.
    const paths = new Set(parsed.structural.regions.map((r) => r.path));
    expect(t.segments.every((s) => paths.has(s.region_path))).toBe(true);
    expect(t.duration_ms).toBe(10500);
  });

  it("parses SRT (comma timecodes) equivalently", () => {
    const t = parse(SRT).temporal!;
    expect(t.segments.map((s) => s.start_ms)).toEqual([0, 5000]);
    expect(t.duration_ms).toBe(10500);
  });

  it("parses a JSON transcript (seconds → ms)", () => {
    const parsed = parse(JSONT);
    expect(parsed.structural.regions).toHaveLength(2);
    expect(parsed.temporal!.segments[1]).toMatchObject({ start_ms: 5000, end_ms: 10500 });
  });

  it("refuses an untimed transcript (no cues) — that is the text modality, not video", () => {
    const result = new VideoTranscriptAdapter().parse("just prose with no timecodes at all");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("E_SOURCE_PARSE_EMPTY");
  });

  it("is deterministic: same transcript ⇒ byte-identical structural + temporal layers", () => {
    const a = parse(VTT);
    const b = parse(VTT);
    expect(a.structural).toEqual(b.structural);
    expect(a.temporal).toEqual(b.temporal);
  });

  it("flows through the store: canonicalize records structural + temporal (L4), replay-equal", async () => {
    const idGenerator = new SeededIdGenerator("video-store-test");
    const bus = new InMemoryEventBus({ idGenerator });
    const store = new SourceEnvironmentStore({
      bus,
      clock: new ManualClock(),
      idGenerator,
      nodeId: "test",
    });
    store.registerAdapter(new VideoTranscriptAdapter());
    const provenance: SourceProvenance = {
      origin: "upload",
      attributed_source: "tests/video",
      license_class: null,
      consent_ref: null,
    };
    const version = await store.registerVersion({ modality: "video", content: VTT, provenance });
    expect(version.ok).toBe(true);
    if (!version.ok) return;
    const env = await store.canonicalize(version.value.version_id);
    expect(env.ok).toBe(true);
    if (!env.ok) return;
    expect(env.value.usable).toBe(true);
    expect(env.value.layers_available).toContain("temporal");
    const temporal = store.layer(version.value.version_id, "temporal");
    expect((temporal?.content as TemporalLayerContent).segments).toHaveLength(2);
  });
});
