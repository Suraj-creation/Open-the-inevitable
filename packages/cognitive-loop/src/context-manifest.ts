/**
 * ContextManifest — the reconstruction law made real (11 §6; DeepSeek Harness's "model-visible means
 * logged: anything that reaches a model request must be reconstructable from the log"). Adopted as a
 * UCI constitutional invariant: every model invocation emits a durable manifest capturing WHY the
 * model saw what it saw. This is not logging — it is cognitive provenance. It generalizes
 * `CompiledContext.provenance` into the full record dsh's `deriveMessages()` implies.
 *
 * Ref lists for memory/world-state/skills are typed seams — empty until those faculties are wired
 * (honest emptiness, not omission), populated as the harness grows.
 */
import type { ExplanationStrategy } from "./constitution";
import type { CompiledContext } from "./context-compiler";
import type { CognitiveEventLog } from "./events";
import { LOOP_EVENTS } from "./events";

export interface ContextManifest {
  readonly request_id: string;
  readonly process_id: string;
  readonly agent_id: string;
  readonly archetype: string | null;
  readonly model: string | null;
  readonly model_config: { readonly maxTokens: number | null; readonly temperature: number | null };
  readonly constitution_id: string;
  readonly constitution_version: number;
  readonly policy_ref: string;
  readonly policy_version: number;
  readonly strategy: ExplanationStrategy;
  readonly goal_refs: readonly string[];
  readonly memory_refs: readonly string[];
  readonly world_state_refs: readonly string[];
  readonly cognitive_object_refs: readonly string[];
  readonly skill_refs: readonly string[];
  /** Which capability seams were available to the process that issued this request. */
  readonly capability_manifest: readonly string[];
  /** The assembled system-prompt sections — the model-visible instruction surface. */
  readonly system_sections: readonly string[];
  readonly prompt: string;
  readonly budget_chars: number;
  /** The compiler's decisions (strategy source, budget) — the "why this context" trail. */
  readonly compiler_decisions: readonly string[];
}

export interface BuildManifestInput {
  readonly compiled: CompiledContext;
  readonly processId: string;
  readonly agentId: string;
  readonly archetype?: string | null;
  readonly capabilityManifest: readonly string[];
  readonly goalRefs: readonly string[];
}

export function buildContextManifest(input: BuildManifestInput): ContextManifest {
  const { compiled } = input;
  const req = compiled.model_request;
  return {
    request_id: req.invocation_key ?? `${input.agentId}:${compiled.task_id}`,
    process_id: input.processId,
    agent_id: input.agentId,
    archetype: input.archetype ?? null,
    model: req.model ?? null,
    model_config: {
      maxTokens: typeof req.maxTokens === "number" ? req.maxTokens : null,
      temperature: typeof req.temperature === "number" ? req.temperature : null,
    },
    constitution_id: compiled.provenance.constitution_id,
    constitution_version: compiled.provenance.constitution_version,
    policy_ref: compiled.provenance.policy_ref,
    policy_version: compiled.provenance.policy_version,
    strategy: compiled.strategy,
    goal_refs: input.goalRefs,
    memory_refs: [],
    world_state_refs: [],
    cognitive_object_refs: [compiled.provenance.policy_ref],
    skill_refs: [],
    capability_manifest: input.capabilityManifest,
    system_sections: compiled.system.split("\n").filter((s) => s.length > 0),
    prompt: compiled.prompt,
    budget_chars: compiled.budget_chars,
    compiler_decisions: [
      `strategy:${compiled.strategy}`,
      `from_exploration:${compiled.from_exploration}`,
      `budget_chars:${compiled.budget_chars}`,
    ],
  };
}

/**
 * Reconstruct the ContextManifest for a model request FROM THE LOG ALONE. Returns null if no durable
 * context.compiled event carries a manifest with that request_id — which, per the reconstruction law,
 * means that request was not model-visible-reconstructable and is itself a violation to surface.
 */
export function reconstructContextManifest(
  log: CognitiveEventLog,
  requestId: string,
): ContextManifest | null {
  for (const event of log.all()) {
    if (event.event_type !== LOOP_EVENTS.contextCompiled) continue;
    const payload = event.payload as Record<string, unknown>;
    const manifest = payload["manifest"] as ContextManifest | undefined;
    if (manifest && manifest.request_id === requestId) return manifest;
  }
  return null;
}
