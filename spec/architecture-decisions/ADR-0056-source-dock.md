# ADR-0056: The Source Dock — Learner-Facing Source Acquisition

**Status:** Accepted
**Date:** 2026-07-18
**Related:** CSE-017 (the owning experience spec, authored with this ADR), the CSE
production-readiness audit R1 (`spec/research/cse-production-readiness-audit-2026-07.md` §9),
F15 (acquisition product law), ADR-0036 (PDF binary seam), ADR-0052 (governed crawler),
ADR-0055 (durable source plane — the dock's acquisitions now survive restart), CSE-009 §7
(loading that teaches), CSE-002 §4 (progressive canonicalization).

## Context

The audit's severest finding: `POST /api/sources` and `POST /api/sources/crawl` had **zero
callers in `apps/web`** — no file input, drop zone, or URL field existed anywhere in the product.
Everything CSE M1–M10 built (real PDF parsing, the SSRF-governed crawler, code/web/video-
transcript adapters, anchors, the Living Reference) was reachable only by `curl`. The front door
was missing, and no spec owned it. CSE-017 now owns the experience; this ADR records the
implementation decisions.

## Decisions

### 1. Raw-bytes upload, no multipart

The client sends the file's bytes directly as the request body (`file.arrayBuffer()`) to the
existing `POST /api/sources?modality=&title=` route — no `multipart/form-data`, no base64
envelope, no new route. The gateway stays zero-dependency `node:http`; the content hash is
computed over exactly the bytes the learner holds, so the client-side fidelity proof (ADR-0036)
is byte-identical by construction.

### 2. The gateway gains a body-size cap

`readBytes` enforces a 25 MiB cap and answers **413** with a typed error past it — a denial the
dock renders verbatim. Unbounded request buffering was acceptable for dev smoke scripts, not for
a learner-facing upload path.

### 3. Modality is inferred client-side, overridable, and honestly refused

Extension-based inference (CSE-017 §3) chooses the modality; the learner can override before
submitting. Modalities without a registered adapter are refused **at the dock, before any
bytes move** — derived from the known adapter coverage, so the 422 path becomes unreachable from
the product. (The server-side 422 remains as defense in depth for API callers.)

### 4. The registration response is the loading narrative

The dock narrates canonicalization from the pipeline's own output (`layers_available`,
`degraded_layers`, `usable`) — plain-language names for real layers, real degradation flags,
never invented progress copy (CSE-009 §7; Constitution #4). No new streaming channel is
introduced for v1: registration is a single request whose response carries the truth; the
`source.*` deep-transparency read (ADR-0050) remains the operator-grade view.

### 5. Dock acquisitions auto-attach to the acquiring surface

On successful registration the dock immediately binds the version to the current surface through
the existing attach route, emitting `surface.source.attached` onto the canonical log — one
gesture from file to Living Reference. The commons discovery flow (ADR-0053) is unchanged.

## Consequences

- The audit's "no front door" gap closes: a learner can bring a PDF, a URL, code, notes, or a
  transcript entirely in-product; with ADR-0055 those acquisitions survive restart.
- Fusion, claims, contradictions, and the Living Reference stop being curl-only capabilities —
  the ≥2-source Fuse gate is now reachable by a real learner.
- The web bundle takes no new dependencies (native drag-and-drop + `fetch`), preserving the CDL
  performance floor.

## Deferred (named scope)

- **A "my sources" library archetype** (collections, search, cross-surface reuse) — CSE-017 §7.
- **Multi-file / repository ingestion**, **OCR**, **ASR**, and the missing adapters
  (`epub`/`notebook`/`presentation`/`audio`/`dataset`/`image`) — audit R5; the dock's refusal
  list shrinks as each adapter lands, with no dock changes.
- **Streaming canonicalization progress** (live `source.*` events into the dock) — worth doing
  when deep canonicalization becomes slow enough to need it; the response-driven narrative is
  honest today.

## Rejected

- **Multipart or base64 upload envelopes**: adds parsing (a dependency or hand-rolled parser) for
  zero benefit over raw bytes on a single-file route, and breaks hash-over-exact-bytes clarity.
- **A modality dropdown as the primary flow**: asking the learner to classify their file before
  bringing it inverts the burden; inference-with-override keeps the gesture one step.
- **Silently accepting unadaptered modalities** and failing at canonicalize: the audit's "422
  surprise". Refusal happens before upload, in the dock, in plain language.
- **A separate library page as v1**: the dock is a projection on the surface (CSE-008 §2), not a
  destination app; a library is a later archetype once learners have enough sources to manage.
