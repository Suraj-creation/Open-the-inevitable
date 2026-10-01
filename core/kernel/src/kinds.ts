import type { Draft } from "./record.js";

/**
 * A record kind at one version, with the validator that guards it at write time. Validation happens
 * when a record is appended, never when it is read: a record that exists is a record that was valid.
 */
export interface KindSpec {
  readonly kind: string;
  readonly v: number;
  /** Returns human-readable violations; empty means valid. */
  validate(data: unknown): string[];
}

export function defineKind(
  kind: string,
  v: number,
  validate: (data: unknown) => string[],
): KindSpec {
  return { kind, v, validate };
}

/**
 * The set of kinds a store will accept. Unknown `kind@v` is rejected at write and fails closed at
 * read, so a record can never be silently misinterpreted by code that does not understand it.
 */
export class KindRegistry {
  private readonly specs = new Map<string, KindSpec>();

  constructor(specs: readonly KindSpec[] = []) {
    for (const spec of specs) this.register(spec);
  }

  register(spec: KindSpec): this {
    const key = `${spec.kind}@${spec.v}`;
    if (this.specs.has(key)) throw new Error(`kind ${key} registered twice`);
    this.specs.set(key, spec);
    return this;
  }

  extend(specs: readonly KindSpec[]): KindRegistry {
    return new KindRegistry([...this.specs.values(), ...specs]);
  }

  has(kind: string, v: number): boolean {
    return this.specs.has(`${kind}@${v}`);
  }

  validate(draft: Draft): string[] {
    const spec = this.specs.get(`${draft.kind}@${draft.v}`);
    if (!spec) return [`unknown kind ${draft.kind}@${draft.v}`];
    return spec.validate(draft.data).map((e) => `${draft.kind}@${draft.v}: ${e}`);
  }
}

// Small validation helpers shared by kind definitions. Each returns violations for one field.

export type Check = (value: unknown, path: string) => string[];

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const str: Check = (v, p) =>
  typeof v === "string" && v.length > 0 ? [] : [`${p} must be a non-empty string`];
export const optStr: Check = (v, p) => (v === undefined ? [] : str(v, p));
export const int: Check = (v, p) => (Number.isInteger(v) ? [] : [`${p} must be an integer`]);
export const prob: Check = (v, p) =>
  typeof v === "number" && v >= 0 && v <= 1 ? [] : [`${p} must be a probability in [0,1]`];
export const oneOf =
  (...allowed: readonly string[]): Check =>
  (v, p) =>
    typeof v === "string" && allowed.includes(v)
      ? []
      : [`${p} must be one of ${allowed.join("|")}`];
export const arrayOf =
  (item: Check): Check =>
  (v, p) =>
    Array.isArray(v) ? v.flatMap((x, i) => item(x, `${p}[${i}]`)) : [`${p} must be an array`];
export const optional =
  (check: Check): Check =>
  (v, p) =>
    v === undefined ? [] : check(v, p);

/** Validate an object's fields; unknown fields are rejected so typos never become dead data. */
export function shape(fields: Record<string, Check>): (data: unknown) => string[] {
  return (data) => {
    if (!isRecord(data)) return ["data must be an object"];
    const errors = Object.entries(fields).flatMap(([key, check]) => check(data[key], key));
    for (const key of Object.keys(data)) if (!(key in fields)) errors.push(`unknown field ${key}`);
    return errors;
  };
}
