/**
 * Out-of-band media for the surface (Phase 2D-S4, ADR-0007).
 *
 * Audio bytes never travel on the SSE event stream or enter world-state. The choreographer's
 * narration segments carry only a reference (`content_ref`) + duration; the bytes live here, served
 * by the gateway media route. Two backends: in-memory (the default) and a durable file store
 * (ADR-0008) so audio resolves after a process restart, keyed by `artifact_id`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { VoiceRuntime } from "@inevitable/adapters";
import type { VoiceSynthesizer } from "@inevitable/surface";

export interface StoredMedia {
  readonly bytes: Uint8Array;
  readonly mimeType: string;
}

/** A media store keyed by artifact id (globally unique via the seeded segment id). */
export interface MediaStore {
  put(artifactId: string, media: StoredMedia): void;
  get(artifactId: string): StoredMedia | undefined;
}

/** In-memory media store — the default; lost on restart. */
export class InMemoryMediaStore implements MediaStore {
  private readonly items = new Map<string, StoredMedia>();

  put(artifactId: string, media: StoredMedia): void {
    this.items.set(artifactId, media);
  }

  get(artifactId: string): StoredMedia | undefined {
    return this.items.get(artifactId);
  }
}

/**
 * Durable file media store (ADR-0008): bytes in `<dir>/<artifactId>`, mime type in a `.mime` sidecar.
 * Pure `node:fs`, synchronous (the media route is low-frequency), so audio survives a restart.
 */
export class FileMediaStore implements MediaStore {
  constructor(private readonly dir: string) {
    mkdirSync(dir, { recursive: true });
  }

  private path(artifactId: string): string {
    // artifact ids are slug-safe (`art-voice-<segmentId>`); used directly as a filename.
    return join(this.dir, artifactId);
  }

  put(artifactId: string, media: StoredMedia): void {
    writeFileSync(this.path(artifactId), Buffer.from(media.bytes));
    writeFileSync(`${this.path(artifactId)}.mime`, media.mimeType, "utf8");
  }

  get(artifactId: string): StoredMedia | undefined {
    const file = this.path(artifactId);
    if (!existsSync(file)) return undefined;
    const bytes = new Uint8Array(readFileSync(file));
    const mimeFile = `${file}.mime`;
    const mimeType = existsSync(mimeFile)
      ? readFileSync(mimeFile, "utf8")
      : "application/octet-stream";
    return { bytes, mimeType };
  }
}

/**
 * Bridge a `VoiceRuntime` (adapter) to the surface's `VoiceSynthesizer` (choreography seam): on each
 * narration segment, synthesize audio, stash the bytes in the store, and return the reference the
 * fold records. Synthesis failure degrades to text-only narration (returns null) — never a crash.
 */
export function createVoiceSynthesizer(runtime: VoiceRuntime, store: MediaStore): VoiceSynthesizer {
  return {
    async synthesize(request) {
      const result = await runtime.synthesize({ text: request.text });
      if (!result.ok) return null;
      const artifactId = `art-voice-${request.segment_id}`;
      store.put(artifactId, { bytes: result.value.bytes, mimeType: result.value.mimeType });
      return {
        artifact_id: artifactId,
        content_ref: `/api/surface/${request.surface_id}/media/${artifactId}`,
        duration_ms: result.value.durationMs,
        provider_id: runtime.provider,
      };
    },
  };
}
