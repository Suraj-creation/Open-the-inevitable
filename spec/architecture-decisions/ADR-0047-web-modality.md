# ADR-0047: The Web Modality (M10 T2)

**Status:** Accepted
**Date:** 2026-07-17
**Related:** ADR-0046 (the code modality — the modality-extension seam this reuses), CSE-002 §3.2/§4/§7
(canonical representation, the modality adapter seam, "crawlers are ToolRuntime invocations behind
capability envelopes"), ADR-0026 (deferred the governed web-access capability envelope), F15
(web-ingestion provenance), blueprint M10 (video/web/code modalities)

## Context

M10 T1 (ADR-0046) added the code modality and proved the extension seam: a `parse(content) →
ParsedSource` adapter is all a new text modality needs; the whole M1–M9 pipeline works over its
structural layer unchanged. The **web page** is the next modality — the single most common learning
source. A page's content is HTML: structured (headings, paragraphs, lists, code, tables) and
therefore naturally anchor-addressable.

The one real design question is the **fetch**. Two things are distinct:

1. **HTML → structural extraction** — a pure, deterministic transform of page content into regions.
2. **Fetching a URL** — a governed external request (SSRF, robots, rate limits, provenance), which
   CSE-002 §7 explicitly classes as a **ToolRuntime invocation behind a capability envelope**, and
   ADR-0026 deferred as needing its own adapter.

T2 does (1) and defers (2): the **client supplies the page's HTML** (it already loaded the page), the
gateway parses it — **no server-side fetch, so no SSRF or capability-envelope surface**. The governed
server-side crawler is a named later increment; it will feed the *same* adapter.

## Decisions

### 1. Web is a text modality behind the `parse` seam — client supplies HTML, server never fetches

`WebReferenceAdapter` (`packages/source-environment/reference-adapters.ts`; modality `web`, already in
`SOURCE_MODALITIES`) implements `parse(htmlContent) → ParsedSource`. The source content posted to
`POST /api/sources?modality=web` **is the page's HTML** — the client (which already rendered the page)
provides it. The gateway performs no outbound request in T2, so there is no SSRF/capability concern to
resolve before shipping. Because canonicalization onward operates over the structural layer, the whole
pipeline (concepts, anchors, fusion, claims, synthesis, frontier, timeline) works over web pages with
no downstream change — exactly as code did.

### 2. Deterministic, dependency-free HTML → structural regions

`splitHtmlBlocks` strips non-content (`<script>`/`<style>`/`<noscript>`/`<svg>`/comments) and common
boilerplate containers (`<nav>`/`<footer>`/`<aside>`), then extracts block elements **in document
order** — `<h1>`–`<h6>` → heading regions (with level, so they nest + label), `<p>`/`<blockquote>` →
paragraph, `<li>` → list, `<pre>`/`<code>`-block → code — stripping inline tags and decoding HTML
entities. Paths reuse the markdown `assignPaths` nesting → byte-identical structural layers. No HTML
parser dependency (a regex/heuristic extractor, like the code adapter): imperfect extraction is honest
coarse structure, never a drop. An entirely tag-less body degrades to a single text region; empty
content is refused (`E_SOURCE_PARSE_EMPTY`).

## Consequences

- A learner can turn a web page into a full Canonical Source Environment — concepts, anchors, and
  therefore fusion across sources, the grounded frontier, and the temporal model, all over the page.
- The modality-extension seam is proven a second time; web + code together bracket the text modalities,
  leaving only video (the temporal modality) for M10.
- No new events, schema, or downstream code — one adapter + registration, exactly as code.

## Deferred (named scope)

- ~~**The governed server-side crawler**~~ — **landed in ADR-0052** (SSRF-safe fetch:
  scheme/credentials/private-host deny-by-default policy, redirect re-validation, size/timeout caps,
  HTML-only), feeding this same `WebReferenceAdapter` via `SourceHub.crawl` +
  `POST /api/sources/crawl`. robots/rate-limit + DNS-rebinding hardening remain deferred there.
- **Readability-grade main-content extraction** (boilerplate/ad/comment removal beyond the tag strip)
  and **table/figure structure** — T2 is a tag-based heuristic.
- **The video modality** (transcript + temporal layer + concept scrubber + governed media intents —
  the M10 headline) — the remaining, largest M10 member.

## Rejected

- **A server-side fetch in T2.** It introduces SSRF + a capability-envelope requirement (ADR-0026)
  before any value ships; the client already has the HTML, so T2 parses that and defers the governed
  crawler to its own increment.
- **An HTML parser dependency (e.g. a DOM library).** Unnecessary to prove the modality and against
  the "no parser SDK becomes a substrate dependency" rule (CSE-002 §7); a heuristic extractor yields
  real regions + honest degradation now.
- **Treating a page as plain text** (one blob): loses the heading/section structure that makes a page
  anchor-addressable and teachable — the whole point of a dedicated modality.
