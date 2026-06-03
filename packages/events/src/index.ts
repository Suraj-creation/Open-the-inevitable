/**
 * @inevitable/events — event-sourced cognition substrate.
 * Spec: spec/events/event-taxonomy.md, spec/protocols/cognitive-event-protocol.md,
 *       spec/communication/universal-cognitive-bus.md.
 */
export { matchSubject, familyOf } from "./subject";

export type {
  CreateEventInput,
  EventFactoryDeps,
  CreatedEvent,
  EventClassification,
  ReplayBehavior,
} from "./event-factory";
export { createEvent, validateEvent } from "./event-factory";

export {
  DEFAULT_EVENT_FAMILIES,
  EventFamilyRegistry,
  defaultFamilyRegistry,
} from "./family-registry";

export type { DeadLetter, DeadLetterReason } from "./dead-letter";
export { DeadLetterQueue } from "./dead-letter";

export type {
  EventBus,
  EventHandler,
  Subscription,
  SubscribeOptions,
  PublishResult,
  PublishStatus,
  ReplayOptions,
  GovernanceDirection,
  BusGovernanceDecision,
  BusGovernanceInterceptor,
} from "./bus";

export type { InMemoryBusOptions } from "./in-memory-bus";
export { InMemoryEventBus } from "./in-memory-bus";
