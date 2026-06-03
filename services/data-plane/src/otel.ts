/**
 * OpenTelemetry SDK bootstrap — the edge wiring. COS libraries instrument with the OTel *API* only
 * (`@inevitable/observability`); this is the single place a concrete SDK + exporter is registered.
 * The SDK is dependency-optional (loaded via guarded dynamic import), so without it the process
 * degrades to the OTel no-op tracer and the workspace still verifies offline.
 * Spec: spec/telemetry/otel-edge.md, ADR-0003.
 */
import { loadOptional } from "@inevitable/adapters";

export interface OtelHandle {
  /** Whether a concrete SDK was registered (false → no-op API tracer). */
  readonly active: boolean;
  shutdown(): Promise<void>;
}

interface NodeSdkLike {
  start(): void;
  shutdown(): Promise<void>;
}
interface SdkModule {
  NodeSDK: new (config: Record<string, unknown>) => NodeSdkLike;
}

export interface OtelConfig {
  serviceName?: string;
  /** Extra NodeSDK config (exporters, resource, instrumentations) supplied at the deployment edge. */
  sdkConfig?: Record<string, unknown>;
}

/** Register the OTel Node SDK if installed; otherwise return an inert handle (no-op tracer). */
export async function bootstrapOtel(config: OtelConfig = {}): Promise<OtelHandle> {
  const mod = await loadOptional<SdkModule>("@opentelemetry/sdk-node");
  if (!mod) {
    return { active: false, shutdown: () => Promise.resolve() };
  }
  const sdk = new mod.NodeSDK({
    serviceName: config.serviceName ?? "cos-data-plane",
    ...config.sdkConfig,
  });
  sdk.start();
  return { active: true, shutdown: () => sdk.shutdown() };
}
