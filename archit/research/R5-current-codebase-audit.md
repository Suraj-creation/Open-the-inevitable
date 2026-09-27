# R5 — Current UCI Codebase: Code-Level Architecture Audit

> **Status.** Evidence note, read-only investigation, 2026-09-27. Every claim below is grounded in files actually
> opened (paths cited); nothing is inferred from names alone. `spec/` was not used as evidence, per CLAUDE.md §4.
> Scope: `apps/{api,cli,mcp,web}`, all 24 `packages/*`, `services/*`, `supabase/migrations/*`.
>
> **Why this exists.** Feeds `14-foundation-selection-and-migration-strategy.md`'s Part 1/Part 7 (what exists,
> what to keep/refactor/replace/retire). Companion to `R6` (the seven reference-harness comparison).

---

## 0. Headline finding

The repository is **not flat** — it already has an explicit package-per-layer decomposition
(`packages/kernel`, `packages/governance`, `packages/execution`, `packages/memory`, `packages/world-state`,
`packages/context`, `packages/cognitive-loop`, `packages/runtime`, `packages/scheduler`, `packages/adapters`,
`packages/surface`, `packages/source-environment`, `packages/product-cognition`) that maps loosely onto
kernel/substrate/harness/environment/surface. But it is a **layered prototype of an older ("CDL"/"DPS"/ADR-00xx)
architecture generation**, not the archit/UCI target: most "kernel" and "harness" primitives are in-memory
`Map`-backed services with no durable backing, while a *separate*, newer slice (`packages/cognitive-loop`,
"spec 11") implements a genuinely closer approximation of UCI's Constitution/AdaptivePolicy/causal-provenance
model, disconnected from the older kernel/execution packages. Meanwhile `apps/api` (the actual shipping product,
"Surface Gateway") is mature, real, tested, Postgres-durable infrastructure that mostly bypasses both the toy
kernel and the fancy execution engine, wiring adapters directly. There are effectively **three architectural
generations coexisting**, not fully reconciled.

---

## 1. Current architectural layers

No enforced kernel/substrate/harness/environment/surface boundary exists as a dependency-direction contract (no
lint rule, no import-graph check). What exists is a **package-per-concept split with three overlapping
generations**:

| Generation | Packages | Character |
|---|---|---|
| **Gen 1 — "CDL kernel/harness"** (oldest, ADR-0003–0030 era) | `kernel`, `governance`, `execution`, `events`, `memory`, `world-state`, `context`, `runtime`, `scheduler`, `intelligence`, `evaluation`, `orchestration` | Faithful, well-tested toy implementations of kernel/harness *concepts* (identity, capability envelope, leases, governance, fiber execution, tiered memory, world-state graph, context-lease retrieval, unit lifecycle, scheduler) — **100% in-memory `Map`/array state**, no durable backing, largely disconnected from the live product. |
| **Gen 2 — "spec 11 / walking skeleton"** (newest, ADR-0066) | `cognitive-loop` | A narrower but *closer-to-target* reimplementation: Constitution (governed static identity) + AdaptivePolicy (versioned, immutable-lineage Cognitive Object) + AdaptationGovernor (propose→evaluate→accept, bounded) + ContextCompiler/ContextManifest (precedence-ordered, provenance-carrying) + causal-chain reconstruction from `causation_id` links in the event log. This is the only part of the codebase that actually implements gap-map primitives (PB-03 decision record, PB-05 predicted-effect adaptation, causal provenance) as *runnable, tested* code — but only for one dimension (explanation strategy) and one process. |
| **Gen 3 — "CSE / Surface Gateway"** (product, ADR-0034–0066) | `source-environment`, `surface`, `product-cognition`, `adapters` (Postgres/file adapters), `apps/api`, `apps/web` | The actual shipping education product. Genuinely mature: real Postgres/Storage durability, real model provider, real ingestion pipeline, real replay/rehydration. Wired mostly by hand in `apps/api/src/host.ts` (1,458 lines) and `apps/cli/src/wiring.ts` (1,281 lines), which act as ad hoc composition roots — **not** through the Gen-1 kernel's `CapabilityService`/`IdentityService`, and only partially through Gen-2's cognitive-loop. |

`@inevitable/kernel` is consumed by only 7 files total (`apps/cli/src/wiring.ts`, `apps/mcp/src/index.ts` + test,
`packages/adapters/src/tools.ts`, `packages/product-cognition/src/onboarding.ts` + test, `packages/sdk/tests`) —
i.e. the kernel is present but load-bearing almost nowhere in the live product path (`host.ts` never imports
`@inevitable/kernel`).

## 2. Persistence model

**Durable (real, wired, live-tested):**
- `supabase/migrations/0002_sources.sql` `transport_events` ← `PostgresEventTransport` (`packages/adapters/src/supabase.ts:69-137`)
- `0001_core_substrate.sql` `vectors` ← `PgVectorStore` (`supabase.ts:160-221`), wired in `apps/api/src/host.ts:386-395` (ADR-0065)
- `0003_intelligence.sql` `intelligence_artifacts` ← `PostgresIntelligenceStore` (`supabase.ts:266-338`), used by `apps/api/src/intelligence.ts`
- `0004_learner_durability.sql` `learners`, `learner_surfaces`, `learner_world_nodes/edges`, and reuse of `memory_mutations` ← `PostgresLearnerStore` (`supabase.ts:443-609`), wired in `host.ts:369-380`
- `0005_cognitive_policies.sql` `cognitive_policies` ← `PostgresPolicyStore` (`supabase.ts:647-703`), wired in `host.ts:399-409`
- Supabase Storage (bytes, `content_ref` addressed) ← `SupabaseStorageObjectStore` (`supabase.ts:732-817`)
- Also: `FileEventTransport` (`packages/adapters/src/durable.ts`) — append-only JSONL, crash-safe (torn-line
  detection), used as the per-surface durable log in `host.ts:622-649` when `COS_PERSIST_DIR` is set, plus
  `world.json`/`memory.json` JSON snapshots (`host.ts:1138-1143`) for live rehydration.

**Provisioned but DEAD (migration exists, no adapter ever reads/writes it):**
- `0001_core_substrate.sql` `events` table (the doc-comment literally calls it "the canonical source of truth") —
  **zero** TypeScript references found (`grep` for `INSERT INTO events`/`FROM events` returns nothing outside the
  SQL file itself).
- `world_state_deltas`, `world_state_nodes`, `world_state_edges` — zero adapter usage; `WorldStateGraph`
  (`packages/world-state/src/graph.ts`) is purely in-process (delta log kept in a JS array, snapshot/restore only
  to/from JSON, never to Postgres).
- `media_objects` table — not referenced by `FileMediaStore`/`InMemoryMediaStore` (`apps/api/src/media.ts`, not
  read in full but grep confirms no `media_objects` SQL anywhere in TS).

**In-memory only, no persistence adapter exists at all:** kernel (`IdentityService`, `CapabilityService`,
`ContextLeaseService`, `IntentLeaseService` — all `Map`-backed, `packages/kernel/src/*.ts`),
`ExecutionEngine`/fiber journal (`packages/execution/src/engine.ts`), `GovernanceEngine` policy list,
`InMemoryEventBus` (default bus for most of the product path — see §7), `TieredMemoryStore`
(`packages/memory/src/tiered-store.ts`), `DepthScheduler` (`packages/scheduler`), `CognitiveUnitHost` lifecycle
state (`packages/runtime/src/host.ts`).

Net: the *durability story is real but narrow* — it covers exactly what one production feature (durable
per-learner identity/cognition/policy across Render's ephemeral disk) needed, not a general substrate.
`packages/contracts/src/index.ts` also declares `WorkflowRuntime` and `GraphStore` adapter contracts
(Temporal-style, Neo4j-style) that have **zero implementations anywhere** in the tree — pure unrealized vision
interfaces.

## 3. Execution model

Two unconnected execution models:
- **`packages/execution`** (`fiber.ts`, `engine.ts`): a genuinely well-built deterministic cooperative-fiber
  engine — generators `yield` typed `Effect`s (`emit`/`spawn`/`await`/`sleepLogical`/`reason`), interpreted by
  `ExecutionEngine.runToQuiescence()`, journaled with HLC timestamps for byte-identical replay (`engine.ts:1-6`).
  Priority + spawn-order scheduling, loop-limit guard, fail-fast/isolate lineage error policy. **This is the
  closest thing in the repo to archit §9's "step loop"** — but it is in-memory only, and its only consumer
  outside its own package/tests is `packages/product-cognition/src/fiber-learning-loop.ts`.
- **`CognitiveUnitHost`** (`packages/runtime/src/host.ts:28-131`): a lifecycle FSM
  (`Registered→Admitted→Scheduled→Hydrating→Ready→Executing→Publishing→Ready`, with
  `Recovering→Quarantined`/`Retired`) driving one `CognitiveUnit.execute(packet)` call per `handle()`, emitting
  `agent.*` events for every transition. This is the actual "process" primitive used by
  `packages/product-cognition/src/runtime-dispatch.ts` to run the ~18 named product agents
  (supervisor/curriculum/explanation/practice/assessment/…/canonicalizer/meaning) through `DepthScheduler`
  (`packages/scheduler/src/depth-scheduler.ts`, production-grade priority/fairness/budget/preemption/backpressure
  logic, in-memory).
- **The actual live gateway path (`host.ts`) uses neither.** Cognition happens as direct async/await calls inside
  `SurfaceHost.create()`/`runAsk()`/`runAdvance()` — a conventional request/response handler, not a resumable
  step loop. Long-running background work (look-ahead buffer pre-composition, ADR-0064) is implemented as
  fire-and-forget promises inside the session object, not as scheduled/resumable processes.

There is **no cross-restart process resumption**: a crash mid-`ask()` loses that in-flight call; only the
*completed* surface state (via snapshots + event log) survives, which is read-side reconstruction (DPS-001), not
resumed execution. `host.ts:1074-1120` explicitly documents this: a restored surface is "read-only; live
continuity after restart is Phase 2."

## 4. State model ("working state")

No explicit `WorkingState` type/projection object exists. The closest analogues:
- `ContextManifest` (`packages/cognitive-loop/src/context-manifest.ts:16-41`) — a genuinely good instance of
  "model-visible = derivable, with recorded reasons": captures constitution/policy version, strategy,
  goal/memory/world-state/skill refs (currently empty arrays — "honest emptiness" per its own comment),
  capability manifest, assembled system-prompt sections, and `compiler_decisions`.
  `reconstructContextManifest()` (same file, :92-103) rebuilds it from the event log alone — a real instance of
  archit's "derivable and explained" law (gap G7).
- `SurfaceState` (`packages/surface/src/*`, folded by `foldSurfaceEvents`) is the UI-facing projection, built
  purely from replaying `surface.*` events — genuinely a projection, never authoritative (§11 surfaces law is
  respected here).
- There is **no unified "process working state"** object that a different model on a different day could resume
  cognition from — what persists is data (world graph, memory mutations, policy) and completed artifacts, not a
  mid-task cognitive state (open questions, expectations, plan). This is exactly gap G2/G17 from
  `archit/11-gap-map.md` — confirmed still open in code.

## 5. Process/agent model

- `CognitiveIdentity` (kernel) has parent/child lineage, trust decay, capability subset enforcement
  (`packages/kernel/src/identity.ts:74-101`) — a real, tested spawn invariant — but it's in-memory and barely
  used (§1).
- `Constitution` + `AdaptivePolicy` (`packages/cognitive-loop/src/constitution.ts`, `adaptive-policy.ts`) is the
  actual "persistent identity outliving any process" primitive from CLAUDE.md §3 — static governed identity
  (Constitution) vs. dynamic versioned policy (AdaptivePolicy, `cog://policy/<agent>/<learner>` ref, immutable
  version lineage) — and it **is** durable via `PostgresPolicyStore` (migration 0005). This is a real, narrow,
  working instance of "agents are persistent identities, not prompts."
- No budget/authority envelope is actually enforced on the live product path — `CapabilityEnvelope` (kernel)
  exists and is schema-validated but `SurfaceHost` never grants/checks one.

## 6. Memory model

- Three memories are **named but not built as one substrate**: `TieredMemoryStore`
  (episodic/semantic/procedural/reflective mutation log + projection, `packages/memory/src/tiered-store.ts`) is
  evidence-like/operational memory; `WorldStateGraph` (world-state) is a DAG-checked delta-log graph
  (concept/prerequisite structure); `packages/context/src/context-assembler.ts` (DPS-005) does
  VectorStore-backed, `ContextLease`-bounded semantic retrieval with token-budget accounting and honest
  "excluded/dropped" counts.
- **Two independent, non-integrated context-compilation systems exist**: `packages/context`'s lease-bounded
  `ContextAssembler` (used only by `apps/cli/src/wiring.ts`) and `packages/cognitive-loop`'s `ContextCompiler`
  (used only by the opt-in `harnessExplain` path in `host.ts`). This is a direct "one semantic authority, many
  projections" violation (CLAUDE.md §3) — two authorities for "what should the model see," from two eras, never
  reconciled.
- No claim/belief object exists anywhere (gap G8 "claim unification" is fully open — confirmed, no
  `Claim`/`Belief` type in the codebase despite `packages/product-cognition/src/claim-graph-service.ts` and
  `claim-reasoning-unit.ts` existing — these model *learner* claims about concepts for teaching, not the
  system's own epistemic claims about itself/the world per archit's substrate law).
- `packages/world-state/src/kg-engine.ts` (`KnowledgeGraphEngine`) bolts education-specific concept-depth
  taxonomy (0=intuition…6=research) and curriculum-path decomposition directly onto the generic `world-state`
  package — a domain concept leaking into what should be generic substrate (CLAUDE.md §3 "one concept, one
  authority"; §5 "domain concepts never leak into the kernel or substrate").

## 7. Tool/action model

`InMemoryToolRuntime` (`packages/adapters/src/tools.ts:57-131`) implements `ToolRuntime` (discover/invoke) with
an optional governance capability check callback and `tool.invoked`/`tool.completed` event emission —
well-shaped, but in-memory, no effect ledger (no "called before it runs, settled exactly once, unknown
reconciled" — archit §7's effect-ledger law is **not implemented anywhere** in the repo; grep for "effect
ledger"/exactly-once settlement patterns found nothing beyond `EventTransport`'s idempotent-sequence insert,
which covers event durability, not external side-effect settlement).

## 8. Model/provider abstraction

**Genuinely mature, real adapter boundary** (`packages/adapters/src/model.ts`, 813 lines): `ModelRuntime`
contract (`packages/contracts`) with `NullModelRuntime` (deterministic, schema-aware fallback — even answers per
the caller's declared JSON schema so offline tests exercise the real contract shape, not a degraded stub,
`model.ts:124-134` comment explains a real regression this fixed), `GeminiModelRuntime` (guarded dynamic
`@google/genai` import, never a workspace dependency), `RecordingModelRuntime` (record/replay seam for
deterministic tests, D3). Provider errors are classified into typed causes (`E_MODEL_QUOTA_EXHAUSTED` w/ parsed
`retryAfterMs`, `E_MODEL_NOT_FOUND` w/ suggested replacement, `E_MODEL_AUTH`, `E_MODEL_UNAVAILABLE`) — no vendor
type crosses the boundary. This is the single best example in the codebase of "everything is replaceable behind
a contract" being actually true.

## 9. Environment abstraction

`packages/source-environment` is a real, self-describing environment implementation matching archit §10 closely
for its domain: `SourceEnvironmentStore` (`store.ts`) implements state-then-emit, idempotent-per-content-hash
registration, progressive availability (structural→visual layers), honest degradation
(`source.layer.degraded`, never silently dropped). Seven `ModalityAdapter` implementations exist
(`packages/source-environment/src/reference-adapters.ts`): markdown, text, code, web, video-transcript,
notebook, dataset — plus a real PDF adapter (`packages/adapters/src/pdf.ts`) doing deterministic line/heading
extraction via `pdfjs-dist` with an honest "textless" degraded placeholder rather than fabrication.
`apps/api/src/sources.ts` (`SourceHub`, 1,969 lines) is the cross-surface registry/composition layer:
canonicalization pipeline, anchor index, Source Fusion (cross-document contradiction detection),
frontier/temporal research units, learner-creation (no-ghostwriter) flow. This is domain depth done properly —
arguably the strongest "environment" instance in the repo, though it lives directly in `apps/api` rather than a
pluggable package boundary.

## 10. UI/surface architecture

`apps/web` genuinely behaves as a projection: `App.tsx` sends governed commands
(`ask`/`advance`/`expand`/`interact`/`answer`) and renders folded `SurfaceState` from `useSurfaceStream` (SSE
fold of `surface.*` events) — no independent business state duplicated client-side; `App.tsx:35-40` (`phaseOf`)
derives UI progress purely from folded state. `packages/surface/*` (18 files, largest is `session.ts` at 3,795
lines) owns block/frame/cinematography/narration/theater composition server-side and exposes
`foldSurfaceEvents`/`TextSurfaceRenderer`/`AgentContributionRuntime` — genuinely respects "surfaces are
projections, never define the substrate."

## 11. CLI architecture

`apps/cli/src/main.ts` (85 lines) — a thin demo driver (`pnpm demo "..."`) over `buildDemoSession` from
`apps/cli/src/wiring.ts` (1,281 lines), which is the actual composition-root factory reused by both the CLI demo
and `apps/api/src/host.ts`. Functional and deterministic-by-default (Null model, seeded ids), but `wiring.ts` at
1,281 lines is itself a large, hand-assembled dependency graph — no DI container, no declared "environment
manifest."

## 12. MCP architecture

`apps/mcp` (3 files, 47-line `index.ts`) is clean: JSON-RPC 2.0 over stdio, `initialize`/`tools/list`/`tools/call`,
and — notably — the file's own doc-comment states and the import list proves a real architectural law: **only
`@inevitable/sdk` is imported**, no direct dependency on protocols/kernel/events, so "a process restart of this
app requires zero changes to any substrate package." This is a genuine, verifiable instance of the
dependency-direction law working as intended.

## 13. Background work / scheduling

`DepthScheduler` (`packages/scheduler/src/depth-scheduler.ts`) is production-quality (priority dispatch, weighted
fairness, per-requester budgets, preemption, bounded-queue value-based shedding, deterministic) but in-memory and
only exercised through `product-cognition`'s multi-agent dispatch, not through the live gateway request path.
`services/control-plane`, `services/event-bus`, `services/workflow-worker` are **empty `.gitkeep` placeholders —
no code at all**. `services/data-plane` has real code (`otel-sink.ts`, `otel.ts`) — an OTel collector sink, not a
workflow/queue system. There is no cron/queue system anywhere; "background cognition" (look-ahead buffer
pre-composition) is ad hoc fire-and-forget promises inside `host.ts`, not a scheduled/durable process.

## 14. Verification

`CognitiveEvaluationEngine` (`packages/evaluation/src/engine.ts`) is a real two-tier verifier: heuristic
scorecards (`scorecards.ts`) plus an optional LLM-as-judge (`judgeWithModel`, :79-113) that falls back to the
heuristic on any error — genuinely "verification separate from generation," though the "verifier hierarchy" is
thin (one heuristic + one LLM judge, no measured validity of the judge itself, no independent test-as-oracle for
the education domain beyond mastery-check pass/fail in `packages/product-cognition/src/mastery.ts`, not fully
read). `packages/cognitive-loop`'s loop-level metrics (`loop.ts:88-152`) — longitudinal gain, ablation gap,
replay/causal-chain reconstruction — are a genuinely good instance of controlled, cost-matched comparison
(archit's learning law) but scoped to the single L2 walking-skeleton dimension.

## 15. Learning/adaptation

The **only real learning-with-attribution mechanism in the codebase** is `packages/cognitive-loop`:
`AdaptationGovernor.govern()` (propose→bounds-check→accept, mints a new immutable policy version, never mutates
in place) + `reconstructChain()` (walks `causation_id` from an accepted-policy event back through
proposal→reflection→outcome→output→compiled→episode-started, returning `null` if any link is broken — a real,
falsifiable causal-provenance check, not a log dump). This is durable end-to-end (migration 0005) for one
dimension: per-learner explanation-strategy weight. Everything else in the product ("product-cognition" agents,
mastery tracking, curriculum) is deterministic/hand-coded logic with no weight/policy update loop.

## 16. Observability/replay/recovery

Real OTel API instrumentation (`packages/observability/src/otel.ts`, no-op-safe `withSpan`, exporter wired at
deployment edge per ADR-0003). Replay is genuinely supported at three levels: (a) `InMemoryEventBus.replay()`/
`hydrate()` (`packages/events/src/in-memory-bus.ts:141-164`); (b) `FileEventTransport.replay()`/`readAll()` with
crash-safe torn-line handling (`packages/adapters/src/durable.ts:77-110`); (c) `SurfaceHost.rehydrate()`
(`host.ts:1150+`) restores world+memory snapshots and resumes a *live* session, falling back to read-side
reconstruction (`resumedServed`, :1074-1120) when snapshots are missing/corrupt — explicitly documented as
read-only until "Phase 2." This is a real, working instance of archit's "recovery by reconstruction," just not
complete (no live continuity after restart yet).

## 17. Document/multimodal handling

Real pipeline: `SourceHub.registerVersion()` → content-hash idempotency → modality adapter
(`PdfjsModalityAdapter` or the 7 reference adapters) → structural + visual layer artifacts → anchor index, all
event-sourced (`source.*` events) and replayable (`SourceEnvironmentStore` doc-comment,
`packages/source-environment/src/store.ts:1-13`). The web crawler (`apps/api/src/crawler.ts`) is a properly
engineered SSRF-safe fetcher: deny-by-default host-blocking (loopback/private/link-local/metadata-IP/carrier-NAT
ranges checked explicitly, including `169.254.169.254`), re-validated on every redirect hop, bounded
size/timeout — genuinely good security engineering, not a toy.

## 18. Auth/identity

Bearer-token model: `learners.api_key` minted once (`PostgresLearnerStore`), resolved via `getLearnerByApiKey`.
No JWT/session/RBAC layer; migration 0001's RLS comment states plainly "no permissive policies yet: service_role
bypasses RLS; anon/authenticated are denied until learner-scoped JWT policies land with Supabase Auth" — i.e.
**Supabase Auth was never actually wired**; the gateway's service-role key is the only credential in play
server-side, and the learner-facing "auth" is a single opaque bearer string with no rotation/expiry mechanism
visible in the store.

## 19. Configuration and deployment

pnpm workspace (`packages/*`, `apps/*`, `services/*`, `tools/*`) + Turborepo (`turbo.json`: codegen→typecheck/test
dependency graph, schema-driven codegen for `packages/protocols/src/generated/*`). Deploy targets are concrete
and live: `apps/web` → Vercel (`vercel.json`, static Vite SPA build, output `apps/web/dist`); `apps/api` → Render
free tier (`render.yaml`) — **with a documented, previously-hit gotcha**: Render free tier has ephemeral disk,
so `COS_PERSIST_DIR=/tmp/cos-data` resets on redeploy/idle-spindown, which is exactly why migrations 0004/0005
(durable learner + policy stores) exist — this was a real production incident (per repo memory: "gateway: failed
to enter surface" 401 lockout), now fixed by making Postgres the durable tier and the filesystem a best-effort
local cache.

## 20. Testing

Vitest throughout, `pnpm verify` = codegen+typecheck+test+lint+format:check (CLAUDE.md §8). Real test-to-source
ratio: **~27,000 test LOC vs ~58,700 src LOC (46%)**, concentrated in the mature layers: `product-cognition` (28
test files), `apps/api` (15), `surface` (13), `source-environment` (12), `adapters` (9). `packages/testing` is
essentially an empty stub. Notably, `packages/adapters` tests exercise the *same conformance harness* across
in-memory/file/Postgres backends (per `packages/adapters/src/conformance.ts`, not fully read but referenced
throughout `durable.ts`/`supabase.ts` comments) — a real "adapters must preserve reference semantics"
discipline (ADR-0003), which is exactly the right test shape for a replaceable-adapter architecture.

## 21. Cross-platform assumptions

All durable-adapter code uses `node:fs`/`node:path` (Windows-safe, explicitly called out: `durable.ts:4` "fully
offline and Windows-safe"). Vendor SDKs (`pg`, `@google/genai`, `pdfjs-dist`) are behind guarded dynamic imports
(`requireOptional`, `packages/adapters/src/optional.ts`, not fully read but consistently used) — never hard
workspace dependencies, so the offline/Windows dev path never needs them installed. CLAUDE.md itself documents a
Windows-specific pnpm/turbo gotcha (`npm i -g pnpm@9.15.0`). No obvious POSIX-only shell scripts were found
gating the build (scripts are `.ts` run via `tsx`). This looks like a genuinely portable codebase.

---

## Subsystem classification

| Subsystem | Path | Classification | Justification |
|---|---|---|---|
| Kernel identity/capability/leases | `packages/kernel/src/*` | **REFACTOR** | Correct *shape* (spawn-trust invariant, capability subset, TTL leases) matches archit §7, but zero persistence and near-zero live usage; needs a durable backing store and to actually gate `SurfaceHost`, not sit unused beside it. |
| Governance engine | `packages/governance/src/*` | **KEEP** | Priority-ordered policy evaluation with explainable decisions is exactly archit §7's "governance hook" shape; just needs a durable decision log (currently only an `onDecision` callback, no store). |
| Execution engine (fibers) | `packages/execution/src/*` | **REFACTOR** | Best "step loop" primitive in the repo (deterministic, HLC-journaled, replayable) but in-memory and nearly unused; back its journal with the substrate and make it the real driver behind `SurfaceHost`, or retire it if `cognitive-loop`'s episode model supersedes it. |
| Event bus (in-memory) | `packages/events/src/in-memory-bus.ts` | **KEEP (as reference semantics)** | Explicitly documents itself as the reference semantics adapters must preserve — correct design, keep as the test/dev default. |
| Event transport adapters (file/Postgres) | `packages/adapters/src/durable.ts`, `supabase.ts` | **KEEP** | Mature, conformance-tested, exactly the adapter-boundary discipline archit §12 wants. |
| Migration 0001 (`events`, `world_state_*`) | `supabase/migrations/0001_core_substrate.sql` | **RETIRE or EXTRACT** | Provisioned, never wired to any adapter — dead schema. Either wire a real writer or drop it before it misleads a future reader into thinking it's the causal record. |
| `TieredMemoryStore` | `packages/memory/src/tiered-store.ts` | **REFACTOR** | Correct mutation/projection shape for operational-ish memory, but in-memory only and not integrated with the Postgres `memory_mutations` table it schema-matches. |
| `WorldStateGraph` | `packages/world-state/src/graph.ts` | **REFACTOR** | Solid DAG-checked delta-log graph; needs a durable adapter (the `world_state_*` tables already exist, unused) before it can be a substrate authority rather than a per-process cache. |
| `KnowledgeGraphEngine` | `packages/world-state/src/kg-engine.ts` | **EXTRACT** | Education-specific concept-depth taxonomy and curriculum decomposition inside a generic substrate package — belongs in an education *environment* package per CLAUDE.md §5/§3 ("domain concepts never leak into the substrate"). |
| Context lease + `ContextAssembler` | `packages/kernel/src/context-lease.ts`, `packages/context/src/*` | **REFACTOR / MERGE** | Duplicate authority with `cognitive-loop`'s `ContextCompiler`/`ContextManifest` — two context-compilation systems from two eras must become one ("one semantic authority" law). |
| `cognitive-loop` (Constitution/AdaptivePolicy/Governor/Compiler/Manifest) | `packages/cognitive-loop/src/*` | **KEEP, widen** | The single closest-to-target implementation of persistent cognitive identity, governed adaptation, and causal provenance in the repo. Durable (migration 0005). The right foundation to generalize beyond one strategy dimension. |
| `CognitiveUnitHost` + lifecycle FSM | `packages/runtime/src/*` | **KEEP** | Real process lifecycle with observable transitions; needs durable state reconstruction from its own emitted events to be a true "residency is a cache" process. |
| `DepthScheduler` | `packages/scheduler/src/depth-scheduler.ts` | **KEEP** | Production-grade scheduling primitives; currently under-used (only via product-cognition dispatch) — wire it into the live gateway path. |
| Model adapters | `packages/adapters/src/model.ts` | **KEEP** | The strongest example of "everything replaceable behind a contract" in the repo; typed provider-error taxonomy is worth preserving as-is. |
| Postgres/Storage adapters | `packages/adapters/src/supabase.ts` | **KEEP** | Mature, real, conformance-tested, live-verified (per repo memory) — this is the durability story to build everything else onto. |
| Source environment (`source-environment`, `sources.ts`, modality adapters, PDF adapter) | `packages/source-environment/*`, `apps/api/src/sources.ts`, `packages/adapters/src/pdf.ts` | **KEEP** | The best "environment" instance in the repo: ontology, progressive availability, honest degradation, idempotent ingestion, replayable. Extract into a cleaner pluggable-package boundary eventually, but the logic itself is sound and should not be rewritten. |
| Governed web crawler | `apps/api/src/crawler.ts` | **KEEP** | Real SSRF-safe engineering; preserve regardless of layer reshuffling. |
| `SurfaceHost` | `apps/api/src/host.ts` | **REFACTOR** | Functionally excellent (durability, rehydration, resume cards, multi-store wiring) but a 1,458-line god-object violating "one concept, one authority" — decompose into composition + per-concern services once the kernel/harness layers are real enough to host them. |
| `apps/web` (surface projection) | `apps/web/src/*` | **KEEP** | Correctly a thin projection of streamed state; no rearchitecture needed, just carry it forward as environments/harness evolve underneath. |
| `apps/mcp` | `apps/mcp/src/*` | **KEEP** | Small, clean, provably respects the dependency-direction law via the SDK-only import boundary. |
| `apps/cli` / `wiring.ts` | `apps/cli/src/*` | **REFACTOR** | Useful dev/demo tool and the de facto composition root, but 1,281 lines of hand-wiring should become a declared environment/manifest composition once one exists. |
| Evaluation engine | `packages/evaluation/src/*` | **KEEP, widen** | Real heuristic+LLM-judge verifier separate from generation; needs more independent, measured-validity evaluators per environment (archit §10 "environments are evaluated too"). |
| `services/control-plane`, `event-bus`, `workflow-worker` | `services/*` | **RETIRE (or build from scratch)** | Empty placeholders — no code, no value to preserve; either implement for real against `WorkflowRuntime`/`GraphStore` contracts or delete the directories. |
| `services/data-plane` | `services/data-plane/src/*` | **KEEP** | Real, minimal OTel sink — small but functional, no reason to touch. |
| `WorkflowRuntime`, `GraphStore` contracts | `packages/contracts/src/index.ts` | **UNKNOWN** | Declared, never implemented, never consumed — pure aspirational interface. Decide whether the target architecture still wants a Temporal-style workflow runtime or a graph-native store before investing. |
| `packages/testing` | `packages/testing/*` | **RETIRE** | Effectively empty; not worth preserving as-is. |
| Auth (learner API key) | `apps/api/src/learners.ts` (via `host.ts`) | **REFACTOR** | Works, but is a single opaque bearer with no rotation/expiry and RLS policies that were never actually authored (0001 comment says so explicitly) — a real gap before any multi-tenant or human-facing trust claim. |

## Mature, working infrastructure worth preserving regardless of layer reshuffling

1. **Postgres/Storage adapter layer** (`packages/adapters/src/supabase.ts`) — conformance-tested against the
   same contracts as the in-memory/file reference implementations; this is the durability foundation to build
   everything else on top of.
2. **Model provider adapter** (`packages/adapters/src/model.ts`) — typed error taxonomy, guarded dynamic import,
   deterministic offline reference implementation that actually answers the declared schema (not a generic
   stub) — a rare case of a "test double" that's honest about the real contract.
3. **Source/document ingestion pipeline** (`packages/source-environment`, `apps/api/src/sources.ts`,
   `packages/adapters/src/pdf.ts`) — idempotent, event-sourced, honestly-degrading, replayable; seven working
   modality adapters plus a real PDF text/heading extractor.
4. **Governed web crawler** (`apps/api/src/crawler.ts`) — correct SSRF defense (metadata-IP, private ranges,
   redirect re-validation), a security control that would be expensive to get right again from scratch.
5. **Deploy pipeline** (`vercel.json`, `render.yaml`, plus the documented ephemeral-disk incident and its fix
   via migrations 0004/0005) — a working, live, previously-incident-tested deploy setup; the fix itself (durable
   learner/policy stores) is genuine production hardening, not speculative work.
6. **`cognitive-loop`'s governed-adaptation + causal-chain reconstruction** — small in scope but the only place
   in the repo where "why did this change happen" is answerable purely from the event log, which is exactly the
   kind of narrow, real, closed loop CLAUDE.md §5 asks to widen rather than replace.

## Key gaps versus `archit/11-gap-map.md` (confirmed, not just theoretical)

- **G2 (persistent cognitive state)** and **G17 (long-horizon cognition)**: no working-state/goal/open-question
  object exists; nothing resumes mid-task cognition across a restart — only completed artifacts and world/memory
  snapshots survive.
- **G8 (claim unification)**: no system-level `Claim`/`Belief` object anywhere; "claim" code that exists
  (`product-cognition/claim-graph-service.ts`) models the *learner's* claims for teaching purposes, not the
  system's own epistemics.
- **Effect ledger** (archit §7): genuinely absent — no exactly-once external-effect settlement anywhere in the
  tool/action model.
- **One semantic authority**: violated at least twice in code (two context-compilation systems; education
  concepts inside the generic world-state package).
