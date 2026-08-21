/**
 * PostgresPolicyStore conformance (migration 0005, spec 11 / ADR-0066) — the durable per-learner
 * Adaptive Policy. Hermetic: a fake pool switches on the exact POLICY_SQL statements (no driver, no
 * network), proving the save → load round-trip and latest-version upsert semantics.
 */
import { describe, expect, it } from "vitest";
import { POLICY_SQL, PostgresPolicyStore, type PgPoolLike, type PolicyRow } from "../src/index";

/** A fake pool: an in-memory table keyed by ref, switching on the exact POLICY_SQL statements. */
class FakePool implements PgPoolLike {
  private readonly rows = new Map<string, Record<string, unknown>>();
  query(sql: string, params: unknown[] = []): Promise<{ rows: unknown[] }> {
    if (sql === POLICY_SQL.upsert) {
      const ref = String(params[1]);
      this.rows.set(ref, {
        ref,
        agent_id: params[2],
        learner_cid: params[3],
        constitution_id: params[4],
        version: params[5],
        strategy_weights: JSON.parse(String(params[6])) as Record<string, number>,
        derived_from_proposal: params[7],
        parent_version: params[8],
      });
      return Promise.resolve({ rows: [] });
    }
    if (sql === POLICY_SQL.byRef) {
      const row = this.rows.get(String(params[1]));
      return Promise.resolve({ rows: row ? [row] : [] });
    }
    return Promise.resolve({ rows: [] });
  }
}

const SEED: PolicyRow = {
  ref: "cog://policy/agent.explanation/cog-l",
  agent_id: "agent.explanation",
  learner_cid: "cog-l",
  constitution_id: "constitution:agent.explanation",
  version: 1,
  strategy_weights: { "concrete-first": 1, "abstract-first": 1, "visual-first": 1 },
  derived_from_proposal: null,
  parent_version: null,
};

describe("PostgresPolicyStore — durable Adaptive Policy (L1.5)", () => {
  it("round-trips a policy row through save → load", async () => {
    const store = PostgresPolicyStore.fromPool(new FakePool());
    await store.save(SEED);
    const loaded = await store.load(SEED.ref);
    expect(loaded).toEqual(SEED);
  });

  it("upserts the latest version (adaptation persists in place, keyed by ref)", async () => {
    const store = PostgresPolicyStore.fromPool(new FakePool());
    await store.save(SEED);
    const v2: PolicyRow = {
      ...SEED,
      version: 2,
      strategy_weights: { "concrete-first": 0.52, "abstract-first": 1, "visual-first": 1 },
      derived_from_proposal: "prop-abc",
      parent_version: 1,
    };
    await store.save(v2);
    const loaded = await store.load(SEED.ref);
    expect(loaded?.version).toBe(2);
    expect(loaded?.strategy_weights["concrete-first"]).toBe(0.52);
    expect(loaded?.parent_version).toBe(1);
    expect(loaded?.derived_from_proposal).toBe("prop-abc");
  });

  it("returns null for an unknown ref", async () => {
    const store = PostgresPolicyStore.fromPool(new FakePool());
    expect(await store.load("cog://policy/agent.explanation/nobody")).toBeNull();
  });
});
