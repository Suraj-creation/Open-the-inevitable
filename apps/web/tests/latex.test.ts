/**
 * The math rendering seam (UCS, ADR-0030): the dependency-free fallback renderer (instant, pure)
 * plus the lazy KaTeX upgrade. A math-education board must never show raw `\sigma`; these lock the
 * common notation, XSS-safety, the fallback, and the KaTeX upgrade path.
 */
import { describe, expect, test, vi } from "vitest";
import { ensureKatex, latexToHtml, mathRendererVersion, subscribeMathRenderer } from "../src/latex";

describe("latexToHtml", () => {
  test("renders the neural-network activation formula (Greek, sum, sub/superscripts)", () => {
    const html = latexToHtml("y = \\sigma(\\sum_{i} w_i x_i + b)", "y equals sigma of sum ...");
    expect(html).toContain("σ");
    expect(html).toContain("∑");
    expect(html).toContain("<sub>i</sub>");
    expect(html).not.toContain("\\"); // no raw backslashes ever reach the learner
  });

  test("renders fractions as a stacked structure", () => {
    const html = latexToHtml("\\frac{a}{b}");
    expect(html).toContain("ltx-frac");
    expect(html).toContain("ltx-num");
    expect(html).toContain("ltx-den");
  });

  test("renders blackboard-bold and superscripts", () => {
    const html = latexToHtml("x \\in \\mathbb{R}^{n}");
    expect(html).toContain("∈");
    expect(html).toContain("ℝ");
    expect(html).toContain("<sup>n</sup>");
  });

  test("is XSS-safe: HTML in the source is escaped, only generated tags survive", () => {
    const html = latexToHtml("a < b <script>alert(1)</script>");
    expect(html).toContain("&lt;");
    expect(html).not.toContain("<script>");
  });

  test("falls back to the plain spoken form when there is no latex", () => {
    expect(latexToHtml("", "sigma of the weighted sum")).toBe("sigma of the weighted sum");
  });

  test("unknown macros degrade to their name, never a raw backslash", () => {
    const html = latexToHtml("\\foobar x");
    expect(html).not.toContain("\\");
    expect(html).toContain("foobar");
  });

  test("upgrades to publication-grade KaTeX once its lazy chunk loads", async () => {
    const upgraded = new Promise<void>((resolve) => {
      if (mathRendererVersion() === 1) return resolve();
      subscribeMathRenderer(resolve);
    });
    ensureKatex();
    await vi.waitFor(async () => {
      await upgraded;
      expect(mathRendererVersion()).toBe(1);
    });
    const html = latexToHtml("\\frac{\\partial L}{\\partial w} = \\delta \\cdot x^{T}");
    expect(html).toContain("katex"); // KaTeX markup, not the fallback
    expect(html).not.toContain("ltx-frac");
  });
});
