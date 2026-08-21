# ADR-0066 — The Cognitive Harness Runtime (DeepSeek-Harness synthesis)

**Status:** Accepted (2026-08-21) · Implementation status: partial — the walking-skeleton seed is built
and verify-green in `@inevitable/cognitive-loop` (CapabilityRegistry + protected kernel, transactional
`CognitiveHarness`, `ContextManifest` + reconstruction-from-log, the L2 governed loop); the live event
channel, general action pipeline, full formation transaction, and L1.5 durablization are `TARGET`.
Owning spec: `spec/research/living-cognitive-agents/11-cognitive-harness-runtime.md` (subordinate to
`10-master-cognitive-architecture.md`; does not re-own the environment `09` or evaluation `06`).

## Context

DeepSeek Harness (dsh, MIT) — a coding-agent framework on the Cordis plugin kernel — solves, cleanly
and in production, the three things UCI's persistent-cognition slice most needed discipline on:
composable **capability seams** (`ctx.*` services, any provider swappable), a **durable-vs-live event
split** (append-only `SessionEvent` log vs ephemeral `agent/*` hooks), and a **reconstruction law**
(*"anything that reaches a model request must be reconstructable from the log"*, via `deriveMessages()`).
But dsh's *ontology* is chat-message/coding-agent-centric — the one thing UCI must not couple to (UCI's
ontology is Cognitive Objects, world/learner/epistemic state, living documents, surfaces).

## Decision

Adopt a **Cognitive Harness Runtime** as the composition/execution/traceability layer for UCI cognitive
processes, synthesizing dsh (mechanisms) + Prime (persistent cognition, `09`) + UCI (ontology): (1) a
small **protected kernel** (durable-log integrity, governance-before-mutation, provenance, world-state
authority, identity) fronting a **CapabilityRegistry** of pluggable seams (model, memory, tools, skills,
verifiers, renderers, …), added only when they pass the §17 seam gate; (2) two explicit event domains —
durable Cognitive Events (source of truth) and a live HookBus, with a promotion path and *no runtime
noise in durable history*; (3) the **reconstruction law as a constitutional invariant** — every model
invocation emits a durable **`ContextManifest`**; (4) **transactional formation/composition** (resolve
→ validate → commit or rollback; never publish a half-configured process); (5) a generalized **Cognitive
Action Pipeline** (propose → authorize → capability-check → pre-hook → execute → observe → post → finalize
→ durable event → projection) covering tools, memory/world/surface mutations, formation, autonomous acts.

**DeepSeek relationship: Strategy A — reference-only.** dsh is architectural reference, not a dependency;
its mechanisms map to *generalizing UCI's own code*, not importing it. A git-ignored `external/deepseek-
harness/` clone is endorsed for deeper study only (cloning ≠ integrating). Escalate to Strategy C (adapter
behind UCI `CognitiveHarness` contracts) only on a concrete need to run a UCI process through dsh's runtime;
Strategy B (per-component reuse) only with license + clean-boundary review; Strategy D (fork) is not
justified. UCI domain semantics must never leak into a dsh dependency.

## Rejected alternatives

- **"Everything is a plugin" wholesale.** Rejected — it would let a plugin disable a UCI law. The kernel
  stays small and protected; a seam must earn its place (§17 gate; `CLAUDE.md` "complexity must earn it").
- **Fork or depend on dsh now.** Rejected — couples UCI to a coding-agent chat-message ontology; the
  mechanisms are cheaper to re-realize over our existing event log, world-state, and Cognitive Objects.
- **Build the full harness/society before the loop is proven.** Rejected — speculative architecture at
  scale. The slice extends the already-green L2 walking skeleton; live channel/pipeline/formation follow
  only after (see 11 §12 order). Loop first, then harness, then society.

Cognitive Objects remain first-class (11 §14 / directive §18): the harness *executes* cognitive
processes; it does not replace the ontology cognition operates on.
