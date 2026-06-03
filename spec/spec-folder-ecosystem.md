# The Inevitable - Spec Folder Ecosystem

**Purpose:** Define the living spec folder architecture that makes the platform reconstructable, evolvable, and coherent across future agents, developers, researchers, and implementation phases.

## Governance Status

This is the canonical folder-domain inventory for the spec system. It does not mean every folder already contains final implementation specs. It means every future implementation decision should know which domain owns its architecture, protocols, runtime semantics, observability, governance, and evolution notes.

The spec system is the single source of truth. If code, architecture, protocols, events, memory, orchestration, governance, or infrastructure changes, update the corresponding spec domain.

## Primary Foundation Files

The foundational architecture files are:

- `spec/advanced-agent-architecture.md`
- `spec/next-generation-cognitive-operating-system-blueprint.md`
- `spec/vision-application/The_Inevitable_Master_Vision.md`
- `spec/vision-application/PLAN.md`
- `spec/vision-application/referenceRepos.md`

These files are complementary. If one covers a concept that the other does not, treat it as additive. If a stronger design is discovered, update the relevant docs and this ecosystem map.

## Primary Product Specification

The canonical product specification is:

- `spec/product/Broader-feature-product.md` — the master PRD (product thesis, capability pillars, agent ecosystem, memory architecture, real-time orchestration, modes/personas, the Product → Architecture mapping)
- `spec/product/README.md` — product domain entry point
- `spec/product/features/` — sixteen feature specs (F01–F16) refining the capability pillars
- `spec/product/features/README.md` — shared feature-spec template & authoring conventions

The product spec is **product law subordinate to architecture law**. Where a product requirement appears to conflict with an architecture invariant (blueprint §25.4 ten non-negotiable laws), the architecture invariant wins; the requirement must be expressed *through* events, leases, memory mutations, and governed capabilities — never around them. See `spec/product/Broader-feature-product.md` §14 for the authoritative Product → Architecture mapping.

## Reference Repository Learning

The local reference repos are part of the architecture learning substrate:

| Reference | Use For |
|---|---|
| `MiroFish/` | Staged graph/profile/simulation/report pipelines and simulation-first product structure |
| `hermes-agent/` | Persistent agent loop, memory, tools, skills, gateway surfaces, scheduling, and runtime hardening |
| `OpenMAIC/` | Classroom generation, live orchestration, scene runtime, streaming, multimodal education flows |
| `paperclip/` | AI-native control plane, governance, issues, heartbeats, budgets, and execution semantics |
| `pi/` | Modular agent runtime primitives, evented harnesses, provider abstraction, skills, extensions |
| `spec/vision-application/` | Internal reference corpus for outcome vision, product philosophy, and implementation constraints |

`spec/vision-application/referenceRepos.md` currently documents five external repositories. If a sixth external reference repository is restored or added, update that file, `spec/reference-repos/README.md`, and the persistent agent instructions.

## Canonical Subfolder Inventory

| Folder | Purpose | Required Coverage |
|---|---|---|
| `spec/product/` | Product specification & feature catalog | Master PRD (`Broader-feature-product.md`), capability pillars, agent ecosystem, memory & orchestration overviews, modes/personas, Product → Architecture mapping, `features/` catalog (F01–F16) |
| `spec/philosophy/` | Core philosophical and civilizational intent | Cognitive OS philosophy, education thesis, AI-native OS principles, outcome vision |
| `spec/architecture/` | Whole-system architecture | Layering, boundaries, dependency map, control plane, data plane, architectural laws |
| `spec/kernel/` | Cognitive kernel internals | Syscalls, privilege rings, kernel/user cognition boundary, interrupts, admission, kernel recovery |
| `spec/cognition/` | General cognition primitives | Cognitive units, cognition packets, cognitive loops, cognition states, cognitive lifecycle |
| `spec/runtime/` | Runtime execution model | Agent pod runtime, reasoning runtime, model runtime, tool runtime, containers, hypervisor |
| `spec/orchestration/` | Distributed orchestration fabric | Directors, orchestration cells, blackboards, routing, consensus, disagreement handling |
| `spec/workflows/` | Durable long-running execution | Workflow contracts, checkpoints, retries, sagas, signals, cancellation, human review |
| `spec/memory/` | Memory architecture | Episodic, semantic, procedural, reflective, collective memory, consolidation, redaction |
| `spec/world-state/` | Unified world-state graph | Graph schema, world-state deltas, CRDTs, semantic conflict, materialized views |
| `spec/events/` | Event-sourced cognition | Event taxonomy, event schemas, retention, replay, dead letters, causal ordering |
| `spec/communication/` | Cognitive communication | Universal Cognitive Bus, semantic routing, packet delivery, realtime communication |
| `spec/protocols/` | Versioned cognitive protocols | Packet, event, memory mutation, context lease, intent lease, governance, ABI |
| `spec/execution/` | Execution semantics | Cognitive execution engine, execution DAGs, instruction lifecycle, queues, continuations |
| `spec/compiler/` | Cognitive compiler system | Intent lowering, Cognitive IR, optimization passes, runtime graph generation |
| `spec/scheduler/` | Cognitive scheduling | Priority, fairness, preemption, budgets, QoS, cost-aware and pedagogy-aware scheduling |
| `spec/governance/` | Adaptive governance | Policies, review, approvals, overrides, audit, governance memory, policy evolution |
| `spec/security/` | Security-native cognition | Zero trust, prompt injection defense, tenant isolation, secrets, attestation, consent |
| `spec/observability/` | Cognitive observability | Reasoning traces, claim graphs, drift, disagreement, confidence, learner outcomes |
| `spec/telemetry/` | Metrics and traces | OpenTelemetry conventions, Langfuse traces, metric names, alerting, dashboards |
| `spec/replay/` | Deterministic replay | Timeline replay, model-output recording, state freeze, forks, replay determinism levels |
| `spec/evolution/` | Self-evolving architecture | Evolution proposals, shadow testing, topology mutation, persona evolution, rollback |
| `spec/agents/` | Agent catalog and roles | Agent manifests, capabilities, agent boundaries, agent reliability, agent evolution |
| `spec/agent-runtime/` | Agent container execution | Lifecycle, hydration, checkpointing, context leases, tool grants, observability hooks |
| `spec/agent-communication/` | Agent-to-agent coordination | Blackboard protocol, semantic packet routing, consensus, disagreement and handoff |
| `spec/reasoning/` | Pluggable reasoning systems | CoT, ToT, graph reasoning, debate, reflection, symbolic, simulation, neuro-symbolic |
| `spec/pedagogy/` | Teaching strategy architecture | Seven-layer concept teaching, Socratic paths, explanation selection, depth verification |
| `spec/learning-science/` | Computational learning science | Misconception topology, cognitive load, mastery progression, forgetting curves |
| `spec/curriculum/` | Curriculum intelligence | ULI graphs, prerequisite sequencing, learning path evolution, research transition |
| `spec/simulations/` | Cognitive simulation | Synthetic learners, synthetic cohorts, policy labs, failure labs, curriculum simulations |
| `spec/benchmarking/` | Benchmark suites | ULI benchmarks, pedagogy benchmarks, memory quality, replay, governance, evolution safety |
| `spec/economics/` | Cognitive economics | Reasoning budgets, cost models, energy optimization, semantic caching, resource markets |
| `spec/topology/` | Runtime and architecture topology | Orchestration graph, regional topology, sharding, agent pools, topology mutations |
| `spec/infrastructure/` | Production infrastructure | Kubernetes/K3s, service mesh, event mesh, storage, model hosting, deployment topology |
| `spec/scaling/` | Large-scale operation | Scaling beyond 10,000 agents, sharding, warm pools, load shedding, multi-region scale |
| `spec/federation/` | Federated cognition | External agents, federated memory, regional nodes, trust negotiation, data sovereignty |
| `spec/interop/` | External interoperability | MCP, gRPC, external runtimes, model providers, capability negotiation, protocol bridges |
| `spec/deployment/` | Deployment strategy | Local, cloud, edge, offline, staging, production, rollbacks, environment promotion |
| `spec/resilience/` | Failure and recovery | Fault domains, circuit breakers, degradation modes, incident response, recovery workflows |
| `spec/storage/` | Storage systems | Postgres, graph DB, vector DB, object storage, event store, backups, retention |
| `spec/caching/` | Cache architecture | Semantic cache, retrieval cache, graph cache, invalidation, safety scope, cost reduction |
| `spec/debugging/` | Developer debugging | Cognitive debugger, trace inspection, replay studio, memory lineage, protocol explorer |
| `spec/experimentation/` | Controlled experimentation | A/B tests, shadow deployments, canaries, replay experiments, evaluation gates |
| `spec/testing/` | Test strategy | Unit, integration, contract, replay, simulation, synthetic learner, chaos testing |
| `spec/evaluation/` | Outcome evaluation | Learner outcomes, agent quality, reasoning quality, curriculum quality, safety metrics |
| `spec/tooling/` | Platform tooling | CLI, agent scaffolding, protocol validation, schema generation, local dev tools |
| `spec/developer-experience/` | Developer experience | Onboarding, docs, local setup, spec navigation, development workflows |
| `spec/diagrams/` | Architecture diagrams | Topology, flows, state machines, event streams, workflows, memory graphs |
| `spec/glossary/` | Shared language | Terms, primitives, abbreviations, domain vocabulary, cognitive OS definitions |
| `spec/architecture-decisions/` | ADRs | Decisions, tradeoffs, rejected options, research rationale, migration implications |
| `spec/migration-plans/` | Migration planning | Spec-to-code migrations, protocol migrations, datastore migrations, rollout plans |
| `spec/implementation-roadmaps/` | Build sequencing | Phases, milestones, dependency order, validation gates, production readiness |

## Additional First-Class Advanced Domains

These domains are mandatory because the COS architecture has crossed into kernel-grade, compiler-grade, epistemic, and distributed cognition territory. They must not remain buried inside broader folders.

| Folder | Purpose | Required Coverage |
|---|---|---|
| `spec/kernel-internals/` | Operational kernel decomposition | Cognitive syscalls, privilege rings, interrupts, threading, process model, panic recovery |
| `spec/cognitive-ir/` | Cognitive intermediate representation | IR schema, intent lowering, semantic plans, orchestration IR, execution IR, optimization passes |
| `spec/cognitive-isa/` | Primitive cognition instruction set | Reasoning, retrieval, memory, orchestration, governance, execution opcodes |
| `spec/query-engine/` | Cognition-native querying | Temporal queries, causal queries, reasoning-path queries, memory lineage, graph query abstractions |
| `spec/consensus/` | Distributed cognitive agreement | Quorum models, semantic consensus, distributed arbitration, Byzantine cognition, disagreement resolution |
| `spec/epistemology/` | Formal knowledge validity | Belief models, uncertainty, trust lineage, evidence theory, contradiction resolution, validity lifecycle |
| `spec/cognitive-filesystem/` | Cognition-native storage abstraction | Semantic storage, temporal snapshots, concept addressing, mounts, provenance storage |
| `spec/cognitive-networking/` | Layered cognition network stack | Transport, semantic routing, trust, replication, realtime streaming |
| `spec/transactions/` | Cognitive transaction architecture | Distributed cognition transactions, saga coordination, rollback, atomic memory mutations |
| `spec/cognitive-garbage-collection/` | Cleanup and compaction | Orphan detection, stale memory cleanup, graph compaction, fragmentation, semantic decay |
| `spec/control-plane/` | Cognitive control plane | Topology, registry, policy propagation, shard balancing, rollout/rollback |
| `spec/data-plane/` | Cognitive data plane | Runtime execution, event flow, memory operations, model/tool calls, streaming |
| `spec/cognitive-economics/` | Cognitive resource economics | Budgeting, compute markets, adaptive cost routing, reasoning-depth economics |
| `spec/cognitive-safety/` | Cognition-native safety | Recursive stabilization, hallucination containment, self-modification limits, loop protection |
| `spec/human-governance/` | Human governance integration | Approvals, interventions, escalation, override workflows, review UI flows |
| `spec/cognitive-developer-platform/` | Developer tooling for cognition | Cognition IDE, orchestration visualizer, replay studio, graph debugger, protocol explorer |
| `spec/synthetic-learners/` | Synthetic learner evaluation | Learner emulators, misconception simulation, pedagogy evaluation, curriculum testing |
| `spec/cognitive-benchmarks/` | Research-grade benchmarks | Orchestration, pedagogy, memory quality, long-horizon cognition, evolution safety |
| `spec/semantic-consistency/` | Semantic consistency model | Truth convergence, contradiction tolerance, uncertainty consistency, semantic conflict semantics |
| `spec/failure-semantics/` | Formal failure semantics | Corruption states, degraded modes, orchestration instability, semantic failure classes |
| `spec/research/` | Institutional research memory | Papers reviewed, inspirations, benchmark learnings, rejected designs, future directions |
| `spec/meta/` | Governance for the spec system | Spec lifecycle, retrieval optimization, dependency rules, traceability, review workflows |
| `spec/indexes/` | Retrieval and navigation layer | Domain, protocol, runtime, event, governance, memory, capability, and dependency indexes |
| `spec/reference-repos/` | Reference-repo learning layer | Local repo map, extracted practices, implementation pattern guidance |

## Required Depth for Each Domain Spec

Each domain spec should eventually define:

- Purpose.
- Philosophy.
- Architecture.
- Primitives.
- Runtime semantics.
- Lifecycle.
- Protocols.
- Contracts.
- Event flows.
- State transitions.
- Orchestration behavior.
- Observability.
- Scalability.
- Governance.
- Security.
- Resilience.
- Replayability.
- Failure semantics.
- Extensibility.
- Implementation guidance.
- Future evolution strategy.

## Required Spec Metadata

Every mature spec file should include a metadata block with:

- Domain owner.
- Status.
- Last reviewed date.
- Upstream dependencies.
- Downstream dependencies.
- Related protocols.
- Related events.
- Related runtime systems.
- Related governance systems.
- Related observability systems.
- Semantic tags.
- Canonical references.

This keeps the spec system retrieval-efficient for humans and AI agents.

## Spec-First Execution Doctrine

Implementation is subordinate to the spec system. If implementation changes architecture, runtime semantics, memory behavior, protocol behavior, orchestration flow, governance semantics, observability semantics, event contracts, or execution semantics:

1. Update or create the relevant spec first.
2. Validate architectural coherence.
3. Update indexes and dependency maps.
4. Implement.
5. Validate implementation against the spec.
6. Feed implementation lessons back into the spec.

Specs are not passive documentation. They are executable architectural law.

## Cross-Cutting Coverage Map

| Concern | Primary Folders |
|---|---|
| Cognitive kernel | `kernel/`, `kernel-internals/`, `execution/`, `scheduler/`, `protocols/` |
| Cognitive compiler | `compiler/`, `cognitive-ir/`, `cognitive-isa/`, `execution/` |
| Distributed consensus | `consensus/`, `orchestration/`, `semantic-consistency/`, `governance/` |
| Epistemic validity | `epistemology/`, `semantic-consistency/`, `research/`, `observability/` |
| Event-driven cognition | `events/`, `communication/`, `replay/`, `observability/` |
| Temporal cognition | `world-state/`, `events/`, `replay/`, `memory/` |
| Agent runtime | `agents/`, `agent-runtime/`, `reasoning/`, `runtime/` |
| Agent communication | `agent-communication/`, `communication/`, `orchestration/`, `protocols/` |
| Memory persistence | `memory/`, `world-state/`, `storage/`, `caching/` |
| Cognitive querying | `query-engine/`, `events/`, `world-state/`, `memory/`, `observability/` |
| Pedagogy and ULI | `pedagogy/`, `learning-science/`, `curriculum/`, `agents/` |
| Synthetic pedagogy testing | `synthetic-learners/`, `simulations/`, `cognitive-benchmarks/`, `learning-science/` |
| Self-evolution | `evolution/`, `experimentation/`, `benchmarking/`, `architecture-decisions/` |
| Production scale | `infrastructure/`, `control-plane/`, `data-plane/`, `scaling/`, `deployment/`, `resilience/` |
| Security and governance | `security/`, `governance/`, `human-governance/`, `cognitive-safety/`, `protocols/`, `observability/` |
| Failure and recovery | `failure-semantics/`, `resilience/`, `replay/`, `transactions/`, `observability/` |
| Developer operations | `tooling/`, `developer-experience/`, `cognitive-developer-platform/`, `debugging/`, `diagrams/` |
| Reference learning | `reference-repos/`, `research/`, `architecture-decisions/`, `implementation-roadmaps/` |

## Integrated Advanced-Layer Coverage

The following advanced layers are now first-class domains or cross-domain requirements:

- Formal cognitive kernel internals.
- Cognitive syscalls.
- Cognitive threading.
- Cognitive execution engine.
- Cognitive IR.
- Cognitive compiler.
- Cognitive ISA.
- Deterministic cognitive runtime.
- Cognitive memory hierarchy.
- Cognitive garbage collection.
- Cognitive transaction protocol.
- Distributed cognitive consensus.
- Semantic consistency model.
- Formal epistemology layer.
- Cognitive query engine.
- Cognitive simulation framework.
- Synthetic learner architecture.
- Cognitive learning science layer.
- Cognitive economics and energy optimization.
- Semantic caching.
- Cognitive networking stack.
- Cognitive filesystem.
- Cognitive hypervisor.
- Recursive cognition stabilization.
- Formal failure semantics.
- Cognitive benchmarking infrastructure.
- Cognitive developer platform.
- Spec lifecycle governance.
- Retrieval-oriented spec architecture.
- Implementation traceability.
- Research integration workflow.
- Architecture review protocol.
