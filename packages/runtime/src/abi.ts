/**
 * Cognitive Unit ABI — the plug-in contract every cognitive unit implements.
 * Spec: spec/protocols/cognitive-unit-abi.md.
 */
import type {
  UnitDescriptor,
  ContextLease,
  CognitionPacket,
  CognitiveEvent,
  ReasoningTrace,
  UnitLifecycleState,
} from "@inevitable/protocols";

export const ABI_VERSION = "1.0.0";

export interface CognitiveHealth {
  runtime: "ok" | "degraded" | "failing";
  /** Reasoning drift estimate 0..1. */
  drift: number;
  /** Recent mean confidence 0..1. */
  confidence: number;
  /** Load factor 0..1. */
  loadFactor: number;
}

export interface CognitionFrame {
  readonly unitId: string;
  readonly state: UnitLifecycleState;
  readonly data: Record<string, unknown>;
}

/** Side effects a unit produces from `execute()` — published/recorded by the runtime. */
export interface Emissions {
  packets?: CognitionPacket[];
  events?: CognitiveEvent[];
  trace?: ReasoningTrace;
  memoryMutationRefs?: string[];
}

export interface CognitiveUnit {
  describe(): UnitDescriptor;
  prepare(lease: ContextLease): Promise<void> | void;
  execute(packet: CognitionPacket): Promise<Emissions> | Emissions;
  reflect(trace: ReasoningTrace): Promise<string | null> | string | null;
  checkpoint(): Promise<CognitionFrame> | CognitionFrame;
  restore(frame: CognitionFrame): Promise<void> | void;
  shutdown(reason: string): Promise<void> | void;
  health(): CognitiveHealth;
}

/** Major-version compatibility check between a unit's ABI and the runtime's ABI. */
export function isAbiCompatible(
  unitAbiVersion: string,
  runtimeAbiVersion: string = ABI_VERSION,
): boolean {
  const unitMajor = unitAbiVersion.split(".")[0];
  const runtimeMajor = runtimeAbiVersion.split(".")[0];
  return unitMajor === runtimeMajor;
}
