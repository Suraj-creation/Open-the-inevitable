# ADR-0010 — Durable Learner Identity & Resume-by-Learner

- **Status:** accepted
- **Date:** 2026-06-19
- **Deciders:** runtime-team
- **Supersedes:** —
- **Related:** [ADR-0009 (continuity & rehydration)](./ADR-0009-cognitive-continuity-and-rehydration.md), [spec/persistence/durable-learner-identity](../persistence/durable-learner-identity.md), [spec/kernel/cognitive-identity](../kernel/cognitive-identity.md), `apps/api`, `apps/cli`

## Context

Every surface is owned by one hardcoded demo learner (`cog-demo-learner` / `user-demo`): all users
share an identity, surfaces belong to no one, and nothing persists across a learner's sessions. The COS
mission requires a durable, first-class learner. DPS-002 already makes a surface resumable-live; this
adds continuity of *who* and resume *by learner* — the precondition for the Digital Twin.

## Decision

1. **A durable learner registry at the gateway boundary.** A learner is
   `{ learnerId, cid, trustLevel, displayName?, createdAt, surfaces[] }`, persisted one-file-per-learner
   under `<COS_PERSIST_DIR>/learners/` (in-memory when persistence is off). The gateway
   **resolves-or-mints** on create: a known `learnerId` loads the durable record (identity + trust
   authoritative); absent/unknown mints a fresh learner — a requested-but-unknown id is never claimed
   (no spoofing).

2. **The real learner is threaded through the substrate.** `onboarding()` (in `buildDemoSession`) takes
   a learner descriptor `{ userId, cid, trustLevel }` with ids derived from it (no hardcoded demo ids);
   `buildDemoSession` gains a `learner` option. The surface's world-state `learner:<learnerId>` node and
   the governed dispatch path use the learner's own `cid`/`trust_level`. The demo learner remains the
   default for the CLI/tests (back-compat).

3. **Identity is minted via the shared id authority (`newCid`), not duplicated.** The full
   `CognitiveIdentity` is materialized once in `onboarding()`. Routing minting through the kernel
   `IdentityService` as the single issuing authority is a **future refinement** — it would add a
   substrate dependency and duplicate the identity object for no present gain; deferred until learners
   become first-class substrate entities.

4. **Resume-by-learner.** `GET /api/learner/:learnerId` returns the profile + surfaces; each surface
   resumes live via DPS-002. Rehydration reads `meta.learnerId`, loads the learner, and threads the
   same descriptor so a resumed surface keeps the correct identity/trust — falling back to DPS-002
   read-side reconstruction if the learner record is missing/corrupt.

## Consequences

**Positive:** a durable, governed, per-learner identity replaces the shared demo singleton; surfaces are
owned and discoverable; the foundation for shared per-learner cognition and the twin exists; the §2 law
holds (apps depend on the substrate; the registry leaks no vendor).

**Negative / trade-offs:** shared cross-surface *cognitive memory* is **not** yet delivered (a returning
learner's new surface still starts cognitively fresh) — explicitly the next increment; `learnerId` is an
unauthenticated handle (auth is later); minting bypasses the kernel `IdentityService` for now.

**Neutral:** learner durability is opt-in via `COS_PERSIST_DIR`; default in-memory behavior and hermetic
tests are unchanged (the new `learner_id` response field is additive).
