/**
 * @inevitable/memory — memory foundations + tiered cognitive memory.
 * Spec: spec/protocols/memory-mutation-protocol.md, spec/memory/memory-tiers.md.
 * Phase 1C: every write is a validated Memory Mutation (no direct writes).
 * Phase 1D: tiered stores (working/episodic/semantic/…), projections, decay, and real-time
 * distribution via subscription (see {@link TieredMemoryStore}).
 */
import { type Result, ok, err, type ProtocolValidationError } from "@inevitable/shared";
import { type MemoryMutation, SCHEMA_IDS, defaultValidator } from "@inevitable/protocols";

export type { MemoryMutation };

export type {
  MemoryLayer,
  MemoryMutationType,
  ProjectedMemory,
  MemorySubscriber,
} from "./tiered-store";
export { TieredMemoryStore } from "./tiered-store";

export interface MemoryStore {
  /** Commit a typed, validated mutation. Returns the mutation id on success. */
  commit(mutation: MemoryMutation): Result<string, ProtocolValidationError>;
  /** Append-only mutation history (the source of truth for memory state). */
  history(): readonly MemoryMutation[];
}

/** Reference in-memory store. Rejects malformed mutations; never mutates state directly. */
export class InMemoryMemoryStore implements MemoryStore {
  private readonly mutations: MemoryMutation[] = [];

  commit(mutation: MemoryMutation): Result<string, ProtocolValidationError> {
    const validation = defaultValidator.validate(SCHEMA_IDS.memoryMutation, mutation);
    if (!validation.ok) return err(validation.error);
    this.mutations.push(mutation);
    return ok(mutation.mutation_id);
  }

  history(): readonly MemoryMutation[] {
    return this.mutations;
  }
}
