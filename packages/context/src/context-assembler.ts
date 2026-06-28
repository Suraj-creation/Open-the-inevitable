/**
 * ContextAssembler (DPS-005) — VectorStore-backed semantic retrieval over memory, assembled into a
 * bounded working-memory context under a ContextLease.
 *
 * The lease is the boundary, enforced fail-closed: only items whose tier ∈ `memory_layers` and whose
 * owner ∈ `allowed_users` are eligible; the assembled context never exceeds `token_budget`; an expired
 * lease assembles nothing. What the lease excludes is counted and reported, never silently dropped.
 *
 * Retrieval ranks items by cosine similarity using a deterministic local embedding (see embedding.ts),
 * so the same (memory, query, lease) always assembles the identical context — required for replay.
 *
 * Spec: spec/persistence/context-lease-bounded-retrieval.md, spec/kernel/context-lease.md.
 */
import type { VectorStore } from "@inevitable/contracts";
import type { ContextLease } from "@inevitable/protocols";
import { DEFAULT_EMBED_DIM, embedText } from "./embedding";

/** A memory item eligible for retrieval (a projection of a durable memory mutation). */
export interface RetrievableMemoryItem {
  /** Stable id (the source mutation id). */
  readonly id: string;
  /** The indexable content (e.g. a concept id / fact text). */
  readonly text: string;
  /** Tier the item lives in — checked against `lease.memory_layers`. */
  readonly memoryLayer: string;
  /** Owner — checked against `lease.allowed_users`. */
  readonly ownerUserId: string;
  readonly confidence: number;
}

/** An item admitted into the assembled context, with its relevance score and token estimate. */
export interface AssembledContextItem extends RetrievableMemoryItem {
  readonly score: number;
  readonly estimatedTokens: number;
}

/** The bounded result of an assembly — the working-memory slice plus the boundary accounting. */
export interface WorkingMemoryContext {
  readonly leaseId: string;
  readonly query: string;
  readonly items: readonly AssembledContextItem[];
  readonly tokensUsed: number;
  readonly tokenBudget: number;
  /** Relevant items cut because the token budget was exhausted. */
  readonly droppedForBudget: number;
  /** Relevant items excluded by the lease (tier/user scope). */
  readonly excludedByLease: number;
  /** True when the lease was past `expires_at` ⇒ nothing was assembled. */
  readonly leaseExpired: boolean;
}

export interface ContextAssemblerDeps {
  readonly vectors: VectorStore;
  readonly collection?: string;
  readonly dim?: number;
  /** Real semantic embed fn (e.g. Gemini text-embeddings). Absent ⇒ local FNV-1a fallback. */
  readonly embedFn?: (text: string) => Promise<number[]>;
}

export interface AssembleInput {
  readonly query: string;
  readonly lease: ContextLease;
  /** Session clock time (ms) for expiry checks. Omit to skip the expiry check. */
  readonly nowMs?: number;
  /** Max number of items to admit (after lease + budget bounding). */
  readonly limit?: number;
  /** Minimum cosine similarity to admit an item (exclusive). Default 0 (off-topic ⇒ excluded). */
  readonly minScore?: number;
}

/** ~4 characters per token — a coarse, deterministic estimate; never zero for non-empty text. */
function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export class ContextAssembler {
  private readonly vectors: VectorStore;
  private readonly collection: string;
  private readonly dim: number;
  private readonly embedFn: ((text: string) => Promise<number[]>) | undefined;
  private readonly items = new Map<string, RetrievableMemoryItem>();

  constructor(deps: ContextAssemblerDeps) {
    this.vectors = deps.vectors;
    this.collection = deps.collection ?? "context";
    this.dim = deps.dim ?? DEFAULT_EMBED_DIM;
    this.embedFn = deps.embedFn;
  }

  private async embed(text: string): Promise<number[]> {
    if (this.embedFn) {
      try {
        return await this.embedFn(text);
      } catch {
        // Fall back to local heuristic on model failure.
      }
    }
    return embedText(text, this.dim);
  }

  /** Index (or re-index) eligible memory items. Idempotent by id; items without text are skipped. */
  async index(items: readonly RetrievableMemoryItem[]): Promise<void> {
    for (const item of items) {
      if (!item.text || !item.text.trim()) continue;
      this.items.set(item.id, item);
      await this.vectors.upsert(this.collection, item.id, await this.embed(item.text));
    }
  }

  /** Number of indexed items (for inspection/tests). */
  size(): number {
    return this.items.size;
  }

  /** Assemble a bounded working-memory context for a query under a context lease. */
  async assemble(input: AssembleInput): Promise<WorkingMemoryContext> {
    const { query, lease } = input;
    const tokenBudget = lease.token_budget ?? Number.POSITIVE_INFINITY;
    const empty = (leaseExpired: boolean): WorkingMemoryContext => ({
      leaseId: lease.lease_id,
      query,
      items: [],
      tokensUsed: 0,
      tokenBudget,
      droppedForBudget: 0,
      excludedByLease: 0,
      leaseExpired,
    });

    // Fail-closed on an expired lease.
    if (input.nowMs !== undefined) {
      const expiresAt = Date.parse(lease.expires_at);
      if (Number.isFinite(expiresAt) && expiresAt <= input.nowMs) return empty(true);
    }
    if (this.items.size === 0) return empty(false);

    const allowedLayers = new Set(lease.memory_layers);
    const allowedUsers = lease.allowed_users; // undefined ⇒ no user restriction
    const minScore = input.minScore ?? 0;

    // Rank every indexed item by similarity (search returns id+score; we hold the payloads).
    const ranked = await this.vectors.search(
      this.collection,
      await this.embed(query),
      this.items.size,
    );

    const admitted: AssembledContextItem[] = [];
    let tokensUsed = 0;
    let droppedForBudget = 0;
    let excludedByLease = 0;

    for (const { id, score } of ranked) {
      if (score <= minScore) continue; // off-topic ⇒ not relevant (not a lease exclusion)
      const item = this.items.get(id);
      if (!item) continue;
      if (!allowedLayers.has(item.memoryLayer)) {
        excludedByLease++;
        continue;
      }
      if (allowedUsers && !allowedUsers.includes(item.ownerUserId)) {
        excludedByLease++;
        continue;
      }
      if (input.limit !== undefined && admitted.length >= input.limit) {
        droppedForBudget++;
        continue;
      }
      const estimatedTokens = estimateTokens(item.text);
      if (tokensUsed + estimatedTokens > tokenBudget) {
        droppedForBudget++;
        continue; // a smaller, lower-ranked item may still fit
      }
      tokensUsed += estimatedTokens;
      admitted.push({ ...item, score, estimatedTokens });
    }

    return {
      leaseId: lease.lease_id,
      query,
      items: admitted,
      tokensUsed,
      tokenBudget,
      droppedForBudget,
      excludedByLease,
      leaseExpired: false,
    };
  }
}
