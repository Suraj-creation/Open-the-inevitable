# The Inevitable — Intelligence Operating System Architecture Plan

**Author:** Suraj Kumar  
**Plan Version:** 1.1  
**Date:** 2026-05-28  
**Status:** Post-autoplan Review — Ready for Phase 1 Implementation

> **Review applied:** /autoplan (CEO + Design + Eng + DX phases) — 13 auto-approved changes, 5 taste decisions pending user input, 3 user challenges pending user input. See `## GSTACK REVIEW REPORT` at end of document.

---

## Executive Summary

The Inevitable is a civilization-scale AI education platform designed to compress decades of learning into months, take any human from zero knowledge to research-level mastery in any domain, and do it for free — globally. This is not an LLM wrapper. It is an **Intelligence Operating System**: a deeply autonomous, observable, agentic, controllable, contextual, extensible, modular, persistent, and composable infrastructure that powers 18 specialized AI agents, a 5-level hierarchical orchestration engine, graph-native long-term memory, event-driven cognition, agentic RAG with dual-path retrieval, and a Universal Learning Intelligence substrate that pervades every interaction.

The platform serves two primary modes:
- **Student Mode**: Recursive prerequisite discovery → personalized knowledge graph → 7-layer concept teaching → adaptive practice → research transition
- **Educator Mode**: AI co-architect tools, classroom generation, curriculum design, live teaching assistance

**Core challenge**: Build a production-grade, zero-cost-infrastructure, fully autonomous agent operating system that is architecturally sound enough to evolve into a civilization-scale intelligence platform.

---

## 1. Problem Statement & Architectural Mandate

### The Education Problem
Current education operates on catastrophic assumptions: that students share a common foundation, that knowledge can be delivered in fixed sequences, and that one teacher can attend to many different minds simultaneously. The result: 20+ years of learning that produces degrees but not understanding, credentials but not capability, memorization but not mastery.

### The Platform Problem
Existing agent frameworks (LangGraph, AutoGen, CrewAI, OpenAI Swarm, Semantic Kernel) solve narrow problems — they orchestrate LLM calls, manage tool execution, or handle basic memory. None of them provide the complete cognitive infrastructure needed for a platform that must:

- Maintain a **living, learner-specific knowledge graph** across months/years
- Operate **18 specialized agents** with distinct personas, evolving over time
- Support **hierarchical multi-agent orchestration** with 5 authority levels
- Execute **long-running autonomous workflows** (multi-hour research generation)
- Provide **millisecond-latency RAG** with 98.7%+ accuracy on complex concept retrieval
- Sustain **cross-session episodic memory** that never loses context
- Enable **real-time collaborative learning** with live classroom generation
- Run on **zero-cost infrastructure** (Oracle Cloud Always Free)

### The Mandate
Design a foundational intelligence infrastructure where **any future agent, workflow, orchestration system, memory system, RAG pipeline, simulation, autonomous runtime, cognitive system, or intelligence module can be dynamically wired, integrated, orchestrated, observed, governed, and evolved at any point in time without architectural rigidity.**

---

## 2. Five Laws of Architecture

Every architectural decision in The Inevitable is governed by five invariant laws:

1. **Everything Is an API** — Every component, agent, memory store, and intelligence module exposes a versioned, typed, observable API surface. Nothing is internal-only.
2. **Everything Is Addressable** — Every agent, session, memory node, concept, workflow, and event has a stable, persistent identifier that survives restarts and version upgrades.
3. **Everything Is Interceptable** — Every action, tool call, agent decision, and system event passes through an interceptor chain. This enables governance, observability, and evolution without touching core logic.
4. **Everything Is Composable** — Agents, workflows, memory layers, RAG pipelines, and runtime primitives are composition-native. New capabilities emerge from wiring, not rewriting.
5. **Everything Is Hot-Swappable** — Any model, any agent persona, any orchestration strategy, any memory backend, and any retrieval method can be replaced at runtime without system downtime.

---

## 3. Master System Architecture

### 3.1 High-Level System Topology

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                                     │
│  Next.js 15 Web App │ Socket.IO Real-time │ LiveKit Audio/Video      │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ HTTPS / WSS / WebRTC
┌─────────────────────────────▼───────────────────────────────────────┐
│                     API GATEWAY LAYER                                │
│  FastAPI (Python) │ LiteLLM Router │ Auth (JWT + RBAC)              │
│  Rate Limiting │ Request Interception │ Circuit Breakers             │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────┐
│                  AGENTIC CONTROL PLANE (ACP)                         │
│  Agent Factory │ Component Registry │ Event Bus │ Config Store       │
│  Feature Flags │ Action Interceptor │ Plugin System │ Tool Registry  │
│  Budget Controller │ Governance Engine │ Audit Logger               │
└────────────────┬────────────────────┬───────────────────────────────┘
                 │                    │
┌────────────────▼──────┐   ┌────────▼────────────────────────────────┐
│  ORCHESTRATION ENGINE │   │        MEMORY ARCHITECTURE               │
│                        │   │                                          │
│  L5: Meta-Director     │   │  Episodic Memory (PostgreSQL + pgvector) │
│  L4: Domain Director   │   │  Semantic Memory (Neo4j Knowledge Graph) │
│  L3: Sub-Director      │   │  Procedural Memory (Redis + Qdrant)      │
│  L2: Specialized Agent │   │  Collective Memory (Shared Vector Store) │
│  L1: Tool              │   │  Hot Cache (Redis 7)                     │
│                        │   │  Cross-Session Persistence (Mem0)        │
│  LangGraph Runtime     │   │                                          │
│  PydanticAI Agents     │   └──────────────────────────────────────────┘
│  Temporal Workflows    │
└────────────────┬──────┘
                 │
┌────────────────▼───────────────────────────────────────────────────┐
│                     18 SPECIALIZED AGENTS                           │
│  Supervisor │ ULI │ To-Do List │ Explanation │ Practice Mode       │
│  Revision │ World-Today │ Auto Note │ Socratic │ Code Helper       │
│  Micro-Research │ Socio-Ethical │ CBSE Platform │ Notebook LLM    │
│  Identical Agent │ Live Classroom │ Educator Co-Arch │ RAG Agent  │
└────────────────┬───────────────────────────────────────────────────┘
                 │
┌────────────────▼───────────────────────────────────────────────────┐
│              INTELLIGENCE SUBSTRATE                                 │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │   Agentic RAG    │  │  Dynamic System  │  │  Universal      │  │
│  │   Pipeline       │  │  Prompting (DSP) │  │  Learning       │  │
│  │                  │  │                  │  │  Intelligence   │  │
│  │  PageIndex (LLM) │  │  Adaptive Prompt │  │  (ULI)          │  │
│  │  Qdrant (Vector) │  │  Evolution       │  │                 │  │
│  │  Meilisearch     │  │  Per-learner     │  │  Knowledge DAG  │  │
│  │  (Lexical)       │  │  System State    │  │  Prerequisite   │  │
│  └──────────────────┘  └──────────────────┘  │  Recursive      │  │
│                                               │  Discovery      │  │
│                                               └─────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
                 │
┌────────────────▼───────────────────────────────────────────────────┐
│                   DATA & INFRASTRUCTURE LAYER                       │
│  PostgreSQL 16 + pgvector │ Neo4j │ Qdrant │ Redis 7              │
│  MinIO (Object Store) │ Meilisearch │ Langfuse │ OpenTelemetry     │
│  K3s on Oracle Cloud Always Free │ Cloudflare │ GitHub Actions     │
└────────────────────────────────────────────────────────────────────┘
```

### 3.2 Repository Structure (Turborepo Monorepo)

```
the-inevitable/
├── apps/
│   ├── web/                    # Next.js 15 frontend
│   └── api/                    # FastAPI backend
├── packages/
│   ├── agents/                 # 18 agent implementations
│   │   ├── supervisor/
│   │   ├── uli/                # Universal Learning Intelligence
│   │   ├── explanation/
│   │   ├── practice/
│   │   ├── revision/
│   │   ├── socratic/
│   │   ├── code-helper/
│   │   ├── micro-research/
│   │   ├── auto-note/
│   │   ├── todo-list/
│   │   ├── world-today/
│   │   ├── socio-ethical/
│   │   ├── cbse-platform/
│   │   ├── notebook-llm/
│   │   ├── identical/
│   │   ├── live-classroom/
│   │   ├── educator/
│   │   └── rag/
│   ├── acp/                    # Agentic Control Plane
│   │   ├── agent-factory/
│   │   ├── component-registry/
│   │   ├── event-bus/
│   │   ├── config-store/
│   │   ├── action-interceptor/
│   │   ├── plugin-system/
│   │   ├── tool-registry/
│   │   ├── budget-controller/
│   │   └── governance/
│   ├── memory/                 # Memory architecture
│   │   ├── episodic/
│   │   ├── semantic/
│   │   ├── procedural/
│   │   ├── collective/
│   │   └── eternal-graph/
│   ├── rag/                    # RAG infrastructure
│   │   ├── page-index/
│   │   ├── vector-store/
│   │   └── lexical/
│   ├── orchestration/          # Orchestration primitives
│   │   ├── director/
│   │   ├── workflows/
│   │   └── temporal/
│   ├── dsp/                    # Dynamic System Prompting
│   ├── observability/          # OpenTelemetry + Langfuse
│   └── shared/                 # Types, utils, schemas
├── infrastructure/
│   ├── k8s/                    # K3s manifests
│   ├── docker/                 # Docker compose files
│   └── scripts/                # Setup and deploy scripts
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## 4. Core Infrastructure Primitives

### 4.1 Agentic Control Plane (ACP)

The ACP is the meta-layer giving the system sovereign control over all agents and all runtime behavior. It is the single most critical architectural component.

**Component Registry**
- All agents, tools, memory backends, RAG pipelines, and runtime modules register at startup
- Registry entries include: identifier, version, capabilities, health endpoint, resource constraints
- Supports hot-swap: new version registers → traffic shifts → old version deregisters
- Backed by Redis with PostgreSQL as durable store

**Event Bus**
- All system events (agent invocations, memory writes, tool calls, user interactions) flow through the event bus
- Implementation: Redis Streams (primary, sub-100ms latency) + NATS JetStream (durable, cross-service)
- Every event is typed, versioned, traceable (OpenTelemetry span attached)
- Enables: event sourcing, audit trail, replay, debugging, analytics

**Action Interceptor**
- Every agent action passes through an interceptor chain before execution
- Interceptors (ordered): Auth/RBAC → Budget Check → Rate Limit → Content Safety (Guardrails AI) → Audit Log → Execute → Response Filter → Telemetry
- Interceptors are composable middleware, not hardcoded checks
- Any interceptor can halt execution with a structured error

**Agent Factory**
- Creates agent instances with full context: persona, memory access, tool grants, DSP state, budget allocation
- Supports: singleton agents (Supervisor), pool agents (Explanation), ephemeral agents (micro-task)
- Factory pattern enables per-learner agent customization without agent code changes

**Tool Registry**
- Central catalog of all tools available to all agents
- Each tool: schema (Pydantic), permissions (which agents can call it), rate limits, observability hooks
- Dynamic registration: new tools appear at runtime without restart
- MCP (Model Context Protocol) integration: external MCP servers auto-register as tool providers

**Config Store**
- Centralized, versioned configuration for all system parameters
- Backed by PostgreSQL with Redis cache
- Feature flags: per-user, per-agent, per-environment rollout
- Hot reload: config changes propagate to running agents within 100ms

### 4.2 Event Sourcing Foundation

Every state change in the system is an immutable event. The current state is derived by replaying events. This enables:
- Complete audit trail of all learner interactions
- Time-travel debugging: replay any session to any point
- Analytics: aggregate events for learning analytics, A/B testing
- Recovery: rebuild any state after failure

**Event Schema (Pydantic)**
```python
class SystemEvent(BaseModel):
    event_id: UUID
    event_type: str                    # e.g. "agent.invoked", "memory.written"
    aggregate_id: str                  # e.g. learner_id, session_id
    aggregate_type: str                # e.g. "LearnerSession", "AgentInstance"
    payload: dict[str, Any]
    metadata: EventMetadata
    timestamp: datetime
    trace_id: str                      # OpenTelemetry trace ID
    span_id: str
    version: int                       # Schema version for evolution

class EventMetadata(BaseModel):
    agent_id: Optional[str]
    user_id: str
    session_id: str
    causation_id: Optional[UUID]       # Event that caused this event
    correlation_id: UUID               # Request correlation chain
```

**Event Streams (Redis Streams)**
- `events:agent` — all agent lifecycle events
- `events:memory` — all memory read/write events
- `events:rag` — all retrieval events with retrieved chunks
- `events:user` — all user interaction events
- `events:system` — infrastructure health, circuit breaker states
- `events:audit` — compliance-grade audit log (immutable, append-only)

---

## 5. Runtime Architecture

### 5.1 Agent Runtime Stack

**LangGraph (Primary Orchestration Runtime)**
- Stateful graph-based agent execution
- Used for: Supervisor Agent, Director agents, multi-step reasoning workflows
- Nodes = agent actions or tool calls
- Edges = conditional routing based on agent decisions
- State = TypedDict with full learner context, memory references, conversation history
- Checkpointing: every node transition is checkpointed to PostgreSQL via LangGraph's checkpoint interface
- Enables: workflow pause/resume, human-in-the-loop, debugging

**PydanticAI (Agent Framework for Specialized Agents)**
- Type-safe, Pydantic-native agent implementation
- Used for: all 18 specialized agents (Explanation, Practice, ULI, etc.)
- Every agent's input and output is a fully typed Pydantic model
- Tool calls are type-safe function signatures
- Structured output enables downstream chaining without string parsing

**Temporal (Durable Workflow Execution)**
- Used for: long-running autonomous workflows (multi-hour research generation, curriculum building)
- Provides: durability (survives server crashes), retry logic, timeout handling, cron scheduling
- Workflows that run for hours without losing state
- Key workflows:
  - `GenerateLearningPathWorkflow`: Recursive prerequisite discovery → curriculum generation
  - `ResearchGenerationWorkflow`: Stage 0→6 research transition pipeline
  - `CurriculumEvolutionWorkflow`: Continuous learning path adaptation
  - `IdenticalAgentTrainingWorkflow`: Persona learning and evolution
  - `ClassroomGenerationWorkflow`: Live classroom asset pipeline (OpenMAIC-inspired)

### 5.2 Agent Loop Design (Hermes-Inspired)

Every agent in The Inevitable follows a hardened conversation loop:

```
1. CONTEXT ASSEMBLY
   - Load learner profile from Eternal Memory Graph
   - Retrieve relevant knowledge graph subgraph
   - Apply DSP (Dynamic System Prompting) state
   - Load conversation history (with compression if needed)
   - Resolve tool grants from ACP Tool Registry

2. PROMPT CONSTRUCTION
   - System prompt = DSP-generated, learner-specific, evolving prompt
   - Context window management (token budget allocation)
   - Memory injection (top-k episodic + semantic references)
   - ULI state injection (current knowledge graph position)

3. MODEL INVOCATION
   - Route through LiteLLM (model-agnostic abstraction)
   - Primary: Gemini 2.5 Pro (complex reasoning, curriculum generation)
   - Secondary: Gemini 2.5 Flash (fast responses, practice, Q&A)
   - Fallback: Gemini 1.5 Flash (cost optimization)
   - Streaming enabled by default

4. TOOL EXECUTION
   - Parse structured tool calls from model response (PydanticAI)
   - Pass through Action Interceptor chain
   - Execute tools (parallel where independent, sequential where dependent)
   - Feed results back into context

5. RESPONSE GENERATION
   - Validate response against Guardrails AI schemas
   - Apply content safety filters
   - Structure output per agent's output schema

6. STATE PERSISTENCE
   - Write interaction to Episodic Memory
   - Update learner's knowledge graph (mastery states, confidence scores)
   - Emit events to Redis Streams
   - Update DSP state for next interaction
   - Record OpenTelemetry spans

7. LOOP CONTROL
   - Continue if more tool calls needed
   - Return final response if complete
   - Escalate to supervisor if confidence below threshold
```

### 5.3 Model Routing (LiteLLM)

```python
MODEL_ROUTING = {
    "complex_reasoning": "gemini/gemini-2.5-pro",      # Curriculum, research, prerequisite discovery
    "fast_response": "gemini/gemini-2.5-flash",         # Explanation, Q&A, practice
    "cost_optimized": "gemini/gemini-1.5-flash",        # Note generation, summarization
    "multimodal": "gemini/gemini-2.5-pro",              # Diagram analysis, visual learning
    "code": "gemini/gemini-2.5-pro",                    # Code helper, agentic code editor
}
```

Fallback chain with automatic retry and circuit breaker per model endpoint.

---

## 6. Hierarchical Multi-Director Orchestration Engine

### 6.1 The Five-Level Hierarchy

```
L5: META-DIRECTOR (System-level orchestration)
    │  Manages: Global resource allocation, cross-domain coordination,
    │           system health, agent lifecycle, emergency response
    │  Implements: LangGraph stateful graph with global system state
    │
    ├── L4: DOMAIN DIRECTOR — Education Domain
    │       Manages: Student journey orchestration, learning session flow,
    │                educator interactions, curriculum sequencing
    │       Implements: LangGraph subgraph with domain state
    │
    ├── L4: DOMAIN DIRECTOR — Research Domain
    │       Manages: Research workflows, Stage 0→6 pipeline,
    │                knowledge creation, synthesis
    │
    ├── L4: DOMAIN DIRECTOR — Infrastructure Domain
    │       Manages: Memory consolidation, RAG optimization,
    │                persona evolution, system improvement
    │
    │   ├── L3: SUB-DIRECTOR — Learning Session
    │   │       Manages: Active session agents, concept delivery,
    │   │                adaptive routing between specialized agents
    │   │       Implements: Director pattern (single LLM orchestrator)
    │   │
    │   ├── L3: SUB-DIRECTOR — Assessment
    │   │       Manages: Practice generation, mastery validation,
    │   │                gap detection, remediation routing
    │   │
    │   └── L3: SUB-DIRECTOR — Research Pipeline
    │           Manages: Research stage progression, evidence gathering,
    │                    synthesis, novel contribution generation
    │
    └── L2: SPECIALIZED AGENTS (18 agents — see Section 8)
            │
            └── L1: TOOLS (registered in ACP Tool Registry)
```

### 6.2 Director Pattern Implementation (OpenMAIC-Inspired)

The Director pattern keeps orchestration decisions with a single LLM orchestrator rather than distributing them across agents, preventing coordination failures.

```python
class DirectorState(TypedDict):
    learner_id: str
    session_id: str
    current_concept: Optional[str]
    knowledge_graph_position: KnowledgeGraphState
    active_agents: list[AgentReference]
    conversation_history: list[Message]
    confidence_threshold: float
    last_decision: Optional[DirectorDecision]
    whiteboard: dict[str, Any]          # Shared state between agents (ledger pattern)

class SubDirectorGraph:
    def build(self) -> CompiledStateGraph:
        graph = StateGraph(DirectorState)
        graph.add_node("director_decision", self.director_decision_node)
        graph.add_node("agent_invocation", self.agent_invocation_node)
        graph.add_node("result_integration", self.result_integration_node)
        graph.add_node("memory_write", self.memory_write_node)
        graph.add_conditional_edges("director_decision", self.route_to_agent)
        graph.add_edge("agent_invocation", "result_integration")
        graph.add_edge("result_integration", "memory_write")
        graph.add_edge("memory_write", "director_decision")
        return graph.compile(checkpointer=PostgresCheckpointer())
```

**Whiteboard Ledger**: Agents share state via a structured whiteboard (key-value store in Redis), not through direct calls. The director reads from and writes to the whiteboard. Agents never call each other directly.

**Agent Registry**: Every agent announces its identity, capabilities, and current state to the director via the whiteboard on activation. Director uses this registry for routing decisions.

### 6.3 Parallel Concurrent Execution

When a learning session requires multiple independent operations, the director schedules them in parallel:

```python
async def parallel_agent_execution(agents: list[AgentTask]) -> list[AgentResult]:
    # Group independent tasks
    independent_groups = identify_independent_groups(agents)
    results = []
    for group in independent_groups:
        group_results = await asyncio.gather(*[
            invoke_agent(task) for task in group
        ])
        results.extend(group_results)
    return results
```

Example parallel execution: While the Explanation Agent teaches a concept, the Practice Mode Agent pre-generates practice problems, and the Auto Note Agent drafts notes — all simultaneously.

### 6.4 Self-Evolving Agent Personas

Agents evolve their personas based on feedback and performance:

```python
class AgentPersona(BaseModel):
    agent_id: str
    teaching_style: TeachingStyle          # Socratic / Direct / Narrative / Analogical
    tone: AgentTone                        # Encouraging / Precise / Playful / Formal
    analogy_domains: list[str]             # Preferred analogy domains for this learner
    abstraction_level: float               # 0.0 (concrete) to 1.0 (abstract)
    pacing_multiplier: float               # Speed multiplier based on learner progress
    
class PersonaEvolutionEngine:
    async def evolve_persona(
        self, 
        persona: AgentPersona, 
        feedback_signals: FeedbackSignals
    ) -> AgentPersona:
        # Update persona based on: engagement rate, comprehension signals,
        # explicit feedback, session outcomes
        # A/B test new personas against baseline
        # Persist evolved persona to Eternal Memory Graph
```

---

## 7. Memory Architecture — The Eternal Memory Graph

### 7.1 Four Memory Types

**Episodic Memory** (PostgreSQL 16 + pgvector)
- What: Every interaction, every explanation, every answer, every confusion signal
- Schema: session_id, timestamp, agent_id, interaction_type, content, embedding, outcomes
- Retrieval: semantic similarity (pgvector) + temporal recency + learner_id filter
- Decay: soft decay (older memories weighted less unless reinforced)
- Cross-session: all episodic memories persist indefinitely per learner

**Semantic Memory** (Neo4j Knowledge Graph)
- What: The learner's evolving map of understood concepts, relationships between concepts, mastery levels
- Structure: Directed Acyclic Graph (DAG) — concept nodes, prerequisite edges, cross-domain bridges
- Properties per node: concept_id, mastery_level (0-6), confidence_score, last_tested, temporal_decay_rate
- Updates: After every interaction, mastery scores are updated via Bayesian knowledge tracing
- Cross-session persistence: The graph is the learner's permanent cognitive map
- Queries: "Find all concepts the learner has not mastered that are prerequisites of X"

**Procedural Memory** (Redis 7 + Qdrant)
- What: How the learner learns — their strategies, workflow preferences, problem-solving patterns
- Structure: behavioral embeddings + structured pattern records
- Used by: DSP to adapt system prompts; Director to choose agent sequencing
- Examples: "This learner understands better with analogies first", "This learner needs 3 practice problems before advancing"

**Collective Memory** (Shared Qdrant Cluster)
- What: Aggregated, anonymized learning patterns across all learners
- Used for: Cold-start personalization (new learner receives guidance from similar learner profiles), curriculum optimization, concept difficulty estimation
- Privacy: All data aggregated and anonymized before entering collective memory

### 7.2 Memory Access Architecture

```python
class EternalMemoryGraph:
    def __init__(self):
        self.episodic = EpisodicMemoryStore(postgres_pool, pgvector)
        self.semantic = SemanticMemoryStore(neo4j_driver)
        self.procedural = ProceduralMemoryStore(redis_client, qdrant_client)
        self.collective = CollectiveMemoryStore(shared_qdrant)
        self.mem0 = Mem0Client()                    # Cross-session coordination layer

    async def retrieve_context(
        self, 
        learner_id: str, 
        query: str, 
        concept: Optional[str] = None
    ) -> MemoryContext:
        # Parallel retrieval from all memory types
        episodic_future = self.episodic.search(learner_id, query, top_k=5)
        semantic_future = self.semantic.get_knowledge_state(learner_id, concept)
        procedural_future = self.procedural.get_learning_patterns(learner_id)
        
        episodic, semantic, procedural = await asyncio.gather(
            episodic_future, semantic_future, procedural_future
        )
        
        return MemoryContext(
            relevant_history=episodic,
            knowledge_graph_state=semantic,
            learning_patterns=procedural,
        )

    async def write_interaction(
        self, 
        learner_id: str, 
        interaction: InteractionRecord
    ):
        # Write to all relevant memory stores
        await asyncio.gather(
            self.episodic.write(learner_id, interaction),
            self.semantic.update_mastery(learner_id, interaction.concepts_covered),
            self.procedural.update_patterns(learner_id, interaction.behavioral_signals),
        )
        # Emit memory event to event bus
        await self.event_bus.publish(MemoryWrittenEvent(learner_id=learner_id, ...))
```

### 7.3 Knowledge Graph — The Heart of ULI

The knowledge graph is **never pre-built**. It is generated dynamically per learner per topic:

```python
class UniversalLearningIntelligence:
    async def generate_knowledge_graph(
        self, 
        learner: LearnerProfile, 
        target_concept: str
    ) -> ConceptDAG:
        # Step 1: Decompose target concept into atomic units
        atomic_concepts = await self.decompose_concept(target_concept)
        
        # Step 2: For each concept, recursively discover prerequisites
        # Terminates at Zero-Knowledge Criterion (intuitively graspable)
        dag = await self.recursive_prerequisite_expansion(atomic_concepts)
        
        # Step 3: Cross-reference with learner's existing knowledge graph
        learner_graph = await self.memory.semantic.get_knowledge_state(learner.id)
        
        # Step 4: Prune already-mastered subtrees, highlight gaps
        optimized_path = self.compute_optimal_learning_path(dag, learner_graph)
        
        # Step 5: Persist the personalized graph
        await self.memory.semantic.merge_graph(learner.id, optimized_path)
        
        return optimized_path

    async def recursive_prerequisite_expansion(
        self, 
        concepts: list[str], 
        depth: int = 0
    ) -> ConceptDAG:
        if depth > MAX_RECURSION_DEPTH:
            return ConceptDAG(terminal=True)
        
        results = []
        for concept in concepts:
            # Check if this satisfies Zero-Knowledge Criterion
            if self.is_zero_knowledge_terminal(concept):
                return ConceptDAG(concept=concept, terminal=True)
            
            # Discover prerequisites via LLM reasoning
            prerequisites = await self.discover_prerequisites(concept)
            
            # Recurse
            sub_graphs = await self.recursive_prerequisite_expansion(
                prerequisites, depth + 1
            )
            results.append(ConceptDAG(concept=concept, prerequisites=sub_graphs))
        
        return ConceptDAG.merge(results)
```

**The Seven Layers of Understanding** (applied to every concept node):
- Layer 0: Story/Intuition (narrative, analogy, everyday experience)
- Layer 1: Visual Understanding (diagrams, mental models)
- Layer 2: Conceptual Model (definitions, relationships)
- Layer 3: Mathematical/Logical Formulation (equations, proofs)
- Layer 4: Implementation (experiments, code, practice)
- Layer 5: Optimization (edge cases, advanced techniques)
- Layer 6: Research Insight (open questions, original contribution)

---

## 8. The 18 Specialized Agents

### 8.1 Agent Catalog

| # | Agent | Primary Role | Core Technology | Memory Access |
|---|-------|-------------|----------------|---------------|
| 1 | **Supervisor** | Orchestrates all agents, routes sessions, manages learner journey | LangGraph stateful director | Full access (all 4 memory types) |
| 2 | **Universal Learning Intelligence (ULI)** | Recursive prerequisite discovery, knowledge graph construction | LangGraph + Gemini 2.5 Pro | Semantic (primary), Collective |
| 3 | **Explanation Agent** | Concept delivery across 7 abstraction layers | PydanticAI + Gemini 2.5 Flash | Episodic + Semantic |
| 4 | **Practice Mode Agent** | Adaptive problem generation, mastery validation | PydanticAI + Gemini 2.5 Flash | Semantic (knowledge state) |
| 5 | **Revision Agent** | Spaced repetition, knowledge decay repair | PydanticAI + Temporal workflows | Episodic (decay tracking) |
| 6 | **Socratic Agent** | Guided discovery via question chains | PydanticAI + Gemini 2.5 Pro | Episodic + Semantic |
| 7 | **Auto Note Builder** | Hierarchical notes per ULI concept layers | PydanticAI + Gemini 2.5 Flash | Episodic |
| 8 | **To-Do List Agent** | Learning roadmap generation from knowledge DAG | PydanticAI | Semantic (DAG → linearized) |
| 9 | **World-Today Agent** | Connect concepts to current events and research | PydanticAI + web search tools | Semantic + RAG |
| 10 | **Code Helper Agent** | Programming education, debugging, architecture | PydanticAI + code execution tools | Procedural (coding patterns) |
| 11 | **Micro-Research Agent** | First original contribution scaffolding | LangGraph + Temporal | Semantic (Level 6 content) |
| 12 | **Socio-Ethical Agent** | Ethics, values, civic reasoning integration | PydanticAI | Episodic + Collective |
| 13 | **CBSE Platform Agent** | Class 1-12 curriculum-aligned delivery | PydanticAI + RAG | Semantic (CBSE graph) |
| 14 | **Notebook LLM Agent** | Interactive notebook learning (evolved) | PydanticAI | Episodic |
| 15 | **Identical Agent** | Digital twin — evolves to mirror the learner | LangGraph + persona evolution | All 4 types (deepest access) |
| 16 | **Live Classroom Agent** | Multi-agent classroom generation (OpenMAIC-inspired) | LangGraph director + SSE streaming | Collective |
| 17 | **Educator Co-Architect** | Educator tools, curriculum design, analytics | PydanticAI + LangGraph | All types (educator scope) |
| 18 | **RAG Agent** | Autonomous retrieval, knowledge synthesis | LangGraph + dual-path RAG | Qdrant + Neo4j |

### 8.2 Supervisor Agent — Master Orchestrator

The Supervisor is the L3 Sub-Director for every learning session. It:

1. **Receives the learner's request** and parses intent (via ULI)
2. **Checks the knowledge graph state** to understand where the learner is
3. **Decides which agent(s) to invoke** based on intent + knowledge state + DSP
4. **Manages the whiteboard** — shared state across agents in the session
5. **Monitors confidence signals** — routes to different agents if understanding is dropping
6. **Escalates** to Domain Director (L4) if the session requires cross-domain coordination

```python
class SupervisorAgent:
    graph: CompiledStateGraph       # LangGraph supervisor graph
    uli: UniversalLearningIntelligence
    memory: EternalMemoryGraph
    dsp: DynamicSystemPrompting
    acp: AgenticControlPlane
    
    async def handle_session(self, session: LearnerSession) -> SessionResponse:
        # Build initial state
        state = await self.build_session_state(session)
        
        # Run supervisor graph
        async for event in self.graph.astream(state):
            # Stream agent responses to client via Socket.IO
            await self.stream_event(session.client_id, event)
        
        # Persist session outcomes
        await self.memory.write_session(session, state)
        
        return state.final_response
```

### 8.3 Identical Agent — Digital Twin

The most complex agent. It evolves to become a digital version of the learner through:
- Deep episodic memory analysis (all interactions)
- Behavioral pattern learning (how the learner thinks, solves, communicates)
- Persona embedding (the learner's unique cognitive fingerprint)
- Feedback loop: explicit corrections + implicit signals

Applications:
- Practice conversations with the learner's future self
- Simulate how the learner would explain concepts (to detect gaps)
- Generate highly personalized content in the learner's own voice
- Long-term companion that knows the learner better than any teacher could

---

## 9. Dynamic System Prompting (DSP)

DSP is the engine that makes every agent interaction feel like a first-class, fully contextualized experience. The system prompt is not static — it is **continuously generated** based on:

```python
class DynamicSystemPrompting:
    async def generate_system_prompt(
        self, 
        agent_id: str, 
        learner: LearnerProfile, 
        session_context: SessionContext
    ) -> str:
        return await self.prompt_builder.build(
            base_template=self.get_agent_template(agent_id),
            learner_profile=learner,
            knowledge_state=await self.memory.semantic.get_knowledge_state(learner.id),
            learning_patterns=await self.memory.procedural.get_patterns(learner.id),
            session_context=session_context,
            persona=await self.persona_engine.get_persona(agent_id, learner.id),
            dsp_state=await self.get_dsp_state(learner.id),
        )
```

DSP State includes:
- Current concept position in the knowledge graph
- Active 7-layer level (which abstraction layer are we at?)
- Persona configuration (tone, pacing, analogy domains)
- Emotional calibration signals
- Session objectives (exam prep vs. mastery vs. research)
- Time constraints

---

## 10. Agentic RAG & Knowledge Infrastructure

### 10.1 Dual-Path RAG Architecture

The platform uses a dual-path retrieval system chosen based on query type:

**Path A: PageIndex (LLM-Reasoning Retrieval)**
- Used for: Complex conceptual queries, multi-hop reasoning, explanation generation
- Process:
  1. Parse query into semantic intent
  2. Identify relevant knowledge domains
  3. LLM reasons over indexed page metadata (no direct retrieval first)
  4. Targeted retrieval of specific passages identified by LLM
  5. Synthesis of retrieved passages
- Accuracy: ~98.7% on curriculum-aligned queries
- Latency: 800ms-2s (acceptable for complex explanation)

**Path B: Qdrant Vector Search**
- Used for: Fast retrieval, related concept discovery, practice problem generation
- Collections:
  - `curriculum_chunks`: All CBSE Class 1-12 content, chunked + embedded
  - `concepts_global`: Global concept definitions, cross-referenced
  - `practice_problems`: Problem bank with difficulty + concept tags
  - `learner_episodic`: Per-learner episodic memory embeddings (isolated namespaces)
- Latency: <50ms for top-k retrieval
- Reranking: Cohere Rerank or cross-encoder model before synthesis

**Path C: Meilisearch (Lexical Retrieval)**
- Used for: Exact term matching, question keyword search, CBSE textbook lookups
- Integrated as a hybrid retrieval step: BM25 scores merged with vector scores

### 10.2 RAG Agent (Autonomous Retrieval)

The RAG Agent operates as an autonomous researcher, not just a retrieval pipe:

```python
class RAGAgent:
    async def retrieve_and_synthesize(
        self, 
        query: str, 
        learner_context: LearnerContext
    ) -> RAGResponse:
        # Decide retrieval strategy
        strategy = await self.decide_strategy(query, learner_context)
        
        if strategy == "complex_reasoning":
            results = await self.page_index.retrieve(query)
        elif strategy == "fast_lookup":
            results = await self.qdrant.search(query, top_k=10)
            results = await self.reranker.rerank(query, results)
        else:  # hybrid
            vector_results = await self.qdrant.search(query, top_k=15)
            lexical_results = await self.meilisearch.search(query)
            results = self.reciprocal_rank_fusion(vector_results, lexical_results)
        
        # Synthesize — not just concatenate
        synthesis = await self.synthesizer.synthesize(
            query=query,
            retrieved_chunks=results,
            learner_level=learner_context.current_layer,
            synthesis_mode=strategy.synthesis_mode
        )
        
        return RAGResponse(
            synthesis=synthesis,
            sources=results,
            confidence=self.estimate_confidence(results),
            trace=self.build_retrieval_trace()
        )
```

### 10.3 Knowledge Ingestion Pipeline

For CBSE content, research papers, and educator-uploaded material:

```
Source Material → Document Parser (MinIO storage)
    → Chunking Strategy (semantic chunking, not fixed-size)
    → Embedding Generation (text-embedding-004 or Gemini embedding)
    → Qdrant Upsert (with metadata: concept_tags, difficulty, grade_level)
    → Meilisearch Index (for lexical search)
    → Neo4j Graph Update (concept node creation + relationship edges)
    → Event: "knowledge.ingested" → downstream agents notified
```

---

## 11. Observability Stack

### 11.1 Four Pillars of Observability

**Tracing (OpenTelemetry + Langfuse)**
- Every agent invocation is a trace
- Every tool call is a span
- Every LLM call is a span with: model, tokens, latency, cost
- Every memory access is a span
- Every RAG retrieval is a span with: query, retrieved chunks, rerank scores
- Traces flow to Langfuse (LLM-specific observability) and OTEL collector

**Metrics (Prometheus + Grafana)**
- Agent invocation rate, latency, error rate per agent
- LLM token consumption, cost per session
- Memory store read/write latency
- RAG retrieval accuracy (sampled ground truth evaluation)
- Learner engagement signals (session length, concept progression rate)

**Logging (Structured JSON → Loki)**
- Every log line is JSON with: trace_id, span_id, agent_id, learner_id, severity
- Log aggregation via Loki
- Alerting via Grafana alerts

**Learning Analytics (Custom + Langfuse)**
- Concept mastery progression per learner
- Common confusion points (aggregated)
- Agent effectiveness scores (does agent A produce better outcomes than agent B for concept X?)
- Learning velocity metrics (concepts mastered per session)
- Curriculum optimization signals

### 11.2 Langfuse Integration

```python
from langfuse import Langfuse
from langfuse.openai import openai  # drop-in replacement

class ObservableAgent:
    def __init__(self):
        self.langfuse = Langfuse()
    
    async def invoke(self, input: AgentInput) -> AgentOutput:
        trace = self.langfuse.trace(
            name=f"agent.{self.agent_id}",
            user_id=input.learner_id,
            session_id=input.session_id,
            metadata={
                "concept": input.current_concept,
                "knowledge_layer": input.current_layer,
                "agent_id": self.agent_id,
            }
        )
        
        # All LLM calls automatically traced via Langfuse SDK
        result = await self._execute(input, trace)
        
        trace.update(
            output=result.summary,
            score=result.confidence_score
        )
        
        return result
```

### 11.3 Eternal Trace Store

Beyond standard telemetry, every interaction creates a permanent trace in the Eternal Memory Graph:
- Learner sees their complete learning history
- System uses historical traces for curriculum optimization
- Educators see per-student progress analytics
- Researchers use aggregate anonymized traces for educational AI research

---

## 12. Governance Architecture

### 12.1 Agentic Control Plane Governance

**Budget Controller**
```python
class BudgetController:
    async def check_budget(self, agent_id: str, operation: AgentOperation) -> BudgetDecision:
        # Per-learner daily/monthly token budget
        # Per-agent cost limits
        # System-wide cost ceiling
        # Graceful degradation: route to cheaper model if budget low
```

**Content Safety (Guardrails AI)**
- All LLM outputs pass through Guardrails AI validators
- Validators: content appropriateness (age-appropriate for students), factual grounding, hallucination detection, harmful content blocking
- Educational context validators: is this explanation pedagogically sound?

**ABAC (Attribute-Based Access Control)**
- Agent permissions are defined by attributes: learner_age, subscription_tier, educator_role, agent_type
- Example: Micro-Research Agent only accessible to learners at Layer 5+ mastery
- Example: Educator Co-Architect only accessible to educator role accounts
- Every tool call checks ABAC before execution (via Action Interceptor)

**Zero-Trust Architecture**
- Every inter-service call is authenticated (mutual TLS)
- Every agent has a scoped identity with minimal required permissions
- Secrets managed by Vault (or K3s secrets)
- No agent can access another agent's memory namespace

**Circuit Breaker Pattern**
- Every external dependency (LLM providers, memory stores) has a circuit breaker
- States: CLOSED (healthy) → OPEN (failing, fast-fail) → HALF-OPEN (testing recovery)
- Prevents cascade failures when external services degrade

### 12.2 Human-in-the-Loop Gates

For high-stakes operations (Temporal workflows):
- Micro-Research publication: human educator review gate before content is published
- Persona evolution: learner confirms major persona shifts
- Curriculum restructuring: notify learner when learning path significantly changes

---

## 13. Student Mode — Complete Flow

```
1. LEARNER ARRIVES
   ├── New learner → Diagnostic assessment → Learner profile creation
   └── Returning learner → Load profile from Eternal Memory Graph → Resume

2. LEARNING INTENT PARSED
   └── Supervisor Agent parses: "I want to learn Deep Learning"
       ├── ULI generates knowledge graph (recursive prerequisite expansion)
       ├── Compare with learner's existing knowledge graph
       └── Compute optimal learning path (gap-filled, personalized)

3. SESSION ORCHESTRATION (Sub-Director manages)
   ├── Select starting concept (deepest unmastered prerequisite)
   ├── DSP generates learner-specific system prompts for each agent
   └── Activate relevant agents for this concept:
       ├── Explanation Agent (primary concept delivery)
       ├── Auto Note Agent (background note generation)
       └── Practice Mode Agent (pre-generating problems)

4. CONCEPT DELIVERY (7-Layer Model)
   Layer 0: Explanation Agent → Story/Intuition
   Layer 1: Explanation Agent → Visual/Mental Model
   Layer 2: Explanation Agent → Conceptual Definition
   [Socratic Agent may interleave for guided discovery]
   Layer 3: Explanation Agent → Formal/Mathematical
   Layer 4: Practice Mode Agent → Implementation problems
   [Code Helper Agent if coding concepts]
   Layer 5: Practice Mode Agent → Edge cases, optimization
   Layer 6: Micro-Research Agent → Research frontier

5. MASTERY VALIDATION
   ├── Practice Mode Agent generates adaptive test
   ├── Mastery score computed via Bayesian knowledge tracing
   ├── If mastered: mark in knowledge graph, advance to next concept
   └── If not mastered: Socratic Agent diagnoses gap → remediation loop

6. SESSION CLOSE
   ├── Auto Note Agent compiles session notes
   ├── To-Do List Agent updates learning roadmap
   ├── Revision Agent schedules spaced repetition
   ├── All memory stores updated
   └── Streaming telemetry to Langfuse + OpenTelemetry
```

---

## 14. Educator Mode — Complete Flow

The Educator Mode mirrors the Student Mode's intelligence but applies it to curriculum creation, live teaching augmentation, and student analytics.

**Core Educator Capabilities:**
1. **Curriculum Co-Design** — Educator Co-Architect Agent helps educators design ULI-aligned curricula
2. **Live Classroom Generation** — Live Classroom Agent (OpenMAIC-inspired) generates multi-agent interactive classrooms
3. **Student Analytics** — Aggregate learner knowledge graph states → class-wide gap detection
4. **Content Creation** — Auto-generate explanations, practice problems, notes at any difficulty level
5. **Persona as Co-Teacher** — Identical Agent instances of the educator (to scale the educator's voice)

---

## 15. Accelerated Learning & Research Creation Intelligence (UALRCI)

The UALRCI compresses the journey from ignorance to original research contribution 4-6x through:

### The Six-Stage Research Transition Pipeline

| Stage | Name | Duration (Traditional) | Duration (UALRCI) | Key Activities |
|-------|------|----------------------|-------------------|----------------|
| 0 | **Ignorance** | N/A | Week 1 | Zero-knowledge assessment, goal setting |
| 1 | **Awareness** | Months | Days | ULI knowledge graph + Survey of field |
| 2 | **Comprehension** | Years | Weeks | Systematic concept mastery via 7-layer model |
| 3 | **Application** | Months | Days | Implementation projects, real problems |
| 4 | **Analysis** | Years | Weeks | Critical reading, gap identification, literature synthesis |
| 5 | **Synthesis** | Years | Months | Novel connections, hypothesis generation |
| 6 | **Original Contribution** | Decades | Months/Year | Research paper, novel method, open-source contribution |

### Compression Mechanisms
- **Prerequisite Elimination**: Remove time wasted on topics not directly prerequisite to the goal
- **Parallel Learning**: Multiple sub-topics learned simultaneously when dependencies allow
- **Active Recall Density**: Far more practice problems per unit time than traditional methods
- **Zero Redundancy**: Never re-teach already-mastered content (knowledge graph tracking)
- **Direct Expert Pattern Access**: LLM provides access to patterns that took experts decades to discover

---

## 16. Technology Decision Matrix

### 16.1 Core Decisions

| Category | Selected Technology | Reason | Alternatives Considered |
|----------|--------------------|---------|-----------------------|
| **Frontend** | Next.js 15 + React 19 | RSC for SEO, streaming, App Router for layouts | Remix (less ecosystem), SvelteKit (smaller ecosystem) |
| **Backend** | FastAPI (Python) | Native async, Pydantic-native, excellent AI ecosystem | Express.js (weaker AI libs), Django (too heavy) |
| **Agent Orchestration** | LangGraph + PydanticAI | LangGraph for complex stateful flows, PydanticAI for type-safe agents | LangChain (less control), AutoGen (too opinionated), CrewAI (limited state) |
| **Durable Workflows** | Temporal | Best-in-class durability for long-running agents | Airflow (batch-focused), Prefect (less agent-native), Dagster (data pipeline focus) |
| **Primary LLM** | Gemini 2.5 Pro/Flash | Best multimodal, 1M context, cost-competitive | GPT-4o (no context window advantage), Claude (no native video) |
| **LLM Router** | LiteLLM | Model-agnostic, drop-in, OpenAI-compatible | Direct Gemini SDK (no fallback), custom proxy (maintenance burden) |
| **Vector DB** | Qdrant | Best filtering, HNSW, payload-indexed, self-hosted | Pinecone (cloud-only), Weaviate (complex ops), Chroma (not production-grade) |
| **Graph DB** | Neo4j | Industry standard, Cypher query language, native graph algorithms | Amazon Neptune (cloud-only), ArangoDB (less graph-native) |
| **Relational DB** | PostgreSQL 16 + pgvector | pgvector for hybrid search, JSONB for flexible schemas | MySQL (no vector), SQLite (no concurrency) |
| **Cache** | Redis 7 | Streams for event bus, pub/sub, sorted sets for rankings | Memcached (no streams), Kafka (too heavy for cache) |
| **Object Storage** | MinIO | S3-compatible, self-hosted, free | S3 (cost at scale), Backblaze (less control) |
| **Search** | Meilisearch | Blazing fast, easy to self-host, good API | Elasticsearch (heavy ops), Typesense (less mature) |
| **Memory Layer** | Mem0 + custom | Cross-session coordination, structured memory management | Letta (MemGPT) — good architecture, adopted Mem0 for lighter footprint |
| **Observability** | Langfuse + OpenTelemetry | LLM-specific + standard telemetry, self-hosted | LangSmith (cloud-only, expensive), Helicone (less control) |
| **Content Safety** | Guardrails AI | Composable validators, Pydantic-native, extensible | NeMo Guardrails (NVIDIA-specific), custom validators (maintenance) |
| **Real-time** | Socket.IO + LiveKit | Socket.IO for agent streaming, LiveKit for audio/video | WebSockets raw (no rooms), Daily.co (proprietary) |
| **Infrastructure** | K3s on Oracle Cloud Always Free | 4 ARM cores, 24GB RAM — zero cost, Kubernetes API | GKE (expensive), EKS (expensive), bare VMs (no orchestration) |
| **CDN / Edge** | Cloudflare | Free tier, global edge, DDoS protection, Workers | Fastly (expensive), AWS CloudFront (lock-in) |
| **CI/CD** | GitHub Actions | Native to repo, free minutes, good ecosystem | GitLab CI (not on GitHub), CircleCI (cost) |
| **Build System** | Turborepo | Monorepo-native, incremental builds, task graph | Nx (heavier config), Lerna (deprecated) |

### 16.2 Architectural Patterns Adopted

| Pattern | Source Inspiration | Application |
|---------|------------------|-------------|
| **Director Pattern** | OpenMAIC, Hermes | Single LLM orchestrator per sub-director level |
| **Whiteboard Ledger** | OpenMAIC | Agents share state via structured whiteboard, not direct calls |
| **Event Sourcing** | Paperclip, actor-model | All state changes are immutable events; state derived by replay |
| **Pipeline as Product** | MiroFish | End-to-end staged pipeline for curriculum generation (not isolated components) |
| **Agent Loop** | Hermes | Hardened conversation loop: context → prompt → invoke → tools → persist |
| **Skill System** | pi | Composable agent capabilities registered in Tool Registry |
| **Blueprint Orchestration** | NemoClaw | YAML-defined workflow blueprints for Temporal workflows |
| **Persistent Agent Runtime** | Hermes | Long-lived agent sessions with SQLite → PostgreSQL persistence |
| **Subagent Registry** | OpenClaw | Disk-persisted agent registry with lifecycle events |
| **Memory Consolidation** | MemGPT / Letta | Hierarchical memory with active context + archival retrieval |
| **Knowledge OS** | LlamaIndex patterns | Agent-native knowledge management, index as cognitive layer |
| **Graph-Native Memory** | Zep + Neo4j | Learner knowledge graph as first-class memory structure |
| **Cognitive Architecture** | ACT-R / SOAR inspired | Declarative (semantic) + Procedural + Episodic memory separation |
| **Deep Observability** | OpenTelemetry | Distributed tracing from frontend to model invocation |

### 16.3 What Was Rejected and Why

| Technology | Rejected | Reason |
|-----------|---------|--------|
| **AutoGen** | Agent framework | Too opinionated conversation model; poor support for complex stateful flows |
| **CrewAI** | Agent framework | Limited state management; poor observability; role-based model too rigid |
| **OpenAI Swarm** | Orchestration | Ephemeral by design (no state persistence); not suitable for long-running education sessions |
| **Semantic Kernel** | Orchestration | .NET-primary; Python version less mature; limited graph memory support |
| **Haystack** | RAG | Heavy for our use case; PageIndex + Qdrant is simpler and more controllable |
| **Airflow** | Workflow engine | Batch-oriented DAGs; not designed for real-time agent workflows |
| **Ray** | Distributed compute | Excellent for training; over-engineered for inference orchestration at our scale |
| **Dagster** | Workflow engine | Data pipeline focus; asset-centric model doesn't map to agent sessions |
| **Prefect** | Workflow engine | Better than Airflow but still less agent-native than Temporal |
| **NVIDIA NeMo** | LLM platform | Requires NVIDIA GPUs (we're on Oracle ARM); custom models not needed initially |
| **LangSmith** | Observability | Cloud-only, expensive at scale; Langfuse self-hosted achieves same goals |

---

## 17. Implementation Blueprint

### Phase 1 — Foundation (Weeks 1-8)

**Goal**: Core infrastructure + single working agent + basic memory

**Infrastructure**
- [ ] K3s cluster setup on Oracle Cloud Always Free
- [ ] PostgreSQL 16 + pgvector deployment
- [ ] Redis 7 deployment (event bus + cache)
- [ ] Qdrant deployment
- [ ] MinIO deployment
- [ ] Meilisearch deployment
- [ ] Langfuse self-hosted deployment
- [ ] OpenTelemetry collector

**Backend**
- [ ] FastAPI project structure (Turborepo monorepo)
- [ ] ACP skeleton (event bus, action interceptor, basic registry)
- [ ] LiteLLM proxy setup (Gemini routing)
- [ ] Temporal worker setup
- [ ] PostgreSQL schemas (learner profiles, sessions, events)
- [ ] Authentication (JWT + RBAC)

**First Agent: Explanation Agent**
- [ ] PydanticAI-based agent with Gemini 2.5 Flash
- [ ] 7-layer concept delivery (hard-coded, not yet dynamic)
- [ ] Basic episodic memory (PostgreSQL)
- [ ] Langfuse tracing integration
- [ ] Socket.IO streaming to frontend

**Frontend**
- [ ] Next.js 15 project
- [ ] Basic chat interface
- [ ] Socket.IO client (streaming)

**Deliverable**: A user can ask to learn any topic, and the Explanation Agent delivers a 7-layer explanation with full observability.

---

### Phase 2 — Orchestration (Weeks 9-16)

**Goal**: Multi-agent coordination + ULI knowledge graph + full memory

**Memory**
- [ ] Neo4j knowledge graph deployment + schema
- [ ] Eternal Memory Graph implementation (all 4 types)
- [ ] Mem0 integration for cross-session persistence
- [ ] Knowledge graph CRUD operations

**ULI**
- [ ] Recursive prerequisite expansion algorithm
- [ ] Zero-Knowledge Criterion detection
- [ ] Knowledge graph generation from learning intent
- [ ] Learner knowledge state tracking (Bayesian mastery)

**Supervisor Agent**
- [ ] LangGraph stateful director graph
- [ ] Agent routing logic
- [ ] Whiteboard ledger implementation
- [ ] Session state management

**Additional Agents (5 more)**
- [ ] Practice Mode Agent (adaptive problem generation)
- [ ] To-Do List Agent (knowledge DAG → linearized roadmap)
- [ ] Auto Note Builder Agent
- [ ] Socratic Agent
- [ ] Revision Agent (with Temporal scheduled workflows)

**DSP**
- [ ] Dynamic system prompt generation
- [ ] Learner profile injection
- [ ] Persona configuration

**Deliverable**: A learner can specify any topic, receive a personalized learning path, progress through concepts with multiple agents, and resume across sessions.

---

### Phase 3 — Intelligence (Weeks 17-24)

**Goal**: Full RAG pipeline + all 18 agents + governance

**Agentic RAG**
- [ ] PageIndex implementation (LLM-reasoning retrieval)
- [ ] Qdrant dual-path integration
- [ ] Meilisearch hybrid retrieval
- [ ] CBSE content ingestion pipeline
- [ ] RAG accuracy benchmarking + optimization

**Remaining Agents**
- [ ] World-Today Agent (with web search tools)
- [ ] Code Helper Agent (with code execution sandbox)
- [ ] Micro-Research Agent (with Temporal long workflows)
- [ ] Socio-Ethical Agent
- [ ] CBSE Platform Agent
- [ ] Notebook LLM Agent
- [ ] Live Classroom Agent (OpenMAIC-inspired pipeline)
- [ ] Educator Co-Architect Agent
- [ ] RAG Agent
- [ ] Identical Agent (digital twin — persona learning)

**Governance**
- [ ] Guardrails AI integration (all agents)
- [ ] ABAC implementation (action interceptor)
- [ ] Budget Controller
- [ ] Circuit breakers (all external dependencies)

**UALRCI Pipeline**
- [ ] Stage 0→6 research transition workflow (Temporal)
- [ ] Learning compression strategies implementation

**Deliverable**: Full platform with all 18 agents, complete RAG, governance, and research pipeline.

---

### Phase 4 — Production (Weeks 25-32)

**Goal**: Scale, resilience, educator tools, public launch

**Educator Mode**
- [ ] Educator Co-Architect Agent full feature set
- [ ] Live Classroom generation pipeline
- [ ] Student analytics dashboard
- [ ] Curriculum design tools

**Self-Evolving Personas**
- [ ] Feedback signal collection
- [ ] Persona evolution algorithm
- [ ] A/B testing framework for persona variants
- [ ] Identical Agent evolution milestones

**Production Hardening**
- [ ] Load testing (k6 or Locust)
- [ ] Chaos engineering (agent failure scenarios)
- [ ] Backup and disaster recovery
- [ ] Multi-region read replicas (PostgreSQL streaming replication)
- [ ] Monitoring dashboards (Grafana)
- [ ] Alert rules (Grafana Alerts)
- [ ] SLA definitions per component

**AR/VR Foundation**
- [ ] Three.js immersive concept visualization (first experiments)
- [ ] WebXR integration planning

**Zero-Cost Production Validation**
- [ ] Oracle Cloud Always Free cluster at full load
- [ ] Cloudflare caching strategy for static content
- [ ] Optimization of token consumption per session

**Deliverable**: Public launch-ready platform, full educator mode, self-evolving agents, production-grade reliability.

---

## 18. Future Evolution Path

### Near-Term (6-12 months)
- **AR/VR Learning Environments**: Three.js → WebXR → full immersive concept visualization
- **Agentic Code Editor**: VSCode extension with ULI-aware code tutoring
- **Multi-Language Support**: Hindi, Tamil, Bengali — India-first localization
- **Offline Mode**: Progressive Web App with local model fallback

### Medium-Term (1-2 years)
- **Collective Intelligence**: Aggregated learning patterns improve all learners' paths
- **Institute Platform**: Full "New Institute" digital infrastructure
- **Live Classroom at Scale**: Thousands of simultaneous AI-generated classrooms
- **Digital Twin Maturity**: Identical Agent matures into full cognitive model of learner
- **Research Publication Pipeline**: Stage 6 outputs that contribute to actual research

### Long-Term (2-5 years)
- **Domain-Specific LLMs**: Fine-tuned models on education-specific corpora
- **Conversational Programming Language**: Natural language → executable programs
- **Custom OS**: Education-optimized operating environment
- **Global Knowledge Repository**: Every human achievement documented, accessible
- **AGI Education Interface**: When AGI arrives, The Inevitable is the interface through which humans collaborate with it

### Architectural Evolution Principles
- **Never break the 5 Laws**: All evolution must preserve API, addressability, interceptability, composability, hot-swappability
- **Event sourcing enables evolution**: New capabilities can be derived from existing events without migration
- **Agent lifecycle**: New agents plug into ACP without changes to existing agents
- **Model independence**: LiteLLM abstraction means any future model (open-source, custom) slots in
- **Memory persistence**: The Eternal Memory Graph survives all platform evolutions

---

## 19. Key Risks & Mitigations

| Risk | Severity | Likelihood | Mitigation |
|------|---------|-----------|------------|
| **LLM hallucination in curriculum** | High | Medium | Guardrails AI validation, human review gate for novel content, CBSE RAG grounding |
| **Oracle Cloud Always Free quota exceeded** | High | Medium | Token budget controller, model routing to cheaper variants, caching aggressive |
| **Knowledge graph quality** | High | Medium | Bootstrapped with curated concept ontologies, learner feedback loop for correction |
| **Agent coordination deadlock** | High | Low | Whiteboard pattern (no direct agent calls), timeout + circuit breaker on every agent call |
| **Memory store consistency** | Medium | Medium | Event sourcing for audit; Neo4j + PostgreSQL both have ACID semantics |
| **Gemini API rate limits** | Medium | Medium | LiteLLM with rate limit tracking, exponential backoff, Flash fallback |
| **Recursive prerequisite infinite loop** | Medium | Low | MAX_RECURSION_DEPTH guard, cycle detection in DAG construction |
| **Privacy (learner knowledge graphs)** | High | Low | Isolated Neo4j namespaces per learner, encrypted at rest, GDPR-compliant retention |

---

## 20. Success Metrics

**Learning Outcomes**
- Concept mastery progression rate (concepts mastered per session)
- Learning velocity (time to 80% mastery on any concept vs. traditional methods)
- Session retention (learners returning for next session within 7 days)
- Research pipeline progression (learners reaching Stage 4+ within 3 months)

**System Performance**
- Agent response latency P50/P95/P99
- RAG retrieval accuracy (sampled human evaluation)
- Memory read/write latency
- System uptime (target: 99.5% on zero-cost infra)

**Architectural Quality**
- Zero-downtime deployments (hot-swap validation)
- Event replay success rate (event sourcing integrity)
- Circuit breaker activation rate (resilience signal)
- Langfuse cost per session (economic sustainability)

---

*This plan synthesizes vision from: The Inevitable Master Vision, Vision.md, advanced-agent-architecture.md, agents-orchestration-deep-dive.md, tech-stack.md, Core-functionalities.md, Universal-Learning-Intelligence-Agent.md, The_Inevitable_Vision_Comprehensive.md, and reference architectures from MiroFish, Hermes Agent, OpenMAIC, Paperclip, and pi.*

---

## GSTACK REVIEW REPORT

**Review:** /autoplan | **Branch:** master | **Date:** 2026-05-28
**Phases completed:** CEO Review → Design Review → Eng Review → DX Review
**Codex voice:** unavailable (binary not found) — Claude subagent only

---

### AUTO-APPROVED CHANGES (applied immediately)

| # | Source | Change | Principle |
|---|--------|--------|-----------|
| 1 | CEO | Add ULI validation corpus to Phase 1 (10-20 curated prerequisite chains for test topics) | P1: completeness |
| 2 | CEO | Add cold-start learner archetypes (5-10 predefined profiles for collective memory bootstrap) | P1: completeness |
| 3 | CEO | Add Claude and GPT-4o to LiteLLM routing from Phase 1 — not Gemini-only | P1: resilience |
| 4 | CEO | Add early warning metrics: prerequisite graph depth distribution, concept accuracy sampling | P2: blast radius |
| 5 | CEO | Add infra scaling milestone: define user count threshold for moving beyond Oracle Always Free | P3: pragmatic |
| 6 | Design | Add primary navigation structure (3-5 views) to Phase 1 UI spec | P1: completeness |
| 7 | Design | Design ULI loading experience — progress narration ("Mapping prerequisites...") not spinner | P1: critical UX |
| 8 | Design | Specify Shadcn/ui + Tailwind as design system — explicit over clever | P5: explicit |
| 9 | Design | Add WCAG 2.1 AA accessibility to Phase 1 requirements | P1: completeness |
| 10 | Eng | Add Alembic (SQLAlchemy migrations) to Phase 1 | P1: critical |
| 11 | Eng | Add event durability matrix (Redis vs NATS per event type) to Section 4 | P1: completeness |
| 12 | Eng | Add LangGraph PostgreSQL checkpointer schema initialization to Phase 1 | P2: blast radius |
| 13 | Eng | Specify per-agent JWT auth for ACP internal service calls | P1: security |
| 14 | Eng | Move backup strategy (pg_dump to MinIO) from Phase 4 to Phase 1 | P1: critical data |
| 15 | Eng | Add API versioning scheme (/api/v1/) and Pydantic model versioning to Phase 1 | P1: foundation |
| 16 | Eng | Define PydanticAI output schemas for Phase 1 agents (ExplanationOutput, etc.) | P1: contracts |
| 17 | Eng | Add Redis key naming convention to plan | P5: explicit |
| 18 | Eng | Add pytest test strategy (≥80% coverage, CI gate) to Phase 1 | P1: non-negotiable |
| 19 | Eng | Add ULI algorithm test harness with known-correct prerequisite chain corpus | P1: core algorithm |
| 20 | Eng | Add latency SLA table (first token <500ms, full response <8s) to Phase 1 spec | P1: user-facing |
| 21 | Eng | Add pgBouncer or AsyncPG connection pooling to Phase 1 infrastructure | P2: concurrent access |
| 22 | DX | Add `create-agent` CLI scaffolding tool to Phase 2 developer tooling | P1: platform extensibility |
| 23 | DX | Define ACP error response format: problem + cause + fix + docs link | P1: developer trust |
| 24 | DX | Add `@register_agent` decorator API to ACP specification | P1: ergonomics |
| 25 | DX | Add `docker-compose.dev.yml` to Phase 1 infrastructure (local dev TTHW < 2 min) | P1: DX critical |

---

### TASTE DECISIONS (surface at final gate — user choice required)

**T1: Temporal deployment for Phase 1-2**
- Option A: Self-hosted Temporal on Oracle Free (current plan) — full control, no vendor, but adds ~4GB RAM pressure on constrained cluster
- Option B: Temporal Cloud free tier (10K executions/month) for Phase 1-2, self-host Phase 3+
- *Recommendation: B — defer ops burden until platform is validated. Migrate when you hit the limit.*

**T2: Phase 2 scoping**
- Option A: Phase 2 as written (ULI + Supervisor + 5 more agents, 8 weeks)
- Option B: Split into Phase 2A (ULI + Supervisor + 2 agents, 4 weeks) + Phase 2B (3 agents, 4 weeks)
- *Recommendation: B — reduces risk of partial completion. Each milestone is independently shippable.*

**T3: Agent response presentation**
- Option A: Single streaming response (full Explanation Agent output flows as one stream)
- Option B: Layered reveal (show Layer 0-1 first; learner clicks "go deeper" to expand to 2-3, etc.)
- Option C: Tabs per layer (Layer 0: Story | Layer 1: Visual | Layer 2: Formal)
- *Recommendation: B — layered reveal matches how understanding builds; prevents overwhelming new learners*

**T4: Knowledge graph visualization**
- Option A: D3.js force-directed graph (interactive, nodes glow as mastered)
- Option B: Radial/skill-tree view (game-like, shows progress visually)
- Option C: Text-only learning path for Phase 1 (defer visualization to Phase 2)
- *Recommendation: C for Phase 1 (ship faster), B for Phase 2 (most learnable UX)*

**T5: Qdrant learner data isolation**
- Option A: One collection per learner (hard isolation, high collection count at scale)
- Option B: Single collection with `learner_id` payload filter (soft isolation, simpler ops)
- *Recommendation: B for Phase 1-2 (simpler ops), evaluate A if hitting Qdrant collection limits at scale*

---

### USER CHALLENGES (both models agree user's stated direction may need revisiting)

**UC1: "Zero to mastery" vs "stuck to unstuck" framing**
- What you said: Platform takes anyone from zero knowledge to mastery in any domain
- What both models recommend: Narrow the product framing to "gets a motivated learner unstuck and moving forward on a specific goal within 48 hours"
- Why: "Mastery" is a decades-long process. A sharper framing tightens the product, improves retention, and makes success measurable. The architecture is identical either way.
- Context we may be missing: You may have philosophical/civilization-scale reasons for the mastery framing (the vision docs clearly do)
- Cost if we're wrong: Framing change doesn't break architecture — pure messaging/UX decision. Reversible.

**UC2: 32-week full build vs validate core premise in 4 weeks first**
- What you said: 4 phases, 32 weeks, full platform with 18 agents
- What both models recommend: Build a single-topic, manually-curated prerequisite graph, one agent, and get 5-10 real users on it in 4 weeks BEFORE the full 32-week build
- Why: 18 agents built before any user validation = maximum risk. A 4-week proof of concept (one topic, one agent, real users) validates the core DAG hypothesis cheaply.
- Context we may be missing: You may have already validated the premise externally, or the 32-week plan IS the POC
- Cost if we're wrong: If you start the full build and the DAG hypothesis is wrong, that's 32 weeks. If you do the 4-week POC first, it's 4 weeks to know, then 28 weeks of de-risked building.

**UC3: 18 specialized agents upfront vs 3-4 general agents first**
- What you said: 18 agents defined upfront with distinct roles
- What both models recommend: Start with 3-4 agents (Supervisor, ULI, Explanation, Practice), measure learning outcomes, add specialized agents based on data
- Why: Each agent boundary is a failure surface. 18 untested boundaries = compounding risk in production.
- Context we may be missing: Your domain expertise in the education space may make each agent boundary obviously necessary
- Cost if we're wrong: Agent specialization is refactorable. The ACP/orchestration architecture is identical either way.

---

### DECISIONS DEFERRED TO TODOS.md

- AR/VR immersive visualization (Phase 4+ territory, not blocking Phase 1-3)
- Custom OS / Conversational Programming Language (multi-year horizon)
- Multi-language support (Devanagari, Hindi) — defer Phase 2+ but plan typography from Phase 1
- Identical Agent digital twin full maturity (Phase 3+)
- Research publication pipeline for Stage 6 outputs (Phase 4+)

---

---

### FINAL DECISIONS (recorded 2026-05-28)

| Decision | Choice | Notes |
|----------|--------|-------|
| T1: Temporal Phase 1-2 | **Temporal Cloud free tier** | Migrate to self-hosted at Phase 3 |
| T2: Phase 2 scope | **Split: 2A + 2B** | 2A: ULI+Supervisor+2 agents (4w); 2B: 3 more agents (4w) |
| T3: Response presentation | **Layered reveal** | Layer 0-1 first, "go deeper" button to expand |
| T4: Knowledge graph UI | **Text-only Phase 1, skill tree Phase 2** | Ship faster, add visual in next phase |
| T5: Qdrant isolation | **Single collection + learner_id payload filter** | Simpler ops for Phase 1-3 |
| UC1: Framing | **Keep "zero to mastery"** | Civilization-scale vision is the point |
| UC2: Build order | **Keep 32-week plan** | Original direction maintained |
| UC3: Agent count | **Keep 18 agents upfront** | Domain expertise drives the specialization |

---

### PHASE 2 REVISED STRUCTURE (T2 decision applied)

**Phase 2A — Core Intelligence (Weeks 9-12)**
- [ ] Neo4j knowledge graph + schema
- [ ] Eternal Memory Graph (all 4 types)
- [ ] Mem0 cross-session persistence
- [ ] ULI recursive prerequisite expansion
- [ ] Zero-Knowledge Criterion detection
- [ ] Knowledge graph generation + learner state tracking
- [ ] Supervisor Agent (LangGraph director graph)
- [ ] Practice Mode Agent
- [ ] Auto Note Builder Agent

**Phase 2B — Learning Loop Completion (Weeks 13-16)**
- [ ] To-Do List Agent (DAG → linearized roadmap)
- [ ] Socratic Agent
- [ ] Revision Agent (Temporal Cloud workflows)
- [ ] DSP (Dynamic System Prompting)
- [ ] Persona configuration

---

### PHASE 1 ADDITIONS (from auto-approved changes)

**Phase 1 additions to the implementation checklist:**
- [ ] Alembic migrations setup (schema versioning from day 1)
- [ ] LangGraph PostgreSQL checkpointer schema initialization
- [ ] pgBouncer connection pooling (min=5, max=20)
- [ ] Event durability matrix (Redis vs NATS per event type)
- [ ] Per-agent JWT auth for ACP internal service calls
- [ ] Daily backup: pg_dump → MinIO → Backblaze B2 free tier
- [ ] API versioning scheme: /api/v1/ + Pydantic model versioning in packages/shared/
- [ ] PydanticAI output schemas for Phase 1 agents (ExplanationOutput, etc.)
- [ ] Redis key naming convention enforced across all components
- [ ] pytest test strategy: ≥80% coverage on ACP + memory packages, CI gate on GitHub Actions
- [ ] ULI algorithm test harness: 10-20 curated prerequisite chains for validation
- [ ] Latency SLA: first token visible <500ms, full explanation <8s
- [ ] `docker-compose.dev.yml`: all 6 services + API + frontend, TTHW <2 min
- [ ] ACP error response format: problem + cause + fix + docs link
- [ ] `@register_agent` decorator API in ACP spec
- [ ] ULI loading experience: "Mapping prerequisites for X... Found N concepts..." progress narration
- [ ] Primary navigation: 5 views — Learn / Progress / Notes / Practice / Profile
- [ ] Shadcn/ui + Tailwind as design system
- [ ] WCAG 2.1 AA accessibility requirements
- [ ] Cold-start learner archetypes: 5-10 predefined starting profiles for collective memory bootstrap
- [ ] Multi-provider LLM routing: Gemini 2.5 Pro/Flash (primary) + Claude Sonnet (reasoning fallback) + GPT-4o (secondary fallback)
- [ ] Temporal Cloud free tier setup (Phase 1-2 runtime)
- [ ] Early warning metrics: prerequisite graph depth distribution + concept accuracy sampling

*Review complete — /autoplan 2026-05-28.*
