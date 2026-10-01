import {
  arrayOf,
  type Check,
  defineKind,
  int,
  isRecord,
  oneOf,
  optStr,
  shape,
  str,
} from "@uci/kernel";

/** Harness records: the process's own execution facts. Cognitive content lives in substrate records. */

export interface ManifestItem {
  /** The id the model may cite: `objective:O1`, `decision:D3`, `claim:C2@v2`, `input:I1`, … */
  readonly ref: string;
  /** Seq of the record this item was compiled from, in the process stream. */
  readonly record: number;
  readonly role: string;
  readonly reason: string;
  readonly trust: "instruction" | "data";
}

export interface ManifestExclusion {
  readonly ref: string;
  readonly reason: string;
}

export interface ManifestRecorded {
  readonly step: number;
  readonly items: readonly ManifestItem[];
  readonly exclusions: readonly ManifestExclusion[];
  readonly rendererVersion: string;
  /** Hash of the full provider-neutral request: system, prompt, schema, model, temperature. */
  readonly requestHash: string;
  readonly faculty: string;
  readonly model: string;
  readonly mode: "bridge" | "floor-only";
  /** Whether lapsed validity was surfaced and enforced for this call. */
  readonly staleness: "gate" | "off";
  /** The world-clock instant the working state was compiled at (staleness and due times depend on it). */
  readonly compiledAt: string;
}

export interface InputDelivered {
  readonly inputId: string;
  readonly from: "learner" | "person" | "environment";
  readonly evidenceHash: string;
  readonly inReplyTo?: string;
}

export interface ProposalRejected {
  readonly step: number;
  readonly evidenceHash: string;
  readonly errors: readonly string[];
}

export interface StepCompleted {
  readonly step: number;
  readonly outcome: "completed" | "retry" | "failed";
  readonly detail?: string;
}

export interface ContinuityNotice {
  readonly resumeAttempt: number;
  readonly interruptedAtStep: number;
  readonly settled: readonly { readonly effectId: string; readonly outcome: string }[];
  readonly reconciled: readonly { readonly effectId: string; readonly finding: string }[];
  readonly faculty: string;
}

export interface ProcessConcluded {
  readonly outcome: "mastery-verified" | "escalated" | "abandoned";
  readonly evidence: readonly string[];
}

const manifestItem: Check = (v, p) =>
  isRecord(v)
    ? [
        ...str(v["ref"], `${p}.ref`),
        ...int(v["record"], `${p}.record`),
        ...str(v["role"], `${p}.role`),
        ...str(v["reason"], `${p}.reason`),
        ...oneOf("instruction", "data")(v["trust"], `${p}.trust`),
      ]
    : [`${p} must be an object`];
const exclusion: Check = (v, p) =>
  isRecord(v)
    ? [...str(v["ref"], `${p}.ref`), ...str(v["reason"], `${p}.reason`)]
    : [`${p} must be an object`];
const settledEntry: Check = (v, p) =>
  isRecord(v)
    ? [...str(v["effectId"], `${p}.effectId`), ...str(v["outcome"], `${p}.outcome`)]
    : [`${p} must be an object`];
const reconciledEntry: Check = (v, p) =>
  isRecord(v)
    ? [...str(v["effectId"], `${p}.effectId`), ...str(v["finding"], `${p}.finding`)]
    : [`${p} must be an object`];

export const HARNESS_KINDS = [
  defineKind(
    "manifest.recorded",
    1,
    shape({
      step: int,
      items: arrayOf(manifestItem),
      exclusions: arrayOf(exclusion),
      rendererVersion: str,
      requestHash: str,
      faculty: str,
      model: str,
      mode: oneOf("bridge", "floor-only"),
      staleness: oneOf("gate", "off"),
      compiledAt: str,
    }),
  ),
  defineKind(
    "input.delivered",
    1,
    shape({
      inputId: str,
      from: oneOf("learner", "person", "environment"),
      evidenceHash: str,
      inReplyTo: optStr,
    }),
  ),
  defineKind("proposal.rejected", 1, shape({ step: int, evidenceHash: str, errors: arrayOf(str) })),
  defineKind(
    "step.completed",
    1,
    shape({ step: int, outcome: oneOf("completed", "retry", "failed"), detail: optStr }),
  ),
  defineKind(
    "continuity.notice",
    1,
    shape({
      resumeAttempt: int,
      interruptedAtStep: int,
      settled: arrayOf(settledEntry),
      reconciled: arrayOf(reconciledEntry),
      faculty: str,
    }),
  ),
  defineKind(
    "process.concluded",
    1,
    shape({ outcome: oneOf("mastery-verified", "escalated", "abandoned"), evidence: arrayOf(str) }),
  ),
  defineKind("process.escalated", 1, shape({ reason: str, detail: optStr })),
];
