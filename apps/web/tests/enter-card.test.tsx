/**
 * Source-first entry (R5, ADR-0062). The front door is topic-OPTIONAL: a learner can bring a source
 * and learn from it without declaring a topic, and the enter gate opens on either a topic or a
 * source. The mid-session Source Dock never uses a source without consent — a usable source offers
 * "Use this document" AND "Teach this source"; an unusable one offers only Close.
 */
import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { EnterCard } from "../src/components/EnterCard";
import { SourceDockNarrative } from "../src/components/SourceDock";
import type { RegisteredSourceView } from "../src/api";

function source(usable: boolean): RegisteredSourceView {
  return {
    source_id: "src-1",
    source_version_id: "srcv-1",
    modality: "pdf",
    title: "Attention Is All You Need",
    content_hash: "h",
    content_ref: "r",
    layers_available: ["structural"],
    degraded_layers: [],
    usable,
  };
}

function enterCardHtml(): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <EnterCard onEntered={() => {}} />
    </MemoryRouter>,
  );
}

describe("EnterCard — source-first entry (R5, ADR-0062)", () => {
  test("the topic is optional and sources can be brought at the front door", () => {
    const html = enterCardHtml();
    expect(html).toContain("optional if you bring a source"); // topic-optional
    expect(html).toContain("enter-source-btn"); // a source affordance is on the entry card
    expect(html).toContain("paste text"); // paste affordance
  });

  test("Enter is disabled with neither a topic nor a source (the gate opens on either)", () => {
    const html = enterCardHtml();
    expect(html).toContain("enter-go");
    expect(html).toContain("disabled"); // the submit button is disabled at the empty idle state
  });
});

describe("SourceDockNarrative consent gate (R5, ADR-0062)", () => {
  test("a usable source offers 'Use this document' AND 'Teach this source'", () => {
    const html = renderToStaticMarkup(
      <SourceDockNarrative surfaceId="srf-1" source={source(true)} onClose={() => {}} />,
    );
    expect(html).toContain("Use this document");
    expect(html).toContain("Teach this source");
  });

  test("an unusable source offers only Close — never consent to teach from broken structure", () => {
    const html = renderToStaticMarkup(
      <SourceDockNarrative surfaceId="srf-1" source={source(false)} onClose={() => {}} />,
    );
    expect(html).not.toContain("Use this document");
    expect(html).toContain("Close");
  });
});
