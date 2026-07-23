# ADR-0043: Frontier Overlays via Governed Web-Grounded Research (M9 Frontier T1)

**Status:** Accepted
**Date:** 2026-07-16
**Related:** CSE-006 §3.2/§4/§6 (Living Knowledge — the Frontier Overlay, governed fetch, staleness),
CSE-006 §2 (the source stays sacred; the frontier is an overlay), ADR-0026 (research-mode readiness
gating — the *when-to-surface* decision, deferred here), ADR-0041/0042 (the Claim Graph + fused
synthesis this stands beside), F10 (research/innovation), F15 (web-ingestion provenance path),
ADR-0032 (source cognition as governed units), blueprint M9

## Context

A source is never studied in isolation from the evolving world around it (CSE-006 §1). A learner who
uploads a classic textbook gets the original preserved as evidence **plus** a living overlay linking
each concept to the current frontier — latest research, open questions, competing theories, future
directions. This is the headline "living knowledge" capability, and the first COS cognition that
reaches **outside** the learner's uploaded sources.

Two laws make it hard and make it honest:

- **The source stays sacred (CSE-006 §2).** Frontier content never edits, annotates over, or
  visually contaminates evidence; it renders in its own reserved provenance channel (`frontier`).
- **No frontier entry without a citable origin (CSE-006 §4/§6).** Every external fact is grounded in
  a real, fetchable source. A model *asserting* a frontier claim from training memory, with an
  invented URL, is the exact failure this forbids — worse than showing no frontier at all.

The second law dictates the architecture: frontier research **must** use real web grounding, not a
model's unaided recall. Gemini's Google Search grounding tool returns generated text **plus real
`groundingMetadata` citations** (fetchable URIs) — that is our governed web-access seam: the fetch
happens inside the provider, and every entry is admitted only if a real citation backs it.

## Decisions

### 1. Web-grounded generation is a first-class, D3-recorded model capability

`ModelGenerationRequest` gains `webSearch?: boolean`; `ModelGenerationResult` gains
`citations?: {uri, title}[]` (both additive — existing calls unaffected). `GeminiModelRuntime`
attaches the `googleSearch` tool when `webSearch` is set (mutually exclusive with `responseSchema` —
grounded calls parse lenient text, not structured JSON) and extracts real citations from
`groundingMetadata`. `NullModelRuntime` returns none. **`RecordingModelRuntime` records and replays
the citations** — the frontier fetch is recorded-before-use exactly like every model call, so replay
shows *the frontier as it was then* (CSE-006 §4 time-travel honesty) and never re-fetches.

### 2. The `FrontierOverlay` primitive — typed, grounded, versioned by time

A `FrontierOverlay` (CSE-006 §3.2) links a concept (in a source's context) to living knowledge: an
`overlay_id`, `concept_ref`, optional `source_version_id`, `entries[]`, and an `as_of` stamp. Each
`FrontierEntry` has a `kind` (latest-research | practice | alternative-explanation | open-question |
competing-theory | interdisciplinary | future-direction), a short `summary`, and **≥1
`external_refs`** (real citations). The grounding law is enforced at the parser: **an entry with no
real citation from the grounding set is dropped**; an overlay with no grounded entry is honestly
empty, never fabricated. Emits `source.frontier.updated { concept_ref, entry_count, as_of, degraded }`.

### 3. Frontier research is a governed unit, on demand, in its own provenance channel

`FrontierResearchUnit` (privileged `frontier` agent — it reaches outside the learner's sources) is
model-backed with web grounding; its deterministic/no-web fallback is **honest empty** (never a
fabricated frontier). `SourceHub.researchFrontier(conceptRef, versionId?)` runs it on demand (like
`fuse` — progressive + attention-driven, not eager corpus-wide), builds the overlay, caches it, and
emits `source.frontier.updated`. `POST /api/surface/:id/frontier { concept_ref }`. The web renders
entries in the reserved `frontier` channel (CDL research state) — visually distinct from source
evidence, each entry a live external link. **Absent a model, the route returns an honest-empty
overlay** (no key ⇒ no frontier, never invented).

## Consequences

- The learner sees, beside a fused concept, where the field is *now* — grounded in real, clickable
  sources — turning study from archival consumption into frontier-aware understanding (CSE-006 §1).
- The COS gains its first governed external-knowledge reach, behind the model adapter, with
  provenance on every entry and D3-recorded fetches (replayable, time-honest).
- Web access stays inside the adapter (Gemini grounding); no vendor/transport leaks past it (§2 law).

## Deferred (named scope)

- **ADR-0026 readiness gating** — the `surface.research.frontier.detected/surfaced/deferred`
  pipeline that decides *when a learner is ready* to see the frontier. T1 produces the overlay
  *substance* on demand; the interruption-budgeted, readiness-gated *surfacing* is the next tier.
- **The frontier as a standing Scene actor** (CSE-006 §5 / CSE-012) — one `explore` interaction away
  in every Scene — and the Cognitive Director raising the horizon into focus (a `researching` state).
- **Budgeted refresh cadence + per-concept volatility scoring** (CSE-006 §4/§8) — T1 fetches on
  demand and caches; the prioritized background refresh loop is later.
- **The full capability-envelope tool-runtime routing** (CSE-006 §4 / P4.2 ToolRuntime) — T1 gates
  via the privileged `frontier` agent and records the fetch; routing every fetch through the granted
  `tool.web-research` envelope is a hardening increment.
- **Claim-graph integration** — promoting frontier entries into `Claim`s with epistemic edges
  (CSE-006 §3.1); T1 keeps overlay entries as their own typed structure.

## Rejected

- **Model-recall frontier without web grounding** (the model writes frontier claims from training
  memory): violates CSE-006 §4/§6 — an invented citation is worse than an empty frontier. Frontier
  entries exist only when a real grounding citation backs them.
- **Frontier content merged into the source view**: violates CSE-006 §2 "the source stays sacred" —
  the frontier is a separate, reserved channel, never an annotation over evidence.
- **Eager whole-corpus frontier refresh**: CSE-006 §4 is progressive + attention-driven — research
  the concept the learner is exploring, on request.
- **Structured-JSON grounded output**: Gemini's search grounding and `responseSchema` are mutually
  exclusive; T1 parses lenient text and admits entries by real citation, not by schema.
