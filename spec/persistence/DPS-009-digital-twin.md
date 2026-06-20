# DPS-009 — Digital Twin (P5.1)

**Domain:** persistence
**Status:** accepted
**Phase:** P5.1
**ADR:** ADR-0020

---

## 1. Purpose

The Digital Twin (the "Identical Agent" in the blueprint) is a named, consent-scoped cognitive
artifact that represents a learner's persistent cognitive state — mastery across concepts, durable
memory, and goals — independent of any single session or surface.

The twin has an explicit lifecycle: consent grants creation; the twin can be snapshot (at creation),
branched (forked for counterfactual exploration), exported (portable JSON for interoperability), and
terminated (consent revoked). Every lifecycle transition emits a `twin.*` event for observability
and future replay reconstruction.

P5.1 introduces the `TwinRegistry` — an in-memory lifecycle manager with event emission and the
full create/branch/export/terminate API. Durable persistence across process restarts (reconstructing
twins from their event trail) follows in P5.2, using the same `FileEventTransport` pattern as
DPS-001.

---

## 2. Subscribed events

| Event | Source | Use |
|---|---|---|
| *(none — not an event subscriber)* | — | Twin lifecycle is managed programmatically via `TwinRegistry` |

---

## 3. Emitted events

| Event | Emitted when | Key payload fields |
|---|---|---|
| `twin.created` | A learner grants consent and a twin is minted | `twin_id`, `learner_id`, `display_name`, `status: "active"`, `created_at` |
| `twin.branched` | A twin is forked to create an independent cognitive branch | `twin_id` (new), `branched_from` (parent twin_id), `learner_id`, `display_name`, `created_at` |
| `twin.exported` | A twin's state is serialized as a portable JSON artifact | `twin_id`, `exported_at` |
| `twin.terminated` | Consent is revoked and the twin is permanently deactivated | `twin_id`, `terminated_at` |

---

## 4. Twin lifecycle

```
consent granted
      │
      ▼
   [active] ──branch──► [active branch] (new twinId; independent lineage)
      │
      ├──export──► [exported] (still active; marks a portable artifact was created)
      │
      └──terminate──► [terminated] (final; data preserved for audit)

terminated ──*(any)*──► error / no-op (consent is gone)
```

State transitions:
- `active → exported`: idempotent; the twin remains queryable and mutable after export.
- `active → terminated`: irreversible; `terminatedAt` is recorded; twin is no longer mutable.
- `active → branched`: creates a new independent twin (`branchedFrom` points to parent); the parent
  twin continues unchanged.
- A terminated twin cannot be branched or exported.

---

## 5. TwinSnapshot semantics

A `TwinSnapshot` is a point-in-time projection of the learner's cognitive state, built from the
learner's cross-surface cognition profile (`LearnerCognitionSeed`, DPS-004):

- **`masteryMap`**: `conceptId → { level, confidence }` extracted from `mastery_checkpoint` world
  nodes in the cognition profile.
- **`memoryDigest`**: one entry per durable memory layer (`semantic`, `procedural`, `reflective`)
  summarizing the learner's persistent knowledge for that layer.
- **`goals`**: interpreted intent history (P5.1: always empty; populated in P5.2+ when intent leases
  are cross-session).
- **`snapshotAt`**: wall-clock ms at snapshot time.

The snapshot is **built by the caller** (composition root / wiring.ts) from `LearnerCognitionSeed`
and passed to `TwinRegistry.create()`. This keeps `TwinRegistry` free of the cognition extraction
logic and allows future callers to supply alternative snapshot sources.

---

## 6. Consent model

`TwinConsent` declares:
- **`learnerId`**: the learner who owns this twin (consent grantor).
- **`grantedAt`**: timestamp when consent was given.
- **`allowedSurfaces`**: which surface IDs may query the twin (`["*"]` = all surfaces).
- **`allowedAgents`**: which agent CIDs may read the twin state (`["*"]` = all agents).
- **`expiresAt`**: optional expiry in ms; absent = no expiry.

Consent is **recorded at creation** and carried on `TwinState`. Enforcement at query time (blocking
access when `allowedSurfaces` or `allowedAgents` excludes the caller) is deferred to P5.2.

---

## 7. TwinRegistry API

```typescript
class TwinRegistry {
  create(params: CreateTwinParams): TwinState
  get(twinId: string): TwinState | undefined
  list(learnerId: string): readonly TwinState[]
  branch(twinId: string, displayName: string): TwinState   // throws E_TWIN_NOT_FOUND / E_TWIN_TERMINATED
  export(twinId: string): TwinState                        // throws E_TWIN_NOT_FOUND / E_TWIN_TERMINATED
  terminate(twinId: string): TwinState                     // idempotent; no-op if already terminated
}
```

---

## 8. Non-goals

- **Durable persistence** across process restarts (P5.2+; `FileEventTransport` + twin replay).
- **IdenticalAgent**: the model-backed agent that speaks *as* the learner using `TwinState` as
  context (P5.2+).
- **Consent enforcement at query time** (P5.2+; consent is recorded but not enforced in P5.1).
- **Live twin updates** from a running session's events (P5.3+; streaming twin state).
- **Cross-surface / cross-process twin synchronization** (future federation work).
- Folding twin events into `SurfaceState` (twins are learner-scoped, not surface-scoped; the
  surface UI may render a twin panel in P5.2+).
