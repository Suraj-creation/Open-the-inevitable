/**
 * B1 — Historical backfill (ADR-0035, CIP-002 §4): replay every durable surface chronicle under
 * COS_PERSIST_DIR through the distiller registry and land the artifacts in the Intelligence
 * Plane. The backfill IS the re-derivation drill run against real history: deterministic folds
 * over the recorded logs, no re-invocation of anything.
 *
 * Usage: from apps/api — `pnpm backfill:intelligence` (dry-run without COS_BACKEND=supabase;
 * durable upserts when the Postgres plane is configured).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { FileEventTransport } from "@inevitable/adapters";
import { distillSession } from "@inevitable/intelligence";
import { PostgresIntelligenceStore, type IntelligenceArtifactRow } from "@inevitable/adapters";
import { loadEnv, persistDir, supabaseBackendUrl } from "./env";
import { LearnerRegistry } from "./learners";

async function main(): Promise<void> {
  loadEnv();
  const dir = persistDir() ?? ".cos-data";
  const surfacesDir = join(dir, "surfaces");
  if (!existsSync(surfacesDir)) {
    console.log(`no durable surfaces under ${surfacesDir}; nothing to backfill`);
    return;
  }
  const dbUrl = supabaseBackendUrl();
  const store = dbUrl ? await PostgresIntelligenceStore.connect({ connectionString: dbUrl }) : null;
  if (dbUrl && store && !store.ok) {
    console.log("Postgres plane unreachable; running as dry-run");
  }
  const durable = store?.ok ? store.value : null;
  const learners = new LearnerRegistry({ persistDir: dir });

  let surfaces = 0;
  let totalArtifacts = 0;
  const byKind = new Map<string, number>();

  for (const surfaceId of readdirSync(surfacesDir)) {
    const surfaceDir = join(surfacesDir, surfaceId);
    const logPath = join(surfaceDir, "events.jsonl");
    if (!existsSync(logPath)) continue;
    const events = new FileEventTransport(logPath).readAll();
    if (events.length === 0) continue;
    const meta = existsSync(join(surfaceDir, "meta.json"))
      ? (JSON.parse(readFileSync(join(surfaceDir, "meta.json"), "utf8")) as {
          learnerId?: string;
        })
      : {};
    const learner = meta.learnerId ? await learners.get(meta.learnerId) : undefined;
    const learnerCid = learner?.cid ?? `cog-unknown-${meta.learnerId ?? surfaceId}`;

    const { artifacts, skipped } = distillSession({
      events,
      ctx: { learner_cid: learnerCid, tenant_id: "default", session_id: surfaceId },
    });
    surfaces++;
    totalArtifacts += artifacts.length;
    for (const artifact of artifacts) {
      byKind.set(artifact.kind, (byKind.get(artifact.kind) ?? 0) + 1);
      if (durable) await durable.upsert(artifact as unknown as IntelligenceArtifactRow);
    }
    console.log(
      `${surfaceId}: ${events.length} events → ${artifacts.length} artifacts` +
        (skipped.length ? ` (${skipped.length} skipped)` : ""),
    );
  }

  console.log(
    `\nbackfill ${durable ? "DURABLE (Postgres)" : "dry-run (no COS_BACKEND=supabase)"}: ` +
      `${surfaces} surfaces → ${totalArtifacts} artifacts`,
  );
  for (const [kind, count] of [...byKind.entries()].sort()) console.log(`  ${kind}: ${count}`);
  await durable?.close();
}

void main();
