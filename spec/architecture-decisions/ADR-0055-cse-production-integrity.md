# ADR-0055: CSE Production Integrity Pass (Audit R0)

**Status:** Accepted
**Date:** 2026-07-18
**Related:** the CSE production-readiness audit
(`spec/research/cse-production-readiness-audit-2026-07.md`) whose R0 phase this ADR is; ADR-0008
(durable persistence pattern this extends), ADR-0035 (intelligence distillation this makes
reachable), ADR-0051/0053/0054 (contribution / commons / consent — made durable here), ADR-0031
(precedent: one ADR for a multi-item hardening pass), CSE-002 §3.1 (content-addressed identity),
SRF-002 (frame event payloads), DPS-001/002 (file persistence + rehydration).

## Context

The 2026-07-18 audit established that the CSE substrate is real but five integrity gaps break the
product's own promises in any production topology: (1) the **entire source plane is
process-lifetime** — sources, canonical bytes, the knowledge commons, consent envelopes, and the
redaction set all evaporate on restart, so a learner's *revocation* is forgotten (the 410-Gone
guarantee of ADR-0054 degrades to a 404) and rehydrated surfaces 404 their Living Reference;
(2) the web app **never sends `close`**, so intelligence distillation (ADR-0035) never runs for
web learners — episodes, understanding deltas, and resume cards are permanently starved;
(3) `contributeCreation` binds its new source **without emitting `surface.source.attached`**, so
the client fold (and the Fuse gate) disagree with the server about what sources exist — a
state-changed-without-its-event violation; (4) pedagogically load-bearing practice semantics hang
off a **`title.startsWith("practice")` string heuristic** duplicated in five places; (5) creation
drafts live only in client React state and an in-memory server map.

These are integrity fixes, not features: the product must keep the promises its UI already makes
("Revoke & redact", "others can now cite your work", "finish a session to distill") before any
new capability lands on top.

## Decisions

### 1. The source plane becomes durable under `COS_PERSIST_DIR` (the DPS pattern)

A `SourcePlanePersistence` (pure `node:fs`, zero new dependencies — the ADR-0008 pattern) owns
`<dir>/sources/`: a `catalog.json` (written atomically: tmp + rename) holding registered versions
(ids, modality, title, hash, content_ref, provenance), the commons catalog, consent envelopes,
the redaction set, and creations (drafts + assists); canonical bytes live content-addressed at
`<dir>/sources/bytes/<content_hash>.bin`. The `SourceHub` persists best-effort after every
mutation and **rehydrates at host startup**: each persisted version replays through the same M1
`registerVersion → canonicalize` pipeline, then commons/consent/redaction/creation state is
restored. A redacted version's bytes are deleted from disk at redaction time — the withholding
itself is durable, and the content route still answers **410 Gone** after a deploy. This
discharges ADR-0054's named deferral ("durable persistence of envelopes") in the file plane;
the Postgres/Supabase plane remains the M2 path when configured.

### 2. Version identity is rehydration-stable: explicit ids on `registerVersion`

`RegisterVersionInput` gains an optional `version_id` (mirroring the existing optional
`source_id`): rehydration replays registration **with the persisted ids**, so every durable
reference — `surface.source.attached` events in surface logs, commons entries, consent
envelopes, anchors — resolves identically after restart. This is the minimal change consistent
with CSE-002 §3.1 (the *hash* is the identity; the id is its stable name): same content, same
ids, across processes. Fresh registrations keep generator-minted ids exactly as today.

### 3. Rehydrated surfaces rebind their sources from their own event log

`GatewayHost.rehydrate` stops resetting `sourceBindings` to empty: bindings are derived by
folding the surface's persisted events (`state.sources`) and filtering to versions the rehydrated
hub still serves. A restored surface's Living Reference, evidence seam, and Fuse gate work again
— no re-attach ritual.

### 4. The web closes its session; distillation fires for web learners

The web app sends `{type:"close", reason:"learner-left"}` on `pagehide` via
`fetch(..., {keepalive: true})` — **not** `navigator.sendBeacon`, because the command channel is
a JSON POST and beacons cannot carry headers; keepalive fetches survive page dismissal and can.
`pagehide` (not `visibilitychange`) is the trigger: tab-switching must never close a live lesson.
At most one close fires per surface. This makes ADR-0035's episode/delta/resume-card loop real
for the product's only actual client.

### 5. Contribution emits its attach event

`contributeCreation` binds the contributed source through the same `attachSource` path every
other binding uses, so `surface.source.attached` lands on the canonical log and the client fold
agrees with the server (the Fuse gate sees the contributed source). State never changes without
its event.

### 6. Frames carry a typed `kind`; title heuristics become fallback

Frame payloads gain an additive, optional `kind: "teach" | "practice" | "assessment" |
"checkpoint"` set at every frame-creation site. All consumers (the session's own practice lookup
and grading join, the web's answer affordance, transport labels, and deck export) read `kind`
first and fall back to the title heuristic **only for pre-1.7.0 logs** (replay compatibility).
SRF-002 records schema 1.7.0 (additive). A retitled frame can no longer silently lose its answer
affordance.

## Consequences

- The consent lifecycle (grant → revoke → redaction) survives restart end to end — the
  ethically load-bearing gap is closed; the commons and every registered source are durable.
- A learner who closes the tab and returns gets a resume card; the Understanding Map fills for
  pure-web learners; the intelligence plane receives what it was built to receive.
- Replay equivalence is strengthened, not weakened: rehydration replays the same pipeline with
  the same ids; the attach event restores fold/server agreement; `kind` is additive and folded.
- The gateway remains zero-dependency (`node:fs` only); in-memory stays the offline default and
  the reference semantics — nothing changes when `COS_PERSIST_DIR` is unset.

## Deferred (named scope)

- **Supabase-first source-plane persistence** (M2/ADR-0034 plane) — the file plane is the floor;
  the eight-contract seam is unchanged, so the cutover is additive.
- **Server-side idle-close** (closing abandoned sessions without a `pagehide`) — requires a
  liveness policy; the client-close covers the dominant path.
- **Retroactive downstream redaction** (unchanged from ADR-0054).
- **Client draft autosave** (creation drafts now survive server restarts via the catalog; a
  keystroke-level client autosave is UX polish, not integrity).

## Rejected

- **An alias map translating re-minted version ids** at the hub boundary: leaks aliasing into
  every consumer and breaks the "the hash is the identity" law. Explicit ids on replay are
  smaller and honest.
- **`navigator.sendBeacon` for close**: cannot carry `Content-Type: application/json` reliably
  nor auth headers; keepalive fetch is the standards-track equivalent that can.
- **`visibilitychange` as the close trigger**: fires on every tab switch — closing a live lesson
  because the learner glanced at another tab is hostile. `pagehide` only.
- **Deriving practice-ness from `archetype`**: practice frames share `example-led` with ordinary
  frames; overloading it would trade one implicit signal for another. An explicit `kind` is the
  contract the fold and clients can rely on.
