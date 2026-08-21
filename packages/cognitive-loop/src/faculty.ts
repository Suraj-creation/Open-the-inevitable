/**
 * Faculty — the execution seam. The model is a replaceable faculty INSIDE the runtime, never the top
 * of the stack (10 §2.1). In production a `ModelRuntimeFaculty` wraps a `ModelRuntime` (contracts)
 * driven by `compiled.model_request`. For the L2 walking skeleton a `DeterministicFaculty` isolates
 * the loop mechanism from model nondeterminism so accumulation / governance / replay / ablation are
 * provable deterministically. This is explicitly NOT a claim of cognition (CLAUDE.md "no fake
 * cognition") — it proves the SUBSTRATE LOOP; the real model faculty is swapped in once the loop and
 * its four-measurement gate (§11.5) pass.
 */
import type { ExplanationStrategy } from "./constitution";
import type { CompiledContext } from "./context-compiler";

/** Structured output (typed exchange — never a bare string; CLAUDE.md §3 "every semantic exchange is typed"). */
export interface CognitiveOutput {
  readonly strategy: ExplanationStrategy;
  readonly content: string;
  readonly confidence: number;
}

export interface Faculty {
  execute(compiled: CompiledContext): Promise<CognitiveOutput>;
}

/**
 * Deterministic faculty: echoes the compiled strategy and produces stable content. It carries the
 * strategy forward as structured metadata so the environment scores strategy-fit without brittle
 * text parsing — keeping the mechanism proof deterministic.
 */
export class DeterministicFaculty implements Faculty {
  execute(compiled: CompiledContext): Promise<CognitiveOutput> {
    const firstLine = compiled.prompt.split("\n")[0] ?? "";
    return Promise.resolve({
      strategy: compiled.strategy,
      content: `[${compiled.strategy}] ${firstLine}`,
      confidence: 0.8,
    });
  }
}
