# Runtime Index

Runtime domains:

- `runtime/`
- `agent-runtime/`
- `execution/`
- `scheduler/`
- `kernel-internals/`
- `control-plane/`
- `data-plane/`

Runtime primitives to specify before implementation:

- Cognitive unit.
- Cognitive process.
- Cognitive thread.
- Capability envelope.
- Context lease.
- Intent lease.
- Lifecycle state machine.
- Checkpoint.
- Replay boundary.

## Canonical Specs (Phase 1B)

- Cognitive unit runtime + lifecycle FSM + manifest → [runtime/cognitive-unit-runtime.md](../runtime/cognitive-unit-runtime.md)
- Cognitive unit ABI (plug-in contract) → [protocols/cognitive-unit-abi.md](../protocols/cognitive-unit-abi.md)
- Syscall surface, privilege rings, traps, panic → [kernel-internals/cognition-syscalls.md](../kernel-internals/cognition-syscalls.md)
- Scheduler → [kernel/cognitive-scheduler.md](../kernel/cognitive-scheduler.md)
- Identity / capability envelope / context lease / intent lease → [kernel/](../kernel/)

Pending (Phase 1D+): cognitive threading/fibers, deterministic execution engine, runtime
virtualization/hypervisor, hot-state migration.

