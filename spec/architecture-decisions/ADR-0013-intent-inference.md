# ADR-0013 — Intent Inference (Goal → Intent Lease)

- **Status:** accepted
- **Date:** 2026-06-20
- **Deciders:** kernel-team, runtime-team
- **Supersedes:** —
- **Related:** [ADR-0012 (context-lease-bounded retrieval)](./ADR-0012-context-lease-bounded-retrieval.md), [spec/kernel/intent-inference](../kernel/intent-inference.md), [spec/kernel/intent-lease](../kernel/intent-lease.md), [spec/protocols/model-invocation-protocol](../protocols/model-invocation-protocol.md), `@inevitable/product-cognition`, `apps/cli`, `apps/api`

## Context

The intent lease is defined and the lease spec names `interpret(goal) → IntentLease`, but it was never
implemented: onboarding stamps a fixed, goal-independent intent lease (`"Understand the requested topic
deeply"`, confidence 1) on every session. The architecture law ("no long-running cognition without a
valid intent lease") is met only formally; the lease never reflects the actual goal. This is the
remaining P2 increment (with the capability registry) to complete Identity, Continuity & Context.

## Decision

1. **A governed, model-backed `IntentInferenceUnit` (`agent.intent`).** Interpretation runs as a
   cognitive agent implementing the same `CognitiveUnit` ABI as `CurriculumUnit` — governance gate,
   scheduler, OTel span, D3 recording all apply. Model-backed (`{ interpreted_goal, scope, constraints,
   confidence }`) with a deterministic scaffold fallback (`interpreted_goal = goal`, confidence 0.5) so
   offline/seeded runs produce a real, deterministic lease; degradation is visible (`fallback_reason`).
   Mirrors the established curriculum pattern rather than inventing a new mechanism.

2. **`agent.intent` is standard-trust (≥ 1), not elevated.** Interpreting a learner's own goal is
   fundamental to asking and low-risk — unlike `curriculum`/`memory` (≥ 3). Added to the GOV-P01
   `STUDENT_AGENTS` allowlist; an untrusted learner (< 1) is blocked at the same boundary as any dispatch.

3. **The lease is re-interpreted in place (stable `intent_id`).** Inference refreshes the session
   lease's `interpreted_goal`/`scope`/`constraints`/`confidence` while keeping `intent_id` and
   `owner_user_id`. The surface's `session_id` is the `intent_id`; minting a new lease mid-session would
   fork surface identity. Re-asking re-interprets (a new `intent.interpreted` event) — renewal semantics
   applied in place for session stability.

4. **Evented on the canonical bus.** `intent.received` then `intent.interpreted` (the already-registered,
   replayable `intent` family) record what the system believes the learner wants and how confident it is
   — the audit trail against goal-hijacking, and a learner-timeline signal for observability/evolution.

5. **Interpret + bind now; drive curriculum/retrieval later.** This decision deliberately stops at
   producing and binding the lease. Curriculum and context retrieval still key off the raw goal;
   focusing them through `interpreted_goal`/`scope` is a separate refinement so this increment changes no
   existing ask behavior. At the gateway, inference is **best-effort**: a blocked/failed interpretation
   never alters the existing ask-degradation behavior (the cycle's own gates decide).

## Consequences

**Positive:** the intent lease becomes real — goal-derived, confidence-scored, evented, and re-interpreted
each ask; the architecture law is satisfied in substance, not just form; an auditable interpretation trail
exists (anti-hijacking, observability, future evolution of intent parsing); the implementation reuses the
governed model-backed agent pattern (no new mechanism); P2 (Identity, Continuity & Context) is one step
(capability registry) from complete.

**Negative / trade-offs:** the interpreted goal/scope do **not** yet drive curriculum or retrieval (raw
goal still used) — the consumption payoff is a follow-up; no milestone `validate`-gating that can halt a
running cycle (lease is freshly valid each ask); low confidence is recorded but does not yet require
learner confirmation; in-place lease mutation is pragmatic (keeps `session_id` stable) rather than the
spec's strict "new lease per interpretation."

**Neutral:** inference rides the deterministic fallback offline (replay-stable); model path is D3-recorded;
no new event family (the `intent` family was already registered); the demo learner remains the default.
