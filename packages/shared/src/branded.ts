/**
 * Branded (nominal) types. A `Brand<T, B>` is structurally `T` at runtime but distinct
 * at the type level, so a `Cid` cannot be passed where a `PacketId` is expected.
 *
 * Spec: spec/kernel/cognitive-identity.md (identifiers must be typed, not bare strings).
 */
declare const brand: unique symbol;

export type Brand<T, B extends string> = T & { readonly [brand]: B };
