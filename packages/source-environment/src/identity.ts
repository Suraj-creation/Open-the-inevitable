/**
 * Source identity and versioning — a SourceIdentity is stable across revisions; a SourceVersion
 * is one immutable, content-addressed snapshot. Bytes never live here: `content_ref` points
 * out-of-band; `content_hash` is the shared-layer cache key across learners.
 * Spec: spec/source-environment/CSE-002-canonical-source-representation.md §3.1.
 */
import { createHash } from "node:crypto";
import type { SourceId, SourceVersionId } from "./ids";

export const SOURCE_MODALITIES = [
  "pdf",
  "epub",
  "web",
  "video",
  "audio",
  "code",
  "notebook",
  "dataset",
  "image",
  "presentation",
  "conversation",
  "human-session",
  "markdown",
  "text",
] as const;

export type SourceModality = (typeof SOURCE_MODALITIES)[number];

export interface SourceProvenance {
  /** `creation`: a learner's contributed creation re-entering the substrate (ADR-0051). */
  readonly origin: "upload" | "web" | "api" | "recording" | "fixture" | "creation";
  readonly attributed_source: string;
  readonly license_class: string | null;
  /** Consent envelope reference — mandatory for human-derived modalities (CSE-002 §8). */
  readonly consent_ref: string | null;
}

export interface SourceVersion {
  readonly source_id: SourceId;
  readonly version_id: SourceVersionId;
  readonly modality: SourceModality;
  /** Out-of-band content reference (media store / Storage key). Never bytes. */
  readonly content_ref: string;
  /** sha-256 hex of canonical bytes — content-addressed identity + shared-layer cache key. */
  readonly content_hash: string;
  readonly provenance: SourceProvenance;
  /** Previous version of the same source, forming the version chain for anchor migration. */
  readonly supersedes: SourceVersionId | null;
  readonly registered_hlc: string;
}

/** Content-addressed identity: sha-256 hex over the canonical bytes/text. */
export function contentHash(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

export function isSourceModality(value: string): value is SourceModality {
  return (SOURCE_MODALITIES as readonly string[]).includes(value);
}

/** Modalities whose ingestion requires an explicit consent envelope (CSE-002 §8). */
export const CONSENT_REQUIRED_MODALITIES: readonly SourceModality[] = [
  "conversation",
  "human-session",
];
