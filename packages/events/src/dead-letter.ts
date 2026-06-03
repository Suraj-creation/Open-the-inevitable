/**
 * Dead-letter handling. Events that fail validation, are blocked by governance, or whose
 * handlers throw beyond retry are quarantined here for triage rather than silently dropped.
 * Spec: spec/communication/universal-cognitive-bus.md (§Bus Failure Behavior).
 */
import type { CognitiveEvent } from "@inevitable/protocols";

export type DeadLetterReason =
  | "schema-invalid"
  | "governance-blocked"
  | "handler-failed"
  | "unregistered-family";

export interface DeadLetter {
  readonly event: CognitiveEvent;
  readonly reason: DeadLetterReason;
  readonly detail: string;
  readonly attempts: number;
}

export class DeadLetterQueue {
  private readonly items: DeadLetter[] = [];

  add(entry: DeadLetter): void {
    this.items.push(entry);
  }

  list(): readonly DeadLetter[] {
    return this.items;
  }

  size(): number {
    return this.items.length;
  }

  drain(): DeadLetter[] {
    return this.items.splice(0, this.items.length);
  }
}
