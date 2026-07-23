/**
 * R3e (ADR-0057; CSE-005 §3.5) — the sensing chip. Affect is behavioral inference made VISIBLE (never
 * a hidden score); the attention budget surfaces when it runs low so the Director's move toward
 * stillness is legible. (The opt-out toggle is interactive; covered by the pure render here.)
 */
import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AffectChip } from "../src/components/AffectChip";

describe("AffectChip (R3e)", () => {
  test("shows the sensed affect state", () => {
    const html = renderToStaticMarkup(
      <AffectChip affect={{ affect_state: "engaged" }} budget={null} />,
    );
    expect(html).toContain("engaged");
    expect(html).toContain("affect-chip");
  });

  test("surfaces the attention budget only when it runs low/depleted", () => {
    expect(
      renderToStaticMarkup(<AffectChip affect={null} budget={{ remaining: "depleted" }} />),
    ).toContain("attention");
    // High budget with no affect ⇒ nothing to show (no noise).
    expect(renderToStaticMarkup(<AffectChip affect={null} budget={{ remaining: "high" }} />)).toBe(
      "",
    );
  });

  test("renders nothing when there is neither affect nor a low budget", () => {
    expect(renderToStaticMarkup(<AffectChip affect={null} budget={null} />)).toBe("");
  });
});
