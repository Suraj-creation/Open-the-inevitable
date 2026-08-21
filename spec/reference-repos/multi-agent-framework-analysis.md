# Agents Orchestration Deep Dive

> **REFERENCE MATERIAL — NOT ARCHITECTURE LAW.**
> This is an engineering analysis of three *external* multi-agent frameworks (OpenMAIC, OpenClaw,
> NVIDIA NemoClaw). The file paths and code in it belong to those projects, not to this one. It
> contains no invariant this system is bound by.
>
> Relocated 2026-08-16 from `spec/agents-orchestration-deep-dive.md`, where it had been
> miscategorised as "Architecture law". Architecture law lives in
> [`spec/architecture/uci-architecture.md`](../architecture/uci-architecture.md).

---


## A Comprehensive Guide to Building Multi-Agent Systems

*Analysis of OpenMAIC, OpenClaw, and NVIDIA NemoClaw architectures*

---

## Table of Contents

1. [Introduction](#introduction)
2. [Core Agent Architecture Patterns](#core-agent-architecture-patterns)
3. [Agent Orchestration Fundamentals](#agent-orchestration-fundamentals)
4. [Agent-to-Agent Communication](#agent-to-agent-communication)
5. [Building Robust Autonomous Agents](#building-robust-autonomous-agents)
6. [Advanced Orchestration Patterns](#advanced-orchestration-patterns)
7. [Security and Sandboxing](#security-and-sandboxing)
8. [Production Considerations](#production-considerations)

---

## Introduction

This document synthesizes deep architectural insights from three production-grade multi-agent frameworks:

- **OpenMAIC** (Tsinghua University) - Educational multi-agent classroom platform
- **OpenClaw** - Personal AI assistant with subagent orchestration
- **NVIDIA NemoClaw** - Secure sandboxed agent execution framework

Each represents a different approach to agent orchestration, and together they reveal universal patterns for building production multi-agent systems.

---

## Core Agent Architecture Patterns

### 1. Agent Definition Structure

All three frameworks define agents with these core attributes:

```typescript
interface AgentConfig {
  id: string;           // Unique identifier
  name: string;         // Display name
  role: string;         // Functional role (teacher, assistant, student)
  persona: string;      // System prompt / behavioral definition
  priority: number;     // Turn ordering preference
  allowedActions: string[]; // Capabilities/tools available
}
```

**Key Insight**: Agents are **stateless configurations** with **stateful execution**. The config travels with each request; execution state lives in a separate registry.

### 2. The Agent Registry Pattern

OpenMAIC uses a Zustand-based registry with localStorage persistence:

```typescript
// Agent Registry Store
const useAgentRegistry = create<AgentRegistryState>()(
  persist(
    (set, get) => ({
      agents: { ...DEFAULT_AGENTS },
      addAgent: (agent) => set({ agents: { ...agents, [agent.id]: agent } }),
      deleteAgent: (id) => { /* removes from registry */ },
      getAgent: (id) => agents[id],
      listAgents: () => Object.values(agents),
    }),
    { name: 'agent-registry-storage', version: 11 }
  )
);
```

**Why this matters**:
- Default agents are code-defined (not cached)
- Custom agents persist across sessions
- Generated agents are request-scoped and cleaned up

### 3. Agent Capability System

Agents have **allowed actions** that define what they can do:

| Action Type | Examples | Purpose |
|-------------|----------|---------|
| **Slide Actions** | spotlight, laser, play_video | Focus attention on elements |
| **Whiteboard Actions** | wb_draw_text, wb_draw_shape, wb_draw_chart | Hand-drawn explanations |
| **Subagent Actions** | list, kill, steer | Control spawned agents |
| **Communication** | speech, text_delta | Natural language output |

**Defense in Depth**: Actions are filtered by scene type. Slide-only actions (spotlight, laser) are stripped for non-slide scenes even if in the allowed list.

---

## Agent Orchestration Fundamentals

### 1. The Director Pattern (OpenMAIC)

The **Director** is the central orchestrator that decides which agent speaks next.

#### Architecture Flow

```
START → director → [END or agent_generate] → director (loop) → END
```

#### Director Decision Logic

The director adapts its strategy based on agent count:

**Single Agent Mode** (code-only, zero LLM calls):
- Turn 0: Dispatch the sole agent
- Turn 1+: Cue user to speak (keeps session active)

**Multi-Agent Mode** (LLM-based with fast-paths):
- Turn 0 + triggerAgentId: Dispatch trigger agent (skip LLM)
- Otherwise: LLM decides next agent / USER / END

#### Director Prompt Structure

```
# Available Agents
- id: "default-1", name: "AI teacher", role: teacher, priority: 10
- id: "default-2", name: "AI assistant", role: assistant, priority: 7
- id: "default-3", name: "Student A", role: student, priority: 5

# Agents Who Already Spoke This Round
- AI teacher: "Today we'll learn Python" [3 actions | Whiteboard: drew formula]
- AI assistant: "Let me simplify that" [2 actions]

# Conversation Context
[summarized recent exchange]

# Rules
1. Teacher should usually speak first
2. After teacher, consider if a student would add value
3. Do NOT repeat an agent who already spoke
4. If conversation seems complete, output END
5. Consider whiteboard state when routing
```

**Critical Routing Quality Rules**:
- **Role Diversity**: Never dispatch two agents of same role consecutively
- **Content Dedup**: Don't dispatch another agent to explain what was already covered
- **Discussion Progression**: Each agent should advance (explain → question → deeper explanation)
- **Greeting Prevention**: If any agent already greeted, no subsequent agent greets again

### 2. Subagent Registry Pattern (OpenClaw)

OpenClaw manages spawned subagents with a persistent registry:

```typescript
// Subagent Run Record
interface SubagentRunRecord {
  runId: string;
  childSessionKey: string;
  requesterSessionKey: string;
  task: string;
  cleanup: "delete" | "keep";
  startedAt: number;
  endedAt?: number;
  outcome?: { status: "ok" | "error" | "timeout" };
  frozenResultText?: string;  // Captured completion output
  announceRetryCount?: number;
  wakeOnDescendantSettle?: boolean;
}
```

**Key Mechanisms**:

1. **Lifecycle Event Listening**: Agents emit `start`/`end`/`error` events
2. **Completion Waiting**: Gateway RPC waits for subagent completion
3. **Announce Flow**: After completion, announce results back to requester
4. **Cleanup Modes**: Delete (remove attachments) or Keep (retain for follow-ups)
5. **Retry with Backoff**: Failed announces retry with exponential backoff (1s, 2s, 4s... max 8s)

### 3. Blueprint Orchestration (NemoClaw)

NemoClaw uses declarative YAML blueprints:

```yaml
version: "0.1.0"
components:
  sandbox:
    image: "openclaw:latest"
    forward_ports: [18789]
  inference:
    profiles:
      default:
        provider_type: "nvidia"
        endpoint: "https://integrate.api.nvidia.com/v1"
  policy:
    base: "sandboxes/openclaw/policy.yaml"
    additions:
      nim_service:
        endpoints: [{ host: "nim-service.local", port: 8000 }]
```

**Four-Stage Lifecycle**:
1. **Resolve** the artifact
2. **Verify** its digest
3. **Plan** the resources
4. **Apply** through OpenShell CLI

---

## Agent-to-Agent Communication

### 1. Message Passing Architecture

#### OpenMAIC: SSE Streaming with Writer Pattern

Agents stream responses via Server-Sent Events (SSE):

```typescript
// Each node pushes chunks via config.writer()
async function runAgentGeneration(state, agentId, config) {
  const write = config.writer as (chunk: StatelessEvent) => void;

  write({ type: 'agent_start', data: { messageId, agentId, agentName } });

  for await (const chunk of adapter.streamGenerate(messages)) {
    write({ type: 'text_delta', data: { content: chunk.content } });
    write({ type: 'action', data: { actionName, params } });
  }

  write({ type: 'agent_end', data: { messageId, agentId } });
}
```

**Event Types**:
- `agent_start`: Agent begins speaking
- `text_delta`: Streaming text chunks
- `action`: Tool/action execution
- `thinking`: Director/agent loading states
- `cue_user`: Turn passes to user
- `agent_end`: Agent finishes

#### OpenClaw: Gateway RPC + Event Bus

Subagents communicate through a gateway RPC layer:

```typescript
// Spawn subagent
const response = await callGateway({
  method: "agent",
  params: {
    message: task,
    sessionKey: childSessionKey,
    deliver: false,  // Don't deliver immediately
    lane: AGENT_LANE_SUBAGENT,
  }
});

// Wait for completion
const wait = await callGateway({
  method: "agent.wait",
  params: { runId, timeoutMs }
});
```

**Communication Channels**:
- **Gateway RPC**: Cross-process method calls
- **Lifecycle Events**: `start`/`end`/`error` phases broadcast to subscribers
- **Session Store**: Shared state via `~/.openclaw/sessions/`
- **Attachment Sharing**: Files materialized in shared directories

### 2. Turn Management

#### Turn Counting (OpenMAIC)

```typescript
// State tracks turn count
turnCount: Annotation<number>

// Director checks turn limit
if (state.turnCount >= state.maxTurns) {
  return { shouldEnd: true };
}

// Agent increments after speaking
return {
  turnCount: state.turnCount + 1,
  totalActions: state.totalActions + result.actionCount
};
```

**Turn Limit Strategy**: `maxTurns = turnCount + 1` - allows exactly one more director→agent cycle

#### Depth Tracking (OpenClaw)

```typescript
// Prevent infinite subagent spawning
const callerDepth = getSubagentDepthFromSessionStore(requesterInternalKey);
const maxSpawnDepth = cfg.agents?.defaults?.subagents?.maxSpawnDepth ?? 5;

if (callerDepth >= maxSpawnDepth) {
  return { status: "forbidden", error: "Maximum depth reached" };
}

// Child depth = parent depth + 1
const childDepth = callerDepth + 1;
```

### 3. Whiteboard State Sharing

OpenMAIC maintains a **whiteboard ledger** shared across all agents:

```typescript
whiteboardLedger: Annotation<WhiteboardActionRecord[]>({
  reducer: (prev, update) => [...prev, ...update]
});

interface WhiteboardActionRecord {
  actionName: 'wb_draw_text' | 'wb_draw_shape' | ...;
  agentId: string;
  agentName: string;
  params: Record<string, unknown>;
}
```

**Director uses whiteboard state for routing**:
- If whiteboard is crowded (>5 elements), avoid adding more
- Route to agents that will organize or clear
- Track contributors for attribution

---

## Building Robust Autonomous Agents

### 1. Agent Persona Design

Effective personas have these elements:

```typescript
persona: `You are the lead teacher of this classroom.

Your teaching style:
- Explain concepts step by step, building from what students already know
- Use vivid analogies and real-world examples
- Pause to check understanding — ask questions, not just lecture
- Adapt your pace: slow down for difficult parts

Tone: Professional yet approachable. Patient. Encouraging.`
```

**Key Elements**:
- **Role identity**: Clear functional purpose
- **Behavioral guidelines**: Specific do's and don'ts
- **Tone specification**: How to sound
- **Action integration**: Natural use of capabilities

### 2. Structured Output Parsing

Agents parse structured JSON from LLM responses:

```typescript
// Director decision parsing
function parseDirectorDecision(content: string) {
  const jsonMatch = content.match(/\{[\s\S]*?"next_agent"[\s\S]*?\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      nextAgentId: parsed.next_agent,
      shouldEnd: !parsed.next_agent || parsed.next_agent === 'END'
    };
  }
  return { nextAgentId: null, shouldEnd: true };
}
```

**Best Practices**:
- Extract JSON with regex before parsing
- Handle missing/invalid gracefully (default to END)
- Validate agent IDs exist before dispatching

### 3. Action Execution Engine

Actions flow through a typed execution pipeline:

```typescript
// Action translation to canvas operations
const actionTranslations: Record<string, (params: any) => CanvasAction> = {
  spotlight: (params) => ({
    type: 'spotlight',
    elementId: params.elementId,
    dimOpacity: params.dimOpacity ?? 0.7
  }),
  wb_draw_text: (params) => ({
    type: 'text',
    content: params.content,
    x: params.x,
    y: params.y,
    fontSize: params.fontSize
  })
};
```

**Execution Guarantees**:
- Type-safe parameter mapping
- Scene-type filtering (defense in depth)
- Idempotent operations where possible

### 4. Error Handling and Recovery

#### Lifecycle Error Retry Grace (OpenClaw)

```typescript
// Defer terminal error cleanup briefly
const LIFECYCLE_ERROR_RETRY_GRACE_MS = 15_000;

function schedulePendingLifecycleError(params) {
  const timer = setTimeout(() => {
    // Check if run completed successfully in meantime
    if (entry.endedReason === COMPLETE) return;

    // Finalize as error
    completeSubagentRun({
      outcome: { status: "error", error: params.error },
      reason: SUBAGENT_ENDED_REASON_ERROR
    });
  }, LIFECYCLE_ERROR_RETRY_GRACE_MS);
}
```

**Why**: Embedded runs emit transient `error` events during provider/model retry. Defer cleanup so subsequent `start`/`end` can cancel premature failure announces.

#### Announce Retry Budget (OpenClaw)

```typescript
const MAX_ANNOUNCE_RETRY_COUNT = 3;
const ANNOUNCE_EXPIRY_MS = 5 * 60_000; // 5 minutes

// Give up after retries or expiry
if (announceRetryCount >= MAX_ANNOUNCE_RETRY_COUNT) {
  finalizeResumedAnnounceGiveUp({ reason: "retry-limit" });
}
if (endedAgo > ANNOUNCE_EXPIRY_MS) {
  finalizeResumedAnnounceGiveUp({ reason: "expiry" });
}
```

---

## Advanced Orchestration Patterns

### 1. Multi-Agent Discussion Mode

OpenMAIC supports student-initiated discussions:

```typescript
discussionContext: {
  topic: "Quantum Physics",
  prompt: "Explain wave-particle duality"
}

// Director prompt adapts for discussion mode
const discussionSection = isDiscussion ? `
# Discussion Mode
Topic: "${discussionContext.topic}"
Initiator: "${triggerAgentId}"

This is a student-initiated discussion, not a Q&A session.
` : '';
```

**Discussion Flow**:
1. Trigger agent (student) speaks first
2. Teacher responds to guide discussion
3. Other students add perspectives
4. Director prevents repetition, ensures progression

### 2. Thread Binding for Persistent Sessions

OpenClaw supports thread-bound subagents:

```typescript
// Thread binding via plugin hooks
async function ensureThreadBindingForSubagentSpawn(params) {
  const hookRunner = getGlobalHookRunner();

  if (!hookRunner?.hasHooks("subagent_spawning")) {
    return { status: "error", error: "No channel plugin registered" };
  }

  const result = await hookRunner.runSubagentSpawning({
    childSessionKey,
    mode: "session",
    threadRequested: true
  });

  return result.threadBindingReady
    ? { status: "ok" }
    : { status: "error", error: "Thread unavailable" };
}
```

**Use Case**: Subagents stay bound to a thread for follow-up messages (session mode vs run mode)

### 3. Attachment Materialization

Subagents can receive file attachments:

```typescript
async function materializeSubagentAttachments(params) {
  // Create isolated attachment directory
  const relDir = `attachments/${crypto.randomUUID()}`;
  const absDir = path.join(config.attachmentsRoot, relDir);
  await fs.mkdir(absDir, { recursive: true });

  // Write each attachment
  const files = [];
  for (const att of params.attachments) {
    const content = att.encoding === "base64"
      ? Buffer.from(att.content, 'base64')
      : att.content;
    const filePath = path.join(absDir, att.name);
    await fs.writeFile(filePath, content);
    files.push({ name: att.name, bytes: content.length });
  }

  // Add mount path hint to system prompt
  const systemPromptSuffix = mountPathHint
    ? `\n\nAttachments available at: ${mountPathHint}/${relDir}`
    : `\n\nAttachments available in session store.`;

  return { status: "ok", absDir, systemPromptSuffix };
}
```

### 4. Model Selection and Routing

Dynamic model selection per task:

```typescript
function resolveSubagentSpawnModelSelection(params) {
  // Agent-specific model override
  const agentModel = params.cfg.agents?.[params.agentId]?.model;
  if (agentModel) return agentModel;

  // Default model
  return params.cfg.agents?.defaults?.subagents?.model ?? "gpt-4";
}
```

**NemoClaw Inference Profiles**:
```yaml
inference:
  profiles:
    default:
      provider_type: "nvidia"
      model: "nvidia/nemotron-3-super-120b-a12b"
    nim-local:
      provider_type: "openai"
      endpoint: "http://nim-service.local:8000/v1"
    vllm:
      provider_type: "openai"
      endpoint: "http://localhost:8000/v1"
```

---

## Security and Sandboxing

### 1. Network Policy Enforcement (NemoClaw)

Declarative YAML policy controls egress:

```yaml
policy:
  base: "sandboxes/openclaw/policy.yaml"
  additions:
    nim_service:
      name: nim_service
      endpoints:
        - host: "nim-service.local"
          port: 8000
          protocol: rest
    pypi:
      endpoints:
        - host: "pypi.org"
          port: 443
          protocol: https
```

**Policy Layers**:
- **Network**: Blocks unauthorized outbound (hot-reloadable)
- **Filesystem**: Prevents reads/writes outside `/sandbox` and `/tmp` (locked at creation)
- **Process**: Blocks privilege escalation and dangerous syscalls (locked at creation)
- **Inference**: Reroutes model API calls to controlled backends (hot-reloadable)

### 2. Agent Allowlists (OpenClaw)

Cross-agent spawning requires explicit allowlists:

```typescript
const allowAgents = resolveAgentConfig(cfg, requesterAgentId)
  ?.subagents?.allowAgents ?? [];

const allowAny = allowAgents.some(v => v.trim() === "*");
const allowSet = new Set(
  allowAgents
    .filter(v => v.trim() && v.trim() !== "*")
    .map(v => normalizeAgentId(v).toLowerCase())
);

if (!allowAny && !allowSet.has(normalizedTargetId)) {
  return {
    status: "forbidden",
    error: `agentId is not allowed (allowed: ${Array.from(allowSet).join(", ")})`
  };
}
```

### 3. Sandbox Runtime Detection

```typescript
function resolveSandboxRuntimeStatus(params) {
  const agentConfig = resolveAgentConfig(cfg, params.agentId);
  const sandboxed = agentConfig?.sandbox?.enabled === true
    || agentConfig?.runtime?.type === "openshell";

  return { sandboxed, runtime: agentConfig?.runtime?.type };
}

// Sandboxed sessions cannot spawn unsandboxed subagents
if (!childRuntime.sandboxed && requesterRuntime.sandboxed) {
  return {
    status: "forbidden",
    error: "Sandboxed sessions cannot spawn unsandboxed subagents"
  };
}
```

---

## Production Considerations

### 1. State Persistence Strategies

| State Type | Storage | Lifecycle |
|------------|---------|-----------|
| Agent configs | localStorage (Zustand) | Persistent across sessions |
| Subagent runs | Disk JSON (`~/.openclaw/subagent-runs.json`) | Restored on restart |
| Session timing | Session store (`~/.openclaw/sessions/`) | Per-session |
| Attachments | Filesystem (`~/.openclaw/attachments/`) | Cleanup mode dependent |
| Whiteboard ledger | Request state | Per-request |

### 2. Memory Management

#### Sweeper Pattern (OpenClaw)

```typescript
const archiveAfterMs = config.agents?.defaults?.subagents?.archiveAfterMinutes ?? 60;

function startSweeper() {
  sweeper = setInterval(() => {
    sweepSubagentRuns();
  }, 60_000);
  sweeper.unref?.();
}

async function sweepSubagentRuns() {
  const now = Date.now();
  for (const [runId, entry] of subagentRuns.entries()) {
    if (!entry.archiveAtMs || entry.archiveAtMs > now) continue;

    subagentRuns.delete(runId);
    await safeRemoveAttachmentsDir(entry);
    await callGateway({
      method: "sessions.delete",
      params: { key: entry.childSessionKey }
    });
  }

  if (subagentRuns.size === 0) stopSweeper();
}
```

**Purpose**: Prevent unbounded memory growth from completed subagent runs

### 3. Concurrency Limits

```typescript
// Max active children per session
const maxChildren = cfg.agents?.defaults?.subagents?.maxChildrenPerAgent ?? 5;
const activeChildren = countActiveRunsForSession(requesterInternalKey);

if (activeChildren >= maxChildren) {
  return { status: "forbidden", error: "Max children reached" };
}

// Max spawn depth
const maxSpawnDepth = cfg.agents?.defaults?.subagents?.maxSpawnDepth ?? 5;
if (callerDepth >= maxSpawnDepth) {
  return { status: "forbidden", error: "Max depth reached" };
}
```

### 4. Observability

#### Lifecycle Events

```typescript
// Emit lifecycle event for SSE subscribers
emitSessionLifecycleEvent({
  sessionKey: childSessionKey,
  reason: "create" | "subagent-status" | "deleted",
  parentSessionKey: requesterInternalKey,
  label: entry.label
});
```

#### Logging

```typescript
const log = createSubsystemLogger("agents/subagent-registry");

log.warn(`Subagent announce give up run=${runId} retries=${retryCount}`);
log.info(`[Director] Decision: dispatch agent "${decision.nextAgentId}"`);
```

### 5. Testing Strategies

#### Mock Gateway for Tests

```typescript
// Test harness for subagent spawn
function createMockGateway(params) {
  return {
    call: async (method, args) => {
      if (method === "agent.wait") {
        return { status: "ok", endedAt: Date.now() };
      }
      if (method === "sessions.delete") {
        return { deleted: true };
      }
    }
  };
}
```

#### Snapshot Testing

```typescript
// Persist runs to disk for restore testing
persistSubagentRunsToDisk(subagentRuns);

// Restore and verify
const restored = restoreSubagentRunsFromDisk({ runs, mergeOnly: true });
expect(restored).toBeGreaterThan(0);
```

---

## Summary: Building Your Own Agent System

### Minimal Viable Architecture

1. **Agent Registry**: Store agent configs (id, name, role, persona, actions)
2. **Director/Orchestrator**: Decide which agent acts next
3. **State Machine**: Track turns, messages, and completion
4. **Action Executor**: Map agent decisions to operations
5. **Communication Layer**: SSE streaming or RPC for agent output

### Production-Ready Additions

6. **Subagent Registry**: Persist spawned agent state to disk
7. **Lifecycle Events**: Broadcast start/end/error to subscribers
8. **Retry Logic**: Exponential backoff for failed operations
9. **Memory Sweeper**: Archive/purge old completed runs
10. **Concurrency Limits**: Max children, max depth guards
11. **Allowlists**: Control which agents can spawn which
12. **Sandboxing**: Network, filesystem, process isolation
13. **Attachment Handling**: Materialize files for subagents
14. **Model Routing**: Dynamic provider/model selection
15. **Observability**: Logging, metrics, lifecycle events

### Key Design Principles

1. **Stateless configs, stateful execution**: Agent definitions travel with requests; execution state persists separately
2. **Defense in depth**: Filter actions by context, validate at multiple layers
3. **Graceful degradation**: Retry transient errors, give up after budget exhausted
4. **Explicit communication**: Use typed events, structured output, clear turn passing
5. **Resource bounds**: Enforce limits on concurrency, depth, memory, time

---

## Appendix: Code References

### OpenMAIC
- Director Graph: `lib/orchestration/director-graph.ts`
- Director Prompt: `lib/orchestration/director-prompt.ts`
- Agent Registry: `lib/orchestration/registry/store.ts`
- Tool Schemas: `lib/orchestration/tool-schemas.ts`

### OpenClaw
- Subagent Registry: `src/agents/subagent-registry.ts`
- Subagent Spawn: `src/agents/subagent-spawn.ts`
- Subagents Tool: `src/agents/tools/subagents-tool.ts`
- Subagent Announce: `src/agents/subagent-announce.ts`

### NemoClaw
- Blueprint: `nemoclaw-blueprint/blueprint.yaml`
- Policies: `nemoclaw-blueprint/policies/openclaw-sandbox.yaml`

---

*Generated from analysis of OpenMAIC, OpenClaw, and NVIDIA NemoClaw - March 2026*
