# 11 — The Cognitive Harness Runtime (DeepSeek-Harness synthesis)

*Part of the [Living Cognitive Agents](README.md) corpus. It synthesizes **DeepSeek Harness** (dsh,
studied from its own source/docs) with [Prime Agent](09-cognitive-environment-runtime.md) and the
[Master Architecture](10-master-cognitive-architecture.md) into the composable, traceable execution
substrate for UCI cognitive processes. Read it after [`09`](09-cognitive-environment-runtime.md)
(the environment cognition runs *inside*) and [`10`](10-master-cognitive-architecture.md) (the whole
system). This file owns the **execution/composition/traceability** layer; it does not re-own the
environment (09), the society (10 §4–§6), or evaluation (06 §5).*

**Status:** `SPECIFICATION` (mostly `TARGET`) over a `RESEARCH` corpus. Some of it is **already
built** — the [`@inevitable/cognitive-loop`](../../../packages/cognitive-loop) walking skeleton is the
seed harness; those parts are labelled `CURRENT`. DeepSeek Harness is **MIT-licensed architectural
reference only** — never (yet) a production dependency (§11). Graduates into `uci-architecture.md`
one ADR at a time; [ADR-0066](../../architecture-decisions/ADR-0066-cognitive-harness-runtime.md)
records the direction.

---

## 0. What DeepSeek Harness actually is (from its source, not summaries)

dsh (`npx @deepseek-ai/dsh`) is a coding-agent framework built on **Cordis** — a plugin kernel
(*"A Programming Paradigm for Spatiotemporal Composability"*; it has powered Koishi for years). The
tagline is *"everything is a plugin."* Verified from `docs/architecture.md`:

- **Kernel = a shared `ctx`.** There is **no immutable core**; every capability mounts onto `ctx` as
  a plugin, and every registration is a **reversible effect** that cleans up on unload. Plugin
  lifecycle = start / stop / reload.
- **Services are named capabilities on `ctx`** (Service Definition + Provider + Consumer seam):
  `ctx.sessions` (append-only `SessionEvent` log + in-memory state), `ctx.systemPrompt` (prompt-section
  + tool-schema assembly), `ctx.tools` (scoped, guarded registry), `ctx.agents` (live registry),
  `ctx.agentLoop` (default driver), `ctx.llm` (message/stream vocabulary + adapter seam), plus
  `ctx.fs / shell / subprocess / sandbox / terminals / jobs`. **A single provider swap re-points the
  whole product** (e.g. filesystem+subprocess → a remote sandbox moves Bash/PTY/LSP at once).
- **Two event domains — the load-bearing distinction.**
  **Durable `SessionEvent`s** (appended, broadcast via `session/event`, survive reload):
  `user/message`, `assistant/message`, `tool/call`, `tool/result`, `step/start|end`, `turn/start|end`.
  **Live `agent/*` events** (carry a live `Agent` object; observe/intercept in-flight):
  `agent/pre-step`, `agent/request`, `agent/turn-stopping`. **Capability events** (`fs/* · tools/* ·
  telemetry/*`) attach policy/adapters to a seam without importing the loop.
- **The reconstruction law (dsh's own words):** *"Model-visible means logged. Anything that reaches a
  model request must be reconstructable from the log."* `deriveMessages()` projects model history from
  the durable stream; **fork, resume, transcripts, telemetry, persistence all derive from that one
  append-only stream**; new model-visible input *requires* a new `SessionEventMap` type.
- **The step/turn pipeline** (waterfall hooks call `next()` to delegate): `turn/start` → assemble
  sections+schemas → `agent/pre-step` → `step/start` → append `user/message` → `deriveMessages` →
  `agent/request` → `llm/stream` → `assistant/chunk*` → `assistant/message` → `tool/call*` →
  `tools/pre-execute` → `tools/execute` → `tools/post-execute` → `tool/result*` → `step/end` →
  `agent/turn-stopping` → `turn/end`.
- **Composition = profiles ▸ bundles ▸ patches.** A profile lists bundles (`dsh-base`, `dsh-web-app`)
  then layers `cordis.patch.yml` ▸ home patch ▸ `--patch`; patches target config rows by ID
  (replace/insert). `dsh --profile web --dump-config` prints the composed boot tree.

**The boundary that matters (directive §11):** dsh's *ontology* is a **coding-agent chat loop** —
`user/message` / `assistant/message` / `deriveMessages` / `tool/call`. UCI's ontology is Cognitive
Objects, world-state, learner/epistemic state, living documents, surfaces (§18, [`10` §2.1](10-master-cognitive-architecture.md#21-the-locked-conceptual-stack-canonical)).
**We adopt dsh's *mechanisms*, never its ontology.** UCI must not become a coding-agent runtime.

---

## 1. The synthesis in one sentence

> **Prime** gives persistent cognition (state out of the window, into a programmable environment);
> **DeepSeek Harness** gives composable, interceptable, fully-reconstructable *execution* over that
> state (capability seams · durable-vs-live events · the reconstruction law · transactional setup);
> **UCI** supplies what cognition operates on and for (Cognitive Objects, world/learner/epistemic
> state, living documents, surfaces, human continuity, governed adaptation, domain-generality).
> The **Cognitive Harness** is the composable execution environment of a single cognitive process —
> the runtime seam where all three meet.

---

## 2. DeepSeek → UCI mapping (KEEP · GENERALIZE · WRAP · EXTRACT · DEFER · REJECT)

Per directive §16: for every dsh concept, the current UCI equivalent, the gap, and the action. "Now"
column names what is already in [`@inevitable/cognitive-loop`](../../../packages/cognitive-loop).

| dsh concept | Current UCI equivalent | Gap | Action | Now |
|---|---|---|---|---|
| Cordis `ctx` kernel + named services | ports (`Faculty`, `PolicyStore`, `CognitiveEventLog`); DI in `wiring.ts` | no registry/composition object; no protected-kernel line | **GENERALIZE** → CapabilityRegistry + protected kernel (§4) | `CURRENT` (registry seed) |
| `ctx.llm` adapter seam | `ModelRuntime` (contracts) + `Faculty` | already a clean seam | **KEEP** | `CURRENT` |
| `ctx.sessions` append-only `SessionEvent` log | `EventBus`/`FileEventTransport`; `CognitiveEventLog`; canonical `events` table (unused) | durable table unused; no derive layer | **GENERALIZE + durablize** (L1.5) | `CURRENT` (in-mem) |
| durable vs live `agent/*` events | durable `CognitiveEvent`s only | **no live/hook channel** | **EXTRACT** → live HookBus + promotion (§5) | `TARGET` |
| reconstruction law + `deriveMessages()` | `CompiledContext.provenance` | not a full manifest; not reconstructed-from-log | **GENERALIZE** → ContextManifest + `reconstructContextManifest` (§6) | `CURRENT` |
| `tools/pre|execute|post` + approval | `AdaptationGovernor` gate; `GovernedToolRuntime` (ADR-0019) | tool-only; not a general action pipeline | **GENERALIZE** → Cognitive Action Pipeline (§7) | `TARGET` |
| transactional agent setup | `wiring.ts` static construction; no formation | no resolve→validate→commit/rollback | **EXTRACT** → Formation Transaction (§8) | `TARGET` |
| profiles ▸ bundles ▸ patches | none (fixed wiring) | no runtime composition | **GENERALIZE** → Harness Composition (§3) | `TARGET` |
| replay / fork / resume from the log | event replay exists; no fork | fork/resume of a *process* | **DEFER** (after live channel) | `SPECULATIVE` |
| `ctx.jobs` background work | `DepthScheduler`; interrupt-cancel (ADR-0063 F) | no background cognitive jobs | **DEFER** (Phase 7) | `SPECULATIVE` |
| `ctx.sandbox / shell / terminals` | `GovernedToolRuntime` | code-mode is coding-agent-specific | **WRAP if needed / else REJECT** | `SPECULATIVE` |
| chat message ontology (`user/assistant`) | Cognition Packets, Cognitive Objects | — | **REJECT** (do not adopt) | — |

**One-line reading:** almost every dsh mechanism maps to *generalize/durablize what we have*; only
the coding-agent ontology is rejected outright, and only code-mode/sandbox is deferred as
domain-specific.

---

## 3. The Cognitive Harness (composition model)

A **Cognitive Harness** is the composable, inspectable execution environment handed to one cognitive
process. It is **not an opaque dependency bag — its composition is itself inspectable** (directive §7):

```
CognitiveProcess = Model Faculty + Constitution + Adaptive Policy + Context Compiler
                 + Memory scope + World-State scope + Cognitive-Object scope
                 + Capability Envelope + Tools + Skills + Verification Policy
                 + Scheduler + Execution Environment + Observability + Lifecycle
```

Composed in layers (dsh profiles ▸ bundles ▸ patches, generalized), each layer *narrowing* the last —
never duplicating systems ([`10` §8](10-master-cognitive-architecture.md) profiles):

```
Base UCI Runtime → Runtime Profile → Domain Society → Formation Spec → Task Overlay → Cognitive Harness
```

`CURRENT`: `CognitiveHarness` composes the process capabilities (compiler · faculty · reflection ·
governor · policy store · event log) from a `CapabilityRegistry` and exposes `describe()` (the
composition manifest — *"what environment was this process given?"*). Profiles/societies/task-overlays
are `TARGET`: the same composition mechanism, more layers.

---

## 4. Capability seams + the protected kernel (§4, §17 discipline)

The core insight is **not** "everything is a plugin" — it is *"everything that should be replaceable
has a meaningful capability seam, and the kernel that guarantees invariants is small and protected."*

- **Protected kernel (never an arbitrary plugin):** the durable event log's append-only integrity,
  the governance-before-mutation gate, provenance/reconstruction, world-state authority, identity.
  These are UCI *laws* (`CLAUDE.md` §3); a "plugin" that could disable them is a violation.
- **Capability seams (pluggable):** model + model routing · memory/vector/storage providers ·
  source acquisition/parsing/rendering · tools · skills · sandboxes/execution envs · schedulers ·
  verifiers · artifact stores · surface renderers · context providers · tracing exporters.
- **The §17 gate — a seam is justified only if** it has a stable contract, plausibly multiple impls,
  independent evolution, a named consumer, defined owned-state + lifecycle, declared durable events,
  a trace, a governance point, and can be removed without corrupting cognitive history. If those
  cannot be answered, the abstraction is premature — **do not add it** (`CLAUDE.md` "complexity must
  earn its place").

```
PROTECTED COGNITIVE KERNEL → CAPABILITY REGISTRY → COMPOSITION RUNTIME → PLUGGABLE CAPABILITIES
```

---

## 5. Two event domains (directive §5 — dsh's deepest transferable idea)

UCI adopts dsh's split explicitly. **Durable noise pollution is forbidden**; important live
transitions are **promotable** to durable facts when they become meaningful.

| | **Durable Cognitive Events** | **Live Runtime Events (hooks)** |
|---|---|---|
| Purpose | replay · reconstruction · provenance · state fold · audit · learning · memory | interception · policy · observability · cancellation · transformation |
| Home | the append-only log (source of truth) | an ephemeral HookBus, never persisted as fact |
| UCI examples | `cognitive.process.formed` · `context.compiled` (carries the ContextManifest) · `model.request.issued` · `output.accepted` · `artifact.created` · `tool.result.finalized` · `verification.completed` · `reflection.recorded` · `policy.proposed|accepted` · `surface.mutation.committed` | `pre-step` · `pre-context-compile` · `pre-model-request` · `stream-chunk` · `pre-action` · `action-executing` · `post-action` · `pre-surface-mutation` · `process-stopping` |
| dsh analog | `SessionEvent` (`user/message`…`turn/end`) | `agent/*` waterfalls (`agent/pre-step`…) |

`CURRENT`: cognitive-loop emits the durable family with causal links. `TARGET`: the live HookBus
(waterfall `next()` semantics for interception) + a `promote(liveEvent) → durable fact` path.

---

## 6. The Context Manifest + the reconstruction law (constitutional)

Adopt dsh's law as a **UCI constitutional invariant**: **anything that reaches the model MUST be
reconstructable from the durable log.** This is not logging — it is **cognitive provenance**: the
system can answer *"why did the model see this?"* for every significant element.

Every model invocation emits a durable **`ContextManifest`** capturing: `request_id · process_id ·
agent/archetype · model/provider + config · constitution id+version · adaptive-policy ref+version ·
goal refs · memory refs · world-state refs · cognitive-object refs · skill refs · capability manifest ·
system sections · compiler + compaction + budget decisions · provenance`. `reconstructContextManifest(log,
request_id)` returns it **from the log alone**.

`CURRENT`: `context-manifest.ts` in cognitive-loop — the manifest is built each episode, emitted in the
`context.compiled` durable event, and reconstructed from the log (tested). Memory/world/skill ref lists
are typed seams, populated as those faculties are wired (honest emptiness, not omission).

---

## 7. The Cognitive Action Pipeline (§10 — generalize tools)

A tool is not `call → result`. Every side-effecting cognitive action flows one pipeline, which also
enforces the live/durable split (hooks are live; the finalization is durable):

```
proposal → authorization → capability check → precondition → [pre-action hook]
        → execution → observation → postcondition → result finalization
        → DURABLE EVENT → state / surface / trace projection
```

It generalizes beyond tools to: memory writes · world-state mutations · surface mutations · document
transformations · artifact creation · subprocess formation · policy changes · autonomous actions —
each a typed mutation through governance (`CLAUDE.md` §3), never a bare side effect. `CURRENT`: the
policy-change action already runs a thin version (propose→govern→durable `policy.accepted`). `TARGET`:
the general pipeline + live hooks.

---

## 8. Formation is transactional (§9)

Dynamic formation ([`10` §4.3](10-master-cognitive-architecture.md#43-layer-c--dynamic-formation-per-task-then-retired))
never publishes a half-configured process. Borrowing dsh's transactional setup:

```
formation proposal → constitution resolution → skill resolution → capability resolution
→ model resolution → memory/world scope resolution → policy validation → budget resolution
→ governance validation → FORMATION COMMIT → process published    (any critical stage fails ⇒ rollback)
```

`CURRENT`: the `CapabilityRegistry.compose()` is the miniature of this — it validates every **protected**
seam is present before publishing a `CognitiveHarness`, and throws (rollback) rather than publish an
incomplete one. `TARGET`: the full multi-stage formation with constitution/skill/budget resolution.

---

## 9. Cognitive Trace Graph (§12) & replay/fork/resume (§10-dsh)

The durable event log + ContextManifests + causal links form a **Cognitive Trace Graph** (goal →
formation → harness composition → context compilation → model request → action trajectory →
verification → outcome → reflection → adaptation proposal → governance → future policy). It must answer
*why did this result happen · what influenced it · which policy/memory/source/tools · why was a
sub-process formed · what changed after reflection.* `CURRENT`: `reconstructChain` already walks an
accepted change back to its causing outcome ([`10` §11.5](10-master-cognitive-architecture.md#115-the-l2-exit-gate--four-measurements-not-the-agent-changed) metric C).
Evaluation/observability ownership stays in [`06`](06-runtime-data-observability.md) — this file does
not re-own it. **Replay/fork/resume** derive from the durable log exactly as dsh's do (`deriveMessages`
→ our `reconstructContextManifest`/`deriveContext`); fork/resume of a *process* is `DEFER`red until the
live channel and durablization (L1.5) land.

---

## 10. DeepSeek relationship strategy (§14) — recommendation

Four strategies were evaluated (A reference-only · B selective adoption · C adapter/compat layer ·
D fork-and-transform). **Recommendation NOW: Strategy A — reference-only.** Rationale: dsh is
architecturally excellent but its ontology is coding-agent/chat-message-centric; making it a
foundation dependency would couple UCI to that ontology (the one thing the directive forbids). We have
already extracted its architecture from primary source; the mechanisms map to *generalizing our own
code*, not importing its. Cloning into a **git-ignored** `external/deepseek-harness/` is endorsed **for
deeper code-level study only** — cloning ≠ integrating. **Escalate to Strategy C (adapter behind UCI
`CognitiveHarness` contracts)** only if a concrete need appears to *run* a UCI process through dsh's
runtime; **Strategy B** only per-component with license (MIT — compatible) + clean-boundary review;
**Strategy D (fork)** is not justified. UCI domain semantics must never leak into a dsh dependency.

---

## 11. CURRENT · TARGET · SPECULATIVE (honest status)

- **CURRENT (built, `@inevitable/cognitive-loop`, verify-green):** capability registry + protected
  kernel (seed) · `CognitiveHarness` with inspectable `describe()` · ContextManifest + reconstruction
  from the log · durable causal event log · governed policy-change action · the L2 four-measurement loop.
- **TARGET (next slices):** live HookBus + promotion · general Cognitive Action Pipeline · Formation
  Transaction (full) · durablize log+world-state (L1.5) · harness composition by profile/society/task.
- **SPECULATIVE (later, gated):** process fork/resume · background cognitive jobs · sandbox/code-mode ·
  the full domain-society roster · profile catalogue.

---

## 12. Minimal vertical slice + implementation order (§13, §F)

The slice was chosen to be the smallest that proves the *harness* (not the cathedral), and it is
**already largely built** by extending the walking skeleton:

```
one process → governed Constitution → HARNESS COMPOSITION (from a CapabilityRegistry)
→ context compilation → durable events → RECONSTRUCTABLE model request (ContextManifest)
→ traceable action trajectory → reflection → adaptive policy → measurable improvement
```

Order (each earns the next; nothing before its predecessor is proven):
1. **`CURRENT`** — ContextManifest + reconstruction law; CapabilityRegistry + `CognitiveHarness`
   (transactional compose; inspectable). *(this file's code deliverable)*
2. Live HookBus + `pre-model-request`/`pre-action` interception + promotion to durable facts.
3. General Cognitive Action Pipeline (start with world-state + surface mutations).
4. Formation Transaction (full resolve→commit/rollback) — unlocks Layer-C formation.
5. Durablize log + world-state + manifests to Postgres (the L1.5 integrity gate).
6. Harness composition by Profile/Society/Task overlay.

> **Do not build the cathedral first.** The kernel stays small; Cognitive Objects stay first-class
> (§18); a seam is added only when it passes the §4 gate. Loop first, then harness, then society.
