import { type Check, defineKind, int, isRecord, oneOf, optional, shape, str } from "./kinds.js";
import type { CausalRecord, Draft } from "./record.js";

/**
 * The effect ledger. An effect is recorded as intended before it is attempted, as started before its
 * body runs, and settled exactly once. A crash can therefore leave an effect intended-only (it never
 * ran) or started-only (it may or may not have happened). The second is never guessed: it settles as
 * `outcome_unknown` and must be reconciled against the world before any retry.
 *
 * Model calls are regenerable: an interrupted call is `abandoned` and simply attempted again (and
 * metered again). External effects are not: their unknowns go through reconciliation.
 */

export type EffectClass = "model-call" | "external-communication";
export type EffectOutcome =
  | "completed"
  | "failed"
  | "declined"
  | "not_started"
  | "outcome_unknown"
  | "abandoned";
export type Delivery = "not-sent" | "rejected" | "ambiguous" | "accepted";
export type ReconcileFinding = "delivered" | "not_delivered" | "unanswerable";

export interface EffectIntended {
  readonly effectId: string;
  readonly effectClass: EffectClass;
  readonly action: string;
  /** Stable across attempts of the same logical effect. */
  readonly idempotencyKey: string;
  readonly attempt: number;
  readonly payloadHash: string;
}

export interface Usage {
  readonly inTokens: number;
  readonly outTokens: number;
}

export interface EffectSettled {
  readonly effectId: string;
  readonly outcome: EffectOutcome;
  readonly delivery?: Delivery;
  readonly detail?: string;
  readonly usage?: Usage;
}

export interface EffectReconciled {
  readonly effectId: string;
  readonly finding: ReconcileFinding;
  readonly method: string;
  /** What the world reported, when the effect's own settlement could not record it. */
  readonly detail?: string;
}

const usage: Check = (v, p) =>
  isRecord(v)
    ? [...int(v["inTokens"], `${p}.inTokens`), ...int(v["outTokens"], `${p}.outTokens`)]
    : [`${p} must be an object`];

export const EFFECT_KINDS = [
  defineKind(
    "effect.intended",
    1,
    shape({
      effectId: str,
      effectClass: oneOf("model-call", "external-communication"),
      action: str,
      idempotencyKey: str,
      attempt: int,
      payloadHash: str,
    }),
  ),
  defineKind("effect.started", 1, shape({ effectId: str })),
  defineKind(
    "effect.settled",
    1,
    shape({
      effectId: str,
      outcome: oneOf(
        "completed",
        "failed",
        "declined",
        "not_started",
        "outcome_unknown",
        "abandoned",
      ),
      delivery: optional(oneOf("not-sent", "rejected", "ambiguous", "accepted")),
      detail: optional(str),
      usage: optional(usage),
    }),
  ),
  defineKind(
    "effect.reconciled",
    1,
    shape({
      effectId: str,
      finding: oneOf("delivered", "not_delivered", "unanswerable"),
      method: str,
      detail: optional(str),
    }),
  ),
];

export interface EffectEntry {
  readonly intended: CausalRecord<EffectIntended>;
  started?: CausalRecord;
  settled?: CausalRecord<EffectSettled>;
  reconciled?: CausalRecord<EffectReconciled>;
}

export type Ledger = ReadonlyMap<string, EffectEntry>;

export function foldLedger(records: readonly CausalRecord[]): Ledger {
  const ledger = new Map<string, EffectEntry>();
  for (const r of records) {
    if (!r.kind.startsWith("effect.")) continue;
    const id = (r.data as { effectId: string }).effectId;
    if (r.kind === "effect.intended")
      ledger.set(id, { intended: r as CausalRecord<EffectIntended> });
    const entry = ledger.get(id);
    if (!entry) continue;
    if (r.kind === "effect.started") entry.started = r;
    if (r.kind === "effect.settled") entry.settled = r as CausalRecord<EffectSettled>;
    if (r.kind === "effect.reconciled") entry.reconciled = r as CausalRecord<EffectReconciled>;
  }
  return ledger;
}

/**
 * Settlement drafts for every effect a crash left unsettled. Intended-only never ran (`not_started`);
 * started-only may have happened: `abandoned` for a regenerable model call, `outcome_unknown` for an
 * external effect.
 */
export function orphanSettlements(ledger: Ledger): Draft<EffectSettled>[] {
  const drafts: Draft<EffectSettled>[] = [];
  for (const [effectId, e] of ledger) {
    if (e.settled) continue;
    const outcome: EffectOutcome = !e.started
      ? "not_started"
      : e.intended.data.effectClass === "model-call"
        ? "abandoned"
        : "outcome_unknown";
    drafts.push({
      kind: "effect.settled",
      v: 1,
      data: { effectId, outcome, detail: "settled by recovery sweep" },
    });
  }
  return drafts;
}

/** External effects whose outcome is unknown and not yet reconciled. Nothing may retry these. */
export function unreconciled(ledger: Ledger): EffectEntry[] {
  return [...ledger.values()].filter(
    (e) => e.settled?.data.outcome === "outcome_unknown" && !e.reconciled,
  );
}

export function modelUsage(ledger: Ledger): { calls: number; inTokens: number; outTokens: number } {
  let calls = 0;
  let inTokens = 0;
  let outTokens = 0;
  for (const e of ledger.values()) {
    if (e.intended.data.effectClass !== "model-call" || !e.settled) continue;
    if (e.settled.data.outcome === "not_started") continue;
    calls += 1;
    inTokens += e.settled.data.usage?.inTokens ?? 0;
    outTokens += e.settled.data.usage?.outTokens ?? 0;
  }
  return { calls, inTokens, outTokens };
}

/**
 * Ledger rules a writer must check against current state before appending an effect record. The
 * single fenced writer makes this check sound: no one else can append between check and commit.
 */
export function ledgerViolations(ledger: Ledger, draft: Draft): string[] {
  if (!draft.kind.startsWith("effect.")) return [];
  const data = draft.data as { effectId: string };
  const e = ledger.get(data.effectId);
  switch (draft.kind) {
    case "effect.intended": {
      if (e) return [`effect ${data.effectId} already intended`];
      const key = (draft.data as EffectIntended).idempotencyKey;
      const prior = [...ledger.values()].filter((x) => x.intended.data.idempotencyKey === key);
      for (const p of prior) {
        if (!p.settled)
          return [`effect ${p.intended.data.effectId} with key ${key} is still unsettled`];
        if (p.settled.data.outcome === "completed") return [`key ${key} already completed`];
        if (p.settled.data.outcome === "outcome_unknown" && !p.reconciled)
          return [
            `key ${key}: ${p.intended.data.effectId} is outcome_unknown and unreconciled; reconcile before retry`,
          ];
        if (p.reconciled?.data.finding === "delivered")
          return [`key ${key} was reconciled as delivered; never resend`];
      }
      return [];
    }
    case "effect.started":
      if (!e) return [`effect ${data.effectId} started without intent`];
      if (e.started || e.settled) return [`effect ${data.effectId} already started or settled`];
      return [];
    case "effect.settled":
      if (!e) return [`effect ${data.effectId} settled without intent`];
      if (e.settled) return [`effect ${data.effectId} already settled (settle exactly once)`];
      return [];
    case "effect.reconciled":
      if (!e?.settled || e.settled.data.outcome !== "outcome_unknown")
        return [`effect ${data.effectId} is not an unknown outcome`];
      if (e.reconciled) return [`effect ${data.effectId} already reconciled`];
      return [];
    default:
      return [];
  }
}
