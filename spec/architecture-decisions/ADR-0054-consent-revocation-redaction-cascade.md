# ADR-0054: Durable Consent Envelope + Revoke → Redaction Cascade

**Status:** Accepted
**Date:** 2026-07-18
**Related:** ADR-0051 (contribution — grants the consent this can revoke), ADR-0053 (the commons —
retraction is its missing half), CSE-002 §8 (consent) / §9 (`source.consent.*` / `source.redaction.*`
events) / §10 (consent-revoked failure semantics), the Constitution (learner sovereignty; #4 honest
degradation; governance is a kernel primitive), F11 (consent policy)

## Context

Contribution (ADR-0051) records a `consent_ref` string and the commons (ADR-0053) makes the
contribution discoverable — but consent so far is **one-way**: a learner can share, never un-share.
That is the wrong shape for a sovereignty-preserving system. CSE-002 §8/§10 always intended consent to
be **revocable**, with a **redaction cascade** on revocation; the `source.consent.granted` /
`source.consent.revoked` / `source.redaction.cascaded` events were declared for exactly this and left
unimplemented. This ADR implements them, completing the consent story both directions.

The honest boundary this ADR must name: revocation can stop **all future disclosure** (delist,
withhold, block reuse), but it cannot un-teach what a reader was already taught from an
already-attached copy. We make the future-facing cascade real and complete, and name the
retroactive-teaching retraction as out of scope (you cannot unsay what was already said — but you stop
saying it).

## Decisions

### 1. Consent becomes a first-class, durable envelope

A `ConsentEnvelope` (`consent_ref`, `creation_id`, `source_version_id`, `learner_cid`, `granted_at`,
`status: "active" | "revoked"`, `revoked_at`) is created when a creation is contributed
(`contributeCreation` → `source.consent.granted`), replacing the bare `consent_ref` string as the
unit consent is tracked in. It is the record a revocation acts on.

### 2. Revocation is the learner's sovereign act and cascades a redaction

`revokeContribution(creationId)` (the author revoking their own share): marks the envelope `revoked`,
emits `source.consent.revoked`, then **cascades**:

- **Delist** the contributed source from the commons (it vanishes from discovery — ADR-0053).
- **Withhold** its bytes: the content route returns **410 Gone** (honest "this was here and has been
  redacted", not a 404 pretending it never existed — Constitution #4).
- **Block reuse**: `registered()` returns nothing for a redacted version, so a *new* attach/fuse
  cannot bind it.
- **Clear** the creation's `contributed_as` (it is no longer a live contribution).

It then emits `source.redaction.cascaded` with the redacted counts. Redaction is by version id, so the
source's *identity* remains in the log (replay stays intact) while its *content and reachability* are
withdrawn.

### 3. Redaction stops future disclosure; it does not rewrite history

Already-materialized downstream teaching (a frame a reader was already shown from an attached copy)
is **not** retracted — that is a separate, deferred capability. What revocation guarantees is that
from the moment it lands, the contribution is undiscoverable, unservable, and unbindable. The event
log records the grant, the revocation, and the cascade — the whole consent lifecycle is auditable and
replayable.

## Consequences

- Consent is now bidirectional and sovereign: a learner can share *and* take back, with an honest,
  evented, replayable cascade — the completion CSE-002 §8 always intended.
- The commons gains its missing half (retraction), so sharing is safe: nothing shared is unrecoverable.
- The consent lifecycle is observable in the M12 T1 transparency read (grant / revoke / redaction fold
  into activity + the recent feed).
- Deterministic — no model call — so the whole cascade is replay-safe and testable offline.

## Deferred (named scope)

- **Retroactive teaching retraction**: invalidating/redacting frames already taught from an attached
  copy (event-sourced content already emitted downstream) — a deeper cascade across surfaces.
- **Durable persistence of envelopes** across restart (Postgres `consent_envelopes`, the table
  already reserved in the M2 schema plan); T1 is process-lifetime, matching the SourceHub.
- **Third-party / institutional revocation** (an admin or policy revoking under F11) and
  guardian/minor consent reconciliation — governed by F11 policy envelopes, not the author-revokes
  path implemented here.
- **Partial redaction** (redact specific regions/claims rather than the whole source).

## Rejected

- **Hard-deleting the source version** on revocation: breaks replay (the version id appears in the
  historical log). Redaction withdraws *content + reachability* while preserving *identity* — the
  event-sourcing-safe way to forget.
- **A silent 404 for redacted content**: dishonest. A redacted-but-formerly-present source returns
  **410 Gone** so the withdrawal is legible, never a pretend-never-existed (Constitution #4).
- **Auto-revoking on some heuristic**: revocation is an explicit sovereign act by the author (or, later,
  a governed F11 policy), never an inferred side effect.
