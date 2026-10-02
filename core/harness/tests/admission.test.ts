import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SqliteCausalStore } from "@uci/adapters";
import { type Envelope, evidenceHash, ManualClock } from "@uci/kernel";
import { admitInput, inboxStream, PROCESS_KINDS, processStream } from "../src/index.js";

/**
 * Admission is authority (S2 criterion 5; journal criteria-20261002-cf81): only principals the
 * envelope names may submit, a person's input needs consent, a refusal is a durable record, refused
 * content is never stored, and the same key is the same admission.
 */
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

async function processWith(envelope: Envelope, v: 1 | 2) {
  const dir = mkdtempSync(join(tmpdir(), "uci-admission-"));
  dirs.push(dir);
  const store = await SqliteCausalStore.open(join(dir, "uci.sqlite"), { registry: PROCESS_KINDS });
  const clock = new ManualClock();
  try {
    await store.claim(processStream("P1"), "o", clock.now(), { processId: "P1", entityId: "L1" }, [
      { kind: "authority.granted", v, data: { envelope, grantedBy: "owner" } },
    ]);
  } catch (e) {
    await store.close();
    throw e;
  }
  return { store, clock };
}

const ENVELOPE: Envelope = {
  actions: ["explain"],
  effectClasses: ["model-call", "external-communication"],
  modelCallBudget: 10,
  admits: [
    { principal: "L1", role: "person" },
    { principal: "grader", role: "environment" },
  ],
};
const consent = ["consent:learning", "source:learner"];

describe("admission", () => {
  it("admits a listed person with consent, and refuses everyone else durably", async () => {
    const { store, clock } = await processWith(ENVELOPE, 2);
    const submit = (key: string, principal: string, labels: string[], from = "learner" as const) =>
      admitInput(store, clock, {
        processId: "P1",
        key,
        from,
        principal,
        content: `from ${principal}`,
        labels,
      });

    expect(await submit("a", "L1", consent)).toEqual({ inputId: "I1", duplicate: false });
    expect(await submit("b", "intruder", consent)).toEqual({
      refused: "principal intruder is not admitted as person",
      duplicate: false,
    });
    expect(await submit("c", "L1", ["source:learner"])).toEqual({
      refused: "a person's input needs a consent label",
      duplicate: false,
    });
    expect(await submit("d", "L1", consent, "environment" as never)).toEqual({
      refused: "principal L1 is not admitted as environment",
      duplicate: false,
    });
    // An environment principal needs no consent label.
    expect(
      await admitInput(store, clock, {
        processId: "P1",
        key: "e",
        from: "environment",
        principal: "grader",
        content: "graded",
        labels: ["source:grader"],
      }),
    ).toEqual({ inputId: "I5", duplicate: false });

    const inbox = await store.read(inboxStream("P1"));
    expect(inbox.map((r) => r.kind)).toEqual([
      "input.admitted",
      "input.refused",
      "input.refused",
      "input.refused",
      "input.admitted",
    ]);
    expect(inbox[0]?.labels).toEqual(consent);
    // Refused content is never stored; admitted content is, under the process's entity.
    expect(
      await store.getEvidence("L1", evidenceHash("text/plain", "from intruder")),
    ).toBeUndefined();
    expect((await store.getEvidence("L1", evidenceHash("text/plain", "from L1")))?.content).toBe(
      "from L1",
    );
    await store.close();
  });

  it("the same key is the same admission, refusals included", async () => {
    const { store, clock } = await processWith(ENVELOPE, 2);
    const submit = (key: string, principal: string) =>
      admitInput(store, clock, {
        processId: "P1",
        key,
        from: "learner",
        principal,
        content: "hi",
        labels: consent,
      });
    const first = await submit("k1", "L1");
    expect(await submit("k1", "L1")).toEqual({ inputId: first.inputId, duplicate: true });
    const refused = await submit("k2", "intruder");
    expect(await submit("k2", "intruder")).toEqual({ refused: refused.refused, duplicate: true });
    expect(await store.read(inboxStream("P1"))).toHaveLength(2);
    await store.close();
  });

  it("a v1 envelope predates admission policy and admits as S1 did", async () => {
    const { admits: _admits, ...v1 } = ENVELOPE;
    const { store, clock } = await processWith(v1, 1);
    expect(
      await admitInput(store, clock, {
        processId: "P1",
        key: "k",
        from: "learner",
        principal: "anyone",
        content: "hi",
        labels: [],
      }),
    ).toEqual({ inputId: "I1", duplicate: false });
    await store.close();
  });

  it("refuses an admission policy hidden in a v1 envelope (no silent widening)", async () => {
    await expect(processWith(ENVELOPE, 1)).rejects.toThrow(/admits needs authority.granted@2/);
  });
});
