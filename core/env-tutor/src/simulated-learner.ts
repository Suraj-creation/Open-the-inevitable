import type { DurableChannel, OutboxEntry } from "./channel.js";
import { type LearnerParams, reply } from "./learner.js";
import { LEARNER_LABELS, type ReplySink } from "./tutor-env.js";

/**
 * The learner as part of the world, not of any host: it reads what was delivered to it (the
 * channel's durable outbox) and answers in its own time, through admission. A host can die between
 * a question and its answer; the learner neither notices nor forgets. Each delivery is answered at
 * most once (and admission keys make a restarted learner's repeats harmless).
 */
export class SimulatedLearner {
  private readonly answered = new Set<string>();

  constructor(
    private readonly channel: DurableChannel,
    private readonly params: LearnerParams,
    private readonly admit: ReplySink,
  ) {}

  /** Deliveries not yet answered, oldest first (optionally for one process). */
  pending(processId?: string): OutboxEntry[] {
    return this.channel
      .outbox(processId)
      .filter((e) => !this.answered.has(`${e.processId}/${e.effectId}`));
  }

  /** Answer pending deliveries (all of them, or those `which` selects); returns how many replies were sent. */
  async answer(which?: (entry: OutboxEntry) => boolean): Promise<number> {
    let sent = 0;
    const all = this.channel.outbox();
    for (const [i, entry] of all.entries()) {
      const id = `${entry.processId}/${entry.effectId}`;
      if (this.answered.has(id) || (which && !which(entry))) continue;
      // What the learner knew when this arrived: everything delivered to it before.
      const history = all.slice(0, i).filter((e) => e.processId === entry.processId);
      const text = reply(this.params, history, entry);
      this.answered.add(id);
      if (text === undefined) continue;
      await this.admit({
        processId: entry.processId,
        key: `reply:${entry.effectId}`,
        from: "learner",
        content: text,
        inReplyTo: entry.effectId,
        labels: LEARNER_LABELS,
      });
      sent++;
    }
    return sent;
  }
}
