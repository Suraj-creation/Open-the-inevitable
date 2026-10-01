export * from "./canonical.js";
export * from "./record.js";
export * from "./kinds.js";
export * from "./store.js";
export * from "./clock.js";
export * from "./effects.js";
export * from "./authority.js";
export * from "./lease.js";
export * from "./conformance.js";

import { AUTHORITY_KINDS } from "./authority.js";
import { EFFECT_KINDS } from "./effects.js";
import type { KindSpec } from "./kinds.js";
import { LEASE_KINDS } from "./lease.js";

/** Every record kind the kernel defines. Higher layers extend a registry built from these. */
export const KERNEL_KINDS: readonly KindSpec[] = [
  ...LEASE_KINDS,
  ...EFFECT_KINDS,
  ...AUTHORITY_KINDS,
];
