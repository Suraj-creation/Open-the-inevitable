import { describe, expect, it } from "vitest";
import { ManualClock, SeededIdGenerator, ok } from "@inevitable/shared";
import { InMemoryEventBus } from "@inevitable/events";
import {
  MarkdownReferenceAdapter,
  SOURCE_EVENT_TYPES,
  SourceEnvironmentStore,
  type ModalityAdapter,
  type SourceProvenance,
} from "../src/index";

const PROVENANCE: SourceProvenance = {
  origin: "fixture",
  attributed_source: "tests/canonicalization",
  license_class: null,
  consent_ref: null,
};

const FIXTURE = `# Optimization

Gradient descent updates parameters step by step.

The learning rate controls the step size taken at each iteration.

## Divergence

A large learning rate can cause divergence when curvature is high.

\`\`\`
theta = theta - lr * grad
\`\`\`
`;

function makeStore(confidenceFloor?: number) {
  const idGenerator = new SeededIdGenerator("canon-test");
  const bus = new InMemoryEventBus({ idGenerator });
  const store = new SourceEnvironmentStore({
    bus,
    clock: new ManualClock(),
    idGenerator,
    nodeId: "test",
    ...(confidenceFloor !== undefined ? { confidenceFloor } : {}),
  });
  store.registerAdapter(new MarkdownReferenceAdapter());
  return { store, bus };
}

describe("progressive canonicalization (CSE-002 §4)", () => {
  it("parses markdown into deterministic structural regions with stable paths", async () => {
    const { store } = makeStore();
    const version = await store.registerVersion({
      modality: "markdown",
      content: FIXTURE,
      provenance: PROVENANCE,
    });
    expect(version.ok).toBe(true);
    if (!version.ok) return;
    const env = await store.canonicalize(version.value.version_id);
    expect(env.ok).toBe(true);
    if (!env.ok) return;

    const layer = store.layer(version.value.version_id, "structural");
    expect(layer).toBeDefined();
    const regions = (layer?.content as { regions: Array<{ path: string; kind: string }> }).regions;
    expect(regions.map((r) => r.path)).toEqual([
      "h1-1",
      "h1-1/para-1",
      "h1-1/para-2",
      "h1-1/h2-1",
      "h1-1/h2-1/para-1",
      "h1-1/h2-1/code-1",
    ]);
    // Deterministic: parsing the same content twice yields byte-identical layers.
    const adapter = new MarkdownReferenceAdapter();
    expect(adapter.parse(FIXTURE)).toEqual(adapter.parse(FIXTURE));
  });

  it("reaches the usability threshold at structural layer + anchor index alone", async () => {
    const { store, bus } = makeStore();
    const version = await store.registerVersion({
      modality: "markdown",
      content: FIXTURE,
      provenance: PROVENANCE,
    });
    if (!version.ok) return;
    expect(store.environment(version.value.version_id)?.usable).toBe(false);
    const env = await store.canonicalize(version.value.version_id);
    expect(env.ok).toBe(true);
    if (!env.ok) return;
    expect(env.value.usable).toBe(true);
    expect(env.value.layers_available).toEqual(["structural"]);
    expect(env.value.degraded_layers).toEqual([]);
    expect(
      bus.log.filter((e) => e.event_type === SOURCE_EVENT_TYPES.layerConstructed),
    ).toHaveLength(1);
  });

  it("creates and indexes anchors against the canonicalized version", async () => {
    const { store } = makeStore();
    const version = await store.registerVersion({
      modality: "markdown",
      content: FIXTURE,
      provenance: PROVENANCE,
    });
    if (!version.ok) return;
    await store.canonicalize(version.value.version_id);
    const anchor = store.createAnchorAt({
      version_id: version.value.version_id,
      selectors: [
        { type: "structural", path: "h1-1/h2-1/para-1" },
        { type: "text-quote", exact: "divergence when curvature is high" },
      ],
      granularity: "paragraph",
      concept_refs: ["concept-divergence"],
      created_by: "cog-test",
    });
    expect(anchor.ok).toBe(true);
    if (!anchor.ok) return;
    const index = store.anchorIndex(version.value.version_id);
    expect(index?.byConcept("concept-divergence").map((a) => a.anchor_id)).toEqual([
      anchor.value.anchor_id,
    ]);
    expect(index?.within("h1-1/h2-1")).toHaveLength(1);
    expect(index?.findByText("curvature")).toHaveLength(1);
  });

  it("errors honestly on an unsupported modality (CSE-002 §10)", async () => {
    const { store } = makeStore();
    const version = await store.registerVersion({
      modality: "pdf", // no adapter registered in M1
      content: "%PDF-1.7 ...",
      provenance: PROVENANCE,
    });
    if (!version.ok) return;
    const env = await store.canonicalize(version.value.version_id);
    expect(env.ok).toBe(false);
    if (env.ok) return;
    expect(env.error.code).toBe("E_SOURCE_MODALITY_UNSUPPORTED");
  });

  it("errors on empty content instead of pretending success", async () => {
    const { store } = makeStore();
    const version = await store.registerVersion({
      modality: "markdown",
      content: "   \n  ",
      provenance: PROVENANCE,
    });
    if (!version.ok) return;
    const env = await store.canonicalize(version.value.version_id);
    expect(env.ok).toBe(false);
    if (env.ok) return;
    expect(env.error.code).toBe("E_SOURCE_PARSE_EMPTY");
  });

  it("lands a low-confidence layer as source.layer.degraded — visible, never silent", async () => {
    const { store, bus } = makeStore(0.9);
    const lowConfidence: ModalityAdapter = {
      modality: "image",
      adapter_id: "fake-ocr",
      parse: (content) =>
        ok({
          structural: {
            regions: [
              {
                path: "ocr-1",
                ordinal: 0,
                kind: "paragraph" as const,
                text: content,
                char_start: 0,
                char_end: content.length,
                confidence: 0.4,
              },
            ],
          },
          confidence: 0.4,
        }),
    };
    store.registerAdapter(lowConfidence);
    const version = await store.registerVersion({
      modality: "image",
      content: "blurry scan text",
      provenance: PROVENANCE,
    });
    if (!version.ok) return;
    const env = await store.canonicalize(version.value.version_id);
    expect(env.ok).toBe(true);
    if (!env.ok) return;
    expect(env.value.degraded_layers).toEqual(["structural"]);
    expect(env.value.usable).toBe(true); // usable, but honestly marked
    const degraded = bus.log.filter((e) => e.event_type === SOURCE_EVENT_TYPES.layerDegraded);
    expect(degraded).toHaveLength(1);
    expect((degraded[0]?.payload as Record<string, unknown>)["reason"]).toBe(
      "extraction confidence below floor",
    );
  });
});
