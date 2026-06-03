/**
 * Tiered cognitive memory — the hierarchical, distributive substrate from F05. Every write is a
 * validated Memory Mutation (no direct writes); mutations are appended per `memory_layer` and folded
 * into a current-state projection per target. Subscribers are notified on every commit, which is the
 * distribution mechanism that gives every agent the learner's context in real time.
 * Spec: spec/memory/memory-tiers.md, spec/protocols/memory-mutation-protocol.md.
 */
import {
  type Result,
  type ProtocolValidationError,
  type IdGenerator,
  newMutationId,
  ok,
  err,
} from "@inevitable/shared";
import { type MemoryMutation, SCHEMA_IDS, defaultValidator } from "@inevitable/protocols";

export type MemoryLayer = MemoryMutation["memory_layer"];
export type MemoryMutationType = MemoryMutation["mutation_type"];

/** Current-state projection for a single addressed memory target within a tier. */
export interface ProjectedMemory {
  readonly key: string;
  readonly layer: MemoryLayer;
  readonly targetId: string;
  readonly confidence: number;
  readonly active: boolean;
  readonly consolidated: boolean;
  readonly lastMutationType: MemoryMutationType;
  readonly mutationCount: number;
}

export type MemorySubscriber = (mutation: MemoryMutation) => void;

function targetIdOf(mutation: MemoryMutation): string {
  const target = mutation.target as { id?: unknown };
  return typeof target.id === "string" ? target.id : JSON.stringify(mutation.target);
}

function decayFactorOf(mutation: MemoryMutation): number {
  const payload = (mutation.payload ?? {}) as { factor?: unknown };
  if (typeof payload.factor === "number") return payload.factor;
  return mutation.confidence;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

export class TieredMemoryStore {
  private readonly logs = new Map<MemoryLayer, MemoryMutation[]>();
  private readonly projections = new Map<string, ProjectedMemory>();
  private readonly subscribers = new Set<MemorySubscriber>();

  /** Commit a typed, validated mutation. Returns the mutation id, or a validation error. */
  commit(mutation: MemoryMutation): Result<string, ProtocolValidationError> {
    const validation = defaultValidator.validate(SCHEMA_IDS.memoryMutation, mutation);
    if (!validation.ok) return err(validation.error);

    let log = this.logs.get(mutation.memory_layer);
    if (!log) {
      log = [];
      this.logs.set(mutation.memory_layer, log);
    }
    log.push(mutation);

    this.project(mutation);
    for (const subscriber of this.subscribers) subscriber(mutation);
    return ok(mutation.mutation_id);
  }

  subscribe(subscriber: MemorySubscriber): { unsubscribe(): void } {
    this.subscribers.add(subscriber);
    return { unsubscribe: () => void this.subscribers.delete(subscriber) };
  }

  /** Append-only mutation history (optionally scoped to one tier) — the source of truth. */
  history(layer?: MemoryLayer): readonly MemoryMutation[] {
    if (layer) return this.logs.get(layer) ?? [];
    return [...this.logs.values()].flat();
  }

  project(layerOrMutation: MemoryLayer | MemoryMutation): ProjectedMemory | undefined;
  project(layer: MemoryLayer, targetId: string): ProjectedMemory | undefined;
  project(a: MemoryLayer | MemoryMutation, b?: string): ProjectedMemory | undefined {
    if (typeof a === "object") return this.applyProjection(a);
    return this.projections.get(`${a}::${b}`);
  }

  projectionOf(layer: MemoryLayer, targetId: string): ProjectedMemory | undefined {
    return this.projections.get(`${layer}::${targetId}`);
  }

  confidenceOf(layer: MemoryLayer, targetId: string): number | undefined {
    return this.projections.get(`${layer}::${targetId}`)?.confidence;
  }

  byLayer(layer: MemoryLayer): ProjectedMemory[] {
    return [...this.projections.values()].filter((p) => p.layer === layer);
  }

  /**
   * Emit `decay_confidence` mutations for every active projection in a tier, multiplying confidence
   * by `factor`. Decay is expressed as mutations, never as a silent edit. Returns committed ids.
   */
  applyDecay(
    layer: MemoryLayer,
    factor: number,
    proposerCid: string,
    idGenerator: IdGenerator,
  ): string[] {
    const committed: string[] = [];
    for (const projection of this.byLayer(layer)) {
      if (!projection.active) continue;
      const mutation: MemoryMutation = {
        mutation_id: newMutationId(idGenerator),
        proposer_cid: proposerCid,
        memory_layer: layer,
        mutation_type: "decay_confidence",
        target: { id: projection.targetId },
        payload: { factor },
        evidence: [],
        confidence: factor,
      } as MemoryMutation;
      const result = this.commit(mutation);
      if (result.ok) committed.push(result.value);
    }
    return committed;
  }

  private applyProjection(mutation: MemoryMutation): ProjectedMemory {
    const targetId = targetIdOf(mutation);
    const key = `${mutation.memory_layer}::${targetId}`;
    const prev = this.projections.get(key);
    const prevConfidence = prev?.confidence ?? 0;

    let confidence = prevConfidence;
    let active = prev?.active ?? true;
    let consolidated = prev?.consolidated ?? false;

    switch (mutation.mutation_type) {
      case "add_fact":
      case "revise_fact":
      case "add_episode":
      case "add_procedural_pattern":
        confidence = mutation.confidence;
        active = true;
        break;
      case "reinforce_concept":
        confidence = clamp01(prevConfidence + (1 - prevConfidence) * mutation.confidence);
        active = true;
        break;
      case "decay_confidence":
        confidence = clamp01(prevConfidence * decayFactorOf(mutation));
        break;
      case "consolidate_memory":
        confidence = mutation.confidence;
        consolidated = true;
        active = true;
        break;
      case "redact_memory":
      case "quarantine_memory":
        active = false;
        break;
      case "link_concepts":
      case "split_concept":
      case "merge_concepts":
        // structural mutations: keep confidence/active, just record the latest type
        break;
    }

    const projection: ProjectedMemory = {
      key,
      layer: mutation.memory_layer,
      targetId,
      confidence,
      active,
      consolidated,
      lastMutationType: mutation.mutation_type,
      mutationCount: (prev?.mutationCount ?? 0) + 1,
    };
    this.projections.set(key, projection);
    return projection;
  }
}
