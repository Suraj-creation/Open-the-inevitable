/**
 * IntelligenceArtifact — the canonical persistence contract of the Intelligence Plane
 * (CIP-001 §4.1). One envelope for every kind; kind-specific structure lives in `body`.
 * Artifacts are versioned (supersedes), provenance-linked to the chronicle segments they were
 * distilled from, and re-derivable by replay.
 */
import { CryptoIdGenerator, type Brand, type IdGenerator } from "@inevitable/shared";

export type ArtifactId = Brand<string, "ArtifactId">;

export function newArtifactId(gen: IdGenerator = new CryptoIdGenerator()): ArtifactId {
  return `int-${gen.hex(16)}` as ArtifactId;
}

export type IntelligenceRegime = "learner" | "shared";

/** Registry v1 kinds (CIP-002 §2). Extensible: new kinds arrive with their producing milestones. */
export const INTELLIGENCE_KINDS = [
  "learner.episode",
  "learner.understanding-delta",
  "learner.misconception",
  "pedagogy.intervention-outcome",
  "agent.strategy-outcome",
  "agent.collaboration",
  "learner.consolidation-candidate",
] as const;

export type IntelligenceKind = (typeof INTELLIGENCE_KINDS)[number];

export interface ArtifactEpistemics {
  readonly confidence: number;
  /** Distiller id. */
  readonly method: string;
  /** Re-distillation with an improved method SUPERSEDES; it never overwrites (ADR-0035 lock 3). */
  readonly method_version: string;
  /** Chronicle segment refs (event ids) this artifact was folded from. */
  readonly provenance_refs: readonly string[];
  readonly supersedes: ArtifactId | null;
  readonly decay_policy: "none" | "salience" | `ttl:${string}`;
}

export interface IntelligenceArtifact {
  readonly artifact_id: ArtifactId;
  readonly kind: IntelligenceKind;
  readonly scope: {
    readonly regime: IntelligenceRegime;
    readonly learner_cid: string | null;
    readonly tenant_id: string;
  };
  readonly body: Record<string, unknown>;
  readonly epistemics: ArtifactEpistemics;
  /** Named consumers that admitted this kind (ADR-0035 lock 2 — no consumer, no artifact). */
  readonly consumers: readonly string[];
  readonly distilled_hlc: string;
}

/** Distillation lifecycle events — family `intelligence` (permanent, replayable). */
export const INTELLIGENCE_EVENT_TYPES = {
  distilled: "intelligence.distilled",
  superseded: "intelligence.superseded",
  quarantined: "intelligence.quarantined",
  consumed: "intelligence.consumed",
} as const;
