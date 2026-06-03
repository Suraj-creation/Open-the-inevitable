/**
 * Backend-agnostic conformance harness. Every adapter — in-memory, NATS, Postgres, Neo4j, Qdrant —
 * must pass the same suite for its contract. These functions throw on the first violated invariant,
 * so a test simply awaits them. ADR-0005 §2; spec/interop/infrastructure-adapters.md.
 */
import { type Hlc, ManualClock, SeededIdGenerator, hlcInit } from "@inevitable/shared";
import { createEvent } from "@inevitable/events";
import type { CognitiveEvent } from "@inevitable/protocols";
import type { EventTransport, VectorStore } from "@inevitable/contracts";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`conformance failure: ${message}`);
}

export async function runEventTransportConformance(make: () => EventTransport): Promise<void> {
  const transport = make();
  const clock = new ManualClock(1000);
  const idGenerator = new SeededIdGenerator("conf");
  let hlc: Hlc = hlcInit("conf");
  const mk = (eventType: string): CognitiveEvent => {
    const created = createEvent(
      { eventType, producerCid: "cog-000000000001", producerType: "test", payload: {} },
      { clock, hlc, idGenerator },
    );
    hlc = created.hlc;
    return created.event;
  };

  const received: string[] = [];
  const subscription = await transport.subscribe("learn.>", (event) => {
    received.push(event.event_id);
  });

  const subject = "learn.session";
  const e1 = mk("learn.session.started");
  const e2 = mk("learn.session.progress");
  const e3 = mk("learn.session.ended");
  const sequences: number[] = [];
  for (const event of [e1, e2, e3]) {
    const result = await transport.publish(subject, event);
    assert(result.ok, "publish must succeed");
    if (result.ok) sequences.push(result.value.sequence);
  }
  assert(
    JSON.stringify(sequences) === JSON.stringify([0, 1, 2]),
    "per-subject sequence must increment from 0",
  );
  assert(received.length === 3, `subscriber must receive all 3 events (got ${received.length})`);
  assert(
    received[0] === e1.event_id && received[2] === e3.event_id,
    "delivery must preserve publish order",
  );

  const replayed: string[] = [];
  for await (const event of transport.replay(subject, 0)) replayed.push(event.event_id);
  assert(replayed.length === 3, "replay from 0 must yield all 3");
  assert(
    replayed[0] === e1.event_id && replayed[2] === e3.event_id,
    "replay must be in ascending sequence",
  );

  const partial: string[] = [];
  for await (const event of transport.replay(subject, 1)) partial.push(event.event_id);
  assert(
    partial.length === 2 && partial[0] === e2.event_id,
    "replay from N must skip earlier sequences",
  );

  subscription.unsubscribe();
  await transport.publish(subject, mk("learn.session.after-unsub"));
  assert(received.length === 3, "no delivery after unsubscribe");
}

export async function runVectorStoreConformance(make: () => VectorStore): Promise<void> {
  const store = make();
  const collection = "concepts";
  await store.upsert(collection, "a", [1, 0, 0], { title: "A" });
  await store.upsert(collection, "b", [0, 1, 0], { title: "B" });

  const near = await store.search(collection, [0.9, 0.1, 0], 2);
  assert(near.length === 2, "search returns up to the limit");
  assert(near[0]?.id === "a", "the closest vector must rank first");

  await store.delete(collection, "a");
  const after = await store.search(collection, [0.9, 0.1, 0], 2);
  assert(
    after.every((hit) => hit.id !== "a"),
    "a deleted id must not be returned",
  );
}
