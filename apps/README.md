# Apps

User-facing and API-facing surfaces live here.

This folder should remain thin. Apps should call into `packages/` and `services/` rather than owning core cognition, orchestration, memory, governance, or protocol logic.

## Planned Surfaces

- `apps/api/` - public API, developer API, and gateway surface.
- `apps/web/` - operator, learner, and cognitive observability UI.

