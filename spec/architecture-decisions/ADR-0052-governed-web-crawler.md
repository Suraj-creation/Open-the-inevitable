# ADR-0052: The Governed Web Crawler — SSRF-safe server-side source acquisition

**Status:** Accepted
**Date:** 2026-07-18
**Related:** ADR-0047 (web modality — the client-supplied HTML path this completes), CSE-002 §1/§8/§10
(source identity, consent, failure semantics), CSE-003 (acquisition), the Constitution (§2 — governance
is a kernel primitive, not an afterthought; #4 honest degradation; dependencies point inward, no vendor
past its adapter), F15 (acquisition)

## Context

The web modality (ADR-0047) parses page HTML into a Cognitive Source, but a page has to be *supplied*
to it — the client pastes HTML. Server-side fetching was explicitly deferred as "the governed
crawler," because fetching an arbitrary URL from our own infrastructure is not a parsing feature — it
is a **security boundary**. Done naively it is a textbook SSRF (server-side request forgery): a URL
like `http://169.254.169.254/…` (cloud metadata), `http://localhost:5432`, or `http://10.0.0.5/admin`
would make the server fetch internal resources and hand them back. So the crawler's essence is not
"fetch a URL" — it is *"fetch a URL under a policy that cannot be tricked into reaching what it must
not."* That policy is the decision this ADR records.

## Decisions

### 1. A URL is validated by a pure, deny-by-default policy before any fetch

`validateCrawlUrl(url)` is a **pure function** (no network) that runs before a single byte is
fetched. It rejects, with a typed error:

- any scheme other than `http`/`https` (no `file:`, `ftp:`, `gopher:`, `data:`, …);
- any URL carrying credentials (`user:pass@host`);
- any host that is `localhost` / `*.localhost`, or an IP literal that is **loopback** (127.0.0.0/8,
  ::1), **private** (10/8, 172.16/12, 192.168/16, fc00::/7), **link-local** (169.254.0.0/16,
  fe80::/10) — which includes the cloud-metadata address 169.254.169.254 — or the unspecified address
  (0.0.0.0, ::).

Being pure, the policy is exhaustively unit-testable without a network, and it is the single gate both
the initial URL and every redirect hop pass through.

### 2. The fetch is governed at every hop, bounded, and content-typed

`createGovernedWebFetcher` wraps the platform `fetch` with: **manual redirect handling** (each hop's
`Location` is re-run through `validateCrawlUrl` — a public URL cannot 302 into `127.0.0.1`), a
**redirect cap**, a **timeout**, a **response-size cap** (stream aborts past the ceiling — no
unbounded read), and a **content-type gate** (`text/html`/`application/xhtml+xml` only; a PDF or
binary is refused, not mis-parsed). Every rejection is a typed `CosError`, never a silent empty
success (Constitution #4). A realistic `User-Agent` is sent.

### 3. A crawled page is an ordinary web-modality Cognitive Source

On success `SourceHub.crawl(url)` registers the fetched HTML through the **same** M1 pipeline as any
source (`register` → `canonicalize`, modality `web`) with `origin: "web"` provenance and
`attributed_source` = the final (post-redirect) URL. It is thereafter content-addressed, anchored,
fusable, and citable like any other source; a later re-crawl of a changed page mints a **new version**
(CSE-002's supersedes chain — the "web source changed upstream" story). No new store, no new event —
the crawler is an *acquisition front-end* onto the existing web modality.

### 4. The fetcher is an injected seam (dependencies point inward)

`SourceHub` takes an optional `webFetch` implementation (default: the governed fetcher). The hermetic
test suite injects a deterministic fake, so the crawl path — including register + canonicalize — is
proven end-to-end without touching the network, and the SSRF policy is proven by direct unit tests.
The vendor capability (`fetch`) never leaks past this seam.

## Consequences

- The web modality is complete both ways: client-supplied HTML *and* governed server-side fetch. A
  learner can point the system at a URL and get a first-class Cognitive Source.
- The SSRF surface is closed by construction and by test: private/loopback/link-local/metadata hosts,
  non-HTTP schemes, credentialed URLs, oversized bodies, non-HTML content, and redirect-to-internal
  are each refused with a typed error.
- Acquisition reuses the entire source substrate; the crawler adds one gateway method + one route +
  one governed adapter seam, nothing more.

## Deferred (named scope)

- **DNS-rebinding hardening**: a public hostname that resolves to a private IP. Closing it fully means
  resolving the host and validating the *resolved address* (and pinning it for the connection). T1
  guards IP-literal and localhost hosts; resolved-address validation is the named next increment.
- **robots.txt / crawl politeness / rate limiting** per origin; a crawl budget under a lease.
- **Multi-page / recursive crawl** (follow in-domain links to a depth) — T1 fetches exactly one URL.
- **Non-HTML acquisition** (PDF-by-URL → the PDF modality; feeds; sitemaps).
- **Authenticated/allowlisted fetch** for tenant-approved internal sources (an explicit, governed
  opt-in that would relax the private-host block for named hosts only).

## Rejected

- **Following the platform's automatic redirects** (`redirect: "follow"`): defeats the policy — the
  final hop is never re-validated, reopening SSRF. Redirects are handled manually, each hop gated.
- **A blocklist-only policy** (block a few known-bad hosts): deny-by-default on address class is the
  safe posture; an allowlist-of-classes (public IPs / resolvable public hosts) can't be bypassed by an
  unusual encoding of a private address the way a name blocklist can.
- **Fetching inside the substrate package**: outbound network is a gateway/adapter concern; the
  substrate stays offline + deterministic. The fetcher lives at the edge behind an injected seam.
