/**
 * @inevitable/orchestration — orchestration foundations.
 * Spec: spec/orchestration/blackboard-protocol.md, spec/orchestration/orchestration-cells.md.
 * Phase 1C: the blackboard contract (agents coordinate via shared state, not direct calls).
 * Phase 4.1: ProposalBlackboard — typed proposal lifecycle for multi-agent arbitration.
 * Phase 6.1: EvolutionEngine — governed self-evolution lifecycle (DPS-010, ADR-0021).
 * Directors, routing, cells, and consensus land in Phase 1D.
 */
export type { ArbitrationRecord, ProposalEntry } from "./proposals";
export { ProposalBlackboard } from "./proposals";

export type {
  EvaluationResult,
  EvolutionEngineOptions,
  EvolutionProposal,
  ProposeParams,
  ProposalConfiguration,
  ProposalKind,
  ProposalStatus,
  ShadowResult,
  SyntheticLearnerSeed,
} from "./evolution";
export { EvolutionEngine } from "./evolution";
export interface BlackboardEntry<T = unknown> {
  readonly key: string;
  readonly value: T;
  readonly version: number;
}

export interface Blackboard {
  put<T>(key: string, value: T): BlackboardEntry<T>;
  get<T>(key: string): T | undefined;
  entries(): BlackboardEntry[];
  version(): number;
}

/** In-memory versioned blackboard. Every write bumps a monotonic version (audit/replay friendly). */
export class InMemoryBlackboard implements Blackboard {
  private readonly store = new Map<string, BlackboardEntry>();
  private globalVersion = 0;

  put<T>(key: string, value: T): BlackboardEntry<T> {
    this.globalVersion += 1;
    const entry: BlackboardEntry<T> = { key, value, version: this.globalVersion };
    this.store.set(key, entry);
    return entry;
  }

  get<T>(key: string): T | undefined {
    return this.store.get(key)?.value as T | undefined;
  }

  entries(): BlackboardEntry[] {
    return [...this.store.values()];
  }

  version(): number {
    return this.globalVersion;
  }
}
