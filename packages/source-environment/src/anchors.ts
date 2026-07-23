/**
 * The Source Anchor — the load-bearing addressing primitive of the CSE domain. Every reference
 * into a source (highlight, citation, narration binding, viewport, episode, claim) resolves
 * through an anchor; bare page numbers, pixel offsets, or timestamps are forbidden as references.
 *
 * Laws implemented here (CSE-002 §5):
 *  - every anchor carries ≥ 2 independent selector types (enforced at creation, not resolution);
 *  - resolution is a total pure function of (anchor, structural layer) — no models, no I/O;
 *  - selector disagreement flags the anchor `unstable` rather than guessing silently;
 *  - migration across versions yields resolved | moved | orphaned; orphaned anchors are never
 *    deleted — they render as preserved quotes.
 */
import { CosError, err, ok, type Result } from "@inevitable/shared";
import type { AnchorId, SourceVersionId } from "./ids";
import type { StructuralLayerContent, StructuralRegion } from "./layers";

export const ANCHOR_GRANULARITIES = [
  "document",
  "section",
  "paragraph",
  "sentence",
  "phrase",
  "equation",
  "symbol",
  "figure",
  "caption",
  "table",
  "cell",
  "scene",
  "utterance",
  "region",
] as const;

export type AnchorGranularity = (typeof ANCHOR_GRANULARITIES)[number];

export type AnchorSelector =
  | { readonly type: "structural"; readonly path: string }
  | {
      readonly type: "text-quote";
      readonly exact: string;
      readonly prefix?: string;
      readonly suffix?: string;
    }
  | {
      readonly type: "region";
      readonly page: number;
      readonly bbox: readonly [number, number, number, number];
    }
  | { readonly type: "temporal"; readonly start_ms: number; readonly end_ms: number }
  | {
      readonly type: "code";
      readonly path: string;
      readonly symbol?: string;
      readonly lines?: readonly [number, number];
    }
  | {
      readonly type: "data";
      readonly table: string;
      readonly rows?: string;
      readonly cols?: readonly string[];
    };

export type AnchorSelectorType = AnchorSelector["type"];

export interface SourceAnchor {
  readonly anchor_id: AnchorId;
  readonly source_version_id: SourceVersionId;
  readonly selectors: readonly AnchorSelector[];
  readonly granularity: AnchorGranularity;
  readonly concept_refs: readonly string[];
  readonly created_by: string;
}

/** A concrete resolved location inside a source version's structural layer. */
export interface ResolvedRegion {
  readonly path: string;
  readonly char_start: number;
  readonly char_end: number;
  readonly text: string;
}

export type AnchorResolution =
  | {
      readonly status: "resolved";
      readonly region: ResolvedRegion;
      readonly resolved_by: AnchorSelectorType;
    }
  | {
      readonly status: "unstable";
      readonly candidates: readonly ResolvedRegion[];
      readonly reason: string;
    }
  | { readonly status: "miss"; readonly reason: string };

export type AnchorMigrationStatus = "resolved" | "moved" | "orphaned";

export interface AnchorMigration {
  readonly anchor_id: AnchorId;
  readonly from_version: SourceVersionId;
  readonly to_version: SourceVersionId;
  readonly status: AnchorMigrationStatus;
  /** The migrated anchor (selectors refreshed against the new version) when not orphaned. */
  readonly migrated: SourceAnchor | null;
}

export interface CreateAnchorInput {
  readonly anchor_id: AnchorId;
  readonly source_version_id: SourceVersionId;
  readonly selectors: readonly AnchorSelector[];
  readonly granularity: AnchorGranularity;
  readonly concept_refs?: readonly string[];
  readonly created_by: string;
}

/**
 * Anchor creation enforces the redundant-selector law: at least two selectors of distinct types
 * (CSE-002 §5.2). Resolution never enforces this — historical anchors must always resolve the
 * same way on replay.
 */
export function createAnchor(input: CreateAnchorInput): Result<SourceAnchor, CosError> {
  const distinctTypes = new Set(input.selectors.map((s) => s.type));
  if (input.selectors.length < 2 || distinctTypes.size < 2) {
    return err(
      new CosError(
        "E_SOURCE_ANCHOR_SELECTORS",
        "A Source Anchor requires at least two selectors of distinct types (CSE-002 §5.2)",
        {
          specRef: "source-environment/CSE-002-canonical-source-representation#5",
          details: { provided: input.selectors.map((s) => s.type) },
        },
      ),
    );
  }
  return ok({
    anchor_id: input.anchor_id,
    source_version_id: input.source_version_id,
    selectors: input.selectors,
    granularity: input.granularity,
    concept_refs: input.concept_refs ?? [],
    created_by: input.created_by,
  });
}

function toResolvedRegion(region: StructuralRegion): ResolvedRegion {
  return {
    path: region.path,
    char_start: region.char_start,
    char_end: region.char_end,
    text: region.text,
  };
}

/** Resolve one selector against the structural layer. Ambiguity ⇒ unresolved (never a guess). */
function resolveSelector(
  selector: AnchorSelector,
  structural: StructuralLayerContent,
): ResolvedRegion | null {
  switch (selector.type) {
    case "structural": {
      const match = structural.regions.find((r) => r.path === selector.path);
      return match ? toResolvedRegion(match) : null;
    }
    case "text-quote": {
      const containing = structural.regions.filter((r) => r.text.includes(selector.exact));
      if (containing.length === 0) return null;
      if (containing.length === 1) {
        const only = containing[0];
        return only ? toResolvedRegion(only) : null;
      }
      const prefix = selector.prefix ?? "";
      const suffix = selector.suffix ?? "";
      if (!prefix && !suffix) return null; // ambiguous with no disambiguator: refuse to guess
      const disambiguated = containing.filter((r) =>
        r.text.includes(prefix + selector.exact + suffix),
      );
      const unique = disambiguated.length === 1 ? disambiguated[0] : undefined;
      return unique ? toResolvedRegion(unique) : null;
    }
    case "code": {
      const match = structural.regions.find(
        (r) => r.kind === "code" && (r.path === selector.path || r.text.includes(selector.path)),
      );
      return match ? toResolvedRegion(match) : null;
    }
    case "region": {
      // M4 (ADR-0036): paginated regions carry page + bbox; a region selector resolves to the
      // region with the highest bbox overlap on the same page — ≥50% of the selector's area,
      // uniquely. Ambiguity (two regions ≥50%) refuses, never guesses.
      const [sx, sy, sw, sh] = selector.bbox;
      const selectorArea = Math.max(0, sw) * Math.max(0, sh);
      if (selectorArea === 0) return null;
      const overlaps = structural.regions
        .filter((r) => r.page === selector.page && r.bbox)
        .map((r) => {
          const [rx, ry, rw, rh] = r.bbox!;
          const ix = Math.max(0, Math.min(sx + sw, rx + rw) - Math.max(sx, rx));
          const iy = Math.max(0, Math.min(sy + sh, ry + rh) - Math.max(sy, ry));
          return { region: r, coverage: (ix * iy) / selectorArea };
        })
        .filter((o) => o.coverage >= 0.5)
        .sort((a, b) => b.coverage - a.coverage);
      const best = overlaps[0];
      if (!best) return null;
      const second = overlaps[1];
      if (second && second.coverage === best.coverage) return null; // exact tie: refuse
      return toResolvedRegion(best.region);
    }
    // temporal/data selectors resolve against temporal/dataset layers, which land with their
    // modalities (M10). Against document layers they are simply unresolved.
    case "temporal":
    case "data":
      return null;
    default:
      return null;
  }
}

/**
 * Pure-function anchor resolution (CSE-002 §5.3). Tries selectors in declared order; records
 * which selector resolved. If two selectors resolve to *different* regions the anchor is
 * `unstable` — surfaced honestly, never silently picked.
 */
export function resolveAnchor(
  anchor: SourceAnchor,
  structural: StructuralLayerContent,
): AnchorResolution {
  const resolved: Array<{ region: ResolvedRegion; by: AnchorSelectorType }> = [];
  for (const selector of anchor.selectors) {
    const region = resolveSelector(selector, structural);
    if (region) resolved.push({ region, by: selector.type });
  }
  if (resolved.length === 0) {
    return { status: "miss", reason: "no selector resolved against the structural layer" };
  }
  const first = resolved[0];
  if (!first) return { status: "miss", reason: "no selector resolved" };
  const disagreeing = resolved.filter((r) => r.region.path !== first.region.path);
  if (disagreeing.length > 0) {
    return {
      status: "unstable",
      candidates: resolved.map((r) => r.region),
      reason: "selectors resolved to different regions",
    };
  }
  return { status: "resolved", region: first.region, resolved_by: first.by };
}

/**
 * Migrate an anchor across a version chain (CSE-002 §5.4).
 *
 * Migration prefers **content identity over structural identity** — that is the purpose of
 * redundant selectors. The content selectors (text-quote, code) locate the meaning in the new
 * version; the structural selector is then *refreshed* to wherever the content now lives:
 *  - `resolved` — content found at the same structural path;
 *  - `moved`    — content found at a different path (structural selector rewritten);
 *  - `orphaned` — content not found; the anchor is retained, rendering as a preserved quote.
 * (Plain `resolveAnchor` would flag path/quote disagreement `unstable` — correct at read time,
 * wrong for migration, where that disagreement is precisely the signal the content moved.)
 */
export function migrateAnchor(
  anchor: SourceAnchor,
  toVersion: SourceVersionId,
  toStructural: StructuralLayerContent,
): AnchorMigration {
  const contentSelectors = anchor.selectors.filter(
    (s) => s.type === "text-quote" || s.type === "code",
  );
  let region: ResolvedRegion | null = null;
  for (const selector of contentSelectors) {
    region = resolveSelector(selector, toStructural);
    if (region) break;
  }
  if (!region) {
    return {
      anchor_id: anchor.anchor_id,
      from_version: anchor.source_version_id,
      to_version: toVersion,
      status: "orphaned",
      migrated: null,
    };
  }
  const found = region;
  const originalPath = anchor.selectors.find(
    (s): s is Extract<AnchorSelector, { type: "structural" }> => s.type === "structural",
  )?.path;
  const samePath = originalPath !== undefined && originalPath === found.path;
  const refreshedSelectors: readonly AnchorSelector[] = anchor.selectors.map((s) =>
    s.type === "structural" ? { type: "structural", path: found.path } : s,
  );
  return {
    anchor_id: anchor.anchor_id,
    from_version: anchor.source_version_id,
    to_version: toVersion,
    status: samePath ? "resolved" : "moved",
    migrated: {
      ...anchor,
      source_version_id: toVersion,
      selectors: refreshedSelectors,
    },
  };
}
