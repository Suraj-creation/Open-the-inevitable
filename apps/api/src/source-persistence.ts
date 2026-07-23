/**
 * SourcePlanePersistence — the durable floor under the gateway's source plane (ADR-0055 D1).
 *
 * Pure `node:fs`, zero dependencies (the DPS-001 pattern): everything the SourceHub must not
 * forget across a restart lives under `<COS_PERSIST_DIR>/sources/` —
 *
 *   catalog.json            registered versions (ids + hash + provenance + title), the knowledge
 *                           commons, consent envelopes, the redaction set, and creations
 *   bytes/<content_hash>.bin canonical bytes, content-addressed (dedupes across versions)
 *
 * The catalog is written atomically (tmp + rename) so a crash mid-write can never leave a
 * half-catalog; a corrupt or missing catalog loads as `null` (the hub starts empty — honest
 * degradation, never a boot failure). Redacted versions keep their *identity* in the catalog
 * (so the content route still answers 410 Gone after a deploy — ADR-0054) while their bytes are
 * deleted at redaction time: the withholding itself is durable.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ConsentEnvelope, Creation } from "@inevitable/source-environment";
import type { CommonsEntry } from "./sources";

/** One registered version, exactly as needed to replay `registerVersion` under its original ids. */
export interface PersistedSourceVersion {
  readonly source_id: string;
  readonly version_id: string;
  readonly modality: string;
  readonly title: string;
  readonly content_hash: string;
  readonly content_ref: string;
  readonly provenance: {
    readonly origin: "upload" | "web" | "api" | "recording" | "fixture" | "creation";
    readonly attributed_source: string;
    readonly license_class: string | null;
    readonly consent_ref: string | null;
  };
}

/** The whole durable source plane in one read model (ADR-0055 D1). */
export interface SourcePlaneSnapshot {
  readonly versions: readonly PersistedSourceVersion[];
  readonly commons: readonly CommonsEntry[];
  readonly consents: readonly ConsentEnvelope[];
  readonly redacted: readonly string[];
  readonly creations: readonly Creation[];
}

export class SourcePlanePersistence {
  private readonly root: string;
  private readonly bytesDir: string;
  private readonly catalogPath: string;

  constructor(persistDir: string) {
    this.root = join(persistDir, "sources");
    this.bytesDir = join(this.root, "bytes");
    this.catalogPath = join(this.root, "catalog.json");
    mkdirSync(this.bytesDir, { recursive: true });
  }

  /** Load the persisted plane. Corrupt/missing catalog → null (start empty), never a throw. */
  load(): SourcePlaneSnapshot | null {
    try {
      if (!existsSync(this.catalogPath)) return null;
      const parsed = JSON.parse(readFileSync(this.catalogPath, "utf8")) as SourcePlaneSnapshot;
      if (!Array.isArray(parsed.versions)) return null;
      return {
        versions: parsed.versions,
        commons: Array.isArray(parsed.commons) ? parsed.commons : [],
        consents: Array.isArray(parsed.consents) ? parsed.consents : [],
        redacted: Array.isArray(parsed.redacted) ? parsed.redacted : [],
        creations: Array.isArray(parsed.creations) ? parsed.creations : [],
      };
    } catch {
      return null;
    }
  }

  /** Atomic catalog write: tmp + rename — a crash can never leave a half-written catalog. */
  saveCatalog(snapshot: SourcePlaneSnapshot): void {
    const tmp = `${this.catalogPath}.tmp`;
    writeFileSync(tmp, JSON.stringify(snapshot), "utf8");
    renameSync(tmp, this.catalogPath);
  }

  /** Persist canonical bytes, content-addressed (idempotent: an existing hash is already right). */
  saveBytes(contentHash: string, bytes: Uint8Array): void {
    const path = join(this.bytesDir, `${contentHash}.bin`);
    if (!existsSync(path)) writeFileSync(path, bytes);
  }

  /** Canonical bytes for a hash, or null when absent (e.g. deleted by a durable redaction). */
  readBytes(contentHash: string): Uint8Array | null {
    try {
      const path = join(this.bytesDir, `${contentHash}.bin`);
      return existsSync(path) ? new Uint8Array(readFileSync(path)) : null;
    } catch {
      return null;
    }
  }

  /** Delete bytes for a hash — the durable half of a redaction's withholding (ADR-0054/0055). */
  deleteBytes(contentHash: string): void {
    try {
      rmSync(join(this.bytesDir, `${contentHash}.bin`), { force: true });
    } catch {
      /* best-effort: an unremovable file degrades to in-memory withholding only */
    }
  }
}
