# ADR-0024: Surface Interaction Protocol

**Status:** Accepted
**Date:** 2026-06-21
**Supersedes:** none
**Related:** [ADR-0006](ADR-0006-surface-gateway-transport.md) (gateway transport),
[ADR-0007](ADR-0007-surface-choreography-and-timing.md) (choreography), SRF-002, SRF-005,
`spec/implementation-roadmaps/cognitive-surface-maturity.md` (Phase S1.3)

## Context

Today the Cognitive Surface accepts only three commands — `ask | expand | close` — and the learner's
only mid-session agency is to re-ask or scrub client-side playback. The vision requires the opposite:
the learner *thinks with* the surface — interrupting mid-reasoning, challenging a claim, asking for
depth or simplification or an example, jumping to a concept, or branching into research. None of that
exists, and it cannot be bolted on as ad-hoc client state without breaking the surface's core
invariants (event-sourced determinism, pure fold, byte-identical replay, governance at every boundary).

The decision: how do learner interactions enter the runtime such that they are **first-class,
governed, and replayable** — and how does a long-running reasoning fiber get **interrupted** without
violating the deterministic execution model?

## Decision

1. **Every learner interaction is a typed command at the gateway and a governed `surface.interaction.*`
   event in the log.** The command envelope (`apps/api`) is extended beyond `ask|expand|close` with:
   `interrupt`, `jump` (focus a concept/node), `branch` (fork exploration, incl. into research),
   `challenge` (contest a block/claim), `request_depth`, `request_simplify`, `request_example`. The
   gateway validates and governs each, then the session emits a `surface.interaction.received` event
   (and any resulting `surface.*` events) — nothing reaches cognition except through this path.

2. **Interactions fold like any other event; the fold stays pure.** `foldSurfaceEvents` gains handling
   for the interaction sub-family (recording the learner's intent into `SurfaceState.interactions[]`
   and, where it changes focus, into `focus`). Client fold ≡ server state is preserved; replay is exact
   because the interaction *is* the recorded fact.

3. **Interrupt is cooperative cancellation, not preemption.** The reasoning fiber
   (`@inevitable/execution`) checks an interrupt flag at its existing yield points (between ensemble
   fan-out, synthesis, narration segments). An `interrupt` sets the flag; the fiber reaches the next
   checkpoint, emits `surface.interaction.applied` with the cancellation reason, and yields control so
   the new intent can re-enter the loop. No fiber state is torn down mid-effect — determinism and the
   execution journal stay intact.

4. **Reshaping intents re-enter the same governed loop.** `request_depth`/`simplify`/`example` and
   `challenge` are dispatched as new cognition through the existing `ProductRuntimeDispatcher`
   (governance-gated, recorded via D3), producing new blocks/narration. `jump`/`branch` re-project the
   timeline graph (SRF-003) and re-focus; they never mutate canonical state imperatively.

5. **Replay reproduces the full interactive session byte-for-byte.** Because each interaction is an
   event and each agent output is recorded (D3), replaying `surface.>` reconstructs the exact session —
   including where the learner interrupted and what the surface did next. Playback timing remains a
   client projection (ADR-0007); only logical order is canonical.

## Alternatives Considered

- **Client-side-only interaction (mutate the rendered view).** Rejected: it makes interactions
  invisible to replay, governance, and observability — the surface would lie about what happened, and
  two clients would diverge. Violates ADR-0006 (canonical record) outright.
- **Preemptive fiber termination on interrupt.** Rejected: tearing down a fiber mid-effect breaks the
  execution journal and replay determinism. Cooperative checkpoints give responsive interrupts while
  keeping D2/D3 guarantees.
- **A separate "control" channel outside the event log.** Rejected: a second source of truth defeats
  event sourcing; interactions belong in the same governed, replayable family as everything else.
- **Bidirectional WebSocket now (for low-latency interaction).** Deferred (consistent with ADR-0006):
  HTTP POST commands + SSE down are sufficient for single-writer interaction; duplex is revisited only
  when multi-writer collaboration lands (Phase S4).

## Consequences

- The learner gains real agency over reasoning — the single largest "static → living" lever — without
  any new infrastructure or any weakening of determinism, replay, or governance.
- Observability deepens: the interaction log is a first-class record of *how a mind engaged*, available
  to the Cognitive Evaluation layer (Layer 2) and to session replay/branching.
- New `surface.interaction.*` subtypes (`received`, `applied`) register in SRF-002 (schema_version bump);
  folds ignore unknown subtypes, so older projections stay valid.
- Obligation: every new command is governance-gated and carries provenance; blocked interactions emit
  no cognition events (only an audited rejection). Interrupt checkpoints must be placed at every
  long-running yield boundary or interrupts feel unresponsive.

## Open Questions

- Granularity of `challenge`: does it spawn a dedicated debate sub-loop (a Debate agent, Phase S3) or
  re-dispatch the challenger/Socratic agent already in the S1 ensemble? (S1: the latter.)
- Should `branch` create a forked surface (new `surface_id`, lineage pointer) or an in-surface
  exploration sub-tree? (Proposed: in-surface for S1; forked surfaces when twin/collaboration lands.)
- Rate/▢budget governance for rapid interrupts — handled by the scheduler's existing backpressure, or a
  dedicated interaction policy? (Defer to the scheduler until a real abuse case appears.)
