import { describe, expect, it } from "vitest";
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";
import { InMemoryEventBus } from "@inevitable/events";
import {
  MarkdownReferenceAdapter,
  SourceEnvironmentStore,
  foldSourceEvents,
  type SourceProvenance,
} from "../src/index";

const PROVENANCE: SourceProvenance = {
  origin: "fixture",
  attributed_source: "tests/replay",
  license_class: null,
  consent_ref: null,
};

/**
 * Replay equivalence (Source Law: Replayable; CSE-002 §11): a full live scenario's projection
 * must equal the pure fold over its `source.*` event log — and the fold must be deterministic.
 */
describe("replay equivalence", () => {
  it("foldSourceEvents(bus.log) equals the live store projection, twice", async () => {
    const idGenerator = new SeededIdGenerator("replay-test");
    const bus = new InMemoryEventBus({ idGenerator });
    const store = new SourceEnvironmentStore({
      bus,
      clock: new ManualClock(),
      idGenerator,
      nodeId: "test",
    });
    store.registerAdapter(new MarkdownReferenceAdapter());

    // Scenario: register v1, canonicalize, anchor it, register v2 (new edition), canonicalize,
    // migrate anchors.
    const v1 = await store.registerVersion({
      modality: "markdown",
      content: "# A\n\nFirst paragraph about entropy.\n\nSecond paragraph about enthalpy.\n",
      provenance: PROVENANCE,
    });
    if (!v1.ok) throw new Error("v1 failed");
    await store.canonicalize(v1.value.version_id);
    const anchor = store.createAnchorAt({
      version_id: v1.value.version_id,
      selectors: [
        { type: "structural", path: "h1-1/para-1" },
        { type: "text-quote", exact: "First paragraph about entropy" },
      ],
      granularity: "paragraph",
      created_by: "cog-test",
    });
    expect(anchor.ok).toBe(true);
    const v2 = await store.registerVersion({
      source_id: v1.value.source_id,
      modality: "markdown",
      content: "# A\n\nA preface.\n\nFirst paragraph about entropy.\n",
      provenance: PROVENANCE,
    });
    if (!v2.ok) throw new Error("v2 failed");
    await store.canonicalize(v2.value.version_id);
    const migrated = await store.migrateAnchors(v1.value.version_id, v2.value.version_id);
    expect(migrated.ok).toBe(true);

    const live = store.project();
    const folded = foldSourceEvents(bus.log);
    expect(folded).toEqual(live);
    // Deterministic: folding the same log twice yields identical projections.
    expect(foldSourceEvents(bus.log)).toEqual(folded);
    // Sanity: the scenario actually produced substance.
    expect(live.versions).toHaveLength(2);
    expect(live.layers).toHaveLength(2);
    expect(live.migrations).toHaveLength(1);
  });

  it("state-then-emit: a refused transition leaves no event behind", async () => {
    const idGenerator = new SeededIdGenerator("replay-test-2");
    const bus = new InMemoryEventBus({ idGenerator });
    const store = new SourceEnvironmentStore({
      bus,
      clock: new ManualClock(),
      idGenerator,
      nodeId: "test",
    });
    // No adapter registered → canonicalize refuses → no layer event, projection unaffected.
    const v = await store.registerVersion({
      modality: "markdown",
      content: "content",
      provenance: PROVENANCE,
    });
    if (!v.ok) throw new Error("v failed");
    const env = await store.canonicalize(v.value.version_id);
    expect(env.ok).toBe(false);
    expect(foldSourceEvents(bus.log).layers).toHaveLength(0);
    expect(foldSourceEvents(bus.log)).toEqual(store.project());
  });

  it("a store without a bus still projects; the fold of an empty log is empty", () => {
    const store = new SourceEnvironmentStore({ clock: new ManualClock() });
    expect(store.project()).toEqual({ versions: [], layers: [], migrations: [] });
    expect(foldSourceEvents([])).toEqual({ versions: [], layers: [], migrations: [] });
  });
});
