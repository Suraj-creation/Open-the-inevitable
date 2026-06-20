/**
 * Universal Cognitive Bus contract. Every important cognitive action flows through here so it
 * is observable, replayable, and governable. Spec: spec/communication/universal-cognitive-bus.md,
 * spec/protocols/cognitive-event-protocol.md.
 */
import type { CognitiveEvent } from "@inevitable/protocols";

export type GovernanceDirection = "publish" | "subscribe";

export interface BusGovernanceDecision {
  readonly decision: "allow" | "block" | "modify";
  readonly modifiedEvent?: CognitiveEvent;
  readonly reason?: string;
}

/** Bus-level governance interceptor: evaluated on every publish and every delivery. */
export interface BusGovernanceInterceptor {
  evaluate(
    event: CognitiveEvent,
    direction: GovernanceDirection,
  ): BusGovernanceDecision | Promise<BusGovernanceDecision>;
}

export type EventHandler = (event: CognitiveEvent) => void | Promise<void>;

export interface Subscription {
  readonly consumerName: string;
  unsubscribe(): void;
}

export interface SubscribeOptions {
  consumerName?: string;
}

export type PublishStatus = "published" | "modified" | "blocked" | "invalid";

export interface PublishResult {
  readonly status: PublishStatus;
  readonly sequence?: number;
  readonly reason?: string;
  readonly event?: CognitiveEvent;
}

export interface ReplayOptions {
  fromSequence?: number;
  subject?: string;
  predicate?: (event: CognitiveEvent) => boolean;
}

export interface EventBus {
  publish(event: CognitiveEvent): Promise<PublishResult>;
  subscribe(subject: string, handler: EventHandler, options?: SubscribeOptions): Subscription;
  replay(options?: ReplayOptions): CognitiveEvent[];
  /**
   * Load previously-published events into the log WITHOUT re-delivery, validation, or governance —
   * for reconstructing a session from a durable log (DPS-002). The events were already governed and
   * validated at first publish; re-publishing would re-run side effects. Advances the sequence past
   * the loaded maximum so subsequently-published events do not collide. Only valid on an empty bus.
   */
  hydrate(events: readonly CognitiveEvent[]): void;
  readonly log: readonly CognitiveEvent[];
}
