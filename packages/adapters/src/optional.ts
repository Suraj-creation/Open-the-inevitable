/**
 * Guarded dynamic loading of optional client libraries. Heavy backend clients (nats, pg, neo4j-driver,
 * @qdrant/js-client-rest) are NOT workspace dependencies — they are provisioned at the deployment edge
 * and loaded here via a dynamic import with a variable specifier, so the workspace typechecks, lints,
 * and tests offline. Absent client → `undefined`, and the adapter returns a typed error. ADR-0005 §3.
 */
import { type Result, CosError, ok, err } from "@inevitable/shared";

/** Attempt to load an optional module by name. Returns `undefined` if it is not installed. */
export async function loadOptional<T = unknown>(specifier: string): Promise<T | undefined> {
  try {
    const mod = await import(specifier);
    return mod as T;
  } catch {
    return undefined;
  }
}

/** Wrap optional loading in a Result with a stable, traceable error code. */
export async function requireOptional<T = unknown>(
  specifier: string,
): Promise<Result<T, CosError>> {
  const mod = await loadOptional<T>(specifier);
  if (!mod) {
    return err(
      new CosError(
        "E_ADAPTER_UNAVAILABLE",
        `Optional client '${specifier}' is not installed; provision it at the deployment edge`,
        { specRef: "interop/infrastructure-adapters", details: { specifier } },
      ),
    );
  }
  return ok(mod);
}
