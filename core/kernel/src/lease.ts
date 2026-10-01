import { defineKind, int, shape, str } from "./kinds.js";

/** A stream's ownership changes by appending `lease.claimed`, atomically with the fence bump. */
export interface LeaseClaimed {
  readonly owner: string;
  readonly token: number;
}

export const LEASE_KINDS = [defineKind("lease.claimed", 1, shape({ owner: str, token: int }))];
