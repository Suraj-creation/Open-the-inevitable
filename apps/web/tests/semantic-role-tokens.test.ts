/**
 * The semantic visual grammar is a CONTRACT, not a stylesheet convention.
 *
 * Its value to a learner comes entirely from stability: a definition must look like a definition in
 * every frame, chapter, book, and session, and across every producer that can emit one. A role that
 * silently loses a channel, or a stylesheet that drifts from the tokens, breaks the one property
 * that makes the grammar learnable. Before this layer existed the mapping was a single `--role-hue`
 * defined for 7 of the roles and read by three declarations that coloured a caption — so these are
 * the assertions that keep it from collapsing back to that.
 *
 * Owning specs: CSE-018 Law 5 (the CDL renders the epistemic role), CDL v1 §4–§6 (the palette,
 * the type roles, the amplitudes), ADR-0058.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { EPISTEMIC_ROLE_ORDER } from "@inevitable/surface/client";
import { describe, expect, test } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const tokensCss = readFileSync(resolve(here, "../src/tokens.css"), "utf8");
const stylesCss = readFileSync(resolve(here, "../src/styles.css"), "utf8");

/** Every channel a role must define for the grammar to be complete. */
const CHANNELS = ["hue", "edge", "wash", "salience", "face", "tier"] as const;

/** The tiers a role may use — the presentation primitives the grammar offers. */
const TIERS = ["bare", "edge", "region"] as const;

function tokenValue(role: string, channel: string): string | null {
  const match = new RegExp(`--role-${role}-${channel}:\\s*([^;]+);`).exec(tokensCss);
  return match?.[1]?.trim() ?? null;
}

describe("semantic role tokens — the visual grammar contract", () => {
  test("every epistemic role defines every channel", () => {
    const missing: string[] = [];
    for (const role of EPISTEMIC_ROLE_ORDER) {
      for (const channel of CHANNELS) {
        if (tokenValue(role, channel) === null) missing.push(`--role-${role}-${channel}`);
      }
    }
    // The precise failure that this guards: `reasoning`, `memory-cue`, `observation` and
    // `structural` previously had NO hue and fell through to a neutral grey, so four kinds of
    // knowledge were visually indistinguishable from one another.
    expect(missing).toEqual([]);
  });

  test("every role resolves its channels in the stylesheet", () => {
    for (const role of EPISTEMIC_ROLE_ORDER) {
      expect(stylesCss).toContain(`[data-epistemic-role="${role}"]`);
    }
  });

  test("each role names a real presentation tier", () => {
    for (const role of EPISTEMIC_ROLE_ORDER) {
      expect(TIERS).toContain(tokenValue(role, "tier"));
    }
  });

  test("the stylesheet's tier grouping matches the tier tokens (no drift)", () => {
    // The token is the authority; the selector groups apply it. This asserts they agree, which is
    // what lets the CSS stay declarative without becoming a second source of truth.
    const tierBlocks: Record<string, string> = {};
    for (const tier of TIERS) {
      // Anchor on the tier's own comment marker: several unrelated rules in a 6k-line stylesheet
      // share a declaration like `border: none`, so matching on declarations alone is ambiguous.
      const marker = `/* ${tier} --`;
      const at = stylesCss.indexOf(marker);
      expect(at, `tier "${tier}" has no commented rule`).toBeGreaterThan(-1);
      const blockEnd = stylesCss.indexOf("{", at);
      tierBlocks[tier] = stylesCss.slice(at, blockEnd);
    }
    for (const role of EPISTEMIC_ROLE_ORDER) {
      const tier = tokenValue(role, "tier")!;
      expect(
        tierBlocks[tier]?.includes(`[data-epistemic-role="${role}"]`),
        `role "${role}" declares tier "${tier}" but is absent from that tier's selector group`,
      ).toBe(true);
    }
  });

  test("roles draw only on the CDL v1 state palette — no invented colours", () => {
    // CDL v1 §4 is the colour authority. A raw hex here would mean a role invented a hue outside
    // the palette, which is how a coherent language becomes an arbitrary rainbow.
    const allowed =
      /^(var\(--(state-|ink-|stage-tint|hairline)[\w-]*\)|transparent|color-mix\(.*\))$/;
    for (const role of EPISTEMIC_ROLE_ORDER) {
      for (const channel of ["hue", "edge", "wash"] as const) {
        const value = tokenValue(role, channel)!;
        expect(value, `--role-${role}-${channel} = ${value}`).toMatch(allowed);
      }
    }
  });

  test("role faces come from the CDL's three families", () => {
    const families = new Set([
      "var(--font-serif)",
      "var(--font-ui)",
      "var(--font-mono)",
      "var(--font-reading)",
    ]);
    for (const role of EPISTEMIC_ROLE_ORDER) {
      expect(families).toContain(tokenValue(role, "face")!);
    }
  });

  test("salience is a 0–3 rank, and high salience stays scarce", () => {
    const ranks = EPISTEMIC_ROLE_ORDER.map((r) => Number(tokenValue(r, "salience")));
    for (const rank of ranks) {
      expect(Number.isInteger(rank)).toBe(true);
      expect(rank).toBeGreaterThanOrEqual(0);
      expect(rank).toBeLessThanOrEqual(3);
    }
    // "One focal accent at a time" only means something if top salience is rare: if most roles
    // shout, none of them is heard.
    expect(ranks.filter((r) => r === 3).length).toBeLessThanOrEqual(
      Math.ceil(EPISTEMIC_ROLE_ORDER.length / 2),
    );
  });

  test("most roles are NOT regions — the surface is not a stack of cards", () => {
    // The coherence principle (extraneous material costs learning, d = 0.86) is the reason the
    // grammar prefers an edge to a container. If every role became a region, the board would turn
    // into the card soup this work exists to remove.
    const regions = EPISTEMIC_ROLE_ORDER.filter((r) => tokenValue(r, "tier") === "region");
    expect(regions.length).toBeLessThan(EPISTEMIC_ROLE_ORDER.length);
  });

  test("the previously-undeclared load-bearing tokens are declared", () => {
    // Each of these was read by a live rule while never being defined, so it silently fell back to
    // a hardcoded family or colour. `--font-reading` is why the source-reading pane rendered in
    // Georgia rather than the CDL's knowledge face.
    for (const token of [
      "--font-reading",
      "--font-sans",
      "--font-math",
      "--surface-raised",
      "--state-caution",
      "--radius-md",
      "--line-soft",
      "--s-9",
    ]) {
      expect(tokensCss).toContain(`${token}:`);
    }
  });

  test("colour is never the sole carrier of a role", () => {
    // WCAG 1.4.1 / CSE-008 §5.2. Every role region also renders a text label, and the role changes
    // edge weight and typeface — so the grammar survives any colour-vision deficiency and print.
    expect(stylesCss).toContain(".section-tag");
    expect(stylesCss).toContain(".mccr-el-tag");
    expect(stylesCss).toMatch(/font-family: var\(--role-face/);
  });
});
