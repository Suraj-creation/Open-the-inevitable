/**
 * Cognition Blocks — the atomic semantic units of the Cognitive Surface.
 *
 * A block is NOT a UI widget. It is a typed, versioned, provenance-carrying record of one
 * unit of visible cognition, generated from agent outputs. Provenance is mandatory: a block
 * that cannot trace back to its sources is invalid.
 *
 * Spec: spec/surface/cognitive-surface-runtime.md §4.1–§4.2.
 */
import { CosError, type Clock, type IdGenerator, type Result, err, ok } from "@inevitable/shared";

import { EXPLANATION_ROLE_VOCAB_VERSION, structureExplanation } from "./semantic-explanation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const COGNITION_BLOCK_TYPES = [
  "explanation",
  "concept",
  "timeline",
  "practice",
  "assessment",
  "memory",
  "simulation",
  "image",
  "video",
  "voice",
  "code",
  "debate",
  "research",
  "motivation",
  "routing",
] as const;

export type CognitionBlockType = (typeof COGNITION_BLOCK_TYPES)[number];

export type BlockClassification = "public" | "internal" | "sensitive" | "restricted";

/**
 * Mandatory trace-capture record. Every visible artifact must trace back to a packet,
 * an agent, world-state nodes, and (when durable) a memory mutation.
 * Spec: spec/surface/cognitive-surface-runtime.md §4.2.
 */
export interface BlockProvenance {
  readonly packet_id: string | null;
  readonly producer_cid: string;
  readonly agent_id: string | null;
  readonly source_event_id: string | null;
  readonly world_state_nodes: readonly string[];
  readonly memory_mutation_id: string | null;
  readonly trace_id: string | null;
  readonly reason: string;
}

export interface CognitionBlock {
  readonly block_id: string;
  readonly surface_id: string;
  readonly block_type: CognitionBlockType;
  readonly version: number;
  readonly created_at: string;
  readonly hlc: string;
  readonly title: string;
  readonly content: Record<string, unknown>;
  readonly concept_ids: readonly string[];
  readonly classification: BlockClassification;
  readonly confidence: number;
  readonly provenance: BlockProvenance;
}

export interface CreateBlockInput {
  readonly surface_id: string;
  readonly block_type: CognitionBlockType;
  readonly title: string;
  readonly content: Record<string, unknown>;
  readonly concept_ids?: readonly string[];
  readonly classification?: BlockClassification;
  readonly confidence?: number;
  readonly provenance: Omit<BlockProvenance, "source_event_id"> & {
    readonly source_event_id?: string | null;
  };
}

export interface CreateBlockContext {
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly hlc: string;
}

// ---------------------------------------------------------------------------
// Construction + validation
// ---------------------------------------------------------------------------

function blockError(message: string, details?: Record<string, unknown>): CosError {
  return new CosError("E_SURFACE_BLOCK", message, {
    specRef: "spec/surface/cognitive-surface-runtime.md",
    details,
  });
}

const BLOCK_TYPE_SET: ReadonlySet<string> = new Set(COGNITION_BLOCK_TYPES);

/**
 * Structured Semantic Explanation enrichment (the single construction chokepoint, so every path —
 * contribute, streaming, replay-fold — produces identical structured content). An `explanation` block
 * carrying the F04 `layers` bag gains typed, role-tagged `sections` (via the canonical EpistemicRole
 * mapping) plus the mapping's `role_vocab_version`. Additive and deterministic: the legacy `layers`
 * remain for back-compat, and content that already carries `sections` (e.g. agent-emitted) is left
 * untouched. Non-explanation blocks pass through unchanged.
 */
function enrichBlockContent(
  blockType: CognitionBlockType,
  content: Record<string, unknown>,
): Record<string, unknown> {
  if (blockType !== "explanation") return { ...content };
  if (Array.isArray(content["sections"])) return { ...content };
  const layers = content["layers"];
  if (layers === null || typeof layers !== "object") return { ...content };
  const sections = structureExplanation(layers as Record<string, unknown>);
  if (sections.length === 0) return { ...content };
  return { ...content, sections, role_vocab_version: EXPLANATION_ROLE_VOCAB_VERSION };
}

/**
 * Create a version-1 cognition block. Fails (typed error, never throws) when the block
 * would be untraceable or semantically invalid.
 */
export function createCognitionBlock(
  input: CreateBlockInput,
  ctx: CreateBlockContext,
): Result<CognitionBlock, CosError> {
  if (!BLOCK_TYPE_SET.has(input.block_type)) {
    return err(blockError(`unknown block type "${input.block_type}"`));
  }
  if (!input.title.trim()) {
    return err(blockError("block title must be non-empty"));
  }
  if (!input.provenance.producer_cid.trim()) {
    return err(blockError("block provenance requires a producer_cid (trace capture is mandatory)"));
  }
  if (!input.provenance.reason.trim()) {
    return err(blockError("block provenance requires a reason (nothing appears magically)"));
  }
  const confidence = input.confidence ?? 1;
  if (confidence < 0 || confidence > 1 || Number.isNaN(confidence)) {
    return err(blockError(`block confidence ${confidence} out of range [0, 1]`));
  }

  return ok({
    block_id: `blk-${ctx.idGenerator.hex(12)}`,
    surface_id: input.surface_id,
    block_type: input.block_type,
    version: 1,
    created_at: new Date(ctx.clock.nowMs()).toISOString(),
    hlc: ctx.hlc,
    title: input.title,
    content: enrichBlockContent(input.block_type, input.content),
    concept_ids: [...(input.concept_ids ?? [])],
    classification: input.classification ?? "internal",
    confidence,
    provenance: {
      packet_id: input.provenance.packet_id,
      producer_cid: input.provenance.producer_cid,
      agent_id: input.provenance.agent_id,
      source_event_id: input.provenance.source_event_id ?? null,
      world_state_nodes: [...input.provenance.world_state_nodes],
      memory_mutation_id: input.provenance.memory_mutation_id,
      trace_id: input.provenance.trace_id,
      reason: input.provenance.reason,
    },
  });
}
