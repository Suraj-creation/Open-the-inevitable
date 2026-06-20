/**
 * ProposalBlackboard — typed proposal lifecycle over InMemoryBlackboard.
 *
 * Multiple agents write competing proposals for a key; the arbitration winner is
 * recorded. Both proposals and arbitrations accumulate (never deleted) for replay.
 *
 * Spec: spec/orchestration/DPS-008-proposal-blackboard.md, ADR-0018.
 */
import { InMemoryBlackboard } from "./index";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProposalEntry<T = unknown> {
  readonly key: string;
  readonly agentCid: string;
  readonly value: T;
  readonly timestamp: number;
}

export interface ArbitrationRecord {
  readonly key: string;
  readonly winnerCid: string;
  readonly reason: string;
  readonly timestamp: number;
}

// ---------------------------------------------------------------------------
// ProposalBlackboard
// ---------------------------------------------------------------------------

export class ProposalBlackboard {
  private readonly board = new InMemoryBlackboard();
  private readonly proposalLog: ProposalEntry[] = [];
  private readonly arbitrationLog: ArbitrationRecord[] = [];
  private tick = 0;

  private nextTick(): number {
    this.tick += 1;
    return this.tick;
  }

  /** Write a proposal for a key. Multiple agents may propose for the same key. */
  propose<T>(key: string, agentCid: string, value: T): ProposalEntry<T> {
    const entry: ProposalEntry<T> = { key, agentCid, value, timestamp: this.nextTick() };
    this.proposalLog.push(entry as ProposalEntry);
    // Also mirror into the base board under a version-unique key for external inspection.
    this.board.put(`${key}:${agentCid}`, value);
    return entry;
  }

  /** All proposals for a key, in order of arrival. */
  proposals<T>(key: string): readonly ProposalEntry<T>[] {
    return this.proposalLog.filter((e) => e.key === key) as ProposalEntry<T>[];
  }

  /** Record the arbitration decision for a key. */
  arbitrate(key: string, winnerCid: string, reason: string): ArbitrationRecord {
    const record: ArbitrationRecord = { key, winnerCid, reason, timestamp: this.nextTick() };
    this.arbitrationLog.push(record);
    this.board.put(`${key}:arbitration`, record);
    return record;
  }

  /** All arbitration records (append-only, audit-friendly). */
  arbitrations(): readonly ArbitrationRecord[] {
    return [...this.arbitrationLog];
  }

  /** Underlying blackboard version (increments with every write). */
  version(): number {
    return this.board.version();
  }
}
