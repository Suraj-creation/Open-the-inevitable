/**
 * Branded identifiers for the Cognitive Source Environment.
 * Spec: spec/source-environment/CSE-002-canonical-source-representation.md §3, §5.
 */
import { CryptoIdGenerator, type Brand, type IdGenerator } from "@inevitable/shared";

export type SourceId = Brand<string, "SourceId">;
export type SourceVersionId = Brand<string, "SourceVersionId">;
export type AnchorId = Brand<string, "AnchorId">;
export type LayerArtifactId = Brand<string, "LayerArtifactId">;

const defaultGenerator = new CryptoIdGenerator();

export function newSourceId(gen: IdGenerator = defaultGenerator): SourceId {
  return `src-${gen.hex(12)}` as SourceId;
}

export function newSourceVersionId(gen: IdGenerator = defaultGenerator): SourceVersionId {
  return `srcv-${gen.hex(12)}` as SourceVersionId;
}

export function newAnchorId(gen: IdGenerator = defaultGenerator): AnchorId {
  return `anc-${gen.hex(12)}` as AnchorId;
}

export function newLayerArtifactId(gen: IdGenerator = defaultGenerator): LayerArtifactId {
  return `sla-${gen.hex(12)}` as LayerArtifactId;
}
