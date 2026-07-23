/**
 * Per-version anchor index — what makes semantic viewports, lens rails, and multi-source
 * alignment cheap: query anchors by concept, granularity, structural containment, or text.
 * Spec: spec/source-environment/CSE-002-canonical-source-representation.md §5.5.
 */
import type { AnchorId } from "./ids";
import type { AnchorGranularity, AnchorResolution, SourceAnchor } from "./anchors";

interface IndexedAnchor {
  readonly anchor: SourceAnchor;
  readonly resolution: AnchorResolution;
}

export class AnchorIndex {
  private readonly byId = new Map<AnchorId, IndexedAnchor>();

  add(anchor: SourceAnchor, resolution: AnchorResolution): void {
    this.byId.set(anchor.anchor_id, { anchor, resolution });
  }

  get(anchorId: AnchorId): SourceAnchor | undefined {
    return this.byId.get(anchorId)?.anchor;
  }

  resolutionOf(anchorId: AnchorId): AnchorResolution | undefined {
    return this.byId.get(anchorId)?.resolution;
  }

  list(): SourceAnchor[] {
    return [...this.byId.values()].map((e) => e.anchor);
  }

  byConcept(conceptRef: string): SourceAnchor[] {
    return this.list().filter((a) => a.concept_refs.includes(conceptRef));
  }

  byGranularity(granularity: AnchorGranularity): SourceAnchor[] {
    return this.list().filter((a) => a.granularity === granularity);
  }

  /** Anchors whose resolved region sits at or under a structural path prefix. */
  within(pathPrefix: string): SourceAnchor[] {
    return [...this.byId.values()]
      .filter(
        (e) =>
          e.resolution.status === "resolved" &&
          (e.resolution.region.path === pathPrefix ||
            e.resolution.region.path.startsWith(`${pathPrefix}/`)),
      )
      .map((e) => e.anchor);
  }

  /** Anchors whose resolved text contains the query (case-sensitive; callers normalize). */
  findByText(query: string): SourceAnchor[] {
    return [...this.byId.values()]
      .filter((e) => e.resolution.status === "resolved" && e.resolution.region.text.includes(query))
      .map((e) => e.anchor);
  }

  get size(): number {
    return this.byId.size;
  }
}
