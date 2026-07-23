# ADR-0051: The Contribution Loop — a Creation becomes a Cognitive Source (M11 follow-on)

**Status:** Accepted
**Date:** 2026-07-17
**Related:** ADR-0049 (Creative Cognition — the creation this contributes), CSE-016 §2/§6 (authorship
integrity + the contribution loop), CSE-002 §1/§8 (Cognitive Source identity + consent), CSE-015
(fusion — the contributed source can be fused), F11 (community/consent), the Constitution (#5 learning
before dependency; #4 honest attribution), blueprint (recursive knowledge; collective intelligence)

## Context

M11 (ADR-0049) made creation first-class: a learner authors a `Creation` (their `draft` + disclosed
assists) and completes it. The mission's arc, though, does not end at *Create* — it ends at
*Contribute*: the learner's work re-enters the shared knowledge universe so others can learn from it,
cite it, and build on it. That is what turns a single-player tool into "a living universe of
interconnected knowledge" and "collective and institutional intelligence" (the vision) — and it is
the point where the system becomes **recursive**: its outputs become its inputs.

The whole substrate already exists to make this clean: a Cognitive Source is content-addressed,
canonicalized into layers, anchored, and fusable (CSE-002/015). So contributing a creation is not a
new store or a new pipeline — it is *registering the creation's draft as a Cognitive Source*. The
work of this ADR is the **law around that act**, not the mechanism.

Two constraints are load-bearing:

1. **Consent (CSE-002 §8, F11).** A creation is the learner's own work. Moving it into the shared
   substrate — where other learners and surfaces can retrieve it — is a disclosure. It must be an
   explicit, consented act, never automatic on completion.
2. **Authorship integrity (CSE-016 §6, Constitution #4/#5).** What enters the substrate as citable
   *content* is exactly the learner's authored draft. The disclosed assists travel as **provenance
   metadata**, not as source content — so the No-Ghostwriter law holds through the loop: the shared
   artifact is unambiguously the human's words, with an honest record of what the system offered.

## Decisions

### 1. Contribution registers the learner's draft as a Cognitive Source

`contributeCreation(creationId, { consent })` on the gateway `SourceHub`: a **completed** creation's
`draft` is registered through the ordinary M1 pipeline (`register` → `canonicalize`) as a source with
modality `markdown` — so it is immediately content-addressed, anchored, fusable, and attachable like
any other source. The creation records the resulting `contributed_as` source-version id; the hub
emits `source.creation.contributed`. No new store, no new canonicalization path — recursion falls out
of reusing the source substrate on the system's own output.

### 2. Contribution is consent-gated and provenance-bearing

Contribution refuses unless (a) the creation is `completed` and (b) `consent` is explicitly given —
each a typed error, never a silent no-op or an automatic share. The contributed source carries a
distinct provenance **`origin: "creation"`** (a new, additive member of the origin union — a
creation-derived source is neither an upload nor a crawl nor an API ingest), `attributed_source`
naming the creation + its learner, and a `consent_ref` recording the consent. Attribution is honest
and traceable back to the human author (Constitution #4).

### 3. Only the draft is content; assists are disclosed provenance

The registered source content is the learner's `draft` alone. The disclosed assists are **not**
merged into it — they remain on the `Creation` record (and in the `source.creation.contributed`
payload as counts/kinds) as the disclosed authorship trail. This preserves the No-Ghostwriter law
across the loop: the shared, citable artifact contains only the human's words; "what did the system
offer, and did I take it?" stays answerable (CSE-016 §6).

## Consequences

- The Read → Understand → Master → Create → **Contribute** arc is closed. A learner's creation
  becomes a first-class Cognitive Source others can attach, anchor, fuse, and cite — the recursive,
  compounding knowledge universe the vision describes.
- It reuses the entire source substrate (identity, canonicalization, anchors, fusion) on the system's
  own output; one new event + one gateway method + a consent gate, no new store or pipeline.
- A contributed creation is observable in the M12 T1 transparency read (the contribution event folds
  into activity + the recent feed), so the loop is legible, not hidden.
- Deterministic (registering + canonicalizing markdown needs no model), so the loop is fully
  replay-safe and testable without a live model.

## Deferred (named scope)

- **Community sharing / discovery surface** (F11): browsing, endorsing, and retrieving others'
  contributed creations across learners/tenants; cross-tenant visibility governance.
- **The full consent envelope + revocation cascade** (CSE-002 §8): contribution here records a
  consent ref; the durable consent-envelope object and the revoke→redaction cascade (retract a
  contributed creation from the shared substrate) remain the named increment from M12 T3.
- **Creation-as-source enrichment**: deeper layers over contributed creations (L2 semantic/L6
  citation via the model), claim extraction, and their feedback into the Claim Graph / frontier.
- **Attribution economy / provenance chains**: when a contributed creation is itself built from other
  contributed creations, the transitive attribution graph (who built on whom).

## Rejected

- **Auto-contribute on completion:** violates consent (CSE-002 §8) — sharing must be an explicit,
  disclosed act, never a side effect of finishing.
- **Merging the assists into the contributed content:** would blur authorship and break the
  No-Ghostwriter law across the loop; assists stay disclosed provenance, never source content.
- **A separate "contributed creations" store:** a contributed creation *is* a Cognitive Source —
  giving it a parallel store would fork the substrate and forfeit fusion/anchoring/citation for free.
- **Reusing `origin: "upload"`:** dishonest provenance; a creation-derived source is a distinct
  origin and is encoded as one (`"creation"`).
