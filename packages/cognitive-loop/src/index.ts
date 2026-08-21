/**
 * @inevitable/cognitive-loop — the L2 walking skeleton: the smallest real cognitive loop that answers
 * one question (10 §12):
 *
 *   Can this system accumulate, govern, retrieve, apply, and verify cognitive improvement across time —
 *   provably (replay), generally (transfer), and causally (ablation)?
 *
 * It threads ONE task through every layer once — Constitution (static identity) → Adaptive Policy
 * (versioned Cognitive Object) → Context Compiler v1 → execution faculty → durable events → outcome
 * state → reflection → governed acceptance → next episode — and is instrumented for all four L2
 * measurements (§11.5) from episode 1. It is deliberately self-contained: wiring it into the
 * ProductRuntimeDispatcher / gateway and swapping the DeterministicFaculty for a real ModelRuntime,
 * and the in-memory stores for Postgres (the L1.5 integrity gate), come only once the loop and its
 * gate pass. Loop first, cathedral after.
 */
export * from "./constitution";
export * from "./adaptive-policy";
export * from "./context-compiler";
export * from "./context-manifest";
export * from "./faculty";
export * from "./hook-bus";
export * from "./learner-simulator";
export * from "./events";
export * from "./reflection";
export * from "./governor";
export * from "./capability-registry";
export * from "./harness";
export * from "./episode";
export * from "./loop";
