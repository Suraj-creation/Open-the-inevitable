# ADR-0025: Cognitive Ensemble Orchestration

**Status:** Accepted
**Date:** 2026-06-21
**Supersedes:** none
**Related:** [ADR-0018](ADR-0018-proposal-blackboard-arbitration.md) (proposal blackboard),
[ADR-0007](ADR-0007-surface-choreography-and-timing.md), SRF-001, SRF-002,
`spec/product/features/F06-specialized-agent-ecosystem.md`, `F07-realtime-cognitive-orchestration.md`,
`spec/architecture/Cognitive-Architecture.md` (Layer 1), Phase S1.2

## Context

The learning loop (`FiberedLearningLoop`) runs one agent per phase — supervisor → explanation →
practice → mastery — serially. The P4.1 challenger (ADR-0018) runs concurrently but is a **probe**: its
output is discarded ("primary explanation selected"), never surfaced or synthesized. The result is a
single, pre-determined reasoning path: the antithesis of *"observing understanding unfolding."* F07
specifies the opposite — multiple specialized agents publishing **competing proposals** that the
supervisor arbitrates, with disagreement made visible.

The decision: how do multiple agents reason **in parallel**, contribute **proposals** rather than
finished blocks, and have those **synthesized** into surfaced cognition — while staying within
deterministic, replayable, governed execution, and without over-building the full ~20-agent roster
before the topology is proven?

## Decision

1. **Adopt a focused Cognitive Ensemble, expanding later.** Phase S1 runs a high-impact ensemble:
   **arbiter/supervisor, explanation, a genuine challenger/Socratic peer, curriculum/graph-cartographer,
   assessment, memory**, plus **research** when readiness-gated (F10/F14). This proves parallel
   exploration + debate + synthesis without committing to the full F06 roster (which expands in S3).

2. **Agents produce proposals, not final blocks.** In `FiberedLearningLoop.handleDispatch`, the existing
   challenger `Promise.all` is generalized to a concurrent **N-agent fan-out**. Each agent is a
   model-backed cognitive unit recorded via `RecordingModelRuntime` (D3). Their outputs are written as
   typed entries to the existing `ProposalBlackboard` (`@inevitable/orchestration`), **promoted from an
   audit log to the live arbitration substrate** (extends ADR-0018).

3. **An arbiter/synthesis step produces the surfaced cognition.** After fan-out, the arbiter
   (supervisor capability) selects/synthesizes the proposals into the block(s) that become visible,
   emitting `surface.proposal.proposed` (per proposal, with confidence), `surface.synthesis.recorded`
   (the arbitration rationale + chosen/merged result), and — when proposals diverge beyond threshold —
   the existing `surface.agent.disagreed`. The learner sees the contention and its resolution, not just
   the winner.

4. **Determinism is preserved by construction.** Concurrency is in the async bridge (like today's
   challenger), not in the synchronous fiber routine. Every agent output is recorded; the fold stays
   pure; replay resolves all proposals from the record and never re-invokes a provider. `presence`
   reflects genuine parallel `thinking`/`contributing`/`speaking`, but presence/timing are projections.

5. **Governance gates every agent in the ensemble.** Each proposal dispatch passes the existing
   governance gate and capability check; a blocked agent contributes nothing and emits no surface event.
   Arbitration itself is a governed decision recorded in `surface.reasoning.recorded`/`synthesis.recorded`.

## Alternatives Considered

- **Keep the probe; just surface its output.** (The "minimal" option.) Rejected as the working model:
  one challenger is not an ensemble — no parallel exploration across prerequisite/dependency/analogy
  trajectories, no genuine synthesis. It remains available as a degenerate N=2 case.
- **Full ~20-agent F06 roster in S1.** Rejected: heavy, slow, and premature before the topology is
  proven; risks over-building. The ensemble is designed to expand to it (S3) without re-architecture.
- **Sequential agent chaining (agent A's output feeds B).** Rejected as the primary model: chaining is
  a pipeline, not exploration; it cannot show contention. Chaining remains available *within* a single
  agent's reasoning, but cross-agent exploration is concurrent.
- **A new orchestration engine.** Rejected: `ProposalBlackboard` + the fiber loop + the scheduler
  already provide proposals, concurrency, and budgeting. This is a composition, not new infrastructure.

## Consequences

- The surface shows **real multi-agent cognition** — parallel proposals, visible disagreement, and a
  synthesized result — the core of "understanding unfolding." This realizes Cognitive-Architecture
  Layer 1 (capabilities composed into a visible ensemble).
- New `surface.proposal.*` and `surface.synthesis.recorded` subtypes register in SRF-002 (schema bump);
  `ProposalBlackboard` gains a live-arbitration role (extends ADR-0018, still append-only/auditable).
- Cost/latency rise with fan-out width; the scheduler's existing budgets/backpressure bound it, and
  fan-out width is a tunable parameter (start small).
- Obligation: arbitration must be deterministic given recorded proposals (no wall-clock/random tie-
  breaks); disagreement surfacing must carry a human-readable resolution (no dark-pattern "silent
  winner"). Replay-equivalence and D3 tests extend to the ensemble.

## Open Questions

- Arbiter design: rule-based synthesis (S1) vs. a model-backed synthesizer agent (later)? Start
  rule-based + recorded rationale; revisit when a synthesizer earns its place.
- How many proposals to surface vs. collapse under cognitive-load governance (F16 density policy)? —
  defer to the load policy when it lands.
- Interaction with the Evaluation layer (Layer 2): proposal quality should eventually be scored and fed
  back; out of scope for S1, noted for S3/S4.
