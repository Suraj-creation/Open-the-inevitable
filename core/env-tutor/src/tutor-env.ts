import type {
  ActionSpec,
  ChannelInput,
  EnvironmentPack,
  PerformRequest,
  PerformResult,
  PracticeItem,
  Verification,
} from "@uci/harness";
import type { ReconcileFinding } from "@uci/kernel";
import { DurableChannel, type OutboxEntry } from "./channel.js";
import { findItem, key, parseFraction, PRACTICE, PROBES, prompt } from "./items.js";
import { type LearnerParams, reply } from "./learner.js";

export const ACCEPTANCE_STREAK = 3;

/** The environment's observation of a delivery; identical whether reported live or by reconciliation. */
function describe(entry: OutboxEntry): string {
  const item = entry.params["item_id"] ? findItem(entry.params["item_id"]) : undefined;
  if (entry.action === "practice" && item)
    return `Delivered practice item ${item.itemId} (${prompt(item)}) to the learner.`;
  if (entry.action === "assess")
    return "Delivered the next held-out assessment probe to the learner.";
  if (entry.action === "explain") return "Delivered the explanation to the learner.";
  return "Delivered the question to the learner.";
}

export const VERIFIER = {
  id: "env-tutor.answer-key",
  version: "1",
  measuredError:
    "0 errors on a 20-answer labelled audit set (env-tutor verifier audit test); exact-match on keyed items",
  actorVisible: false,
} as const;

/**
 * The tutoring environment pack. It owns the item bank, the private keys, probe selection, the
 * verifier, and a durable channel to the learner that lives outside the process.
 */
export class TutorEnvironment implements EnvironmentPack {
  readonly id = "env-tutor";
  readonly version = "1";
  readonly actions: readonly ActionSpec[] = [
    { name: "explain", params: ["content"], description: "Send the learner an explanation." },
    {
      name: "practice",
      params: ["item_id"],
      description: "Give the learner one practice item by id.",
    },
    {
      name: "assess",
      params: [],
      description:
        "The environment gives the learner its next held-out assessment probe; you will not see which item.",
    },
    { name: "ask_person", params: ["content"], description: "Ask the learner a question." },
  ];
  readonly channel: DurableChannel;

  constructor(
    channelDir: string,
    private readonly learner: LearnerParams = { misconception: true },
    /** Consecutive held probes required for acceptance. */
    private readonly acceptanceStreak: number = ACCEPTANCE_STREAK,
  ) {
    this.channel = new DurableChannel(channelDir);
  }

  practiceItems(): readonly PracticeItem[] {
    return PRACTICE.map((i) => ({ itemId: i.itemId, prompt: prompt(i) }));
  }

  async perform(request: PerformRequest): Promise<PerformResult> {
    const history = this.channel.outbox();
    let probeItemId: string | undefined;
    if (request.action === "assess") {
      const used = new Set(history.map((e) => e.probeItemId).filter(Boolean));
      probeItemId = (
        PROBES.find((p) => !used.has(p.itemId)) ?? PROBES[history.length % PROBES.length]
      )?.itemId;
    }
    const entry = {
      effectId: request.effectId,
      idempotencyKey: request.idempotencyKey,
      action: request.action,
      params: request.params,
      ...(probeItemId ? { probeItemId } : {}),
    };
    this.channel.deliver(entry);
    const answer = reply(this.learner, history, entry);
    if (answer !== undefined)
      this.channel.receive({ from: "learner", content: answer, inReplyTo: request.effectId });
    return {
      delivery: "accepted",
      observation: describe(entry),
      ...(probeItemId ? { probeItemId } : {}),
    };
  }

  /** What the channel knows about an effect: whether it was delivered and, if so, what was delivered. */
  async reconcile(
    effectId: string,
  ): Promise<{ finding: ReconcileFinding; detail?: string; observation?: string }> {
    const entry = this.channel.outbox().find((e) => e.effectId === effectId);
    if (!entry) return { finding: "not_delivered" };
    return {
      finding: "delivered",
      observation: describe(entry),
      ...(entry.probeItemId ? { detail: `probe:${entry.probeItemId}` } : {}),
    };
  }

  async inbox(): Promise<readonly ChannelInput[]> {
    return this.channel.inbox();
  }

  verify(itemId: string, answer: string): Verification {
    const item = findItem(itemId);
    const given = parseFraction(answer);
    if (!item || !given)
      return { outcome: "indeterminate", method: "answer-key", verifier: VERIFIER };
    const [n, d] = key(item);
    return {
      outcome: given[0] === n && given[1] === d ? "held" : "failed",
      method: "answer-key",
      verifier: VERIFIER,
    };
  }

  acceptanceMet(probeOutcomes: readonly ("held" | "failed" | "indeterminate")[]): boolean {
    const last = probeOutcomes.slice(-this.acceptanceStreak);
    return last.length === this.acceptanceStreak && last.every((o) => o === "held");
  }

  verifierPrivate(): readonly string[] {
    return [...PRACTICE, ...PROBES].map((i) => key(i).join("/"));
  }

  /** Test and battery seam: the learner sends a message unprompted (e.g. a correction). */
  learnerSays(content: string): ChannelInput {
    return this.channel.receive({ from: "learner", content });
  }
}
