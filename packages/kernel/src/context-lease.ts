/**
 * Context Lease Service — bounded, revocable, time-limited access to memory/state slices
 * ("virtual memory for cognition"). Spec: spec/kernel/context-lease.md.
 */
import {
  type Clock,
  type IdGenerator,
  type Result,
  SystemClock,
  CryptoIdGenerator,
  newLeaseId,
  ok,
  err,
  NotFoundError,
} from "@inevitable/shared";
import { type ContextLease, SCHEMA_IDS, defaultValidator } from "@inevitable/protocols";

export interface RequestContextLeaseInput {
  grantedTo: string;
  memoryLayers: string[];
  allowedConcepts?: string[];
  allowedUsers?: string[];
  redactionRules?: string[];
  tokenBudget?: number;
  frozen?: boolean;
  grantedBy?: string;
  ttlMs?: number;
}

export interface ContextLeaseServiceOptions {
  clock?: Clock;
  idGenerator?: IdGenerator;
}

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

export class ContextLeaseService {
  private readonly leases = new Map<string, ContextLease>();
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;

  constructor(options: ContextLeaseServiceOptions = {}) {
    this.clock = options.clock ?? new SystemClock();
    this.idGenerator = options.idGenerator ?? new CryptoIdGenerator();
  }

  request(input: RequestContextLeaseInput): ContextLease {
    const lease: ContextLease = {
      lease_id: newLeaseId(this.idGenerator),
      granted_to: input.grantedTo,
      memory_layers: input.memoryLayers,
      allowed_concepts: input.allowedConcepts ?? [],
      allowed_time_range: { from: null, to: null },
      allowed_users: input.allowedUsers ?? [],
      redaction_rules: input.redactionRules ?? [],
      token_budget: input.tokenBudget ?? 0,
      frozen: input.frozen ?? false,
      granted_by: input.grantedBy ?? "kernel",
      expires_at: new Date(this.clock.nowMs() + (input.ttlMs ?? FIFTEEN_MINUTES_MS)).toISOString(),
    };
    defaultValidator.assertValid(SCHEMA_IDS.contextLease, lease);
    this.leases.set(lease.lease_id, lease);
    return lease;
  }

  get(leaseId: string): ContextLease | undefined {
    return this.leases.get(leaseId);
  }

  isActive(leaseId: string, nowMs: number = this.clock.nowMs()): boolean {
    const lease = this.leases.get(leaseId);
    if (!lease) return false;
    return Date.parse(lease.expires_at) > nowMs;
  }

  /** A read is authorized only for an active lease that covers the requested memory layer. */
  authorizeLayer(leaseId: string, layer: string): boolean {
    const lease = this.leases.get(leaseId);
    if (!lease || !this.isActive(leaseId)) return false;
    return lease.memory_layers.includes(layer);
  }

  renew(leaseId: string, ttlMs: number = FIFTEEN_MINUTES_MS): Result<ContextLease, NotFoundError> {
    const lease = this.leases.get(leaseId);
    if (!lease) return err(new NotFoundError(`Unknown context lease: ${leaseId}`));
    const renewed: ContextLease = {
      ...lease,
      expires_at: new Date(this.clock.nowMs() + ttlMs).toISOString(),
    };
    this.leases.set(leaseId, renewed);
    return ok(renewed);
  }

  revoke(leaseId: string): boolean {
    return this.leases.delete(leaseId);
  }
}
