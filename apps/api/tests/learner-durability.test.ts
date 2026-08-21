/**
 * Durable learner identity through the REAL gateway (ADR-0034 + migration 0004, DPS-003/DPS-004).
 *
 * The question this file answers is the one the 2026-08 audit said the system could not answer:
 * *can it remember something today and retrieve it correctly tomorrow?* "Tomorrow" is simulated by
 * throwing away the whole process-local tier — a brand-new `SurfaceHost` with a fresh persist
 * directory, exactly what a redeploy produces — and keeping only the durable store.
 *
 * The store is a scripted in-memory fake satisfying `DurableLearnerStore`, so the suite stays
 * hermetic (no driver, no network). `PostgresLearnerStore` is proven against the same shape in
 * `packages/adapters/tests/learner-store.test.ts`.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PostgresLearnerStore } from "@inevitable/adapters";
import { SurfaceHost } from "../src/host";
import { LearnerRegistry, type DurableLearnerStore } from "../src/learners";

type DurableCognition = Awaited<ReturnType<DurableLearnerStore["readCognition"]>>;
type DurableNode = DurableCognition["nodes"][number];
type DurableEdge = DurableCognition["edges"][number];

/** A durable tier that survives the process — the whole point of the test. */
class FakeDurableStore implements DurableLearnerStore {
  private readonly learners = new Map<string, Parameters<DurableLearnerStore["upsert"]>[0]>();
  private readonly surfaceRows: Array<{ learnerId: string; surface_id: string; goal: string }> = [];
  private readonly nodes = new Map<string, DurableNode>();
  private readonly edges = new Map<string, DurableEdge>();
  private readonly muts = new Map<string, Record<string, unknown>>();
  /** Counts writes so the test can prove the durable tier was actually exercised. */
  writes = 0;

  async upsert(row: Parameters<DurableLearnerStore["upsert"]>[0]): Promise<void> {
    this.writes++;
    this.learners.set(row.learner_id, row);
  }
  async get(learnerId: string) {
    return this.learners.get(learnerId) ?? null;
  }
  async getByApiKey(apiKey: string) {
    return [...this.learners.values()].find((l) => l.api_key === apiKey) ?? null;
  }
  async recordSurface(learnerId: string, surface_id: string, goal: string): Promise<void> {
    this.writes++;
    if (!this.surfaceRows.some((s) => s.learnerId === learnerId && s.surface_id === surface_id)) {
      this.surfaceRows.push({ learnerId, surface_id, goal });
    }
  }
  async surfaces(learnerId: string) {
    return this.surfaceRows
      .filter((s) => s.learnerId === learnerId)
      .map((s) => ({ surface_id: s.surface_id, goal: s.goal, created_at: "2026-08-16T00:00:00Z" }));
  }
  async mergeCognition(
    learnerId: string,
    learnerCid: string,
    seed: Parameters<DurableLearnerStore["mergeCognition"]>[2],
  ): Promise<void> {
    this.writes++;
    for (const n of seed.nodes) this.nodes.set(`${learnerId}:${n.id}`, n);
    for (const e of seed.edges) this.edges.set(`${learnerId}:${e.id}`, { ...e });
    for (const m of seed.mutations) {
      const id = String((m as Record<string, unknown>)["mutation_id"] ?? "");
      if (id && !this.muts.has(`${learnerCid}:${id}`)) this.muts.set(`${learnerCid}:${id}`, m);
    }
  }
  async readCognition(learnerId: string, learnerCid: string): Promise<DurableCognition> {
    const own = (k: string) => k.startsWith(`${learnerId}:`);
    return {
      nodes: [...this.nodes.entries()].filter(([k]) => own(k)).map(([, v]) => v),
      edges: [...this.edges.entries()].filter(([k]) => own(k)).map(([, v]) => v),
      mutations: [...this.muts.entries()]
        .filter(([k]) => k.startsWith(`${learnerCid}:`))
        .map(([, v]) => v),
    };
  }
}

const hosts: SurfaceHost[] = [];
function newHost(store: DurableLearnerStore): SurfaceHost {
  // A FRESH persist dir per host: the local tier of a redeployed instance is always empty.
  const host = new SurfaceHost({
    persistDir: mkdtempSync(join(tmpdir(), "cos-durability-")),
    learnerStore: store,
  });
  hosts.push(host);
  return host;
}

afterEach(() => {
  hosts.length = 0;
});

describe("durable learner identity survives a redeploy (the /tmp lockout regression)", () => {
  it("recognises a returning learner by api_key after the local tier is wiped", async () => {
    const store = new FakeDurableStore();

    // ── Day 1: a learner arrives and is minted.
    const day1 = newHost(store);
    const created = await day1.create("Teach me entropy", {});
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const minted = await day1.getLearner(created.value.learnerId);
    expect(minted).toBeDefined();
    const apiKey = minted!.apiKey;
    expect(store.writes).toBeGreaterThan(0); // the durable tier was actually written

    // ── Redeploy. New process, new empty disk. Only the durable store survives.
    const day2 = newHost(store);

    // THIS is what returned 401 in production: the key index is empty on a cold boot, so a
    // key-only match has to reach the durable tier or the learner is a stranger to their account.
    const returning = await day2.getLearnerByApiKey(apiKey);
    expect(returning).toBeDefined();
    expect(returning!.learnerId).toBe(created.value.learnerId);
    expect(returning!.cid).toBe(minted!.cid);
    expect(returning!.trustLevel).toBe(minted!.trustLevel);
  });

  it("resolveOrCreate reuses the durable identity instead of minting a stranger", async () => {
    const store = new FakeDurableStore();
    const day1 = newHost(store);
    const created = await day1.create("Teach me entropy", {});
    if (!created.ok) return;
    const before = await day1.getLearner(created.value.learnerId);

    const day2 = newHost(store);
    const resumed = await day2.create("Teach me free energy", {
      learnerId: created.value.learnerId,
    });
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    // Same learner, same cognitive identity — not a fresh mint.
    expect(resumed.value.learnerId).toBe(created.value.learnerId);
    expect((await day2.getLearner(resumed.value.learnerId))!.cid).toBe(before!.cid);
  });

  it("carries the learner's surfaces across the restart (resume-by-learner)", async () => {
    const store = new FakeDurableStore();
    const day1 = newHost(store);
    const created = await day1.create("Teach me entropy", {});
    if (!created.ok) return;

    const day2 = newHost(store);
    const learner = await day2.getLearner(created.value.learnerId);
    expect(learner!.surfaces.map((s) => s.surfaceId)).toContain(created.value.surfaceId);
    expect(learner!.surfaces[0]!.goal).toBe("Teach me entropy");
  });

  it("without a durable store the learner is LOST on restart — the bug, pinned", async () => {
    // Guards the regression from the other side: this is exactly the old behaviour, and it must
    // remain observably different from the durable path above.
    const day1 = new SurfaceHost({ persistDir: mkdtempSync(join(tmpdir(), "cos-ephemeral-")) });
    const created = await day1.create("Teach me entropy", {});
    if (!created.ok) return;
    const apiKey = (await day1.getLearner(created.value.learnerId))!.apiKey;

    const day2 = new SurfaceHost({ persistDir: mkdtempSync(join(tmpdir(), "cos-ephemeral-")) });
    expect(await day2.getLearnerByApiKey(apiKey)).toBeUndefined();
    expect(await day2.getLearner(created.value.learnerId)).toBeUndefined();
  });
});

// ── LIVE proof against real Supabase Postgres (gated: COS_SUPABASE_LIVE=1 + SUPABASE_DB_URL). ──
// The runtime evidence the 2026-08 audit demanded: mint → record → *redeploy* → resolve-by-key →
// retrieve, against the actual database, through the production LearnerRegistry + PostgresLearnerStore.
// Self-cleaning: the learner and its rows are redacted in a finally block. Offline verify skips it.
const LIVE = process.env["COS_SUPABASE_LIVE"] === "1" && Boolean(process.env["SUPABASE_DB_URL"]);

describe.runIf(LIVE)("live durable learner over real Postgres (migration 0004)", () => {
  const url = process.env["SUPABASE_DB_URL"] ?? "";

  it(
    "survives a simulated redeploy: mint → redeploy → resolve-by-key → retrieve cognition",
    { timeout: 60000 },
    async () => {
      const store1 = await PostgresLearnerStore.connect({ connectionString: url });
      expect(store1.ok).toBe(true);
      if (!store1.ok) return;
      const store2 = await PostgresLearnerStore.connect({ connectionString: url });
      expect(store2.ok).toBe(true);
      if (!store2.ok) return;

      // Process 1: a learner arrives, gets a surface, and masters a concept.
      const reg1 = new LearnerRegistry({
        persistDir: mkdtempSync(join(tmpdir(), "cos-live1-")),
        store: store1.value,
      });
      const learner = await reg1.resolveOrCreate({ displayName: "Live Proof" });
      try {
        await reg1.recordSurface(learner.learnerId, {
          surfaceId: "srf-live-proof",
          goal: "Teach me entropy",
        });
        await reg1.mergeCognition(learner.learnerId, {
          worldNodes: [{ id: "concept:entropy", type: "concept", props: { title: "Entropy" } }],
          worldEdges: [],
          memoryMutations: [
            {
              mutation_id: "mut-live-proof-1",
              proposer_cid: learner.cid,
              memory_layer: "semantic",
              mutation_type: "add",
              target: { id: "concept:entropy" },
              payload: { note: "Boltzmann relation" },
              confidence: 0.9,
              hlc: "h-live-1",
            },
          ] as never,
        });
        expect(reg1.degraded).toBeNull(); // the durable writes actually succeeded

        // Process 2: redeploy — a FRESH empty local tier; only the durable store survives.
        const reg2 = new LearnerRegistry({
          persistDir: mkdtempSync(join(tmpdir(), "cos-live2-")),
          store: store2.value,
        });
        // The exact 401-lockout fix, proven live: a cold process resolves the returning learner.
        const returning = await reg2.getByApiKey(learner.apiKey);
        expect(returning?.learnerId).toBe(learner.learnerId);
        expect(returning?.cid).toBe(learner.cid);
        expect(returning?.surfaces.some((s) => s.surfaceId === "srf-live-proof")).toBe(true);

        // And their carried cognition comes back — understanding compounds across the redeploy.
        const cognition = await reg2.readCognition(learner.learnerId);
        expect(cognition?.worldNodes.some((n) => n.id === "concept:entropy")).toBe(true);
        expect(
          (cognition?.memoryMutations ?? []).some(
            (m) => (m as { mutation_id?: string }).mutation_id === "mut-live-proof-1",
          ),
        ).toBe(true);
      } finally {
        // Self-clean: redact the learner (identity) + its learner-scoped rows and the test mutation.
        await store1.value.redact(learner.learnerId).catch(() => {});
        await store1.value.close();
        await store2.value.close();
      }
    },
  );
});
