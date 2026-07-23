# Implementation Roadmap — Cognitive Source Environment, the Cognitive Theater, and the Supabase Backend

**Status:** active plan
**Owner:** product-architecture
**Last reviewed:** 2026-07-10
**Governs:** the phased build of `spec/source-environment/` (CSE-001…CSE-016), the Cognitive
Theater (ADR-0033), and the persistence graduation to Supabase (ADR-0034).
**Read with:** `spec/source-environment/CSE-010-delivery.md` (this roadmap supersedes CSE-010 §3's
phase table with a concrete, backend-aware sequence), ADR-0032/0033/0034, `spec/architecture/Tech-Stack.md`.

> Doctrine: every phase is **spec-first** (specs + indexes updated before code), ships with unit +
> integration + governance + replay + failure tests, keeps `pnpm verify` green, and runs offline
> against the in-memory reference adapters. Supabase is the deployment edge, never a test
> dependency. Current status is tracked in `IMPLEMENTATION.md`, not here.

---

## 0. Sequencing principle

Three tracks interleave, but with a hard rule: **the backend foundation (Track B) lands before the
CSE capabilities that need durable multi-tenant storage, and the Theater (Track C) lands on top of
a working single-modality CSE.** The order below is the actual build order.

```
B0 Backend foundation (Supabase + adapters)   ← unblocks everything durable
      │
CSE-P1 Anchored Reference (one modality, PDF) ← the first real source environment
      │
CSE-P2 Meaning & Episodes                     ← understanding, not just content
      │
T1 Theater core (Director + Scene)            ← the missing conductor + living frames
      │
CSE-P3 Transformations & Practice  +  T2 Cinematography + Interaction
      │
CSE-P4 Living Knowledge & Society  +  Fusion (CSE-015)
      │
CSE-P5 Temporal & Live Modalities (video, web, code)
      │
CSE-P6 Knowledge Universe, Human Sources, Creative Cognition (CSE-016), Aggregate Evolution
      │
Deploy hardening (throughout, formalized here)
```

---

## Track B — Backend Foundation (ADR-0034)

### B0.1 — Provision & connect (agent-driven, gated on credentials)
- User creates a Supabase project + a scoped **personal access token**; we configure the **Supabase
  MCP server** (agent control surface) and the Supabase CLI (`supabase login` run via `!`).
- `supabase/` initialized in-repo: `config.toml`, `migrations/`, `.env`/`.env.local` gitignored.
- Deliverable: agent can run SQL + apply migrations via MCP; `COS_BACKEND` env switch scaffolded in
  `apps/api`.

### B0.2 — Core schema (migrations, RLS from day one)
- Tables: `events` (append-only, HLC-ordered, JSONB payload, family+tenant+correlation indexes),
  `world_state_deltas`, `world_state_nodes`/`edges` (materialized projection), `memory_mutations`
  by tier, `learners` (identity, trust, api_key), `vectors` (pgvector), `media_objects` (Storage
  refs). Every table carries `tenant_id`/`learner_cid`; **RLS policies** enforce learner scope.
- Deliverable: migration set + RLS + a seed migration; schema documented in the ADR-0034 lineage.

### B0.3 — Adapters (behind `@inevitable/contracts`, guarded imports)
- `packages/adapters/src/supabase.ts`: `PostgresEventTransport` (publish=insert, subscribe=`pg_notify`,
  replay=ordered select), `SupabasePostgresStore` (`RelationalStore`), `PgVectorStore`
  (`VectorStore`), `SupabaseStorageMediaStore` (media seam), Postgres-backed `GraphStore` (deltas +
  recursive-CTE queries), Postgres-backed `LearnerRegistry`.
- **Each passes `conformance.ts`** (drop-in for in-memory). Heavy clients dynamic-imported; not in
  any `package.json`.
- `apps/api` selects backend by `COS_BACKEND=supabase|file|memory`.
- Deliverable: gateway runs end-to-end on Supabase; a full session persists and rehydrates from
  Postgres; `pnpm verify` green with in-memory (hermetic) and a separate live smoke test.

**Exit B0:** a live surface session (existing product) runs on Supabase with byte-identical replay,
durable across restart, multi-tenant with RLS.

---

## Track A — CSE Capabilities

### CSE-P1 — Anchored Reference (PDF end-to-end) — needs B0
The first true source environment; proves the Source Anchor and the source–surface seam.
- **Sub-ADR (blocking):** page-render fidelity pipeline (pre-rendered region tiles vs. client
  native render) — CSE-008 §14.
- Source identity/versioning + `source.*` events (CSE-002 §3/§9); L1 (structural) + L3 (visual/OCR)
  layers; **anchor index** with pure-function resolution + redundant selectors (CSE-002 §5);
  Supabase Storage for source bytes.
- `source_viewport` MCCR element; semantic viewport plans + stability laws; semantic highlight
  grammar; the attention contract for PDF (`surface.source.*`, schema 1.5.0 → 1.6.0, CSE-008 §8);
  raw-source toggle; degraded-OCR honesty.
- **Exit:** a learner studies a real PDF inside the surface with narration-synchronized viewports
  and semantic highlights; fully replayable; offline-testable against fixture PDFs.

### CSE-P2 — Meaning & Episodes — needs CSE-P1
- L2 (semantic) + L6 (citation) layers; **MRL v1** (intent, analogy-map, misconception-hypothesis,
  conceptual-compression — CSE-003); episodes + Understanding Deltas + resume cards (CSE-005);
  Understanding Map v1; lens rail.
- Episodes/deltas/annotations persist as Postgres memory mutations (B0 tiers) under RLS.
- **Exit:** resume cards reflect real deltas; "why this analogy?" resolves to a decision trace.

### Inserted: M3.5 — Cognitive Intelligence Persistence (ADR-0035, `spec/intelligence/`)
Between the canonicalization milestone and the PDF modality: the two-plane substrate (chronicle
strengthening + governed distillation into the Intelligence Plane), absorbing the deferred M2b
gateway/world-state/memory Postgres cutover and pulling CSE-005 episode/delta infrastructure
forward. Rationale: every later milestone (PDF, projection, Theater) *produces* exactly the
cognition this plane must catch — building it first ends backfill debt. Plan: CIP-002 §4.

---

## Track C — The Cognitive Theater (ADR-0033) — begins after CSE-P2

### T1 — Director + Scene (the two highest-impact organs)
- **CSE-011 Director:** the nested direction loop (moment→lifetime), the Cognitive Directive,
  `surface.director.*` events, the affective/attention channel (`surface.affect.*`), pacing +
  silence. Wired *above* the Supervisor/FramePlanner as their constraint. FSM pacing first;
  evolution-governed weights only (ADR-0021).
- **CSE-012 Scene:** frames wrapped as living Scenes; actors; the scene-delta evolution channel
  (`surface.scene.*`); lighting. Backward-compatible (a 1.x frame with no scene events folds
  identically).
- **Exit:** the surface paces itself across a lesson (not just a concept), and a frame evolves in
  place under a bounded interaction without a new ask; replay reproduces every directive and scene
  delta.

### T2 — Cinematography + Interaction (with CSE-P3)
- **CSE-013 Cinematography:** the shot vocabulary + selection as an enrichment decision; reduced-
  motion equivalence conformance harness; binds CDL motion + viewport plans.
- **CSE-014 Interaction Grammar:** the ~25 semantic primitives → cognitive intent; extends the
  ADR-0024 command envelope; Attend/Mark/Ask/Reason/Express/Navigate/Govern classes; annotations
  as durable mutations.
- **Exit:** attention is guided by pedagogically-chosen shots; learners act on cognition through
  the full grammar; every shot/interaction is inspectable (CSE-007 transparency).

### CSE-P3 — Transformations & Practice — parallel with T2
- Transformation registry + meaning-preservation contracts (CSE-004); Concept Replay rail as a
  projection over the algebra; worked-example fading + self-explanation console; the Enrichment
  Decision loop wired through the blackboard with full transparency envelopes (CSE-007 §6a).
- **Exit:** every rail node is an honest available/generatable state; fading is governed and
  learner-overridable.

---

### CSE-P4 — Living Knowledge, Society & Fusion — needs CSE-P3 + T1
- Claim Graph; frontier overlays + temporal knowledge model + the **continuous frontier horizon**
  (CSE-006 §5, every lesson exposes known→open); contradiction explorer; **Source Fusion (CSE-015)**
  (`source.fusion.*`, one reconciled environment); agent theater; interruption/attention budget
  enforcement (CSE-007 §6, now spending on motion too); Governance Center completions (real
  forgetting cascade over Postgres + RLS).
- **Sub-ADR (blocking before aggregate features):** aggregation privacy mechanism (DP vs. cohort
  minimums — CSE-006 §8).
- **Exit:** multiple sources fuse into one environment that agrees, disagrees visibly, and connects
  to the frontier — all provenance-channeled; forgetting is a real cascaded deletion.

### CSE-P5 — Temporal & Live Modalities — needs CSE-P1 seam mature
- L4 (temporal) layer; **video** environment (concept scrubber, governed media intents, transcript
  sync — CSE-008 §9); **web** anchoring + re-crawl migration; **code** anchors. Each is a new
  modality adapter (CSE-002 §7) with a deterministic fixture.
- **Exit:** a lecture video is a navigable concept space, paced by the Director, not a timeline.

### CSE-P6 — Universe, Human Sources, Creative Cognition, Aggregate Evolution — long-horizon
- Cross-source **Knowledge Universe** projection (fusion at corpus scale); **human-session
  ingestion** with consent envelopes + redaction cascades (CSE-002 §8, enforced by RLS);
  **Creative Cognition (CSE-016)** (`source.creation.*`, creation-as-capability, the contribution
  loop); **aggregate instructional evolution** (post privacy-mechanism ADR, via the EvolutionEngine
  only).
- **Guard:** must not pull effort from P1–P4; Civilization-scale is directional (CSE-001 §7).

---

## Track D — Deploy & Hardening (continuous, formalized)

- **CDL v3** token landing (per its own governance path) as Theater channels need non-visual tokens.
- Web deploy (Vercel — existing skill); gateway/API host decision (Fly.io / Railway / Supabase Edge
  Functions) at the first public-CSE milestone.
- Production guards extend the ADR-0031/UCS-Recovery posture: strict-model in prod, RLS audits,
  rate limits, cost budgets per learner (the attention/cost economy, CSE-011), backup/retention on
  the Postgres event log.
- Observability: OTel spans on canonicalization + director + fusion; optional Langfuse for model
  traces; the deep-transparency envelope (CSE-007 §6a) surfaced in the Observatory.

---

## Dependency summary (what blocks what)

```
B0 ──▶ CSE-P1 ──▶ CSE-P2 ──▶ T1 ──▶ T2 ──▶ CSE-P4 ──▶ CSE-P5 ──▶ CSE-P6
                         └▶ CSE-P3 ┘
Blocking sub-ADRs: page-render (CSE-P1) · aggregation-privacy (before CSE-P4/P6 aggregate)
CDL v3 tokens: land as T1/T2 require them
```

## Verification bar (every phase)

Unit · integration · **governance** (capability/consent/RLS/redaction) · **replay** (fold
equivalence; no re-invocation) · **failure** (each spec's failure table) — with observability
hooks present before a unit is "cognitive." Offline against fixtures; `pnpm verify` green; Supabase
adapters additionally pass `conformance.ts` and a live smoke test kept out of the hermetic suite.

## Success metrics

Per CSE-010 §4 (capability growth, transfer evidence, episode resolution, time-to-independent-
explanation, research-readiness progression, grounding integrity, agency-exercise rate, silence
health) — plus Theater-specific signals: directive→realization fidelity, pre-emption rate (learner
overrides — healthy agency), shot/interaction transparency-open rate, fusion reconciliation
accuracy.
