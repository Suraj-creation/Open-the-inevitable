/**
 * CapabilityRegistry — the composition runtime (11 §4): a small, typed analog of DeepSeek Harness's
 * Cordis `ctx`. Capabilities (the pluggable seams) are provided by name; the KERNEL invariants stay
 * PROTECTED. `compose()` is the miniature Formation Transaction (11 §8): it validates every seam — and
 * every protected seam especially — is present, and THROWS (rollback) rather than publish a
 * half-configured harness. It never silently fills a missing kernel seam.
 *
 * The core insight is NOT "everything is a plugin" — it is "everything that should be replaceable has
 * a seam, and the kernel that guarantees invariants is small and protected."
 */
import { CosError } from "@inevitable/shared";
import type { PolicyStore } from "./adaptive-policy";
import type { ContextCompiler } from "./context-compiler";
import type { CognitiveEventLog } from "./events";
import type { Faculty } from "./faculty";
import type { AdaptationGovernor } from "./governor";
import type { Reflection } from "./reflection";

/** The named capability seams a Cognitive Harness composes (dsh `ctx.*` analog). */
export interface HarnessCapabilities {
  readonly compiler: ContextCompiler;
  readonly faculty: Faculty;
  readonly reflection: Reflection;
  readonly governor: AdaptationGovernor;
  readonly policies: PolicyStore;
  readonly eventLog: CognitiveEventLog;
}

export type CapabilityKey = keyof HarnessCapabilities;

/**
 * PROTECTED seams — the kernel invariants (durable-log integrity, governance-before-mutation). A
 * harness may swap the faculty or compiler, but may never be published without these present.
 */
export const PROTECTED_CAPABILITIES: readonly CapabilityKey[] = ["governor", "eventLog"];

const REQUIRED_CAPABILITIES: readonly CapabilityKey[] = [
  "compiler",
  "faculty",
  "reflection",
  "governor",
  "policies",
  "eventLog",
];

const SPEC_REF = "spec/research/living-cognitive-agents/11-cognitive-harness-runtime.md";

export interface CapabilityDescriptor {
  readonly key: CapabilityKey;
  /** Constructor name of the provided implementation — the "what is wired" answer. */
  readonly impl: string;
  readonly protected: boolean;
}

export class CapabilityRegistry {
  private readonly provided = new Map<CapabilityKey, unknown>();

  provide<K extends CapabilityKey>(key: K, impl: HarnessCapabilities[K]): this {
    this.provided.set(key, impl);
    return this;
  }

  has(key: CapabilityKey): boolean {
    return this.provided.has(key);
  }

  /** Transactional compose: every seam required; a missing protected seam ⇒ throw (rollback). */
  compose(): HarnessCapabilities {
    const missing = REQUIRED_CAPABILITIES.filter((k) => !this.provided.has(k));
    if (missing.length > 0) {
      const missingProtected = missing.filter((k) => PROTECTED_CAPABILITIES.includes(k));
      throw new CosError(
        "E_HARNESS_INCOMPLETE",
        `cannot compose harness — missing capabilities: ${missing.join(", ")}`,
        { specRef: SPEC_REF, details: { missing, missingProtected } },
      );
    }
    return {
      compiler: this.provided.get("compiler") as ContextCompiler,
      faculty: this.provided.get("faculty") as Faculty,
      reflection: this.provided.get("reflection") as Reflection,
      governor: this.provided.get("governor") as AdaptationGovernor,
      policies: this.provided.get("policies") as PolicyStore,
      eventLog: this.provided.get("eventLog") as CognitiveEventLog,
    };
  }

  describe(): readonly CapabilityDescriptor[] {
    return REQUIRED_CAPABILITIES.filter((k) => this.provided.has(k)).map((k) => ({
      key: k,
      impl: implName(this.provided.get(k)),
      protected: PROTECTED_CAPABILITIES.includes(k),
    }));
  }
}

function implName(impl: unknown): string {
  if (impl && typeof impl === "object") {
    const ctor = (impl as { constructor?: { name?: string } }).constructor;
    return ctor?.name ?? "anonymous";
  }
  return typeof impl;
}
