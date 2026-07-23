/**
 * CSE M10 T2 — the web modality adapter (ADR-0047). Deterministic, dependency-free HTML → structural
 * regions: headings nest, paragraphs/lists/code extract in document order, boilerplate is stripped,
 * entities decode, inline tags vanish. The client supplies the HTML; no server-side fetch.
 */
import { describe, expect, it } from "vitest";
import { InMemoryEventBus } from "@inevitable/events";
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";
import {
  SourceEnvironmentStore,
  WebReferenceAdapter,
  foldSourceEvents,
  type SourceProvenance,
} from "../src/index";

const HTML = `<!DOCTYPE html><html><head><title>Gradient Descent</title><style>.x{}</style></head>
<body>
  <nav>Home | About</nav>
  <script>track();</script>
  <h1>Gradient Descent</h1>
  <p>Gradient descent minimizes a loss function by stepping against the <em>gradient</em>.</p>
  <h2>Learning Rate</h2>
  <p>The learning rate &amp; step size control convergence &mdash; too large diverges.</p>
  <ul><li>Too large: diverges</li><li>Too small: slow</li></ul>
  <pre>theta = theta - lr * grad</pre>
  <footer>© 2026</footer>
</body></html>`;

function parse(content: string) {
  const result = new WebReferenceAdapter().parse(content);
  if (!result.ok) throw result.error;
  return result.value;
}

describe("WebReferenceAdapter (M10 T2)", () => {
  it("extracts headings, paragraphs, lists, code in document order; strips boilerplate", () => {
    const { structural } = parse(HTML);
    const kinds = structural.regions.map((r) => r.kind);
    expect(kinds).toContain("heading");
    expect(kinds).toContain("paragraph");
    expect(kinds).toContain("list");
    expect(kinds).toContain("code");
    const headings = structural.regions.filter((r) => r.kind === "heading").map((r) => r.text);
    expect(headings).toEqual(["Gradient Descent", "Learning Rate"]);
    // nav/footer/script/style content never becomes a region.
    const allText = structural.regions.map((r) => r.text).join(" ");
    expect(allText).not.toContain("Home | About");
    expect(allText).not.toContain("track()");
    expect(allText).not.toContain("2026");
  });

  it("decodes HTML entities and strips inline tags", () => {
    const { structural } = parse(HTML);
    const para = structural.regions.find((r) => r.text.includes("step size"));
    expect(para?.text).toContain("&"); // &amp; → &
    expect(para?.text).toContain("—"); // &mdash; → em dash
    const first = structural.regions.find((r) => r.text.startsWith("Gradient descent minimizes"));
    expect(first?.text).toContain("gradient."); // <em>gradient</em> → gradient (inline tag gone)
    expect(first?.text).not.toContain("<em>");
  });

  it("nests content under headings (h2 sections address distinctly)", () => {
    const { structural } = parse(HTML);
    // The learning-rate paragraph lives under the h2 scope; the intro paragraph under h1.
    const lr = structural.regions.find((r) => r.text.includes("step size"));
    expect(lr?.path.includes("h2-1")).toBe(true);
  });

  it("a tag-less body folds to one readable region; empty is refused", () => {
    const one = parse("just some plain text with no tags");
    expect(one.structural.regions.length).toBe(1);
    expect(one.structural.regions[0]?.text).toContain("plain text");
    const empty = new WebReferenceAdapter().parse("  \n <script>x</script> \n ");
    expect(empty.ok).toBe(false);
  });

  it("is deterministic: same HTML ⇒ byte-identical regions", () => {
    expect(parse(HTML).structural).toEqual(parse(HTML).structural);
  });

  it("flows through the store: register web → canonicalize → usable → replay-equal", async () => {
    const idGenerator = new SeededIdGenerator("web-store-test");
    const bus = new InMemoryEventBus({ idGenerator });
    const store = new SourceEnvironmentStore({
      bus,
      clock: new ManualClock(),
      idGenerator,
      nodeId: "test",
    });
    store.registerAdapter(new WebReferenceAdapter());
    const provenance: SourceProvenance = {
      origin: "web",
      attributed_source: "tests/web",
      license_class: null,
      consent_ref: null,
    };
    const version = await store.registerVersion({ modality: "web", content: HTML, provenance });
    expect(version.ok).toBe(true);
    if (!version.ok) return;
    const env = await store.canonicalize(version.value.version_id);
    expect(env.ok).toBe(true);
    if (!env.ok) return;
    expect(env.value.usable).toBe(true);
    const folded = foldSourceEvents(bus.replay({ subject: "source.>" }));
    expect(folded.versions.some((v) => v.version_id === version.value.version_id)).toBe(true);
  });
});
