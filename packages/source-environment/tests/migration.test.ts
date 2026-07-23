import { describe, expect, it } from "vitest";
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";
import { InMemoryEventBus } from "@inevitable/events";
import {
  MarkdownReferenceAdapter,
  SOURCE_EVENT_TYPES,
  SourceEnvironmentStore,
  type SourceProvenance,
} from "../src/index";

const PROVENANCE: SourceProvenance = {
  origin: "fixture",
  attributed_source: "tests/migration",
  license_class: null,
  consent_ref: null,
};

const V1 = `# Chapter

The eigenvector stays on its own span under the transformation.

Momentum accumulates past gradients to smooth the descent.
`;

// V2: paragraph one unchanged in content but shifted (a new paragraph precedes it);
// paragraph two removed entirely.
const V2 = `# Chapter

A new opening paragraph provides historical context.

The eigenvector stays on its own span under the transformation.
`;

async function setup() {
  const idGenerator = new SeededIdGenerator("migration-test");
  const bus = new InMemoryEventBus({ idGenerator });
  const store = new SourceEnvironmentStore({
    bus,
    clock: new ManualClock(),
    idGenerator,
    nodeId: "test",
  });
  store.registerAdapter(new MarkdownReferenceAdapter());
  const v1 = await store.registerVersion({
    modality: "markdown",
    content: V1,
    provenance: PROVENANCE,
  });
  if (!v1.ok) throw new Error("v1 registration failed");
  await store.canonicalize(v1.value.version_id);
  const v2 = await store.registerVersion({
    source_id: v1.value.source_id,
    modality: "markdown",
    content: V2,
    provenance: PROVENANCE,
  });
  if (!v2.ok) throw new Error("v2 registration failed");
  await store.canonicalize(v2.value.version_id);
  return { store, bus, v1: v1.value, v2: v2.value };
}

describe("anchor migration across versions (CSE-002 §5.4)", () => {
  it("classifies moved and orphaned anchors and emits source.anchor.migrated for each", async () => {
    const { store, bus, v1, v2 } = await setup();

    const moved = store.createAnchorAt({
      version_id: v1.version_id,
      selectors: [
        { type: "structural", path: "h1-1/para-1" },
        { type: "text-quote", exact: "eigenvector stays on its own span" },
      ],
      granularity: "paragraph",
      created_by: "cog-test",
    });
    const orphaned = store.createAnchorAt({
      version_id: v1.version_id,
      selectors: [
        { type: "structural", path: "h1-1/para-2" },
        { type: "text-quote", exact: "Momentum accumulates past gradients" },
      ],
      granularity: "paragraph",
      created_by: "cog-test",
    });
    expect(moved.ok && orphaned.ok).toBe(true);
    if (!moved.ok || !orphaned.ok) return;

    const result = await store.migrateAnchors(v1.version_id, v2.version_id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const byId = new Map(result.value.map((m) => [m.anchor_id, m]));
    // The eigenvector paragraph is now h1-1/para-2 in V2 → structural selector disagrees with the
    // quote, quote re-locates it: status "moved", selectors refreshed to the new path.
    const movedMigration = byId.get(moved.value.anchor_id);
    expect(movedMigration?.status).toBe("moved");
    expect(movedMigration?.migrated?.selectors.find((s) => s.type === "structural")).toEqual({
      type: "structural",
      path: "h1-1/para-2",
    });
    // The momentum paragraph no longer exists → orphaned, retained, never deleted.
    const orphanMigration = byId.get(orphaned.value.anchor_id);
    expect(orphanMigration?.status).toBe("orphaned");
    expect(orphanMigration?.migrated).toBeNull();
    expect(store.anchor(v1.version_id, orphaned.value.anchor_id)).toBeDefined();

    // Moved anchor joined the new version's index; orphan did not.
    expect(store.anchorIndex(v2.version_id)?.size).toBe(1);

    const events = bus.log.filter((e) => e.event_type === SOURCE_EVENT_TYPES.anchorMigrated);
    expect(events).toHaveLength(2);
    expect(events.map((e) => (e.payload as Record<string, unknown>)["status"]).sort()).toEqual([
      "moved",
      "orphaned",
    ]);
  });

  it("classifies an unchanged-path anchor as resolved", async () => {
    const { store, v1, v2 } = await setup();
    const heading = store.createAnchorAt({
      version_id: v1.version_id,
      selectors: [
        { type: "structural", path: "h1-1" },
        { type: "text-quote", exact: "Chapter" },
      ],
      granularity: "section",
      created_by: "cog-test",
    });
    expect(heading.ok).toBe(true);
    if (!heading.ok) return;
    const result = await store.migrateAnchors(v1.version_id, v2.version_id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.status).toBe("resolved");
  });

  it("refuses migration when either version lacks a structural layer", async () => {
    const { store, v1 } = await setup();
    const unknown = await store.registerVersion({
      source_id: v1.source_id,
      modality: "markdown",
      content: "uncanonicalized edition",
      provenance: PROVENANCE,
    });
    if (!unknown.ok) return;
    const result = await store.migrateAnchors(v1.version_id, unknown.value.version_id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("E_SOURCE_NOT_CANONICALIZED");
  });
});
