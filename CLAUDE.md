# The Inevitable — Repository Constitution

This file is the **persistent cognitive orientation** of every agent and engineer entering this
repository: who we are, what we are building, what must never be compromised, how to think, where
truth lives, and how to know whether something is *actually implemented*.

It teaches how to reason about the repository; it does **not** contain the repository. Not a
specification, roadmap, feature catalog, status document, or manifesto. Auto-loaded into every
session, so every line costs context in every conversation. Governed by §8.

## 1. Identity

A long-term research and engineering initiative with **two distinct, parallel pursuits** — neither
subordinate to the other:

```
                        THE INEVITABLE
        ┌─────────────────────┴─────────────────────┐
   PRODUCT ─ Universal Cognitive        RESEARCH ─ cognition · intelligence
             Infrastructure (UCI)                  learning · reasoning · memory
             the production platform               multimodal · continual learning
        └──────────────► validated research ◄──────  autonomous research · discovery
                    graduates into UCI capability
```

**Universal Cognitive Infrastructure (UCI)** is the production platform built here: infrastructure
through which persistent, contextual, multimodal, agentic cognitive capabilities are composed,
governed, observed, persisted, retrieved, and projected into human and machine experiences.
**Education is UCI's first application domain and proving ground — not its definition, not its
boundary.**

Terms, used precisely and never interchangeably:

| Term | Is | Is not |
|---|---|---|
| **UCI** | The product/platform | Education-specific |
| **Cognitive Operating System (COS)** | UCI's internal architecture style — kernel, contracts, events, world-state, governance | The product, or a user-facing concept |
| **Universal Learning Intelligence (ULI)** | The education-domain capability built *on* UCI | The platform definition |
| **Cognitive Surface** | UCI's primary projection and interaction environment | The cognitive substrate |
| **Research** | Scientific investigation that may *become* UCI capability | The production codebase |

**Direction.** *Near:* build foundational cognitive infrastructure through education. *Medium:*
generalize memory, retrieval, reasoning, context, knowledge, multimodal interaction, and agentic
capability beyond it. *Long:* systems that continuously learn, understand, research, discover, and
create across domains. *Research horizon:* investigate the computational foundations of cognition
and graduate what validates.

Evaluate every decision against one question: **does this make UCI able to do something
meaningfully intelligent it could not do before — durably, observably, and verifiably?**

## 2. The Truth Model

The most important law in this file, because the repository has previously violated it:

> **Implementation evidence outranks documentation claims.**
> Documentation expresses intent. Code expresses implementation. Tests express verified behaviour.
> Runtime evidence expresses operational reality. **No document is evidence that a capability
> exists** — not a specification, not an ADR, not this file.

Every capability carries exactly one of seven statuses. They must never be conflated:

| Status | Means | Minimum evidence |
|---|---|---|
| **VISION** | We aspire to it | A vision document |
| **RESEARCH** | Under scientific investigation | A research document with an adoption gate |
| **SPECIFICATION** | Formally designed | A spec and/or an ADR |
| **PROTOTYPE** | Demonstrated experimentally | Code that runs, on no product path |
| **PARTIAL** | A meaningful portion exists | Code + tests + a written, named gap |
| **PRODUCTION** | Works end-to-end in the product | The full path: interface → API → runtime → cognition → persistence → retrieval → response → surface |
| **PRODUCTION VERIFIED** | Reliable | Production + observability + durability + recovery + runtime evidence |

`VISION ≠ RESEARCH ≠ SPECIFICATION ≠ PROTOTYPE ≠ IMPLEMENTATION ≠ PRODUCTION`.

**An accepted decision is not an implemented decision.** Acceptance and implementation are separate
axes; an ADR carries both. **Status may be asserted in exactly one place** — the capability's own
record, and only with evidence. A status claim anywhere else is a constitutional violation.

## 3. Architectural Laws

Sacred, and each stated so that a **violation is detectable**. The detailed, numbered invariants
live at `spec/architecture/uci-architecture.md` §3; this is their operative summary.

**Cognition**

- **Intelligence is modular, composable, and observable** — cognition emerges from composable units;
  every cognitive decision emits a reasoning trace.
- **Cognitive state persists where its future value warrants it.** A capability that cannot survive
  a process restart is not implemented.
- **Retrieval is half of memory.** Storage without indexed, ranked, cross-session retrieval is not
  memory; a tier with no retrieval path is incomplete.
- **Cognitive state is temporally reconstructable and attributable** — what happened, why, caused by
  what. *(Event sourcing and replay are the current mechanism, not the law itself.)*
- **No subsystem becomes an isolated or contradictory source of cognitive truth.**
- **Governance is intrinsic to cognition**, evaluated before the side effect — never bolted on after.
- **No fake cognition.** Generated language is not by itself evidence of cognition; a capability must
  be grounded in state, context, evidence, structure, persistence, or measurable behaviour.

**Boundaries**

- **Agents are cognitive runtime containers, not prompts** — manifest, identity, capability
  envelope, observability contract, or it is not an agent.
- **Every semantic exchange is typed** — cognition packets never bare strings; every memory write a
  typed mutation; context and intent reached only through bounded, revocable leases.
- **Models and vendors are replaceable.** Nothing leaks past its adapter; UCI never becomes one
  provider's infrastructure.
- **Interfaces are projections.** Surface, voice, CLI, API, future devices project cognitive state;
  they never define the substrate.
- **Dependencies point inward.** Manifestations → substrate → contracts → nothing.

**Engineering**

- **One concept, one authority.** Every stable concept has one owning source; others reference or
  constrain it, none redefine it. When two sources claim the same truth, establish the owner and
  subordinate the rest — never declare them "complementary".
- **Historical decisions must not masquerade as current architecture** — superseded thinking is
  preserved and *labelled*.
- **No speculative architecture; complexity must earn its place.** Build because a capability,
  validated research, or an explicit requirement demands it — never to satisfy a diagram.
  Sophistication is justified only by capability, reliability, research value, or leverage.
- **Build vertical slices before abstractions** — prove end-to-end, observe the pattern, *then*
  extract the primitive.
- **Research must not silently become production architecture.** It earns its place through
  evidence, engineering viability, and product relevance — via an ADR, the only door.
- **Autonomous change is governed** — proposed, evaluated, reproducible, auditable, reversible.

Code that violates these laws is invalid implementation even if it works locally.

## 4. Where Truth Lives

Pointers only, never copies. When a domain changes, update the owning file — not this map.

| Layer | Where | Owns |
|---|---|---|
| **Truth of what exists** | `docs/audits/` (latest), then the code and its tests | The honest status of every capability |
| **Vision** | `spec/vision-application/` | Purpose. *Education-era corpus — read as intent, never cited to settle current scope* |
| **Product** | `spec/product/` — PRD + `product-cognition-runtime.md` + `features/F01–F16` | What UCI is and does |
| **Architecture** | `spec/architecture/uci-architecture.md` — **the single architecture document**; `Tech-Stack.md`, `Cognitive-Architecture.md` alongside | How UCI is built. Parts I–II are law; Parts III–IV are not |
| **Contracts** | `spec/protocols/`, `spec/events/`, `spec/kernel/` | The stable seam — protocols, events, schemas, ABIs |
| **Experience** | `spec/surface/` (runtime), `spec/design/` (CDL — use the highest version) | The Cognitive Surface and interaction |
| **Runtime specs** | `spec/source-environment/` (CSE), `spec/persistence/` (DPS), `spec/implementation-roadmaps/` | Executable subsystem contracts |
| **Decisions** | `spec/architecture-decisions/` | History and rationale. Accepted ≠ implemented |
| **Research** | `spec/research/` | Scientific agenda. **Never production law** |
| **Reference** | `spec/reference-repos/` | External analysis and inspiration. **Not law** |
| **Status** | `IMPLEMENTATION.md` · `CHANGELOG.md` · `docs/history/` | Current state, milestones, narratives |
| **Retrieval** | `spec/indexes/` | Finding anything as the system grows |

Where a product requirement and an architectural law conflict, the **law wins**; express the
requirement *through* it — events, leases, mutations, governed capabilities — never around it.

## 5. Working Doctrine

**Specification exists to make implementation clearer, safer, and more coherent — never to
substitute for it.** When a specification grows more elaborate than the evidence supporting its
implementation, stop writing and build.

Ceremony scales with the decision:

- **Major / architectural / irreversible** — a new agent or event family, a contract or
  dependency-direction change, a new capability domain, a cross-cutting invariant, adopting
  research. Update or create the owning spec *first*, then implement, then validate against it.
  One **terse ADR**: 2–4 sentences of context, the decision, the rejected alternatives.
- **Everything else** — additive fields, wiring, renderers, a unit following an existing pattern,
  fixes, tests, sub-phases of an adopted ADR. **Implement directly** — no new ADR, no new spec file.
  Touch an owning spec only when you change a contract others depend on. The code and its tests are
  the record.

**Before implementing,** read the owning specs, identify the cognitive primitives, and check whether
the change touches contracts, events, memory mutations, world-state, policies, or manifests.

**Production-grade** — the bar every cognitive capability is measured against, where applicable:
clear ownership · typed contracts · persistence · retrieval · observability · failure handling ·
degradation · recovery · governance · tests · determinism where required · provenance · versioning ·
end-to-end evidence.

**Documentation cadence.** `IMPLEMENTATION.md`, `CHANGELOG.md`, and `docs/history/` are written
**only when a major milestone lands** — never per sub-step. Fine-grained continuity lives in agent
memory, not these files.

## 6. Anti-Patterns

Never build merely because a model can do it, it sounds futuristic, a diagram suggests it, a
competitor has it, or it would make the repository look sophisticated. Never: assert a capability
exists on the strength of a specification · record status outside a capability record · create a new
document where an existing one should be improved, merged, or deprecated · resolve conflicting
sources with a "these are complementary" clause instead of a merge · cite research as law or
reference material as architecture · bypass contracts, governance, or observability for convenience ·
write state outside a typed mutation · rest durable cognitive state on ephemeral storage · reverse
the dependency direction or leak a vendor past its adapter.

**Never let the sophistication of the specification system substitute for the sophistication of the
actual product.**

## 7. Resolving Ambiguity

Identify what the question concerns — vision, research, product, architecture, contract, capability,
implementation, or status — then consult that owning source (§4). For **what exists**, the code and
its tests outrank every document. When sources disagree, the more specific and more recent owner
wins; if the constitution itself is outdated, fix it rather than working around it. If a requirement
repeatedly needs exceptions to these laws, revisit the laws instead of accumulating exceptions.

## 8. Build, Verify, and Constitution Governance

```bash
pnpm install && pnpm verify   # codegen + typecheck + test + lint + format:check — must stay green
```

Monorepo: pnpm + Turborepo, strict TypeScript ESM, Vitest (ADR-0004; details in `IMPLEMENTATION.md`).
Windows: if turbo cannot find pnpm, `npm i -g pnpm@9.15.0`.

**This section makes drift difficult. Future agents must obey it when editing this file.**

**May be added:** identity framing, architectural laws, the truth model, working doctrine, governance
rules, and retrieval *pointers*. That is the complete list.

**Must never be added:** changelog entries, milestone summaries, phase details, implementation
inventories, package catalogs, component descriptions, code identifiers, test counts, feature lists,
roadmap history, dated narratives, or **any capability status**. If it describes *what was built*
rather than *how to think and where to look*, it does not belong here.

| Information | Home |
|---|---|
| What shipped (abstract, milestone-level) | `CHANGELOG.md` |
| Current state, traceability, active frontier | `IMPLEMENTATION.md` (replace, don't append) |
| Dated build narratives | `docs/history/implementation-log.md` (append) |
| Capability status and evidence | The capability's own record |
| Architecture / runtime / product semantics | The owning spec under `spec/` |

**Size law:** this file stays under **~230 lines**. If an edit would push past the cap, compress or
relocate — never append. When a milestone lands, CLAUDE.md is **not** touched.
