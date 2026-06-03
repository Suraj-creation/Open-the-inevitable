/**
 * Data-plane entrypoint. `pnpm --filter @inevitable/data-plane start` (tsx) boots the OTel SDK (if
 * provisioned at the edge) and the bus→telemetry bridge. Install `@opentelemetry/sdk-node` and an
 * exporter in the deployment image to activate real telemetry; otherwise it runs with the no-op tracer.
 */
import { createDataPlane } from "./index";

const plane = await createDataPlane({ serviceName: "cos-data-plane" });

console.log(
  JSON.stringify({
    service: "data-plane",
    status: "started",
    otelActive: plane.otel.active,
  }),
);
