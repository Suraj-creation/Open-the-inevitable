/**
 * Policy primitives. Governance is a kernel primitive applied at every decision boundary
 * (spec/kernel/governance-kernel.md). A {@link Policy} inspects a {@link PolicyRequest} and
 * yields a {@link PolicyOutcome}; the engine composes policies into a {@link GovernanceDecision}.
 */
import type { GovernanceDecision } from "@inevitable/protocols";

export type Decision = GovernanceDecision["decision"]; // "allow" | "block" | "modify" | "review"

export type PolicyType =
  | "access"
  | "tool"
  | "data"
  | "evidence"
  | "learning"
  | "cost"
  | "evolution"
  | "safety"
  | "security";

export interface PolicyRequest {
  readonly subjectCid: string;
  readonly resource: string;
  readonly action: string;
  readonly context?: Record<string, unknown>;
  readonly payload?: Record<string, unknown>;
  readonly classification?: string;
}

export interface PolicyOutcome {
  readonly decision: Decision;
  readonly reason: string;
  readonly modifiedPayload?: Record<string, unknown>;
  readonly evidence?: string[];
  readonly reviewPath?: string;
}

export interface Policy {
  readonly id: string;
  readonly version: string;
  readonly type: PolicyType;
  /** Lower priority numbers are evaluated first. */
  readonly priority: number;
  appliesTo(request: PolicyRequest): boolean;
  evaluate(request: PolicyRequest): PolicyOutcome;
}

export { type GovernanceDecision };
