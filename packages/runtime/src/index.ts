/**
 * @inevitable/runtime — cognitive unit runtime.
 * Spec: spec/runtime/cognitive-unit-runtime.md, spec/protocols/cognitive-unit-abi.md.
 */
export type { UnitLifecycleState } from "./lifecycle";
export { LifecycleMachine, allowedTransitions, isTerminalState } from "./lifecycle";

export type { CognitiveUnit, CognitiveHealth, CognitionFrame, Emissions } from "./abi";
export { ABI_VERSION, isAbiCompatible } from "./abi";

export { loadManifest } from "./manifest";

export type { UnitHostDeps } from "./host";
export { CognitiveUnitHost } from "./host";
