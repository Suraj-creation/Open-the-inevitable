/**
 * Capability Service — grants and enforces Capability Envelopes (policy-granted bounds).
 * Authorization checks (tools, memory scopes, regions, expiry) are the enforcement surface for
 * "no side-effecting action without authorization". Spec: spec/kernel/capability-envelope.md.
 */
import {
  type Clock,
  type IdGenerator,
  SystemClock,
  CryptoIdGenerator,
  newEnvelopeId,
} from "@inevitable/shared";
import { type CapabilityEnvelope, SCHEMA_IDS, defaultValidator } from "@inevitable/protocols";
import { type GovernanceEngine, assertAllowed } from "@inevitable/governance";

export interface GrantEnvelopeInput {
  grantedTo: string;
  grantedBy: string;
  toolsAllowed?: string[];
  memoryScopes?: string[];
  modelsAllowed?: string[];
  maxSpawnDepth?: number;
  maxChildUnits?: number;
  networkAccess?: boolean;
  costCeilingUsd?: number;
  latencyCeilingMs?: number | null;
  dataClassificationCeiling?: NonNullable<CapabilityEnvelope["data_classification_ceiling"]>;
  regionsAllowed?: string[];
  humanReviewRequiredFor?: string[];
  /** Time-to-live in ms; defaults to 1 hour. */
  ttlMs?: number;
}

export interface CapabilityServiceOptions {
  clock?: Clock;
  idGenerator?: IdGenerator;
  /** Optional governance hook consulted before granting/escalating capability. */
  governance?: GovernanceEngine;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

export class CapabilityService {
  private readonly byId = new Map<string, CapabilityEnvelope>();
  private readonly bySubject = new Map<string, string>();
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;
  private readonly governance: GovernanceEngine | undefined;

  constructor(options: CapabilityServiceOptions = {}) {
    this.clock = options.clock ?? new SystemClock();
    this.idGenerator = options.idGenerator ?? new CryptoIdGenerator();
    this.governance = options.governance;
  }

  grant(input: GrantEnvelopeInput): CapabilityEnvelope {
    if (this.governance) {
      assertAllowed(this.governance, {
        subjectCid: input.grantedBy,
        resource: `capability:${input.grantedTo}`,
        action: "capability.grant",
        context: { tools: input.toolsAllowed ?? [] },
      });
    }
    const envelope: CapabilityEnvelope = {
      envelope_id: newEnvelopeId(this.idGenerator),
      granted_to: input.grantedTo,
      granted_by: input.grantedBy,
      tools_allowed: input.toolsAllowed ?? [],
      memory_scopes: input.memoryScopes ?? [],
      models_allowed: input.modelsAllowed ?? [],
      max_spawn_depth: input.maxSpawnDepth ?? 0,
      max_child_units: input.maxChildUnits ?? 0,
      network_access: input.networkAccess ?? false,
      cost_ceiling_usd: input.costCeilingUsd ?? 0,
      latency_ceiling_ms: input.latencyCeilingMs ?? null,
      data_classification_ceiling: input.dataClassificationCeiling ?? "internal",
      regions_allowed: input.regionsAllowed ?? [],
      human_review_required_for: input.humanReviewRequiredFor ?? [],
      expires_at: new Date(this.clock.nowMs() + (input.ttlMs ?? ONE_HOUR_MS)).toISOString(),
    };
    defaultValidator.assertValid(SCHEMA_IDS.capabilityEnvelope, envelope);
    this.byId.set(envelope.envelope_id, envelope);
    this.bySubject.set(envelope.granted_to, envelope.envelope_id);
    return envelope;
  }

  get(envelopeId: string): CapabilityEnvelope | undefined {
    return this.byId.get(envelopeId);
  }

  getForSubject(cid: string): CapabilityEnvelope | undefined {
    const id = this.bySubject.get(cid);
    return id ? this.byId.get(id) : undefined;
  }

  isActive(envelopeId: string, nowMs: number = this.clock.nowMs()): boolean {
    const envelope = this.byId.get(envelopeId);
    if (!envelope) return false;
    return Date.parse(envelope.expires_at) > nowMs;
  }

  revoke(envelopeId: string): boolean {
    const envelope = this.byId.get(envelopeId);
    if (!envelope) return false;
    this.byId.delete(envelopeId);
    if (this.bySubject.get(envelope.granted_to) === envelopeId) {
      this.bySubject.delete(envelope.granted_to);
    }
    return true;
  }

  authorizeTool(cid: string, tool: string): boolean {
    return this.authorize(cid, (envelope) => (envelope.tools_allowed ?? []).includes(tool));
  }

  authorizeMemoryScope(cid: string, scope: string): boolean {
    return this.authorize(cid, (envelope) => (envelope.memory_scopes ?? []).includes(scope));
  }

  authorizeRegion(cid: string, region: string): boolean {
    return this.authorize(cid, (envelope) => (envelope.regions_allowed ?? []).includes(region));
  }

  private authorize(cid: string, predicate: (envelope: CapabilityEnvelope) => boolean): boolean {
    const envelope = this.getForSubject(cid);
    if (!envelope) return false;
    if (!this.isActive(envelope.envelope_id)) return false;
    return predicate(envelope);
  }
}
