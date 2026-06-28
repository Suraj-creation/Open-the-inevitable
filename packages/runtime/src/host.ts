/**
 * CognitiveUnitHost — drives a {@link CognitiveUnit} through the lifecycle FSM and emits the
 * `agent.*` lifecycle events to the bus, so every transition is observable and replayable.
 * Spec: spec/runtime/cognitive-unit-runtime.md (lifecycle table + observability hooks).
 */
import {
  type Clock,
  type Hlc,
  type IdGenerator,
  SystemClock,
  CryptoIdGenerator,
  hlcInit,
} from "@inevitable/shared";
import { type EventBus, createEvent } from "@inevitable/events";
import type { CognitiveIdentity, CognitionPacket, ContextLease } from "@inevitable/protocols";
import type { Logger } from "@inevitable/observability";
import { LifecycleMachine, type UnitLifecycleState } from "./lifecycle";
import type { CognitiveUnit, Emissions } from "./abi";

export interface UnitHostDeps {
  bus: EventBus;
  clock?: Clock;
  idGenerator?: IdGenerator;
  nodeId?: string;
  logger?: Logger;
}

export class CognitiveUnitHost {
  readonly lifecycle = new LifecycleMachine("Registered");
  private readonly bus: EventBus;
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;
  private readonly logger: Logger | undefined;
  private hlc: Hlc;

  constructor(
    private readonly unit: CognitiveUnit,
    private readonly identity: CognitiveIdentity,
    deps: UnitHostDeps,
  ) {
    this.bus = deps.bus;
    this.clock = deps.clock ?? new SystemClock();
    this.idGenerator = deps.idGenerator ?? new CryptoIdGenerator();
    this.logger = deps.logger;
    this.hlc = hlcInit(deps.nodeId ?? identity.cid);
  }

  get state(): UnitLifecycleState {
    return this.lifecycle.current;
  }

  /** Registered -> Admitted -> Scheduled -> Hydrating -> Ready, optionally hydrating from a lease. */
  async activate(lease?: ContextLease): Promise<void> {
    await this.emit("agent.registered", {});
    this.transitionOrThrow("Admitted");
    this.transitionOrThrow("Scheduled");
    this.transitionOrThrow("Hydrating");
    if (lease) await this.unit.prepare(lease);
    this.transitionOrThrow("Ready");
    await this.emit("agent.ready", { capabilities: this.unit.describe().capabilities });
  }

  /** Execute a packet: Ready -> Executing -> Publishing -> Ready, publishing emitted events. */
  async handle(packet: CognitionPacket): Promise<Emissions> {
    if (this.lifecycle.current !== "Ready") {
      throw new Error(`Unit ${this.identity.cid} not Ready (state=${this.lifecycle.current})`);
    }
    this.transitionOrThrow("Executing");
    await this.emit("agent.executing", { packet_id: packet.packet_id });

    let emissions: Emissions;
    try {
      emissions = await this.unit.execute(packet);
    } catch (error) {
      this.transitionOrThrow("Recovering");
      await this.emit("agent.failed", {
        packet_id: packet.packet_id,
        error: error instanceof Error ? error.message : String(error),
      });
      this.transitionOrThrow("Quarantined");
      await this.emit("agent.quarantined", { reason: "execute threw" });
      throw error;
    }

    for (const event of emissions.events ?? []) {
      await this.bus.publish(event);
    }

    // Publish the unit's reasoning trace as the `outcome` of its observability contract
    // (reasoning.* family, recorded-observation). Only when the unit produced one — deterministic
    // stub units emit none. Spec: spec/protocols/cognitive-unit-abi.md (Event and State Transitions).
    if (emissions.trace) {
      await this.emit("reasoning.completed", {
        packet_id: packet.packet_id,
        trace: emissions.trace,
      });
    }

    this.transitionOrThrow("Publishing");
    await this.emit("agent.completed", {
      packet_id: packet.packet_id,
      emitted_packets: (emissions.packets ?? []).length,
    });
    this.transitionOrThrow("Ready");
    return emissions;
  }

  async retire(reason: string): Promise<void> {
    await this.unit.shutdown(reason);
    if (this.lifecycle.canTransition("Retired")) {
      this.transitionOrThrow("Retired");
    }
    await this.emit("agent.retired", { reason });
  }

  async quarantine(reason: string): Promise<void> {
    if (this.lifecycle.canTransition("Quarantined")) {
      this.transitionOrThrow("Quarantined");
    }
    await this.emit("agent.quarantined", { reason });
  }

  private transitionOrThrow(to: UnitLifecycleState): void {
    const result = this.lifecycle.transition(to);
    if (!result.ok) throw result.error;
  }

  private async emit(eventType: string, payload: Record<string, unknown>): Promise<void> {
    const { event, hlc } = createEvent(
      {
        eventType,
        producerCid: this.identity.cid,
        producerType: this.identity.unit_type,
        payload: { cid: this.identity.cid, ...payload },
      },
      { clock: this.clock, hlc: this.hlc, idGenerator: this.idGenerator },
    );
    this.hlc = hlc;
    this.logger?.debug(`lifecycle ${eventType}`, { cid: this.identity.cid });
    await this.bus.publish(event);
  }
}
