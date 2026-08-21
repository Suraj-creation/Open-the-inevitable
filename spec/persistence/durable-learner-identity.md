```yaml
spec:
  title: Durable Learner Identity & Resume-by-Learner
  domain: persistence
  status: draft
  owner: runtime-team
  last_reviewed: 2026-06-19
  upstream_dependencies:
    - persistence/cognitive-continuity-and-rehydration
    - kernel/cognitive-identity
    - product/features/F01-cognitive-onboarding
    - product/features/F13-identity-personas-modes
  downstream_dependencies:
    - product/features/F06
    - surface/surface-streaming-sync-protocol
  related_protocols:
    - cognitive-identity
  related_events: []
  related_runtime_systems: [surface-session, world-state-graph, identity-service]
  related_governance_systems: [governance-kernel]
  related_observability_systems: [cognitive-observability]
  semantic_tags: [identity, learner, continuity, resume, durability, onboarding]
  canonical_references:
    - ../architecture/uci-architecture.md#44-kernel-services
    - architecture-decisions/ADR-0010-durable-learner-identity
```

# Durable Learner Identity & Resume-by-Learner (DPS-003)

## Purpose

DPS-002 gave a *surface* continuity of **state** (a restored surface comes back drivable). This spec
gives a *learner* continuity of **identity**: a durable, first-class learner whose identity and trust
persist across processes and across surfaces, and whose surfaces are discoverable and resumable **by
learner**. It is the third movement of the continuity arc (durability → state → identity) and the
direct precondition for the Personal Cognitive Companion / Digital Twin (P5), which is nothing more
than a long-lived per-learner cognitive identity made into an agent.

## The gap it closes

Today every surface is owned by a single **hardcoded demo learner** (`cog-demo-learner`,
`user-demo`): all users share one identity, surfaces belong to no one, and nothing carries across a
learner's sessions. That is acceptable for a demo and untenable for an OS whose mission is *"persistent
cognitive memory of each learner."* This spec makes the learner real: minted once, persisted, resolved
on return, and threaded through the governed substrate so the learner's own `cid` and `trust_level`
drive governance and world-state.

## Model

A **Learner** is a durable record:

```
{ learnerId, cid, trustLevel, displayName?, createdAt, surfaces: [{ surfaceId, goal, createdAt }] }
```

- `learnerId` — the stable external handle (`lnr-…`), returned to the client and replayed on return.
- `cid` — the cognitive identity (`cog-…`), the substrate's identity for governance, leases, and the
  world-state `learner:<learnerId>` node. (Minting goes through the id authority; routing it through
  the kernel `IdentityService` as the single issuing authority is a future refinement — see ADR-0010.)
- `trustLevel` — durable; a returning learner keeps their trust (the create request cannot raise it).
- `surfaces` — the learner's sessions over time, enabling resume-by-learner.

A learner owns many surfaces; a surface belongs to exactly one learner (recorded in its `meta.json`).

## Resolution

On surface create the gateway **resolves-or-mints** a learner:

- `learnerId` present **and** found → load the durable record (identity + trust are authoritative;
  the request's `trustLevel` is ignored — identity is not re-negotiated per session).
- absent, or present but not found → mint a fresh learner (new `learnerId` + `cid`, trust from the
  request, default standard trust). A requested-but-unknown id is **not** claimed (no identity
  spoofing); the client adopts the returned `learner_id`.

The resolved learner is threaded into the session: `onboarding()` builds the learner's
`CognitiveIdentity`, capability envelope, and context/intent leases from the descriptor (ids derived
from `learnerId`, not hardcoded), and the surface's world-state `learner:<learnerId>` node carries the
real `cid`. Governance (GOV-P01) therefore gates on the learner's own trust.

## Resume-by-learner

- `GET /api/learner/:learnerId` → the learner profile + their surfaces. The client (or a future
  device) resolves *who* the learner is and *which* surfaces exist, then enters any surface — which
  comes back **live** via DPS-002 rehydration.
- On rehydration the gateway reads the surface's `learnerId` from `meta.json`, loads the durable
  learner, and threads the **same** descriptor into `buildDemoSession` so the resumed session keeps the
  correct identity and trust (a new `ask` writes under the right learner, not a stray demo identity).
  If `meta.learnerId` is set but the learner record is missing/corrupt, fall back to DPS-002 read-side
  reconstruction rather than rehydrate under the wrong identity.

## Persistence

Durable backend (`COS_PERSIST_DIR`): one file per learner at `<dir>/learners/<learnerId>.json`. The
registry caches in memory and loads on miss, so a restart resolves a returning learner from disk.
Without persistence the registry is in-memory (learners are per-process) — consistent with the rest of
the durability stack being opt-in.

## Non-goals (explicitly deferred)

- **Shared cross-surface cognitive memory** — a returning learner's *new* surface drawing on prior
  mastery/semantic memory across surfaces. Memory and learner-level world-state are still per-surface
  here; unifying them into a durable per-learner cognitive store is the next increment (and the heart
  of the twin). This spec delivers identity + association + resume, not shared cognition.
- **Authentication / authn** — `learnerId` is an unauthenticated handle for now; real auth (and binding
  a learner to a credentialed user) is a later, separate concern.
- **Concurrent multi-surface writes** for one learner (single active surface assumed for now).
- **Kernel `IdentityService` as the sole issuing authority** (future refinement; see ADR-0010).

## Failure modes

- Unknown `learnerId` → mint fresh (never claim the requested id).
- Corrupt learner record on rehydrate → read-side fallback (DPS-002).
- In-memory mode → learners do not survive a restart (documented; durability is opt-in).

## Governance, observability, determinism

- The learner's own `cid`/`trust_level` flow into the governed dispatch path; an untrusted learner is
  blocked exactly as before (the demo-learner trust semantics are preserved, now per-learner).
- Minting a learner is a registry write, not a canonical event; it never enters the surface fold.
- Resumed sessions keep DPS-002's crypto ids for new cognition; the learner identity is stable.

## Verification

- Two creates without a `learnerId` yield two distinct durable learners (distinct `cid`s).
- Creating with a known `learnerId` (across a simulated restart) reuses the same learner: same `cid`,
  same trust, and the surface is associated under that learner.
- `GET /api/learner/:learnerId` lists the learner's surfaces.
- A resumed surface dispatches under the learner's identity (an untrusted learner still produces zero
  agent blocks).
- `pnpm verify` stays green fully offline.
```
