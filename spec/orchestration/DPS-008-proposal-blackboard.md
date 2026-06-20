# DPS-008 — Proposal Blackboard (P4.1)

**Domain:** orchestration
**Status:** accepted
**Phase:** P4.1
**ADR:** ADR-0018

---

## 1. Purpose

The ProposalBlackboard extends the existing `InMemoryBlackboard` with a typed proposal lifecycle for multi-agent cognition. When two agents (explanation + challenger) produce competing outputs for the same concept, both proposals are written to the board, disagreement is detected, and arbitration is recorded. The result is visible as `surface.agent.disagreed` on the cognitive surface and as an `ArbitrationRecord` on the board.

---

## 2. Subscribed events

| Event | Source | Use |
|---|---|---|
| *(none — not an event subscriber)* | — | Proposals written programmatically by the fiber bridge handler |

---

## 3. Emitted events

| Event | Emitted when |
|---|---|
| `surface.agent.disagreed` | Jaccard similarity of `layer_0` text between explanation and challenger < 0.3 |

Payload shape:
```json
{
  "surface_id": "srf-...",
  "agent_cids": ["<primary-cid>", "challenger"],
  "topic": "explanation:<conceptId>",
  "concept_id": "<conceptId>",
  "resolution": {
    "winner": "explanation",
    "reason": "primary explanation selected"
  }
}
```

---

## 4. Proposal lifecycle

```
propose(key, agentCid, value)   → ProposalEntry recorded on the board
arbitrate(key, winnerCid, reason) → ArbitrationRecord recorded on the board
proposals(key)                  → all ProposalEntry for key
arbitrations()                  → all ArbitrationRecord (append-only)
```

The board never deletes entries; it accumulates for replay and audit.

---

## 5. Disagreement detection

Jaccard similarity over the word-sets of `layer_0` text (the intuition layer) from each agent's response:

```
similarity = |A ∩ B| / |A ∪ B|
disagreement = similarity < 0.3
```

If either agent's `layer_0` is absent, no disagreement is declared.

---

## 6. Multi-agent dispatch pattern

The FiberedLearningLoop `handleDispatch` handler, when a `challengerDispatcher` is present in deps, runs the explanation and challenger dispatches concurrently via `Promise.all`. The explanation result is always the authoritative output returned to the surface; the challenger is a parallel cognitive probe.

```
Promise.all([
  explanationDispatcher.dispatch({ ... }),
  challengerDispatcher.dispatch({ ... })
])
```

Both proposals are written to the blackboard. Disagreement is detected synchronously post-await. The `surface.agent.disagreed` event is emitted before `run()` returns.

---

## 7. Non-goals

- Consensus algorithms or voting (future P5+).
- Model-side tool calling or agent messaging (P7).
- Persistent / cross-process blackboard state (P4 is in-memory; durability follows P1).
- Changing which result feeds the surface fold (explanation always wins in P4).

---

## 8. Dependencies

- `@inevitable/orchestration` (InMemoryBlackboard, ProposalBlackboard)
- `@inevitable/product-cognition` (FiberedLearningLoop, ProductRuntimeDispatcher)
- `@inevitable/events` (bus.publish, createEvent)
- `@inevitable/surface` (surface.agent.disagreed fold, DisagreementRecord)
