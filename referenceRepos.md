# Reference Repositories - Deep Architecture Guide

**Updated:** 2026-05-17  
**Repos covered:**
1. https://github.com/666ghj/MiroFish
2. https://github.com/nousresearch/hermes-agent
3. https://github.com/THU-MAIC/OpenMAIC
4. https://github.com/paperclipai/paperclip
5. https://github.com/earendil-works/pi

---

## How this was analyzed

This document is based on:
- local source inspection of all 5 repos (entry points, services, core docs, architecture files)
- GitHub metadata (stars, forks, releases, issue patterns)
- ecosystem/community signals (issues, release cadence, public discussion channels, Reddit signal where available)

Numbers below are point-in-time snapshots from GitHub API during this update.

---

## At-a-glance comparison

| Repo | Core app (simple) | Primary stack | Architecture center of gravity | GitHub signal snapshot |
|---|---|---|---|---|
| **MiroFish** | Predicts complex outcomes by simulating social agents in a generated world | Python + Flask backend, Vue frontend, Zep + OASIS | Pipeline orchestration: ontology -> graph -> agent profiles -> simulation -> report | ~61.0k stars, AGPL-3.0, latest release v0.1.2 |
| **Hermes Agent** | Persistent personal agent runtime that learns over time | Python core, TUI/gateway layers, SQLite/FTS5 | Long-running agent loop + multi-provider tool runtime + platform gateway | ~154.1k stars, MIT, latest release v0.14.0 (`v2026.5.16`) |
| **OpenMAIC** | One-click multi-agent AI classroom generator | Next.js 16 + TS + LangGraph + Vercel AI SDK | Two-stage generation + real-time orchestration graph + scene runtime | ~17.6k stars, AGPL-3.0, latest release v0.2.1 |
| **Paperclip** | Control plane for running AI-native companies | TypeScript monorepo (Express + React + Drizzle/Postgres) | Governance and execution semantics (companies, agents, issues, heartbeats, budgets) | ~66.0k stars, MIT, latest release v2026.513.0 |
| **pi** | Minimal coding-agent harness you can deeply customize | TypeScript monorepo (`pi-ai`, `pi-agent-core`, `pi-coding-agent`) | Reusable agent runtime primitives + extension/skill system | ~50.6k stars, MIT, latest release v0.74.1 |

---

## 1) MiroFish (`666ghj/MiroFish`)

## What it is (simple)

MiroFish is a **simulation-first prediction system**: instead of directly forecasting with one model, it builds a social world from seed material, simulates multi-agent behavior, then outputs a structured report.

Think of it as: **"upload context -> build a world -> run agents inside it -> analyze emergent behavior."**

## Core application logic

The implementation is a staged backend pipeline:
1. ingest files + requirement
2. generate ontology from text
3. build graph in Zep Cloud
4. extract/filter entities
5. generate OASIS agent profiles
6. auto-generate simulation config
7. run Twitter/Reddit style simulation with monitoring
8. post-process graph memory
9. generate a report with ReACT-style retrieval/tool use

This "pipeline as product" design is the central value: it operationalizes multi-agent simulation end-to-end rather than exposing isolated building blocks.

## Core architecture (code-backed)

- **Backend entry:** `backend/run.py` (Flask bootstrap, config validation)
- **App factory + API surface:** `backend/app/__init__.py`  
  Blueprints: `/api/graph`, `/api/simulation`, `/api/report`
- **Graph stage:**
  - `backend/app/api/graph.py`
  - `backend/app/services/ontology_generator.py`
  - `backend/app/services/graph_builder.py` (Zep graph creation + async chunked ingestion)
- **Simulation stage:**
  - `backend/app/api/simulation.py`
  - `backend/app/services/oasis_profile_generator.py`
  - `backend/app/services/simulation_config_generator.py`
  - `backend/app/services/simulation_runner.py` (background subprocess, IPC monitoring, round/action tracking)
- **Report stage:**
  - `backend/app/api/report.py`
  - `backend/app/services/report_agent.py` (ReACT-like section generation, tool calls via `zep_tools.py`, detailed JSONL logs)
- **Frontend:** Vue app under `frontend/` orchestrating the step-wise flow and status polling
- **State model:** project/task/simulation/report state persisted under `backend/uploads` (filesystem-first storage model)

## End-to-end flow

1. User uploads docs + requirement (`/api/graph/ontology/generate`)
2. Backend extracts text and generates ontology via LLM
3. Graph build starts async (`/api/graph/build`) and pushes text chunks to Zep
4. Entities are fetched/filtered (`/api/simulation/entities/<graph_id>`)
5. Simulation is created (`/api/simulation/create`)
6. Profiles + platform config are generated
7. Simulation run starts (`/api/simulation/run/...`), runner emits progress/action state
8. Report generation starts async (`/api/report/generate`) with task polling
9. User reads report and can continue post-report interaction

## External/community context

- Very high growth curve and social visibility (stars/forks are unusually high for age)
- Release track is early (`v0.1.x`) despite high popularity
- Issue patterns are concentrated in:
  - install/runtime setup friction
  - Zep dependency/quota concerns
  - long-running step stalls (graph/simulation/report stages)
  - provider compatibility edge cases
- Reddit signal exists but is still noisy and fragmented; GitHub issues + Chinese dev forums + Discord/X are currently stronger sources of practical user feedback

## What is strong vs risky

**Strong**
- Clear staged architecture
- Concrete integration of graph memory + simulation + reporting
- Good "operator visibility" via task/status endpoints and logs

**Risk/constraints**
- Heavy external dependency chain (LLM + Zep + simulation runtime)
- Cost/latency rises quickly on large simulations
- Filesystem persistence model is simple but less robust than DB-backed transactional orchestration at scale

---

## 2) Hermes Agent (`NousResearch/hermes-agent`)

## What it is (simple)

Hermes is a **persistent, multi-surface personal agent runtime**: one core agent loop, many interfaces (CLI/TUI, messaging platforms, API/ACP integrations), with memory, tools, skills, and scheduling.

Its defining thesis is not just "run an agent", but **"run one agent system continuously and let it accumulate operational memory/skills."**

## Core application logic

Hermes centers on a robust conversation loop that:
1. builds a stable system prompt
2. resolves provider/runtime mode
3. executes model calls with interruption/cancellation support
4. runs tool calls (sequential or parallel)
5. persists session/memory state
6. continues across interfaces (CLI/gateway/etc.)

This loop is embedded into multiple runtime surfaces without forking behavior.

## Core architecture (code-backed)

- **Top-level architecture docs:**  
  `website/docs/developer-guide/architecture.md`  
  `website/docs/developer-guide/agent-loop.md`
- **Core agent runtime:** `run_agent.py` + `agent/conversation_loop.py`
- **Prompt/context/compression:** `agent/prompt_builder.py`, `agent/context_compressor.py`, `agent/prompt_caching.py`
- **Tool system:** `model_tools.py`, `tools/registry.py`, large `tools/` surface
- **Session/memory persistence:** `hermes_state.py` (SQLite + FTS5), memory manager/plugins
- **Gateway/multiplatform messaging:** `gateway/run.py`, `gateway/session.py`, many `gateway/platforms/*`
- **Scheduling:** `cron/scheduler.py`
- **IDE/editor integration:** `acp_adapter/`

## End-to-end flow

1. Input arrives (CLI, gateway, ACP, batch, etc.)
2. Agent loop assembles effective prompt/context
3. Provider/API mode is resolved (`chat_completions`, `codex_responses`, or Anthropic-native)
4. Model response is parsed for tool calls
5. Tools execute (approval gates, callbacks, concurrency policy)
6. Results are fed back into the loop until final response
7. Session state + memory are persisted
8. Optional background mechanisms run (compression, nudges, cron tasks, gateway upkeep)

## External/community context

- Extremely high adoption signal (stars/forks/issue volume)
- Rapid release cadence; latest release stats communicate very high contributor throughput
- Community activity is strong in GitHub issues and Discord
- Issue themes with highest practical impact:
  - provider auth/OAuth breakage and API policy shifts
  - long-output/truncation and UX in TUI/streaming
  - runtime/environment edge cases across platforms

## What is strong vs risky

**Strong**
- Deeply engineered runtime and tooling surface
- Clear internal docs for architecture and agent-loop behavior
- Strong "single core loop, many interfaces" cohesion

**Risk/constraints**
- Complexity surface is very large (powerful, but operationally heavy)
- Rapid ecosystem/provider changes can break auth/model paths
- Large plugin/toolset matrix increases integration-testing burden

---

## 3) OpenMAIC (`THU-MAIC/OpenMAIC`)

## What it is (simple)

OpenMAIC is a **multi-agent interactive classroom generator**: you give a learning goal or material, it generates a full classroom experience with slides/quizzes/interactions and real-time multi-agent dialogue.

It is not just "chat tutor"; it is closer to **"course generation + classroom runtime."**

## Core application logic

Two major engines work together:
1. **Classroom generation pipeline** (outline -> scenes -> media/TTS -> persisted classroom)
2. **Live orchestration pipeline** (director graph chooses who speaks next, streams events to UI)

This gives both prebuilt lesson structure and live interaction.

## Core architecture (code-backed)

- **Framework & stack:** Next.js 16 + React 19 + TypeScript (`package.json`)
- **Generation job API:** `app/api/generate-classroom/route.ts` (async job + polling contract)
- **Generation core:** `lib/server/classroom-generation.ts`
- **Orchestration graph:** `lib/orchestration/director-graph.ts`
- **Stateless streaming:** `lib/orchestration/stateless-generate.ts`
- **Scene/content pipeline:** `lib/generation/*`
- **Classroom UI runtime:** `app/classroom/[id]/page.tsx`, `components/stage/*`, scene renderers
- **OpenClaw integration:** skill/integration docs and routes embedded in project docs + skill references

## End-to-end flow

1. Client submits requirement to `/api/generate-classroom`
2. Job is created and polled asynchronously
3. Requirement is expanded into scene outlines
4. Scene content/actions are generated
5. Optional media/TTS assets are generated
6. Classroom is persisted and exposed via classroom URL
7. During live interaction, `/api/chat` streams multi-agent events via director graph and SSE
8. Classroom supports export paths (`pptx`, zip/html artifacts)

## External/community context

- Healthy growth and active release cycle (`v0.2.1` already includes substantial feature expansion)
- Discussions and issues show strong real-user feedback loops, especially around:
  - UX flow and interaction quality
  - model/provider settings usability
  - bugs in local deployment settings/UI states
- Public Reddit coverage exists but is relatively weak compared to GitHub + Discord + Chinese channels

## What is strong vs risky

**Strong**
- Distinct product category (interactive classroom, not generic chatbot)
- Clear architecture split between generation and live orchestration
- Strong model/provider breadth and fast iteration

**Risk/constraints**
- Multi-provider + multimodal pipeline complexity can create fragile edges
- Long job duration and streaming reliability require careful ops tuning
- Export/render fidelity across rich scene types remains an ongoing quality challenge

---

## 4) Paperclip (`paperclipai/paperclip`)

## What it is (simple)

Paperclip is a **control plane for AI-native companies**.  
If an agent runtime is an "employee," Paperclip is the "company operating system."

It orchestrates goals, org structure, tasks, approvals, heartbeats, budgets, and governance.

## Core application logic

Paperclip's core innovation is execution semantics, not model novelty:
- company is the top-level boundary
- work is represented as issues/tasks with strict ownership
- agents are invoked through heartbeat runs
- governance and budget policy are first-class (not add-ons)
- stalled execution gets explicit recovery handling

## Core architecture (code-backed)

- **Product/contract docs:**  
  `doc/PRODUCT.md`, `doc/SPEC-implementation.md`, `doc/execution-semantics.md`
- **Server orchestration:** `server/` (Express API and services)
- **Board UI:** `ui/` (React + Vite)
- **Schema/data layer:** `packages/db/` (Drizzle/Postgres)
- **Shared contracts:** `packages/shared/`
- **Adapter system:** `packages/adapters/` + adapter utils
- **Plugin runtime:** `packages/plugins/`

The architecture is highly documentation-driven; runtime semantics are explicitly specified, then implemented.

## End-to-end flow

1. Board creates company, goals, org tree, and issues
2. Issue is assigned (single assignee invariant)
3. Heartbeat scheduler/invoker triggers the assignee runtime via adapter
4. Run state, costs, and activity are logged
5. Issue transitions through status semantics (`todo`, `in_progress`, `in_review`, `blocked`, etc.)
6. Approvals and budget constraints gate continuation
7. Recovery actions are created when execution liveness is lost
8. Board reviews output/artifacts and intervenes when needed

## External/community context

- Very strong adoption and extremely active release stream (calendar-style tags)
- Issue/discussion themes indicate user demand for:
  - local model/runtime integration (e.g., Ollama)
  - richer interaction surfaces with agents
  - onboarding clarity across adapter choices
- Community ecosystem is growing around templates/plugins/extensions

## What is strong vs risky

**Strong**
- Strong semantics for ownership, execution, and governance
- Multi-company isolation model
- Clear adapter/plugin extensibility story

**Risk/constraints**
- Conceptual complexity is high for new users
- Requires disciplined setup to realize full value (not "one prompt and done")
- Fast pace can produce onboarding/documentation drift if not watched

---

## 5) pi (`earendil-works/pi`)

## What it is (simple)

pi is a **minimal coding-agent harness toolkit** with a strong extensibility philosophy: keep core small, expose hooks, let users shape workflow.

It is intentionally not trying to ship every opinionated agent feature in core.

## Core application logic

pi composes three main layers:
1. **`pi-ai`**: provider/model abstraction for tool-capable LLMs
2. **`pi-agent-core`**: evented agent loop + tool execution logic
3. **`pi-coding-agent`**: end-user harness (interactive CLI, print/json modes, RPC, SDK)

Customization is first-class via skills, extensions, templates, themes, and package discovery.

## Core architecture (code-backed)

- **Monorepo workspace:** root `package.json` workspaces
- **Core packages:**
  - `packages/ai` (`@earendil-works/pi-ai`)
  - `packages/agent` (`@earendil-works/pi-agent-core`)
  - `packages/coding-agent` (`@earendil-works/pi-coding-agent`)
  - plus `tui` and `web-ui`
- **Skill system spec/docs:** `packages/coding-agent/docs/skills.md`
- **Coding harness docs:** `packages/coding-agent/README.md`
- **Agent-core runtime docs:** `packages/agent/README.md`

## End-to-end flow

1. User prompt enters coding-agent mode (interactive/print/RPC/SDK)
2. Session context and resources (skills/extensions/templates) are loaded
3. Prompt is handed to `pi-agent-core`
4. `pi-agent-core` converts context to provider-compatible format and streams events
5. Tool calls execute (parallel or sequential based on policy)
6. Results are fed back into loop until completion
7. Session is persisted (JSONL tree/branch model), with optional compaction

## External/community context

- Strong adoption with comparatively low open-issue count relative to size
- Frequent releases with concrete quality/performance fixes
- Most high-signal issue themes involve provider compatibility/auth edge cases and model-specific behavior
- Reddit signal exists, but much of it is setup/showcase content; GitHub issues/releases remain the best technical truth source

## What is strong vs risky

**Strong**
- Very clean composable architecture
- Excellent extensibility model for advanced users/teams
- Reusable lower-level packages beyond the CLI harness

**Risk/constraints**
- Minimal core means users may need to build/install workflow pieces themselves
- Provider churn can affect edge integrations
- Power users benefit most; beginners may initially prefer more opinionated defaults

---

## Cross-repo architectural takeaway

These five projects represent **five different layers** of the agent stack:

1. **MiroFish** -> domain-specific simulation/prediction application
2. **Hermes** -> persistent personal agent runtime platform
3. **OpenMAIC** -> domain-specific multi-agent experience generator (education)
4. **Paperclip** -> organizational control plane/governance layer
5. **pi** -> modular developer-focused agent harness primitives

If you study them together, the clearest pattern is:
- **runtime loop quality** decides reliability (Hermes, pi)
- **execution semantics/governance** decide operational trust (Paperclip)
- **domain pipelines** decide product value (MiroFish, OpenMAIC)

That is the practical architecture map for building serious agent systems in 2026.

