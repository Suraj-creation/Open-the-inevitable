import type { Delivery, ReconcileFinding, Usage } from "@uci/kernel";

/**
 * The model is a replaceable faculty. A faculty sees only the rendered, provider-neutral request:
 * it cannot read the store or the working-state object, so whatever it knows came through the
 * recorded context. Faculties never retry internally; each attempt is its own ledger effect.
 */
export interface FacultyRequest {
  readonly system: string;
  readonly prompt: string;
  /** JSON-schema subset (type/properties/items/enum/required/nullable) shared by all providers. */
  readonly schema: Record<string, unknown>;
  readonly model: string;
  readonly temperature?: number;
}

export interface FacultyResponse {
  readonly text: string;
  readonly usage: Usage;
  /** The model that actually produced the text, when the provider may route (e.g. refusal fallbacks). */
  readonly servedBy?: string;
}

export class FacultyError extends Error {
  override readonly name = "FacultyError";
  constructor(
    message: string,
    readonly delivery: Delivery,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

export interface ModelFaculty {
  readonly id: string;
  readonly model: string;
  respond(request: FacultyRequest): Promise<FacultyResponse>;
}

/**
 * The environment contract. An environment owns its own durable channel, outside the process: the
 * process can crash mid-effect and the channel still knows what was delivered, which is what makes
 * reconciliation possible. Inputs are admitted durably by the channel and delivered to the process
 * only at step boundaries.
 */
export interface ActionSpec {
  readonly name: string;
  readonly description: string;
  /** Parameters the model must supply (names only; values are strings). */
  readonly params: readonly string[];
  /**
   * The action's expectation hangs on the world's answer (an exercise, a check): after it, the
   * process waits for input, or for that expectation to fall due, rather than deciding again.
   * Harness-side only, never rendered to the faculty.
   */
  readonly awaits?: "reply";
}

export interface PerformRequest {
  /** The process acting: effect ids are unique within it, and replies are admitted to its inbox. */
  readonly processId: string;
  readonly effectId: string;
  readonly idempotencyKey: string;
  readonly action: string;
  readonly params: Readonly<Record<string, string>>;
}

export interface PerformResult {
  readonly delivery: Delivery;
  /** What the environment reports back as an observation (stored as evidence, never as truth). */
  readonly observation: string;
  /** For an assessment probe the environment selected: which item it was (so its answer can be verified). */
  readonly probeItemId?: string;
}

export interface Verification {
  readonly outcome: "held" | "failed" | "indeterminate";
  readonly method: string;
  readonly verifier: {
    readonly id: string;
    readonly version: string;
    readonly measuredError: string;
    readonly actorVisible: false;
  };
}

export interface PracticeItem {
  readonly itemId: string;
  readonly prompt: string;
}

export interface EnvironmentPack {
  readonly id: string;
  readonly version: string;
  readonly actions: readonly ActionSpec[];
  /** Items the actor may choose for practice. Answer keys are never exposed. */
  practiceItems(): readonly PracticeItem[];
  perform(request: PerformRequest): Promise<PerformResult>;
  /**
   * Ask the channel whether an effect whose outcome is unknown was actually delivered. Effect ids
   * are unique within a process only, so the channel is asked per process.
   */
  reconcile(
    processId: string,
    effectId: string,
  ): Promise<{ finding: ReconcileFinding; detail?: string; observation?: string }>;
  /** The environment's own verifier for an item answer; the actor can neither read nor edit it. */
  verify(itemId: string, answer: string): Verification;
  /** Acceptance over the verifier's outcomes on environment-selected probes, oldest first. */
  acceptanceMet(probeOutcomes: readonly ("held" | "failed" | "indeterminate")[]): boolean;
  /** Strings that must never appear in any rendered request (answer keys). */
  verifierPrivate(): readonly string[];
}
