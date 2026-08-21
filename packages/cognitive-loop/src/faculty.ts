/**
 * Faculty — the execution seam. The model is a replaceable faculty INSIDE the runtime, never the top
 * of the stack (10 §2.1). In production a `ModelRuntimeFaculty` wraps a `ModelRuntime` (contracts)
 * driven by `compiled.model_request`. For the L2 walking skeleton a `DeterministicFaculty` isolates
 * the loop mechanism from model nondeterminism so accumulation / governance / replay / ablation are
 * provable deterministically. This is explicitly NOT a claim of cognition (CLAUDE.md "no fake
 * cognition") — it proves the SUBSTRATE LOOP; the real model faculty is swapped in once the loop and
 * its four-measurement gate (§11.5) pass.
 */
import type { ModelRuntime } from "@inevitable/contracts";
import { CosError } from "@inevitable/shared";
import type { ExplanationStrategy } from "./constitution";
import type { CompiledContext } from "./context-compiler";
import { HOOKS, type HookBus } from "./hook-bus";

/**
 * A role-tagged unit of explanation content produced by a faculty. `role` aligns 1:1 to the surface's
 * EpistemicRole vocabulary at the integration boundary; kept as a string here so the harness stays free
 * of a surface dependency (correct dependency direction).
 */
export interface OutputSection {
  readonly role: string;
  readonly title: string;
  readonly text: string;
}

/** Structured output (typed exchange — never a bare string; CLAUDE.md §3 "every semantic exchange is typed"). */
export interface CognitiveOutput {
  readonly strategy: ExplanationStrategy;
  readonly content: string;
  readonly confidence: number;
  /** Role-tagged explanation sections — present when the faculty produced structured content. */
  readonly sections?: readonly OutputSection[];
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

const SPEC_REF = "spec/research/living-cognitive-agents/11-cognitive-harness-runtime.md";

export interface ModelFacultyOutput {
  readonly summary: string;
  readonly confidence: number;
  readonly sections: readonly OutputSection[];
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Parse a model response (the Context Compiler's `model_request` output contract) into typed,
 * role-tagged sections. Tolerant of markdown fences; throws a typed error on malformed / empty output
 * so degradation stays visible (never a silent stub — CLAUDE.md "no fake cognition").
 */
export function parseModelFacultyOutput(text: string): ModelFacultyOutput {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    throw new CosError("E_FACULTY_OUTPUT_MALFORMED", "faculty output is not valid JSON", {
      specRef: SPEC_REF,
      details: { sample: trimmed.slice(0, 160) },
    });
  }
  const obj = raw as { summary?: unknown; confidence?: unknown; sections?: unknown };
  const rawSections = Array.isArray(obj.sections) ? obj.sections : [];
  const sections: OutputSection[] = [];
  for (const entry of rawSections) {
    const s = entry as { role?: unknown; title?: unknown; text?: unknown };
    if (typeof s.text === "string" && s.text.trim().length > 0) {
      sections.push({
        role: typeof s.role === "string" && s.role.trim() ? s.role : "observation",
        title: typeof s.title === "string" ? s.title : "",
        text: s.text,
      });
    }
  }
  if (sections.length === 0) {
    throw new CosError("E_FACULTY_OUTPUT_MALFORMED", "faculty output carries no usable sections", {
      specRef: SPEC_REF,
    });
  }
  const summary =
    typeof obj.summary === "string" && obj.summary.trim()
      ? obj.summary
      : (sections[0]?.text.slice(0, 160) ?? "");
  const confidence = typeof obj.confidence === "number" ? clamp01(obj.confidence) : 0.7;
  return { summary, confidence, sections };
}

/**
 * ModelRuntimeFaculty — the real reasoning faculty inside the harness (11 §; "the model is a
 * replaceable faculty"). It drives the Context Compiler's `model_request` through an injected
 * ModelRuntime (contracts) and returns typed, role-tagged sections. This is the production form the
 * DeterministicFaculty stands in for during the L2 mechanism proof; swapping it in is a one-line
 * capability substitution through the CapabilityRegistry (no loop change).
 */
export class ModelRuntimeFaculty implements Faculty {
  constructor(
    private readonly model: ModelRuntime,
    /** Optional live HookBus (spec 11 §5): interceptors observe/transform the request and observe the
     *  result around the model call — the seam for policy, observability, cancellation, recording. */
    private readonly hooks?: HookBus,
  ) {}

  async execute(compiled: CompiledContext): Promise<CognitiveOutput> {
    const request = this.hooks
      ? await this.hooks.run(HOOKS.preModelRequest, compiled.model_request)
      : compiled.model_request;
    const result = await this.model.generate(request);
    // Observe the invocation (even a refusal is logged) before interpreting it.
    if (this.hooks) await this.hooks.run(HOOKS.postModelRequest, { request, result });
    if (result.finishReason === "refusal" || result.finishReason === "safety") {
      throw new CosError("E_FACULTY_REFUSAL", `model refused generation (${result.finishReason})`, {
        specRef: SPEC_REF,
        details: { invocation_key: request.invocation_key },
      });
    }
    const parsed = parseModelFacultyOutput(result.text);
    return {
      strategy: compiled.strategy,
      content: parsed.summary,
      confidence: parsed.confidence,
      sections: parsed.sections,
    };
  }
}
