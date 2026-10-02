import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PostgresCausalStore } from "@uci/adapters";
import { type PgServer, startPg } from "@uci/adapters/testing";
import { type ReplySink, SimulatedLearner, TutorEnvironment } from "@uci/env-tutor";
import {
  admitInput,
  type InputSubmission,
  PROCESS_KINDS,
  processStream,
  startProcess,
} from "@uci/harness";
import { type CausalRecord, systemClock } from "@uci/kernel";
import { DEFAULT_ENVELOPE, OBJECTIVE } from "../../src/index.js";
import { rederive } from "../../src/inspect.js";
import { cleanup, tempDir } from "./helpers.js";

/**
 * The S2 headline (journal criteria-20261002-cf81 item 8): twenty processes, each waiting on its own
 * learner, on Postgres, while a real host process is killed 25 times at seeded random moments. The
 * learner is part of the world: it answers from the durable outbox, some answers while the host is
 * down, and resubmits a fifth of them. Every process must reach verified mastery with no delivery
 * repeated, no projection diverging from a fresh fold and no resume-budget escalation.
 */
afterEach(cleanup);
const here = dirname(fileURLToPath(import.meta.url));
const PROCESSES = 20;
const KILLS = 25;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let server: PgServer | undefined;
beforeAll(async () => {
  server = await startPg("cli-headline");
}, 180_000);
afterAll(async () => {
  await server?.stop();
});

describe("durable waiting on Postgres, under host kills", () => {
  it(`${PROCESSES} processes survive ${KILLS} host kills and all reach verified mastery`, async () => {
    const url = await (server as PgServer).database("headline");
    const schema = "uci";
    const channelDir = join(tempDir(), "channel");
    mkdirSync(channelDir, { recursive: true });
    const store = await PostgresCausalStore.open({
      connectionString: url,
      schema,
      registry: PROCESS_KINDS,
      max: 4,
    });
    const clock = systemClock;
    const env = new TutorEnvironment(channelDir, { misconception: true });
    const ids = Array.from({ length: PROCESSES }, (_, i) => `P${i + 1}`);
    for (const [i, processId] of ids.entries())
      await startProcess({
        store,
        clock,
        processId,
        entityId: `L${i + 1}`,
        owner: "parent",
        envelope: { ...DEFAULT_ENVELOPE, admits: [{ principal: `L${i + 1}`, role: "person" }] },
        grantedBy: "owner",
        objective: OBJECTIVE,
        env,
      });

    // The world's learner: answers from the outbox, through admission, as each process's entity.
    const submitted: InputSubmission[] = [];
    const sink: ReplySink = async (reply) => {
      const s = { ...reply, principal: `L${reply.processId.slice(1)}` };
      submitted.push(s);
      return admitInput(store, clock, s);
    };
    const learner = new SimulatedLearner(env.channel, { misconception: true }, sink);
    const rand = prng(20261002);
    let answeredUp = 0;
    let answeredDown = 0;
    let duplicates = 0;
    const resubmitAFifth = async (from: number) => {
      for (const s of submitted.slice(from))
        if (rand() < 0.2) {
          const again = await admitInput(store, clock, s);
          expect(again.duplicate).toBe(true);
          duplicates++;
        }
    };

    const spawnHost = (): ChildProcess =>
      spawn(
        process.execPath,
        [
          "--disable-warning=ExperimentalWarning",
          "--import",
          "tsx",
          join(here, "fixtures", "host-child.ts"),
          url,
          schema,
          channelDir,
        ],
        { cwd: join(here, "..", ".."), stdio: ["ignore", "ignore", "ignore"] },
      );
    const kill = async (child: ChildProcess) => {
      if (child.exitCode !== null) return;
      const exited = new Promise((r) => child.once("exit", r));
      child.kill();
      await exited;
    };
    const concluded = async () =>
      (
        await Promise.all(
          ids.map(async (id) =>
            (await store.read(processStream(id))).some((r) => r.kind === "process.concluded"),
          ),
        )
      ).filter(Boolean).length;

    for (let k = 0; k < KILLS; k++) {
      const child = spawnHost();
      const until = Date.now() + 800 + Math.floor(rand() * 3200);
      while (Date.now() < until) {
        const from = submitted.length;
        // While the host is up the learner is slow to answer, so many answers arrive while it is down.
        answeredUp += await learner.answer(() => rand() < 0.1);
        await resubmitAFifth(from);
        await sleep(150);
      }
      await kill(child); // anywhere: booting, mid-step, mid-transaction, mid-effect
      const from = submitted.length;
      answeredDown += await learner.answer();
      await resubmitAFifth(from);
    }

    // A last host runs uninterrupted until every learner has reached mastery.
    const last = spawnHost();
    const deadline = Date.now() + 180_000;
    while ((await concluded()) < PROCESSES && Date.now() < deadline) {
      answeredUp += await learner.answer();
      await sleep(200);
    }
    await kill(last);

    const verdicts: string[] = [];
    for (const id of ids) {
      const records: CausalRecord[] = await store.read(processStream(id));
      const outcome = records.find((r) => r.kind === "process.concluded")?.data as
        | { outcome: string }
        | undefined;
      if (outcome?.outcome !== "mastery-verified") verdicts.push(`${id}: not concluded`);
      if (records.some((r) => r.kind === "process.escalated")) verdicts.push(`${id}: escalated`);
      const tokens = records
        .filter((r) => r.kind === "lease.claimed")
        .map((r) => (r.data as { token: number }).token);
      if (!tokens.every((t, i) => i === 0 || t > (tokens[i - 1] ?? 0)))
        verdicts.push(`${id}: fence tokens not increasing`);
      if (!records.every((r, i) => r.seq === i + 1)) verdicts.push(`${id}: seq gap`);
      const { mismatches } = await rederive(store, records);
      if (mismatches.length) verdicts.push(`${id}: ${mismatches.length} derivability mismatches`);
    }
    const repeated = [...env.channel.deliveryCounts()].filter(([, n]) => n > 1);
    console.log(
      "HEADLINE",
      JSON.stringify({
        concluded: await concluded(),
        kills: KILLS,
        answeredUp,
        answeredDown,
        duplicatesResubmitted: duplicates,
        deliveries: env.channel.outbox().length,
        repeatedDeliveries: repeated.length,
      }),
    );
    expect(verdicts).toEqual([]);
    expect(repeated).toEqual([]);
    expect(answeredDown / (answeredDown + answeredUp)).toBeGreaterThanOrEqual(0.3);
    expect(duplicates).toBeGreaterThan(0);
    await store.close();
  }, 900_000);
});
