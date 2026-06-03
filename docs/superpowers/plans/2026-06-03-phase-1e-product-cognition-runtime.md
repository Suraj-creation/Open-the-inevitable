# Phase 1E Product Cognition Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first product-cognition bridge package that wires F01/F02/F03/F05/F06/F14 onto the Phase 1D Cognitive OS substrate without introducing model calls or UI.

**Architecture:** Add `@inevitable/product-cognition` as a deterministic package that composes existing kernel, events, world-state, memory, runtime, scheduler, and observability primitives. The package owns product-level orchestration helpers only: onboarding/session initialization, learning-path graph projection, MVP agent manifest catalog, and mastery checkpoint recording.

**Tech Stack:** TypeScript ESM, Vitest, existing pnpm/Turbo workspace, `@inevitable/*` packages, canonical JSON Schema types from `@inevitable/protocols`.

**Execution status (2026-06-03):** Initial plan tasks are implemented. Continuation added
`ProductRuntimeDispatcher` and `DeterministicMvpUnit`, giving the bridge scheduler-admitted
`CognitionPacket`/`CognitiveWorkItem` dispatch through `CognitiveUnitHost` without model calls or UI.
Continuation also added `DeterministicLearningLoop`, composing path projection, explanation dispatch,
practice dispatch, and mastery recording into the first deterministic no-LLM learning loop.

---

## Scope Check

This plan intentionally does **not** implement the full product, UI, LLM-backed explanations, live classroom ingestion, or research agents. It creates the narrow Phase 1E foundation needed before those systems: a deterministic product-cognition runtime layer that can produce typed identities, leases, graph deltas, memory mutations, events, and agent manifests.

## File Structure

- Create `spec/product/product-cognition-runtime.md` - owning spec for the Phase 1E bridge package.
- Create `packages/product-cognition/package.json` - workspace package metadata and scripts.
- Create `packages/product-cognition/tsconfig.json` - package TypeScript config.
- Create `packages/product-cognition/src/types.ts` - product-level input/output contracts.
- Create `packages/product-cognition/src/onboarding.ts` - F01/F13 session initialization over kernel/world-state/memory/events.
- Create `packages/product-cognition/src/learning-path.ts` - F02/F03 deterministic prerequisite DAG projection.
- Create `packages/product-cognition/src/agent-catalog.ts` - F06 MVP manifest catalog.
- Create `packages/product-cognition/src/mastery.ts` - F14 mastery checkpoint recorder.
- Create `packages/product-cognition/src/index.ts` - public exports.
- Create `packages/product-cognition/tests/onboarding.test.ts`.
- Create `packages/product-cognition/tests/learning-path.test.ts`.
- Create `packages/product-cognition/tests/agent-catalog.test.ts`.
- Create `packages/product-cognition/tests/mastery.test.ts`.
- Modify `IMPLEMENTATION.md`, `CHANGELOG.md`, and `spec/implementation-roadmaps/phase-1d-substrate.md` after code lands.

---

### Task 1: Product Cognition Runtime Spec

**Files:**
- Create: `spec/product/product-cognition-runtime.md`

- [ ] **Step 1: Write the owning spec**

```markdown
---
name: product-cognition-runtime
spec:
  id: PCR-001
  title: Phase 1E Product Cognition Runtime
  domain: product
  status: draft
  owner: product-architecture
  last_reviewed: 2026-06-03
  upstream_dependencies:
    - product/Broader-feature-product
    - product/features/F01-cognitive-onboarding
    - product/features/F02-dynamic-cognitive-navigation
    - product/features/F03-recursive-prerequisite-intelligence
    - product/features/F05-persistent-cognitive-memory
    - product/features/F06-specialized-agent-ecosystem
    - product/features/F14-assessment-mastery-depth
  downstream_dependencies:
    - packages/product-cognition
  related_protocols: [cognition-packet-protocol, cognitive-event-protocol, memory-mutation-protocol, reasoning-trace-protocol, cognitive-unit-abi]
  related_events: [onboarding.completed, navigation.timeline.rendered, agent.manifest.loaded, mastery.checkpoint.created]
  related_runtime_systems: [cognitive-unit-runtime, deterministic-execution-engine, cognitive-scheduler, world-state-graph]
  related_governance_systems: [governance-kernel, capability-envelope, context-lease, intent-lease]
  related_observability_systems: [cognitive-observability, reasoning-trace, otel-edge]
  semantic_tags: [phase-1e, product-cognition, onboarding, learning-path, mastery, agent-manifest]
  canonical_references:
    - product/Broader-feature-product#19-roadmap--phasing
---

# Product Cognition Runtime

## 1. Purpose

The Product Cognition Runtime is the first implementation bridge between the completed Cognitive OS
substrate and the product feature suite. It does not implement UI, model calls, or broad pedagogy. It
turns product actions into substrate primitives: identities, envelopes, leases, world-state deltas,
memory mutations, cognitive events, and runtime-valid agent manifests.

## 2. Scope

- F01/F13: initialize a learner session with Cognitive Identity, Capability Envelope, Context Lease,
  Intent Lease, seed learner-model nodes, seed memory, and onboarding events.
- F02/F03: project a deterministic concept/prerequisite path into the world-state graph.
- F06: expose the minimal viable agent manifest catalog.
- F14: record mastery checkpoints as graph state, memory mutations, and events.

## 3. Non-Goals

- No LLM calls.
- No UI or application screens.
- No live external adapters.
- No hidden state mutation.

## 4. Architecture Laws

Every operation must be deterministic under injected clock/id generator, schema-valid where a
protocol exists, event-sourced, memory-mutation-only, governance-aware through envelopes/leases, and
replayable through graph/memory/event logs.
```

- [ ] **Step 2: Link the spec**

Add `spec/product/product-cognition-runtime.md` to `spec/product/README.md` contents and `IMPLEMENTATION.md` Phase 1E note.

---

### Task 2: Package Skeleton

**Files:**
- Create: `packages/product-cognition/package.json`
- Create: `packages/product-cognition/tsconfig.json`
- Create: `packages/product-cognition/src/index.ts`
- Create: `packages/product-cognition/src/types.ts`

- [ ] **Step 1: Create package metadata**

```json
{
  "name": "@inevitable/product-cognition",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Phase 1E product-cognition runtime bridge.",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run --passWithNoTests",
    "lint": "eslint ."
  },
  "dependencies": {
    "@inevitable/events": "workspace:*",
    "@inevitable/kernel": "workspace:*",
    "@inevitable/memory": "workspace:*",
    "@inevitable/observability": "workspace:*",
    "@inevitable/protocols": "workspace:*",
    "@inevitable/runtime": "workspace:*",
    "@inevitable/shared": "workspace:*",
    "@inevitable/world-state": "workspace:*"
  },
  "devDependencies": {
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create package tsconfig**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 3: Create product types**

```typescript
import type { CapabilityEnvelope, CognitiveIdentity, ContextLease, IntentLease } from "@inevitable/protocols";

export type PersonaClass =
  | "child"
  | "student"
  | "educator"
  | "researcher"
  | "institution"
  | "lifelong-learner"
  | "open";

export type ProductMode =
  | "student"
  | "educator"
  | "institution"
  | "researcher"
  | "open";

export interface OnboardingInput {
  readonly ownerUserId: string;
  readonly persona: PersonaClass;
  readonly mode: ProductMode;
  readonly goal: string;
  readonly tenantId?: string | null;
  readonly consentMemoryScopes?: readonly string[];
}

export interface OnboardingSession {
  readonly learnerIdentity: CognitiveIdentity;
  readonly capabilityEnvelope: CapabilityEnvelope;
  readonly contextLease: ContextLease;
  readonly intentLease: IntentLease;
  readonly learnerNodeId: string;
  readonly intentNodeId: string;
  readonly seedMemoryMutationId: string;
}
```

- [ ] **Step 4: Export public API**

```typescript
export type {
  PersonaClass,
  ProductMode,
  OnboardingInput,
  OnboardingSession
} from "./types";
```

- [ ] **Step 5: Run typecheck**

Run: `pnpm --filter @inevitable/product-cognition run typecheck`
Expected: PASS after implementation files compile.

---

### Task 3: F01/F13 Onboarding Session Initializer

**Files:**
- Create: `packages/product-cognition/src/onboarding.ts`
- Create: `packages/product-cognition/tests/onboarding.test.ts`
- Modify: `packages/product-cognition/src/index.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, expect, test } from "vitest";
import { InMemoryEventBus } from "@inevitable/events";
import { IdentityService, CapabilityService, ContextLeaseService, IntentLeaseService } from "@inevitable/kernel";
import { TieredMemoryStore } from "@inevitable/memory";
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";
import { WorldStateGraph } from "@inevitable/world-state";
import { ProductOnboardingService } from "../src/onboarding";

describe("ProductOnboardingService", () => {
  test("initializes a learner session through kernel, memory, world-state, and events", async () => {
    const clock = new ManualClock(Date.UTC(2026, 5, 3));
    const idGenerator = new SeededIdGenerator("phase-1e");
    const bus = new InMemoryEventBus({ idGenerator });
    const world = new WorldStateGraph({ clock, idGenerator, nodeId: "product", acyclicEdgeTypes: ["prerequisite_of"] });
    const memory = new TieredMemoryStore();
    const service = new ProductOnboardingService({
      identity: new IdentityService({ clock, idGenerator }),
      capabilities: new CapabilityService({ clock, idGenerator }),
      contexts: new ContextLeaseService({ clock, idGenerator }),
      intents: new IntentLeaseService({ clock, idGenerator }),
      memory,
      world,
      bus,
      clock,
      idGenerator,
    });

    const session = await service.initialize({
      ownerUserId: "user-1",
      persona: "student",
      mode: "student",
      goal: "Understand neural networks",
      consentMemoryScopes: ["working", "semantic"],
    });

    expect(session.learnerIdentity.unit_type).toBe("human.student");
    expect(session.contextLease.memory_layers).toEqual(["working", "semantic"]);
    expect(session.intentLease.interpreted_goal).toBe("Understand neural networks");
    expect(world.getNode(session.learnerNodeId)?.type).toBe("learner");
    expect(world.getNode(session.intentNodeId)?.type).toBe("intent");
    expect(memory.history("semantic")).toHaveLength(1);
    expect(bus.replay({ subject: "onboarding.*" }).map((event) => event.event_type)).toEqual([
      "onboarding.started",
      "onboarding.completed",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @inevitable/product-cognition exec vitest run tests/onboarding.test.ts`
Expected: FAIL because `ProductOnboardingService` does not exist.

- [ ] **Step 3: Implement onboarding service**

Create `ProductOnboardingService` with dependencies, persona-to-unit mapping, typed memory mutation,
world-state deltas, and two onboarding events using `createEvent`.

- [ ] **Step 4: Export service**

```typescript
export type { ProductOnboardingDeps } from "./onboarding";
export { ProductOnboardingService } from "./onboarding";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @inevitable/product-cognition exec vitest run tests/onboarding.test.ts`
Expected: PASS.

---

### Task 4: F02/F03 Learning Path Projector

**Files:**
- Create: `packages/product-cognition/src/learning-path.ts`
- Create: `packages/product-cognition/tests/learning-path.test.ts`
- Modify: `packages/product-cognition/src/index.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, expect, test } from "vitest";
import { ManualClock } from "@inevitable/shared";
import { WorldStateGraph } from "@inevitable/world-state";
import { LearningPathProjector } from "../src/learning-path";

describe("LearningPathProjector", () => {
  test("projects a prerequisite DAG into world-state and rejects cycles", () => {
    const world = new WorldStateGraph({
      clock: new ManualClock(Date.UTC(2026, 5, 3)),
      nodeId: "learning-path",
      acyclicEdgeTypes: ["prerequisite_of"],
    });
    const projector = new LearningPathProjector(world);

    const result = projector.project({
      pathId: "path-neural-networks",
      ownerUserId: "user-1",
      concepts: [
        { id: "linear-algebra", title: "Linear Algebra" },
        { id: "gradient-descent", title: "Gradient Descent", prerequisites: ["linear-algebra"] },
        { id: "backpropagation", title: "Backpropagation", prerequisites: ["gradient-descent"] },
      ],
    });

    expect(result.ok).toBe(true);
    expect(world.hasPath("concept:linear-algebra", "concept:backpropagation", "prerequisite_of")).toBe(true);

    const cycle = projector.project({
      pathId: "path-cycle",
      ownerUserId: "user-1",
      concepts: [
        { id: "a", title: "A", prerequisites: ["b"] },
        { id: "b", title: "B", prerequisites: ["a"] },
      ],
    });
    expect(cycle.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @inevitable/product-cognition exec vitest run tests/learning-path.test.ts`
Expected: FAIL because `LearningPathProjector` does not exist.

- [ ] **Step 3: Implement projector**

Implement `ConceptSeed`, `LearningPathInput`, and `LearningPathProjector.project()` by upserting a
path node, upserting concept nodes, then applying `prerequisite_of` edges from prerequisite to
dependent concept. Return `Result<LearningPathProjection, CosError>`.

- [ ] **Step 4: Export projector**

```typescript
export type { ConceptSeed, LearningPathInput, LearningPathProjection } from "./learning-path";
export { LearningPathProjector } from "./learning-path";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @inevitable/product-cognition exec vitest run tests/learning-path.test.ts`
Expected: PASS.

---

### Task 5: F06 MVP Agent Manifest Catalog

**Files:**
- Create: `packages/product-cognition/src/agent-catalog.ts`
- Create: `packages/product-cognition/tests/agent-catalog.test.ts`
- Modify: `packages/product-cognition/src/index.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, expect, test } from "vitest";
import { loadManifest } from "@inevitable/runtime";
import { MVP_AGENT_MANIFESTS, minimalAgentSet } from "../src/agent-catalog";

describe("MVP agent catalog", () => {
  test("contains schema-valid manifests for the Phase 1E minimal agent set", () => {
    expect(minimalAgentSet()).toEqual([
      "supervisor",
      "curriculum",
      "explanation",
      "practice",
      "assessment",
      "revision",
      "memory",
    ]);

    for (const manifest of MVP_AGENT_MANIFESTS) {
      const loaded = loadManifest(manifest);
      expect(loaded.ok).toBe(true);
      expect(manifest.abi_version).toBe("1.0.0");
      expect(manifest.observability.required_events.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @inevitable/product-cognition exec vitest run tests/agent-catalog.test.ts`
Expected: FAIL because the catalog does not exist.

- [ ] **Step 3: Implement catalog**

Create seven manifests with ids `agent.supervisor`, `agent.curriculum`, `agent.explanation`,
`agent.practice`, `agent.assessment`, `agent.revision`, `agent.memory`; all have ABI `1.0.0`, memory
access, policies, resources, and required events.

- [ ] **Step 4: Export catalog**

```typescript
export { MVP_AGENT_MANIFESTS, minimalAgentSet } from "./agent-catalog";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @inevitable/product-cognition exec vitest run tests/agent-catalog.test.ts`
Expected: PASS.

---

### Task 6: F14 Mastery Checkpoint Recorder

**Files:**
- Create: `packages/product-cognition/src/mastery.ts`
- Create: `packages/product-cognition/tests/mastery.test.ts`
- Modify: `packages/product-cognition/src/index.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, expect, test } from "vitest";
import { InMemoryEventBus } from "@inevitable/events";
import { TieredMemoryStore } from "@inevitable/memory";
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";
import { WorldStateGraph } from "@inevitable/world-state";
import { MasteryCheckpointRecorder } from "../src/mastery";

describe("MasteryCheckpointRecorder", () => {
  test("records mastery as event-sourced graph state and semantic memory", async () => {
    const clock = new ManualClock(Date.UTC(2026, 5, 3));
    const idGenerator = new SeededIdGenerator("mastery");
    const world = new WorldStateGraph({ clock, idGenerator, nodeId: "mastery" });
    const memory = new TieredMemoryStore();
    const bus = new InMemoryEventBus({ idGenerator });
    const recorder = new MasteryCheckpointRecorder({ world, memory, bus, clock, idGenerator });

    const checkpoint = await recorder.record({
      ownerUserId: "user-1",
      conceptId: "gradient-descent",
      assessorCid: "cog-000000000001",
      passed: true,
      confidence: 0.91,
      evidence: [{ kind: "transfer", result: "solved novel optimization problem" }],
    });

    expect(world.getNode(checkpoint.checkpointNodeId)?.props["passed"]).toBe(true);
    expect(memory.projectionOf("semantic", checkpoint.checkpointNodeId)?.confidence).toBe(0.91);
    expect(bus.replay({ subject: "mastery.*" }).map((event) => event.event_type)).toEqual([
      "mastery.checkpoint.created",
      "mastery.verified",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @inevitable/product-cognition exec vitest run tests/mastery.test.ts`
Expected: FAIL because `MasteryCheckpointRecorder` does not exist.

- [ ] **Step 3: Implement recorder**

Create checkpoint nodes, concept mastery edges, semantic memory mutations, and `mastery.checkpoint.created`
plus `mastery.verified` or `mastery.rejected` events.

- [ ] **Step 4: Export recorder**

```typescript
export type { MasteryCheckpointInput, MasteryCheckpoint } from "./mastery";
export { MasteryCheckpointRecorder } from "./mastery";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @inevitable/product-cognition exec vitest run tests/mastery.test.ts`
Expected: PASS.

---

### Task 7: Final Verification and Continuity Docs

**Files:**
- Modify: `IMPLEMENTATION.md`
- Modify: `CHANGELOG.md`
- Modify: `spec/product/README.md`
- Modify: `spec/implementation-roadmaps/phase-1d-substrate.md`

- [ ] **Step 1: Run package verification**

Run: `pnpm --filter @inevitable/product-cognition run typecheck && pnpm --filter @inevitable/product-cognition run test && pnpm --filter @inevitable/product-cognition run lint`
Expected: PASS.

- [ ] **Step 2: Run whole repository verification**

Run: `pnpm verify`
Expected: codegen PASS, typecheck PASS, tests PASS, lint PASS, format PASS.

- [ ] **Step 3: Update continuity docs**

Record that Phase 1E now has `@inevitable/product-cognition` as the first product-cognition runtime
package implementing F01/F02/F03/F05/F06/F14 substrate binding.

- [ ] **Step 4: Re-run whole repository verification**

Run: `pnpm verify`
Expected: PASS after docs.

## Self-Review

- Spec coverage: F01/F13 onboarding, F02/F03 learning graph, F05 memory mutation path, F06 minimal
  agent manifests, F14 mastery checkpoints all have implementation tasks.
- Placeholder scan: no implementation step depends on an undefined future service or LLM.
- Type consistency: package exports match test imports; graph node ids are string-prefixed; memory
  uses canonical `MemoryMutation` fields; agent manifests are validated by `loadManifest()`.
