# ADR-0020 — Digital Twin Architecture (P5.1)

**Status:** accepted
**Date:** 2026-06-20
**Phase:** P5.1

---

## Context

The COS vision declares a "Digital Twin / Identical Agent" — a long-lived, consent-scoped projection
of a learner's cognitive state that persists across sessions and surfaces. The learner's durable
cognition profile already exists (DPS-004, `LearnerCognitionSeed`); P5.1 gives it a name, an
explicit lifecycle (consent → create → branch/export → terminate), and an event trail.

The twin must:
- Be consent-scoped (learner controls what is shared with which surfaces/agents).
- Have a deterministic lifecycle with an audit-friendly event trail (`twin.*` family).
- Be branch-able for counterfactual learning path exploration.
- Be export-able as a portable JSON artifact (interoperability, future federation).
- Not depend on any particular surface or session — it is a learner-level primitive.

---

## Decisions

### D1 — TwinRegistry in `@inevitable/product-cognition` with a `publish` callback

`TwinRegistry` lives in `packages/product-cognition/src/twin.ts`. It accepts an optional
`publish?: (eventType: string, payload: Record<string, unknown>) => void` callback for event
emission (same pattern as `CognitiveAnalysisEngine` in P3.3, ADR-0017). This keeps it free of a
direct `@inevitable/events` dependency; the composition root (wiring.ts) wraps the callback with
`createEvent` + `bus.publish` and manages the HLC.

**Why:** Product-cognition already owns cognitive runtime primitives (FiberedLearningLoop,
SupervisorUnit, MasteryCheckpointRecorder). The twin is another cognitive primitive that belongs
in the same package. The publish-callback pattern (P3.3, ADR-0017 D1) is the established
way to make a component observable without binding it to the event bus directly.

### D2 — `TwinSnapshot` is pre-built by the caller; `TwinRegistry.create()` takes it verbatim

`TwinRegistry.create()` accepts a `TwinSnapshot` that the caller builds externally (from
`LearnerCognitionSeed` via the `buildTwinSnapshot()` helper in `wiring.ts`). The registry
does not know how to extract a snapshot from world-state or memory — that is the composition
root's responsibility.

**Why:** `TwinRegistry` would otherwise need a direct dependency on `WorldStateGraph` and
`TieredMemoryStore`, coupling it to the persistence and world-state packages. Caller-supplied
snapshots also allow different callers (tests, CLI demo, API gateway) to supply different
snapshot sources without changing the registry. This mirrors the approach used by
`ContextAssembler` (DPS-005), which receives pre-indexed `RetrievableMemoryItem[]` rather than
crawling memory directly.

### D3 — Branch = new `TwinState` with `branchedFrom` pointer; snapshot captured at branch time

`branch(twinId, displayName)` creates a new `TwinState` with:
- A fresh `twinId` (no shared identity with the parent).
- `branchedFrom` = parent `twinId` (immutable lineage pointer).
- A new `snapshot` with `snapshotAt = now` (the branch captures the parent's current snapshot).
- Inherited `consent` from the parent (consent carries to the branch).

The parent twin is unchanged. Branching a terminated twin is an error (`E_TWIN_TERMINATED`).

**Why:** Branch semantics are copy-at-fork: the child starts with the parent's current cognitive
state but evolves independently. The `branchedFrom` pointer preserves lineage for audit and
replay without requiring a persistent tree structure. Consent inheritance avoids requiring the
learner to re-declare consent for every branch.

### D4 — `TwinStatus` transitions: `active → exported/terminated`; terminated is final

`TwinStatus` is `"active" | "exported" | "terminated"`. Transitions:
- `export()`: `active → exported` (idempotent; repeated export is a no-op that returns current state).
- `terminate()`: any non-terminated state → `terminated` (idempotent; repeated terminate is a no-op).
- `exported → terminated`: allowed (consent revoked after export).
- `terminated → any`: blocked for `branch()` and `export()`; `terminate()` is a no-op.

Data is NEVER deleted. Terminated twins remain in the registry for audit and future replay
reconstruction. `terminatedAt` is recorded but the `snapshot` and `consent` are preserved.

**Why:** Consent revocation must not destroy historical data — the event trail is the audit
record. Idempotency in terminate/export prevents double-event noise when the composition root
calls terminate more than once (e.g., session cleanup).

### D5 — `twin.*` events registered in the taxonomy; not folded into `SurfaceState`

`twin.created`, `twin.branched`, `twin.exported`, `twin.terminated` are registered as the
`twin.*` family in `spec/events/event-taxonomy.md` (1y-archive, replayable, internal). They are
emitted onto the bus via the `publish` callback but are NOT folded into `SurfaceState`.

**Why:** Twins are learner-scoped; a surface is session-scoped. Mixing them in the surface fold
would violate the SRF-001 principle that the surface fold is a pure projection of `surface.*`
events for one session. Future work (P5.2+) may add a `surface.twin.registered` event (a
surface-scoped announcement that a learner's twin is accessible) which WOULD fold into
`SurfaceState.twins[]`; that is explicitly deferred.

### D6 — `DemoFixture` exposes `twins: TwinRegistry` and four lifecycle helpers

`buildDemoSession` in `apps/cli/src/wiring.ts` constructs a `TwinRegistry` with the demo bus
and returns it on `DemoFixture.twins`. Four convenience helpers (`createTwin`, `branchTwin`,
`exportTwin`, `terminateTwin`) wrap the registry methods and pre-fill session-derived defaults
(learner ID, consent from session, snapshot built from current world+memory state).

**Why:** The fixture's contract is to provide a fully-wired, explorable demo surface. Exposing
lifecycle helpers (not just the raw registry) follows the pattern established by
`generateCurriculum`, `assembleContext`, and `inferIntent` — callers get high-level verbs, not
raw dispatch calls.
