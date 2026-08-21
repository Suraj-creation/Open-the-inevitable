/**
 * HarnessExplainer — the live integration boundary between the Cognitive Harness (spec 11) and the
 * Cognitive Surface. It composes the harness's Context Compiler + ModelRuntimeFaculty against a real
 * ModelRuntime, produces a structured, role-tagged explanation, and maps the faculty's OutputSections
 * to durable SemanticSections (the surface's structured-explanation contract).
 *
 * This is the OPT-IN path (a dedicated gateway route, `POST /api/surface/:id/harness-explain`); the
 * default ask/advance flow is unchanged. The full governed episode loop (reflect → policy → adapt) is
 * the follow-on — this proves the compile → real-model → structured-surface half end to end.
 */
import {
  ContextCompiler,
  ModelRuntimeFaculty,
  constitutionFromManifest,
  seedPolicy,
  type CognitiveTask,
  type LearnerState,
} from "@inevitable/cognitive-loop";
import type { ModelRuntime } from "@inevitable/contracts";
import { sectionsFromRoleTexts, type SemanticSection } from "@inevitable/surface";

export interface HarnessExplanation {
  readonly summary: string;
  readonly confidence: number;
  readonly strategy: string;
  readonly sections: readonly SemanticSection[];
}

export interface HarnessExplainInput {
  readonly learnerCid: string;
  readonly concept: string;
  readonly conceptTitle: string;
  readonly agentId?: string;
  readonly knownConcepts?: readonly string[];
  readonly level?: number;
}

export class HarnessExplainer {
  private readonly compiler = new ContextCompiler();
  private readonly faculty: ModelRuntimeFaculty;

  constructor(model: ModelRuntime) {
    this.faculty = new ModelRuntimeFaculty(model);
  }

  async explain(input: HarnessExplainInput): Promise<HarnessExplanation> {
    const agentId = input.agentId ?? "agent.explanation";
    const constitution = constitutionFromManifest({
      id: agentId,
      role: "Explains concepts so a learner genuinely understands them.",
    });
    const policy = seedPolicy(agentId, input.learnerCid, constitution.constitution_id);
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
    const output = await this.faculty.execute(compiled);
    return {
      summary: output.content,
      confidence: output.confidence,
      strategy: output.strategy,
      sections: sectionsFromRoleTexts(output.sections ?? []),
    };
  }
}
