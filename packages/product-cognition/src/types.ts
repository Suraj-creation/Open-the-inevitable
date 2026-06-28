import type {
  CapabilityEnvelope,
  CognitiveIdentity,
  ContextLease,
  IntentLease,
} from "@inevitable/protocols";

/**
 * Internal utility: unwrap a `Result`-like value or throw its error.
 * Used when a world-state or memory failure is a genuine kernel panic rather than a
 * recoverable product error (e.g. upsert on a fresh isolated graph cannot fail).
 * Not exported — callers that need typed failure should use the Result pattern directly.
 */
export function assertWorldStateOk(
  result: { ok: true; value: unknown } | { ok: false; error: Error },
): unknown {
  if (!result.ok) throw result.error;
  return result.value;
}

export type PersonaClass =
  | "child"
  | "student"
  | "educator"
  | "researcher"
  | "institution"
  | "lifelong-learner"
  | "open";

export type ProductMode = "student" | "educator" | "institution" | "researcher" | "open";

export interface OnboardingInput {
  readonly ownerUserId: string;
  readonly persona: PersonaClass;
  readonly mode: ProductMode;
  readonly goal: string;
  readonly tenantId?: string | null;
  readonly consentMemoryScopes?: readonly string[];
}

export interface OnboardingSession {
  readonly learnerIdentity: CognitiveIdentity;
  readonly capabilityEnvelope: CapabilityEnvelope;
  readonly contextLease: ContextLease;
  readonly intentLease: IntentLease;
  readonly learnerNodeId: string;
  readonly intentNodeId: string;
  readonly seedMemoryMutationId: string;
  /** The product mode this session operates under (S4.3). Absent ⇒ "student". */
  readonly mode?: ProductMode;
}
