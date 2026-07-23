import { describe, expect, it } from "vitest";
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";
import { InMemoryEventBus } from "@inevitable/events";
import {
  MarkdownReferenceAdapter,
  SOURCE_EVENT_TYPES,
  SourceEnvironmentStore,
  contentHash,
  type SourceProvenance,
} from "../src/index";

const PROVENANCE: SourceProvenance = {
  origin: "fixture",
  attributed_source: "tests/identity",
  license_class: null,
  consent_ref: null,
};

function makeStore() {
  const idGenerator = new SeededIdGenerator("identity-test");
  const bus = new InMemoryEventBus({ idGenerator });
  const store = new SourceEnvironmentStore({
    bus,
    clock: new ManualClock(),
    idGenerator,
    nodeId: "test",
  });
  store.registerAdapter(new MarkdownReferenceAdapter());
  return { store, bus };
}

describe("source identity & versioning (CSE-002 §3.1)", () => {
  it("registers a version, content-addressed, and emits source.version.registered", async () => {
    const { store, bus } = makeStore();
    const result = await store.registerVersion({
      modality: "markdown",
      content: "# Title\n\nA paragraph.",
      provenance: PROVENANCE,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.content_hash).toBe(contentHash("# Title\n\nA paragraph."));
    expect(result.value.supersedes).toBeNull();
    const registered = bus.log.filter((e) => e.event_type === SOURCE_EVENT_TYPES.versionRegistered);
    expect(registered).toHaveLength(1);
    const payload = registered[0]?.payload as Record<string, unknown>;
    expect(payload["version_id"]).toBe(result.value.version_id);
    expect(payload["content_hash"]).toBe(result.value.content_hash);
  });

  it("is idempotent per (source, content_hash): same content re-registered emits nothing new", async () => {
    const { store, bus } = makeStore();
    const first = await store.registerVersion({
      modality: "markdown",
      content: "same content",
      provenance: PROVENANCE,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const again = await store.registerVersion({
      source_id: first.value.source_id,
      modality: "markdown",
      content: "same content",
      provenance: PROVENANCE,
    });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.value.version_id).toBe(first.value.version_id);
    expect(
      bus.log.filter((e) => e.event_type === SOURCE_EVENT_TYPES.versionRegistered),
    ).toHaveLength(1);
  });

  it("builds a supersedes chain when the same source gets new content", async () => {
    const { store } = makeStore();
    const v1 = await store.registerVersion({
      modality: "markdown",
      content: "edition one",
      provenance: PROVENANCE,
    });
    expect(v1.ok).toBe(true);
    if (!v1.ok) return;
    const v2 = await store.registerVersion({
      source_id: v1.value.source_id,
      modality: "markdown",
      content: "edition two",
      provenance: PROVENANCE,
    });
    expect(v2.ok).toBe(true);
    if (!v2.ok) return;
    expect(v2.value.supersedes).toBe(v1.value.version_id);
    expect(store.latestVersion(v1.value.source_id)?.version_id).toBe(v2.value.version_id);
    expect(store.versionChain(v1.value.source_id).map((v) => v.version_id)).toEqual([
      v1.value.version_id,
      v2.value.version_id,
    ]);
  });

  it("replays a registration under explicit ids — rehydration identity is stable (ADR-0055 D2)", async () => {
    const { store } = makeStore();
    const original = await store.registerVersion({
      modality: "markdown",
      content: "durable content",
      provenance: PROVENANCE,
    });
    expect(original.ok).toBe(true);
    if (!original.ok) return;

    // A fresh store (a restarted process) replays the persisted registration with the SAME ids.
    const { store: restarted } = makeStore();
    const replayed = await restarted.registerVersion({
      source_id: original.value.source_id,
      version_id: original.value.version_id,
      modality: "markdown",
      content: "durable content",
      provenance: PROVENANCE,
    });
    expect(replayed.ok).toBe(true);
    if (!replayed.ok) return;
    expect(replayed.value.version_id).toBe(original.value.version_id);
    expect(replayed.value.source_id).toBe(original.value.source_id);
    expect(replayed.value.content_hash).toBe(original.value.content_hash);
    expect(restarted.version(original.value.version_id)?.version_id).toBe(
      original.value.version_id,
    );

    // Dedupe-by-hash still wins over the explicit id when identical content re-registers.
    const deduped = await restarted.registerVersion({
      source_id: original.value.source_id,
      version_id: "srcv-should-not-mint" as typeof original.value.version_id,
      modality: "markdown",
      content: "durable content",
      provenance: PROVENANCE,
    });
    expect(deduped.ok).toBe(true);
    if (!deduped.ok) return;
    expect(deduped.value.version_id).toBe(original.value.version_id);
  });

  it("refuses human-derived modalities without a consent envelope (CSE-002 §8)", async () => {
    const { store, bus } = makeStore();
    const result = await store.registerVersion({
      modality: "human-session",
      content: "office hours transcript",
      provenance: PROVENANCE,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("E_SOURCE_CONSENT_REQUIRED");
    expect(bus.log).toHaveLength(0);
  });
});
