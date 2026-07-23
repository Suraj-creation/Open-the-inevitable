/**
 * foldSourceEvents — the replay path: reconstruct the SourceEnvironmentProjection purely from the
 * `source.*` event log. Replay never re-parses and never re-invokes an adapter (Source Law:
 * Replayable). The live store's `project()` and this fold must agree byte-deep — proven by the
 * replay test suite.
 */
import type { CognitiveEvent } from "@inevitable/protocols";
import { SOURCE_EVENT_TYPES } from "./events";
import type { SourceEnvironmentProjection } from "./store";

function payloadOf(event: CognitiveEvent): Record<string, unknown> {
  return (event.payload ?? {}) as Record<string, unknown>;
}

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const strOrNull = (v: unknown): string | null => (typeof v === "string" ? v : null);

export function foldSourceEvents(events: readonly CognitiveEvent[]): SourceEnvironmentProjection {
  const versions: Array<SourceEnvironmentProjection["versions"][number]> = [];
  const layers: Array<SourceEnvironmentProjection["layers"][number]> = [];
  const migrations: Array<SourceEnvironmentProjection["migrations"][number]> = [];

  for (const event of events) {
    if (!event.event_type.startsWith("source.")) continue;
    const payload = payloadOf(event);
    switch (event.event_type) {
      case SOURCE_EVENT_TYPES.versionRegistered: {
        versions.push({
          source_id: str(payload["source_id"]),
          version_id: str(payload["version_id"]),
          modality: str(payload["modality"]),
          content_hash: str(payload["content_hash"]),
          supersedes: strOrNull(payload["supersedes"]),
        });
        break;
      }
      case SOURCE_EVENT_TYPES.layerConstructed:
      case SOURCE_EVENT_TYPES.layerDegraded: {
        layers.push({
          version_id: str(payload["version_id"]),
          layer: str(payload["layer"]),
          artifact_id: str(payload["artifact_id"]),
          degraded: event.event_type === SOURCE_EVENT_TYPES.layerDegraded,
        });
        break;
      }
      case SOURCE_EVENT_TYPES.anchorMigrated: {
        migrations.push({
          anchor_id: str(payload["anchor_id"]),
          from_version: str(payload["from_version"]),
          to_version: str(payload["to_version"]),
          status: str(payload["status"]),
        });
        break;
      }
      default:
        break;
    }
  }
  return { versions, layers, migrations };
}
