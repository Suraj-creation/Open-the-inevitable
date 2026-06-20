/**
 * Capability Registry — fine-grained, dynamic grant/revoke of individual named capabilities to
 * subjects, consulted by governance on every dispatch (the governance "immune system").
 *
 * Complements {@link CapabilityService} (which grants coarse, bounded envelopes): this tracks
 * individual capabilities that can be withdrawn at runtime with immediate effect on the next dispatch.
 * In-memory, consistent with the other kernel services. Spec: spec/kernel/capability-registry.md.
 */
import { type Clock, SystemClock } from "@inevitable/shared";

export interface CapabilityGrant {
  readonly capability: string;
  readonly grantedTo: string;
  readonly grantedBy: string;
  readonly grantedAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
}

export interface CapabilityRegistryOptions {
  clock?: Clock;
}

export class CapabilityRegistry {
  /** subject cid → capability → grant (the latest grant for that capability). */
  private readonly bySubject = new Map<string, Map<string, CapabilityGrant>>();
  private readonly clock: Clock;

  constructor(options: CapabilityRegistryOptions = {}) {
    this.clock = options.clock ?? new SystemClock();
  }

  private now(): string {
    return new Date(this.clock.nowMs()).toISOString();
  }

  private subjectMap(grantedTo: string): Map<string, CapabilityGrant> {
    let map = this.bySubject.get(grantedTo);
    if (!map) {
      map = new Map<string, CapabilityGrant>();
      this.bySubject.set(grantedTo, map);
    }
    return map;
  }

  /** Grant a capability to a subject (idempotent; re-activates a previously revoked capability). */
  grant(grantedTo: string, capability: string, grantedBy = "kernel"): CapabilityGrant {
    const map = this.subjectMap(grantedTo);
    const grant: CapabilityGrant = {
      capability,
      grantedTo,
      grantedBy,
      grantedAt: this.now(),
      revokedAt: null,
      revokedReason: null,
    };
    map.set(capability, grant);
    return grant;
  }

  /** Revoke a capability (immediate effect). Returns false if the subject never held it. */
  revoke(grantedTo: string, capability: string, reason = "revoked"): boolean {
    const grant = this.bySubject.get(grantedTo)?.get(capability);
    if (!grant || grant.revokedAt !== null) return false;
    grant.revokedAt = this.now();
    grant.revokedReason = reason;
    return true;
  }

  /** Active = a grant exists and is not revoked. */
  has(grantedTo: string, capability: string): boolean {
    const grant = this.bySubject.get(grantedTo)?.get(capability);
    return grant !== undefined && grant.revokedAt === null;
  }

  /** The subject's active capabilities (the set governance consults). */
  granted(grantedTo: string): string[] {
    const map = this.bySubject.get(grantedTo);
    if (!map) return [];
    const active: string[] = [];
    for (const grant of map.values()) {
      if (grant.revokedAt === null) active.push(grant.capability);
    }
    return active;
  }

  /** All grants for a subject, including revoked ones (the audit view). */
  list(grantedTo: string): CapabilityGrant[] {
    return [...(this.bySubject.get(grantedTo)?.values() ?? [])];
  }
}
