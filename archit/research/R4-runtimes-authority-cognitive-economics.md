# R4 — Persistent Process Runtimes, Durable Execution, Orchestration, Authority, and Cognitive Economics

> Research pass for UCI. Question: which deeper mechanisms from distributed systems, actor systems, durable workflow engines, agent frameworks, capability security and metareasoning should inform how UCI keeps cognitive processes alive, supervised, governed and economically rational? Status vocabulary: OBSERVED (primary source/code/docs directly shows it) · REPLICATED (independent sources/systems converge) · CLAIMED (vendor/author asserts, not independently verified) · CONTESTED (credible sources disagree) · SPECULATIVE (our inference). **This document is not evidence that any UCI capability exists** (CLAUDE.md §2).

## 0. Method and evidence legend

- Sources were read from primary docs, source-adjacent docs, papers, and first-party engineering posts (fetched Sept 2026). Where a fetch failed, facts are marked as from-recall and given a weaker status.
- Each entry: **Citation · Mechanism · Evidence · Strength (H/M/L) · UCI primitive/invariant · Conflicts · Status.**
- "Evidence" means what the source demonstrates (production use, benchmark, paper result), not what it asserts about itself. Vendor throughput numbers are CLAIMED unless independently benchmarked.
- "Inference" paragraphs (marked **⇒ Inference**) are ours and are SPECULATIVE by construction.

## 1. Durable execution engines

The seven-harness study found "stateless steps recomputed from durable records" and "write-ahead tool-call records settled exactly once". Durable execution engines are the mature, general form of that pattern. They all share one core: **a deterministic coordinator re-executed against a journal of recorded non-deterministic results**. They differ on three hard questions — non-determinism, history growth, and code upgrades — and those differences are what UCI must choose between.

### 1.1 Temporal — deterministic replay over event history

- **Citation.** Temporal docs: Workflow Definition (determinism) https://docs.temporal.io/workflow-definition ; Continue-As-New https://docs.temporal.io/workflow-execution/continue-as-new ; Execution limits https://docs.temporal.io/workflow-execution/limits ; Worker Versioning GA + Upgrade on Continue-as-New (blog, 2026-03-30) https://temporal.io/blog/ga-worker-versioning-public-preview-upgrade-on-continue-as-new
- **Mechanism.**
  - Workflow code is re-run from the top on every wake-up; each command it issues (schedule activity, start timer, signal) is matched against the recorded event history. "If a generated Command doesn't match what it needs to in the existing Event History, then the Workflow Execution returns a _non-deterministic_ error."
  - All I/O and randomness live in Activities (at-least-once, retried, result recorded).
  - **History growth:** hard limit 51,200 events or 50 MB; warnings at 10,240 events / 10 MB. Exceeding it terminates the execution. **Continue-As-New** atomically closes the run and starts a new run with the *same Workflow ID and a new Run ID*, passing the latest state as input — "checkpoint your Workflow's state and start a fresh Workflow." Docs also advise continuing-as-new "periodically, depending on how often you deploy" so runs don't pin stale code.
  - **Code upgrades:** (a) *patching* (`patched()/getVersion` branch markers recorded in history); (b) *Worker Versioning* (GA March 2026): each workflow type declares **PINNED** ("stay on the Worker version where they started for their entire lifetime") or **AUTO_UPGRADE** (move to the new deployment; must stay replay-safe via patching). (c) *Upgrade on Continue-as-New* (preview): pinned run is notified `target_worker_deployment_version_changed` and may upgrade at its next CAN boundary. Temporal's own matrix: long-running + CAN ⇒ PINNED + upgrade-on-CAN, **never patch**.
- **Evidence.** Very large production footprint (Temporal Cloud; Uber Cadence lineage since 2017). The limits and versioning semantics are OBSERVED in docs; the move away from patching toward pinning is itself evidence that in-code patch markers accumulate unmanageably ("code complexity that accumulates when patches build up over time").
- **Strength.** H.
- **UCI primitive.** (1) *Identity ≠ run*: a durable process ID survives many bounded "runs" (epochs), each with its own bounded log. (2) *Epoch boundary as the upgrade point*: code/policy changes are applied at an explicit checkpoint, not mid-replay. (3) *History budget* as an invariant with warn/hard thresholds.
- **Conflicts.** Eve (from the harness study) rebuilds behaviour from *current* code every step — closer to AUTO_UPGRADE without patch markers. Temporal says this is safe only if replay stays command-compatible. Restate/Vercel choose pinning to immutable deployments. Inngest chooses step-ID memoization that tolerates edits.
- **Status.** OBSERVED (docs) / REPLICATED (the replay+journal core is replicated by Azure DF, Restate, DBOS, Inngest, Vercel).

### 1.2 Restate — journaled handlers + keyed Virtual Objects

- **Citation.** https://docs.restate.dev/concepts/durable_execution ; https://docs.restate.dev/operate/versioning
- **Mechanism.** A journal records "both the operation and its result" for every call, timer, `ctx.run` side effect; on failure "Restate replays the journal, skipping completed steps".
  **Virtual Objects** are keyed entities where "only one handler can modify state at a time" and "state updates are recorded alongside execution steps … never out of sync with the execution" (state + journal commit together). Handlers can *suspend* while awaiting events (no compute paid on FaaS). Versioning: **immutable deployments** — "requests start and end on the same version"; new requests route to latest; old deployment drained, then removed; "no version compatibility logic is needed".
- **Evidence.** Production use claimed; design OBSERVED in docs. No public lifetime-scale study.
- **Strength.** M-H.
- **UCI primitive.** *Keyed single-writer entity whose state mutation and journal append are one atomic commit* — exactly UCI's "every durable write is a typed mutation through the log". The Virtual Object is the actor/workflow fusion UCI's cognitive process resembles.
- **Conflicts.** Pin-to-deployment is simple for minutes–days, but for a months-long cognitive process it means keeping old code alive for months (see Vercel's warning, §1.6), which pushes back to Temporal's "upgrade at epoch boundary".
- **Status.** OBSERVED.

### 1.3 DBOS — durable workflows as Postgres rows

- **Citation.** https://docs.dbos.dev/architecture ; research lineage: Skiadopoulos et al., "DBOS: A DBMS-Oriented Operating System", VLDB 2022 (from recall).
- **Mechanism.** A library, not a server: workflow + step outcomes are checkpointed to Postgres — "one database write per step … plus two additional database writes per workflow". Recovery: detect interrupted workflows, restart with checkpointed inputs, completed steps return cached outputs, resume from "the last completed step". Requirements: workflow deterministic; steps idempotent. Steps that are themselves DB transactions in the same Postgres can commit their checkpoint in the same transaction (exactly-once for DB effects; at-least-once for external effects). Recovery is keyed by application version (workflows recover only on the version that started them) plus patching.
- **Evidence.** Vendor claim ">40K workflows or steps per second" on one Postgres — CLAIMED.
- **Strength.** M.
- **UCI primitive.** *The log can be a table in the same database as state* — the substrate transaction can include the checkpoint. Directly relevant because UCI already runs on Postgres (Supabase). Demonstrates that durable execution does not require a separate cluster.
- **Conflicts.** None structural; less mature tooling than Temporal for very long histories (no documented history-size limit mechanism comparable to CAN).
- **Status.** OBSERVED (mechanism) / CLAIMED (throughput).

### 1.4 Azure Durable Functions / Durable Task Framework

- **Citation.** https://learn.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-orchestrations (updated 2026-08) ; entities: https://learn.microsoft.com/azure/azure-functions/durable/durable-functions-entities
- **Mechanism.** Event sourcing is explicit: "Instead of directly storing the current state of an orchestration, the Durable Task Framework uses an append-only store to record the full series of actions." At each `await`, the dispatcher commits new events and enqueues work messages, "At this point, the orchestrator function can be unloaded from memory." On wake it "re-executes the entire function from the start to rebuild the local state." Instance IDs can be user-chosen for 1:1 mapping to a business entity. **Eternal orchestrations** use `ContinueAsNew` to reset history.
  **Durable Entities** are actor-like keyed state; **critical sections** lock entities across orchestrations. Notably: the Azure Storage provider has *no* transaction across table and queue, so it uses eventual-consistency patterns; stronger providers (MSSQL, Durable Task Scheduler) exist. Unhandled orchestrator exception ⇒ `Failed`, "You can't retry an orchestration instance after it fails."
- **Evidence.** Large production use in Azure. Replay-induced duplicate logs are a documented gotcha ("replay-safe logging").
- **Strength.** H.
- **UCI primitive.** (1) *Residency is optional*: unload after every commit. (2) *Replay-safe observability*: logs emitted during replay must be suppressed or they lie. (3) *Storage provider semantics matter*: history append and work enqueue must be one atomic unit or you need an outbox.
- **Conflicts.** Same determinism burden as Temporal.
- **Status.** OBSERVED / REPLICATED.

### 1.5 Inngest — step memoization by hashed step ID

- **Citation.** https://www.inngest.com/docs/learn/how-functions-are-executed ; https://www.inngest.com/docs/learn/versioning
- **Mechanism.** Function is re-invoked from the start per step; completed steps are skipped and their stored results injected. Memoization key = hash(step ID + counter). **Tolerant versioning:** added steps run when discovered; removed steps' memoized data is ignored; reordering logs a warning but "memoized steps return their stored results regardless of their position in code"; changing a step's ID forces re-execution. Incompatible rewrites ⇒ new function + routing.
- **Evidence.** Production SaaS; no published failure analysis of the tolerant model.
- **Strength.** M.
- **UCI primitive.** *Name-addressed memoization* (step identity by semantic key, not by position) is the most edit-tolerant replay scheme — it fits a system whose "coordinator" is partly an LLM whose decisions are *not* deterministic and must be recorded, not recomputed.
- **Conflicts.** Weaker than Temporal's strict command matching: silent semantic drift is possible when code changes but IDs don't. Temporal would call this undetected non-determinism.
- **Status.** OBSERVED (docs); correctness at scale CLAIMED.

### 1.6 Vercel Workflow (Workflow DevKit / Workflow SDK)

- **Citation.** https://vercel.com/docs/workflows/concepts (updated 2026-09-10) ; https://vercel.com/blog/introducing-workflow ; https://workflow-sdk.dev/docs/foundations/versioning
- **Mechanism.** `"use workflow"` / `"use step"` compiler directives. "All inputs and outputs are recorded in an event log. If a deploy or crash happens, the system replays execution deterministically." The workflow VM injects determinism: `Math.random()` seeded by runId, `Date.now()` fixed to a run-relative timestamp. Steps are stateless, retried, compiled to isolated routes; while a step runs "the workflow suspends without consuming resources". `sleep('7 days')` and `hook` (typed external-event waits with a resume token). **Skew protection:** runs stay on the deployment they started on; "a rollback does not stop runs on the deployment you rolled back from"; "runs pinned to a deleted deployment never complete or fail on their own, so cancel them".
- **Evidence.** New (public beta Oct 2025); docs OBSERVED.
- **Strength.** M.
- **UCI primitive.** *Ambient non-determinism virtualized by the runtime* (clock and RNG are part of the replay record). And a cautionary invariant: **a pinned process must never be orphaned** — every run needs a liveness owner that can cancel/migrate it when its code disappears.
- **Conflicts.** Pinning vs Temporal's upgrade-at-boundary; the "orphaned pinned run" failure is the concrete cost.
- **Status.** OBSERVED.

### 1.7 Cross-engine comparison (evidence)

| Question | Temporal | Restate | DBOS | Azure DF | Inngest | Vercel WF |
|---|---|---|---|---|---|---|
| Non-determinism | strict command match; NDE error | journal replay | deterministic wf, idempotent steps | replay; code constraints | step-ID memo; warn on reorder | VM-virtualized RNG/clock |
| History growth | 51,200 ev / 50 MB; Continue-As-New | (not documented) | row per step | ContinueAsNew (eternal) | (per-run step state) | (not documented) |
| Code upgrade | Pinned / AutoUpgrade+patch / upgrade-on-CAN | immutable deployments, drain | app-version recovery + patch | versioning guidance, side-by-side | tolerant memo; new fn for breaks | pin to deployment |
| Identity vs run | WorkflowID vs RunID | invocation / object key | workflow ID | instance ID (user-chosen ok) | run ID | run ID |

**⇒ Inference.** Three convergent invariants: (a) a deterministic (or recorded) coordinator plus a journal of settled effects; (b) *bounded* history per epoch with a first-class "continue as new" that carries a compact state; (c) code identity is part of the run's identity, and upgrades happen at declared boundaries. For UCI, the LLM is the coordinator and it is **not** deterministic — so UCI cannot recompute decisions; it must **record decisions as events** (Inngest/Eve style) and treat replay as *re-deriving projections from recorded decisions*, never re-asking the model. This is the single biggest divergence from workflow engines and it is forced.

## 2. Actor models and supervision

### 2.1 Orleans virtual actors

- **Citation.** Bernstein, Bykov, Geller, Kliot, Thelin, "Orleans: Distributed Virtual Actors for Programmability and Scalability", MSR-TR-2014-41 https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/Orleans-MSR-TR-2014-41.pdf ; grain lifecycle docs https://learn.microsoft.com/en-us/dotnet/orleans/grains/grain-lifecycle (2026-01).
- **Mechanism.** A virtual actor "always exists, virtually" (perpetual existence); it is activated on first message and deactivated when idle; callers hold a logical reference, never a location. Single-activation mode: 0 or 1 activation at any time (the paper, from recall, notes the guarantee can be briefly violated under directory failure/partition and is repaired eventually — hence storage uses optimistic concurrency/ETags). Current docs: idle **CollectionAge** default 15 min,
  **CollectionQuantum** 1 min; memory-pressure **activation shedding** (evict older, LRU grains until target); `KeepAlive` timers for critical grains; **grain migration** via dehydrate/transfer/ rehydrate; and the warning "grains aren't always deactivated during some error cases (such as silo crashes). Therefore, applications shouldn't rely on the grain lifecycle always executing during grain deactivations."
- **Evidence.** Production since ~2011 (Halo 4/5 cloud services, Azure, Skype per public accounts). Strong, long-lived.
- **Strength.** H.
- **UCI primitive.** **Durable identity with optional residency.** A cognitive process "exists" as an identity + durable state; residency (an activation holding working state in memory) is a cache created on demand and collectable at any time. Invariant: *nothing required for correctness may live only in an activation; deactivation hooks are never relied upon.* (Matches Prime's passivate/hydrate from the harness study.)
- **Conflicts.** Orleans' single activation is best-effort; Akka/Restate demand a strict single writer. Resolution: residency may duplicate briefly, but **writes must be fenced** (sequence number / ETag / lease epoch) so a zombie activation cannot commit.
- **Status.** REPLICATED (Orleans, Dapr actors, Akka Cluster Sharding passivation, Cloudflare Durable Objects all implement activate-on-demand + idle eviction).

### 2.2 Akka Persistence — event sourcing with snapshots, single writer

- **Citation.** https://doc.akka.io/libraries/akka-core/current/typed/persistence.html ; https://doc.akka.io/libraries/akka-core/current/typed/persistence-snapshot.html
- **Mechanism.** EventSourcedBehavior splits a **command handler** (validate, decide, emit events) from an **event handler** (pure state transition). "For a particular persistenceId only one persistent actor instance should be active at one time. If multiple instances were to persist events at the same time, the events would be interleaved and might not be interpreted correctly on replay" — enforced with Cluster Sharding. Commands are stashed during recovery and persist; side effects run via `thenRun` only after persist; `RecoveryCompleted` gates side effects that must not run during replay. Snapshots: `snapshotEvery(n, keepNSnapshots)` or predicate; recovery = latest snapshot + replay of later events; `withDeleteEventsOnSnapshot` exists but docs warn it loses history; snapshot failure does not stop the actor, recovery failure does; `snapshot-is-optional`.
  **Event adapters** transform events on read/write for schema evolution.
- **Evidence.** Mature (Lightbend, widely deployed since ~2014).
- **Strength.** H.
- **UCI primitive.** (1) *Decide/apply split*: model output is a command; only a validated, persisted event changes state — this is literally UCI's "stages never collapse / a model's output is never a belief by itself". (2) *Snapshots are disposable caches over the log*, not truth. (3) *Effects after persist* (write-ahead). (4) *Upcasting at read time* for schema evolution.
- **Conflicts.** Akka deletes events optionally; UCI's evidence law forbids deleting evidence, but the person-sovereignty law requires complete forgetting — a genuine tension (see §10).
- **Status.** OBSERVED / REPLICATED.

### 2.3 Erlang/OTP supervision — "let it crash"

- **Citation.** Armstrong, *Making reliable distributed systems in the presence of software errors*, PhD thesis, KTH 2003 https://erlang.org/download/armstrong_thesis_2003.pdf ; OTP Supervisor Behaviour https://www.erlang.org/doc/system/sup_princ.html (fetch failed; defaults from recall of OTP docs).
- **Mechanism.** Errors are handled *remotely*: "instead of handling an error in the process where the error occurs, the process dies and the error is corrected in some other process." Supervisors restart children with a strategy — `one_for_one`, `one_for_all`, `rest_for_one`, `simple_one_for_one`/dynamic — child restart types `permanent | transient | temporary`, and a
  **maximum restart intensity** (default 1 restart in 5 s); exceeding it makes the supervisor itself terminate and **escalate** to its parent. The **error kernel** is the small part that must not fail; everything outside it can be written without defensive code.
- **Evidence.** Ericsson AXD301 (the thesis reports nine-nines availability claims for the switch — widely cited, CLAIMED); WhatsApp, RabbitMQ, Discord on BEAM.
- **Strength.** H (as an engineering doctrine); the specific availability figure is CLAIMED.
- **UCI primitive.** (1) *Supervision is structural*: every process has a supervisor identity; failure is a message, not an exception swallowed in place. (2) *Restart budget with escalation*: bounded retries per window, then escalate to the parent (ultimately the person). (3) *Error kernel = UCI kernel*: identity, authority, log, governance must not fail; cognition may crash freely because it restarts from durable state. (4) *Restart type per process*: a transient research subprocess is not restarted after normal completion; a person's continuity process is permanent.
- **Conflicts.** "Let it crash" assumes restart is cheap and side-effect-free. LLM steps are expensive (money, cache warmup) and may have produced unsettled external effects — so restart must consult the write-ahead effect ledger (the harness study's "outcome unknown" state) before re-issuing. Crash-restart for an agent is *not* free, unlike an Erlang process.
- **Status.** REPLICATED (Akka, Orleans, Kubernetes controllers all adopted supervision variants).

### 2.4 Cloudflare Durable Objects — identity-addressed single-threaded objects with alarms

- **Citation.** https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/
- **Mechanism.** "Globally-unique name" per object; "single-threaded and cooperatively multi-tasked" execution; colocated "durable, transactional, and strongly consistent storage" (SQLite, per object); **Alarms API** for durable wake-ups; implicitly created on first access; stay resident "several seconds after being idle before hibernating"; WebSocket hibernation keeps connections without paying for residency.
- **Evidence.** Large production platform (Cloudflare); also the substrate of Cloudflare's Agents SDK (from recall).
- **Strength.** M-H.
- **UCI primitive.** The cleanest commercial instance of *identity + colocated durable state + durable alarm + optional residency* — the four properties a cognitive process needs. Alarms are the primitive for "wake me in 3 days to check if the learner retained this".
- **Status.** OBSERVED / REPLICATED with Orleans.

### 2.5 Leases and fencing tokens — how single ownership is actually enforced

- **Citation.** Gray & Cheriton, "Leases: An Efficient Fault-Tolerant Mechanism for Distributed File Cache Consistency", SOSP 1989; Kleppmann, "How to do distributed locking" (2016) https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html ; Burrows, "The Chubby lock service", OSDI 2006.
- **Mechanism.** A lease is a time-bounded grant; the holder must renew. Because a paused process (GC, VM freeze, network partition) can believe it still holds an expired lease, the storage must reject stale writers: each lease grant carries a monotonically increasing **fencing token**, and the store refuses writes with a token lower than one already seen. Chubby calls these sequencers.
- **Evidence.** Canonical distributed-systems result; failures of lease-without-fencing are well-documented (the Redlock debate).
- **Strength.** H.
- **UCI primitive.** **Ownership is fenced at the log, not asserted by the owner.** Every append to a process journal carries (process_id, epoch, expected_seq); the log accepts only the current epoch's next sequence number. This makes Orleans-style brief duplicate activations harmless and enforces Akka's single-writer rule mechanically. (The harness study observed leases/fences/claims in several systems; this is the invariant that makes them correct.)
- **Status.** REPLICATED.

### 2.6 Level-triggered reconciliation (Kubernetes controllers)

- **Citation.** Kubernetes controller pattern https://kubernetes.io/docs/concepts/architecture/controller/ ; Burns et al., "Borg, Omega, and Kubernetes", *ACM Queue* 14(1), 2016.
- **Mechanism.** Controllers compare *desired* state (spec) with *observed* state (status) and act to converge, repeatedly; they are level-triggered (react to current state), not edge-triggered (react to missed events), so a restarted controller simply recomputes what to do.
- **Evidence.** Industry-standard control plane.
- **Strength.** H.
- **UCI primitive.** Supervisors and schedulers should be **reconcilers over the log**: "which processes should be running/woken/escalated given current durable state?" — recomputed after any crash, never dependent on having seen a transient signal. This is "stateless steps recomputed from durable records" applied to the supervisor itself.
- **Status.** REPLICATED.

**⇒ Inference for §2.** The actor lineage supplies the three things the harness study found fragmented: *durable identity* (Orleans), *single-writer fenced event-sourced state* (Akka), and
*structural supervision with escalation budgets* (OTP). A UCI cognitive process = virtual actor (identity, activate on demand) whose state is an event-sourced aggregate (Akka) whose failures are supervised (OTP) and whose long-running control flow is a durable workflow with epochs (Temporal).

## 3. Agent frameworks: real persistence, memory, state

Evaluation criterion: *what is actually durable, what is the unit of replay, and how are effects settled?* Most frameworks persist **conversation/graph state snapshots**; almost none persist a write-ahead effect ledger. The mature answer to durability is increasingly "delegate to a durable execution engine" (OpenAI SDK + Temporal; Microsoft Agent Framework + Durable Task).

### 3.1 LangGraph — checkpointers, threads, interrupts, store

- **Citation.** https://docs.langchain.com/oss/python/langgraph/persistence ; https://docs.langchain.com/oss/python/langgraph/interrupts ; durable-execution page (redirected; details below marked *recall*).
- **Mechanism.** A **checkpointer** saves graph state per *super-step* into a **thread** ("short-term, thread-scoped memory, including conversation continuity, human-in-the-loop workflows, time travel, and fault tolerance"). A separate **Store** holds "long-term, cross-thread memory" (namespaced K/V, optional semantic search). `interrupt()` persists state and waits indefinitely; `Command(resume=…)` returns a value into the interrupt. Crucially "the runtime restarts the entire node from the beginning — it does not resume from the exact line where `interrupt` was called"; multiple interrupts are matched "strictly index-based"; hence "do not perform non-idempotent operations before `interrupt`". Docs admit checkpoints "can accumulate unboundedly — requiring periodic pruning". *Recall:* durability modes `exit | async | sync`; "pending writes" from successful sibling nodes in a failed super-step are kept so they aren't re-run; side effects should be wrapped in `@task` for durable memoization; time travel = resume or fork (`update_state`) from any prior checkpoint.
- **Evidence.** Widely used; semantics OBSERVED in docs. No published lifetime-scale evidence.
- **Strength.** M.
- **UCI primitive.** (1) *Thread = replay unit; store = cross-thread memory* — a two-tier split UCI already names (working state vs substrate). (2) *Fork from checkpoint* ("time travel") is a genuinely useful primitive for counterfactual evaluation and replay tests. (3) *Negative lesson:* node-granularity replay with index-matched resumes is the Temporal determinism burden re-introduced without its tooling.
- **Conflicts.** Snapshot-per-step (LangGraph) vs event-log-with-replay (Temporal/Akka). LangGraph stores full state each super-step (simple, storage-heavy, no event semantics).
- **Status.** OBSERVED.

### 3.2 Letta (MemGPT lineage) — agents as persistent services

- **Citation.** Packer et al., "MemGPT: Towards LLMs as Operating Systems", arXiv:2310.08560 (2023); https://docs.letta.com/concepts/memgpt ; https://www.letta.com/blog/sleep-time-compute/
- **Mechanism.** The agent is a server-side, DB-backed entity, not a client loop: "stateful agents that function as persistent services". Memory hierarchy: in-context **core memory blocks** (editable by the agent through tools), recall (message history), archival (vector store); newer "MemFS" described as "git-tracked" memory; built-in compaction. **Sleep-time agents**: a second agent sharing memory blocks rewrites them asynchronously ("raw context" → "learned context"); can use a larger, slower model than the primary.
- **Evidence.** MemGPT paper shows improved long-conversation consistency on their evals (paper result, M). Production service exists. Self-editing memory quality is not independently validated.
- **Strength.** M.
- **UCI primitive.** *Agent-as-service with a durable identity* (validates UCI's "agents are persistent identities, not prompts"). *Background consolidation as a separate process with its own model budget.*
- **Conflicts.** Self-editing memory by the same model violates UCI's "stages never collapse" and "verification separate from generation": in Letta, the model writes memory directly, with no claim→belief governance and (in V1) no revision history. MemFS/git tracking is a partial fix.
- **Status.** OBSERVED (mechanism) / CLAIMED (quality).

### 3.3 OpenAI Agents SDK (+ Temporal integration)

- **Citation.** https://openai.github.io/openai-agents-python/sessions/ ; https://docs.temporal.io/develop/python/integrations/openai-agents ; https://temporal.io/blog/announcing-openai-agents-sdk-integration
- **Mechanism.** Sessions store conversation items (SQLite, Redis, SQLAlchemy, Mongo, Dapr, OpenAI Conversations, compaction session, encrypted wrapper). "Before each run: the runner automatically retrieves the conversation history … After each run: All new items … are automatically stored." HITL: `result.to_state()` serializes a paused RunState with pending approvals; resume with approvals. The Temporal integration runs the agent loop inside a Workflow and **every model call as an Activity** so it is "not repeated during Workflow replay"; `activity_as_tool()` makes tools durable activities.
- **Evidence.** Joint OpenAI/Temporal integration, GA'd as a package (1.0.0 on PyPI).
- **Strength.** M-H.
- **UCI primitive.** **Model calls are effects, not computation.** Recording each model response as a settled activity result is the right answer to LLM non-determinism: replay reads the recorded answer. This is the crispest external validation of the harness-study finding.
- **Conflicts.** Session-as-message-list is a transcript, not a typed working state; UCI's law "the context window is never the record" rejects the bare session model.
- **Status.** OBSERVED / REPLICATED (Microsoft Agent Framework durable agents, Vercel WF, Restate all publish the same "LLM call = step" pattern).

### 3.4 Claude Agent SDK / Claude Code — subagents and hooks

- **Citation.** https://code.claude.com/docs/en/sub-agents ; https://code.claude.com/docs/en/hooks
- **Mechanism.** Subagents: "Each subagent runs in its own context window with a custom system prompt, specific tool access, and independent permissions"; tool allowlists/denylists; per-subagent model ("route tasks to faster, cheaper models"); foreground vs background ("Background subagents run concurrently"; they get a *restricted* tool set); resumable by ID via SendMessage; optional persistent `memory` directory. Hooks: lifecycle events incl. `PreToolUse`, `PostToolUse`, `PermissionRequest`, `SubagentStart/Stop`, `PreCompact/PostCompact`, `PreModelSwitch`; a PreToolUse hook exiting 2 "blocks whether or not you print JSON: even a JSON permissionDecision of allow can't override it"; "The hook can deny the call, but staying silent doesn't approve it."
- **Evidence.** Production developer tool at scale; mechanism OBSERVED.
- **Strength.** M-H.
- **UCI primitive.** (1) *Attenuating delegation*: child gets a subset of tools and permissions (not stronger than parent). (2) *Deterministic policy enforcement point outside the model* — governance precedes effect, and a broken/absent hook answer does not grant. (3) *Compaction and model switch are lifecycle events* with hooks — exactly the events UCI's reality tests target.
- **Conflicts.** Attenuation is by tool name, not by resource/argument (no capability over *which file*); permission prompts from background children bubble to the human (ambient escalation path).
- **Status.** OBSERVED.

### 3.5 Google ADK — session, scoped state, events as the only write path

- **Citation.** https://adk.dev/sessions/state/ (was google.github.io/adk-docs)
- **Mechanism.** State keys are scoped by prefix: none = session; `user:` = all sessions of a user; `app:` = all users; `temp:` = "Not Persistent. Discarded after the invocation completes". "State should **always** be updated as part of adding an Event to the session history using session_service.append_event()" via `EventActions.state_delta`; direct mutation "will likely NOT be saved". Separate MemoryService for cross-session recall.
- **Evidence.** Google-maintained OSS framework; OBSERVED.
- **Strength.** M.
- **UCI primitive.** *State change only as an event delta* (events are the spine) and *explicit scope lattice* (invocation ⊂ session ⊂ user ⊂ app) — maps to UCI's process ⊂ person ⊂ system scoping and to consent propagation.
- **Conflicts.** None; weaker than Akka (no single-writer enforcement documented).
- **Status.** OBSERVED.

### 3.6 AutoGen → Magentic-One → Microsoft Agent Framework

- **Citation.** Fourney et al., "Magentic-One: A Generalist Multi-Agent System for Solving Complex Tasks", arXiv:2411.04468 (2024); https://learn.microsoft.com/en-us/agent-framework/overview/ (2026-07).
- **Mechanism.** Magentic-One's Orchestrator keeps a **Task Ledger** (facts, guesses, plan) and a
  **Progress Ledger** (per-step self-assessment: done? looping? progress? next speaker?), with an outer loop that replans on **stall detection** and an inner loop that dispatches. Microsoft Agent Framework is the declared successor of AutoGen + Semantic Kernel: "session-based state management", graph workflows with checkpointing and HITL, a "Harness Agent" with planning, compaction, memory, approvals; and the doctrine "If you can write a function to handle the task, do that instead of using an AI agent."
- **Evidence.** Magentic-One competitive (paper) on GAIA, AssistantBench, WebArena at publication time; ledgers are prompt artifacts, not durable typed state.
- **Strength.** M.
- **UCI primitive.** *Explicit progress ledger with stall detection* — a supervision signal ("no progress in k steps") that is agent-specific but cheap and measurable.
- **Conflicts.** Ledger is model-maintained text: self-report, which UCI's laws say is never evidence. Stall detection must be computed from the log (repeated actions, no new evidence), not asked of the model.
- **Status.** OBSERVED (paper) / CLAIMED (generalization).

### 3.7 CrewAI memory

- **Citation.** https://docs.crewai.com/concepts/memory
- **Mechanism.** Unified `Memory` class replacing short/long/entity memory; LanceDB default; retrieval score = 0.5 semantic + 0.3 recency (exponential decay, 30-day half-life) + 0.2 importance; an LLM infers scope, categories and importance at write time and `extract_memories()` atomizes text.
- **Evidence.** Popular OSS; no published retrieval evaluation.
- **Strength.** L-M.
- **UCI primitive.** Mostly a counter-example: LLM-inferred importance written directly as memory with no provenance or revision is exactly "inference stored as fact". The *composite retrieval score with explicit weights* is a reasonable, tunable baseline for UCI's ranked retrieval.
- **Conflicts.** With UCI's three-memory law (evidence/cognitive/operational have different standards; CrewAI conflates them).
- **Status.** OBSERVED (mechanism); quality CLAIMED.

**⇒ Inference for §3.** The frameworks converge on (a) thread/session as the replay unit, (b) a separate cross-thread store, (c) HITL as persisted pause + typed resume, (d) delegation with tool subsets. They do **not** converge on effect settlement, single-writer enforcement, history bounds, or code-version identity — the things workflow engines solved. The market signal (OpenAI→Temporal, Microsoft→Durable Task) is that agent frameworks are becoming *clients* of durable execution, not replacements for it.

## 4. Protocols for durable tasks (A2A, MCP)

### 4.1 A2A (Agent2Agent) — Task as a durable state machine across trust boundaries

- **Citation.** https://a2a-protocol.org/latest/specification/
- **Mechanism.** Server-generated task ID, optional `contextId` grouping related tasks; states `SUBMITTED, WORKING, INPUT_REQUIRED, AUTH_REQUIRED, COMPLETED, FAILED, CANCELED, REJECTED`; terminal tasks "cannot accept further messages" (immutable); updates by polling, streaming (subscribe/resubscribe), or push notifications to webhooks; "designed for (potentially very) long-running tasks"; artifacts as typed outputs.
- **Evidence.** Linux Foundation project; multi-vendor adoption claimed. Spec OBSERVED.
- **Strength.** M.
- **UCI primitive.** *Child/remote work returns as a durable task handle with a closed state set and immutable terminal state* — the external-facing twin of "children as full durable sessions whose results return as notifications". `AUTH_REQUIRED` as a first-class pause is the right shape for authority escalation.
- **Conflicts.** No "outcome unknown" state: A2A has no notion of an unsettled effect after a crash — the client must poll. UCI needs `UNKNOWN` as a distinct settlement.
- **Status.** OBSERVED.

### 4.2 MCP Tasks — experimental core, then moved to an extension

- **Citation.** https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks ; 2026-07-28 RC post https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/
- **Mechanism.** 2025-11-25 added experimental Tasks: "durable state machines that carry information about the underlying execution state of the request they wrap", for "requestor polling and deferred result retrieval" (call-now, fetch-later). The 2026-07-28 RC moved Tasks to an extension because "production use surfaced enough redesign"; it also **removes the initialize handshake and protocol sessions** — capabilities "travel in `_meta` on every request" and servers run "behind a plain round-robin load balancer"; state is carried by explicit handles minted by tools ("a `basket_id`, a `browser_id`") passed back as arguments.
- **Evidence.** Spec process evidence: the ecosystem tried protocol-level sessions+tasks and retreated to stateless requests + explicit handles within ~8 months.
- **Strength.** M-H (it is a revealed-preference signal from a very widely deployed protocol).
- **UCI primitive.** **Stateless edges, durable handles.** Transport sessions are not where durable state lives; durable identity is an explicit handle stored in the substrate. Matches UCI's "the durable object is the cognitive environment, not the session".
- **Conflicts.** A2A keeps stateful task semantics in-protocol; MCP moved them out. Both agree the
  *task ID* is the durable anchor.
- **Status.** OBSERVED; the redesign itself is REPLICATED evidence that session-bound state fails.

## 5. Multi-agent orchestration evidence and failure

### 5.1 Anthropic multi-agent research system (June 2025)

- **Citation.** https://www.anthropic.com/engineering/multi-agent-research-system
- **Mechanism.** Orchestrator-worker: lead agent plans, spawns parallel subagents with separate contexts; subagents "store their work in external systems, then pass lightweight references back to the coordinator"; effort-scaling rules in the prompt ("Simple fact-finding requires just 1 agent with 3-10 tool calls, direct comparisons might need 2-4 subagents with 10-15 calls each"); checkpointing so agents "resume from where the agent was when the errors occurred"; **rainbow deployments** so code updates don't break running agents; subagents run synchronously (lead waits) — named as a bottleneck.
- **Evidence.** Internal eval: multi-agent (Opus 4 lead + Sonnet 4 subagents) beat single-agent Opus 4 by **90.2%**; on BrowseComp analysis three factors explain 95% of variance, **token usage alone 80%**; agents use ~**4×** chat tokens, multi-agent ~**15×**.
- **Strength.** M (first-party internal eval, not replicated; but unusually candid about cost).
- **UCI primitive.** (1) *Parallel subprocesses are primarily a way to spend more tokens usefully* — i.e., multi-agent is a **compute-allocation** decision, which UCI should make explicitly (§8). (2) *Results by reference* (artifact handle in the substrate, not text in the parent's context). (3) *Rainbow deployment* = pinned-version execution (§1).
- **Conflicts.** Cognition's "Don't Build Multi-Agents" (June 2025, https://cognition.ai/blog/dont-build-multi-agents) argues context fragmentation between parallel agents causes conflicting decisions and favours single-threaded agents with context compression —
  **CONTESTED**: both agree on the mechanism (context sharing is the hard part); they disagree on task class (breadth-first research parallelizes; tightly coupled coding does not).
- **Status.** CLAIMED (numbers) / CONTESTED (generality).

### 5.2 MAST — Multi-Agent System failure Taxonomy

- **Citation.** Cemri, Pan, Yang et al., "Why Do Multi-Agent LLM Systems Fail?", arXiv:2503.13657 (2025; NeurIPS 2025 D&B) https://arxiv.org/abs/2503.13657
- **Mechanism.** Grounded-theory taxonomy of **14 failure modes in 3 categories**: system design (~43.9%), inter-agent misalignment (~32.2%), task verification (~23.8%); 1,642 traces over 7 frameworks; inter-annotator κ = 0.88; an LLM-as-judge annotator released. Top modes: step repetition 15.7%, reasoning–action mismatch 13.2%, unaware of termination conditions 12.4%, no or incomplete verification 8.2%, task derailment 7.4%.
- **Evidence.** Interventions (better role specs +9.4%; added verification +15.6% on ChatDev ProgramDev) helped but were "not consistent".
- **Strength.** M-H (large annotated corpus, good agreement; taxonomy is descriptive, not causal).
- **UCI primitive.** Most top failure modes are **runtime/supervision** failures, not model failures: repetition (needs an effect ledger + dedup), termination unawareness (needs explicit goal/termination predicates in working state), missing verification (needs verifier-gated commit). Each becomes a measurable supervisor signal computed from the log.
- **Conflicts.** None; complements Anthropic's post (which cites similar emergent failures: spawning too many subagents, duplicated searches).
- **Status.** REPLICATED (taxonomy validated across 7 frameworks; failure classes echoed by practitioner reports).

### 5.3 Anthropic, "Effective harnesses for long-running agents" (Nov 2025)

- **Citation.** https://anthropic.com/engineering/effective-harnesses-for-long-running-agents ; code https://github.com/anthropics/cwc-long-running-agents
- **Mechanism.** Work spanning many context windows: an **initializer** session sets up the environment (init script, a structured feature list of 200+ items, a progress log file, an initial git commit); each subsequent **coding session** makes incremental progress and leaves durable artifacts (progress notes, descriptive commits) for the next, amnesiac session.
- **Evidence.** First-party engineering report; qualitative.
- **Strength.** L-M.
- **UCI primitive.** Validates "a different model, on a different day, must be able to continue the same work from the same working state" — but implements the working state as *files the model maintains*. UCI's contribution would be to make that working state typed, harness-owned, and verifiable (feature list → goal graph with verifier-settled status; progress file → journal).
- **Conflicts.** Model-maintained progress notes are self-report (§3.6 critique applies).
- **Status.** CLAIMED.

## 6. Scheduling long-running agents and sleep-time compute

### 6.1 Sleep-time compute

- **Citation.** Lin, Snell, Wang, Packer, Wooders, Stoica, Gonzalez, "Sleep-time Compute: Beyond Inference Scaling at Test-time", arXiv:2504.13171 (2025); code https://github.com/letta-ai/sleep-time-compute
- **Mechanism.** Precompute over a persistent context *before* the query arrives, producing a re-represented context; at query time use less test-time compute.
- **Evidence.** ≈**5×** less test-time compute for equal accuracy on Stateful GSM-Symbolic and Stateful AIME; up to **+13%** accuracy (GSM) / +18% (AIME) by scaling sleep-time compute; **2.5×** lower average cost per query when amortized over multiple related queries; efficacy correlates with
  **query predictability** from context.
- **Strength.** M (single group, synthetic "stateful" benchmarks; plausible and mechanistically clear).
- **UCI primitive.** *Background compute is an investment whose return depends on predicted future demand* — the value of precomputation = P(query | context) × savings × reuse count − cost. This is a VOC calculation (§8) that a scheduler can run.
- **Conflicts.** None direct; related to anytime algorithms (§8.2) and to classic caching / materialized views.
- **Status.** CLAIMED (single study) — mechanism SPECULATIVE-to-plausible beyond math tasks.

### 6.2 Scheduling primitives from the runtimes above (evidence recap)

- **Durable timers and waits** (Temporal timers, Azure durable timers, Vercel `sleep('7 days')`, Restate suspension): waiting costs nothing and survives restarts — OBSERVED/REPLICATED.
- **Idle passivation with LRU/memory-pressure shedding** (Orleans CollectionAge 15 min, activation shedding at 80% memory) — OBSERVED.
- **Priority / fairness**: Temporal task-queue priority and fairness keys (2025, from recall), Inngest concurrency keys and throttling (from recall) — per-tenant fairness is a runtime concern, not agent-specific.
- **Supervisor-owned wakeups**: Vercel's orphaned pinned runs show that every sleeping process needs an owner that can cancel/migrate it.

**⇒ Inference.** A UCI scheduler needs exactly four inputs, all non-agent-specific: *due time* (timers), *trigger* (inbound event admitted to the process's inbox), *priority/value* (see §8), and
*budget* (tokens/money/latency envelope). Sleep-time work is just a low-priority process whose priority is its expected value of precomputation.

## 7. Capability security and delegated agent authority

The harness study found "authority attenuation is inconsistent across systems". The object-capability literature explains *why*: every system surveyed uses **ambient authority** (the agent process holds the user's credentials and tools; checks are by tool name), which structurally invites the confused deputy. Prompt injection is the confused deputy with a natural-language attack surface.

### 7.1 The confused deputy

- **Citation.** Hardy, "The Confused Deputy (or why capabilities might have been invented)", ACM SIGOPS OSR 22(4), 1988 (classic; http://cap-lore.com/CapTheory/ConfusedDeputy.html).
- **Mechanism.** A compiler service with authority to write a billing file is induced by a caller to write over that file, because the service used *its own* authority for a *caller-named* resource. Root cause: designation (naming a resource) is separated from authority (permission to use it). Fix:
  **combine designation and authority** in one unforgeable reference — a capability.
- **Evidence.** Canonical, repeatedly re-found in practice (CSRF, SSRF, cloud IAM role confusion).
- **Strength.** H (conceptual, REPLICATED across decades of vulnerabilities).
- **UCI primitive.** *An agent acting on untrusted content with the person's ambient authority is a confused deputy.* Invariant: **every effect must be authorized by a capability that was designated by the principal whose intent it serves**, not by the process's standing permissions.
- **Status.** REPLICATED.

### 7.2 Object capabilities, attenuation, "capability myths"

- **Citation.** Miller, *Robust Composition: Towards a Unified Approach to Access Control and Concurrency Control*, PhD thesis, Johns Hopkins 2006 (http://www.erights.org/talks/thesis/); Miller, Yee, Shapiro, "Capability Myths Demolished", 2003 (https://srl.cs.jhu.edu/pubs/SRL2003-02.pdf).
- **Mechanism.** Authority flows only by (1) initial conditions, (2) parenthood (creator gets a reference to the created), (3) endowment (creator passes some of its references), (4) introduction (A passes B a reference to C over an existing reference). No ambient authority, no forgeable names.
  **Attenuation** = wrapping a capability in a proxy/caretaker that exposes less (read-only facet, revocable forwarder, rate-limited facet). The **caretaker/revoker** pattern gives revocation. Miller's thesis ties this to the **E vat** model: event-loop actors with promises — the same concurrency model as Orleans/Akka.
- **Evidence.** Realized in E, Caja (Google), Cap'n Proto RPC (Sandstorm/Cloudflare), Agoric (hardened JavaScript / SES, used in production chain), WASI's capability-based handles.
- **Strength.** H.
- **UCI primitive.** (1) *Delegation only attenuates* — a child process's envelope is a facet of the parent's, never a fresh grant. (2) *Revocation by caretaker*: every delegated capability is a revocable forwarder so the parent/person can cut it. (3) The ocap model and the actor model are the
  **same model** (Miller) — so UCI's process runtime and authority model should be designed together.
- **Conflicts.** Pure ocap has weak support for *auditing who holds what* and for *policy expressed over identities* (ACL strengths); hybrid systems (macaroons, Biscuit, Zanzibar-style relations) are the practical compromise.
- **Status.** REPLICATED.

### 7.3 Capability operating systems: seL4 and Capsicum

- **Citation.** Klein et al., "seL4: Formal Verification of an OS Kernel", SOSP 2009 (https://sel4.systems/About/seL4-whitepaper.pdf); Watson, Anderson, Laurie, Kennaway, "Capsicum: practical capabilities for UNIX", USENIX Security 2010 (https://www.usenix.org/legacy/event/sec10/tech/full_papers/Watson.pdf).
- **Mechanism.** seL4: all kernel authority is held via capabilities in CSpaces; derived capabilities are recorded in a **capability derivation tree**, so *revoking a capability revokes everything derived from it*; functional correctness and integrity/confidentiality proven in Isabelle/HOL. Capsicum: `cap_enter()` is "a one-way gate" into **capability mode** — global namespaces (filesystem, PIDs, network) become inaccessible; the process can only use file descriptors it already holds, which carry fine-grained rights (e.g. read-only, no-seek). Adopted by Chromium and FreeBSD base utilities.
- **Evidence.** seL4: machine-checked proofs, deployed in defence/automotive (DARPA HACMS); Capsicum: in FreeBSD since 9.x, used in real daemons.
- **Strength.** H.
- **UCI primitive.** (1) **Derivation tree ⇒ cascading revocation**: every delegated authority envelope records its parent; revoking a person's consent or a parent process's grant revokes all descendant grants. (2) **One-way capability mode**: once a process has read untrusted content it can *enter a mode* where it can only use handles already granted (a taint-triggered attenuation). (3) *Rights on handles, not tool names* — authority over *this* document, not "the read tool".
- **Conflicts.** None; these are the strongest realizations of the ocap principles.
- **Status.** REPLICATED.

### 7.4 Macaroons (and Biscuit) — attenuable bearer credentials

- **Citation.** Birgisson, Politz, Erlingsson, Taly, Vrable, Lentczner, "Macaroons: Cookies with Contextual Caveats for Decentralized Authorization in the Cloud", NDSS 2014 (https://theory.stanford.edu/~ataly/Papers/macaroons.pdf); Biscuit (https://www.biscuitsec.org/, public-key tokens with Datalog caveats; from recall).
- **Mechanism.** Chained HMAC: anyone holding a macaroon can append a **caveat** (predicate: expiry, resource, operation, IP) and compute the new signature *without contacting the issuer*; caveats can only narrow. **Third-party caveats** require a *discharge* macaroon from another service (e.g. "user re-authenticated", "approval granted"). Biscuit replaces HMAC with public-key signatures so any party can verify offline, and expresses caveats as Datalog checks.
- **Evidence.** Deployed (Google internal, Fly.io production auth, Lightning Network LND).
- **Strength.** H.
- **UCI primitive.** **Offline attenuation** fits delegation to child processes and to remote agents: the parent mints a narrowed token (`resource=doc:123`, `op=read`, `until=+1h`, `budget≤$0.50`) without a round-trip; **third-party caveat = human approval** as a cryptographically bound discharge (the right shape for UCI's "governance precedes effect" when the governor is the person).
- **Conflicts.** Bearer tokens can be exfiltrated — by a prompt-injected model in particular — so tokens must never enter model-visible context; the harness holds them and the model refers to them by opaque handle.
- **Status.** REPLICATED.

### 7.5 Prompt injection as an authority problem: dual LLM, CaMeL, FIDES, Progent, design patterns

- **Citations.**
  - Willison, "The Dual LLM pattern for building AI assistants that can resist prompt injection", 2023 (https://simonwillison.net/2023/Apr/25/dual-llm-pattern/); "The lethal trifecta", 2025 (https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/).
  - Debenedetti et al. (Google DeepMind), "Defeating Prompt Injections by Design" (CaMeL), arXiv:2503.18813 (2025) https://arxiv.org/abs/2503.18813
  - Costa, Köpf et al. (Microsoft), "Securing AI Agents with Information-Flow Control" (FIDES), arXiv:2505.23643 (2025) https://arxiv.org/abs/2505.23643 ; productized as ADR in microsoft/agent-framework (docs/decisions/0024-prompt-injection-defense.md).
  - Shi et al., "Progent: Programmable Privilege Control for LLM Agents", arXiv:2504.11703 (2025).
  - Beurer-Kellner et al., "Design Patterns for Securing LLM Agents against Prompt Injections", arXiv:2506.08837 (2025).
- **Mechanisms.**
  - *Dual LLM:* a privileged LLM that never sees untrusted text plans and calls tools; a quarantined LLM processes untrusted text and returns only symbolic variables (`$VAR1`) the privileged side can route but not read.
  - *Lethal trifecta:* private data access + exposure to untrusted content + an exfiltration channel ⇒ assume compromise; remove one leg.
  - *CaMeL:* the privileged LLM writes a program in a restricted Python; a custom interpreter executes it, the quarantined LLM parses untrusted data; every value carries **capabilities (provenance + allowed readers)**; policies are checked at each tool call. AgentDojo: **77% of tasks with provable security vs 84% undefended**.
  - *FIDES:* integrity (TRUSTED/UNTRUSTED) and confidentiality labels on every value, propagated "most-restrictive-wins", with policy checks pre-execution and selective hiding of labelled content from the planner; "stops all prompt injection attacks in AgentDojo" with policies enabled.
  - *Progent:* a DSL of per-tool, per-argument privilege policies with fallback actions and dynamic (LLM-proposed, deterministically enforced) updates; AgentDojo ASR **41.2% → 2.2%**.
  - *Design patterns:* action-selector, plan-then-execute, map-reduce, dual LLM, code-then-execute, context-minimization — each trades utility for a structural guarantee that untrusted input cannot choose the next consequential action.
- **Evidence.** Benchmark results on AgentDojo (a shared benchmark) from three independent groups converge: **structural** defences get near-zero attack success at a single-digit utility cost; prompt-based/detector defences do not provide guarantees.
- **Strength.** M-H (REPLICATED across groups on one benchmark family; real-world adaptivity of attackers untested at scale).
- **UCI primitive.** (1) **Untrusted content is data, never instructions** becomes *mechanical*: values carry integrity/confidentiality labels (UCI's consent labels are the same lattice extended with person consent). (2) **Control flow is fixed before untrusted data is read** (plan-then-execute / CaMeL) for consequential actions. (3) **Policy checks at the effect boundary are deterministic code**, not model judgment (cf. Claude Code hooks, §3.4). (4) Labels propagate through derivations — same machinery as UCI's provenance law.
- **Conflicts.** Utility cost (CaMeL −7 points) and expressiveness limits: open-ended tasks where the plan *must* depend on untrusted content (research, browsing) are exactly where these patterns bite. CONTESTED whether a general agent can be both useful and fully IFC-safe; FIDES' "selective hiding" and CaMeL's quarantined parsing are partial answers.
- **Status.** REPLICATED (structural approach works on benchmarks) / CONTESTED (utility at the open end).

**⇒ Inference for §7 — a UCI authority model.**
1. *Authority envelope = capability set*, each capability = (designated resource, rights, caveats incl. budget and expiry, parent link). Stored in the kernel; referenced by opaque handle in any model-visible context; never a bearer secret in a prompt.
2. *Delegation mints a child capability with caveats appended* (macaroon semantics); the derivation tree (seL4) makes revocation cascade — the mechanical form of "consent revocation propagates".
3. *Taint-triggered capability mode* (Capsicum): when a process ingests UNTRUSTED content, its effect envelope shrinks to pre-granted handles; widening requires a third-party discharge (person approval) — a precise, testable rule.
4. *Every effect record carries the capability used* — so the write-ahead effect ledger is also the authority audit log. This joins §1's effect settlement and §7's authority into one kernel record.

This is agent-independent: it would make sense for any untrusted-input-processing service.

## 8. Metareasoning, value of computation, adaptive compute

The harness study found "no system has an explicit resource or value-of-computation model". The metareasoning literature has had the formal answer for 35 years; the LLM literature is rediscovering it empirically (test-time scaling, overthinking, routing, sleep-time compute).

### 8.1 Rational metareasoning (Russell & Wefald)

- **Citation.** Russell & Wefald, "Principles of metareasoning", *Artificial Intelligence* 49:361–395 (1991) https://www.sciencedirect.com/science/article/abs/pii/000437029190015C ; *Do the Right Thing: Studies in Limited Rationality*, MIT Press 1991; Russell & Subramanian, "Provably bounded-optimal agents", JAIR 1995.
- **Mechanism.** Computations are actions. The **value of computation (VOC)** = expected improvement in the *object-level decision* the computation enables, minus its time/resource cost. "Computation is only worthwhile if it will change what we decide to do." Exact VOC is intractable (computing it is itself computation), so they use **myopic** estimates (value of one more step, assuming you act after it) with a stop rule: stop when no available computation has positive estimated net VOC.
  *Bounded optimality* (Russell & Subramanian): the right target is the best *program* for the machine, not the best action.
- **Evidence.** Formal results + game-tree search improvements (MGSS* etc.) in the original work; foundational, heavily cited.
- **Strength.** H (theory); M (applied at scale).
- **UCI primitive.** **Every cognitive step is a purchase.** Invariant: a step is taken only if its estimated value exceeds its cost; the estimate and the realized outcome are logged, so the estimator can be calibrated (UCI's "verification separate from generation" applied to the scheduler itself).
- **Conflicts.** Myopia under-values computations whose value comes only in combination (e.g. a research plan's first search); non-myopic VOC is hard. Practitioners (Anthropic §5.1) use hand-written effort rules instead.
- **Status.** OBSERVED (theory) / SPECULATIVE (applied to LLM agents).

### 8.2 Anytime algorithms and flexible computation

- **Citation.** Dean & Boddy, "An analysis of time-dependent planning", AAAI 1988; Horvitz, "Reasoning about beliefs and actions under computational resource constraints", UAI 1987; Zilberstein, "Using anytime algorithms in intelligent systems", *AI Magazine* 17(3), 1996.
- **Mechanism.** Algorithms that can be interrupted at any time and return a result whose quality improves monotonically with time, characterized by **performance profiles** (quality vs time); a meta-level **monitor** decides when to stop or reallocate across components (compositions of anytime modules via conditional performance profiles).
- **Evidence.** Decades of applications in planning, real-time AI.
- **Strength.** H.
- **UCI primitive.** *Performance profiles as measurable objects*: for each (task-class, strategy, model) tuple, record quality-vs-cost curves from the log; the scheduler allocates by marginal quality per marginal cost. Interruptibility maps directly to UCI's steer-vs-queue input admission: a steering event is an interrupt to an anytime computation.
- **Status.** REPLICATED.

### 8.3 Computational rationality / resource-rational analysis

- **Citation.** Gershman, Horvitz, Tenenbaum, "Computational rationality: A converging paradigm for intelligence in brains, minds, and machines", *Science* 349:273 (2015); Lieder & Griffiths, "Resource-rational analysis: Understanding human cognition as the optimal use of limited computational resources", *BBS* 43, e1 (2020) https://cocosci.princeton.edu/papers/lieder_resource.pdf ; Griffiths, Lieder, Goodman, "Rational use of cognitive resources", *Topics in Cognitive Science* (2015).
- **Mechanism.** Model cognition as the optimal use of limited resources: pose the computational problem, posit a class of feasible algorithms with costs, derive the algorithm that best trades accuracy against cost, test predictions, refine. Explains heuristics and biases as resource-rational (e.g. anchoring-and-adjustment with few samples; "one and done" sampling — Vul et al. 2014).
- **Evidence.** Many behavioral fits in cognitive science (M-H within its domain).
- **Strength.** M-H.
- **UCI primitive.** A *design method*, not a module: for each UCI cognitive operator, specify its cost model explicitly and choose the operator that is optimal *given* that cost. And a pedagogical bridge for the education domain: learner behaviour is itself resource-rational, so a learner model should include the learner's effort costs.
- **Status.** REPLICATED (in cognitive science) / SPECULATIVE (as an engineering method for UCI).

### 8.4 Value of information and VOI-driven search

- **Citation.** Howard, "Information value theory", IEEE Trans. SSC 2(1), 1966; Hay, Russell, Tolpin, Shimony, "Selecting Computations: Theory and Applications", UAI 2012 https://arxiv.org/abs/1207.5879 ; Sezener & Dayan, "Static and dynamic values of computation in MCTS", UAI 2020.
- **Mechanism.** VOI = expected utility with information − without. Hay et al. formalize the metalevel decision problem for Monte Carlo sampling, prove bounds, and replace UCT at the root with a VOI-based policy — "exploring unpromising or highly predictable paths to great depth is often wasteful".
- **Evidence.** Improved sample efficiency in MCTS experiments (paper results).
- **Strength.** M-H.
- **UCI primitive.** *Ask/verify/search is a VOI decision*: asking the person a question, running a verifier, or doing another retrieval has a computable VOI given the current belief's uncertainty. UCI's calibrated beliefs (confidence + validity) are exactly the input VOI needs; **without calibrated beliefs, there is no VOI** — this links cognitive memory to economics.
- **Status.** OBSERVED (theory) / SPECULATIVE (for UCI).

### 8.5 Test-time compute scaling and adaptive allocation

- **Citation.** Snell, Lee, Xu, Kumar, "Scaling LLM Test-Time Compute Optimally can be More Effective than Scaling Model Parameters", arXiv:2408.03314 (2024; ICLR 2025); Chen et al., "Do NOT Think That Much for 2+3=? On the Overthinking of o1-Like LLMs", arXiv:2412.21187 (2024); related: SelfBudgeter arXiv:2505.11274, BudgetThinker arXiv:2508.17196, "When More Thinking Hurts" arXiv:2604.10739.
- **Mechanism / evidence.** Snell et al.: "compute-optimal" allocation *conditioned on prompt difficulty* improves test-time scaling efficiency ">4× compared to a best-of-N baseline"; FLOPs- matched, "test-time compute can be used to outperform a 14× larger model" on problems where the small model has non-trivial success — and the best strategy "critically varies depending on the difficulty of the prompt". Overthinking: reasoning models spend large token budgets on trivial problems with no accuracy gain (from recall: ~2,000% more tokens than a non-reasoning model on "2+3"), and self-training can cut tokens while preserving accuracy; a 2026 line of work reports
  *negative* returns beyond a point.
- **Strength.** H (Snell is widely replicated in spirit); M for overthinking magnitudes.
- **UCI primitive.** **Difficulty estimation precedes allocation.** The allocator needs a per-task difficulty/uncertainty estimate before choosing effort; uniform effort is provably wasteful. Returns are concave and can turn negative — so "more compute" must be justified by a measured performance profile, not assumed.
- **Conflicts.** Anthropic §5.1 found tokens explain 80% of variance on BrowseComp — "more is better" in breadth-first search; overthinking results say "more is worse" in narrow reasoning. Consistent under VOC: the marginal value depends on task structure. CONTESTED only if generalized.
- **Status.** REPLICATED (adaptive > uniform) / CONTESTED (magnitude and sign of returns by domain).

## 9. Routing, cascades, cost-aware agents, prompt-cache economics

### 9.1 FrugalGPT and cascades

- **Citation.** Chen, Zaharia, Zou, "FrugalGPT: How to Use Large Language Models While Reducing Cost and Improving Performance", arXiv:2305.05176 (2023; TMLR 2024).
- **Mechanism.** Prompt adaptation, model approximation, and an **LLM cascade**: query cheap models first, a learned scorer decides whether to accept or escalate.
- **Evidence.** "match the performance of the best individual LLM (e.g. GPT-4) with up to 98% cost reduction" or "+4% accuracy over GPT-4 at the same cost" on their datasets.
- **Strength.** M (dataset-specific; the upper-bound figure is best case).
- **UCI primitive.** *Escalation gated by a verifier/scorer* — structurally identical to UCI's verification-before-commit: a cheap model's answer is accepted only if an independent check passes; otherwise escalate. Economics and verification share a mechanism.
- **Status.** REPLICATED (cascades reproduced widely: AutoMix, Hybrid LLM, etc.).

### 9.2 RouteLLM and learned routers

- **Citation.** Ong et al., "RouteLLM: Learning to Route LLMs with Preference Data", arXiv:2406.18665 (2024) https://arxiv.org/abs/2406.18665 ; Ding et al., "Hybrid LLM", ICLR 2024; Aggarwal et al., "AutoMix", NeurIPS 2024.
- **Mechanism.** A router predicts, *before* calling, whether the weak model suffices, trained on preference data + augmentation.
- **Evidence.** "reduces costs—by over 2 times in certain cases—without compromising the quality"; routers "maintain their performance even when the strong and weak models are changed at test time" (transfer).
- **Strength.** M-H.
- **UCI primitive.** *Model choice is a per-step decision made by a replaceable policy*, logged with its predicted and realized quality → the router is itself a governed, evaluable, learnable artifact (UCI's "learning is governed change to durable state"). Transfer across model pairs supports UCI's "model is a replaceable faculty".
- **Conflicts.** Routing before seeing output (router) vs after (cascade): routers save the weak call's cost on hard prompts; cascades use more information. Both are VOC approximations.
- **Status.** REPLICATED.

### 9.3 Prompt-cache economics

- **Citation.** Anthropic prompt caching docs https://platform.claude.com/docs/en/build-with-claude/prompt-caching (2026); Lumer et al., "Don't Break the Cache: An Evaluation of Prompt Caching for Long-Horizon Agentic Tasks", arXiv:2601.06007 (2026); Khailo, "Keeping the Cache Warm Pays: Keepalive Economics for Agentic Workloads", arXiv:2607.19214 (2026).
- **Mechanism.** Provider pricing (Anthropic, 2026): 5-min cache write **1.25×** base input, 1-hour write **2×**, cache read **0.1×** (0.05× on Opus 5.5, 0.025× on some newer models). Strict prefix hierarchy `tools → system → messages`: "Changes at each level invalidate that level and all subsequent levels"; changing tool definitions invalidates everything; lookback of 20 blocks.
- **Evidence.** Lumer et al.: caching cuts API cost **41–80%** and TTFT **13–31%** on DeepResearch Bench across OpenAI/Anthropic/Google; *naive full-context caching can increase latency*; placing dynamic content at the end and excluding dynamic tool results is more consistent. Khailo: re-pinging the prefix just under TTL keeps it resident; break-even idle gap ≈ τ(w/r − 1) (~46 min Anthropic); up to **12.5×** lower post-pause request cost; recommends ~4-minute pings for a 5-minute TTL.
- **Strength.** M-H for pricing (OBSERVED); M for the papers (single studies, 2026).
- **UCI primitive.** **Cache residency is a scheduled, priced resource**, just like process residency (Orleans): a warm prefix is an "activation" of a context, with an eviction TTL and a keepalive cost. UCI's context compiler must therefore be **prefix-stable by construction**: stable kernel/constitution/tools first, slowly-changing working state next, volatile step input last. The harness study's observation that "architecture is strongly shaped by prompt-cache economics" is now quantified: a cache-hostile context compiler costs 2–10× more.
- **Conflicts.** UCI's "context is compiled fresh each step" vs cache economics favouring append-only context. Resolution: compile *deterministically* (same inputs → byte-identical prefix) so fresh compilation still hits the cache; order sections by volatility. Keepalive vs "silence is an action": keepalive pings spend money to maintain optionality — a VOC decision (expected resume probability × savings > ping cost).
- **Status.** OBSERVED (pricing) / CLAIMED (paper magnitudes).

### 9.4 Cost-aware agents in practice

- Claude Code routes subagents to cheaper models (§3.4); Letta runs sleep-time agents on larger, slower models (§3.2); Anthropic's research system encodes effort-scaling rules in prompts (§5.1). These are **hand-coded economic policies** — scaffolding in UCI's terms — with no logged predicted-vs-realized value. **No surveyed production system logs cost-per-outcome at step granularity and learns an allocator from it.** (Absence claim: OBSERVED for the systems read here; not a proof of absence industry-wide.)

**⇒ Inference for §§8–9.** The literature supplies a coherent stack: VOC (what a step is worth) → performance profiles (measured quality-vs-cost per strategy) → difficulty/uncertainty estimation (which profile applies) → routing/cascade/effort choice (the action) → cache/residency scheduling (the price) → logged outcome (calibration). Each layer has independent evidence of 2–10× cost savings or quality gains. None of it requires the concept of an "agent".

## 10. Event sourcing vs snapshots at lifetime scale

UCI's substrate is "events are the spine; state is a projection", and it must hold a person's cognitive history for years. Every source below says the same thing: an unbounded single log replayed from zero does not survive lifetime scale; what survives is **log + disposable snapshots + epochs + tiered archival + read-time upcasting + a privacy mechanism that the log was designed for from day one**.

### 10.1 Industry evidence on event-sourced systems

- **Citation.** Overeem, Spoor, Jansen, Brinkkemper, "An Empirical Characterization of Event Sourced Systems and Their Schema Evolution — Lessons from Industry", *JSS* 178 (2021), https://arxiv.org/abs/2104.01146 ; Overeem et al., "The Dark Side of Event Sourcing: Managing Data Conversion", SANER 2017.
- **Mechanism / evidence.** Grounded theory over 19 systems / 25 engineers. Five challenges: **event system evolution**, steep learning curve, lack of technology, **rebuilding projections**, **data privacy**. Five schema-evolution tactics: versioned events, weak schema, **upcasting**, in-place transformation, copy-and-transform. No single standard approach; schema evolution is "one of the most complex challenges".
- **Strength.** M-H (qualitative, but practitioner-grounded and peer-reviewed).
- **UCI primitive.** The three dominant pains (evolution, projection rebuild cost, privacy) are
  *exactly* the three reality tests UCI cares about at lifetime scale: model swap/code upgrade, replay, forget. Design for them in the event contract, not later.
- **Status.** OBSERVED.

### 10.2 Upcasting and versioned event contracts

- **Citation.** Young, *Versioning in an Event Sourced System* (Leanpub, 2017, https://leanpub.com/esversioning); Akka event adapters (§2.2); Axon upcasters (from recall).
- **Mechanism.** Never rewrite stored events; transform old shapes to the current shape **on read** (upcaster chain v1→v2→v3); add fields with defaults ("weak schema"); for large semantic changes, copy-and-transform into a new stream and switch readers.
- **Evidence.** Standard practice across Axon, Akka, EventStoreDB.
- **Strength.** H (REPLICATED practice).
- **UCI primitive.** Every UCI event carries `type@version`; upcasters are pure, tested functions in the contracts package; replay tests run the full upcaster chain. This aligns with UCI's "every exchange is typed … versioned contracts".
- **Status.** REPLICATED.

### 10.3 Snapshots, epochs, compaction, archival

- **Evidence summary (from §§1–2).** Akka: snapshot every N events, keep K, snapshots optional for correctness. Temporal: hard history cap (51,200 events / 50 MB) forces **epochs** via Continue-As-New carrying compact state; completed histories can be exported to archival blob storage (Temporal Archival, from recall). Azure DF: eternal orchestrations with ContinueAsNew; purge APIs for completed instances. Kafka **log compaction** (from recall; Kafka docs) keeps only the latest record per key — a *state* log, not a *history* log.
- **UCI primitive — a proposed three-tier discipline (⇒ Inference, SPECULATIVE).**
  1. **Evidence log** (faithful): never compacted, never rewritten; tiered to cold storage by age; replay from it is rare and offline (recompute interpretations with a new operator version).
  2. **Process journals** (operational): bounded per epoch; an epoch closes with a typed *epoch checkpoint* (working state + open effects + capability set + code/policy version) and a new epoch begins — Continue-As-New for cognitive processes. Old epochs archive.
  3. **Projections/snapshots** (cognitive and operational views): disposable, rebuildable, versioned by the projector version that built them; never a source of truth. The key rule: **snapshots accelerate; they never replace.** A snapshot that cannot be regenerated from logs is a bug.
- **Conflicts.** Epoch checkpoints are themselves a summary — the harness study's compaction risk ("summarize away raw evidence"). Mitigation: the checkpoint *references* evidence by ID; it summarizes only working state, never evidence.
- **Status.** REPLICATED (snapshots/epochs) / SPECULATIVE (the three-tier mapping).

### 10.4 Forgetting in an append-only world

- **Citation.** Verraes, "Eventsourcing Patterns: Forgettable Payloads" and "Crypto-Shredding" (2019) https://verraes.net/2019/05/eventsourcing-patterns-forgettable-payloads/ , https://verraes.net/2019/05/eventsourcing-patterns-throw-away-the-key/ ; legal caveat discussion https://event-driven.io/en/gdpr_in_event_driven_architecture/
- **Mechanism.** *Forgettable payload*: events hold a reference; personal content lives in a deletable side store. *Crypto-shredding*: per-subject encryption keys; delete the key to render all that subject's payloads unreadable, including in backups.
- **Evidence.** Widely used; legal status **CONTESTED** — commentators note that under GDPR encrypted personal data is still personal data, so key deletion alone may not satisfy erasure.
- **Strength.** M.
- **UCI primitive.** *Person-scoped keys + payload indirection from day one.* Events are the spine, but the *content* of person-derived evidence is referenced, not embedded, so "completely forgettable" is achievable without rewriting the log; derived beliefs carry consent labels so forgetting cascades to derivations (same derivation tree as capability revocation, §7.3).
- **Conflicts.** Directly with "evidence is sacred" — resolution in UCI's own laws: the person is sovereign; evidence is sacred *against revision by the system*, not against deletion by its owner. The forget reality test must verify no derivative survives (projections rebuilt, caches — including provider prompt caches — expired).
- **Status.** REPLICATED (patterns) / CONTESTED (legal sufficiency).

## 11. Synthesis

Everything in this section is **⇒ Inference** built on the evidence above. Status labels refer to the strength of the underlying evidence, not to anything existing in UCI.

### 11.1 Well-proven runtime primitives vs agent-specific ones

**Well-proven (decades of production, REPLICATED across independent systems):**

| Primitive | Proven by | Invariant UCI inherits |
|---|---|---|
| Append-only journal + deterministic/recorded replay | Temporal, Azure DF, Restate, DBOS, Akka | State is a function of the log; replay reproduces it |
| Effects recorded before/after, settled once, retried idempotently | Temporal activities, DBOS steps, Restate `ctx.run` | No effect without a ledger entry; retries are idempotent or marked UNKNOWN |
| Bounded history per epoch + continue-as-new | Temporal, Azure DF eternal orchestrations | Journal size has warn/hard limits; epochs carry compact typed state |
| Code version as part of run identity; upgrade at boundaries | Temporal Worker Versioning, Restate, Vercel skew protection | A step executes under a known code/policy version; switching happens at epoch boundaries |
| Virtual identity, activation on demand, idle passivation | Orleans, Durable Objects, Akka Sharding, Dapr | Nothing required for correctness lives only in memory |
| Single writer enforced by fencing | Leases+fencing (Gray/Cheriton, Chubby), Akka sharding | The log rejects stale epochs; owners don't self-certify |
| Supervision trees, restart budgets, escalation | Erlang/OTP, Akka | Failure is a message to a supervisor; bounded restarts then escalate |
| Level-triggered reconciliation | Kubernetes | Supervisors/schedulers recompute from durable state after crash |
| Durable timers / alarms / suspension | Temporal, Durable Objects, Vercel WF | Waiting is free and survives restart |
| Object capabilities, attenuation, cascading revocation | E/Caja/Agoric, seL4, Capsicum, macaroons | Authority = unforgeable designation; delegation only narrows; revocation cascades |
| Read-time upcasting of versioned events | Akka, Axon, EventStoreDB, Young | Events are never rewritten; readers adapt |
| Anytime computation, VOC/VOI, cascades | Russell–Wefald, Zilberstein, FrugalGPT, RouteLLM | A computation is bought only if its expected value exceeds its cost |

**Agent-specific (new; evidence mostly 2023–2026, single-group or first-party; CLAIMED/CONTESTED):**

- **Model call = recorded effect** (OpenAI SDK + Temporal; Vercel; MAF). Forced by LLM non-determinism; the *decision itself* must be journaled because it cannot be recomputed. Well motivated, young.
- **Context compilation under cache economics** (prefix stability, volatility ordering, keepalive). Priced by providers, measured by two 2026 papers.
- **Structural prompt-injection defence** (dual LLM, CaMeL, FIDES, Progent). Converging on AgentDojo; generality to open-ended tasks CONTESTED.
- **Multi-agent as parallel token spend** (Anthropic) vs **single-thread context integrity** (Cognition). CONTESTED by task class.
- **Sleep-time / background consolidation** (Letta). Single study; mechanism = precomputation under predicted demand.
- **Failure taxonomy of multi-agent systems** (MAST). Descriptive; most modes are runtime/supervision failures rather than model failures.

The important finding: **almost every agent-specific problem the harness study found has an older, general solution** — the novelty is (a) the coordinator is non-deterministic and must be journaled, (b) the "attacker" can speak through data, (c) compute has a continuous quality/cost dial.

### 11.2 Durable identity + optional residency + supervision for cognitive processes

A proposed model assembling the proven pieces (SPECULATIVE as a whole; each piece REPLICATED):

1. **Identity.** A cognitive process has a durable `process_id` that outlives all of its runs, epochs, activations, models, and machines (Orleans perpetual existence; Temporal WorkflowID). Eve's separation of *identity / ownership / replay unit* maps onto: `process_id` (identity) · `(epoch, lease_token)` (ownership) · `epoch journal` (replay unit).
2. **Durable state.** The process is an event-sourced aggregate (Akka): a decide step (may involve a model call, recorded as an effect) emits typed events; a pure apply step folds them into working state; only persisted events change state; effects run after persist.
3. **Epochs.** The journal is bounded; at a threshold, or at a code/policy upgrade, or at a natural boundary (goal completed, day ended), the process writes an **epoch checkpoint** — typed working state + open effects (incl. UNKNOWN ones) + capability set + versions + references (not copies) to evidence — and continues as new (Temporal CAN, upgrade-on-CAN). Epoch checkpoints are the unit a
   *different model on a different machine* resumes from.
4. **Residency is a cache.** An activation (in-memory working state, warm prompt-cache prefix, open sockets) is created on demand and collected when idle or under pressure (Orleans CollectionAge, activation shedding; Durable Objects hibernation). Deactivation hooks are never relied upon. Residency decisions include cache keepalive economics (§9.3).
5. **Ownership.** At most one writer per process: acquiring residency means acquiring a lease whose epoch/fencing token is checked by the log on every append (§2.5). Zombie activations cannot commit.
6. **Inputs.** Durable admission into a per-process inbox separate from execution (harness study: steer vs queue). A steering input is an interrupt to an anytime computation (§8.2); a queued input waits for the next step. Waiting uses durable timers/alarms, costing nothing.
7. **Children.** A child is a full process with its own identity, journal, and **attenuated capability set** minted from the parent's (macaroon caveats, derivation tree). Its result returns as a typed notification/task handle with a closed state set (A2A) plus an `UNKNOWN` settlement state. Results are artifacts by reference (Anthropic §5.1).
8. **Supervision.** Each process has a supervisor (a process or the person). The supervisor is a level-triggered reconciler over the log (§2.6) that computes signals from evidence, not self-report: crash, restart count within window, **stall** (no new evidence/state change in k steps, Magentic-One/MAST FM-1.3 repetition), **termination ambiguity** (no satisfied goal predicate, MAST FM-1.5), **budget exhaustion**, **verification debt** (unverified consequential claims, MAST FM-3.2). Restart types (permanent/transient/temporary) and intensity budgets per OTP; escalation terminates at the person.
9. **Restart semantics differ from Erlang.** An LLM process restart is *not* free: before re-issuing, the supervisor consults the effect ledger; effects in UNKNOWN are reconciled (query the external system, ask the person, or compensate) before retry. "Let it crash" applies to *cognition*; the
   *effect boundary* is part of the error kernel.
10. **Upgrades.** Pinned-by-default for a step; upgrade at epoch boundaries (Temporal's matrix for long-running + CAN: PINNED + upgrade-on-CAN, never patch). A supervisor guarantees no process is orphaned on retired code (Vercel's warning).

### 11.3 What the kernel must contain — "would this still make sense if 'AI agent' disappeared?"

**Passes the test (kernel):**
- **Identity** of principals and processes; durable IDs independent of runs/activations.
- **The log**: append-only, typed, versioned events; per-process journals with epoch + sequence fencing; read-time upcasters.
- **Effect ledger**: called-before-run, settled exactly once, `UNKNOWN` as a first-class state; idempotency keys. (Any payment system needs this.)
- **Authority**: capabilities (designation+rights+caveats+parent), attenuation-only delegation, derivation tree with cascading revocation, third-party discharge (approval), label propagation (integrity/confidentiality/consent). (Any multi-tenant OS needs this.)
- **Leases and ownership** (fencing tokens).
- **Durable time**: timers/alarms, due-queues.
- **Supervision contract**: every process has a supervisor; failure/stall/budget signals as events; restart policy + intensity budget; escalation path. (OTP is not about AI.)
- **Epoch/continue-as-new contract** and code/policy version stamping.
- **Budget/metering primitive**: every effect records its resource cost (money, tokens, latency) against a budget attached to a capability. (Cloud billing needs this.)
- **Governance hook point**: deterministic policy evaluation before every effect; absent answer = deny.

**Fails the test (harness or environment, not kernel):** context compilation and prompt caching; model routing; VOC estimators and performance profiles (the *mechanism* to record cost/outcome is kernel, the *policy* is harness); the dual-LLM/CaMeL execution pattern (harness, built on kernel labels and capabilities); stall heuristics specific to LLM behaviour; memory consolidation/sleep-time jobs; multi-agent topology; any notion of "prompt", "turn", "subagent", "tool call" (a tool call is just an effect).

### 11.4 Does UCI need an explicit attention/resource allocation substrate?

**Evidence for yes.** (a) Adaptive allocation beats uniform by ≥4× on test-time compute (Snell); routers/cascades cut cost 2× to 50× at equal quality (RouteLLM, FrugalGPT); caching cuts 41–80% and a cache-hostile layout wastes it (Lumer); sleep-time precompute cuts test-time compute ~5× when demand is predictable (Lin). (b) Multi-agent gains are largely explained by more tokens (Anthropic: 80% of variance) — so topology is a spending decision that should be made explicitly. (c) No surveyed system logs predicted-vs-realized value per step, so none can learn to allocate. (d) Russell–Wefald give the decision rule; Lieder–Griffiths the design method.

**Evidence for caution.** Every applied result is task-specific; non-myopic VOC is intractable; a learned allocator is scaffolding that model progress may obsolete (UCI's "structure over scaffolding" law). So: build the **measurement substrate** (structure, durable) and keep **allocation policies** thin and replaceable (scaffolding, ablatable).

**A minimal version with measurable value (SPECULATIVE design; each metric is falsifiable):**
1. **Metering (kernel).** Every effect record carries `cost = {input_tokens, cached_tokens, output_tokens, $, latency_ms, model_id, effort}` and the capability/budget it was charged to.
   *Check:* cost of any process/goal is a log query; replay reproduces totals.
2. **Budgets (kernel).** Capabilities carry budget caveats; children get sub-budgets (attenuation); exhaustion is a supervision event, not a crash. *Check:* a child cannot spend more than its caveat (containment test).
3. **Outcome linkage (harness).** Each step records a `predicted_value` (what the policy expected: difficulty class, expected success) and later a verifier-settled `realized_outcome`. *Check:* calibration curve of predicted vs realized per policy.
4. **One allocator decision, ablated.** Start with a single decision where the evidence is strongest —
   *effort/model selection per step by estimated difficulty* (Snell, RouteLLM) — with a cascade fallback gated by the verifier (FrugalGPT). *Metric:* cost per verified outcome and verified-success rate vs a fixed-model baseline on a replayed workload; ship only if cost falls ≥30% at non-inferior success (threshold is a placeholder to be set by the team).
5. **Cache-aware compilation (harness).** Volatility-ordered, deterministic context compilation.
   *Metric:* cache-read ratio and $ per step before/after (expect the 41–80% range to be reachable).
6. **Background compute as priced investment (harness, later).** Sleep-time jobs scheduled only when `P(reuse) × savings > cost`, with realized reuse logged. *Metric:* realized amortization factor (Lin reports 2.5×); stop the job class if realized < 1.

This is an "attention substrate" in the only sense the evidence supports: **metering + budgets + outcome linkage in the kernel, allocation policies as swappable harness modules evaluated on replay**.

## 12. Open problems

1. **Replay of non-deterministic cognition.** Workflow engines replay code; UCI must replay
   *decisions*. What is the equivalence notion for "the same process" after a model swap: identical events (trivial, by recording) or equivalent *future behaviour*? No source defines a behavioural equivalence test for cognitive processes. The model-swap reality test needs one.
2. **Epoch checkpoint fidelity.** Continue-as-new carries "compact state". For a cognitive process, what is lost between epochs is exactly the risk the compaction law names. Open: a verifiable criterion that an epoch checkpoint is *sufficient* (e.g., held-out continuation tasks succeed equally from checkpoint vs full journal).
3. **Upgrade semantics for months-long processes.** Pinning keeps old code alive for months; auto-upgrade requires replay-compatibility that LLM prompts/policies don't have. Temporal's upgrade-on-CAN is the best evidence; no study measures behavioural drift across upgrades for long-lived agents.
4. **UNKNOWN effect reconciliation at scale.** Every engine gives at-least-once + idempotency; external systems often don't support idempotency keys. How should a supervisor reconcile an UNKNOWN effect against a system with no query API — ask the person, compensate, or quarantine? Policy is domain- specific; the protocol is not specified anywhere surveyed.
5. **Structural injection defence vs open-ended work.** CaMeL/FIDES/Progent work when the plan can be fixed before reading untrusted data. Research, browsing, and tutoring from uploaded documents require plans that depend on untrusted content. Utility–security frontier at the open end is CONTESTED and unmeasured outside AgentDojo-style suites.
6. **Capability UX.** Macaroon-style caveats and third-party discharges are sound, but how a person reviews, understands and revokes a derivation tree of hundreds of delegated capabilities is unstudied for agents.
7. **Non-myopic VOC for long horizons.** Myopic VOC undervalues exploratory first steps; anytime performance profiles for LLM strategies are not published; allocator learning risks Goodharting the verifier it is judged by (and UCI forbids the system editing its own rubrics — so the verifier must be held out from the allocator's optimization loop).
8. **Multi-agent vs single-thread.** Anthropic vs Cognition is unresolved; MAST says most failures are organizational. UCI needs its own measurement: same task, same token budget, single process vs parallel children, verified outcome — per task class.
9. **Forgetting across caches and providers.** Provider-side prompt caches, archived epochs, backups, and derived beliefs must all honour a forget request; crypto-shredding's legal sufficiency is CONTESTED; provider cache TTLs are outside UCI's control but bounded (minutes–1 h).
10. **Supervision signals without self-report.** Stall, derailment and termination-awareness detectors must be computed from the log; MAST's LLM-as-judge annotator is itself a model. How much of supervision can be purely structural (no model), and what is the false-positive cost of escalation to a person?
11. **Fairness and priority across a person's many processes.** Background consolidation, tutoring, research and maintenance compete for one budget. Classical fair scheduling (weighted fair queuing, lottery/stride scheduling) exists; *value-weighted* fairness across cognitive processes does not.

## Appendix — source index

Status key: O = OBSERVED, R = REPLICATED, C = CLAIMED, X = CONTESTED, S = SPECULATIVE.

| # | Source | Year | Topic | Status |
|---|---|---|---|---|
| 1 | Temporal docs: determinism, Continue-As-New, limits — docs.temporal.io | 2026 | durable exec | O/R |
| 2 | Temporal Worker Versioning GA + Upgrade-on-CAN — temporal.io/blog | 2026 | versioning | O |
| 3 | Restate durable execution + versioning — docs.restate.dev | 2026 | durable exec | O |
| 4 | DBOS architecture — docs.dbos.dev; DBOS VLDB 2022 | 2022–26 | durable exec | O / C (perf) |
| 5 | Azure Durable Functions orchestrations — learn.microsoft.com | 2026 | durable exec | O/R |
| 6 | Inngest execution + versioning — inngest.com/docs | 2026 | durable exec | O |
| 7 | Vercel Workflow concepts/skew protection — vercel.com/docs/workflows | 2026 | durable exec | O |
| 8 | Orleans MSR-TR-2014-41; grain lifecycle docs | 2014/2026 | virtual actors | R |
| 9 | Akka Persistence + snapshots — doc.akka.io | 2026 | event sourcing | O/R |
| 10 | Armstrong thesis 2003; OTP supervisor docs | 2003 | supervision | R |
| 11 | Cloudflare Durable Objects docs | 2026 | actors/alarms | O |
| 12 | Gray & Cheriton 1989; Kleppmann 2016; Chubby 2006 | 1989–2016 | leases/fencing | R |
| 13 | Kubernetes controllers; Burns et al. 2016 | 2016 | reconciliation | R |
| 14 | LangGraph persistence + interrupts — docs.langchain.com | 2026 | agent state | O |
| 15 | MemGPT arXiv:2310.08560; Letta docs; sleep-time blog | 2023–26 | agent service | O / C |
| 16 | OpenAI Agents SDK sessions; Temporal integration | 2025–26 | agent state | O/R |
| 17 | Claude Code subagents + hooks — code.claude.com | 2026 | delegation/policy | O |
| 18 | Google ADK state — adk.dev | 2026 | agent state | O |
| 19 | Magentic-One arXiv:2411.04468; Microsoft Agent Framework docs | 2024–26 | orchestration | O / C |
| 20 | CrewAI memory docs | 2026 | memory | O / C |
| 21 | A2A specification — a2a-protocol.org | 2026 | protocols | O |
| 22 | MCP 2025-11-25 Tasks; 2026-07-28 RC | 2025–26 | protocols | O/R |
| 23 | Anthropic multi-agent research system | 2025 | orchestration | C / X |
| 24 | Cognition, "Don't Build Multi-Agents" | 2025 | orchestration | X |
| 25 | MAST arXiv:2503.13657 | 2025 | failure taxonomy | R |
| 26 | Anthropic long-running agent harness | 2025 | long horizon | C |
| 27 | Sleep-time compute arXiv:2504.13171 | 2025 | background compute | C |
| 28 | Hardy, The Confused Deputy | 1988 | ocap | R |
| 29 | Miller thesis 2006; Capability Myths Demolished 2003 | 2003–06 | ocap | R |
| 30 | seL4 (SOSP 2009); Capsicum (USENIX Sec 2010) | 2009–10 | capability OS | R |
| 31 | Macaroons (NDSS 2014); Biscuit | 2014 | credentials | R |
| 32 | Willison dual LLM 2023; lethal trifecta 2025 | 2023–25 | injection | O |
| 33 | CaMeL arXiv:2503.18813 | 2025 | injection | R / X |
| 34 | FIDES arXiv:2505.23643 | 2025 | IFC | R |
| 35 | Progent arXiv:2504.11703 | 2025 | privilege control | R |
| 36 | Design patterns arXiv:2506.08837 | 2025 | injection | O |
| 37 | Russell & Wefald AIJ 1991; Russell & Subramanian JAIR 1995 | 1991–95 | metareasoning | O |
| 38 | Dean & Boddy 1988; Horvitz 1987; Zilberstein 1996 | 1987–96 | anytime | R |
| 39 | Gershman/Horvitz/Tenenbaum 2015; Lieder & Griffiths BBS 2020 | 2015–20 | comp. rationality | R |
| 40 | Howard 1966; Hay et al. UAI 2012 | 1966/2012 | VOI | O |
| 41 | Snell et al. arXiv:2408.03314 | 2024 | test-time compute | R |
| 42 | Overthinking arXiv:2412.21187 (+ SelfBudgeter, BudgetThinker) | 2024–26 | adaptive compute | C / X |
| 43 | FrugalGPT arXiv:2305.05176 | 2023 | cascades | R |
| 44 | RouteLLM arXiv:2406.18665; Hybrid LLM; AutoMix | 2024 | routing | R |
| 45 | Anthropic prompt caching docs | 2026 | cache pricing | O |
| 46 | Don't Break the Cache arXiv:2601.06007 | 2026 | cache economics | C |
| 47 | Keepalive economics arXiv:2607.19214 | 2026 | cache economics | C |
| 48 | Overeem et al. JSS 2021 (arXiv:2104.01146) | 2021 | ES in industry | O |
| 49 | Young, Versioning in an Event Sourced System | 2017 | upcasting | R |
| 50 | Verraes forgettable payloads / crypto-shredding | 2019 | forgetting | R / X |

**Fetch caveats.** The Orleans PDF, OTP supervisor page, LangGraph durable-execution page, and the overthinking paper body could not be fetched; statements drawn from them are marked "from recall" in the text and should be verified before being relied upon.
