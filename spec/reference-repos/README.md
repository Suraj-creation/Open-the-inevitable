# Reference Repository Learning Layer

Reference repositories are part of the architecture learning substrate. Future implementation should inspect them for proven patterns, then adapt those patterns into The Inevitable's COS architecture rather than copying blindly.

## Current Local References

| Path | Learning Focus |
|---|---|
| `MiroFish/` | Staged simulation pipeline, graph building, profile generation, background simulation, report generation |
| `hermes-agent/` | Persistent agent loop, memory, tools, skills, gateway integrations, scheduling, multi-surface runtime |
| `OpenMAIC/` | Classroom generation, scene runtime, live orchestration, SSE/streaming, multimodal education flows |
| `paperclip/` | AI-native control plane, companies, agents, issues, heartbeats, budgets, governance |
| `pi/` | Modular agent runtime primitives, evented loop, provider abstraction, extensions, skills, sessions |
| `spec/vision-application/` | Internal reference corpus for outcome vision, philosophy, product direction, and constraints |

`spec/vision-application/referenceRepos.md` currently documents five external repositories. If a sixth external reference repository is restored or added, update this file and the persistent agent instructions.

## Usage Rule

Before implementing a COS subsystem, check whether a reference repo already demonstrates a relevant pattern:

- Runtime loop quality: inspect `hermes-agent/` and `pi/`.
- Governance and execution semantics: inspect `paperclip/`.
- Domain pipeline design: inspect `MiroFish/` and `OpenMAIC/`.
- Education and classroom orchestration: inspect `OpenMAIC/`.

Record extracted patterns in `spec/research/` or an ADR before using them as architecture.

