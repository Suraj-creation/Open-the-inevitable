# ADR-0036: PDF Render Fidelity — Client-Native Rendering from Canonical Bytes + Server-Extracted Geometry

**Status:** Accepted
**Date:** 2026-07-10
**Related:** CSE-008 §2.1/§9/§14 (fidelity proof requirement, PDF modality, the open question this
closes), CSE-002 (canonical representation, bytes out-of-band), ADR-0034 (Storage), SRF-006
(out-of-band media), blueprint M4

## Context

CSE-008 §2.1 demands the source render "exactly as intended" with a provable fidelity guarantee,
and §14 left the pipeline open: pre-rendered page tiles (server rasterizes at ingestion) vs.
client-native rendering. M4 must decide before the PDF modality lands.

- **Pre-rendered tiles:** deterministic images, cheap clients — but raster (zoom degrades),
  per-density re-renders, storage cost per page, a server rendering stack (native canvas), and
  the learner sees a *copy*, with fidelity proven only via fragile render-hashing.
- **Client-native (pdf.js in the browser):** the learner's viewport renders **the original
  canonical bytes** served by `content_ref` — vector-native zoom, no server render farm, and the
  fidelity proof collapses to a hash equality: `sha256(served bytes) === content_hash` registered
  at ingestion (CSE-002 §3.1). The source isn't *like* the original; it **is** the original.

What client-native rendering cannot provide alone is the **anchor substrate**: overlays,
highlights, and viewports need text runs and geometry the server controls deterministically.

## Decision

A split of responsibilities, each side doing what only it can prove:

1. **Rendering of record = client-native from canonical bytes.** The browser renders the PDF via
   pdf.js from the Storage-served `content_ref`. Fidelity proof is content-hash equality on the
   served bytes — exact by construction ("the source is sacred" satisfied literally). Optional
   pre-rendered *thumbnails* may come later for library views; they are never the reading surface.
2. **Anchor substrate = server-extracted geometry at ingestion.** The edge PDF modality adapter
   (`pdfjs-dist`, guarded dynamic import per ADR-0005/0034 — provisioned at the root edge, never a
   workspace dependency) extracts per-page text runs with positions into:
   - the **structural layer** (blocks in reading order; region paths `p<page>/blk-<n>`; native
     text confidence 1), each region carrying `page` + `bbox` so **region selectors** (CSE-002
     §5.1) become resolvable;
   - the **visual layer** (page dimensions + region geometry) that M5's semantic viewports and
     highlight overlays position against.
3. **Scanned/textless pages degrade honestly.** A page with no extractable text yields a
   low-confidence placeholder region (`source.layer.degraded` semantics; grounded claims cannot
   cite it) until an OCR engine lands as a later, separately-governed tool. Never silent, never
   fabricated text.
4. **Determinism:** extraction runs once at ingestion and lands as versioned layer artifacts;
   replay folds artifacts and never re-parses (CSE-002 §6). The same bytes re-extracted with a
   newer adapter version supersede via re-enrichment, not overwrite.

## Alternatives Considered

Pre-rendered tiles as the reading surface (rejected: raster fidelity ceiling, render-hash
fragility, server render cost, and it shows the learner a copy); server-side pdf.js text +
*server* rasterization hybrid (rejected: all the tile costs with none of the vector benefits);
DOM/HTML conversion (rejected outright: a destructive rewrite — violates "the source is sacred").

## Consequences

M4 ships extraction + layers + anchors with zero rendering infrastructure; M5's client work is
pdf.js + the overlay geometry already in the layers; the fidelity guarantee is the strongest
available (byte identity) and testable in one line. Cost: pdf.js is a heavy client chunk
(lazy-loaded at M5, like KaTeX/pptxgenjs precedent); browser rendering variance exists but is
variance in *presentation of the true bytes*, not in content fidelity. OCR is explicitly deferred
with honest degradation in the meantime.
