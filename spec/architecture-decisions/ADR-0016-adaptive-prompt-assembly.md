# ADR-0016 — Adaptive Prompt Assembly: F04 Layers 2–6, Concept Layer, Assembled Context

**Date:** 2026-06-20
**Status:** Accepted
**Spec:** spec/product/features/F04-adaptive-multimodal-explanation.md
**Phase:** P3.2

## Context

The `ModelBackedUnit` (F04 explanation engine) currently produces only layers 0-1:
- Layer 0 — Intuition & Story
- Layer 1 — Visual Understanding

Layers 2-6 are specced in F04 but not implemented:
- Layer 2 — Conceptual Definition
- Layer 3 — Mathematical Framework
- Layer 4 — Applied Implementation
- Layer 5 — Advanced Extensions
- Layer 6 — Research Frontier

Additionally, two P2 deliverables were deliberately deferred into P3:
- **Assembled context (P2.4)** — `assembleContext()` returns a `WorkingMemoryContext` with relevant
  prior knowledge items, but nothing threads it into the explanation prompt.
- **Interpreted intent (P2.5)** — `inferIntent()` updates `session.intentLease.interpreted_goal`,
  which reaches the explanation unit as `packet.intent` (already present) — this boundary is
  consumed without additional changes.

## Decisions

### 1. Output schema extends to optional layers 2–6.

`ModelLayeredOutput.layers` gains optional fields `layer_2` through `layer_6`. The JSON Schema
for model responses makes them optional. `parseModelLayeredOutput` accepts whatever layers the
model returns. The response packet's `content.layers` carries all populated layers to the surface
block renderer. Existing tests using `layer_0`/`layer_1`-only output are unaffected.

### 2. Target layer = max(requestedLayer, conceptNaturalLayer).

Each concept node in the KG has a `layer` prop (seeded by `KnowledgeGraphEngine.seedConcepts`).
This is the concept's *natural depth* — the depth at which a fully correct explanation lives.
A pure-math concept (e.g. gradient descent) has natural layer 3; an applied framework (e.g.
neural networks architecture) might be layer 2 or 4.

The target explanation depth is `max(requestedLayer, conceptNaturalLayer)`. This means:
- A concept with natural layer 3 always includes layers 0–3, even if the learner didn't explicitly
  ask for depth.
- A learner asking for deeper (requestedLayer=4 on a layer-3 concept) gets layers 0–4.
- Practice and assessment agents stay at layer 0 (appropriate for their role).

**Rejected alternative:** Always produce all 7 layers. This wastes tokens for simple intuition-
level concepts and inflates responses for practice/assessment roles where depth doesn't help.

### 3. Assembled context threads via packet.content.assembled_context_items.

`WorkingMemoryContext.items` are serialized as plain `{text, score}` objects and threaded
through: `FiberedLearningLoopInput.assembledContextItems` → `handleDispatch` content injection →
`CognitionPacket.content.assembled_context_items` → `ModelBackedUnit.buildRequest`.

Plain `{text, score}` objects avoid a `@inevitable/context` dependency inside `product-cognition`
or `surface` (these packages must not depend on adapter-tier packages). The calling layer
(`wiring.ts`, `host.ts`) owns the impedance match.

`SurfaceAskInput` carries `assembledContextItems` for callers that want to pass assembled context
into the learning cycle. It is optional and always backward-compatible.

**Rejected alternative:** Have `ModelBackedUnit` inject `TieredMemoryStore` and read working
memory directly. This would create a second data-path into the unit (the packet is the canonical
input) and make testing harder (requires seeding the store, not just the packet).

### 4. Assembled context appears in the prompt as "prior knowledge — build on, don't re-explain."

The model is instructed not to re-explain what the learner already knows, but to assume it and
build on it. This operationalizes the P2.4 context lease bound semantically: the lease decided
*what* to include; the prompt decides *how* to use it.

### 5. Token budget scales with target layer.

`maxTokens = max(1024, 512 × (targetLayer + 1))`. A 7-layer response (layer 0–6) may need
3584 tokens; a 1-layer response (layer 0 only) needs 1024. This is bounded and proportional.

### 6. Practice and assessment remain layer 0 only.

Layer depth is an explanation-domain concept. Practice generates one well-formed task; assessment
generates one mastery-probing question. Embedding mathematical derivations in a practice problem
adds noise, not depth. The `targetLayer` calculation applies only when `role === "explanation"`.

## Consequences

- **Positive:** The assembled working memory (P2.4) and interpreted intent (P2.5) are now
  consumed in agent prompts — closing the deferred boundary from P2.
- **Positive:** The KG engine's concept-layer metadata (P3.1) directly feeds explanation depth
  without any additional wiring.
- **Positive:** Existing tests (layer_0/layer_1 only) are unchanged — backward-compatible.
- **Tradeoff:** Token usage scales up for high-layer concepts. Bounded by `512 × 7 = 3584`,
  well within model context limits.
- **Tradeoff:** The model must produce valid JSON for up to 7 fields. The fallback path
  (deterministic scaffold) still only produces layer_0, keeping degradation graceful.
