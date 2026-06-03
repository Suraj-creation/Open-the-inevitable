# Phase 1A - Spec Infrastructure Roadmap

## Goal

Establish the spec ecosystem before kernel implementation begins.

## Scope

- Complete required spec folders.
- Create meta-spec governance.
- Create retrieval-oriented indexes.
- Create reference-repo learning layer.
- Create ADR system.
- Define implementation traceability.

## Completed in This Setup Pass

- Spec folder skeleton.
- `spec/meta/` governance files.
- `spec/indexes/` retrieval indexes.
- `spec/reference-repos/README.md`.
- Initial ADRs.
- Root `spec/README.md`.
- Root implementation skeleton across `apps/`, `packages/`, `services/`, `infrastructure/`, `tests/`, and `tools/`.
- Boundary README files for each top-level implementation area.

## Next Steps

Phase 1A's enumerated next steps are complete (delivered in Phase 1B, 2026-06-02):

1. [x] `kernel-internals/cognition-syscalls.md`
2. [x] `protocols/cognitive-event-protocol.md`
3. [x] `protocols/cognition-packet-protocol.md`
4. [x] `runtime/cognitive-unit-runtime.md`
5. [x] `events/event-taxonomy.md`
6. [x] `architecture-decisions/ADR-0003-tech-stack.md`
7. Package contracts deferred to Phase 1C — see [phase-1b-kernel-protocols-runtime.md](phase-1b-kernel-protocols-runtime.md).

The project has advanced to **Phase 1B**. See the
[Phase 1B roadmap](phase-1b-kernel-protocols-runtime.md). Do not begin broad application
implementation until Phase 1C package contracts are scaffolded from the approved Phase 1B specs.
