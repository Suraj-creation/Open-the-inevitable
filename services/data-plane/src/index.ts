/**
 * @inevitable/data-plane — cognitive data-plane edge service.
 * Registers the OpenTelemetry SDK (dependency-optional) and bridges the Universal Cognitive Bus to
 * OTel spans/metrics, so every event flowing through the data plane is observable at the edge.
 * Spec: spec/telemetry/otel-edge.md, spec/data-plane/.
 */
import { InMemoryEventBus, type EventBus, type Subscription } from "@inevitable/events";
import type { ObservabilitySink } from "@inevitable/contracts";
import { type OtelHandle, type OtelConfig, bootstrapOtel } from "./otel";
import { OtelObservabilitySink } from "./otel-sink";

export type { OtelHandle, OtelConfig } from "./otel";
export { bootstrapOtel } from "./otel";
export { OtelObservabilitySink } from "./otel-sink";

/** Subscribe an ObservabilitySink to every event on the bus (the bus→telemetry bridge). */
export function bridgeBusToSink(bus: EventBus, sink: ObservabilitySink): Subscription {
  return bus.subscribe(">", (event) => sink.trace(event), { consumerName: "otel-sink" });
}

export interface DataPlane {
  readonly bus: EventBus;
  readonly sink: ObservabilitySink;
  readonly otel: OtelHandle;
  readonly bridge: Subscription;
  shutdown(): Promise<void>;
}

/** Assemble the data-plane: OTel SDK + bus + sink + bridge. */
export async function createDataPlane(config: OtelConfig = {}): Promise<DataPlane> {
  const otel = await bootstrapOtel(config);
  const bus = new InMemoryEventBus();
  const sink = new OtelObservabilitySink(config.serviceName);
  const bridge = bridgeBusToSink(bus, sink);
  return {
    bus,
    sink,
    otel,
    bridge,
    shutdown: async () => {
      bridge.unsubscribe();
      await otel.shutdown();
    },
  };
}
