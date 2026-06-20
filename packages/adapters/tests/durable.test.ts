/**
 * FileEventTransport — the pure-Node durable backend (ADR-0008). It must honor the SAME EventTransport
 * contract as the in-memory reference (the conformance harness), survive a reopen, and persist events
 * with their original bus sequence so a reconstructed surface streams identically.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { ManualClock, SeededIdGenerator, hlcInit, type Hlc } from "@inevitable/shared";
import { createEvent } from "@inevitable/events";
import type { CognitiveEvent } from "@inevitable/protocols";
import { FileEventTransport, runEventTransportConformance } from "../src/index";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "cos-durable-"));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("FileEventTransport (pure node:fs durable backend)", () => {
  test("passes the EventTransport conformance harness", async () => {
    let n = 0;
    await runEventTransportConformance(
      () => new FileEventTransport(join(dir, `conf-${n++}.jsonl`)),
    );
  });

  test("persists across a reopen and preserves the original event sequence", async () => {
    const path = join(dir, "reopen.jsonl");
    const clock = new ManualClock(1000);
    const idGenerator = new SeededIdGenerator("durable");
    let hlc: Hlc = hlcInit("durable");
    const mk = (eventType: string): CognitiveEvent => {
      const created = createEvent(
        { eventType, producerCid: "cog-000000000001", producerType: "test", payload: {} },
        { clock, hlc, idGenerator },
      );
      hlc = created.hlc;
      // Stamp a bus-style sequence to prove it survives the round trip unchanged.
      return { ...created.event, sequence: 41 };
    };

    const writer = new FileEventTransport(path);
    const e1 = mk("surface.block.generated");
    await writer.publish(e1.event_type, e1);

    // A fresh transport over the same file (a new "process") sees the persisted event.
    const reader = new FileEventTransport(path);
    const replayed: CognitiveEvent[] = [];
    for await (const event of reader.replay(">", 0)) replayed.push(event);
    expect(replayed).toHaveLength(1);
    expect(replayed[0]?.event_id).toBe(e1.event_id);
    expect(replayed[0]?.sequence).toBe(41); // original bus sequence preserved

    // Appending after reopen continues the per-subject sequence (no clobber of the first line).
    const e2 = mk("surface.block.generated");
    await reader.publish(e2.event_type, e2);
    expect(reader.readAll()).toHaveLength(2);
  });

  test("the catch-all subject matches every event", async () => {
    const path = join(dir, "wildcard.jsonl");
    const t = new FileEventTransport(path);
    const clock = new ManualClock(1000);
    const idGenerator = new SeededIdGenerator("wild");
    let hlc: Hlc = hlcInit("wild");
    const mk = (eventType: string): CognitiveEvent => {
      const created = createEvent(
        { eventType, producerCid: "cog-000000000001", producerType: "test", payload: {} },
        { clock, hlc, idGenerator },
      );
      hlc = created.hlc;
      return created.event;
    };
    await t.publish("surface.created", mk("surface.created"));
    await t.publish("model.output.recorded", mk("model.output.recorded"));
    await t.publish("mastery.checkpoint.recorded", mk("mastery.checkpoint.recorded"));
    const all: CognitiveEvent[] = [];
    for await (const event of t.replay(">", 0)) all.push(event);
    expect(all).toHaveLength(3);
  });
});
