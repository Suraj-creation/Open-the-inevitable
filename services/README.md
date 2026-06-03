# Services

Deployable cognitive OS services live here.

Services should compose packages and expose durable runtime behavior. They should not create private architecture outside the spec system.

## Service Boundaries

- `control-plane/` - topology, registry, policy propagation, admission, rollout, and governance coordination.
- `data-plane/` - cognitive execution, event flow, model/tool calls, memory operations, and streaming runtime.

