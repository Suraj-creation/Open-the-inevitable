# R6 — The Seven Reference Harnesses as a UCI Bootstrap Substrate

> **Status.** Evidence note, read-only investigation, 2026-09-27. Method: read `Reference-Architecture-Observatory/archaeology/SYNTHESIS.md`
> (cross-repo) plus each of the 7 per-repo archaeology docs in depth, then read `archit/09-runtime-authority-and-economics.md`,
> `archit/11-gap-map.md`, and skimmed `archit/10-primitive-atlas.md`. The actual checkouts were then spot-checked directly
> (not just the archaeology's claims) for the specific evidence-gap question the original archaeology flagged.
>
> **Why this exists.** Feeds `14-foundation-selection-and-migration-strategy.md`'s Parts 2–6 (which repo, if any, is a
> sound bootstrap substrate). Companion to `R5` (the current codebase audit). This is a *different question* from the
> original archaeology (`Reference-Architecture-Observatory/archaeology/`): that pass asked "what mechanisms exist and what
> do they teach UCI"; this pass asks "which of these seven codebases, if any, should UCI be built *from*."

---

## Independent spot-checks (beyond the archaeology's own evidence)

- `find OpenHands -name "*.py"` → 10 files (CI scripts + 2 mock LLM/ACP servers + `tools/canvas_ui_tool.py`); no
  `node_modules/`; `grep` for `class (AgentController|EventStream|StuckDetector|LLMSecurityAnalyzer|Condenser)` →
  0 hits. **Confirmed absent.**
- `Eve/packages/eve/scripts/vendor-compiled/@workflow/` contains only compiled build stubs (`core.mjs` 7.2K,
  `builders.mjs` 736B, etc.), no `node_modules`, no `@workflow/*` source anywhere in the checkout. **Confirmed
  absent.**
- `SWE-Agent`: only two SVG logo files match `*swerex*`; `python -c "import swerex"` fails (per the archaeology;
  consistent with checkout contents found here). **Confirmed absent.**
- Cross-checked scale claims directly: Hermes-Agent `*.py` = 109,022 lines; Opencode `core/src` = 86,119 lines;
  Prime-Agent `agent-session.ts` = 13,891 lines (exact match to doc); Deepseek-Harness has 346 package
  directories and a **present** `vendor/cordis/src` (kernel IS in the checkout, just vendored — unlike
  Eve/OpenHands/SWE-Agent).

Scale used below: **1** absent/failing, **2** weak, **3** moderate, **4** strong, **5** best-in-class among the
7. Citations are `file:line` pulled from the archaeology docs unless marked as an independent spot-check above.

---

## Per-repo scorecards (26 criteria)

### Hermes-Agent
| # | Criterion | Score | Reasoning |
|---|---|---|---|
|1|Execution maturity|5|Richest, most production-hardened of all seven; ~750K first-party LOC, 33 decomposed turn-phase files, every branch cites an incident (#49201, #74568, etc.).|
|2|Persistence maturity|5|SQLite `state.db` schema v30, row-level durable transcript with `api_content` sidecar, watermark-cloned non-destructive compaction, measured by a recall eval.|
|3|Recovery|5|`effect_disposition∈{none,unknown}`, orphan rewrite (never erase), auto-recovery ladder with visible countdown, byte-stable replay canonicalization.|
|4|Process management|4|Session turn leases fenced *inside* the write transaction, liveness watchdog decoupled from lease renewal; but foreground execution is process-local (dies with the process).|
|5|Tool system|5|Registry, 8 terminal backends, dangerous-command approval pipeline, persist-before-execute, dispatch-once enforcement.|
|6|Delegation|4|Full `delegate_task` + durable async delegation w/ owner-pid fingerprinting; but authority = toolset subset only, no structural envelope.|
|7|Background execution|5|Background review fork, cron (at-most-once ticks), kanban durable work queue, async delegation — richest background story of the 7.|
|8|Observability|4|Extensive redacted logging, trajectory export (training-data pipeline), compaction recall eval; but runtime verification is opt-in/off by default.|
|9|Testing|3|~35 targeted probes + ~30 harness dirs, mostly *incident regression probes*, not a systematic capability-test suite.|
|10|Environment/sandbox|4|8 terminal backends + approval pipeline; no structural sandbox isolation (approval-gated, not confinement-gated).|
|11|Model abstraction|5|Credential-pool failover, 30-class `FailoverReason` taxonomy, MoA, auxiliary-model routing — most mature multi-provider handling of the 7.|
|12|UI maturity|5|CLI, TUI, Electron desktop, web, gateway (~20 messaging platforms), `/handoff` moves a *live* session between surfaces.|
|13|CLI maturity|5|`hermes_cli/` 229K lines; the most invested CLI of the set.|
|14|Cross-platform viability|4|Broadest surface coverage; SQLite-per-home + flock is POSIX-leaning but Electron/desktop implies real cross-platform investment.|
|15|MCP/extensibility|4|Built-in MCP client + `optional-mcps` catalog; large `VALID_HOOKS` plugin surface; footprint ladder discipline.|
|16|Document handling|3|`web_extract`, `vision_analyze` exist; no deep document-ingestion pipeline documented.|
|17|Multimodal extensibility|4|Vision mixin, image-gen/TTS/transcription provider ABCs, browser tools.|
|18|Architectural modularity|3|14-mixin `AIAgent` facade + reflective `_run_phase` kwarg binding is a real anti-pattern; 33-file phase decomposition is a genuine mitigation.|
|19|Ease of extracting/replacing subsystems|2|~750K LOC, 21 state-DB siblings, 5,350-line compressor, provider-specific repair baked into the loop; extraction is costly.|
|20|Cognitive assumptions baked in (penalty)|2 (bad)|Deepest chat/turn/session ontology of the 7: the transcript row literally **is** the state; "turn"/"iteration"/"system prompt" are load-bearing everywhere.|
|21|UCI substrate w/o fighting|2|No typed working state distinct from chat rows; byte-stable-replay is an economically load-bearing invariant that resists reinterpretation.|
|22|UCI environments|3|Memory-provider / context-engine ABCs are real plugin points, but everything is named and shaped around "conversation."|
|23|UI as pure projection|4|Already proven: CLI/TUI/desktop/gateway all project from `state.db` + `AIAgent.run_conversation` — a genuine strength.|
|24|Clean seam to remove harness assumptions|2|Provider-specific incident patches are woven into `conversation_loop.py`/`error_classifier.py`; no clean excision point.|
|25|MCP/extensibility ease|4|Same evidence as #15; plugin hook surface is large and reasonably decoupled from the (tangled) core loop.|
|26|Evidence gaps|5|Full first-party source present; richest archaeology doc of the 7 (1,583 lines); no absent SDK.|

### Eve
| # | Criterion | Score | Reasoning |
|---|---|---|---|
|1|Execution maturity|5|Pure `StepFn` over a serializable session; crash-transparent turns; committed step result **is** the checkpoint.|
|2|Persistence maturity|3|Whole-session snapshot every step (O(history) write amplification); compaction **overwrites** durable history — no separate evidence store.|
|3|Recovery|4|Durable receipts, idle-only handoff, exactly-once effect acceptance — but built entirely on unverified SDK guarantees (source absent).|
|4|Process management|4|Identity ≠ ownership ≠ replay unit is the cleanest such separation in the set; cohort-folded background reporting.|
|5|Tool system|3|Typed tools, but **inline tool effects are not transactional** — no receipt layer, can double-execute on crash (an explicit, acknowledged gap).|
|6|Delegation|4|Budget split by fan-out, `rootOnly` tools hidden from children — real attenuation, though by hiding rather than structural revocation.|
|7|Background execution|4|Cohort folding avoids N-interruptions-for-N-tasks; solid workflow-tool-run model.|
|8|Observability|3|Event stream is **at-least-once, not a commit log** — retried steps re-emit under fresh ids; "truth = committed step results, not the stream," a real trust problem for a trajectory record.|
|9|Testing|4|`defineEval`/judge/CI E2E framework; 13,732-line `tool-loop.test.ts` shows deep investment — but evals are disconnected from runtime.|
|10|Environment/sandbox|3|Pluggable sandbox backends with lazy reattach; shallow detail on isolation depth.|
|11|Model abstraction|4|Dynamic model resolver per step; less elaborate than OC's provenance-gating but workable.|
|12|UI maturity|2|Thin client SDKs (React/Vue/Svelte) + ACP adapter; no rich desktop/TUI story.|
|13|CLI maturity|2|Exists as a thin client; not a documented focus.|
|14|Cross-platform viability|3|Local/Vercel/Postgres "worlds" give real cloud portability, at the cost of total dependence on one vendor SDK.|
|15|MCP/extensibility|3|Rich channel adapters (slack/discord/github/linear/teams/telegram/twilio); MCP itself not emphasized.|
|16|Document handling|2|Not emphasized in the archaeology at all.|
|17|Multimodal extensibility|2|Tool/channel-oriented, not multimodal-oriented.|
|18|Architectural modularity|5|Standout: tiny durable core (`{serializedContext, sessionState}`), 23 **mechanically enforced**, shrink-only architecture guards — unique among the 7.|
|19|Ease of extracting/replacing subsystems|4|Guard rules literally forbid channel/harness/tracing from importing workflow primitives — built for exactly this; undercut by the vendor-SDK dependency below.|
|20|Cognitive assumptions baked in (penalty)|3|`HarnessSession` is generic serializable data, not chat-shaped rows — thinner ontology than most — but conversation-vs-task is still the top-level unit.|
|21|UCI substrate w/o fighting|3|`session.state` is an open map, a genuinely good slot for typed state — but "compaction overwrites history" must be re-engineered first to satisfy "evidence is sacred."|
|22|UCI environments|3|Generic dynamic-resolver/extension system; reasonable fit.|
|23|UI as pure projection|4|Explicit design principle ("surfaces never touch session internals"); undercut somewhat by the stream-is-not-truth issue.|
|24|Clean seam to remove harness assumptions|3|The guard rules are an excellent *seam-enforcement* mechanism — but the entire durability story is inherited from an absent, closed, single-vendor SDK, which is not a seam, it's a foundation you cannot see or swap.|
|25|MCP/extensibility ease|3|—|
|26|Evidence gaps|2 (severe)|**Independently confirmed**: `@workflow/*` source is completely absent (only a 7.2KB compiled stub). Eve's entire value proposition — crash-transparent turns — is [INFER], not [IMPL], for its foundational layer.|

### OpenHands
| # | Criterion | Score | Reasoning |
|---|---|---|---|
|1|Execution maturity|1|The entire agent core (controller, event stream, runtime, condenser, stuck detector, security analyzer, critic) is server-side and **absent** from the checkout.|
|2|Persistence maturity|2|Inferred only from client behavior ((b)/(c)-class evidence), never (a) code-verified.|
|3|Recovery|2|Client-side resume (REST tail + WS-since + dedup) is genuinely well engineered and *is* directly observable — but no test in this checkout restarts the actual server.|
|4|Process management|1|Entirely server-side; absent.|
|5|Tool system|2|Client tools (**executed in the browser**) are a real architectural finding, but with severe correctness gaps: ack-before-effect, per-browser localStorage ledger, never-run-if-unobserved.|
|6|Delegation|3|Three-tier delegation with structural attenuation (planner restricted by tool list) is real and client-observable — a genuinely good, verifiable mechanism.|
|7|Background execution|2|Automations w/ typed `TaskOutcome` and circuit breakers visible at the schema level; execution engine absent.|
|8|Observability|3|Typed, discriminated event union with real provenance fields (`source`, `tool_call_id`, `llm_response_id`, `usage_id`) — good design; but no sequence numbers, timestamp-only ordering can drop events at ties.|
|9|Testing|3|Mock-LLM e2e tests run the **real** agent-server via `uvx` and assert through server APIs — genuinely good; but they never restart the server (no restart reality test in this checkout).|
|10|Environment/sandbox|1|Runtime/execution details entirely absent; workspace type is visible only as a config field.|
|11|Model abstraction|2|`/model`, `SwitchLLM` visible; semantics entirely server-side and unobserved; model swap isn't even always logged as an event.|
|12|UI maturity|5|The most complete UI *product* of the 7 as checked out: chat + files/diff/terminal/browser/planner/tasks tabs, settings, secrets, hooks, automations, ACP external agents, forks/branches.|
|13|CLI maturity|1|A web/Electron app; no CLI focus.|
|14|Cross-platform viability|4|React/Vite SPA + Electron + Docker + Helm — the most deployment-flexible *surface* story, though the agent core's cross-platform behavior is entirely unknown.|
|15|MCP/extensibility|3|MCP servers configurable; ACP external-agent integration (Claude Code/Codex/Gemini CLI) is a unique and notable extensibility angle.|
|16|Document handling|3|Files/diff tab, workspace browsing; moderate.|
|17|Multimodal extensibility|3|Browser screenshot tab, image tooling referenced; core vision handling is server-side and absent.|
|18|Architectural modularity|3|Clean client/server split is itself a modularity feature — but half the architecture is simply unauditable here.|
|19|Ease of extracting/replacing subsystems|2|Cannot extract a cognitive core that isn't in the checkout; the client is extractable as a projection UI only.|
|20|Cognitive assumptions baked in (penalty)|2 (bad-ish)|"Conversation" is the exclusive unit, baked into the typed event union itself (`MessageEvent`/`ActionEvent` as the primitives) — cleaner schema than most, but still chat-shaped at the root.|
|21|UCI substrate w/o fighting|2|Can't assess the real fight (server absent); visible provenance-in-prose failures (goal re-prompts as plain user messages, child results as JSON-in-user-message) show real ontology leakage needing repair.|
|22|UCI environments|2|Unknown depth; the ACP external-agent pattern is an interesting extensibility point but unverified.|
|23|UI as pure projection|5|The cleanest, most explicit instance of this property across all 7: the browser rebuilds its entire view from REST+WS and never owns cognition — modulo the client-tool wrinkle.|
|24|Clean seam to remove harness assumptions|3|Client/server boundary IS the seam and is unusually clean in one direction (UI freely swappable); says nothing about the harder problem (the invisible agent loop).|
|25|MCP/extensibility ease|3|—|
|26|Evidence gaps|1 (severe)|**Independently confirmed**: only 10 `.py` files in the whole checkout, no `node_modules`, zero grep hits for `AgentController/EventStream/StuckDetector/LLMSecurityAnalyzer/Condenser`. The most severe evidence gap of the 7 — nearly every execution/persistence/recovery claim is (b)/(c), never (a).|

### OpenCode (V2)
| # | Criterion | Score | Reasoning |
|---|---|---|---|
|1|Execution maturity|5|"No in-memory agent loop" — every step reloads projected state from SQLite; restart/model-swap/compaction all reduce to "reload and continue," the cleanest such story observed.|
|2|Persistence maturity|2|**DRIFT-1**: event persistence is OFF BY DEFAULT in the shipped CLI server; only projections persist, and one projection (revert) is destructively unrecoverable. The event-sourced design is real code, but currently an unrealized default.|
|3|Recovery|4|Write-ahead execution claim + durable bounded resume counter (≤10) + boot sweep — precisely `[IMPL]`-verified; but single-owner-only, no fencing across multiple servers (a documented hidden assumption).|
|4|Process management|4|Doorbell coordinator, atomic claim+start-event commit; explicitly single-process/single-machine, clustering is stated future work.|
|5|Tool system|4|Publish-before-fork + terminal-once state machine + drain-start orphan sweep, precisely evidenced; CodeMode confined AST interpreter is a distinctive strength.|
|6|Delegation|2|Documented real gap: child's authority = its own agent's rules **plus** the parent session's, **not a subset** — no attenuation; subagent results are text-only (structured evidence dropped).|
|7|Background execution|3|Jobs exist; workerd/Cloudflare path exists but clustering explicitly unimplemented.|
|8|Observability|4|Typed versioned events, bounded per-connection event-feed fan-out — undercut by DRIFT-1 (the log itself is optional).|
|9|Testing|3|Structural verification of compaction summaries, replay-divergence-check machinery exists (though unused in production); no e2e harness as large as Hermes' evals or Eve's test files.|
|10|Environment/sandbox|3|Shadow-git snapshot/stage/clear/commit-revert is a nice mechanism; sandboxing depth not elaborated.|
|11|Model abstraction|5|**Best in the set**: provenance-gated opaque provider state, replayed only to the exact producing model/route/endpoint (SHA-256'd), degrading gracefully otherwise — direct evidence for a model-swap reality test.|
|12|UI maturity|3|TUI + desktop + web packages exist as separate surfaces but were explicitly out of scope for this archaeology pass ("not read") — moderate confidence only.|
|13|CLI maturity|4|CLI starts/manages the background server; well-integrated core entry point.|
|14|Cross-platform viability|3|"One process on one machine" explicitly scoped; workerd path exists but unimplemented for clustering.|
|15|MCP/extensibility|4|`core/src/mcp/*` present; scoped, replayable plugin registries (`State`) are an elegant, reusable pattern.|
|16|Document handling|2|Not emphasized; coding-agent-shaped tools (file edit, workspace snapshot) dominate.|
|17|Multimodal extensibility|2|Not emphasized in what was read.|
|18|Architectural modularity|5|**Best in the set**: Schema → Core/Protocol → Server layering, small well-named files (llm.ts 378 lines, step.ts 304), Effect-TS structured concurrency — vs. Hermes' 5,000+-line files or Prime's 13.9K-line monolith.|
|19|Ease of extracting/replacing subsystems|4|The archaeology's own §24 transferable-mechanisms table names exact preconditions per mechanism — itself evidence of clean decomposition; longest, most "portable-by-precondition" such table of the 7.|
|20|Cognitive assumptions baked in (penalty)|3|"Session" is still the top unit and the schema is coding-agent-shaped (tool calls, workspace snapshots), but the durable-event/projection split is domain-neutral in principle.|
|21|UCI substrate w/o fighting|4|Event-sourced shape (once DRIFT-1 is fixed) is almost exactly the right form to retrofit a real substrate: flip `persist:true` unconditional, treat `Bus` as the causal record, add UCI projections alongside existing ones.|
|22|UCI environments|4|Tool/plugin architecture (`tool/plugin/*`, CodeMode, MCP) is generic and cleanly separated from the session engine; a new UCI environment looks like a new tool-plugin package.|
|23|UI as pure projection|4|"Clients never depend on Core" by convention, SSE with bounded per-connection fan-out — good, though the convention isn't mechanically enforced (an open question in the archaeology itself).|
|24|Clean seam to remove harness assumptions|4|Cleanest layering of the 7; main risk is that Effect-TS idioms (`uninterruptibleMask`, Scope-owned registrations) carry real correctness guarantees that must be re-derived by hand if ported off Effect.|
|25|MCP/extensibility ease|4|—|
|26|Evidence gaps|4 (minor)|Full first-party source present and extensively read (86K+ measured lines in `core/src`); an honestly disclosed "not read" list (`ai/src` internals, `model-transport.ts`, `plugin/host.ts`, `mcp/*`, TUI/app packages) is peripheral, not core-invalidating.|

### Prime-Agent
| # | Criterion | Score | Reasoning |
|---|---|---|---|
|1|Execution maturity|4|Novel double-loop (963-line generic loop + a huge session layer) genuinely works and is richly traced; complexity is concentrated, not absent.|
|2|Persistence maturity|2|Core weakness: session JSONL is **not fsynced** and writes are deferred until the first assistant message; durability effort went to the edges (daemon journals), not the core transcript — the weakest-core/strongest-edge pattern of the 7.|
|3|Recovery|4|Crash-honesty (disclosure, never blind replay), intent journal (`received→result→acknowledged`), kernel-state notices telling the model what survived — good; but the in-memory `ActionStore` is lost on crash except at planned restarts.|
|4|Process management|4|"Durable identity + optional residency" (passivation, lazy hydration) is a distinctive, strong pattern; pid+start-id identity with leak-over-kill.|
|5|Tool system|3|Unusual design: the model has essentially **one** tool (`ipython`, a persistent CPython REPL); interesting, but means most "tools" are Python conventions, not a structured typed system, and there's no authority gating beyond visibility.|
|6|Delegation|3|Full RLM children as recursive processes with quiescence-holding is sophisticated; but full capability inheritance (no attenuation) is a real, documented gap.|
|7|Background execution|4|Goals, autonomous mode, cron, daemon workers with recovery journals; autonomous counters are not persisted (reset on restart) — a real gap.|
|8|Observability|3|Durable traces for model changes, backups, compaction, refinements, goal state; but the semantic-edge ledger claims "durable" without fsync (DRIFT D10) — a documented reliability gap.|
|9|Testing|2|Little dedicated test-infrastructure evidence surfaced (vs. Hermes' evals or Eve's 13.7K-line test files); mostly verified via direct code reading.|
|10|Environment/sandbox|2|Explicitly **not** a security sandbox by the project's own README; isolation is for lifecycle only — "the kernel can do anything the user can."|
|11|Model abstraction|3|Auxiliary-model routing, cache-read-excluding budgets; overflow/error classification is ~21 regexes described by its own docs as brittle.|
|12|UI maturity|3|Interactive mode (12.3K lines), TUI, RPC/ACP modes, agents-view — reasonably rich, though less polished/multi-platform than Hermes/OpenHands.|
|13|CLI maturity|4|Interactive mode is a first-class, heavily invested surface.|
|14|Cross-platform viability|3|Real Windows-specific handling exists (Job objects + taskkill fallback, PowerShell process start-ids) — genuine investment, but "walking asyncio private internals" is fragile and Python-version-dependent.|
|15|MCP/extensibility|3|MCP present in the kernel (`RT/mcp.py`) and bundled skills.|
|16|Document handling|2|Not emphasized.|
|17|Multimodal extensibility|2|An `attach-image` skill exists but is not deeply elaborated.|
|18|Architectural modularity|2|The **monolith problem**: 13,891-line `AgentSession` holds admission, pump, retry, compaction, goals, autonomy, refine, children, host handlers, messaging, usage accounting — invariants enforced by a *comment* ("every clear site must notify checkpoint waiters"), not a type.|
|19|Ease of extracting/replacing subsystems|2|The generic loop (963 lines) is cleanly separable, but nearly all cognitive-continuity value lives inside the un-decomposed monolith.|
|20|Cognitive assumptions baked in (penalty)|3|RLM ("context as variables, subagents as function calls") is a genuinely *different* — and interesting — ontology from chat-turn framing (a point in its favor), but goals/autonomy/verification are still fundamentally git/shell-repo-centric.|
|21|UCI substrate w/o fighting|2|The harness state (supplemental prompts/memories/skill descriptions as durable, refinable state) is the closest thing to a typed working state outside the transcript of any of the 7 — a genuine strength — but it lives *inside* the monolith, so any UCI substrate must operate inside that class, not beside it.|
|22|UCI environments|3|The "everything is a Python object in a persistent kernel" pattern is a flexible substrate for new environments (define new namespaces/tools) — offset by zero authority envelope around it.|
|23|UI as pure projection|3|Daemon supervisor+workers projected via `AgentConnection`, but replay-after-reconnect mechanics were explicitly not traced (an open question) — moderate confidence.|
|24|Clean seam to remove harness assumptions|2|The monolith's flag/epoch/fence web is explicitly flagged by its own archaeology as unusually hard to safely modify.|
|25|MCP/extensibility ease|3|—|
|26|Evidence gaps|4 (minor-moderate)|Core TS packages read directly and in full for key ranges; Python kernel (`RT/*.py`) and several daemon files are "delegated reads, spot-checked" rather than independently read — a real but smaller gap than OpenHands/Eve/SWE-Agent's wholesale absences.|

### Deepseek-Harness
| # | Criterion | Score | Reasoning |
|---|---|---|---|
|1|Execution maturity|5|The **request-equality invariant** (wire request must equal the fold of the log, else refuse) is the single cleanest, most rigorous "model-visible means logged" mechanism found in any of the 7, verified in code.|
|2|Persistence maturity|4|Append-only per-session event log is the sole source of truth, validated **at write** (not read); but "whole log in memory" and O(log) scans are acknowledged unaddressed costs (the codebase itself deprecates synchronous whole-log reads).|
|3|Recovery|5|**Best in the set**: crash semantics for torn tails, partial writes, orphaned tool calls, unmatched compaction brackets and never-materialized sessions each have a *defined* outcome — the most systematically enumerated recovery story found.|
|4|Process management|4|Kernel lock without expiry, reverse-order effect teardown for HMR; single-process/single-machine only, cross-machine work happens by delegating a whole turn to another product (ACP), not sharing a session.|
|5|Tool system|5|Deny-dominant pipeline (pre-execute → ask → guards → execute → post-execute), call-before-dispatch, crash closers distinguishing "not started" from "outcome unknown."|
|6|Delegation|4|**Unique mechanism**: authority attenuation is written into the *child's own log*, so a restarted child reconstructs its policy without consulting the parent.|
|7|Background execution|3|Jobs are memory-only; schedules durable but fire only while the root agent is live; goal activation deliberately does **not** auto-resume after restart — a real capability gap for autonomous long-horizon work (a considered safety choice, not an oversight).|
|8|Observability|4|Embedded exact model stream enables keyless replay tests; approval audit pairs (asked/decided) inside the turn — but the reconstruction-law checker is **off in shipped profiles** (DRIFT D1), so dev-time guarantees ≠ production guarantees.|
|9|Testing|4|Tests replay real recorded sessions **keylessly** and check external effects against an *independent workspace oracle* — genuinely strong verification-in-testing, though not at runtime.|
|10|Environment/sandbox|4|Sandbox mode as a policy plugin/event, scoped worlds per agent — "without process isolation" is itself a noted limitation.|
|11|Model abstraction|3|Request-series/cache-prefix discipline is solid; model-swap safety specifically not as elaborated as OC's provenance-gating.|
|12|UI maturity|3|Electron/Web apps exist per the directory listing, but archaeology's read focus was `packages/core`, so surface depth is less evidenced here.|
|13|CLI maturity|3|Headless-runner plugin exists; not a primary archaeology focus.|
|14|Cross-platform viability|3|Native addon (`native/`) alongside TS/Python suggests real work, not detailed; wall-clock/PID assumptions for schedules are a noted hidden assumption.|
|15|MCP/extensibility|5|**Best in the set**: "everything is a Cordis plugin mounted from YAML" — profiles/bundles/patches compose a harness by data, the most extensible design of the 7 (with a real cost, see #19/#24).|
|16|Document handling|2|Not emphasized; web/browser/computer-use tools exist but document ingestion specifically isn't highlighted.|
|17|Multimodal extensibility|3|Image offload in compaction; browser/computer-use tools exist; moderate.|
|18|Architectural modularity|5|~300–346 workspace packages; "policy lives beside the loop, not in it" (the loop file is 620 lines) — tied with OpenCode for cleanest separation of concerns.|
|19|Ease of extracting/replacing subsystems|4|Genuinely excellent in principle (every subsystem is a swappable plugin) — but its own archaeology flags the double edge: "stored sessions depend on which plugins were loaded" (I10) — extraction is physically easy, but an extracted package's stored state isn't guaranteed self-describing without its siblings.|
|20|Cognitive assumptions baked in (penalty)|3|"Turn/step/round" vocabulary present but reasonably abstracted behind the seam model; still fundamentally session-bounded (no durable object above the session).|
|21|UCI substrate w/o fighting|4|Among the best fits found: the log/surface separation (append-only log + a derived "surface" index that **shadows, never deletes**, citing what it shadows) is almost exactly UCI's evidence/interpretation law already in place.|
|22|UCI environments|4|The seam model (Service Definition + Provider + Consumer) plus profile/bundle/patch composition is explicitly designed for pluggable-domain-pack extension.|
|23|UI as pure projection|4|Projections are folds of the log; UI surfaces would consume the same projection registry in principle — not verified as deeply as OC's or Hermes' multi-surface story.|
|24|Clean seam to remove harness assumptions|3|The seam/plugin model is a genuinely good architectural seam, undercut by its own flagged hazard: the loop, session store *and* persistence are **all** plugins — meaning removing "the original harness's assumptions" risks pulling out load-bearing pieces the same way extraction works.|
|25|MCP/extensibility ease|5|—|
|26|Evidence gaps|4 (minor)|**Independently confirmed present**: `vendor/cordis/src` (the kernel) IS in the checkout, unlike Eve/OpenHands/SWE-Agent's absent SDKs. The archaeology's own §26 explicitly separates resolved vs. still-open questions; remaining gaps (subagent-continuation durability details, PTC nested-dispatch logging) are narrow, not core-invalidating.|

### SWE-Agent
| # | Criterion | Score | Reasoning |
|---|---|---|---|
|1|Execution maturity|2|Deliberately simple, synchronous, single-task loop; scores well as a *benchmark* harness, which is a fundamentally different problem than persistent execution.|
|2|Persistence maturity|1|**Weakest of the 7**: the durable object is a per-task JSON file **rewritten wholesale** after every step (O(n²), non-atomic); nothing carries between tasks except unpersisted process-global cost counters.|
|3|Recovery|1|**No continuity at all**: a restart loses the running instance entirely — it is redone from zero or deleted if partial ("delete-and-redo as resume").|
|4|Process management|1|Single Python process owns the run; no cross-process/machine story beyond skipping finished instances in batch mode.|
|5|Tool system|3|Declarative YAML tool bundles are genuinely nice (no harness Python changes needed); typed parser exceptions with repair prompts is good — but loop control depends on **string sentinels in untrusted tool stdout**, a real correctness/security anti-pattern.|
|6|Delegation|1|No real delegation; only vestigial dead fields (an `agent` name filter, `get_forwarded_vars` never called).|
|7|Background execution|1|None; fully synchronous single-task.|
|8|Observability|3|Clean/complete split (model-facing history vs. audit-facing trajectory) is a genuinely useful primitive; full run config embedded in every log entry — but the trajectory artifact itself is the weak, non-atomic thing described above.|
|9|Testing|3|A mature *benchmark*-testing pipeline (RunBatch, SweBenchEvaluate via `sb-cli`, demonstrations-from-trajectories) is the whole point of the project — but even by its own standards, replay is "unverified" (re-executes without comparing observations).|
|10|Environment/sandbox|2|**SWE-ReX, the actual sandbox/deployment layer, is absent** — independently confirmed (only 2 SVG logo files match, `import swerex` fails per the archaeology). Everything below the `SWEEnv`/`ToolHandler` call sites is unproven here.|
|11|Model abstraction|3|LiteLLM adapter, tenacity retry, human/replay/test models, cost accounting — solid for single-model-per-attempt; no cache-aware provenance gating like OC.|
|12|UI maturity|2|A trajectory inspector exists; fundamentally a CLI/batch research tool, not a product UI.|
|13|CLI maturity|3|Decent surface (`run_single`/`run_batch`/`run_replay`/`run_shell`) with pydantic-union config composition; several DRIFT items show real CLI/config bugs (`run-api` doesn't exist; `--config` replay is broken).|
|14|Cross-platform viability|2|Fundamentally container/Docker-dependent (via the absent SWE-ReX), single Python process; no cross-platform evidence beyond that.|
|15|MCP/extensibility|2|No MCP; extensibility is via YAML tool bundles only — real but narrow.|
|16|Document handling|1|Not a focus at all.|
|17|Multimodal extensibility|2|`SWEBenchMultimodal` problem-statement type and an `image_tools` bundle exist as a foothold, not elaborated.|
|18|Architectural modularity|3|Genuinely small and legible (~450 lines covers the whole loop, one clean exit ladder) — but this simplicity is bought by *not solving* continuity/delegation/background work, not by good abstraction over them.|
|19|Ease of extracting/replacing subsystems|4|Paradoxically high: because it solves so little of the continuity problem, there's very little entangling "gravity" — state probes, declarative tool bundles, and the clean/complete split are small, self-contained, easily lifted.|
|20|Cognitive assumptions baked in (penalty)|4 (relatively good)|Ironically **less** chat-session-shaped than most, since it isn't conversational at all — a single-task tool-use loop with no "conversation" concept. The main baked-in assumption ("a git repo is the unit of verifiable work") is narrow and swappable.|
|21|UCI substrate w/o fighting|2|Low fighting, but also low value: there is essentially no existing substrate (no typed working state, no event log, no evidence store) to build on — "ease" here means "nothing to conflict with," not "a good foundation."|
|22|UCI environments|2|The environment abstraction itself (`SWEEnv` wrapping the absent SWE-ReX) is unproven in this checkout; would need to be built new.|
|23|UI as pure projection|2|No real UI beyond a trajectory viewer; nothing to project.|
|24|Clean seam to remove harness assumptions|4|By solving so little, there is very little to remove — the 450-line loop can be discarded wholesale rather than incrementally excised.|
|25|MCP/extensibility ease|2|—|
|26|Evidence gaps|2 (significant)|**Independently confirmed absent**: SWE-ReX (the sandbox/deployment/bash-session/timeout/interrupt substrate) is entirely missing. This invalidates essentially all claims about the environment layer (#10) and weakens confidence in recovery/process-management, since both depend on SWE-ReX's undocumented behavior.|

---

## A. Comparison table — repos × criteria groups

| Repo | Execution maturity (1–9) | Environment/UI maturity (10–17) | UCI architectural fitness (18–26) |
|---|---|---|---|
| **Hermes-Agent** | Most production-hardened of the 7; best recovery/persistence/background story; testing is regression-probe-shaped, not systematic. | Richest surface set (CLI/TUI/desktop/gateway/~20 platforms), best model-provider handling; weak document/sandbox depth. | Best UI-as-projection proof, but highest architectural gravity: transcript-is-state, 750K LOC, mixin+ContextVar tangle — a great *evidence mine*, a poor *foundation*. |
| **Eve** | Cleanest crash-transparency *concept* (pure StepFn), but its trust chain terminates in an absent SDK; compaction destroys evidence. | Thin UI/CLI; workflow-neutral channel adapters are its real strength. | Best mechanically-enforced modularity (23 shrink-only guards) sabotaged by total dependence on one absent, closed vendor SDK — disqualifying for "primary substrate," excellent as a pattern reference. |
| **OpenHands** | Half the system (server) is absent from the checkout; what's visible (client resume/replay) is well engineered. | Best UI *product* breadth and the cleanest UI-as-pure-projection proof of the 7 — but paid for by having no visible cognitive core. | Cannot be a substrate here at all — the checkout is a projection layer with nothing behind it. Severest evidence gap of the 7. |
| **OpenCode** | Purest verified "stateless step over durable projections" story; single biggest gap is a *default-configuration* flaw (event log off by default), not an architectural one. | Best model-swap-safety mechanism (provenance-gated opaque state) of the 7; UI/CLI moderate, explicitly under-read in this pass. | Best architecture-for-purpose: cleanest layering, most named-precondition transferable mechanisms, event-sourced shape nearly ready to host a UCI substrate once DRIFT-1 is fixed. **Leading candidate.** |
| **Prime-Agent** | Genuinely novel double-loop; durable-identity/optional-residency is distinctive; core transcript durability is the weakest-core/strongest-edge pattern found. | RLM ("context as variables") is conceptually interesting; sandbox explicitly disclaimed as non-security; moderate UI. | Best "typed working state outside the transcript" instinct (the harness state) — trapped inside a 13.9K-line monolith with comment-enforced (not type-enforced) invariants. |
| **Deepseek-Harness** | Best recovery enumeration and best "model-visible ⟺ logged" invariant of the 7 (request-equality check); background/long-horizon durability is uneven by design. | Most extensible-by-composition (Cordis plugin/YAML) design of the 7; UI/document/multimodal under-evidenced. | Log/surface (shadow-not-delete, cite-what-you-shadow) separation is nearly UCI's evidence law already — but "everything including the durable core is a plugin" is flagged by its own archaeology as a durability hazard, not just a strength. |
| **SWE-Agent** | Solves almost none of persistence/recovery/delegation/background execution by design — it is a benchmark harness, not an execution substrate. | Weakest environment story (SWE-ReX itself absent); minimal UI; narrow extensibility. | Lowest architectural gravity of the 7 (almost nothing to fight) but also the least substrate to build *from* — a source of small transferable ideas, not a foundation. |

---

## B. Ranking as an initial execution substrate to transform into UCI

**This ranks "which codebase should UCI be built by transforming," not "which agent product is best."** Raw
feature maturity (Hermes wins outright) and mechanical-modularity purity (Eve wins outright) are both explicitly
discounted where they conflict with extractability and freedom from vendor/ontology lock-in.

**1. Leading candidate: OpenCode.**
Its entire crash story reduces to three composable, independently-evidenced primitives — stateless step,
call-before-effect, atomically-committed execution claim — and this is proven directly in its own first-party
source (not inferred from an absent SDK, unlike Eve). Its layering (Schema → Core/Protocol → Server) is the
cleanest of the 7, its transferable-mechanisms list is the longest with explicit stated preconditions (evidence
of genuinely decomposed code, not just aspiration), and it has the single best model-swap-safety mechanism found
in any of the 7 (provenance-gated opaque provider state, replayed only to the exact producing model/route/
endpoint). Its worst flaw — the event log being off by default (DRIFT-1) — is a **configuration default**, not a
structural defect: the schema, the `Bus.publish`/projector path, and the replay machinery already exist in code;
they just need to become unconditional. That is a much smaller lift than Eve's "the entire foundation is
invisible" problem or Hermes'/Prime's "the foundation is 750K/14K lines of entangled incident-driven code"
problem.

**Runner-up 1: Deepseek-Harness.**
Philosophically the closest match to UCI's own causal-provenance law: its append-only log + "surface" index
(which shadows rather than deletes, and must cite what it shadows) is close to a working implementation of
"evidence is sacred; interpretation is revisable" already. Its plugin/seam/profile-bundle-patch composition model
is explicitly designed for pluggable domain packs — arguably a better long-term fit for UCI's environment layer
than OC's. It loses the top spot for two reasons: (a) its own archaeology flags "everything including the
durable core is a plugin" as a durability hazard (stored sessions depend on exactly which plugins were loaded to
interpret them — the opposite of UCI's "records are self-describing... they outlive their writers"); (b) at
300+ packages and a vendored third-party kernel (Cordis), the integration/onboarding cost is materially higher
than OC's more contained ~86K-line core.

**Runner-up 2 (with a hard caveat): Eve.**
Has the best mechanically-enforced modularity discipline found anywhere in the 7 (23 shrink-only architecture
guards that fail the build on violation) and the cleanest identity/ownership/replay-unit separation. If — and
only if — UCI is willing to build on Vercel's proprietary Workflow SDK as a permanent foundational dependency,
Eve is architecturally excellent. But that is precisely the "no vendor type crosses an adapter" / "everything is
replaceable behind a contract" violation CLAUDE.md's own laws forbid, and its entire crash-transparency guarantee
is *inferred*, not observed, because that SDK's source is completely absent from the checkout. It is demoted
from primary candidate to "excellent pattern reference, do not build on directly" for exactly this reason.

**Explicitly not viable as a primary substrate:** Hermes-Agent (best product, worst extraction target — see §D);
Prime-Agent (best idea trapped in the worst-decomposed monolith of the 7); OpenHands (half the system doesn't
exist in this checkout — nothing to build from); SWE-Agent (solves too little of the continuity problem to
function as a foundation at all, though individual mechanisms are worth lifting).

---

## C. Concrete reuse plan for the leading candidate (OpenCode)

**Reuse largely unchanged:**
- Typed durable event schema (`schema/src/event.ts`, `session-event.ts`) as the starting shape for durable
  records (will need extension with UCI's claim/decision/expectation record types, but the versioning/typing
  discipline is sound).
- Step outcome algebra (`Completed | Retry | Continue | Compacted | RecoverFull`) and the error taxonomy
  (`delivery × operation × recovery`) — provider-agnostic, directly portable.
- Write-ahead execution claim + durable bounded resume counter + boot sweep (`execution.ts`,
  `execution/restart.ts`) — a clean, working "call-before-effect" implementation.
- Doorbell busy-period coordinator (`run-coordinator.ts`) — generic over any keyed map, no domain assumptions.
- Durable inbox with steer/queue delivery and control-item boundaries — directly implements UCI's "admission is
  separate from execution" law.
- Provenance-gated reuse of opaque provider state (`history.ts`, `provider-context.ts`) — this *is* the
  model-swap-safety mechanism UCI needs; adopt near-verbatim.
- Replayable scoped registries (`state.ts`) for plugin/extension lifecycle.

**Needs wrapping (keep the mechanism, put a UCI-owned interface in front so OC's types never leak upward):**
- Permission/governance engine (`permission.ts`) — the rule engine (last-match, decline-as-defect) is good, but
  approvals are currently memory-only/ephemeral; wrap it and add the durable audit trail UCI's "governance
  precedes effect" law requires before any process depends on it.
- Compaction ladder (`compaction.ts`) — wrap so the rolling-summary mechanism becomes a *projection* over a
  preserved evidence log rather than a destructive rewrite of working history.
- Tool/plugin system (`tool.ts`, `tool/plugin/*`, CodeMode) — wrap as UCI's environment-pack interface; keep
  CodeMode's confined-interpreter idea but mediate it through UCI's authority envelope, not OC's ad hoc
  permission checks.
- Delegation (`subagent.ts`) — wrap with a real attenuation layer; do **not** inherit OC's current behavior
  (child = agent's own rules + parent session's rules, not a subset), only the "child = durable session,
  notification-delivery" shape.

**Needs rewriting:**
- Event persistence: make `persist:true` unconditional, not an option — the single highest-leverage fix, and a
  prerequisite for everything else here to be trustworthy.
- Revert/undo: replace the destructive projection delete (`projector.ts:731-766`) with a superseding/
  soft-archive pattern (Hermes' `active`/`compacted` flag pair is a good model to copy).
- Governance durability (see above — this is also a rewrite, not just a wrap, since the current ephemeral-in-
  memory design has no audit path to extend).
- Multi-node fencing: the single-live-owner assumption (protected only by a registration lock, not a fencing
  token) must be replaced before any multi-machine UCI deployment.
- A context/attention manifest: OC has no durable record of exactly what a given step's rendered context
  contained — build net-new (UCI's PB-04).
- All of UCI's substrate-half primitives (claim, decision record, expectation→resolution, competence claim,
  entity scope) — none exist in OC; OC gives you the event-typing discipline to build them on, but the objects
  themselves must be added from scratch.

**Should never become a permanent dependency (where OC's ontology would fight UCI's if kept):**
- "Session" as the largest durable object — UCI needs an entity/process layer above it (cross-session persons,
  goals); do not let OC's session-scoping become load-bearing structurally.
- Effect-TS-specific concurrency idioms (`uninterruptibleMask`, Scope-based registration) as *the* mechanism of
  correctness — fine inside an adapter, but UCI's kernel contracts must restate these guarantees as portable
  invariants, not "whatever Effect happens to give you."
- "The model decides when work is done" (no independent verifier) — must not carry over; UCI requires
  verification separate from generation.
- Coding-agent-shaped tool/workspace vocabulary (git-shadow-repo revert, coding-specific permissions) — fine as
  *one* environment pack, must never be assumed as the universal environment ontology.
- "Dependency direction enforced by convention, not mechanism" (an open question the archaeology itself flags as
  unverified) — this is exactly how DRIFT-1 happened; UCI's dependency-direction law needs a build-time check,
  not an inherited convention that can quietly rot.

---

## D. Architectural gravity (extractability), independent of feature maturity

**High gravity — hard to extract mechanisms from without dragging the whole ontology along:**
- **Hermes-Agent**: 750K LOC, a 14-mixin facade, ContextVar ambient scope threaded through nearly everything,
  provider-specific incident patches woven into the core loop. Describing "take the lease-fencing pattern" is
  easy; actually lifting that code out clean is not.
- **Prime-Agent**: the 13.9K-line `AgentSession` monolith, whose own archaeology states correctness depends on
  "every clear site notifying checkpoint waiters" — an invariant enforced by comment, not by the type system.
- **Eve**: paradoxically high gravity *despite* excellent internal modularity, because its entire
  crash-transparency guarantee is inherited from a single absent vendor SDK. You cannot extract "just the good
  parts" without either depending on `@workflow/*` wholesale or reimplementing its guarantees yourself — at which
  point you are not extracting Eve, you are rewriting it.

**Medium gravity:**
- **Deepseek-Harness**: individually clean seams (packages, plugins, the Cordis kernel) but the composition
  itself is load-bearing — its own archaeology notes stored sessions depend on exactly which plugins interpreted
  them. Pulling one package out is easy; trusting what you pulled out to still mean the same thing, without its
  siblings, is not guaranteed.

**Low gravity — easy to lift specific pieces and discard the rest:**
- **OpenCode**: the clearest "borrow, then replace" candidate — mechanisms are individually isolated with named
  preconditions stated in its own archaeology.
- **OpenHands (client only)**: the REST-tail+WS-since projection pattern and the typed event union are cleanly
  separable UI-side ideas, low gravity precisely because there is no cognitive core attached to drag along
  (which is also why it cannot function as a substrate).
- **SWE-Agent**: because it solves so little, nearly everything in it (state probes, declarative tool bundles,
  the clean/complete split) is a free-standing idea with essentially zero entanglement cost — the flip side of
  it scoring low on almost every capability criterion.

---

## E. Honest gap section

Independently re-confirmed (not just repeated from the archaeology):
- **OpenHands**: the entire Python agent-server (`software-agent-sdk`) is absent — 10 `.py` files total in the
  checkout, no `node_modules`, zero grep hits for the core class names. Every execution/persistence/recovery/
  verification claim about OpenHands above is (b) schema-implied or (c) documented-only, never (a) code-verified.
  Confidence in anything said about its *cognitive core* (as opposed to its client) should be treated as low;
  confidence in its *client-side projection pattern* is high (that part is fully in the checkout and was read in
  depth).
- **Eve**: the `@workflow/*` SDK is absent — confirmed only compiled build stubs exist (`core.mjs` at 7.2K,
  clearly a patched/vendored artifact, not source). Since Eve's entire durability story (crash-transparent
  turns, exactly-once effect acceptance, idle-only handoff) rests on this SDK's guarantees, every claim in §1
  (execution maturity) and §3 (recovery) for Eve above is one level more inferential than the equivalent claims
  for OpenCode or Deepseek-Harness, where the underlying store (SQLite / Cordis kernel) is fully present and
  directly readable.
- **SWE-Agent**: SWE-ReX is absent — confirmed only two SVG logo files match, no importable module. This
  invalidates confidence in the *environment* layer specifically (criterion 10) and in the specific mechanics of
  timeouts/interrupts/liveness that the recovery and process-management stories depend on.

Repos with **no comparable gap** — full first-party source present and directly read:
- **OpenCode**: 86K+ lines of `core/src` read; an honest "not read" list exists (`ai/src` internals,
  `plugin/host.ts`, `mcp/*`, TUI/app packages) but none of it is core-loop-invalidating.
- **Deepseek-Harness**: the vendored Cordis kernel is present in full (independently confirmed via directory
  listing: `vendor/cordis/src`, `LICENSE`, `bin.js`); its own §26 explicitly separates resolved vs. still-open
  questions, and the open ones (subagent-continuation durability details, PTC nested-dispatch logging,
  `workflow`/Ralph rounds at doc-level only) are narrow, not foundational.
- **Prime-Agent**: core TypeScript packages were read directly and in full for the cited ranges; the Python
  kernel (`RT/*.py`) and several daemon files are explicitly marked "delegated reads, spot-checked" rather than
  independently re-read line-by-line — a real but much smaller gap than the three absent-SDK cases above.
- **Hermes-Agent**: full first-party source present; this is the most exhaustively read of the 7 (1,583-line
  archaeology document, the longest of the set) with only narrow, explicitly named open questions remaining
  (gateway auto-reset policy details, NeMo Relay internals, kanban dispatcher claim/reclaim code).

**Net effect on confidence for the build-vs-adopt decision:** claims about OpenCode and Deepseek-Harness carry
the highest evidentiary confidence of the 7 (full source, deeply read, gaps are peripheral) — which reinforces
rather than undercuts the ranking in §B, since the two top candidates are also the two with the least residual
evidentiary uncertainty. Claims about Eve should be treated as "strong pattern evidence, weak foundation
evidence" specifically because of the absent SDK. Claims about OpenHands' cognitive core and SWE-Agent's
environment layer should not be relied upon at all for architectural decisions — only their client-projection
pattern (OpenHands) and their small transferable mechanisms (SWE-Agent) are load-bearing findings.
