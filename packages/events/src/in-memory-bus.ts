/**
 * In-memory, replay-safe Universal Cognitive Bus. The append-only log is the source of truth;
 * `replay()` yields events in deterministic sequence order. Suitable for tests, local dev, and as
 * the reference semantics a NATS/Kafka adapter must preserve (ADR-0003).
 */
import { newPacketId, type IdGenerator, CryptoIdGenerator } from "@inevitable/shared";
import { SCHEMA_IDS, defaultValidator } from "@inevitable/protocols";
import type { CognitiveEvent } from "@inevitable/protocols";
import {
  type EventBus,
  type EventHandler,
  type Subscription,
  type SubscribeOptions,
  type PublishResult,
  type ReplayOptions,
  type BusGovernanceInterceptor,
} from "./bus";
import { matchSubject } from "./subject";
import { DeadLetterQueue } from "./dead-letter";

interface Registered {
  readonly consumerName: string;
  readonly subject: string;
  readonly handler: EventHandler;
}

export interface InMemoryBusOptions {
  validate?: boolean;
  governance?: BusGovernanceInterceptor;
  deadLetter?: DeadLetterQueue;
  /** Handler retry attempts before dead-lettering a delivery. */
  maxDeliveryAttempts?: number;
  idGenerator?: IdGenerator;
}

export class InMemoryEventBus implements EventBus {
  private readonly events: CognitiveEvent[] = [];
  private readonly subscribers = new Map<string, Registered>();
  private readonly validate: boolean;
  private readonly governance: BusGovernanceInterceptor | undefined;
  private readonly deadLetter: DeadLetterQueue;
  private readonly maxDeliveryAttempts: number;
  private readonly idGenerator: IdGenerator;
  private sequence = 0;

  constructor(options: InMemoryBusOptions = {}) {
    this.validate = options.validate ?? true;
    this.governance = options.governance;
    this.deadLetter = options.deadLetter ?? new DeadLetterQueue();
    this.maxDeliveryAttempts = Math.max(1, options.maxDeliveryAttempts ?? 1);
    this.idGenerator = options.idGenerator ?? new CryptoIdGenerator();
  }

  get log(): readonly CognitiveEvent[] {
    return this.events;
  }

  get deadLetterQueue(): DeadLetterQueue {
    return this.deadLetter;
  }

  async publish(event: CognitiveEvent): Promise<PublishResult> {
    if (this.validate) {
      const result = defaultValidator.validate(SCHEMA_IDS.cognitiveEvent, event);
      if (!result.ok) {
        this.deadLetter.add({
          event,
          reason: "schema-invalid",
          detail: result.error.message,
          attempts: 0,
        });
        return { status: "invalid", reason: result.error.message };
      }
    }

    let effective = event;
    let status: PublishResult["status"] = "published";

    if (this.governance) {
      const decision = await this.governance.evaluate(effective, "publish");
      if (decision.decision === "block") {
        this.deadLetter.add({
          event: effective,
          reason: "governance-blocked",
          detail: decision.reason ?? "blocked by governance",
          attempts: 0,
        });
        return { status: "blocked", reason: decision.reason };
      }
      if (decision.decision === "modify" && decision.modifiedEvent) {
        effective = decision.modifiedEvent;
        status = "modified";
      }
    }

    const seq = this.sequence++;
    const stored: CognitiveEvent = { ...effective, sequence: seq };
    this.events.push(stored);

    for (const sub of this.subscribers.values()) {
      if (!matchSubject(sub.subject, stored.event_type)) continue;
      if (this.governance) {
        const decision = await this.governance.evaluate(stored, "subscribe");
        if (decision.decision === "block") continue;
      }
      await this.deliver(sub, stored);
    }

    return { status, sequence: seq, event: stored };
  }

  private async deliver(sub: Registered, event: CognitiveEvent): Promise<void> {
    let lastError = "";
    for (let attempt = 1; attempt <= this.maxDeliveryAttempts; attempt++) {
      try {
        await sub.handler(event);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
    this.deadLetter.add({
      event,
      reason: "handler-failed",
      detail: `consumer ${sub.consumerName}: ${lastError}`,
      attempts: this.maxDeliveryAttempts,
    });
  }

  subscribe(subject: string, handler: EventHandler, options: SubscribeOptions = {}): Subscription {
    const consumerName = options.consumerName ?? `consumer-${newPacketId(this.idGenerator)}`;
    this.subscribers.set(consumerName, { consumerName, subject, handler });
    return {
      consumerName,
      unsubscribe: () => {
        this.subscribers.delete(consumerName);
      },
    };
  }

  replay(options: ReplayOptions = {}): CognitiveEvent[] {
    const from = options.fromSequence ?? 0;
    return this.events.filter((event) => {
      if ((event.sequence ?? 0) < from) return false;
      if (options.subject !== undefined && !matchSubject(options.subject, event.event_type)) {
        return false;
      }
      if (options.predicate && !options.predicate(event)) return false;
      return true;
    });
  }
}
