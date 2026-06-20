/**
 * EvolutionEngine — governed self-evolution lifecycle.
 *
 * Spec: spec/evolution/DPS-010-governed-self-evolution.md, ADR-0021.
 *
 * Lifecycle: propose → evaluate (shadow tests) → approve (governance gate) → rollout | rollback.
 * Shadow testing is deterministic (no model calls). Governance injected as a callback.
 */
import { CosError, CryptoIdGenerator, SystemClock } from "@inevitable/shared";
import type { Clock, IdGenerator } from "@inevitable/shared";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ProposalKind = "depth_adjustment" | "strategy_shift" | "curriculum_reorder";

export type ProposalStatus = "proposed" | "evaluated" | "approved" | "rolled_out" | "rolled_back";

export interface ProposalConfiguration {
  readonly targetDepthDelta?: number;
  readonly parameters: Readonly<Record<string, unknown>>;
}

export interface SyntheticLearnerSeed {
  readonly learnerId: string;
  readonly masteryMap: Readonly<Record<string, { level: number; confidence: number }>>;
  readonly goals: ReadonlyArray<string>;
}

export interface ShadowResult {
  readonly learnerId: string;
  readonly simulatedPassRate: number;
  readonly confidenceDelta: number;
  readonly driftDetected: boolean;
}

export interface EvaluationResult {
  readonly proposalId: string;
  readonly evaluatedAt: number;
  readonly shadowResults: ReadonlyArray<ShadowResult>;
  readonly overallPassRate: number;
  readonly recommendation: "approve" | "reject";
}

export interface EvolutionProposal {
  readonly proposalId: string;
  readonly kind: ProposalKind;
  readonly description: string;
  readonly configuration: ProposalConfiguration;
  readonly syntheticLearners: ReadonlyArray<SyntheticLearnerSeed>;
  readonly createdAt: number;
  readonly status: ProposalStatus;
  readonly evaluationResult?: EvaluationResult;
  readonly approvedAt?: number;
  readonly rolledOutAt?: number;
  readonly rolledBackAt?: number;
}

export interface ProposeParams {
  readonly kind: ProposalKind;
  readonly description: string;
  readonly configuration: ProposalConfiguration;
  readonly syntheticLearners: ReadonlyArray<SyntheticLearnerSeed>;
}

export interface EvolutionEngineOptions {
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
  readonly publish?: (eventType: string, payload: Record<string, unknown>) => void;
  readonly guard?: (action: string) => boolean;
}

// ---------------------------------------------------------------------------
// Internal mutable record
// ---------------------------------------------------------------------------

type MutableProposalRecord = {
  proposalId: string;
  kind: ProposalKind;
  description: string;
  configuration: ProposalConfiguration;
  syntheticLearners: ReadonlyArray<SyntheticLearnerSeed>;
  createdAt: number;
  status: ProposalStatus;
  evaluationResult?: EvaluationResult;
  approvedAt?: number;
  rolledOutAt?: number;
  rolledBackAt?: number;
};

function freeze(r: MutableProposalRecord): EvolutionProposal {
  return Object.freeze({ ...r }) as EvolutionProposal;
}

// ---------------------------------------------------------------------------
// Shadow evaluator — deterministic projection (ADR-0021 D2)
// ---------------------------------------------------------------------------

function simulateLearner(
  seed: SyntheticLearnerSeed,
  kind: ProposalKind,
  config: ProposalConfiguration,
): ShadowResult {
  const levels = Object.values(seed.masteryMap).map((m) => m.level);
  const basePassRate =
    levels.length > 0 ? Math.min(0.9, levels.reduce((a, b) => a + b, 0) / levels.length / 5) : 0.4;

  let passRate = basePassRate;
  let confidenceDelta = 0;

  if (kind === "depth_adjustment") {
    const delta = typeof config.targetDepthDelta === "number" ? config.targetDepthDelta : 0;
    passRate = Math.min(0.95, basePassRate + delta * 0.05);
    confidenceDelta = delta * 0.03;
  } else if (kind === "strategy_shift") {
    passRate = Math.min(0.95, basePassRate + 0.1);
    confidenceDelta = 0.05;
  } else {
    passRate = Math.min(0.95, basePassRate + 0.05);
    confidenceDelta = 0.02;
  }

  return {
    learnerId: seed.learnerId,
    simulatedPassRate: Math.max(0, passRate),
    confidenceDelta,
    driftDetected: passRate < 0.4,
  };
}

// ---------------------------------------------------------------------------
// EvolutionEngine
// ---------------------------------------------------------------------------

export class EvolutionEngine {
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;
  private readonly publish: (eventType: string, payload: Record<string, unknown>) => void;
  private readonly guard: (action: string) => boolean;
  private readonly proposals = new Map<string, MutableProposalRecord>();

  constructor(opts: EvolutionEngineOptions = {}) {
    this.clock = opts.clock ?? new SystemClock();
    this.idGenerator = opts.idGenerator ?? new CryptoIdGenerator();
    this.publish = opts.publish ?? (() => undefined);
    this.guard = opts.guard ?? (() => true);
  }

  propose(params: ProposeParams): EvolutionProposal {
    const proposalId = `evol-${this.idGenerator.hex(12)}`;
    const record: MutableProposalRecord = {
      proposalId,
      kind: params.kind,
      description: params.description,
      configuration: params.configuration,
      syntheticLearners: params.syntheticLearners,
      createdAt: this.clock.nowMs(),
      status: "proposed",
    };
    this.proposals.set(proposalId, record);
    this.publish("evolution.proposal.created", {
      proposal_id: proposalId,
      kind: params.kind,
      description: params.description,
      status: "proposed",
    });
    return freeze(record);
  }

  evaluate(proposalId: string): EvaluationResult {
    const record = this.requireProposal(proposalId);
    if (record.status !== "proposed") {
      throw new CosError(
        "E_EVOLUTION_INVALID_TRANSITION",
        `proposal "${proposalId}" is "${record.status}", expected "proposed"`,
      );
    }
    this.publish("evolution.experiment.started", {
      proposal_id: proposalId,
      synthetic_learner_count: record.syntheticLearners.length,
    });
    const shadowResults = record.syntheticLearners.map((seed) =>
      simulateLearner(seed, record.kind, record.configuration),
    );
    for (const result of shadowResults) {
      this.publish("evolution.shadow_result.recorded", {
        proposal_id: proposalId,
        learner_id: result.learnerId,
        simulated_pass_rate: result.simulatedPassRate,
        confidence_delta: result.confidenceDelta,
        drift_detected: result.driftDetected,
      });
    }
    const overallPassRate =
      shadowResults.length > 0
        ? shadowResults.reduce((sum, r) => sum + r.simulatedPassRate, 0) / shadowResults.length
        : 0;
    const recommendation = overallPassRate >= 0.6 ? "approve" : "reject";
    const evaluationResult: EvaluationResult = {
      proposalId,
      evaluatedAt: this.clock.nowMs(),
      shadowResults,
      overallPassRate,
      recommendation,
    };
    record.status = "evaluated";
    record.evaluationResult = evaluationResult;
    return evaluationResult;
  }

  approve(proposalId: string): EvolutionProposal {
    const record = this.requireProposal(proposalId);
    if (record.status !== "evaluated") {
      throw new CosError(
        "E_EVOLUTION_INVALID_TRANSITION",
        `proposal "${proposalId}" is "${record.status}", expected "evaluated"`,
      );
    }
    if (record.evaluationResult?.recommendation !== "approve") {
      throw new CosError(
        "E_EVOLUTION_REJECT_RECOMMENDATION",
        `proposal "${proposalId}" evaluation recommends rejection`,
      );
    }
    if (!this.guard("evolution.approve")) {
      throw new CosError(
        "E_GOVERNANCE_BLOCKED",
        `evolution approve blocked by governance for proposal "${proposalId}"`,
      );
    }
    record.status = "approved";
    record.approvedAt = this.clock.nowMs();
    return freeze(record);
  }

  rollout(proposalId: string): EvolutionProposal {
    const record = this.requireProposal(proposalId);
    if (record.status !== "approved") {
      throw new CosError(
        "E_EVOLUTION_INVALID_TRANSITION",
        `proposal "${proposalId}" is "${record.status}", expected "approved"`,
      );
    }
    record.status = "rolled_out";
    record.rolledOutAt = this.clock.nowMs();
    this.publish("evolution.rollout.completed", {
      proposal_id: proposalId,
      status: "rolled_out",
    });
    return freeze(record);
  }

  rollback(proposalId: string): EvolutionProposal {
    const record = this.requireProposal(proposalId);
    if (record.status === "rolled_back") {
      return freeze(record);
    }
    if (record.status !== "approved" && record.status !== "rolled_out") {
      throw new CosError(
        "E_EVOLUTION_INVALID_TRANSITION",
        `proposal "${proposalId}" cannot be rolled back from "${record.status}"`,
      );
    }
    record.status = "rolled_back";
    record.rolledBackAt = this.clock.nowMs();
    this.publish("evolution.rollback.completed", {
      proposal_id: proposalId,
      status: "rolled_back",
    });
    return freeze(record);
  }

  get(proposalId: string): EvolutionProposal | undefined {
    const record = this.proposals.get(proposalId);
    return record ? freeze(record) : undefined;
  }

  list(): readonly EvolutionProposal[] {
    return [...this.proposals.values()].map(freeze);
  }

  private requireProposal(proposalId: string): MutableProposalRecord {
    const record = this.proposals.get(proposalId);
    if (!record) {
      throw new CosError("E_EVOLUTION_NOT_FOUND", `evolution proposal "${proposalId}" not found`);
    }
    return record;
  }
}
