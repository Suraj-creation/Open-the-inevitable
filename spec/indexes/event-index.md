# Event Index

Initial event families:

- `intent.*`
- `context.*`
- `agent.*`
- `reasoning.*`
- `memory.*`
- `world.*`
- `orchestration.*`
- `workflow.*`
- `governance.*`
- `security.*`
- `observability.*`
- `evolution.*`

Every event family must define schema, producer, consumer, retention, replay, governance classification, and failure behavior.

## Canonical Specs

- Event envelope and semantics → [protocols/cognitive-event-protocol.md](../protocols/cognitive-event-protocol.md)
- Full family catalog (owners, retention, replay, classification) → [events/event-taxonomy.md](../events/event-taxonomy.md)
- Governance rules for events → [meta/event-governance.md](../meta/event-governance.md)

