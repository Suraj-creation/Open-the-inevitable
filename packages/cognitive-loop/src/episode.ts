/**
 * runEpisode — ONE pass of the walking skeleton, threading every layer once (10 §11.0):
 *
 *   compile → execute → events → state(reflect) → policy proposal → governed acceptance
 *
 * Every step emits a typed Cognitive Event with a causal link, so the whole episode is replayable and
 * attributable (metric C). The `freezePolicy` flag applies exactly one change — whether an accepted
 * policy is persisted — giving the ablation baseline (metric D) an identical event structure and
 * isolating adaptation as the single variable.
 */
import { CosError } from "@inevitable/shared";
import type { IdGenerator } from "@inevitable/shared";
import { policyRef } from "./adaptive-policy";
import type { PolicyStore } from "./adaptive-policy";
import type { Constitution } from "./constitution";
import { type ContextCompiler } from "./context-compiler";
import type { CognitiveTask, CompiledContext, LearnerState } from "./context-compiler";
import { buildContextManifest } from "./context-manifest";
import { LOOP_EVENTS, type LoopEventEmitter } from "./events";
import type { CognitiveOutput, Faculty } from "./faculty";
import { type AdaptationGovernor } from "./governor";
import type { GovernanceDecision } from "./governor";
import { type LearnerSimulator } from "./learner-simulator";
import type { Assessment } from "./learner-simulator";
import { type Reflection } from "./reflection";
import type { PolicyProposal } from "./reflection";

const SPEC_REF = "spec/research/living-cognitive-agents/10-master-cognitive-architecture.md";

export interface EpisodeDeps {
  readonly compiler: ContextCompiler;
  readonly faculty: Faculty;
  readonly learnerSim: LearnerSimulator;
  readonly reflection: Reflection;
  readonly governor: AdaptationGovernor;
  readonly policies: PolicyStore;
  readonly emitter: LoopEventEmitter;
  readonly idGenerator: IdGenerator;
  /** The capability seams available to this process — recorded into each ContextManifest (11 §6). */
  readonly capabilityManifest?: readonly string[];
}

export interface EpisodeInput {
  readonly episodeIndex: number;
  readonly constitution: Constitution;
  readonly learner: LearnerState;
  readonly task: CognitiveTask;
  /** When true, an accepted policy is NOT persisted (adaptation-off — the ablation baseline). */
  readonly freezePolicy: boolean;
}

export interface EpisodeRecord {
  readonly episodeIndex: number;
  readonly correlationId: string;
  readonly compiled: CompiledContext;
  readonly output: CognitiveOutput;
  readonly assessment: Assessment;
  readonly proposal: PolicyProposal;
  readonly decision: GovernanceDecision;
  readonly policyVersionBefore: number;
  readonly policyVersionAfter: number;
}

export async function runEpisode(deps: EpisodeDeps, input: EpisodeInput): Promise<EpisodeRecord> {
  const { constitution, learner, task } = input;
  const ref = policyRef(constitution.agent_id, learner.learner_cid);
  const policy = deps.policies.get(ref);
  if (!policy) {
    throw new CosError("E_LOOP_POLICY_MISSING", `no Adaptive Policy at ${ref}`, {
      specRef: SPEC_REF,
    });
  }

  const correlationId = `ep-${deps.idGenerator.hex(16)}`;

  const started = deps.emitter.emit({
    eventType: LOOP_EVENTS.episodeStarted,
    correlationId,
    payload: {
      episode_index: input.episodeIndex,
      task_id: task.task_id,
      concept_id: task.concept_id,
      policy_version: policy.version,
    },
  });

  // --- compile (attention over durable state) ---
  const compiled = deps.compiler.compile({ constitution, policy, learner, task });
  // Reconstruction law (11 §6): the model-visible context is captured as a durable ContextManifest.
  const manifest = buildContextManifest({
    compiled,
    processId: correlationId,
    agentId: constitution.agent_id,
    capabilityManifest: deps.capabilityManifest ?? [],
    goalRefs: [task.concept_id],
  });
  const compiledEvent = deps.emitter.emit({
    eventType: LOOP_EVENTS.contextCompiled,
    correlationId,
    causationId: started.event_id,
    payload: {
      strategy: compiled.strategy,
      from_exploration: compiled.from_exploration,
      provenance: compiled.provenance,
      manifest,
    },
  });

  // --- execute (model faculty) ---
  const output = await deps.faculty.execute(compiled);
  const outputEvent = deps.emitter.emit({
    eventType: LOOP_EVENTS.outputProduced,
    correlationId,
    causationId: compiledEvent.event_id,
    payload: { strategy: output.strategy, confidence: output.confidence },
  });

  // --- observe outcome (state) ---
  const assessment = deps.learnerSim.assess(output);
  const outcomeEvent = deps.emitter.emit({
    eventType: LOOP_EVENTS.outcomeObserved,
    correlationId,
    causationId: outputEvent.event_id,
    payload: {
      score: assessment.score,
      passed: assessment.passed,
      metric: constitution.evaluation_metric,
    },
  });

  // --- reflect → propose (attribution gate: reflection only proposes) ---
  const proposal = deps.reflection.reflect({
    policy,
    strategy: compiled.strategy,
    score: assessment.score,
    evidence: [outcomeEvent.event_id, compiledEvent.event_id],
    proposalId: `prop-${deps.idGenerator.hex(16)}`,
  });
  const reflectionEvent = deps.emitter.emit({
    eventType: LOOP_EVENTS.reflectionRecorded,
    correlationId,
    causationId: outcomeEvent.event_id,
    payload: {
      rationale: proposal.rationale,
      strategy: proposal.strategy,
      weight_delta: proposal.weight_delta,
    },
  });
  const proposedEvent = deps.emitter.emit({
    eventType: LOOP_EVENTS.policyProposed,
    correlationId,
    causationId: reflectionEvent.event_id,
    payload: {
      proposal_id: proposal.proposal_id,
      base_version: proposal.base_version,
      strategy: proposal.strategy,
      weight_delta: proposal.weight_delta,
    },
  });

  // --- govern (before the state change) ---
  const decision = deps.governor.govern({ constitution, policy, proposal });
  let policyVersionAfter = policy.version;
  if (decision.accepted && decision.policy) {
    const applied = !input.freezePolicy;
    if (applied) {
      deps.policies.put(decision.policy);
      policyVersionAfter = decision.policy.version;
    }
    deps.emitter.emit({
      eventType: LOOP_EVENTS.policyAccepted,
      correlationId,
      causationId: proposedEvent.event_id,
      payload: {
        proposal_id: proposal.proposal_id,
        new_version: decision.policy.version,
        applied,
        reason: decision.reason,
      },
    });
  } else {
    deps.emitter.emit({
      eventType: LOOP_EVENTS.policyRejected,
      correlationId,
      causationId: proposedEvent.event_id,
      payload: { proposal_id: proposal.proposal_id, reason: decision.reason },
    });
  }

  return {
    episodeIndex: input.episodeIndex,
    correlationId,
    compiled,
    output,
    assessment,
    proposal,
    decision,
    policyVersionBefore: policy.version,
    policyVersionAfter,
  };
}
