/**
 * Typed COS error hierarchy. Every error carries a stable `code` and an optional `specRef`
 * so failures trace back to the governing spec (spec/meta/implementation-traceability.md).
 */
export interface CosErrorOptions {
  cause?: unknown;
  specRef?: string;
  details?: Record<string, unknown>;
}

export class CosError extends Error {
  readonly code: string;
  readonly specRef: string | undefined;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: string, message: string, options: CosErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.code = code;
    this.specRef = options.specRef;
    this.details = options.details;
  }
}

/** A protocol payload failed schema validation. Spec: spec/protocols/*. */
export class ProtocolValidationError extends CosError {
  constructor(message: string, options: CosErrorOptions = {}) {
    super("E_PROTOCOL_VALIDATION", message, options);
  }
}

/** A syscall/action was denied by a capability envelope. Spec: spec/kernel/capability-envelope.md. */
export class CapabilityDeniedError extends CosError {
  constructor(message: string, options: CosErrorOptions = {}) {
    super("E_CAPABILITY_DENIED", message, options);
  }
}

/** A context or intent lease was expired or revoked. Spec: spec/kernel/context-lease.md. */
export class LeaseInvalidError extends CosError {
  constructor(message: string, options: CosErrorOptions = {}) {
    super("E_LEASE_INVALID", message, options);
  }
}

/** Governance blocked an action or event. Spec: spec/kernel/governance-kernel.md. */
export class GovernanceBlockedError extends CosError {
  constructor(message: string, options: CosErrorOptions = {}) {
    super("E_GOVERNANCE_BLOCKED", message, options);
  }
}

/** An unrecoverable kernel-state inconsistency. Spec: spec/kernel-internals/cognition-syscalls.md. */
export class KernelPanicError extends CosError {
  constructor(message: string, options: CosErrorOptions = {}) {
    super("E_KERNEL_PANIC", message, options);
  }
}

/** A referenced entity (CID, lease, schema, …) was not found. */
export class NotFoundError extends CosError {
  constructor(message: string, options: CosErrorOptions = {}) {
    super("E_NOT_FOUND", message, options);
  }
}

/** An invalid lifecycle/state transition was attempted. Spec: spec/runtime/cognitive-unit-runtime.md. */
export class InvalidTransitionError extends CosError {
  constructor(message: string, options: CosErrorOptions = {}) {
    super("E_INVALID_TRANSITION", message, options);
  }
}
