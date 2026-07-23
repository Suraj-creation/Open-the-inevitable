/**
 * CSE M10 T1 — the code modality adapter (ADR-0046). Deterministic, language-agnostic structural
 * parse: column-0 constructs become anchor-addressable heading (signature) + code (body) regions;
 * nested constructs stay inside their parent; a construct-less file folds to one honest region.
 */
import { describe, expect, it } from "vitest";
import { InMemoryEventBus } from "@inevitable/events";
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";
import {
  CodeReferenceAdapter,
  SourceEnvironmentStore,
  foldSourceEvents,
  type SourceProvenance,
} from "../src/index";

const TS = `import { foo } from "./foo";

export function add(a: number, b: number): number {
  return a + b;
}

export class Calculator {
  private total = 0;
  add(n: number): void {
    this.total += n;
  }
}
`;

const PY = `import math

def area(r):
    return math.pi * r * r

class Circle:
    def __init__(self, r):
        self.r = r
`;

function parse(content: string) {
  const result = new CodeReferenceAdapter().parse(content);
  if (!result.ok) throw result.error;
  return result.value;
}

describe("CodeReferenceAdapter (M10 T1)", () => {
  it("parses TS top-level constructs into signature headings + code bodies", () => {
    const { structural } = parse(TS);
    const headings = structural.regions.filter((r) => r.kind === "heading").map((r) => r.text);
    expect(headings).toContain("export function add(a: number, b: number): number {");
    expect(headings).toContain("export class Calculator {");
    // The import preamble is its own region; the method `add` stays inside the class body (T1).
    const preamble = structural.regions.find((r) => r.text.includes("import { foo }"));
    expect(preamble).toBeDefined();
    const classBody = structural.regions.find((r) => r.text.includes("this.total += n"));
    expect(classBody?.kind).toBe("code");
  });

  it("parses Python module-level def/class (indented methods stay nested)", () => {
    const { structural } = parse(PY);
    const headings = structural.regions.filter((r) => r.kind === "heading").map((r) => r.text);
    expect(headings).toContain("def area(r):");
    expect(headings).toContain("class Circle:");
    // The nested __init__ is inside the class body, not its own top-level heading.
    expect(headings.some((h) => h.includes("__init__"))).toBe(false);
  });

  it("a file with no recognizable construct folds to one honest region, never dropped", () => {
    const { structural } = parse("print('hello')\nx = compute()\n");
    expect(structural.regions.length).toBe(1);
    expect(structural.regions[0]?.text).toContain("print('hello')");
  });

  it("refuses empty content (E_SOURCE_PARSE_EMPTY)", () => {
    const result = new CodeReferenceAdapter().parse("   \n  \n");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("E_SOURCE_PARSE_EMPTY");
  });

  it("is deterministic: same source ⇒ byte-identical structural regions", () => {
    expect(parse(TS).structural).toEqual(parse(TS).structural);
  });
});

describe("code modality through the CSE store (M10 T1 — the whole pipeline works over code)", () => {
  const PROVENANCE: SourceProvenance = {
    origin: "upload",
    attributed_source: "tests/code",
    license_class: null,
    consent_ref: null,
  };

  it("registers + canonicalizes a code source into an anchor-usable environment, replay-equal", async () => {
    const idGenerator = new SeededIdGenerator("code-store-test");
    const bus = new InMemoryEventBus({ idGenerator });
    const store = new SourceEnvironmentStore({
      bus,
      clock: new ManualClock(),
      idGenerator,
      nodeId: "test",
    });
    store.registerAdapter(new CodeReferenceAdapter());

    const version = await store.registerVersion({
      modality: "code",
      content: TS,
      provenance: PROVENANCE,
    });
    expect(version.ok).toBe(true);
    if (!version.ok) return;
    const env = await store.canonicalize(version.value.version_id);
    expect(env.ok).toBe(true);
    if (!env.ok) return;
    // Usable at the structural layer + anchor index — every deeper layer builds on this.
    expect(env.value.usable).toBe(true);
    expect(env.value.layers_available).toContain("structural");

    // Replay: folding the event log reconstructs the same environment (state-then-emit, fold≡project).
    const folded = foldSourceEvents(bus.replay({ subject: "source.>" }));
    expect(folded.versions.some((v) => v.version_id === version.value.version_id)).toBe(true);
  });
});
