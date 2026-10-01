import type { OutboxEntry } from "./channel.js";
import { findItem, key, misconceptionAnswer } from "./items.js";

/**
 * A deterministic learner fixture. Its state is a pure function of everything delivered to it (the
 * channel outbox), so it survives any crash of the process exactly as a real learner would: it
 * remembers what it was told, not what the tutor thinks it was told.
 *
 * Parameter: `misconception` — the learner starts out adding denominators. An explanation that
 * teaches finding a common denominator remediates it.
 */
export interface LearnerParams {
  readonly misconception: boolean;
}

export function misconceptionActive(
  params: LearnerParams,
  history: readonly OutboxEntry[],
): boolean {
  if (!params.misconception) return false;
  return !history.some(
    (e) => e.action === "explain" && /common denominator/i.test(e.params["content"] ?? ""),
  );
}

/** The learner's reply to a delivery, given everything delivered before it; undefined if no reply. */
export function reply(
  params: LearnerParams,
  history: readonly OutboxEntry[],
  entry: OutboxEntry,
): string | undefined {
  const active = misconceptionActive(params, history);
  if (entry.action === "practice" || entry.action === "assess") {
    const item = findItem(
      entry.action === "assess" ? (entry.probeItemId ?? "") : (entry.params["item_id"] ?? ""),
    );
    if (!item) return "I don't understand the question.";
    const [n, d] = active ? misconceptionAnswer(item) : key(item);
    return `I think it's ${n}/${d}.`;
  }
  if (entry.action === "ask_person") {
    const q = entry.params["content"] ?? "";
    // "Why" questions get no immediate reply: the learner thinks it over, so the question stays open.
    if (/\bwhy\b/i.test(q)) return undefined;
    if (/fraction strips?/i.test(q)) return "No, I've never used fraction strips.";
    if (/multiplication|times tables?/i.test(q)) return "Yes, I know my times tables up to 10.";
    if (/denominator/i.test(q))
      return active
        ? "I add the tops and add the bottoms."
        : "You make the bottoms the same first.";
    return "I'm not sure.";
  }
  return undefined;
}
