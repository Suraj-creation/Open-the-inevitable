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
import { DurableChannel } from "./channel.js";
import { findItem, key, parseFraction, PRACTICE, PROBES, prompt } from "./items.js";
import { type LearnerParams, reply } from "./learner.js";

export const ACCEPTANCE_STREAK = 3;

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
    const item = request.params["item_id"] ? findItem(request.params["item_id"]) : undefined;
    const observation =
      request.action === "practice" && item
        ? `Delivered practice item ${item.itemId} (${prompt(item)}) to the learner.`
        : request.action === "assess"
          ? "Delivered the next held-out assessment probe to the learner."
          : request.action === "explain"
            ? "Delivered the explanation to the learner."
            : "Delivered the question to the learner.";
    return { delivery: "accepted", observation, ...(probeItemId ? { probeItemId } : {}) };
  }

  async reconcile(effectId: string): Promise<{ finding: ReconcileFinding; detail?: string }> {
    const entry = this.channel.outbox().find((e) => e.effectId === effectId);
    if (!entry) return { finding: "not_delivered" };
    return entry.probeItemId
      ? { finding: "delivered", detail: `probe:${entry.probeItemId}` }
      : { finding: "delivered" };
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
    const last = probeOutcomes.slice(-ACCEPTANCE_STREAK);
    return last.length === ACCEPTANCE_STREAK && last.every((o) => o === "held");
  }

  verifierPrivate(): readonly string[] {
    return [...PRACTICE, ...PROBES].map((i) => key(i).join("/"));
  }

  /** Test and battery seam: the learner sends a message unprompted (e.g. a correction). */
  learnerSays(content: string): ChannelInput {
    return this.channel.receive({ from: "learner", content });
  }
}
