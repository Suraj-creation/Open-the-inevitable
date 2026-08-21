/**
 * ContextCompiler v1 — the Context Compiler is an ATTENTION mechanism, not a transcript accumulator
 * (03 §3.1; 10 §12 "generalizing ModelBackedUnit's buildRequest"). Each episode it COMPUTES a bounded
 * context from durable state — Constitution ≻ Adaptive Policy ≻ learner state ≻ task, in that
 * precedence — rather than carrying a growing history. It selects the teaching strategy from the
 * policy (or a governed exploration override), always clamped to the Constitution's allowed set, and
 * records provenance so the resulting output is attributable (metric C).
 */
import type { ModelGenerationRequest } from "@inevitable/contracts";
import type { AdaptivePolicy } from "./adaptive-policy";
import { preferredStrategy } from "./adaptive-policy";
import type { Constitution, ExplanationStrategy } from "./constitution";

export interface LearnerState {
  readonly learner_cid: string;
  /** Concepts already understood — the compiler builds on these, never re-explains (ADR-0016). */
  readonly known_concepts: readonly string[];
  /** Coarse mastery level 0..1 used to bound depth. */
  readonly level: number;
}

export interface CognitiveTask {
  readonly task_id: string;
  readonly concept_id: string;
  readonly concept_title: string;
  readonly intent: string;
  /**
   * Deterministic exploration override (loop-driven). When set, the compiler selects this strategy
   * instead of the policy's argmax, so the loop can gather outcome evidence on every strategy before
   * it exploits. Exploration is an explicit, governed input — never hidden randomness.
   */
  readonly explore_strategy?: ExplanationStrategy;
}

export interface CompiledContext {
  readonly task_id: string;
  readonly strategy: ExplanationStrategy;
  readonly from_exploration: boolean;
  readonly prompt: string;
  readonly system: string;
  /** The concrete model call — the seam where a real ModelRuntime faculty executes (contracts). */
  readonly model_request: ModelGenerationRequest;
  /** What durable state this context was compiled from — the attribution basis (03 §3.1). */
  readonly provenance: {
    readonly constitution_id: string;
    readonly constitution_version: number;
    readonly policy_ref: string;
    readonly policy_version: number;
    readonly learner_known_count: number;
  };
  /** Token budget honored (v1: a coarse character budget) — proves "budgeted" composition. */
  readonly budget_chars: number;
}

const STRATEGY_INSTRUCTION: Record<ExplanationStrategy, string> = {
  "concrete-first":
    "Lead with a concrete example, story, or analogy; introduce the formalism only after intuition lands.",
  "abstract-first":
    "Lead with the precise definition and general principle; then instantiate it with an example.",
  "visual-first":
    "Lead with a visual/spatial mental model (describe a diagram or structure); then connect it to words and symbols.",
};

const DEFAULT_BUDGET_CHARS = 4000;

/**
 * Epistemic roles a produced section may carry — the vocabulary aligns 1:1 to the surface's
 * `EpistemicRole` at the integration boundary. Named here so the compiler (and the harness) stay free
 * of a surface dependency (correct dependency direction).
 */
const SECTION_ROLES =
  "intuition, definition, reasoning, example, warning, misconception, insight, observation, evidence, structural";

/** The structured-output contract the model faculty must satisfy (parsed by parseModelFacultyOutput). */
const OUTPUT_CONTRACT_INSTRUCTION =
  `Respond with JSON only (no prose, no markdown fences): ` +
  `{"summary":"<one-sentence essence>","confidence":<0..1>,` +
  `"sections":[{"role":"<one of: ${SECTION_ROLES}>","title":"<short label>","text":"<content>"}]}. ` +
  `Lead with the chosen teaching strategy; keep each section to one kind of knowledge.`;

const OUTPUT_CONTRACT_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["summary", "sections"],
  properties: {
    summary: { type: "string" },
    confidence: { type: "number" },
    sections: {
      type: "array",
      items: {
        type: "object",
        required: ["role", "text"],
        properties: {
          role: { type: "string" },
          title: { type: "string" },
          text: { type: "string" },
        },
      },
    },
  },
};

export class ContextCompiler {
  compile(input: {
    readonly constitution: Constitution;
    readonly policy: AdaptivePolicy;
    readonly learner: LearnerState;
    readonly task: CognitiveTask;
    readonly budgetChars?: number;
  }): CompiledContext {
    const { constitution, policy, learner, task } = input;
    const budget = input.budgetChars ?? DEFAULT_BUDGET_CHARS;

    // Strategy selection: exploration override if present, else the policy argmax — but ALWAYS
    // clamped to the Constitution's allowed set (a policy can never drive an out-of-bounds strategy).
    const proposed = task.explore_strategy ?? preferredStrategy(policy);
    const strategy: ExplanationStrategy = constitution.allowed_strategies.includes(proposed)
      ? proposed
      : (constitution.allowed_strategies[0] ?? preferredStrategy(policy));

    // Precedence assembly (Constitution ≻ Policy ≻ Learner ≻ Task), each section bounded to budget.
    const system = clampTo(
      [
        `You are "${constitution.identity}". ${constitution.role}`,
        `Teaching strategy for this learner: ${STRATEGY_INSTRUCTION[strategy]}`,
        learner.known_concepts.length > 0
          ? `Already understood (build on, do not re-explain): ${learner.known_concepts.join(", ")}`
          : "",
        OUTPUT_CONTRACT_INSTRUCTION,
      ]
        .filter(Boolean)
        .join("\n"),
      budget,
    );
    const prompt = clampTo(
      [
        `Intent: ${task.intent}`,
        `Concept: ${task.concept_id} — ${task.concept_title}`,
        `Learner level: ${(learner.level * 100).toFixed(0)}%`,
      ].join("\n"),
      budget,
    );

    const model_request: ModelGenerationRequest = {
      prompt,
      system,
      maxTokens: 2048,
      responseSchema: OUTPUT_CONTRACT_SCHEMA,
      invocation_key: `${constitution.agent_id}:${task.task_id}:explanation`,
    };

    return {
      task_id: task.task_id,
      strategy,
      from_exploration: task.explore_strategy !== undefined,
      prompt,
      system,
      model_request,
      provenance: {
        constitution_id: constitution.constitution_id,
        constitution_version: constitution.version,
        policy_ref: policy.ref,
        policy_version: policy.version,
        learner_known_count: learner.known_concepts.length,
      },
      budget_chars: budget,
    };
  }
}

function clampTo(text: string, budgetChars: number): string {
  return text.length <= budgetChars ? text : text.slice(0, budgetChars);
}
