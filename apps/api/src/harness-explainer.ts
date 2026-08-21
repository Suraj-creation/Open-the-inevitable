/**
 * HarnessExplainer — the live integration boundary between the Cognitive Harness (spec 11) and the
 * Cognitive Surface, and the governed per-learner learning loop over it.
 *
 * `explain()` reads the learner's DURABLE Adaptive Policy, compiles context with it (so the teaching
 * strategy is the learner's current best fit), executes the real model faculty, and records the
 * strategy used. `recordOutcome()` closes the loop: a real outcome signal (learner feedback / mastery)
 * drives reflect → propose → govern → persist, so the NEXT explanation for that learner compiles with
 * the adapted policy. The strategy therefore ACCUMULATES across explanations, per learner.
 *
 * Because seed weights start at 1, the compiler naturally tries untried strategies before exploiting
 * the best — no explicit exploration schedule is needed on the live path. The policy store is injected
 * (host-level in the gateway), so a learner's adaptation persists across their surfaces within the
 * process; Postgres durablization across restarts is the L1.5 gate (deferred).
 */
import {
  AdaptationGovernor,
  ContextCompiler,
  InMemoryPolicyStore,
  ModelRuntimeFaculty,
  Reflection,
  buildContextManifest,
  constitutionFromManifest,
  policyRef,
  seedPolicy,
  type AdaptivePolicy,
  type CognitiveTask,
  type Constitution,
  type ContextManifest,
  type ExplanationStrategy,
  type HookBus,
  type LearnerState,
  type PolicyStore,
} from "@inevitable/cognitive-loop";
import type { ModelRuntime } from "@inevitable/contracts";
import { CryptoIdGenerator } from "@inevitable/shared";
import { sectionsFromRoleTexts, type SemanticSection } from "@inevitable/surface";

export interface HarnessExplanation {
  readonly summary: string;
  readonly confidence: number;
  readonly strategy: string;
  readonly sections: readonly SemanticSection[];
  /** The Adaptive Policy version this explanation was compiled from (accumulation is observable). */
  readonly policyVersion: number;
  /** The reconstruction record for the model invocation (spec 11 §6): why the model saw what it saw. */
  readonly manifest: ContextManifest;
}

export interface HarnessExplainInput {
  readonly learnerCid: string;
  readonly concept: string;
  readonly conceptTitle: string;
  readonly agentId?: string;
  readonly knownConcepts?: readonly string[];
  readonly level?: number;
  /** Product mode (F13): student (default) · educator · researcher · institution · open. */
  readonly mode?: string;
}

export interface HarnessOutcome {
  readonly accepted: boolean;
  readonly reason: string;
  /** The strategy the outcome was attributed to (null when there was no prior explanation). */
  readonly strategy: string | null;
  readonly policyVersion: number;
}

export interface HarnessExplainerDeps {
  /** Durable-per-learner Adaptive Policy store (host-level). Absent ⇒ a private in-memory store. */
  readonly policies?: PolicyStore;
  /** The last strategy used per learner, for outcome attribution (host-level). Absent ⇒ private map. */
  readonly lastStrategy?: Map<string, ExplanationStrategy>;
  /** Live HookBus (spec 11 §5) routed into the model faculty for interception/observability/recording. */
  readonly hooks?: HookBus;
}

/**
 * F13 mode-aware cognition: the product mode selects the agent's Constitution directive, so the same
 * concept is compiled into a different teaching stance (a real behavioural difference driven by mode,
 * not a cosmetic flag). Strategy adaptation stays mode-independent (a learner's best-fit strategy is
 * learner-general), so one durable policy serves the learner across modes.
 */
const MODE_DIRECTIVE: Readonly<Record<string, string>> = {
  student:
    "Explains concepts so a learner genuinely understands them — lead with intuition and build up.",
  educator:
    "Explains the concept AND how to teach it: surface the pedagogical structure, the prerequisites, and the common misconceptions an educator should anticipate.",
  researcher:
    "Explains the concept with rigor, including the open questions and research frontier a specialist would probe.",
  institution: "Explains the concept clearly for an organizational learning context.",
  open: "Explains the concept clearly and accessibly for a general audience.",
};

function roleForMode(mode: string | undefined): string {
  return MODE_DIRECTIVE[mode ?? "student"] ?? MODE_DIRECTIVE["student"]!;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export class HarnessExplainer {
  private readonly compiler = new ContextCompiler();
  private readonly faculty: ModelRuntimeFaculty;
  private readonly reflection = new Reflection();
  private readonly governor = new AdaptationGovernor();
  private readonly ids = new CryptoIdGenerator();
  private readonly policies: PolicyStore;
  private readonly lastStrategy: Map<string, ExplanationStrategy>;

  constructor(model: ModelRuntime, deps: HarnessExplainerDeps = {}) {
    this.faculty = new ModelRuntimeFaculty(model, deps.hooks);
    this.policies = deps.policies ?? new InMemoryPolicyStore();
    this.lastStrategy = deps.lastStrategy ?? new Map();
  }

  private constitutionFor(agentId: string, mode?: string): Constitution {
    return constitutionFromManifest({ id: agentId, role: roleForMode(mode) });
  }

  /** Read the learner's durable Adaptive Policy, seeding (and persisting) a fresh one when absent. */
  private policyFor(
    agentId: string,
    learnerCid: string,
    constitution: Constitution,
  ): AdaptivePolicy {
    const existing = this.policies.get(policyRef(agentId, learnerCid));
    if (existing) return existing;
    const seed = seedPolicy(agentId, learnerCid, constitution.constitution_id);
    this.policies.put(seed);
    return seed;
  }

  async explain(input: HarnessExplainInput): Promise<HarnessExplanation> {
    const agentId = input.agentId ?? "agent.explanation";
    const constitution = this.constitutionFor(agentId, input.mode);
    const policy = this.policyFor(agentId, input.learnerCid, constitution);
    const learner: LearnerState = {
      learner_cid: input.learnerCid,
      known_concepts: input.knownConcepts ?? [],
      level: input.level ?? 0.3,
    };
    const task: CognitiveTask = {
      task_id: `explain-${input.concept}`,
      concept_id: input.concept,
      concept_title: input.conceptTitle,
      intent: "learn",
    };
    const compiled = this.compiler.compile({ constitution, policy, learner, task });
    // Reconstruction law (spec 11 §6): capture WHY the model saw what it saw, from durable state.
    const manifest = buildContextManifest({
      compiled,
      processId: `explain:${input.learnerCid}:${input.concept}`,
      agentId,
      capabilityManifest: ["compiler", "faculty", "policy-store"],
      goalRefs: [input.concept],
    });
    const output = await this.faculty.execute(compiled);
    this.lastStrategy.set(input.learnerCid, compiled.strategy);
    return {
      summary: output.content,
      confidence: output.confidence,
      strategy: compiled.strategy,
      sections: sectionsFromRoleTexts(output.sections ?? []),
      policyVersion: policy.version,
      manifest,
    };
  }

  /**
   * Close the loop: feed a real outcome signal (0..1) for the learner's most recent explanation. Runs
   * reflect → propose → govern → persist, so the learner's Adaptive Policy accumulates. The next
   * `explain()` for this learner compiles with the new policy. No-op (accepted:false) when there is no
   * prior explanation to attribute the outcome to.
   */
  recordOutcome(input: {
    readonly learnerCid: string;
    readonly score: number;
    readonly agentId?: string;
    readonly strategy?: ExplanationStrategy;
  }): HarnessOutcome {
    const agentId = input.agentId ?? "agent.explanation";
    const constitution = this.constitutionFor(agentId);
    const strategy = input.strategy ?? this.lastStrategy.get(input.learnerCid);
    if (!strategy) {
      return {
        accepted: false,
        reason: "no prior explanation to attribute this outcome to",
        strategy: null,
        policyVersion: 0,
      };
    }
    const policy = this.policyFor(agentId, input.learnerCid, constitution);
    const proposal = this.reflection.reflect({
      policy,
      strategy,
      score: clamp01(input.score),
      evidence: [],
      proposalId: `prop-${this.ids.hex(16)}`,
    });
    const decision = this.governor.govern({ constitution, policy, proposal });
    if (decision.accepted && decision.policy) this.policies.put(decision.policy);
    return {
      accepted: decision.accepted,
      reason: decision.reason,
      strategy,
      policyVersion: decision.policy?.version ?? policy.version,
    };
  }
}
