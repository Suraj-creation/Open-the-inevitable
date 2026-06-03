/**
 * Identity Service — issues and tracks Cognitive Identities (CIDs). Enforces the spawn invariants:
 * child trust = max(0, parent.trust - 1) and child.capabilities ⊆ parent.capabilities.
 * Spec: spec/kernel/cognitive-identity.md.
 */
import {
  type Clock,
  type IdGenerator,
  type Result,
  SystemClock,
  CryptoIdGenerator,
  newCid,
  ok,
  err,
  NotFoundError,
  CapabilityDeniedError,
  type CosError,
} from "@inevitable/shared";
import { type CognitiveIdentity, SCHEMA_IDS, defaultValidator } from "@inevitable/protocols";

export interface IssueIdentityInput {
  unitType: string;
  version?: string;
  capabilities?: string[];
  trustLevel?: number;
  parentCid?: string | null;
  lineage?: string[];
  tenantId?: string | null;
  governancePolicies?: string[];
}

export interface SpawnChildInput {
  unitType: string;
  version?: string;
  capabilities?: string[];
  tenantId?: string | null;
  governancePolicies?: string[];
}

export interface IdentityServiceOptions {
  clock?: Clock;
  idGenerator?: IdGenerator;
}

export class IdentityService {
  private readonly registry = new Map<string, CognitiveIdentity>();
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;

  constructor(options: IdentityServiceOptions = {}) {
    this.clock = options.clock ?? new SystemClock();
    this.idGenerator = options.idGenerator ?? new CryptoIdGenerator();
  }

  issue(input: IssueIdentityInput): CognitiveIdentity {
    const identity: CognitiveIdentity = {
      cid: newCid(this.idGenerator),
      unit_type: input.unitType,
      version: input.version ?? "1.0.0",
      capabilities: input.capabilities ?? [],
      trust_level: clampTrust(input.trustLevel ?? 0),
      parent_cid: input.parentCid ?? null,
      lineage: input.lineage ?? [],
      tenant_id: input.tenantId ?? null,
      created_at: new Date(this.clock.nowMs()).toISOString(),
      governance_policies: input.governancePolicies ?? [],
      attestation_chain: [],
    };
    defaultValidator.assertValid(SCHEMA_IDS.cognitiveIdentity, identity);
    this.registry.set(identity.cid, identity);
    return identity;
  }

  spawnChild(parentCid: string, input: SpawnChildInput): Result<CognitiveIdentity, CosError> {
    const parent = this.registry.get(parentCid);
    if (!parent) return err(new NotFoundError(`Unknown parent CID: ${parentCid}`));

    const requested = input.capabilities ?? [];
    const parentCaps = new Set(parent.capabilities ?? []);
    const illegal = requested.filter((capability) => !parentCaps.has(capability));
    if (illegal.length > 0) {
      return err(
        new CapabilityDeniedError(
          `Child requests capabilities not held by parent: ${illegal.join(", ")}`,
          { specRef: "spec/kernel/cognitive-identity.md", details: { illegal } },
        ),
      );
    }

    const child = this.issue({
      unitType: input.unitType,
      ...(input.version !== undefined ? { version: input.version } : {}),
      capabilities: requested,
      trustLevel: Math.max(0, parent.trust_level - 1),
      parentCid: parent.cid,
      lineage: [...(parent.lineage ?? []), parent.cid],
      tenantId: input.tenantId ?? parent.tenant_id ?? null,
      governancePolicies: input.governancePolicies ?? parent.governance_policies ?? [],
    });
    return ok(child);
  }

  get(cid: string): CognitiveIdentity | undefined {
    return this.registry.get(cid);
  }

  has(cid: string): boolean {
    return this.registry.has(cid);
  }

  /** Revoke an identity. Returns true if it existed. */
  revoke(cid: string): boolean {
    return this.registry.delete(cid);
  }

  /** Adjust trust within [0, 10] (adaptive governance). */
  adjustTrust(cid: string, delta: number): Result<CognitiveIdentity, NotFoundError> {
    const identity = this.registry.get(cid);
    if (!identity) return err(new NotFoundError(`Unknown CID: ${cid}`));
    const updated: CognitiveIdentity = {
      ...identity,
      trust_level: clampTrust(identity.trust_level + delta),
    };
    this.registry.set(cid, updated);
    return ok(updated);
  }

  list(): CognitiveIdentity[] {
    return [...this.registry.values()];
  }
}

function clampTrust(value: number): number {
  return Math.max(0, Math.min(10, Math.trunc(value)));
}
