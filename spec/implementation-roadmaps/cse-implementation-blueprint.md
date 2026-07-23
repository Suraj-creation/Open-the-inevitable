# CSE Implementation Blueprint — Phase 0 Validation + Phase 1 Technical Plan

**Status:** active plan (implementation-grade companion to
[`cse-cognitive-theater-and-backend.md`](./cse-cognitive-theater-and-backend.md))
**Owner:** product-architecture
**Last reviewed:** 2026-07-10
**Governs:** the code-level realization of `spec/source-environment/` CSE-001…CSE-016 under
ADR-0032/0033/0034. Current status lives in `IMPLEMENTATION.md`, never here.

---

## Part 0 — Architecture Validation Pass (Phase 0)

Full reread of CSE-001…016, ADR-0032/0033/0034, SRF-001…006, ADR-0007/0024/0025/0027/0030,
memory-tiers, world-state, event-taxonomy, CDL v1/v2/v3. Findings:

**Consistent (verified):** Principle Zero seam (shared L1–L6 / conditioned L7–L8) is used
identically by CSE-002/003/015; anchor grammar is the single reference primitive everywhere
(highlights, sync, episodes, claims, fusion all point through `anchor_ref`); the
decide→record→render pattern is uniform (enrichment, image, shot, directive); layer numbering,
event names, and schema-version claims (surface 1.5.0 → 1.6.0 additive) agree across specs and
indexes; no duplicate ownership found between F15 (acquisition product law) and CSE-002
(representation architecture) — the boundary is `artifact.*` vs `source.*`.

**Resolved during validation (spec-affecting notes, no spec change required):**

1. `source.enrichment.decided` is family `source` but *produced by* the surface-side arbiter —
   legal (family ownership ≠ producer), mirrors `surface.memory.attached` produced by memory
   flows. Registered producer lists stay empty per family-registry convention.
2. The `events` package family registry must gain the `source` family before any `source.*`
   publish (taxonomy law: unregistered family → publish rejected). This is an M1 code task.
3. Anchor "minimum two selectors" (CSE-002 §5.2) is enforced at **creation**, not resolution —
   resolution stays a total pure function over whatever selectors exist (replayed historical
   anchors must always resolve the same way).
4. Canonicalization stages are specced as cognitive units (manifests/leases); M1 ships the engine
   as a **library** with deterministic adapters; unit/manifest/lease wiring lands when the engine
   is dispatched through product-cognition (M3) — consistent with "everything behind interfaces
   first."
5. ViewportPlanner/HighlightPlanner as unit-vs-composer-role stays an open question (CSE-007 §8);
   blueprint plans it as a composer role at M5 (one compose→record→render path), revisit if the
   role bloats.

**No architectural weaknesses requiring spec amendment were found in this pass.** If
implementation reveals one, the rule holds: stop → document → propose → update spec → continue.

---

## Part 1 — Repository Impact Map

### New packages

| Package | Owns | Spec |
|---|---|---|
| `packages/source-environment` (`@inevitable/source-environment`) | Source identity/versions, anchors + resolution + migration, layer artifacts, anchor index, progressive canonicalization engine, modality adapter contract + deterministic reference adapters (markdown/text), `source.*` event emission, fold/replay projection. Later: MRL units, episodes assembly, claim graph, fusion, transformations (each its own module, same package until size forces a split). | CSE-002/003/004/005/006/015 |

### Modified packages / apps (by milestone)

| Where | Change | Milestone |
|---|---|---|
| `packages/events` | `source` family in `DEFAULT_EVENT_FAMILIES` | M1 |
| `packages/adapters` | `supabase.ts`: `SupabaseRestStore` (RelationalStore via PostgREST), `PostgresEventTransport`, `PgVectorStore`, `SupabaseStorageMediaStore` — guarded dynamic import + `fromClient()` seams + conformance | M2 (B0.3) |
| `packages/world-state` | source/concept/claim node+edge vocabulary used via existing free-form types (no code change expected; acyclic config extended if claims need it) | M3+ |
| `packages/product-cognition` | canonicalization units + manifests; MRL selection at teaching time; Director unit (CSE-011) | M3, M6 |
| `packages/surface` | `surface.source.*` fold slices (schema 1.6.0), `source_viewport` MCCR element, viewport/highlight planning seam; scene/director/shot subfamilies later | M5, M7 |
| `apps/api` | `COS_BACKEND=supabase` selection; source upload/media routes; source session binding | M2, M4–M5 |
| `apps/web` | Living Reference projection (source frames, viewports, highlights, sync realization) | M5 |
| `apps/cli` | fixture-source demo flows (offline) | M3+ |
| `supabase/migrations` | `0002_sources` (sources, source_versions, layer_artifacts, anchors, episodes, meaning_units, claims, fusion, creations…) | M2, then per milestone |

### Dependency direction (unchanged law)

```
apps/web → apps/api(gateway) → @inevitable/surface → @inevitable/product-cognition
        → @inevitable/source-environment → @inevitable/{events,world-state,memory,protocols,shared}
adapters implement @inevitable/contracts at the edge; nothing imports a vendor SDK statically.
```

`@inevitable/source-environment` depends only inward (shared/protocols/events); surface and
product-cognition depend on it — never the reverse.

---

## Part 2 — Milestones (small, production-safe, independently verifiable)

Each milestone: spec-first, tests (unit/contract/replay/failure/governance), observability hooks,
`pnpm verify` green, impl-log entry. **A milestone is done only when it feels complete.**

| M | Name | Delivers (maps to user phases / roadmap tracks) |
|---|---|---|
| **M1** | **Foundation primitives** *(this increment)* | `@inevitable/source-environment`: ids, SourceVersion + content-hash identity + supersedes chain, `SourceAnchor` (multi-selector, pure resolution, migration statuses), 8-layer artifact model, anchor index, progressive canonicalization engine + markdown/text reference adapters, `source.*` events (family registered), event-emitting store with state-then-emit, `foldSourceEvents` replay projection. Offline, deterministic. *(user Phase 2 start)* |
| **M2** | **Backend adapters (B0.3)** | `supabase.ts` adapters + conformance + `COS_BACKEND` switch; migration `0002_sources`; live smoke (gated on new creds in `.env`). *(user Phase 3)* |
| **M3** | **Canonicalization as governed cognition** | Units + manifests + leases for layer construction; attention-driven prioritization via scheduler; L2 semantic + L6 citation layers (model-backed, D3-recorded); world-state concept bindings. *(Phase 2 completion)* |
| **M3.5** | **Cognitive Intelligence Persistence & Data Unification** *(ADR-0035; inserted by founder direction — the compounding foundation lands before new modalities produce more evaporating cognition)* | Chronicle fixes (full reasoning traces published, never dropped); Postgres world-state/memory cutover (**absorbs M2b**) + `0003_intelligence` migration + `intelligence.*` family; distiller registry v1 (episode-assembler, understanding-delta, misconception-tracker, intervention-outcome, strategy-outcome, collaboration, consolidation-driver — pulls CSE-005 episode infrastructure forward from M6); backfill-by-replay; RLS/deletion-cascade/opt-out/cohort-minimum governance; plane re-derivation drill. Full plan: `spec/intelligence/CIP-002` §4. |
| **M4** | **PDF modality** | Page-render pipeline sub-ADR; PDF adapter (edge tool, guarded); visual layer + OCR confidence; media route for page renders. *(user Phase 4 start; roadmap CSE-P1)* |
| **M5** | **Source–surface projection** | `surface.source.*` 1.6.0 in SRF-002 + fold slices; `source_viewport` element; viewport plans + semantic highlights + attention contract; web Living Reference realization. *(user Phase 5; CSE-P1 exit)* |
| **M6** | **Meaning + episodes** | MRL v1 units; episodes + understanding deltas + resume cards; Understanding Map v1. *(CSE-P2)* |
| **M7** | **Director + Scene** | CSE-011/012 organs, `surface.director.*`/`surface.scene.*`, affect channel. *(user Phase 6; T1)* |
| **M8** | **Agent society + interaction + cinematography** | Enrichment loop hardening, CSE-014 grammar, CSE-013 shots. *(user Phases 5–7; T2)* |
| **M9** | **Fusion + living knowledge** | Claim graph, frontier overlays, CSE-015 fusion. *(user Phases 8–9; CSE-P4)* |
| **M10** | **Video/web/code modalities** | Temporal layer, concept scrubber, governed media intents. *(CSE-P5)* — **T1 CODE (ADR-0046) + T2 WEB (ADR-0047) + T3 VIDEO (ADR-0048) modalities DONE:** `CodeReferenceAdapter` (constructs → regions), `WebReferenceAdapter` (page HTML → regions, client-supplied), `VideoTranscriptAdapter` (timed transcript → regions **+ the L4 temporal layer**); the whole M1–M9 pipeline works over all three unchanged. All three source modalities complete. Deferred: the governed server-side crawler (web), audio→text transcription + the interactive concept scrubber + governed media intents (video). |
| **M11** | **Creative cognition + research layer completion** | CSE-016, research workspace integration. *(user Phase 10)* |
| **M12** | **Observability + production hardening + E2E** | Deep-transparency surfacing, perf/caching/streaming, full test matrix. *(user Phases 11–13, continuous but formalized)* |

### M1 acceptance criteria (this increment)

- Package builds under strict TS; all tests pass; `pnpm verify` green (26 packages).
- `source.version.registered` / `source.layer.constructed` / `source.layer.degraded` /
  `source.anchor.migrated` publish on the real bus (family registered) with state-then-emit
  ordering.
- Anchor resolution is a pure function: same anchor + same layer artifact ⇒ identical result;
  ≥2-selector rule enforced at creation; selector disagreement ⇒ `unstable`, never a guess.
- Progressive availability: environment reports `usable` after L1+index alone; degraded layers are
  visible, never silent.
- Replay: `foldSourceEvents(bus.log)` ≡ live store projection, byte-deep-equal, run twice.
- Failure rows from CSE-002 §10 that apply at this tier (unknown modality, parse failure,
  low-confidence layer, migration orphan) each have a test.
- Rollback: the package is additive; removing it reverts cleanly (no other package depends on it
  yet except the events family row, which is inert if unused).

---

## Part 3 — Data & storage plan (fed by M2; schema source of truth = `supabase/migrations/`)

`0002_sources` (M2): `sources`, `source_versions` (content_hash unique per source, supersedes),
`layer_artifacts` (versioned, degraded flags, produced_by, model_invocation_refs), `anchors`
(selectors JSONB, granularity, created_by), `anchor_migrations`, `consent_envelopes`. Later
migrations add `meaning_units` (M6), `episodes`/`understanding_deltas` (M6), `claims`/`claim_edges`
(M9), `fusion_concepts` (M9), `creations` (M11), `director_directives`/`scene_deltas` (M7 — via
the events table primarily; tables only where read models need them). All tenant-scoped + RLS,
per ADR-0034 lock 6; bytes in Storage via `content_ref` only.

---

## Part 4 — Standing risks for implementation

| Risk | Mitigation |
|---|---|
| Text-quote anchor ambiguity in repetitive sources | prefix/suffix disambiguation; ambiguous ⇒ selector unresolved (never guess); measured by anchor-stability telemetry |
| Canonicalization cost at book scale | progressive + attention-driven by design (M3 scheduler wiring); budgets enforced by leases |
| Supabase live tests flaking CI | hermetic suite never touches network; live smoke behind env-var gate |
| Package growth (source-environment becoming a god-package) | module-per-spec discipline; split threshold noted at M6 review |
