# ADR-0046: The Code Modality (M10 T1)

**Status:** Accepted
**Date:** 2026-07-17
**Related:** CSE-002 §3.2/§4/§7 (canonical representation, the modality adapter seam), ADR-0032
(the CSE substrate), ADR-0036 (the PDF/binary modality seam — the precedent for a new modality),
CSE-001 (modalities), blueprint M10 (video/web/code modalities)

## Context

M1–M9 built the Cognitive Source Environment over text modalities (markdown, plain text) and the
PDF binary modality (M4/ADR-0036), then a whole living-knowledge layer on top (fusion, claims,
synthesis, frontier, timeline). Every one of those capabilities is modality-agnostic: they operate
over the **structural layer** (anchor-addressable regions) that a `ModalityAdapter` produces. M10
opens new modalities; **code** is the first, because it is the most tractable proof of the
modality-extension seam:

- Code is **text** — no external fetch, no binary decode, no transcription. It arrives uploaded like
  markdown, so it needs only a `parse(content) → ParsedSource` adapter (the M1 seam), not the
  binary/edge machinery PDF needed.
- Code has **real structure** — top-level constructs (functions, classes, interfaces, defs) are
  natural, meaningful regions to anchor, teach, fuse, and research over.
- It is **deterministic** — a heuristic structural parse is a pure function of the bytes, so the
  whole stack stays replay-safe and testable offline.

Video and web are the harder M10 members (temporal layer + concept scrubber for video; governed
web-fetch + HTML extraction for web); they are deferred within M10.

## Decisions

### 1. Code is a text modality behind the existing `parse` seam — no pipeline changes downstream

`CodeReferenceAdapter` (`packages/source-environment/reference-adapters.ts`; modality `code`, already
in `SOURCE_MODALITIES`) implements `parse(content) → ParsedSource`, producing a structural layer of
anchor-addressable regions. Because canonicalization, the anchor index, `evidenceFor`, viewport
projection, fusion, claims, synthesis, frontier, and timeline all operate over the structural layer,
**nothing downstream changes** — a code source flows through the entire M1–M9 pipeline unmodified.
This is the point: the modality seam was designed for exactly this, and code proves it.

### 2. Structural parse: top-level constructs → heading (signature) + code body, deterministically

`splitCodeBlocks` scans lines and treats a **column-0 declaration** (a line matching a
language-agnostic construct regex — `function`/`class`/`interface`/`type`/`enum`/`def`/`struct`/
`impl`/`fn`/`func`/`module`/`namespace`/exported `const|let|var`, across TS/JS/Python/Go/Rust/Java-
family) as a construct boundary. Each construct becomes a **heading region** (the signature line, so
it nests + labels like a markdown heading) followed by a **code region** (the body until the next
column-0 construct). A leading **preamble** region captures imports/license headers. Paths reuse the
markdown `assignPaths` nesting (`h1-<n>` for the signature, `h1-<n>/code-<k>` for the body), so the
same file always yields a byte-identical structural layer. Nested constructs (a method inside a
class) stay within the class body in T1 — a nested-region refinement is deferred; the class is one
anchor-addressable region with its methods inside, which is honest, not wrong.

### 3. Honest degradation, never a fabricated parse

The heuristic is language-agnostic and imperfect by design: a file with no recognizable construct
folds to a single preamble region (the whole file) — usable, honestly coarse, never dropped. Empty
content is refused (`E_SOURCE_PARSE_EMPTY`, the M1 guard). No AST, no per-language dependency — a
real parser per language is a later refinement; the heuristic produces real, anchorable regions now.

## Consequences

- A learner can upload a codebase file and get the full CSE experience over it: concepts extracted
  from its constructs, evidence anchors, viewport projection, and — because they are modality-
  agnostic — fusion across sources, the grounded frontier, and the temporal model.
- The modality-extension seam is proven end to end on a real new modality; web and video adapters
  now have a template (a `parse`/`parseBinary` adapter + registration; nothing else changes).
- No new events, no schema change, no downstream code — the whole gain is one adapter + registration.

## Deferred (named scope)

- **Web modality** (governed HTTP fetch + HTML → structural extraction, behind a capability
  envelope) and **video modality** (transcript + the temporal layer + the concept scrubber + governed
  media intents — the blueprint M10 headline).
- **Per-language AST parsing** (precise nested-construct regions, symbol graphs, call edges) — T1 is a
  language-agnostic heuristic.
- **Code-aware visual grammar** (syntax highlighting as a first-class layer) — T1 renders code
  monospace with region highlights.

## Rejected

- **A binary/edge adapter for code** (like PDF): code is text; the `parse` seam is sufficient and
  keeps it deterministic + offline.
- **A per-language AST parser dependency** in T1: heavy, multiplies dependencies, and unnecessary to
  prove the seam; a heuristic parse yields real regions and honest degradation.
- **Treating code as plain text** (one blob): loses the construct structure that makes code
  anchor-addressable and teachable — the whole value of a dedicated modality.
