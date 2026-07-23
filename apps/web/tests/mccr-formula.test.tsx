/**
 * R3a (ADR-0057) — progressive derivation. While a multi-line formula is the active (spoken)
 * element, its derivation lines stage in one by one (the whiteboard feel); otherwise every line is
 * present. Reduced-motion safety is handled in CSS (the staging animation is disabled), so the
 * lines are never hidden — only their entrance is animated.
 */
import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { MccrElement } from "@inevitable/surface/client";
import { MccrElementView } from "../src/components/MccrElement";

function derivationElement(): MccrElement {
  return {
    element_id: "el-key_formula",
    type: "key_formula",
    slot: "key_formula",
    reveal_order: 2,
    concept_id: "backprop",
    content: {
      kind: "formula",
      latex: "\\delta = (a - y)",
      plain: "delta equals a minus y",
      lines: ["z = Wx + b", "a = \\sigma(z)", "\\delta = (a - y)"],
    },
  } as unknown as MccrElement;
}

describe("progressive derivation (R3a)", () => {
  test("stages the lines while the formula is the active spoken element", () => {
    const html = renderToStaticMarkup(<MccrElementView element={derivationElement()} active />);
    expect(html).toContain("mccr-formula--staging");
    // Each line carries its stagger index so CSS can delay it in sequence.
    expect(html).toContain("--line-index:0");
    expect(html).toContain("--line-index:2");
    // Every line is still present in the DOM (staging animates entrance, never hides content).
    expect(html).toContain("z = Wx + b");
    expect(html).toContain("a = ");
  });

  test("does not stage when the formula is not the active element (all lines, no animation class)", () => {
    const html = renderToStaticMarkup(
      <MccrElementView element={derivationElement()} active={false} />,
    );
    expect(html).not.toContain("mccr-formula--staging");
    expect(html).toContain("mccr-formula--derivation");
  });
});

describe("scene lighting recession (R3d)", () => {
  test("a receded actor carries data-lit=recede; a non-receded one does not", () => {
    const recededHtml = renderToStaticMarkup(
      <MccrElementView element={derivationElement()} active={false} receded />,
    );
    expect(recededHtml).toContain('data-lit="recede"');
    const litHtml = renderToStaticMarkup(<MccrElementView element={derivationElement()} active />);
    expect(litHtml).not.toContain('data-lit="recede"');
  });
});

describe("derivation transformation labels (R4c)", () => {
  test("renders the per-line transformation label beside the derivation step", () => {
    const el = {
      ...derivationElement(),
      content: {
        kind: "formula",
        latex: "\\delta = (a - y)",
        plain: "delta",
        lines: ["z = Wx + b", "a = \\sigma(z)", "\\delta = (a - y)"],
        line_labels: ["weighted sum", "activate", "error signal"],
      },
    } as unknown as MccrElement;
    const html = renderToStaticMarkup(<MccrElementView element={el} active={false} />);
    expect(html).toContain("weighted sum");
    expect(html).toContain("error signal");
    expect(html).toContain("mccr-formula-label");
  });
});

describe("misconception dissolve grammar (R4e)", () => {
  function misconceptionElement(): MccrElement {
    return {
      element_id: "el-misconception",
      type: "misconception",
      slot: "aside",
      reveal_order: 3,
      concept_id: "entropy",
      content: {
        kind: "misconception",
        wrong: "Entropy is disorder, like a messy room.",
        correction: "Entropy counts the microstates of a macrostate.",
      },
    } as unknown as MccrElement;
  }

  test("shows the wrong belief struck through and the correction it resolves into", () => {
    const html = renderToStaticMarkup(
      <MccrElementView element={misconceptionElement()} active={false} />,
    );
    // Both halves are present — the dissolve never hides the correction, and the wrong belief is
    // marked (struck) rather than deleted so the learner sees what they are giving up.
    expect(html).toContain("Entropy is disorder, like a messy room.");
    expect(html).toContain("Entropy counts the microstates of a macrostate.");
    expect(html).toContain("<s>");
    expect(html).toContain("mccr-misconception-right");
  });

  test("plays the dissolve only while the anchor is the active (spoken) element", () => {
    const spoken = renderToStaticMarkup(
      <MccrElementView element={misconceptionElement()} active />,
    );
    expect(spoken).toContain('data-dissolving="true"');
    const resting = renderToStaticMarkup(
      <MccrElementView element={misconceptionElement()} active={false} />,
    );
    expect(resting).not.toContain('data-dissolving="true"');
  });
});

describe("image rationale (R4e; Law 9)", () => {
  function imageElement(rationale: string | null): MccrElement {
    return {
      element_id: "el-image",
      type: "image",
      slot: "image",
      reveal_order: 9,
      concept_id: "entropy",
      content: {
        kind: "image",
        artifact: {
          artifact_id: "art-1",
          content_ref: "blob:art-1",
          mime_type: "image/png",
          provider_id: "prov-1",
        },
        alt: "An illustration of entropy",
        prompt: "entropy diagram",
        caption: "Energy dispersing",
        labels: [],
        rationale,
      },
    } as unknown as MccrElement;
  }

  test("surfaces the recorded rationale as an opt-in disclosure", () => {
    const html = renderToStaticMarkup(
      <MccrElementView
        element={imageElement("Shows dispersal you cannot see in the formula.")}
        active
      />,
    );
    expect(html).toContain("mccr-image-rationale");
    expect(html).toContain("Why this image");
    expect(html).toContain("Shows dispersal you cannot see in the formula.");
  });

  test("omits the disclosure when no rationale was recorded", () => {
    const html = renderToStaticMarkup(<MccrElementView element={imageElement(null)} active />);
    expect(html).not.toContain("mccr-image-rationale");
  });
});

describe("process / algorithm grammar (R4e)", () => {
  function processElement(): MccrElement {
    return {
      element_id: "el-process",
      type: "process",
      slot: "process",
      reveal_order: 8,
      concept_id: "long-division",
      content: {
        kind: "process",
        steps: [
          { text: "Divide the leading digits", detail: "how many times the divisor fits" },
          { text: "Multiply and subtract", detail: null },
          { text: "Bring down the next digit", detail: null },
        ],
      },
    } as unknown as MccrElement;
  }

  test("renders the steps as an ordered list with their details", () => {
    const html = renderToStaticMarkup(
      <MccrElementView element={processElement()} active={false} />,
    );
    expect(html).toContain("<ol");
    expect(html).toContain("Divide the leading digits");
    expect(html).toContain("how many times the divisor fits");
    expect(html).toContain("Bring down the next digit");
    expect(html).toContain("mccr-process");
  });

  test("stages the steps only while the anchor is the active (spoken) element", () => {
    const spoken = renderToStaticMarkup(<MccrElementView element={processElement()} active />);
    expect(spoken).toContain("mccr-process--staging");
    expect(spoken).toContain("--line-index:0");
    const resting = renderToStaticMarkup(
      <MccrElementView element={processElement()} active={false} />,
    );
    expect(resting).not.toContain("mccr-process--staging");
  });
});

describe("code grammar (R4e)", () => {
  function codeElement(): MccrElement {
    return {
      element_id: "el-code",
      type: "code",
      slot: "code",
      reveal_order: 9,
      concept_id: "gcd",
      content: {
        kind: "code",
        language: "python",
        lines: [
          { text: "def gcd(a, b):", note: "the function" },
          { text: "    while b:", note: null },
          { text: "        a, b = b, a % b", note: null },
        ],
      },
    } as unknown as MccrElement;
  }

  test("renders the source lines and marks the annotated (taught) line", () => {
    const html = renderToStaticMarkup(<MccrElementView element={codeElement()} active={false} />);
    expect(html).toContain("mccr-code");
    expect(html).toContain('data-language="python"');
    expect(html).toContain("def gcd(a, b):");
    expect(html).toContain("the function");
    // The annotated line carries the taught-line marker; unannotated lines do not.
    expect(html).toContain('data-noted="true"');
  });

  test("marks the code block active while it is the spoken anchor", () => {
    const spoken = renderToStaticMarkup(<MccrElementView element={codeElement()} active />);
    // The code container itself carries the active flag (used to brighten the noted lines).
    expect(spoken).toContain('data-language="python" data-active="true"');
    const resting = renderToStaticMarkup(
      <MccrElementView element={codeElement()} active={false} />,
    );
    expect(resting).toContain('data-language="python" data-active="false"');
  });
});

describe("epistemic role rendering (R4b)", () => {
  test("renders the RIA's epistemic role + hierarchy as CDL hooks", () => {
    const html = renderToStaticMarkup(
      <MccrElementView
        element={derivationElement()}
        active={false}
        epistemicRole="misconception"
        hierarchy="supporting"
      />,
    );
    expect(html).toContain('data-epistemic-role="misconception"');
    expect(html).toContain('data-hierarchy="supporting"');
  });

  test("omits the attributes when the RIA assigned no role (goal-mode / no plan)", () => {
    const html = renderToStaticMarkup(<MccrElementView element={derivationElement()} active />);
    expect(html).not.toContain("data-epistemic-role");
    expect(html).not.toContain("data-hierarchy");
  });
});
