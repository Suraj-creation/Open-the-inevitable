# ADR-0041: The Claim Graph + Cross-Source Contradiction Detection (M9 T2)

**Status:** Accepted
**Date:** 2026-07-16
**Related:** ADR-0040 (Source Fusion + the Claim primitive, M9 T1 — this lights up its dormant
detector), CSE-006 (Living Knowledge — the Claim Graph §3.1, contradiction natures), CSE-015
(Source Fusion — reconciliation reads contradictions), CSE-002 (canonicalization as governed
cognition, the `source.*` family, anchor index), ADR-0032 (canonicalization-as-cognition),
ADR-0037 (MRL as governed cognition — the unit/service pattern this mirrors), ADR-0027 (the
evaluation/judge harness, quarantine threshold), blueprint M9

## Context

M9 T1 (ADR-0040) landed the deterministic fusion core and the **Claim** *type* — but claim
*extraction* is model work, so `detectContradictions` was wired and dormant: it reads cross-source
`contradicts` edges that nothing produces yet, and honestly returns `[]`. Fusion in the product
therefore shows a coverage table but never a disagreement, even when two sources genuinely conflict.

T2 makes the Claim Graph real. CSE-006 §3.1: **"Claims are world-state graph nodes extracted
during layer 5/6 canonicalization,"** and cross-source contradiction detection emits
`source.contradiction.detected { claim_ids[], sources[], nature }` — where **a value or
interpretive disagreement is labeled as such, never presented as a factual one.** This is the
"disagreement is content, not noise" law (Constitution #7) made concrete, and the "living
knowledge" half of milestone M9.

The model-backed source cognition pattern is already proven twice — the M3 `SourceCanonicalizerUnit`
(semantic + citation layers) and the M6 `MeaningRepresentationUnit` (the MRL): a **privileged**
`CognitiveUnit` (it reshapes the shared knowledge graph), model-backed with a deterministic
fallback whose confidence lands *below* the store's degradation floor, grounded at the parser
(ungrounded output is dropped, never guessed), orchestrated by a service that dispatches → records →
binds the world-state graph. T2 follows that pattern exactly.

**Manifestation scope.** Like all model-backed surface cognition (composer / framePlanner /
theater / imagePlanner / sourceEvidence), the Claim Graph is **gateway-on, CLI-off**: it lives in
the shared substrate, is exercised by the gateway `SourceHub` (the website's backend), and is
surfaced in `apps/web`. The CLI manifestation stays on its existing path.

## Decisions

### 1. Claims are world-state graph nodes + `source.claim.recorded` events — not a new layer

A `Claim` (CSE-006 §3.1: statement, grounding anchors, about-concepts, `epistemic_status`, typed
epistemic `edges`) is persisted as a **world-state node** `claim:<version>:<claim_id>` (type
`claim`) with `about` edges to its concept nodes and typed epistemic edges
(`supports`/`contradicts`/`refines`/`supersedes`/…) to other claims — exactly as the MRL persists
`meaning_unit` nodes with `expresses` edges (ADR-0037). The canonical replayable record is the
`source.claim.recorded` event; the world-state node is the queryable structure. No new `SourceLayer`
is introduced — claims are a *graph over* the L5/L6 canonicalization output, not a ninth layer.

### 2. One privileged `claim` agent, two modes: `extract` (per source) and `contrast` (cross source)

`ClaimReasoningUnit` (`@inevitable/product-cognition`; agent `claim`, PRIVILEGED — trust ≥ 3, it
reshapes the shared graph) mirrors the canonicalizer's dual-mode shape:

- **`extract`** — from a source's structural regions (+ the concept vocabulary), extract the claims
  *this source actually makes*, each **grounded** on region anchors and/or concept refs (the parser
  drops hallucinated anchors/concepts and discards a claim left with neither — the same grounding
  law as L2/L7). Deterministic fallback: one `supported` claim per covered concept, stated from the
  source's own definition, no cross edges (honest degraded, never invention).
- **`contrast`** — given claims from *different* sources about *shared* concepts, identify genuine
  **cross-source** contradictions and classify each `nature` (`empirical` | `interpretive` |
  `value`). Deterministic fallback: **none** — honest absence. This is the T1 honesty law
  (`detectContradictions` returns `[]` absent evidence) enforced at the extraction boundary too: a
  fabricated contradiction is worse than a missed one (CSE-006 §2/§6), and same-source pairs are
  never a cross-source contradiction.

One unit, one agent, two modes — the `SourceCanonicalizerUnit` precedent (semantic/citation
discriminated by `layer`), so governance / scheduler admission / OTel / D3 recording all apply
unchanged.

### 3. `ClaimGraphService` orchestrates; the model call is the only non-determinism

`extractClaims(versionId)` dispatches `extract`, records each claim as a world-state node with
`about`/epistemic edges, and emits `source.claim.recorded`. `detectContradictions(versionIds,
conceptRefs)` gathers the already-extracted claims deterministically, dispatches **one** `contrast`
call, writes `contradicts` edges into the Claim Graph, and emits `source.contradiction.detected
{ claim_ids, source_version_ids, nature }`. Orchestration is deterministic and replay-safe; the
model output is D3-recordable exactly as canonicalization is (recorded-before-use).

### 4. Fusion lights up: T1's detector reads real edges; provenance still never blurs

The gateway `SourceHub` gains an optional injected **`ClaimReasoner`** seam (host-wired, with a
`RecordingModelRuntime` on the hub bus, only when a model is available). In `fuse()`, when present,
it extracts each bound source's claims (cached per version) and detects cross-source contradictions,
then passes each concept's contradictions into `reconcileConcept(conceptRef, treatments,
contradictions)` — the T1 signature that already carries them — and attaches the per-concept claim
summaries to the `FusionResult`. Every claim stays traceable to its own source's anchors (fusion
never blurs provenance — CSE-015 §2). **Absent a model the behavior is byte-identical to T1**
(honest absence: no claims, no contradictions), so the T1 gateway test is unchanged.

## Consequences

- The learner sees, in the web Fused view, not just *where sources overlap* but *where they
  genuinely disagree* — each disagreement labeled by nature, each claim anchored to its source. The
  Contradiction Explorer (CSE-009 §5) has its substrate.
- The Claim Graph becomes a queryable world-state structure, unblocking the **Temporal Knowledge
  Model** (CSE-006 §3.3, which reads `supersedes` edges) and the epistemics domain.
- Reuses the M5 SourceHub + anchor index + the M3/M6 unit/service pattern — no new store, no new
  transport, one new agent.

## Deferred (named scope)

- **Frontier Overlays** + the governed web-fetch/refresh research loop (CSE-006 §3.2, needs the F10
  research path + a corpus-access capability envelope).
- The **model-backed fused *explanation* synthesis** (CSE-015 §3.1) and **fusion-as-Scene** with
  `split`/`merge` shots (CSE-012/013).
- The **Temporal Knowledge Model** timeline UI (CSE-006 §3.3) — the graph substrate lands here; the
  Concept Timeline view is a later increment.
- Claim **quarantine by a judge** below a precision floor (CSE-006 §6; shares the ADR-0027 harness —
  T2 records confidence and admits grounded claims; the judge gate is a follow-up).
- The **aggregate self-improving instructional layer** (CSE-006 §7) — blocked on the
  privacy-mechanism ADR (DP vs cohort-minimum), an explicit open question before CSE-P4.
- Gateway model-backed L2/L6 canonicalization cutover (the M2b/M3 gateway cutover) — claim
  extraction at the gateway runs over structural regions + the fusion's target concept vocabulary,
  not a persisted semantic layer; the full cutover stays a named future increment.

## Rejected

- **A deterministic cross-source contradiction detector** (opposing-stance keyword matching): stance
  is inference, and keyword polarity fabricates contradictions from mere emphasis differences — the
  exact failure CSE-006 §3.1 forbids. Contrast is model-backed with honest-absence fallback.
- **Two separate agents** (extractor + contradictor): the canonicalizer already proves one agent
  with a mode discriminator; a second agent adds a manifest + allowlist entry for no separation gain.
- **A `claim` source layer artifact**: claims are a graph over L5/L6, not a per-version layer
  (CSE-006 §3.1 is explicit — "world-state graph nodes"); the `source.claim.recorded` event is the
  replayable record.
- **Blocking fusion on claim extraction**: extraction is best-effort and cached; fusion degrades to
  the T1 coverage view (honest) when a model is absent or extraction fails — never a hard failure.
