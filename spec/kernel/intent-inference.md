```yaml
spec:
  title: Intent Inference (Goal → Intent Lease)
  domain: kernel
  status: draft
  owner: kernel-team
  last_reviewed: 2026-06-20
  upstream_dependencies:
    - kernel/intent-lease
    - protocols/model-invocation-protocol
    - product/product-cognition-runtime
  downstream_dependencies:
    - persistence/context-lease-bounded-retrieval
    - product/features/F01-cognitive-onboarding
  related_protocols:
    - intent-lease
    - cognition-packet-protocol
    - model-invocation-protocol
  related_events:
    - intent.received
    - intent.interpreted
  related_runtime_systems: [intent-inference-unit, product-runtime-dispatcher, surface-session]
  related_governance_systems: [governance-kernel]
  related_observability_systems: [cognitive-observability]
  semantic_tags: [intent, inference, goal, lease, interpretation, confidence, governed]
  canonical_references:
    - ../architecture/uci-architecture.md#25-intent-lease
    - architecture-decisions/ADR-0013-intent-inference
```

# Intent Inference (Goal → Intent Lease)

## Purpose

[Intent Lease](./intent-lease.md) defines the lease — a time-bound, revocable, confidence-scored
interpretation of a goal — and names the missing operation: `interpret(user_input) → IntentLease`.
This spec implements that operation. It turns a learner's raw goal ("Teach me Photosynthesis") into a
**structured, confidence-scored intent** (interpreted goal, scope, constraints) and binds it to the
session's intent lease, evented and auditable. It is the P2 increment that makes the intent lease real
instead of a hardcoded placeholder, and the natural sibling of curriculum generation and context
retrieval — all three turn the goal into governed, bounded cognition.

## The gap it closes

Today onboarding stamps every session with a fixed intent lease (`interpreted_goal: "Understand the
requested topic deeply"`, empty scope, confidence 1) regardless of what the learner actually asked. The
lease exists but is inert: it never reflects the goal, its confidence is a constant lie, and nothing
interprets intent. The architecture law — *no long-running cognitive workflow without a valid Intent
Lease* — is satisfied only formally. This spec makes the interpretation real.

## The inference unit

Interpretation runs through an `IntentInferenceUnit` — a governed cognitive agent (`agent.intent`)
implementing the same `CognitiveUnit` ABI as `CurriculumUnit`/`ModelBackedUnit`, so the governance
gate, scheduler admission, OTel span, and D3 recording all apply unchanged. It is **model-backed with a
deterministic scaffold fallback**: a model interprets the goal into
`{ interpreted_goal, scope[], constraints[], confidence }`; on any failure (offline, malformed output,
timeout) it falls back to a deterministic interpretation (`interpreted_goal = goal`, empty scope,
confidence 0.5) so offline/seeded runs still produce a real, deterministic lease — degradation is
visible (lower confidence, `fallback_reason`), never silent.

`agent.intent` is a **standard-trust** agent (trust ≥ 1): interpreting a learner's own goal is
fundamental to asking and low-risk, unlike the elevated `curriculum`/`memory` agents. An untrusted
learner (trust < 1) is blocked at the same boundary as every other dispatch.

## Binding to the lease

The inferred interpretation updates the session's intent lease **in place** — the same `intent_id` and
`owner_user_id` are kept (the surface's `session_id` is the `intent_id`; changing it would fork surface
identity mid-session), while `interpreted_goal`, `scope`, `constraints`, and `confidence` are refreshed.
Re-asking re-interprets (a new `intent.interpreted` event), so the lease tracks the learner's *current*
goal — the renewal/re-interpretation semantics of the lease spec, applied in place for session stability.

## Events

Interpretation emits, on the canonical bus (the `intent` family is replayable):

- `intent.received` — the raw goal arrived (`{ goal, owner_user_id }`).
- `intent.interpreted` — the structured result (`{ intent_id, owner_user_id, interpreted_goal, scope,
  confidence }`).

These join the learner timeline and give governance/observability a clean record of *what the system
believes the learner wants* and how confident it is — the audit trail against goal-hijacking
(a compromised input cannot silently rewrite an active lease; re-interpretation is a new, evented lease
subject to policy).

## What this spec does *not* do (the boundary)

- It **interprets and binds**; it does not yet **drive** curriculum or retrieval *from* the interpreted
  goal/scope (curriculum and context retrieval still key off the raw goal). Using `interpreted_goal` /
  `scope` to focus retrieval and shape the curriculum is a documented next refinement — kept separate so
  this increment changes no existing ask behavior.
- It does not add milestone `validate`-gating that can *halt* a running cycle (the lease is freshly
  valid each ask); enforcing validity at cycle milestones is future work alongside renewal UX.
- Confidence is recorded but does not yet trigger confirmation prompts (future: low-confidence intent
  requires learner confirmation before high-cost steps).

## Governance, observability, determinism

- Inference dispatches through the governance gate (GOV-P01); untrusted learners are blocked exactly as
  for any agent. Interpretation is best-effort at the gateway boundary: a blocked/failed inference never
  upgrades or downgrades the existing ask-degradation behavior (the cycle's own gates still decide).
- The deterministic fallback makes offline interpretation replay-stable; the model path is D3-recorded.
- Emitting/updating the lease is evented; the lease is never silently mutated outside this path.

## Failure modes

- **Model unavailable / malformed / timeout** → deterministic interpretation (`goal` verbatim,
  confidence 0.5, `fallback_reason`), lease still produced.
- **Untrusted learner** → inference blocked at the governance gate; no lease update; the ask degrades
  via the existing path (unchanged).
- **Empty goal** → `interpreted_goal` defaults to a safe placeholder; confidence low.

## Verification

- A goal yields an intent lease whose `interpreted_goal` reflects the goal and whose `confidence` is set
  (model path > fallback); `intent.received` then `intent.interpreted` are emitted.
- The deterministic fallback is exact and offline (same goal ⇒ same interpretation).
- Re-asking re-interprets in place (stable `intent_id`).
- An untrusted learner's inference is blocked; the ask's zero-agent-block degradation is unchanged.
- `pnpm verify` stays green fully offline.
```
