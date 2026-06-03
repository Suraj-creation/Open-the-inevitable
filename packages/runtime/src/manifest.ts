/**
 * Agent manifest loading + validation. A unit cannot be admitted without a schema-valid manifest
 * (architecture law: no runtime without manifest + identity + capability envelope).
 * Spec: spec/runtime/cognitive-unit-runtime.md.
 */
import { type Result, ok, err, ProtocolValidationError } from "@inevitable/shared";
import { type AgentManifest, SCHEMA_IDS, defaultValidator } from "@inevitable/protocols";
import { isAbiCompatible, ABI_VERSION } from "./abi";

export function loadManifest(input: unknown): Result<AgentManifest, ProtocolValidationError> {
  const result = defaultValidator.validate<AgentManifest>(SCHEMA_IDS.agentManifest, input);
  if (!result.ok) return result;
  const manifest = result.value;
  if (!isAbiCompatible(manifest.abi_version, ABI_VERSION)) {
    return err(
      new ProtocolValidationError(
        `Manifest ${manifest.id} declares ABI ${manifest.abi_version}, incompatible with runtime ABI ${ABI_VERSION}`,
        { specRef: "spec/protocols/cognitive-unit-abi.md" },
      ),
    );
  }
  return ok(manifest);
}
