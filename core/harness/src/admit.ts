import {
  type AuthorityGranted,
  type CausalRecord,
  type CausalStore,
  type Clock,
  evidenceHash,
  INBOX_PREFIX,
} from "@uci/kernel";
import { processStream } from "./writer.js";

/**
 * Admission is separate from execution (LCM §31): an input enters the process's durable inbox,
 * idempotent by key, and is delivered at the process's next step boundary. Admission is authority:
 * the process's envelope names who may submit, and a person's input must carry consent. A refusal
 * is a durable record, never a silent drop; refused content is not stored.
 */
export const inboxStream = (processId: string): string => `${INBOX_PREFIX}${processId}`;

export interface InputSubmission {
  readonly processId: string;
  /** Client idempotency key: the same key is the same submission (a retried send is admitted once). */
  readonly key: string;
  readonly from: "learner" | "person" | "environment";
  /** Who submits, as named in the process's envelope `admits`. */
  readonly principal: string;
  readonly content: string;
  /** The effect this input answers, if any. */
  readonly inReplyTo?: string;
  /** Consent and provenance labels the content carries (a person's input needs a `consent:` label). */
  readonly labels: readonly string[];
}

export interface AdmissionResult {
  /** The input id the process will see (`I<inbox seq>`), when admitted. */
  readonly inputId?: string;
  /** Why the submission was refused, when it was. */
  readonly refused?: string;
  /** The key had already been submitted: this is the original outcome. */
  readonly duplicate: boolean;
}

export interface InputAdmitted {
  readonly from: InputSubmission["from"];
  readonly principal: string;
  readonly evidenceHash: string;
  readonly inReplyTo?: string;
}

export interface InputRefused {
  readonly from: InputSubmission["from"];
  readonly principal: string;
  readonly reason: string;
}

/** The admission policy of an envelope (authority.granted@2); v1 processes predate it and admit all. */
export function admissionRefusal(
  authority: AuthorityGranted | undefined,
  s: Pick<InputSubmission, "from" | "principal" | "labels">,
): string | undefined {
  const admits = authority?.envelope.admits;
  if (!admits) return undefined;
  const role = s.from === "environment" ? "environment" : "person";
  if (!admits.some((a) => a.principal === s.principal && a.role === role))
    return `principal ${s.principal} is not admitted as ${role}`;
  if (role === "person" && !s.labels.some((l) => l.startsWith("consent:")))
    return "a person's input needs a consent label";
  return undefined;
}

export async function admitInput(
  store: CausalStore,
  clock: Clock,
  s: InputSubmission,
): Promise<AdmissionResult> {
  const process = await store.read(processStream(s.processId), 1);
  const head = process[0];
  if (!head) throw new Error(`process ${s.processId} does not exist`);
  const authority = process.findLast((r) => r.kind === "authority.granted") as
    | CausalRecord<AuthorityGranted>
    | undefined;
  const meta = { processId: s.processId, entityId: head.entityId };
  const refusal = admissionRefusal(authority?.data, s);
  const stream = inboxStream(s.processId);
  const at = clock.now();
  if (refusal) {
    const r = await store.admit({
      stream,
      meta,
      at,
      key: s.key,
      draft: {
        kind: "input.refused",
        v: 1,
        data: { from: s.from, principal: s.principal, reason: refusal } satisfies InputRefused,
      },
    });
    return outcome(r.record, r.duplicate);
  }
  const labels = [...s.labels];
  const r = await store.admit({
    stream,
    meta,
    at,
    key: s.key,
    draft: {
      kind: "input.admitted",
      v: 1,
      labels,
      data: {
        from: s.from,
        principal: s.principal,
        evidenceHash: evidenceHash("text/plain", s.content),
        ...(s.inReplyTo ? { inReplyTo: s.inReplyTo } : {}),
      } satisfies InputAdmitted,
    },
    evidence: [{ mediaType: "text/plain", content: s.content, labels }],
  });
  return outcome(r.record, r.duplicate);
}

function outcome(record: CausalRecord, duplicate: boolean): AdmissionResult {
  return record.kind === "input.refused"
    ? { refused: (record.data as InputRefused).reason, duplicate }
    : { inputId: `I${record.seq}`, duplicate };
}
