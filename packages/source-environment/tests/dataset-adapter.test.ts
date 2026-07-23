/**
 * R5 (ADR-0059) — the dataset (CSV) modality adapter. Deterministic, dependency-free RFC-4180-ish
 * parse: the shape (heading), the schema (columns list), and a bounded row preview (table) — coarse
 * honest structure the learner can be taught from without materializing every row. Quoted fields may
 * carry commas and newlines; a doubled quote is a literal quote.
 */
import { describe, expect, it } from "vitest";
import { InMemoryEventBus } from "@inevitable/events";
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";
import {
  DatasetReferenceAdapter,
  SourceEnvironmentStore,
  foldSourceEvents,
  type SourceProvenance,
} from "../src/index";

// A comma inside quotes, an escaped quote (""), and a newline inside a quoted field.
const CSV = `name,age,note
"Ada, Lovelace",36,"first ""programmer"""
Alan,41,"cracked
Enigma"
Grace,85,compiler
`;

function parse(content: string) {
  const result = new DatasetReferenceAdapter().parse(content);
  if (!result.ok) throw result.error;
  return result.value;
}

describe("DatasetReferenceAdapter (R5, ADR-0059)", () => {
  it("reports the shape as a heading (3 columns × 3 rows)", () => {
    const { structural } = parse(CSV);
    const heading = structural.regions.find((r) => r.kind === "heading");
    expect(heading?.text).toBe("Dataset — 3 columns × 3 rows");
  });

  it("lists the schema (column names)", () => {
    const { structural } = parse(CSV);
    const list = structural.regions.find((r) => r.kind === "list");
    expect(list?.text).toContain("- name");
    expect(list?.text).toContain("- age");
    expect(list?.text).toContain("- note");
  });

  it("previews rows as a table, preserving quoted commas / escaped quotes / quoted newlines", () => {
    const { structural } = parse(CSV);
    const table = structural.regions.find((r) => r.kind === "table");
    expect(table).toBeDefined();
    expect(table?.text).toContain("Ada, Lovelace"); // comma inside quotes stayed one field
    expect(table?.text).toContain('first "programmer"'); // "" decoded to a literal quote
    // The newline inside Alan's quoted field did NOT split it into an extra row.
    expect(table?.text).toContain("cracked");
    expect(table?.text).toContain("Enigma");
  });

  it("a header-only CSV yields schema without a preview table (no data rows)", () => {
    const { structural } = parse("a,b,c\n");
    expect(structural.regions.find((r) => r.kind === "heading")?.text).toContain("0 rows");
    expect(structural.regions.some((r) => r.kind === "table")).toBe(false);
  });

  it("refuses empty content (E_SOURCE_PARSE_EMPTY)", () => {
    const result = new DatasetReferenceAdapter().parse("   \n  ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("E_SOURCE_PARSE_EMPTY");
  });

  it("is deterministic: same CSV ⇒ byte-identical structural regions", () => {
    expect(parse(CSV).structural).toEqual(parse(CSV).structural);
  });
});

describe("dataset modality through the CSE store (the whole pipeline works over CSV)", () => {
  const PROVENANCE: SourceProvenance = {
    origin: "upload",
    attributed_source: "tests/dataset",
    license_class: null,
    consent_ref: null,
  };

  it("registers + canonicalizes a dataset into an anchor-usable environment, replay-equal", async () => {
    const idGenerator = new SeededIdGenerator("dataset-store-test");
    const bus = new InMemoryEventBus({ idGenerator });
    const store = new SourceEnvironmentStore({
      bus,
      clock: new ManualClock(),
      idGenerator,
      nodeId: "test",
    });
    store.registerAdapter(new DatasetReferenceAdapter());

    const version = await store.registerVersion({
      modality: "dataset",
      content: CSV,
      provenance: PROVENANCE,
    });
    expect(version.ok).toBe(true);
    if (!version.ok) return;
    const env = await store.canonicalize(version.value.version_id);
    expect(env.ok).toBe(true);
    if (!env.ok) return;
    expect(env.value.usable).toBe(true);
    expect(env.value.layers_available).toContain("structural");

    const folded = foldSourceEvents(bus.replay({ subject: "source.>" }));
    expect(folded.versions.some((v) => v.version_id === version.value.version_id)).toBe(true);
  });
});
