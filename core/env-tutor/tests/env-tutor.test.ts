import { appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DurableChannel,
  key,
  misconceptionAnswer,
  PRACTICE,
  PROBES,
  TutorEnvironment,
} from "../src/index.js";

const dirs: string[] = [];
const temp = () => {
  const d = mkdtempSync(join(tmpdir(), "uci-tutor-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("verifier audit (the measured error the verifier claims)", () => {
  // 20 labelled answers: every item's correct key, misconception answers, equivalent unreduced forms,
  // and unparseable noise. The verifier must make zero errors against these labels.
  const env = new TutorEnvironment(temp());
  const labelled: {
    item: string;
    answer: string;
    expected: "held" | "failed" | "indeterminate";
  }[] = [
    ...[...PRACTICE, ...PROBES].map((i) => ({
      item: i.itemId,
      answer: `I think it's ${key(i).join("/")}.`,
      expected: "held" as const,
    })),
    ...PRACTICE.slice(0, 4).map((i) => ({
      item: i.itemId,
      answer: `${misconceptionAnswer(i).join("/")}`,
      expected: "failed" as const,
    })),
    { item: "i-1", answer: "10/12", expected: "held" },
    { item: "p-1", answer: "14 / 20", expected: "held" },
    { item: "i-2", answer: "no idea", expected: "indeterminate" },
    { item: "p-2", answer: "", expected: "indeterminate" },
    { item: "p-3", answer: "2/8", expected: "failed" },
  ];

  it("has 20 labelled cases and makes zero errors on them", () => {
    expect(labelled).toHaveLength(20);
    const errors = labelled.filter((l) => env.verify(l.item, l.answer).outcome !== l.expected);
    expect(errors).toEqual([]);
  });

  it("identifies itself and is never visible to the actor", () => {
    const v = env.verify("i-1", "5/6");
    expect(v.verifier.actorVisible).toBe(false);
    expect(v.verifier.id).toBe("env-tutor.answer-key");
  });
});

describe("durable channel", () => {
  it("ignores a torn final line and records duplicates instead of hiding them", () => {
    const dir = temp();
    const ch = new DurableChannel(dir);
    const entry = {
      processId: "P1",
      effectId: "X1-a1",
      idempotencyKey: "action:step-1",
      action: "explain",
      params: {},
    };
    ch.deliver(entry);
    ch.deliver(entry);
    // Another process's identical effect id is a different delivery.
    ch.deliver({ ...entry, processId: "P2" });
    appendFileSync(join(dir, "outbox.jsonl"), '{"effectId":"X2-a1","idempo');
    expect(ch.outbox()).toHaveLength(3);
    expect(ch.outbox("P1")).toHaveLength(2);
    expect(ch.deliveryCounts().get("P1/X1-a1")).toBe(2);
    expect(ch.deliveryCounts().get("P2/X1-a1")).toBe(1);
  });
});

describe("environment behaviour", () => {
  it("selects probes itself, never repeating one, and reconciles from its own outbox", async () => {
    const env = new TutorEnvironment(temp(), { misconception: false });
    const a = await env.perform({
      processId: "P1",
      effectId: "X1-a1",
      idempotencyKey: "k1",
      action: "assess",
      params: {},
    });
    const b = await env.perform({
      processId: "P1",
      effectId: "X2-a1",
      idempotencyKey: "k2",
      action: "assess",
      params: {},
    });
    expect(a.probeItemId).toBe("p-1");
    expect(b.probeItemId).toBe("p-2");
    expect(a.observation).not.toContain("p-1");
    expect(await env.reconcile("P1", "X2-a1")).toEqual({
      finding: "delivered",
      detail: "probe:p-2",
      observation: "Delivered the next held-out assessment probe to the learner.",
    });
    expect(await env.reconcile("P1", "X9-a1")).toEqual({ finding: "not_delivered" });
    // Effect ids are unique within a process only: another process never sees P1's delivery.
    expect(await env.reconcile("P2", "X2-a1")).toEqual({ finding: "not_delivered" });
  });

  it("the learner's misconception persists until a common-denominator explanation, as a function of the outbox", async () => {
    const replies: string[][] = [];
    const env = new TutorEnvironment(temp(), { misconception: true }, undefined, async (r) => {
      replies.push([r.processId, r.key, r.inReplyTo ?? "", r.content, r.labels.join(",")]);
    });
    await env.perform({
      processId: "P1",
      effectId: "X1-a1",
      idempotencyKey: "k1",
      action: "practice",
      params: { item_id: "i-1" },
    });
    await env.perform({
      processId: "P1",
      effectId: "X2-a1",
      idempotencyKey: "k2",
      action: "explain",
      params: { content: "Use a common denominator first." },
    });
    await env.perform({
      processId: "P1",
      effectId: "X3-a1",
      idempotencyKey: "k3",
      action: "practice",
      params: { item_id: "i-1" },
    });
    expect(replies).toEqual([
      ["P1", "reply:X1-a1", "X1-a1", "I think it's 2/5.", "consent:learning,source:learner"],
      ["P1", "reply:X3-a1", "X3-a1", "I think it's 5/6.", "consent:learning,source:learner"],
    ]);
  });

  it("acceptance needs three consecutive held probes", () => {
    const env = new TutorEnvironment(temp());
    expect(env.acceptanceMet(["held", "held"])).toBe(false);
    expect(env.acceptanceMet(["held", "failed", "held", "held"])).toBe(false);
    expect(env.acceptanceMet(["failed", "held", "held", "held"])).toBe(true);
  });
});
