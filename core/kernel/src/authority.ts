import type { EffectClass } from "./effects.js";
import { arrayOf, defineKind, int, isRecord, oneOf, shape, str, type Check } from "./kinds.js";

/**
 * Authority is structural: a process holds an explicit envelope, recorded as its first record, and
 * every effect passes governance before it runs. An absent or broken answer is a denial.
 */
/** Who may submit input to a process (admission is authority too: nothing is ambient). */
export interface Admission {
  readonly principal: string;
  readonly role: "person" | "environment";
}

export interface Envelope {
  readonly actions: readonly string[];
  readonly effectClasses: readonly EffectClass[];
  readonly modelCallBudget: number;
  /** Principals whose input is admitted (authority.granted@2). Absent in v1 envelopes. */
  readonly admits?: readonly Admission[];
}

export interface AuthorityGranted {
  readonly envelope: Envelope;
  readonly grantedBy: string;
}

export type GovernanceVerdict = "allow" | "deny";

export interface GovernanceDecided {
  readonly effectId: string;
  readonly action: string;
  readonly decision: GovernanceVerdict;
  readonly reason: string;
  readonly policyVersion: string;
}

const envelopeFields = (v: Record<string, unknown>, p: string): string[] => [
  ...arrayOf(str)(v["actions"], `${p}.actions`),
  ...arrayOf(oneOf("model-call", "external-communication"))(
    v["effectClasses"],
    `${p}.effectClasses`,
  ),
  ...int(v["modelCallBudget"], `${p}.modelCallBudget`),
];
const admission: Check = (v, p) =>
  isRecord(v)
    ? [
        ...str(v["principal"], `${p}.principal`),
        ...oneOf("person", "environment")(v["role"], `${p}.role`),
      ]
    : [`${p} must be an object`];
// v1 never carried an admission policy: a v1 record with one would be silently widened, so refuse it.
const envelopeV1: Check = (v, p) =>
  isRecord(v)
    ? [...envelopeFields(v, p), ...("admits" in v ? [`${p}.admits needs authority.granted@2`] : [])]
    : [`${p} must be an object`];
const envelopeV2: Check = (v, p) =>
  isRecord(v)
    ? [...envelopeFields(v, p), ...arrayOf(admission)(v["admits"], `${p}.admits`)]
    : [`${p} must be an object`];

export const AUTHORITY_KINDS = [
  defineKind("authority.granted", 1, shape({ envelope: envelopeV1, grantedBy: str })),
  defineKind("authority.granted", 2, shape({ envelope: envelopeV2, grantedBy: str })),
  defineKind(
    "governance.decided",
    1,
    shape({
      effectId: str,
      action: str,
      decision: oneOf("allow", "deny"),
      reason: str,
      policyVersion: str,
    }),
  ),
];

export const POLICY_VERSION = "envelope-policy@1";

export interface EffectRequest {
  readonly action: string;
  readonly effectClass: EffectClass;
}

/** The default policy: the action and effect class must be in the envelope, and the budget must hold. */
export function envelopePolicy(
  env: Envelope,
  modelCallsUsed: number,
  request: EffectRequest,
): { decision: GovernanceVerdict; reason: string } {
  if (!env.effectClasses.includes(request.effectClass))
    return {
      decision: "deny",
      reason: `effect class ${request.effectClass} is outside the envelope`,
    };
  if (request.effectClass === "external-communication" && !env.actions.includes(request.action))
    return { decision: "deny", reason: `action ${request.action} is outside the envelope` };
  if (request.effectClass === "model-call" && modelCallsUsed >= env.modelCallBudget)
    return {
      decision: "deny",
      reason: `model-call budget exhausted (${modelCallsUsed}/${env.modelCallBudget})`,
    };
  return { decision: "allow", reason: "within envelope" };
}

/** Runs a policy; a throw, or anything that is not a well-formed verdict, is a denial. */
export function govern(policy: () => { decision: GovernanceVerdict; reason: string }): {
  decision: GovernanceVerdict;
  reason: string;
} {
  try {
    const verdict = policy();
    if (verdict?.decision === "allow" || verdict?.decision === "deny") return verdict;
    return { decision: "deny", reason: "policy returned no verdict" };
  } catch (e) {
    return {
      decision: "deny",
      reason: `policy failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
