/**
 * R5 (ADR-0059) — the Jupyter notebook modality adapter. Deterministic, dependency-free: markdown
 * cells reuse the markdown splitter (their headings structure the source), code cells become `code`
 * regions (indentation preserved), executed outputs are NOT source content, and an empty/invalid
 * notebook is refused (never a silent drop).
 */
import { describe, expect, it } from "vitest";
import { InMemoryEventBus } from "@inevitable/events";
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";
import {
  NotebookReferenceAdapter,
  SourceEnvironmentStore,
  foldSourceEvents,
  type SourceProvenance,
} from "../src/index";

const NOTEBOOK = JSON.stringify({
  cells: [
    { cell_type: "markdown", source: ["# Gradient descent\n", "\n", "We minimize a loss."] },
    { cell_type: "code", source: ["def step(w, grad, lr):\n", "    return w - lr * grad\n"] },
    {
      cell_type: "code",
      source: "print(step(1.0, 0.5, 0.1))",
      outputs: [{ output_type: "stream", text: "0.95\n" }],
    },
    { cell_type: "raw", source: "a raw note" },
  ],
  metadata: {},
  nbformat: 4,
});

function parse(content: string) {
  const result = new NotebookReferenceAdapter().parse(content);
  if (!result.ok) throw result.error;
  return result.value;
}

describe("NotebookReferenceAdapter (R5, ADR-0059)", () => {
  it("turns a markdown cell's heading into a heading region", () => {
    const { structural } = parse(NOTEBOOK);
    const headings = structural.regions.filter((r) => r.kind === "heading").map((r) => r.text);
    expect(headings).toContain("Gradient descent");
  });

  it("turns code cells into code regions with indentation preserved", () => {
    const { structural } = parse(NOTEBOOK);
    const code = structural.regions.find((r) => r.kind === "code" && r.text.includes("def step"));
    expect(code).toBeDefined();
    expect(code?.text).toContain("    return w - lr * grad"); // 4-space indent kept
  });

  it("excludes executed cell outputs — only authored cells are source content", () => {
    const { structural } = parse(NOTEBOOK);
    // The code cell's SOURCE is present, but its output "0.95" is never treated as source text.
    expect(structural.regions.some((r) => r.text.includes("print(step"))).toBe(true);
    expect(structural.regions.some((r) => r.text.includes("0.95"))).toBe(false);
  });

  it("keeps a raw cell as a paragraph (never dropped)", () => {
    const { structural } = parse(NOTEBOOK);
    expect(structural.regions.some((r) => r.text.includes("a raw note"))).toBe(true);
  });

  it("refuses empty or invalid JSON (E_SOURCE_PARSE_EMPTY)", () => {
    const empty = new NotebookReferenceAdapter().parse("   ");
    expect(empty.ok).toBe(false);
    const notJson = new NotebookReferenceAdapter().parse("def x(): pass");
    expect(notJson.ok).toBe(false);
    if (!notJson.ok) expect(notJson.error.code).toBe("E_SOURCE_PARSE_EMPTY");
    const noCells = new NotebookReferenceAdapter().parse(JSON.stringify({ cells: [] }));
    expect(noCells.ok).toBe(false);
  });

  it("is deterministic: same notebook ⇒ byte-identical structural regions", () => {
    expect(parse(NOTEBOOK).structural).toEqual(parse(NOTEBOOK).structural);
  });
});

describe("notebook modality through the CSE store (the whole pipeline works over .ipynb)", () => {
  const PROVENANCE: SourceProvenance = {
    origin: "upload",
    attributed_source: "tests/notebook",
    license_class: null,
    consent_ref: null,
  };

  it("registers + canonicalizes a notebook into an anchor-usable environment, replay-equal", async () => {
    const idGenerator = new SeededIdGenerator("notebook-store-test");
    const bus = new InMemoryEventBus({ idGenerator });
    const store = new SourceEnvironmentStore({
      bus,
      clock: new ManualClock(),
      idGenerator,
      nodeId: "test",
    });
    store.registerAdapter(new NotebookReferenceAdapter());

    const version = await store.registerVersion({
      modality: "notebook",
      content: NOTEBOOK,
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
