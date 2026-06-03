/**
 * Spec traceability helper. Every foundational artifact should be linkable to its governing
 * spec (spec/meta/implementation-traceability.md). Attaching a {@link SpecRef} keeps the
 * Vision → Spec → Contract → Implementation chain machine-checkable.
 */
export interface SpecRef {
  /** Spec path relative to repo root, e.g. "spec/kernel/cognitive-identity.md". */
  readonly spec: string;
  /** Optional section anchor, e.g. "Primitives". */
  readonly section?: string;
  /** Optional related ADR id, e.g. "ADR-0003". */
  readonly adr?: string;
}

export function specRef(spec: string, extra: { section?: string; adr?: string } = {}): SpecRef {
  return {
    spec,
    ...(extra.section !== undefined ? { section: extra.section } : {}),
    ...(extra.adr !== undefined ? { adr: extra.adr } : {}),
  };
}
