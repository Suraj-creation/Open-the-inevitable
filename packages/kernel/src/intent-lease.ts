/**
 * Intent Lease Service — time-bound, revocable interpretations of a user/system goal.
 * Long-running workflows must hold a valid intent lease. Spec: spec/kernel/intent-lease.md.
 */
import {
  type Clock,
  type IdGenerator,
  type Result,
  SystemClock,
  CryptoIdGenerator,
  newIntentId,
  ok,
  err,
  NotFoundError,
} from "@inevitable/shared";
import { type IntentLease, SCHEMA_IDS, defaultValidator } from "@inevitable/protocols";

export interface CreateIntentLeaseInput {
  ownerUserId: string;
  interpretedGoal: string;
  scope?: string[];
  constraints?: string[];
  renewalConditions?: string[];
  confidence: number;
  heldBy?: string[];
  ttlMs?: number;
}

export interface IntentLeaseServiceOptions {
  clock?: Clock;
  idGenerator?: IdGenerator;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

export class IntentLeaseService {
  private readonly leases = new Map<string, IntentLease>();
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;

  constructor(options: IntentLeaseServiceOptions = {}) {
    this.clock = options.clock ?? new SystemClock();
    this.idGenerator = options.idGenerator ?? new CryptoIdGenerator();
  }

  create(input: CreateIntentLeaseInput): IntentLease {
    const lease: IntentLease = {
      intent_id: newIntentId(this.idGenerator),
      owner_user_id: input.ownerUserId,
      interpreted_goal: input.interpretedGoal,
      scope: input.scope ?? [],
      constraints: input.constraints ?? [],
      expires_at: new Date(this.clock.nowMs() + (input.ttlMs ?? ONE_HOUR_MS)).toISOString(),
      renewal_conditions: input.renewalConditions ?? [],
      revocation_reason: null,
      confidence: input.confidence,
      held_by: input.heldBy ?? [],
    };
    defaultValidator.assertValid(SCHEMA_IDS.intentLease, lease);
    this.leases.set(lease.intent_id, lease);
    return lease;
  }

  get(intentId: string): IntentLease | undefined {
    return this.leases.get(intentId);
  }

  /** Valid = exists, not revoked, not expired. Long-running workflows MUST check this at milestones. */
  isValid(intentId: string, nowMs: number = this.clock.nowMs()): boolean {
    const lease = this.leases.get(intentId);
    if (!lease) return false;
    if (lease.revocation_reason != null) return false;
    return Date.parse(lease.expires_at) > nowMs;
  }

  renew(
    intentId: string,
    options: { ttlMs?: number; confidence?: number } = {},
  ): Result<IntentLease, NotFoundError> {
    const lease = this.leases.get(intentId);
    if (!lease) return err(new NotFoundError(`Unknown intent lease: ${intentId}`));
    const renewed: IntentLease = {
      ...lease,
      expires_at: new Date(this.clock.nowMs() + (options.ttlMs ?? ONE_HOUR_MS)).toISOString(),
      confidence: options.confidence ?? lease.confidence,
      revocation_reason: null,
    };
    this.leases.set(intentId, renewed);
    return ok(renewed);
  }

  revoke(intentId: string, reason: string): Result<IntentLease, NotFoundError> {
    const lease = this.leases.get(intentId);
    if (!lease) return err(new NotFoundError(`Unknown intent lease: ${intentId}`));
    const revoked: IntentLease = { ...lease, revocation_reason: reason };
    this.leases.set(intentId, revoked);
    return ok(revoked);
  }
}
