# Reference Repo Pattern Extraction

This document records implementation patterns to extract from the local reference repositories before building COS subsystems.

## MiroFish

Use for:

- Staged domain pipeline design.
- Graph construction from uploaded context.
- Agent profile generation.
- Long-running simulation monitoring.
- Report generation with retrieval and tool traces.

COS adaptation:

- Convert staged pipelines into durable cognitive workflows.
- Replace filesystem-first persistence with event-sourced workflow state.
- Treat simulation events as cognition events.

## Hermes Agent

Use for:

- Persistent agent loop.
- Tool execution lifecycle.
- Memory and session persistence.
- Prompt/context compression.
- Gateway and multi-surface runtime.
- Scheduling and recurring actions.

COS adaptation:

- Lift agent-loop patterns into cognitive unit runtime.
- Convert memory writes into memory mutations.
- Add capability envelopes and context leases around tools and memory.

## OpenMAIC

Use for:

- Classroom generation pipeline.
- Live director orchestration.
- Streaming events to UI.
- Scene/content generation.
- Multimodal learning flows.

COS adaptation:

- Use orchestration cells instead of a single director.
- Treat classroom state as world-state graph projections.
- Convert streaming events into UCB-compatible cognitive events.

## Paperclip

Use for:

- AI-native control plane.
- Issues, goals, ownership, and heartbeats.
- Budget and governance semantics.
- Recovery for stalled execution.
- Adapter/plugin boundary design.

COS adaptation:

- Translate company control-plane semantics into cognitive control-plane services.
- Use heartbeat and recovery ideas for agent pod lifecycle.
- Use issue ownership patterns for workflow accountability.

## pi

Use for:

- Minimal evented agent harness.
- Provider abstraction.
- Skills and extensions.
- Session persistence.
- RPC/SDK boundaries.

COS adaptation:

- Use minimal composability as a guard against overbuilt early infrastructure.
- Adapt extension discovery into capability registry patterns.
- Adapt session tree ideas into replayable cognitive timelines.

