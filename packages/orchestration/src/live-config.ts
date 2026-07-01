/**
 * LiveEvolutionConfig — the mutable live-config slice that a rolled-out evolution proposal writes
 * to and ModelBackedUnit reads from (P5.2, DPS-010 §5). When an evolution rollout is committed,
 * the composition root calls `apply(proposal.configuration)` to shift the active depth bias and
 * preferred strategy; rollback calls `revert()` to undo. ModelBackedUnit reads `depthBias` via
 * an injected `getDepthBias` callback (no package-level dependency from product-cognition →
 * orchestration), keeping the dependency direction correct.
 */
import type { ProposalConfiguration } from "./evolution";

export class LiveEvolutionConfig {
  /** Accumulated depth bias in layer units (positive = deeper explanations requested). */
  depthBias = 0;
  /** The preferred explanation strategy when set by a strategy_shift proposal. */
  preferredStrategy: string | null = null;
  /**
   * Look-ahead budget (UCS, ADR-0030; Phase 3): how many discardable speculative frames the surface
   * may pre-compose ahead of the learner. 0 = off (deterministic, no speculation). Raised only by a
   * rolled-out evolution proposal carrying a numeric `lookaheadBudget` parameter, so speculation cost
   * is a governed decision, never a hardcoded default. The gateway seeds a base budget of 1.
   */
  lookaheadBudget = 0;
  /** Prior look-ahead budget, restored on revert (the parameter is a set, not a delta). */
  private priorLookaheadBudget: number | null = null;

  /** Apply a rolled-out proposal's configuration to the live config. */
  apply(config: ProposalConfiguration): void {
    if (typeof config.targetDepthDelta === "number") this.depthBias += config.targetDepthDelta;
    const strat = config.parameters["strategy"];
    if (typeof strat === "string") this.preferredStrategy = strat;
    const budget = config.parameters["lookaheadBudget"];
    if (typeof budget === "number" && Number.isFinite(budget)) {
      this.priorLookaheadBudget = this.lookaheadBudget;
      this.lookaheadBudget = Math.max(0, Math.floor(budget));
    }
  }

  /** Revert a rolled-back proposal's configuration. */
  revert(config: ProposalConfiguration): void {
    if (typeof config.targetDepthDelta === "number") this.depthBias -= config.targetDepthDelta;
    const strat = config.parameters["strategy"];
    if (typeof strat === "string" && this.preferredStrategy === strat) {
      this.preferredStrategy = null;
    }
    const budget = config.parameters["lookaheadBudget"];
    if (typeof budget === "number" && this.priorLookaheadBudget !== null) {
      this.lookaheadBudget = this.priorLookaheadBudget;
      this.priorLookaheadBudget = null;
    }
  }
}
