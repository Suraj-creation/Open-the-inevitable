# The Inevitable — Specification & Implementation Truth Audit

**Date:** 2026-08-16
**Scope:** the entire `spec/` system, the root governance documents, and the executable code in
`packages/`, `apps/`, `services/`, `supabase/`.
**Method:** every claim below is traced to a file, a line, a table, a migration, or a count.
No claim is inferred from a filename, a comment, an interface, or a specification's own assertion.
**Status:** analysis only. No code, schema, or spec was modified in producing this report.

---

## A. Executive Diagnosis

The repository is not suffering from too little architecture. It is suffering from **four structural
defects that make its architecture unfalsifiable**.

### A.1 Altitude collapse — everything claims the same authority

Nine documents in this repo describe themselves as canonical, foundational, or source-of-truth.
They sit at five different altitudes (civilizational vision, research, architecture, product,
status) but they all use the same authority vocabulary. Because every layer says "canonical," no
layer actually *is*, and a reader — human or agent — has no rule for deciding which document wins.

The clearest symptom: `spec/advanced-agent-architecture.md` (3,652 lines, "v3.0") and
`spec/next-generation-cognitive-operating-system-blueprint.md` (2,839 lines, "v4.0") carry
essentially the same 26-section table of contents. Both open with a "Document Status and
Complementarity" clause instructing the reader to treat differences as *additive context* rather
than contradiction. **That clause is not a resolution — it is a truce written in place of a merge.**
The repository already knew these documents overlapped and chose to legislate the conflict away
instead of consolidating it.

### A.2 No truth model — status carries zero information

- **63 ADRs. Every one is `Accepted`. Zero are `Superseded`. Zero are `Deprecated`.**
  Sixty-three consecutive architectural decisions without a single revision is not a sign of
  foresight; it is a sign that decisions were accumulated rather than revisited.
- **16 feature specs (F01–F16). Every one is `status: draft`** — including features whose code has
  been shipped, deployed, and live-verified (F16 cognitive surface, F15 ingestion), *and* features
  with no runtime path at all (F11 institutional, F12 collective evolution). Draft means nothing
  when it means everything.
- `spec/README.md` states "Phase 1E **now begins**." `IMPLEMENTATION.md` states phases 1A–1E, 2A–2E,
  P2–P7.1, S1–S4, and the S-UCS redesign are **complete**. Both are checked in. Both are current.

There is no vocabulary in this repository for distinguishing *designed* from *built* from *working*.
Consequently the specification system reads as a maturity claim it has not earned.

### A.3 Persistence inversion — the deepest law rests on the shallowest floor

The architectural laws in `CLAUDE.md` §2 promise event sourcing, replay, persistent memory, and
world-state as the unified substrate. The actual durable floor under all of it is:

| Cognitive asset | Where it actually lives | Survives redeploy? |
|---|---|---|
| Learner identity + API key | `<COS_PERSIST_DIR>/learners/<id>.json` ([learners.ts:207-211](apps/api/src/learners.ts#L207-L211)) | **No** |
| Cross-surface learner cognition (mastery + memory) | `<id>.cognition.json` ([learners.ts:201-204](apps/api/src/learners.ts#L201-L204)) | **No** |
| Source catalog, consents, creations, commons | `sources/catalog.json` ([source-persistence.ts:78-82](apps/api/src/source-persistence.ts#L78-L82)) | **No** |
| Surface event log, world-state, memory | per-surface JSONL + `world.json` + `memory.json` | **No** |
| Semantic retrieval index | `new InMemoryVectorStore()` per session ([wiring.ts:936-938](apps/cli/src/wiring.ts#L936-L938)) | **No** — rebuilt per session |

`render.yaml` sets `COS_PERSIST_DIR=/tmp/cos-data` on a free-tier instance whose own comment reads:
*"Free tier has an EPHEMERAL disk — /tmp persists only within an instance's life (learner memory
resets on redeploy/idle-spindown)."*

**This has already caused a production failure.** Returning visitors were rejected with 401 because
the registry holding their minted `api_key` was wiped — the incident behind commit `ba6edbe`.
That is not a hypothetical risk; it is runtime evidence that the persistence claim is false.

### A.4 The product has outgrown its own governing documents

`Cognitive-Source-Environment-Specification.md` (root, v1.0) is titled **"Universal Cognitive
Infrastructure."** `spec/research/persistent-cognitive-intelligence/` builds its entire thesis on
UCI. `spec/design/cognitive-design-language-v2.md` and the investor materials
(`Final-Annexures.md`) use UCI. Meanwhile `CLAUDE.md`, the blueprint, the master PRD, and
`spec/spec-folder-ecosystem.md` — the documents auto-loaded into every agent session — still define
the platform as a *Cognitive Operating System for education* whose ultimate form is a *Universal
Learning Intelligence*.

The correct identity already exists in the repository. It has simply never been propagated upward
into the governing layer.

---

## B. The Actual Identity of The Inevitable

The audit confirms your framing and finds textual support for it already in-repo. The distinction
that must now become law:

```
THE INEVITABLE                      the initiative (company / long-horizon program)
│
├── PRODUCT ── Universal Cognitive Infrastructure (UCI)
│   │          the platform. Persistent cognition, memory, reasoning, knowledge
│   │          representation, multimodal understanding, agentic systems,
│   │          human-AI interaction, world-state, cognitive interfaces.
│   │
│   └── DOMAINS (applications of UCI)
│       ├── Education ── Universal Learning Intelligence (ULI)  ← first domain, not the platform
│       ├── Research & discovery
│       ├── Creation & authoring
│       └── (future domains)
│
└── RESEARCH ── the scientific agenda
    Persistent Cognitive Intelligence, belief-state modeling, continual learning,
    autonomous research, cognitive architectures, multimodal cognition.
    Feeds UCI through: understanding → prototype → validation → engineering → capability.
```

**Precise definitions, to be used consistently from here on:**

| Term | What it is | What it is **not** |
|---|---|---|
| **The Inevitable** | The initiative: product + research together | Not a product name |
| **Universal Cognitive Infrastructure (UCI)** | The product/platform. The thing users and institutions adopt | Not education-specific |
| **Cognitive Operating System (COS)** | The *internal architecture style* of UCI: kernel, protocols, events, world-state, governance | Not the product; not a user-facing concept |
| **Universal Learning Intelligence (ULI)** | The education-domain intelligence capability built on UCI | Not the platform definition |
| **UALRCI** | An education-domain acceleration/creation capability (Stage 4–6) | Not an architecture layer |
| **Cognitive Surface** | The primary interaction manifestation — a projection of UCI's world-state | Not the substrate |
| **Research** | Scientific investigation that may become UCI capability | Not the production codebase |

**Corollary:** "COS" should be demoted from *identity* to *architecture style*. UCI is what we
build; COS is how it is built. The current `CLAUDE.md` §1 conflates the two in its opening sentence.

---

## C. Specification Inventory

Scale: **222 markdown files, 50,886 lines of specification** across **83 `spec/` subdirectories, of
which 50 contain zero files**. Non-test source code: **56,434 lines**. Spec-to-code is roughly 1:1
by line count — the problem is not volume, it is that half the declared domains are empty and the
populated ones disagree with each other.

### C.1 Governing / foundational tier

| Document | Lines | Purpose | Layer | Real authority | Current? | Code evidence |
|---|---:|---|---|---|---|---|
| `CLAUDE.md` | 211 | Constitution, auto-loaded | Operational | **High (enforced)** | Partially stale | n/a |
| `spec/advanced-agent-architecture.md` | 3,652 | "Complete Architectural Spec v3.0" | Architecture | Claimed high | **No** — untouched since 2026-06-04 | ~15% realized |
| `spec/next-generation-cognitive-operating-system-blueprint.md` | 2,839 | "Blueprint v4.0" | Architecture | Claimed high (§25.4 = the ten laws) | **No** — untouched since 2026-06-04 | §25.4 realized; rest largely not |
| `spec/agents-orchestration-deep-dive.md` | 807 | Analysis of OpenMAIC / OpenClaw / NVIDIA NemoClaw | **Reference** | **Miscategorized** | Stale | Zero — describes other people's code |
| `spec/spec-folder-ecosystem.md` | 255 | Domain map | Meta | Medium | Stale (names empty domains) | n/a |
| `spec/product/Broader-feature-product.md` | 928 | Master PRD | Product | Claimed high | **No** — untouched since 2026-06-04 | Partial |
| `spec/product/product-cognition-runtime.md` | 387 | PCR-001 runtime contract | Implementation | **High — tracks code** | Yes (through Phase 2D) | Direct: `packages/product-cognition` |
| `spec/product/features/F01–F16` | ~3,240 | Feature specs | Capability | Low (all `draft`) | Mixed | Highly variable — see §K |
| `spec/architecture/Tech-Stack.md` + `Cognitive-Architecture.md` | 921 | Technology + cognitive layering | Architecture | Medium | Partially superseded by ADR-0034 | Partial |

### C.2 Vision tier — `spec/vision-application/` (7 files, 6,548 lines)

`Vision.md` (114 KB), `The_Inevitable_Vision_Comprehensive.md` (88 KB),
`Universal-Learning-Intelligence-Agent.md` (73 KB), `The_Inevitable_Master_Vision.md` (53 KB),
`PLAN.md` (53 KB), `referenceRepos.md`, `Ambition-deep-committments.md`.
All committed 2026-06-04, never revised. This is the **education-era vision corpus**: it defines the
platform as ULI. It is historically valuable and currently mis-cited as "upstream source of truth
whenever intent is ambiguous" (`CLAUDE.md` §3) — which is precisely how ULI keeps re-asserting
itself as the platform definition.

### C.3 Research tier

- `spec/research/persistent-cognitive-intelligence/` (8 files) — **the current research frontier.**
  Correctly self-labels: *"Research proposal… **Not adopted law.**"* and gates adoption on a future
  ADR plus calibration. This is the only document in the repository that models its own epistemic
  status correctly. **It should be the template.**
- `spec/research/` (7 further files) — CSE drafts, production-readiness audit, TTFF analysis, UCS
  implementation review, frontier research, reference-repo patterns.
- `spec/cognitive_surface/` (10 files, 5,927 lines) — a **redundancy cluster**, see §D.

### C.4 Domain tier — implemented and real

`spec/kernel/` (8), `spec/protocols/` (6), `spec/source-environment/` (19, 3,475 lines),
`spec/surface/` (6, SRF-001…006), `spec/persistence/` (6, DPS-001…005), `spec/design/` (v1/v2/v3 +
proposals), `spec/indexes/` (11), `spec/meta/` (10), `spec/architecture-decisions/` (63 ADRs).

These are the *healthy* part of the spec system: narrow, owned, code-tracking.

### C.5 Root-level orphans — governed by nothing

| File | Lines | What it is |
|---|---:|---|
| `Cognitive-Source-Environment-Specification.md` | 829 | **A full UCI architecture + UI/UX spec.** Titled "Universal Cognitive Infrastructure." Not referenced by `CLAUDE.md`, not in `spec/`, not in any index. |
| `The-inevitable.md` | 473 | Investor problem statement / narrative |
| `Final-Annexures.md` | 261 | Investor annexures |
| `AGENTS.md` / `CODEX.md` | 433 | Parallel agent constitutions (Codex/other agents) |
| `DEPLOY.md` | 55 | Deployment runbook |

The most identity-correct architecture document in the repository (`Cognitive-Source-Environment-Specification.md`)
is an ungoverned root-level file.

---

## D. Redundancy Map

### D.1 The architecture duplication — 6,491 lines saying the same thing

| `advanced-agent-architecture.md` (v3.0) | `next-generation-…-blueprint.md` (v4.0) |
|---|---|
| 1. Architectural Philosophy | 1. Deep Architectural Philosophy |
| 2. Missing Foundational Primitives | 2. Missing Foundational Primitives |
| 3. Cognitive Runtime Architecture | 4. Cognitive Runtime Architecture |
| 4. Cognitive Event Mesh | 5. Event-Driven Cognition Systems |
| 5. Universal Cognitive Bus | 6. Universal Cognitive Bus Design |
| 6. Distributed Orchestration | 7. Distributed Orchestration Architecture |
| 7. Temporal Cognition Engine | 8. Temporal Cognition Architecture |
| 8. Unified World-State Graph | 9. Unified World-State Graph |
| 9. Cognitive Observability | 10. Cognitive Observability Framework |
| 10. Adaptive Governance | 11. Adaptive Governance Systems |
| 11. Self-Evolving Architecture | 12. Self-Evolving Architecture Design |
| 12. Distributed Memory Protocols | 13. Distributed Memory Protocols |
| 13. Cross-Agent Intelligence | 14. Cross-Agent Intelligence Evolution |
| 14. Durable Workflow Systems | 15. Durable Workflow Systems |
| 15. Runtime Virtualization | 16. Runtime Virtualization for Cognition |
| 16. Protocol-First Architecture | 17. Protocol-First Architecture |
| 17. Interoperability Standards | 18. Cognitive Interoperability Standards |
| 18. Multi-Region Cognition | 19. Multi-Region Distributed Cognition |
| 19. Production-Grade Resilience | 20. Production-Grade Resilience |
| 20. Security-Native Cognition | 21. Security-Native Cognition Systems |
| 21. Beyond 10,000 Agents | 22. Future Scalability Beyond 10,000 Agents |
| 22. AI-Native OS Philosophy | 23. AI-Native Operating System Philosophy |
| 23. Infrastructure Abstractions | 24. Infrastructure Abstractions |
| 24. Complete Next-Generation Blueprint | 25. Complete Next-Generation Systems Blueprint |
| 26. Research Extension Backlog | 26. Research-Grade Missing Layers Integrated |

**Twenty-four of twenty-six sections are the same section.** This is one document that was rewritten
and then both copies were kept. **Recommendation: merge into one.**

### D.2 `spec/agents-orchestration-deep-dive.md` is not architecture at all

It is a 807-line engineering analysis of **three external products** — OpenMAIC (Tsinghua),
OpenClaw, and NVIDIA NemoClaw. Its code samples are *their* code (`lib/orchestration/director-graph.ts`,
`src/agents/subagent-registry.ts`, `nemoclaw-blueprint/blueprint.yaml`). It contains no invariant
this system is bound by. `CLAUDE.md` §3 lists it under **"Architecture law — read before
architecture, runtime, protocol, memory, orchestration, agent, or infrastructure work."**

This is a category error, and it costs context in every session. It belongs in `10-reference/`.

### D.3 The cognitive-surface research cluster — 5,927 lines, ~5 duplicate pairs

| File A | File B | Shared title |
|---|---|---|
| `The Cognitive Whiteboard System  A New Paradigm for Human Understanding.md` (565) | `cognitive-whiteboard-system.md` (783) | "The Cognitive Whiteboard System: A New Paradigm for Human Understanding" |
| `Universal_Cognitive_Surface_Deep_Research.md` (689) | `universal_cognitive_surface_research.md` (635) | "THE UNIVERSAL COGNITIVE SURFACE — Deep Frontier Research" |
| `The Cognitive Surface  Decision-Grade Dossier … (1).md` (843) | `cognitive_surface_dossier.md` (548) | "The Cognitive Surface: Decision-Grade Dossier" |
| `cognitive_environment_research.md` (503) | `cognitive_medium_deep_frontier_research.md` (411) | same subject, different framing |

The `(1)` suffix is a literal download-duplicate filename that was committed. This directory needs
one synthesis document plus an archive.

### D.4 Other overlaps

- **Design language v1 / v2 / v3** all live in `spec/design/`. `CLAUDE.md` cites **v1** as "the
  permanent design system." v3 is newest (2026-07-10). Superseded documents are not marked.
- **`spec/product/Broader-feature-product.md` §14** duplicates the Product → Architecture mapping
  that `spec/indexes/product-feature-index.md` also carries.
- **Status is written in four places** — `IMPLEMENTATION.md`, `CHANGELOG.md`,
  `docs/history/implementation-log.md`, and `spec/README.md` — and they disagree (§E.4).

---

## E. Contradiction Map

### CONFLICT 1 — What is the product?

- **Document A:** `CLAUDE.md` §1 — *"a long-term, spec-driven effort to build a **Cognitive Operating
  System (COS)** for education and human understanding… What it is ultimately becoming: a **Universal
  Learning Intelligence**."*
- **Document B:** `Cognitive-Source-Environment-Specification.md` (root) — *"**Universal Cognitive
  Infrastructure** (UCI)"*; `spec/research/persistent-cognitive-intelligence/README.md` — UCI
  throughout; `Final-Annexures.md` — *"World's First Universal Cognitive Infrastructure."*

**Why they conflict:** A defines the platform as education-scoped and names ULI as the terminal form.
B defines the platform as domain-general infrastructure with education as one application. These
produce different scoping decisions for every capability.

**Which reflects newer understanding:** B. A dates to 2026-05/06; B to 2026-07/08 and the current
investor positioning.

**Recommended resolution:** Adopt UCI as the product identity. ULI becomes the education-domain
capability. COS becomes the internal architecture style, not the identity.

**Documents requiring modification:** `CLAUDE.md` §1/§2, `spec/README.md`, `spec/spec-folder-ecosystem.md`,
`spec/product/Broader-feature-product.md` (title, §0, §1, §5), `spec/indexes/product-feature-index.md`,
`AGENTS.md`, `CODEX.md`.
**Code requiring modification:** none. Terminology does not appear in package names or contracts.

---

### CONFLICT 2 — Two "complete" architectures

- **Document A:** `spec/advanced-agent-architecture.md` — "Complete Architectural Specification v3.0."
- **Document B:** `spec/next-generation-cognitive-operating-system-blueprint.md` — "v4.0 … Foundational
  redesign."

**Why they conflict:** B calls itself a *redesign* of A's foundation while A calls itself *complete*.
Both then insert a clause instructing readers to treat differences as additive rather than
contradictory — which suspends the reader's ability to detect real conflict. 24 of 26 sections
overlap (§D.1).

**Which reflects newer understanding:** B (v4.0, protocol/kernel-first; §25.4 is the only part of
either document actually enforced in code and cited by `CLAUDE.md`).

**Recommended resolution:** Merge into a single **UCI Architecture** document. Keep B's protocol-first
kernel framing and §25.4 invariants as the spine; graft A's implementation-oriented depth (agent
pods, event mesh, runtime virtualization) as subordinate sections; archive both originals with a
`superseded-by` header.

**Documents requiring modification:** both; plus every `canonical_references` frontmatter block that
cites `next-generation-cognitive-operating-system-blueprint#25.4` (the anchor must survive the merge).
**Code requiring modification:** none.

---

### CONFLICT 3 — Persistence: specified vs. implemented

- **Document A:** `ADR-0034` (Accepted, 2026-07-10) — mandates Postgres-backed `RelationalStore`,
  `PgVectorStore`, `PostgresEventTransport` as *the source of truth*, a **Postgres-backed learner
  registry**, and a **Postgres-backed GraphStore** for world-state.
- **Document B:** the code.

**Why they conflict:** ADR-0034 is marked Accepted with no implementation-status qualifier, but:

| ADR-0034 mandate | Reality |
|---|---|
| `PgVectorStore` replaces `InMemoryVectorStore` | `PgVectorStore` is **never instantiated outside tests**. Production runs `new InMemoryVectorStore()` ([wiring.ts:937](apps/cli/src/wiring.ts#L937)) |
| Postgres-backed learner registry | **Not done.** `LearnerRegistry` writes JSON files. The `learners` table exists in `0001_core_substrate.sql` and is referenced by **zero** TypeScript files |
| Postgres-backed GraphStore | **Not done.** `world_state_nodes` referenced by 1 file; `world_state_edges` and `world_state_deltas` by **zero** |
| "The event table is the source of truth" | The `events` table is referenced by **zero** TypeScript files. `transport_events` is used only as an *intelligence mirror* ([intelligence.ts:51](apps/api/src/intelligence.ts#L51)); the primary transport is still `FileEventTransport` |
| `memory_mutations` durable | Referenced by **zero** files. Memory is `Map`-based ([tiered-store.ts](packages/memory/src/tiered-store.ts)) |

Of 16 tables across 3 migrations, **9 are referenced by no code at all**: `events`,
`world_state_deltas`, `world_state_edges`, `memory_mutations`, `media_objects`, `source_versions`,
`layer_artifacts`, `anchor_migrations`, `consent_envelopes`.

**Which reflects newer understanding:** A (the intent is right and still correct). B is simply
unfinished — and nothing in the repository records that.

**Recommended resolution:** ADR-0034 gets an explicit implementation-status block. The gap becomes a
tracked capability record, not silence.

**Documents requiring modification:** `ADR-0034`, `IMPLEMENTATION.md`, `spec/persistence/`.
**Code requiring modification:** `apps/api/src/learners.ts`, `apps/api/src/host.ts`,
`apps/api/src/source-persistence.ts`, `apps/cli/src/wiring.ts`, `packages/memory/`,
`packages/world-state/`.

---

### CONFLICT 4 — Phase status

- **Document A:** `spec/README.md` — *"The project is transitioning from completed Phase 1D substrate
  deepening into Phase 1E product cognition implementation… **Phase 1E now begins**."*
- **Document B:** `IMPLEMENTATION.md` — *"Phases 1A–1E, 2A–2D, the 2E durable-substrate milestone,
  all of P2…P7.1, all of Phase S1, and the S-UCS immersive redesign are complete."*

**Why they conflict:** A is ~3 months stale and is item #1 in the "Primary Reading Order" that
`spec/README.md` itself prescribes. A new agent following the prescribed reading order is
immediately misinformed about the project's state.

**Which reflects newer understanding:** B.

**Recommended resolution:** `spec/README.md` must not carry status. It becomes a pure map that points
to `IMPLEMENTATION.md` — the same rule `CLAUDE.md` §5 already applies to itself.

---

### CONFLICT 5 — The agent ecosystem: 30+ vs. reality

- **Document A:** `Broader-feature-product.md` §8 — a "canonical agent catalog (30+)" with 20 named
  agents including Socratic, Simulation, Communication, World-Today, Auto Note Builder, Code Helper,
  Socio-Ethical, Identical/Digital-Twin.
- **Document B:** `packages/product-cognition/src/agent-catalog.ts` — **23 manifests**, of which the
  wired-and-dispatched set is: supervisor, curriculum, explanation, practice, assessment, revision,
  intent, research, composer, frameplanner, imageplanner, representation, canonicalizer, meaning,
  claim, synthesis, frontier, temporal, creation.

**Why they conflict:** Four manifests — **memory, motivation, reflection, debate** — are declared in
the catalog and appear in the `ProductRuntimeAgentId` union with `work_type` mappings
([runtime-dispatch.ts:128-137](packages/product-cognition/src/runtime-dispatch.ts#L128-L137)), but
have **no dedicated unit and no registration**. They are taxonomy, not cognition. Meanwhile ~10 agents
named in the PRD (Socratic, Simulation, Code Helper, Socio-Ethical, Auto Note Builder, …) have no
manifest at all.

**Recommended resolution:** the manifest catalog becomes the authority; the PRD's list becomes an
explicitly-labeled *roadmap*, and inert manifests are either implemented or removed.

---

### CONFLICT 6 — Governance and safety are cited to empty directories

`Broader-feature-product.md` §17 grounds its governance, safety, and privacy commitments in
`spec/human-governance/` and `spec/cognitive-safety/`. `CLAUDE.md` §3 grounds the memory/storage
separation in `spec/storage/`.

**All three directories contain zero files.** So do `spec/governance/`, `spec/curriculum/`,
`spec/pedagogy/`, and `spec/communication/` — every one of them cited as an "owning domain" by
`spec/indexes/product-feature-index.md`.

**50 of 83 `spec/` subdirectories are empty.** The domain map describes an architecture of intent,
not of content, but reads as an inventory.

---

### CONFLICT 7 — Design law points at a superseded version

`CLAUDE.md` §3: *"`spec/design/cognitive-design-language-v1.md` — the Cognitive Design Language (CDL),
**the permanent design system**."* `spec/design/` contains v1 (2026-07-04), v2 (2026-07-04), and v3
(2026-07-10). None carries a supersession header.

---

## F. Canonicality Audit

Applying your test — *does this document deserve authority, or does it merely claim it?*

| Document | Claims | Deserves | Verdict |
|---|---|---|---|
| `CLAUDE.md` | Constitution | **Yes** — it is the only document actually enforced (auto-loaded) | **Keep as constitution; rewrite content** |
| `blueprint.md` §25.4 (ten laws) | Architecture invariants | **Yes** — cited by code, enforced by tests, referenced by every ADR | **Promote §25.4 to a standalone law document** |
| `blueprint.md` (rest) | Foundational architecture | Partly — largely aspirational (multi-region, 10k agents, federation) | **Merge → then split: adopted law vs. long-horizon** |
| `advanced-agent-architecture.md` | "Complete v3.0" | **No** — 24/26 sections duplicated; never revised; ~15% realized | **Merge into the unified architecture doc, then archive** |
| `agents-orchestration-deep-dive.md` | Architecture law (per `CLAUDE.md`) | **No** — it analyzes three external products | **Downgrade to `10-reference/`** |
| `Broader-feature-product.md` | "The canonical product specification" | **Partly** — the thesis and pillars are sound; the agent catalog, phasing, and citations are stale/broken | **Rewrite as the UCI Product Specification; merge in PCR-001** |
| `product-cognition-runtime.md` (PCR-001) | Draft runtime contract | **Yes, quietly** — the single most accurate spec in the repo; it tracks code phase-by-phase | **Promote; it is the model for how specs should be written** |
| `spec/vision-application/*` | "Upstream source of truth for intent" | **No, as currently framed** — it is the *education-era* vision; treating it as the arbiter of ambiguity is what keeps re-installing ULI as the platform | **Reframe as `00-vision/` with an explicit era note** |
| `spec/spec-folder-ecosystem.md` | "Canonical folder-domain inventory" | **No** — names 50 empty domains | **Replace with a generated domain index** |
| `spec/README.md` | Primary reading order | **No** — 3 months stale, misstates phase | **Rewrite as a pure map** |
| `F01–F16` | Feature specs | **Mixed** — all `draft` regardless of reality | **Restatus each against the truth model** |
| 63 ADRs | Accepted decisions | **Yes as history** — but "Accepted" ≠ "Implemented" | **Add an implementation-status field; supersede where superseded** |
| `Cognitive-Source-Environment-Specification.md` | Foundational architecture + UI/UX | **Yes on identity** — most UCI-correct doc in the repo, but ungoverned | **Move into `spec/`, reconcile with CSE-001…010** |
| `spec/research/persistent-cognitive-intelligence/` | "Research proposal. **Not adopted law.**" | **Yes — exemplary** | **Use as the template for research-tier documents** |

---

## G. Proposed Specification Hierarchy

Your candidate structure is close. Two changes: **verification does not deserve a top-level folder**
(it belongs inside each capability record, where it can't drift), and **an explicit domain layer** is
needed between product and capability so education never again silently becomes the platform.

```
spec/
├── 00-vision/            WHY. The Inevitable's purpose. Era-tagged; never cited to settle
│                         current-scope questions. (← spec/vision-application/)
│
├── 01-product/           WHAT UCI IS.
│   ├── uci-product-specification.md      ← merge of Broader-feature-product + PCR-001
│   └── domains/
│       ├── education/    ULI, UALRCI, pedagogy, curriculum  ← the first domain
│       ├── research/     research & discovery as a product surface
│       └── creation/     authoring & creative cognition
│
├── 02-research/          SCIENTIFIC AGENDA. Never production law. Adoption via ADR only.
│                         (← spec/research/, spec/cognitive_surface/ synthesis)
│
├── 03-architecture/      HOW UCI IS BUILT.
│   ├── uci-architecture.md               ← the merged v3.0 + v4.0 document
│   ├── architectural-laws.md             ← §25.4, promoted and made testable
│   ├── tech-stack.md
│   └── cognitive-architecture.md
│
├── 04-contracts/         PROTOCOLS, EVENTS, SCHEMAS, ABIs. The stable seam.
│                         (← spec/protocols/, spec/events/, spec/kernel/)
│
├── 05-capabilities/      ONE RECORD PER CAPABILITY. Replaces F01–F16.
│                         Each carries: spec · truth status · code refs · tests · runtime evidence.
│
├── 06-experience/        The Cognitive Surface, CDL, interaction.
│                         (← spec/surface/, spec/design/ — versioned, superseded marked)
│
├── 07-decisions/         ADRs. History. Each stamped with implementation status.
│
├── 08-implementation/    Roadmaps, phase plans, runtime specs (CSE, DPS, SRF, PCR).
│
├── 09-operations/        Deployment, persistence topology, runbooks, incidents.
│
└── 10-reference/         External research and inspiration. NOT law.
                          (← agents-orchestration-deep-dive.md, reference-repos, dossiers)
```

**The load-bearing change is `05-capabilities/`.** A capability record is the *only* place where a
capability's status may be asserted, and it must carry evidence:

```markdown
# CAP-004 — Persistent Learner Cognition

Truth status: PARTIAL IMPLEMENTATION          <- one of the seven, §O.3
Domain:       cross-domain (UCI core)
Spec:         04-contracts/memory-mutation-protocol.md
Decisions:    ADR-0010, ADR-0011, ADR-0034
Code:         apps/api/src/learners.ts, packages/memory/src/tiered-store.ts
Tests:        packages/memory/tests/*, apps/api/tests/*
Runtime evidence:  ✗ FAILS — /tmp reset wiped learner registry in production (commit ba6edbe)
Gap:          no durable store; no cross-session retrieval; ADR-0034 mandate unimplemented
```

This structure makes the defect in §A.2 **structurally impossible**: a capability cannot claim
production status without a runtime-evidence line.

---

## H. Product Architecture — What UCI Actually Needs

Not everything in the COS blueprint is required to make UCI real. Separating the four tiers:

### H.1 Required now — UCI cannot exist without these

| Capability | Why it is non-negotiable | Today |
|---|---|---|
| **Durable identity** | Without it there is no "you" for cognition to persist to | File-based, ephemeral |
| **Durable memory + world-state** | "Understanding compounds" is the product thesis | In-memory + JSON snapshots |
| **Durable retrieval** | Storage without retrieval is not memory | Per-session in-memory vectors |
| **Event log as source of truth** | Every replay/governance/observability claim depends on it | JSONL files; `events` table unused |
| **Governed model invocation** | Cognition must be recordable and replayable | **Real** — MIP + recording runtime |
| **Cognitive Surface** | The product's primary manifestation | **Real** — 9,619 loc, live |
| **Source ingestion & anchoring** | Cognition must be grounded in real material | **Real** — 3,475 loc CSE specs, working |

**Four of seven are unbuilt or ephemeral. All four are persistence.**

### H.2 Required soon
Multi-tenancy (RLS policies exist but no learner-scoped JWT); consolidation/decay as scheduled
processes; retrieval quality (hybrid semantic + graph + temporal); observability of *memory
influence*, not just spans.

### H.3 Defer — architecturally interesting, not currently load-bearing
Multi-region cognition, federation, consensus, 10,000-agent scaling, cognitive ISA/IR/compiler,
cognitive filesystem/GC/networking/economics. **These occupy 12 named `spec/` domains, all empty.**
Deferring them costs nothing today and removes a large false-maturity surface.

### H.4 Research, not product
Governed self-evolution beyond the current shadow-test engine; digital twin; collective
cognitive evolution; Persistent Cognitive Intelligence / belief-state modeling.

---

## I. Research Architecture

Research must be **separable from the production codebase** and must not be able to leak into it
without a decision. Three rules:

1. **Location.** All research lives in `02-research/`. `packages/` contains no research code.
   `packages/evaluation/` and `packages/intelligence/` — currently ambiguous — must be classified.
2. **Status.** Every research document carries the header
   `spec/research/persistent-cognitive-intelligence/README.md` already uses:
   *"Research proposal… **Not adopted law.**"* plus an explicit adoption gate.
3. **Adoption path.** Research becomes product only through:
   `research → prototype → validated (calibration harness) → ADR → capability record → code → runtime evidence`.
   No shortcut. An ADR is the *only* door.

Currently in the research tier: Persistent Cognitive Intelligence (the frontier), the cognitive
surface corpus (needs synthesis, §D.3), CSE drafts and audits, TTFF analysis.

---

## J. Implementation Reality — Brutally Honest

### J.1 What is genuinely real and good

This must be stated plainly, because the rest of this section is critical. **The cognitive path is
real.** A learner can enter a surface, state a goal, receive a model-generated prerequisite DAG,
be taught concept-by-concept with layered explanations, hear synchronized narration, upload a PDF
and be taught *from that document* with paragraph-level anchoring, submit an answer and receive
genuine graded mastery against a five-test depth protocol, and inspect the provenance chain of any
block. That is live, deployed, and verified. It is a serious achievement and it is not in question.

Specifically real: `packages/surface` (9,619 loc), `packages/product-cognition` (12,327 loc),
`apps/web` (13,066 loc), `apps/api` (4,531 loc), the Model Invocation Protocol with
record→replay, the governed dispatch path, the source environment, 138 test files, `pnpm verify`
green.

### J.2 What is not real

**Persistence.** The system cannot reliably remember something today and retrieve it tomorrow.
- Learner identity, cognition, sources, world-state, and memory are JSON on an **ephemeral** disk.
- 9 of 16 database tables are referenced by **zero** lines of code.
- The `events` table — declared "the canonical source of truth" in its own migration comment — is
  used by nothing.
- This has already failed in production (commit `ba6edbe`).

**Retrieval.** There is no durable retrieval system.
- `PgVectorStore` exists and passes conformance tests but is **never constructed** in any app.
- Production constructs `new InMemoryVectorStore()` per session ([wiring.ts:937](apps/cli/src/wiring.ts#L937)).
- `ContextAssembler` indexes only items seeded into that session; the index dies with the process.
- There is no graph retrieval, no temporal retrieval, no hybrid ranking, no cross-session retrieval,
  no memory consolidation process, no stale-memory handling, no contradiction detection over memory.
- `RecordingModelRuntime.embed()` throws `E_MODEL_REPLAY_MISS` — embeddings are not recorded, so
  any future embedding-dependent path is not replay-safe.

**Memory as a cognitive system.** `packages/memory` is **227 lines** — an append-only `Map` of
validated mutations plus a projection fold. Tiers exist as string labels. Decay is a function of a
payload field, not a scheduled process. Consolidation is not implemented as behavior. F05 describes
a hierarchical, compressing, consolidating, distributive substrate; the code is a typed log.

**Institutional and collective intelligence (F11, F12).** `institution` exists as a `PersonaClass`
that maps to a `unitType` string ([onboarding.ts:47-48](packages/product-cognition/src/onboarding.ts#L47-L48)).
There is no cohort model, no educator↔student agent channel, no institutional memory boundary, no
cross-cohort analytics. `EvolutionEngine` (390 loc, real logic) is constructed in
[wiring.ts:1136](apps/cli/src/wiring.ts#L1136) but **no gateway route reaches it** — the same is true
of `TwinRegistry` ([wiring.ts:1067](apps/cli/src/wiring.ts#L1067)). Built, unreachable.

**Four declared agents are inert.** memory, motivation, reflection, debate: manifests + type-union
membership, no unit, no registration.

**Multi-tenancy.** RLS is enabled on every table with **no policies** — deny-by-default, and the
gateway uses the service role, bypassing it entirely. There is no learner-scoped authorization at
the database layer. This is documented as intentional in `0001_core_substrate.sql`, and it is the
right first step — but it means tenant isolation is currently enforced by application code alone.

### J.3 Cognitive Surface — specified vs. implemented

| Capability | Status | Evidence |
|---|---|---|
| Document ingestion (PDF/DOCX/notebook/web/video/code) | **Production** | `apps/api/src/sources.ts` 1,704 loc; ADR-0036/0046/0047/0048/0059 |
| Source rendering + exact anchoring | **Production** | `anchors` table, `SourceReference.tsx` 480 loc |
| Paragraph/line-level highlighting | **Production** | ADR-0057; `source-projection.ts` |
| Agent-controlled scrolling / viewport | **Production** | CSE viewport planning |
| Synchronized narration | **Production** | `narration.ts` 392 loc; Gemini voice; word-level sync |
| Frame progression + continuity | **Production** | `frames.ts` 574 loc; ADR-0030/0060/0061 |
| Diagrams / equations | **Partial** | `latex.ts` 243 loc; image planner unit; no derivation engine |
| Simulations / interactive physics | **Specification only** | F09 roadmap; no code |
| Source comparison / fusion | **Production** | ADR-0040/0041/0042; `fusion-synthesis-unit.ts` |
| Research mode / frontier overlays | **Production** | ADR-0043/0044/0045 |
| Knowledge-graph projection | **Partial** | `kg-engine.ts`; `TimelineGraph.tsx` 338 loc; 5 edge types used |
| Learner state | **Partial** | mastery checkpoints; point estimates only (see PCI research) |
| **Persistent surface state** | **Partial → fails in prod** | rehydration works locally; `/tmp` wipes it |
| Adaptive representation | **Production** | ADR-0058 Representation Intelligence Agent |

The surface is the **strongest** part of this system. Its weakness is that everything it produces
lands on an ephemeral floor.

---

## K. Capability Traceability Matrix

Statuses per the truth model in §O.3. Honest, not generous.

| # | Capability | Vision | Spec | ADR | Code | Tests | Runtime evidence | **Status** |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| F01 | Cognitive onboarding | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ live | **PRODUCTION** |
| F02 | Dynamic navigation / timeline | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ live | **PRODUCTION** |
| F03 | Recursive prerequisite intelligence | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ live | **PRODUCTION** — depth of recursion unverified against "zero-knowledge point" guarantee |
| F04 | Adaptive multimodal explanation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ live | **PARTIAL** — layers 0–1 real; 2–6 declared, not verified; DSP is prompt assembly, not a governed rewriting layer |
| F05 | **Persistent cognitive memory** | ✓ | ✓ | ✓ | ~ | ~ | **✗ FAILS** | **PARTIAL → NOT PRODUCTION.** 227 loc, in-memory; no durable store; no consolidation/decay process; wiped by `/tmp` reset |
| F06 | Specialized agent ecosystem | ✓ | ✓ | ✓ | ~ | ✓ | ✓ partial | **PARTIAL** — 19 of 23 manifests wired; 4 inert; ~10 PRD agents nonexistent |
| F07 | Real-time orchestration | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ live | **PRODUCTION** — bus/blackboard/scheduler real; proactive multi-agent surfacing limited |
| F08 | Interdisciplinary knowledge graph | ✓ | ✓ | ✓ | ~ | ~ | ~ | **PARTIAL** — 5 edge types; `bridges_to` generated by the model, not by a cross-domain engine; graph not durable |
| F09 | Living-universe experience | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ live | **PRODUCTION** (AR/VR/holographic explicitly roadmap) |
| F10 | Research & innovation acceleration | ✓ | ✓ | ✓ | ~ | ~ | ~ | **PARTIAL** — frontier/temporal research real; Novel Contribution Engine (gap analysis, scale transformation, failure library) **NOT IMPLEMENTED** |
| F11 | Institutional & collective intelligence | ✓ | ✓ | — | ✗ | ✗ | ✗ | **NOT IMPLEMENTED** — persona string only |
| F12 | Collective cognitive evolution | ✓ | ✓ | ✓ | ~ | ✓ | ✗ | **PROTOTYPE** — `EvolutionEngine` real but unreachable from any product path |
| F13 | Identity, personas, modes | ✓ | ✓ | ✓ | ~ | ✓ | ~ | **PARTIAL** — modes typed and threaded; Educator/Institution modes have no distinct behavior |
| F14 | Assessment, mastery, depth | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ live | **PRODUCTION** — five-test protocol genuinely implemented and graded against learner answers |
| F15 | Content ingestion & knowledge substrate | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ live | **PRODUCTION** — bytes durable in Supabase Storage; **catalog is not** |
| F16 | Cognitive Surface | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ live | **PRODUCTION** |
| — | **Durable persistence substrate** | ✓ | ✓ | ADR-0034 | ~ | ~ | **✗ FAILS** | **PARTIAL** — 9/16 tables dead; identity/memory/world-state on ephemeral disk |
| — | **Durable retrieval** | ✓ | ✓ | ADR-0012 | ~ | ✓ | **✗ NONE** | **NOT IMPLEMENTED in production.** `PgVectorStore` never constructed outside tests |
| — | Replay & determinism | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **PRODUCTION** (within a process lifetime; not across the ephemeral boundary) |
| — | Governance kernel | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **PRODUCTION** — but 251 loc; policy set is thin (2 baseline dispatch policies) |
| — | Multi-tenancy / RLS | ~ | ~ | ADR-0034 | ✗ | ✗ | ✗ | **NOT IMPLEMENTED** — RLS on, zero policies, service-role bypass |

**Summary: 9 production · 8 partial · 1 prototype · 3 not implemented.**
Every one of the "not implemented" and the most severe "partial" entries is **persistence or
retrieval**.

---

## L. CLAUDE.md Diagnosis

`CLAUDE.md` is well-constructed as a document — §7's self-governance is genuinely good and has kept
it to 211 lines. Its problems are content, not form.

1. **§1 encodes the wrong identity.** Opens with "Cognitive Operating System (COS) for education,"
   terminal form "Universal Learning Intelligence." Contradicted by the newest layer of the repo (§E.1).
2. **§1 has no research dimension.** The Inevitable's second half is absent from its constitution.
3. **§2 has no truth model.** It states laws about how to build; nothing about how to *classify what
   exists*. This is the omission that permits §A.2.
4. **§2's law list is not testable.** "Intelligence is modular, composable, observable, governable,
   persistent, replayable, and evolvable" — seven adjectives in one bullet, no violation criterion.
   Compare to the one law that *is* enforced ("no vendor past its adapter"), which is checkable.
5. **§3 miscategorizes reference material as law.** `agents-orchestration-deep-dive.md` analyzes
   OpenMAIC/OpenClaw/NemoClaw and is listed under "Architecture law" (§D.2).
6. **§3 names two rival architectures as one.** "complementary foundations, never conflicting" —
   they are 24/26 duplicate (§D.1).
7. **§3 points at superseded and empty targets.** CDL **v1** when v3 exists; `spec/storage/` (empty).
8. **§3 elevates the education-era vision corpus to "upstream source of truth whenever intent or
   philosophy is ambiguous."** This is the mechanism by which ULI keeps reasserting itself as the
   platform definition. It is the single highest-leverage line to change.
9. **§2's "Never" list is missing the most important prohibition:** never assert that a capability
   exists on the strength of a specification.

---

## M. CLAUDE.md Redesign

`CLAUDE.md` should become **navigation + governance + truth discipline** — and nothing else. It must
not grow; it should stay under ~200 lines. Proposed section set:

| § | Section | Content | ~Lines |
|---|---|---|---|
| 1 | **Identity** | The Inevitable = Product (UCI) + Research. Education is the first domain, not the definition. The UCI/ULI/COS/Surface vocabulary table (§B). | 20 |
| 2 | **The Truth Model** | The seven statuses (§O.3) and the law: *implementation evidence outranks documentation claims.* Where status may be asserted (capability records only). | 18 |
| 3 | **Architectural Laws** | The definitive set (§O), each stated so a violation is *detectable*. | 30 |
| 4 | **Specification Hierarchy** | The 00–10 map (§G): what each layer owns, which layer wins on conflict, where to look first for each kind of question. | 30 |
| 5 | **Working Doctrine** | Spec ceremony in proportion (keep current §4 — it is good). Plus: research→product adoption gate. | 25 |
| 6 | **Anti-patterns** | What must not happen: new spec by default; status outside a capability record; a spec asserting existence; a research doc cited as law; reference material cited as architecture; a "complementarity" clause used instead of a merge. | 20 |
| 7 | **Resolving ambiguity** | The lookup order: capability record → contract → ADR → architecture → product → vision. Code outranks all of them for *what exists*. | 12 |
| 8 | **Build & verify** | Unchanged. | 8 |
| 9 | **Constitution governance** | Keep current §7 (it works), extended to forbid status claims. | 25 |

**Deliberately excluded:** current implementation status (belongs in capability records and
`IMPLEMENTATION.md`), any capability list, any phase history.

---

## N. Specification Consolidation Plan

Target: **222 files → roughly 150**, with zero information destroyed.

### N.1 Merge

| Result | Sources | Rationale |
|---|---|---|
| `03-architecture/uci-architecture.md` | `advanced-agent-architecture.md` + `next-generation-…-blueprint.md` | 24/26 duplicate sections (§D.1) |
| `03-architecture/architectural-laws.md` | blueprint §25.4 + `CLAUDE.md` §2 | Promote the only enforced invariants to a standalone, testable document |
| `01-product/uci-product-specification.md` | `Broader-feature-product.md` + `product-cognition-runtime.md` | The PRD states intent; PCR-001 states the executable contract. One document, two altitudes. **This is your requested product merge.** |
| `02-research/cognitive-surface/synthesis.md` | 10 files in `spec/cognitive_surface/` | ~5 duplicate pairs (§D.3) |
| `01-product/domains/education/` | ULI + UALRCI content extracted from PRD §5, vision corpus | Makes education a *domain*, structurally |

### N.2 Split

| Source | Becomes |
|---|---|
| `Broader-feature-product.md` | UCI product spec (domain-general) **+** `domains/education/` (ULI/UALRCI/pedagogy) |
| Merged architecture doc | **Adopted architecture** (implemented + committed) **+** `02-research/long-horizon-architecture.md` (multi-region, federation, 10k-agent scaling, cognitive ISA/IR/compiler) |
| `F01–F16` | **16+ capability records** in `05-capabilities/`, each with a truth status and evidence |

### N.3 Rewrite

`CLAUDE.md` (§M) · `spec/README.md` (pure map, no status) · `spec/spec-folder-ecosystem.md` → generated
domain index · `AGENTS.md` / `CODEX.md` → thin pointers to `CLAUDE.md` (currently 433 lines of parallel
constitution that can drift independently).

### N.4 Relocate

`Cognitive-Source-Environment-Specification.md` → `spec/08-implementation/cse/` (reconcile with
CSE-001…010) · `The-inevitable.md`, `Final-Annexures.md` → `docs/business/` ·
`agents-orchestration-deep-dive.md` → `10-reference/`.

### N.5 Archive (never delete)

`docs/history/architecture/` receives the original v3.0 and v4.0 documents, the superseded CDL
versions, and the duplicate surface-research files — each with a `superseded-by` header and its
original date. **History is preserved; it simply stops masquerading as current.**

### N.6 Delete

Only the 50 empty `spec/` subdirectories. Nothing else.

### N.7 Restatus

All 63 ADRs gain an `Implementation status:` field (`implemented` / `partial` / `not-implemented` /
`superseded-by`). ADR-0034 is the first and most important (§E.3).

---

## O. Architectural Laws — The Definitive Set

Each law is stated so that a **violation is detectable**. This is the property the current §2 lacks.

### O.1 Truth laws (new — these are the correction)

1. **Implementation evidence outranks documentation claims.**
   A specification describes what should exist. Code demonstrates what does exist. Tests demonstrate
   what works. Runtime evidence demonstrates what is reliable.
   *Violation:* any document asserting a capability exists without a code + evidence reference.

2. **Status lives in exactly one place.**
   A capability's status may only be asserted in its capability record, and only with evidence.
   *Violation:* a status claim in a spec, an ADR, a README, or `CLAUDE.md`.

3. **An accepted decision is not an implemented decision.**
   Every ADR carries an implementation status independent of its acceptance status.
   *Violation:* an `Accepted` ADR with no implementation-status field. (Today: all 63.)

4. **Research is not product until it passes the gate.**
   `research → prototype → validated → ADR → capability record → code → runtime evidence`.
   *Violation:* research primitives referenced by production code without an adopting ADR.

5. **Product reality outranks speculative architecture.**
   Infrastructure is built because a capability needs it, never because a diagram contains it.
   *Violation:* a package or schema with no capability record depending on it.

### O.2 System laws (retained, sharpened)

6. **Intelligence is model-agnostic.** No vendor, model, transport, or store leaks past its adapter.
   *Violation:* `@supabase/*`, `pg`, `@google/genai` in any non-adapter package's dependencies.
7. **Dependencies point inward.** Manifestations → substrate → contracts → nothing.
   *Violation:* a `packages/` import from `apps/`.
8. **Agents are cognitive runtime containers, not prompts.** Manifest + identity + capability envelope
   + observability contract, or it is not an agent.
   *Violation:* a dispatched unit without a manifest.
9. **Every semantic exchange is typed.** Cognition packets, never bare strings.
10. **Every memory write is a typed mutation.** No direct store writes.
11. **Context and intent are accessed only through leases.** Bounded, revocable, expiring.
12. **Every meaningful state change is an event.** Causality + versioning on the envelope.
13. **Governance is a kernel primitive.** Evaluated before the side effect, not after.
14. **Every cognitive decision emits a reasoning trace.**
15. **Cognition is replayable.** Deterministic under injected clock/id/model-record.
16. **Interfaces are projections.** The Surface projects world-state; it never owns truth.
    *Violation:* client-side state that is not derivable from the event log.
17. **Persistence is a product requirement, not an infrastructure detail.** *(new)*
    A capability that cannot survive a process restart is not implemented.
    *Violation:* durable cognitive state on ephemeral storage. **Currently violated.**
18. **Retrieval is half of memory.** *(new)*
    Storage without indexed, ranked, cross-session retrieval is not memory.
    *Violation:* a memory tier with no retrieval path. **Currently violated.**
19. **Self-evolution only through governed proposals.** Evaluation, shadow test, replay, rollback.
20. **Consent is granular, scoped, revocable, and cascades to redaction.**

### O.3 The Truth Model — the seven statuses

| # | Status | Means | Minimum evidence |
|---|---|---|---|
| 1 | **VISION** | We aspire to this | A vision document |
| 2 | **RESEARCH** | Under scientific investigation | A research document with an adoption gate |
| 3 | **SPECIFICATION** | Formally designed | A spec + an ADR |
| 4 | **PROTOTYPE** | Demonstrated experimentally | Code that runs, not on any product path |
| 5 | **PARTIAL** | Meaningful portion in code | Code + tests; a named, written gap |
| 6 | **PRODUCTION** | Works end-to-end in the product | Full path UI→API→runtime→agent→persistence→retrieval→response→surface |
| 7 | **PRODUCTION VERIFIED** | Reliable | Production + observability + durability + recovery + runtime evidence |

`VISION ≠ SPECIFICATION ≠ PROTOTYPE ≠ IMPLEMENTATION ≠ PRODUCTION`. Conflating them is a
constitutional violation.

**Note on the current state:** by this model, *no* capability in this repository is currently
**PRODUCTION VERIFIED**, because durability fails at the deployment tier. The most advanced honest
status available today is **PRODUCTION**.

---

## P. Migration Plan

Five stages. Nothing is deleted except empty directories; every relocation preserves history.

**Stage 1 — Ratify (docs only, ~1 session).**
One ADR: *"UCI identity, the Truth Model, and the specification hierarchy."* Rewrite `CLAUDE.md` per
§M. `AGENTS.md`/`CODEX.md` become pointers. **This is the only stage that must happen before any
other work.**

**Stage 2 — Restatus (mechanical, no rewriting).**
Add `Implementation status:` to all 63 ADRs. Add a truth status to F01–F16 using §K. Mark superseded
CDL versions. `spec/README.md` loses its status section. Delete the 50 empty directories.
*After Stage 2 the repository is honest even though nothing has moved.*

**Stage 3 — Consolidate (the merges).**
Merge the two architecture documents; promote §25.4 to `architectural-laws.md`; merge the PRD with
PCR-001; synthesize the surface-research cluster; move reference material to `10-reference/`; archive
originals under `docs/history/architecture/` with `superseded-by` headers.
*Run as `git mv` where possible so history follows the file.*

**Stage 4 — Restructure (the 00–10 hierarchy).**
Move domains into place. Convert F01–F16 into capability records with evidence lines. Extract
education into `01-product/domains/education/`. Regenerate indexes. Add a CI check: every capability
record must have a code reference and an evidence line.

**Stage 5 — Close the gaps (implementation begins).**
Now — and only now — build against an honest baseline, starting with §Q.

---

## Q. The Single Most Important Next Step

**Finish ADR-0034.** Make persistent learner cognition real, end-to-end, on Postgres — identity,
memory, world-state, and retrieval — and use it as the pilot for the Truth Model.

Not a new decision. Not a new spec. **An accepted decision that was never completed**, and whose
incompleteness is the root of the frustration that prompted this audit.

**Why this and nothing else:**

- It is the **only** item that appears as a failure in every layer of §K. Every other gap is a
  missing feature; this is a broken foundation.
- It has **already failed in production** (commit `ba6edbe`) — the strongest possible evidence class.
- UCI is definitionally impossible without it. "Understanding compounds" is the product thesis; on an
  ephemeral disk, understanding evaporates on every redeploy.
- Every downstream capability inherits it: F05 cannot be real, F08's graph cannot be durable, F11's
  institutional memory cannot exist, F12 has nothing to evolve *from*, and the digital twin has no
  substrate — all for the same reason.
- **It requires no new specification.** ADR-0034 already mandates it, the migrations already define
  the tables, the adapters already exist and already pass conformance. The work is wiring, not design.
- It is the perfect Truth-Model pilot: one capability record, taken from **PARTIAL** to
  **PRODUCTION VERIFIED**, with the evidence line proving it — establishing the pattern for all others.

**Concretely, in order:** learner registry → Postgres · memory mutations → Postgres · world-state
deltas/nodes/edges → Postgres · `PgVectorStore` constructed in the real wiring path with recorded
embeddings · source catalog → Postgres · then prove it: *create a learner, teach a concept, redeploy
the service, return, and retrieve.*

That single end-to-end proof is worth more than the next ten specifications.

---

## Appendix — Evidence Index

| Claim | Evidence |
|---|---|
| 83 spec subdirectories, 50 empty | `find spec -name '*.md'` per directory |
| 222 spec files, 50,886 lines | `find spec -name '*.md' \| wc -l` |
| 56,434 lines non-test source | `packages` + `apps` + `services`, `.ts`/`.tsx`, excluding `.test.` |
| 63 ADRs, all Accepted, none superseded | `spec/architecture-decisions/ADR-0*.md` status scan |
| 24/26 duplicate architecture sections | `grep '^## '` on both documents |
| 9 of 16 tables unreferenced | table-name grep across `packages`, `apps`, `services` |
| `PgVectorStore` never constructed outside tests | `grep -rn "PgVectorStore"` |
| `new InMemoryVectorStore()` in production wiring | `apps/cli/src/wiring.ts:937` |
| Learner registry is JSON on disk | `apps/api/src/learners.ts:207-211` |
| `/tmp` is ephemeral on the deployment tier | `render.yaml`, and its own comment |
| Production failure from registry reset | commit `ba6edbe` |
| `packages/memory` is 227 lines | `wc -l packages/memory/src/*.ts` |
| 4 inert agent manifests | `agent-catalog.ts` vs. unit registrations in `wiring.ts` |
| `EvolutionEngine`/`TwinRegistry` unreachable | constructed at `wiring.ts:1136`/`:1067`; no gateway route |
| Architecture docs unchanged since 2026-06-04 | `git log -1 --format=%ad` per file |
| PRD cites empty directories | link extraction vs. file counts |
| RLS enabled with zero policies | `supabase/migrations/0001_core_substrate.sql` |
