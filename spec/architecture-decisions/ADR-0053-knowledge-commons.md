# ADR-0053: The Knowledge Commons — discovery of contributed creations

**Status:** Accepted
**Date:** 2026-07-18
**Related:** ADR-0051 (the contribution loop — this is its payoff), ADR-0049 (creative cognition),
CSE-002 §1/§8 (source identity + consent), CSE-015 (fusion over commons sources), F11 (institutional
& collective intelligence), the Constitution (§1 — "a living universe of interconnected knowledge…
collective and institutional intelligence"; #4 honest attribution; learner sovereignty), the vision
(collective intelligence)

## Context

ADR-0051 made a completed creation *contributable* — consented into the substrate as a first-class
Cognitive Source. But a contribution nobody can find is a tree falling in an empty forest: the source
exists, yet no other learner can reach it unless they already know its version id. The recursion is
built; the **discovery** that turns it into *collective* intelligence is missing.

This ADR adds the **knowledge commons**: a browsable catalog of contributed creations, so a learner
can discover what peers have made and build on it (attach it, teach from it, fuse it with their own
sources). It is the first real slice of "collective intelligence" (F11), delivered without any of
F11's heavier educator/institution/cohort machinery — that (teaching signatures, cohort analytics,
policy envelopes, human-governance workflows) remains its own milestone.

The load-bearing constraint is **learner sovereignty**: the commons must expose *only* what was
explicitly contributed, never private or in-progress work, and must carry honest authorship.

## Decisions

### 1. The commons lists exactly the consented contributions — nothing else

The commons is the set of creations that passed the ADR-0051 consent gate (`contributeCreation` →
`source.creation.contributed`). A creation that is `in_progress`, `completed`-but-not-contributed, or
whose learner never consented **never appears**. There is no path from private draft to commons except
the explicit, disclosed contribution act. Discovery cannot leak what sharing did not release.

### 2. A commons entry is public metadata + honest attribution, not the learner's data

Each catalog entry carries only: the `source_version_id` (already a public, content-addressed source),
`title`, `kind`, the author (`learner_cid`), `concept_refs`, `content_hash`, and `contributed_at`. It
exposes the *contributed source's* public face and its provenance — never the learner's other
creations, memory, or surfaces. Attribution travels (Constitution #4): a commons entry always names
who authored it.

### 3. Discovery is a host-level read; reuse is the existing attach

`GET /api/sources/commons` returns the catalog (host-level — the source substrate is shared
cross-surface, so the commons is too). A learner reuses an entry through the **existing**
`POST /api/surface/:id/sources { source_version_id }` — no new attach path. Once attached, a peer's
contributed creation is an ordinary bound source: teachable, anchorable, and fusable with the
learner's own (CSE-015). Collective intelligence falls out of the substrate the contribution already
entered.

## Consequences

- The contribution loop becomes *collective*: learners can find and build on each other's work, and a
  contributed creation can be fused with a reader's other sources — the "living universe of
  interconnected knowledge" made concrete at learner scale.
- Sovereignty is preserved by construction: the commons is a projection of the consented-contribution
  set, so nothing private can appear; every entry is attributed.
- Zero new substrate: a catalog + one read route; reuse rides the existing attach + fusion. Removing
  it reverts cleanly.

## Deferred (named scope)

- **Moderation & endorsement** (F11): flagging, endorsing, ranking, and the socio-ethical review that
  keeps a commons from becoming a vector for low-quality or harmful content.
- **Cross-tenant / institutional visibility governance**: T1 is a single-host commons; who-sees-whose
  contributions across tenants/institutions is an F11 policy-envelope concern.
- **Differential privacy / aggregation** for any commons-derived signals (F11 §10).
- **Retraction**: removing a contribution from the commons — depends on the durable consent-envelope
  + revoke→redaction cascade (deferred from M12 T3 / ADR-0051).
- **The full F11 educator/cohort layer**: teaching signatures, cohort maps, class sessions, policy
  envelopes, human governance — a separate milestone; the commons is the learner-to-learner slice.

## Rejected

- **Auto-listing completed creations** (without contribution): breaks sovereignty — only the explicit,
  consented contribution act releases a creation to the commons.
- **A separate commons store / index service**: the commons is a projection over the consented
  contributions the SourceHub already holds; a parallel store would fork the substrate.
- **Exposing richer learner context in an entry** (other creations, activity): the commons shows a
  contributed source's public face and its author, nothing more — least disclosure.
