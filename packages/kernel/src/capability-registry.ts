/**
 * Capability Registry — fine-grained, dynamic grant/revoke of individual named capabilities to
 * subjects, consulted by governance on every dispatch (the governance "immune system").
 *
 * Complements {@link CapabilityService} (which grants coarse, bounded envelopes): this tracks
 * individual capabilities that can be withdrawn at runtime with immediate effect on the next dispatch.
 * Optionally durable: when `persistDir` is provided, grants and revocations are appended to a JSONL
 * file and replayed on boot so capability state survives restarts. Spec: spec/kernel/capability-registry.md.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Clock, SystemClock } from "@inevitable/shared";

export interface CapabilityGrant {
  readonly capability: string;
  readonly grantedTo: string;
  readonly grantedBy: string;
  readonly grantedAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
}

type CapabilityLogEntry =
  | { op: "grant"; grantedTo: string; capability: string; grantedBy: string; grantedAt: string }
  | {
      op: "revoke";
      grantedTo: string;
      capability: string;
      revokedAt: string;
      revokedReason: string;
    };

export interface CapabilityRegistryOptions {
  clock?: Clock;
  /** When set, grants/revocations are persisted to `<persistDir>/capabilities.jsonl`. */
  persistDir?: string;
}

export class CapabilityRegistry {
  /** subject cid → capability → grant (the latest grant for that capability). */
  private readonly bySubject = new Map<string, Map<string, CapabilityGrant>>();
  private readonly clock: Clock;
  private readonly persistDir: string | undefined;

  constructor(options: CapabilityRegistryOptions = {}) {
    this.clock = options.clock ?? new SystemClock();
    this.persistDir = options.persistDir;
    if (this.persistDir) this.load();
  }

  private logFile(): string {
    return join(this.persistDir!, "capabilities.jsonl");
  }

  private load(): void {
    const file = this.logFile();
    if (!existsSync(file)) return;
    try {
      for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
        if (!line.trim()) continue;
        const entry = JSON.parse(line) as CapabilityLogEntry;
        if (entry.op === "grant") {
          const map = this.subjectMap(entry.grantedTo);
          map.set(entry.capability, {
            capability: entry.capability,
            grantedTo: entry.grantedTo,
            grantedBy: entry.grantedBy,
            grantedAt: entry.grantedAt,
            revokedAt: null,
            revokedReason: null,
          });
        } else if (entry.op === "revoke") {
          const grant = this.bySubject.get(entry.grantedTo)?.get(entry.capability);
          if (grant) {
            grant.revokedAt = entry.revokedAt;
            grant.revokedReason = entry.revokedReason;
          }
        }
      }
    } catch {
      // Corrupt log — start fresh rather than crashing; existing in-memory state may be partial.
    }
  }

  private append(entry: CapabilityLogEntry): void {
    if (!this.persistDir) return;
    mkdirSync(this.persistDir, { recursive: true });
    writeFileSync(this.logFile(), JSON.stringify(entry) + "\n", { flag: "a", encoding: "utf8" });
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
    const grantedAt = this.now();
    const grant: CapabilityGrant = {
      capability,
      grantedTo,
      grantedBy,
      grantedAt,
      revokedAt: null,
      revokedReason: null,
    };
    map.set(capability, grant);
    this.append({ op: "grant", grantedTo, capability, grantedBy, grantedAt });
    return grant;
  }

  /** Revoke a capability (immediate effect). Returns false if the subject never held it. */
  revoke(grantedTo: string, capability: string, reason = "revoked"): boolean {
    const grant = this.bySubject.get(grantedTo)?.get(capability);
    if (!grant || grant.revokedAt !== null) return false;
    const revokedAt = this.now();
    grant.revokedAt = revokedAt;
    grant.revokedReason = reason;
    this.append({ op: "revoke", grantedTo, capability, revokedAt, revokedReason: reason });
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
