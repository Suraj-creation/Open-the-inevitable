---
name: cse-canonical-source-representation
spec:
  id: CSE-002
  title: Canonical Source Representation — Identity, Anchors, and Progressive Canonicalization
  domain: source-environment
  status: draft
  owner: product-architecture
  last_reviewed: 2026-07-09
  upstream_dependencies:
    - source-environment/CSE-001-foundations
    - product/features/F15-content-ingestion-knowledge-substrate
    - world-state/world-state-graph
    - memory/memory-tiers
    - events/event-taxonomy
    - protocols/cognitive-event-protocol
    - protocols/memory-mutation-protocol
    - protocols/model-invocation-protocol
    - kernel/capability-envelope
    - kernel/context-lease
    - kernel/intent-lease
    - architecture/Tech-Stack
  downstream_dependencies:
    - source-environment/CSE-003-meaning-representation-layer
    - source-environment/CSE-004-transformations
    - source-environment/CSE-008-source-surface-projection
    - indexes/event-index
  related_protocols: [cognitive-event-protocol, memory-mutation-protocol, model-invocation-protocol, tool-invocation-protocol]
  related_events: [source.version.registered, source.layer.constructed, source.layer.degraded, source.anchor.migrated, source.canonicalization.prioritized, source.consent.granted, source.consent.revoked, source.redaction.cascaded, artifact.ingested, artifact.parsed]
  related_runtime_systems: [cognitive-unit-runtime, cognitive-scheduler, world-state-graph, memory-tiers]
  related_governance_systems: [governance-kernel, capability-envelope, consent-policy, human-governance]
  related_observability_systems: [cognitive-observability, reasoning-trace, otel-edge]
  semantic_tags: [source-environment, canonicalization, anchors, provenance, versioning, layers, progressive]
  canonical_references:
    - source-environment/CSE-001-foundations#6
    - product/features/F15-content-ingestion-knowledge-substrate#8
    - surface/inline-multimodal-artifacts
---

# CSE-002 — Canonical Source Representation

## 1. Purpose

Defines what every Cognitive Source *becomes* inside the COS: a versioned, content-addressed,
multi-layer, anchor-addressable **Canonical Source Environment**. Downstream systems — surface,
memory, agents, observability, research — always receive this one shape, regardless of whether the
input was a PDF, a lecture video, a website, a codebase, a dataset, or a consented human
conversation. F15 owns the product experience of ingestion; this spec owns the representation,
its construction semantics, and its invariants.

## 2. Philosophy

- **One canonical shape, many modalities.** Nothing downstream ever branches on file type.
- **Progressive, never blocking.** A source is usable the moment its shallowest layer exists.
  Canonicalization is a background cognitive process, prioritized by learner attention — not a
  synchronous upload gate. Waiting is minimized; honesty about what is ready is mandatory.
- **Canonicalization is never finished.** Layers re-enrich as new research arrives, as learner
  interaction reveals emphasis, and as models improve — always as governed, versioned, evented
  re-computation, never silent drift.
- **The Principle Zero seam is structural.** Shared layers (what the source is) are computed once
  per source version and cached for all learners. Learner-conditioned layers (what it does for
  this person) are per-learner projections. Storage, cost, and consistency models differ per side
  and must never be conflated (CSE-001 §2).
- **Bytes never enter the canonical record.** Like SRF-006 media artifacts, raw source content
  lives out-of-band behind a `content_ref`; events and world-state carry references, hashes, and
  derived structures only.

## 3. Primitives

### 3.1 `SourceIdentity` and `SourceVersion`

A **SourceIdentity** is the stable identity of a source across revisions (a book across editions,
a website across crawls, a repo across commits). A **SourceVersion** is one immutable snapshot:

```json
{
  "source_id": "src_...",
  "version_id": "srcv_...",
  "modality": "pdf | epub | web | video | audio | code | notebook | dataset | image | presentation | conversation | human-session",
  "content_ref": "out-of-band ref (media store); never bytes",
  "content_hash": "sha-256 of canonical bytes (content-addressed identity)",
  "provenance": { "origin": "upload | web | api | recording", "attributed_source": "...", "license_class": "...", "consent_ref": "consent envelope id (human sources)" },
  "supersedes": "srcv_... | null",
  "registered_at_hlc": "..."
}
```

Registration emits `source.version.registered`. Re-uploads and re-crawls create new versions;
`supersedes` builds the version chain that powers "what changed since you last opened this"
(CSE-009 resume cards) and anchor migration (§5.4).

### 3.2 The Eight Understanding Layers

Every SourceVersion is modeled across eight layers. Conventional retrieval systems operate almost
entirely on layer 2; CSE builds all eight. Layers 1–6 are **shared**; layers 7–8 are
**learner-conditioned** (computed as shared *candidates* + per-learner selection, see CSE-003).

| # | Layer | Captures | Seam |
|---|---|---|---|
| 1 | **Structural** | Sections, hierarchy, reading order, layout blocks, code modules, dataset schemas | shared |
| 2 | **Semantic** | Concepts, entities, terminology, definitions, topic clusters, prerequisite relations | shared |
| 3 | **Visual** | Figures, diagrams, tables, equations, captions, page-layout regions, OCR text with confidence | shared |
| 4 | **Temporal** | Scenes, topic transitions, speakers, demonstrations (video/audio); historical evolution | shared |
| 5 | **Scientific/Technical** | Proofs, derivations, algorithms, experiments, assumptions, failure cases | shared |
| 6 | **Citation & Provenance** | References, bibliography, lineage, influence, supporting/contradicting work | shared |
| 7 | **Meaning** | Intent, causality, analogy, abstraction ladders, counterfactuals, explanatory frames — CSE-003 | conditioned |
| 8 | **Cognitive** | Learning objectives, difficulty, predicted misconceptions, pedagogical opportunities, mastery binding | conditioned |

Each completed layer is a versioned **SourceLayerArtifact** `{ layer, source_version_id,
artifact_ref, schema_version, confidence, produced_by, model_invocation_refs[] }` and emits
`source.layer.constructed`. Layers 7–8 are what convert *content* understanding into *learner*
understanding; they are the layers absent from conventional document-grounded systems.

### 3.3 `CanonicalSourceEnvironment`

The composite handle downstream systems bind to: `{ source_id, version_id, layers_available[],
anchor_index_ref, concept_bindings[], frontier_overlay_refs[] }`. It is a projection over
world-state and layer artifacts — not a separate store.

A single learner's active *set* of source environments can be reconciled into one **Fused Source
Environment** — concepts merged, contradictions surfaced, gaps named — so the learner inhabits one
understanding rather than a stack of documents. Fusion operates over the anchor index (§5.5) and
Claim Graph (CSE-006) and is specified in **CSE-015 (Source Fusion)**; it produces no new store,
only reconciliation edges in the concept graph.

## 4. Progressive Canonicalization

Canonicalization is a DAG of layer-construction units, not a linear pipeline:

```
Acquisition (F15: artifact.ingested)
  → Native parse (modality adapter)         — required, fast
    → L1 Structural  ──────────────┐
    → L3 Visual (regions, OCR)     ├─→ Anchor index (§5)  → SOURCE IS USABLE
    → L4 Temporal (a/v only)  ─────┘
       → L2 Semantic (concepts, definitions)
          → L6 Citation/Provenance
          → L5 Scientific/Technical           (depth on demand)
          → L7 Meaning candidates (CSE-003)   (attention-prioritized)
             → L8 Cognitive binding (per learner; world-state deltas)
                → Agent activation (CSE-007) → Surface projection (CSE-008)
```

Rules:

1. **Usability threshold.** A source becomes learner-visible when L1 + anchor index exist. Every
   deeper layer arriving later upgrades the environment live (evented, visible in the loading
   narrative — CSE-009 §7).
2. **Attention-driven prioritization.** The cognitive scheduler prioritizes deep canonicalization
   for regions the learner is approaching (current chapter, planned timeline nodes, viewport
   neighborhoods). Emits `source.canonicalization.prioritized { region_anchor, reason }`.
   Whole-book eager deep-canonicalization is explicitly rejected as cost-hostile.
3. **Budgets.** Each run holds an intent lease with a canonicalization budget (tokens, tool calls,
   wall-clock). Exhaustion degrades gracefully (§10), never silently truncates.
4. **Re-enrichment.** New model versions, new research, or learner evidence can trigger governed
   re-computation of a layer → a new SourceLayerArtifact version. Old artifacts are retained for
   replay determinism.

## 5. The Source Anchor

The load-bearing primitive of the entire domain. Everything that points into a source — highlights,
citations, narration bindings, viewports, episodes, claims, frontier overlays, multi-source
alignment — points through an anchor. Raw page numbers, pixel offsets, or timestamps are forbidden
as references (Source Law: **Anchored**).

### 5.1 Schema

```json
{
  "anchor_id": "anc_...",
  "source_version_id": "srcv_...",
  "selectors": [
    { "type": "structural", "path": "ch3/sec2/para14" },
    { "type": "text-quote", "exact": "...", "prefix": "...", "suffix": "..." },
    { "type": "region", "page": 41, "bbox": [x, y, w, h] },
    { "type": "temporal", "start_ms": 754000, "end_ms": 791000 },
    { "type": "code", "path": "src/optim.py", "symbol": "Adam.step", "lines": [120, 164] },
    { "type": "data", "table": "results", "rows": "12-19", "cols": ["loss"] }
  ],
  "granularity": "document | section | paragraph | sentence | phrase | equation | symbol | figure | caption | table | cell | scene | utterance | region",
  "concept_refs": ["concept ids this anchor evidences"],
  "created_by": "cid of producing unit/agent/learner"
}
```

### 5.2 Redundant selectors

Every anchor carries **at least two independent selector types** (W3C Web Annotation–style).
Resolution tries selectors in declared order and records which one resolved; disagreement between
selectors flags the anchor `unstable` rather than guessing silently.

### 5.3 Resolution

`resolve(anchor, source_version) → concrete region | miss` is a **pure function** given the
version's layer artifacts — deterministic, replay-safe, requiring no model call. Anchor creation
may use models (recorded per the model-invocation protocol); anchor resolution never does.

### 5.4 Migration across versions

When a new SourceVersion supersedes an old one, an anchor-migration pass re-resolves anchors
against the new version: `resolved | moved | orphaned`. Emits `source.anchor.migrated { anchor_id,
from_version, to_version, status }`. Orphaned anchors are never deleted — the learner's history
refers to them — they render as "in the previous edition" with the preserved quote.

### 5.5 Anchor index

Per SourceVersion, a queryable index: by concept, by granularity, by region containment, by
selector text. This index is what makes semantic viewports (CSE-008 §4), lens rails, and
multi-source alignment cheap.

## 6. Runtime Semantics

- Canonicalization units are cognitive units (manifest + identity + envelope) invoked via
  cognition packets; long runs hold intent leases; reads of prior layers use context leases.
- All layer construction that invokes models records outputs before use (D3, model-invocation
  protocol). **Replay never re-parses or re-invokes** — it folds recorded events and artifacts.
- Shared layers are keyed by `content_hash`: two learners uploading the same edition share all
  shared-layer work (a collective-efficiency dividend that must never leak learner data — only
  content-derived artifacts are shared).

## 7. Adapters & Determinism

Per the eight-contract seam (`spec/architecture/Tech-Stack.md`): parsers, OCR, transcription,
crawlers, and renderers are **ToolRuntime** invocations behind capability envelopes; extraction
and layer synthesis use **ModelRuntime**; source bytes live in the media store (same seam as
SRF-006). No parser SDK, crawler, or PDF library becomes a substrate dependency. Every modality
adapter ships a deterministic in-memory reference implementation (synthetic fixture sources) so
the full CSE stack runs offline and its tests are hermetic.

> **Implemented modalities:** markdown + plain text (M1), PDF (M4/ADR-0036, binary seam),
> **code (M10 T1/ADR-0046)**, **web (M10 T2/ADR-0047)**, and **video (M10 T3/ADR-0048)** —
> `VideoTranscriptAdapter` turns a timed transcript (WebVTT/SRT/JSON) into structural regions **plus
> the L4 `temporal` layer** (per-region timecodes) — the first implementation of the declared-but-empty
> temporal layer, and the substrate for the concept scrubber. All flow through the entire pipeline
> unchanged (video adds the time dimension). Deferred: the **governed server-side crawler** (web URL
> fetch behind a capability envelope) and **audio→text transcription** + the interactive concept
> scrubber + governed media intents (video).

## 8. Human Beings as Cognitive Sources

People — mentors, professors, peers, communities — can become Cognitive Sources with the same
canonical treatment as documents (office-hours recordings, lab-meeting transcripts, discussion
threads, live conversations), under strictly stronger governance:

1. **Never auto-ingested.** Every human-session ingestion requires an explicit **Consent
   Envelope**: `{ consent_ref, participants[{person_ref, scope, granted_at, expires}], capture
   scope, retention, shareability }`. Emits `source.consent.granted`.
2. **Multi-party sessions require all-party consent** for ingestion. A session with N speakers
   ingests only when every identified participant has granted scope; unidentified speakers force
   `scope: excluded` for their utterances (utterance-granularity anchors make this enforceable).
3. **Revocation cascades.** `source.consent.revoked` triggers a **redaction cascade**: every
   derived artifact, anchor, annotation, episode fragment, and memory mutation referencing the
   revoked scope is redacted through typed redaction mutations. Emits
   `source.redaction.cascaded { consent_ref, redacted_counts }`. This is real deletion semantics,
   not a soft hide.
4. Human-source anchors are utterance/segment-granular and always carry the speaker's consent
   scope; grounded claims may only cite consented segments.

> **Implementation status — consent grant + revoke → redaction cascade landed at ADR-0054** (over the
> ADR-0051 contribution path first; human-session ingestion still deferred). A `ConsentEnvelope`
> (`consent_ref`, `source_version_id`, `learner_cid`, `scope`, `granted_at`, `status`, `revoked_at`)
> is created on contribution (emits `source.consent.granted`); `revokeContribution` flips it to
> `revoked` (emits `source.consent.revoked`) and **cascades a redaction**: delist from the commons,
> withhold bytes (the content route returns **410 Gone**), block any new attach/fuse, clear the
> creation's `contributed_as` — emitting `source.redaction.cascaded { consent_ref, redacted_counts }`.
> Redaction withdraws content + reachability while preserving the version's **identity** (replay-safe).
> **Deferred:** multi-party all-party consent + utterance-granular human-session ingestion (§8.2/§8.4);
> retroactive retraction of already-taught downstream copies; durable envelope persistence; partial
> (region/claim-level) redaction. Full detail: ADR-0054.

## 9. Event Family — `source.*`

Family registration (event-taxonomy format): owner `source-environment`, retention `permanent`,
replay `replayable`, classification `internal`; producers: canonicalization units, anchor index,
consent registry; consumers: surface, memory, observability, research.

| Event | Emitted when | Payload core |
|---|---|---|
| `source.version.registered` | snapshot registered | source_id, version_id, modality, content_hash, supersedes? |
| `source.layer.constructed` | a layer artifact completed | version_id, layer, artifact_ref, confidence, produced_by |
| `source.layer.degraded` | a layer completed below quality floor or partially | version_id, layer, reason, affected_anchor_ids[]? |
| `source.canonicalization.prioritized` | scheduler re-prioritized deep work | version_id, region_anchor, reason |
| `source.anchor.migrated` | anchor re-resolved across versions | anchor_id, from_version, to_version, status |
| `source.consent.granted` / `source.consent.revoked` | consent envelope lifecycle | consent_ref, scope summary |
| `source.redaction.cascaded` | revocation cascade completed | consent_ref, redacted_counts |

Acquisition-side events (`artifact.ingested`, `artifact.parsed`, `artifact.rejected`,
`source.attributed`, `provenance.recorded`, `ingestion.conflict.*`) remain owned by F15 and
precede this family. Surface-side projection events are `surface.source.*` (CSE-008 §8).

## 10. Failure Semantics

| Failure | Behavior |
|---|---|
| Parse fails entirely | Preserve raw artifact (if allowed), emit `artifact.rejected`, offer alternate format — never a blank success |
| OCR/vision below confidence floor | Layer lands as `source.layer.degraded`; affected regions render as faithful images with a visible confidence badge; grounded claims cannot cite degraded-only regions |
| A layer times out / exceeds budget | Environment stays usable at completed layers; degraded layer queued for retry under a fresh lease; loading narrative states what's missing |
| Anchor resolution miss | Anchor marked `unstable`/`orphaned`; UI shows preserved quote, never a wrong region; miss is evented |
| Web source changed upstream | New version registered on re-crawl; anchors migrate; diffs surface as "changed since last visit" — old version remains replayable |
| Consent revoked mid-session | Session continues without revoked content; cascade runs asynchronously; completion is evented and auditable |

Degradation is always **honest and visible** (Constitution #4): the environment states plainly
what could and couldn't be processed.

## 11. Observability & Testing

> **Implementation status — deep-transparency surfacing landed at M12 T1 (ADR-0050).** The `source.*`
> cognition log (this family) plus the D3 `model.output.recorded` events are folded by the pure
> `foldSourceCognition(events)` projection into a `SourceCognitionState` (activity counts per
> cognition family, per-layer confidence + degraded flag, D3 model-invocation/fallback counts, and
> recent provenance-bearing entries), exposed host-level at `GET /api/sources/cognition` and rendered
> as the web **Source Cognition** transparency panel. This makes the source plane's reasoning
> observable per the §2 observability invariant. M12 T2 added fusion memoization (keyed by the
> immutable source-version + concept set — a hit re-emits nothing, so caching never changes replay
> output) and surfaces the **cache-hit rate** (this doc's named telemetry) via `SourceCacheStats` in
> the same read; streaming/backpressure remain deferred. The formalized failure/replay/governance test
> matrix landed at M12 T3 (see §11 below).

- Every canonicalization unit emits reasoning traces (why this structure, why this concept
  extraction, why this confidence).
- Telemetry: layer latency and cost per modality, anchor stability rate, OCR confidence
  distribution, degraded-layer rate, shared-layer cache hit rate, prioritization responsiveness.
- Tests required before `accepted`: unit (selectors, resolution purity, version chains), contract
  (layer artifact schemas, event payloads), replay (fold equivalence with no re-parsing), failure
  (each row of §10), governance (consent cascade completeness — zero surviving references).

> **Implementation status — the CSE test matrix landed at M12 T3 (ADR-0050).** Substrate tier
> (source-environment): unit (anchor resolution purity + selector disagreement + refuse-to-guess),
> identity/version-chains, replay (`foldSourceEvents` + `foldSourceCognition` fold-equivalence),
> failure (unknown modality `E_SOURCE_MODALITY_UNSUPPORTED`, empty parse `E_SOURCE_PARSE_EMPTY`,
> low-confidence layer → `source.layer.degraded`, anchor miss/unstable/orphaned + evented),
> governance (consent-required modality gate `E_SOURCE_CONSENT_REQUIRED`). Gateway tier (apps/api):
> the **full E2E happy path** (register → attach → teach → fuse → frontier → timeline → create →
> transparency) and the **failure boundary** (every CSE route returns a typed error, never a blank
> success). Not yet built: the consent-revocation **cascade / redaction** lifecycle
> (`source.consent.revoked` / `source.redaction.cascaded`) — only the registration gate exists; the
> cascade is a named later increment (a feature, not a test gap).

## 12. Open Questions

- Canonical cross-modality granularity vocabulary: is the §5.1 `granularity` enum sufficient for
  CAD, medical imaging, and future spatial media, or does it need a per-modality extension point?
- Layer-artifact storage: world-state graph nodes vs. object-store artifacts per layer — likely
  split by size; needs an implementation-phase decision recorded against ADR-0032.
- Copyright/license classes and their capability-envelope encoding (shared with F15 open question).
- Anchor stability targets per modality (web is the hard case) — thresholds need real data.
