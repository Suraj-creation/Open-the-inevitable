# CSE-017 — The Source Dock: the acquisition experience

**Status:** draft · **Owns:** the learner-facing acquisition of Cognitive Sources — upload,
crawl, paste, the honest canonicalization narrative, attach, and honest refusal.
**Upstream law:** CSE-001 (Principle Zero, the Constitution, the Source Laws), CSE-002
(canonical representation, progressive canonicalization, provenance, consent), F15 (acquisition
product law — events), CSE-008 §2 (projection, not panels), CSE-009 §7 (loading that teaches),
the CDL (`spec/design/`). **Adopted by:** ADR-0056.

## 1. Why this spec exists

The 2026-07 production audit (`spec/research/cse-production-readiness-audit-2026-07.md`) found
that the single most upstream learner action — getting a source into the system — had **no owning
experience spec**: F15 specifies acquisition *events*, the founding draft's Source Library was
superseded without replacement, and CSE-009 carries no upload archetype. The result was a fully
built acquisition substrate (`POST /api/sources`, the governed crawler, five modality adapters)
with zero learner affordances. This spec owns that seam. It is deliberately small: the dock is a
door, not a destination.

## 2. The archetype

**Purpose.** Any artifact the learner brings becomes a Cognitive Source of this surface — in one
gesture, with the system's understanding of it narrated honestly while it forms.

**Substrate.** `POST /api/sources` (raw bytes; modality + title as query params), `POST
/api/sources/crawl` (governed URL fetch, ADR-0052), `POST /api/surface/:id/sources` (bind), the
registration summary (`layers_available`, `degraded_layers`, `usable`) as the narrative's ground
truth, and the `source.*` family for deep transparency. The dock introduces **no new events and
no new routes** — it is a pure client of the existing substrate.

**Placement.** A projection on the surface (CSE-008 §2: projection, not a separate "library
app"): one always-visible affordance in the surface chrome ("＋ Source"), plus the empty-state
invitation — when a surface has no sources bound, the surface itself offers the dock ("bring a
book, a paper, a page, code — I'll learn it with you"). Layout remains a client concern (D5).

## 3. Affordances (normative)

1. **File** — drag-and-drop anywhere on the open dock, or a file picker. Modality is inferred,
   never asked first: `.pdf → pdf` (bytes), `.md → markdown`, `.txt → text`, code extensions
   (`.js .ts .tsx .jsx .py .rs .go .java .c .cpp .h .rb .swift .kt`) → `code`, `.vtt/.srt` →
   `video` (timed transcript), `.html/.htm` → `web`. The learner may override the inference
   before confirming.
2. **URL** — a paste field. Submission goes to the governed crawl; a policy denial (SSRF gate)
   surfaces the gateway's own explanation verbatim — the refusal is the feature.
3. **Paste** — a text area with an explicit modality choice (`markdown | text | code |
   video-transcript`) for content the learner already holds.
4. **Attach-on-success is automatic.** A source registered from a surface's dock binds to that
   surface immediately — the Living Reference appears without a second gesture. (The commons
   attach flow, ADR-0053, is unchanged and remains the discovery path.)

## 4. The honest loading narrative (CSE-009 §7 made real)

Waiting teaches. From the moment content is submitted, the dock narrates real stages, never a
spinner: *"Reading the document…"* (upload in flight), then — from the registration response,
which is the pipeline's true output, never invented copy — each constructed layer named in plain
language (structural map, anchor index, …), each degraded layer flagged exactly as the pipeline
flagged it (*"the scanned figure on one page couldn't be read reliably — shown as image only"*),
and the usability verdict (*"usable now; deeper understanding keeps forming as you read"* —
progressive canonicalization, CSE-002 §4). Failure states show the gateway's typed error message,
never a generic toast.

## 5. Honest refusal (Constitution #4)

Modalities the substrate accepts by name but cannot yet canonicalize (`epub`, `notebook`,
`presentation`, `audio`, `dataset`, `image`, `docx`) are **refused at the dock, before upload**,
listed as "not yet understood" with the nearest working path (e.g. "export the PDF"). A learner
must never discover a gap via a 422. The refusal list is derived from the adapter registry's
actual coverage, not hardcoded promises.

## 6. Consent and provenance

Dock uploads carry `origin: "upload"` provenance with the filename/URL as `attributed_source`
(CSE-002 §3.1). Consent-required modalities (`conversation`, `human-session`, CSE-002 §8) are not
dock-acquirable in v1 — they arrive only through their own consent-enveloped flows. Nothing the
dock acquires is shared: a dock source is private to the learner's surface unless later
contributed through the ADR-0051/0053 consent gate.

## 7. Non-goals (v1)

- **Library management** — collections, folders, search across a learner's sources. The dock
  acquires and binds; a "my sources" library is a later archetype.
- **Multi-file ingestion** — repositories, zips, multi-document drops. One artifact per gesture.
- **Server-side format conversion** — no docx→pdf, no OCR, no ASR; the honest-refusal path
  covers these until their adapters exist (audit R5).
- **Upload for consent-required human modalities** (§6).

## 8. Verification bar

A learner with no tooling beyond the browser: drags a textbook-chapter PDF onto the dock, reads
a true narrative of the system understanding it, sees the Living Reference appear beside the
board, and the next taught frame carries that source's evidence — zero curl, zero docs. Denials
(oversized file, unsupported modality, SSRF-blocked URL) each read as a specific, honest
sentence. Covered by web unit tests (inference, refusal, success flow) and a gateway test for the
byte-upload roundtrip.
