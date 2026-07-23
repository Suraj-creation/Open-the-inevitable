/**
 * M10 T1 live smoke (ADR-0046) — the CODE modality flows through the real cognition pipeline. A TS
 * source is registered as `code`, canonicalized into construct regions, then the REAL canonicalizer
 * (Gemini) extracts an L2 semantic layer over those constructs — proving every M1–M9 capability
 * works over code with no downstream change (concepts, and therefore anchors/fusion/frontier/timeline).
 *
 * Run from the repo ROOT: `npx tsx apps/api/scripts/m10-code-smoke.ts` (needs GEMINI_API_KEY in .env).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GeminiModelRuntime } from "@inevitable/adapters";
import { InMemoryEventBus } from "@inevitable/events";
// world-state is not a declared dep of apps/api; import from source for this proof harness (the same
// workspace-resolution gotcha the M3/M6 smokes work around). Not shipped — a script, not the product.
import { WorldStateGraph, KnowledgeGraphEngine } from "../../../packages/world-state/src/index";
import {
  CodeReferenceAdapter,
  SourceEnvironmentStore,
  type SourceProvenance,
} from "@inevitable/source-environment";
import {
  MVP_AGENT_MANIFESTS,
  SourceCanonicalizationService,
  SourceCanonicalizerUnit,
  type CanonicalizerDispatch,
} from "@inevitable/product-cognition";

function loadEnv(): void {
  const file = resolve(process.cwd(), ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (k && process.env[k] === undefined) process.env[k] = v;
  }
}

const PROVENANCE: SourceProvenance = {
  origin: "upload",
  attributed_source: "m10-code-smoke",
  license_class: null,
  consent_ref: null,
};

const CODE = `// A tiny gradient-descent optimizer.
import { Loss } from "./loss";

export function gradient(loss: Loss, theta: number[]): number[] {
  return loss.grad(theta);
}

export class GradientDescent {
  constructor(private learningRate: number) {}

  step(loss: Loss, theta: number[]): number[] {
    const g = gradient(loss, theta);
    return theta.map((t, i) => t - this.learningRate * g[i]);
  }
}
`;

function fail(msg: string): never {
  console.error(`FAIL ${msg}`);
  process.exit(1);
}

function mkPacket(
  versionId: string,
  regions: readonly { path: string; kind: string; text: string }[],
): unknown {
  return {
    packet_id: `pkt-semantic-code`,
    schema_version: "1.0.0",
    source_cid: "cog-smoke",
    target_cid: "agent.canonicalizer",
    tenant_id: null,
    session_id: null,
    causation_id: null,
    correlation_id: null,
    timestamp: "2026-07-17T00:00:00Z",
    hlc: "0000000000000001-00000000-smoke",
    sequence_number: 0,
    packet_type: "request",
    intent: "canonicalize-semantic",
    concept_ids: [],
    domain_ids: [],
    content: {
      layer: "semantic",
      version_id: versionId,
      regions: regions.map((r) => ({ path: r.path, kind: r.kind, text: r.text })),
      intent_lease_id: "lease-smoke",
    },
    evidence: [],
    confidence: 1,
    uncertainty_estimate: 0,
    reasoning_depth: 0,
    classification: "internal",
    policy_tags: [],
    requires_human_review: false,
    priority: 4,
    expiry: null,
  };
}

async function main(): Promise<void> {
  loadEnv();
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) fail("GEMINI_API_KEY not set (repo-root .env)");
  const connected = await GeminiModelRuntime.connect({ apiKey });
  if (!connected.ok) fail(`Gemini connect failed: ${connected.error.message}`);
  const model = connected.value;

  const bus = new InMemoryEventBus();
  const store = new SourceEnvironmentStore({ bus, nodeId: "m10-smoke" });
  store.registerAdapter(new CodeReferenceAdapter());
  const version = await store.registerVersion({
    modality: "code",
    content: CODE,
    provenance: PROVENANCE,
  });
  if (!version.ok) fail(version.error.message);
  const canon = await store.canonicalize(version.value.version_id);
  if (!canon.ok) fail(canon.error.message);

  const structural = store.layer(version.value.version_id, "structural");
  const regions = (
    structural?.content as { regions: { path: string; kind: string; text: string }[] }
  ).regions;
  const constructs = regions.filter((r) => r.kind === "heading").map((r) => r.text);
  console.log(`1 CANONICALIZED code: usable=${canon.value.usable} | regions=${regions.length}`);
  console.log(`   constructs: ${constructs.join(" | ")}`);

  const world = new WorldStateGraph();
  const kg = new KnowledgeGraphEngine(world);
  const canonManifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.canonicalizer")!;
  const canonUnit = new SourceCanonicalizerUnit({ manifest: canonManifest, model });
  const dispatch: CanonicalizerDispatch = async (input) => {
    const emissions = await canonUnit.execute(mkPacket(input.versionId, input.regions) as never);
    const out = emissions.packets?.[0];
    if (!out) fail("canonicalizer produced no packet");
    return { ok: true, value: out } as never;
  };
  const service = new SourceCanonicalizationService({ store, dispatch, kg });
  const semantic = await service.canonicalizeSemantic(version.value.version_id);
  if (!semantic.ok) fail(semantic.error.message);

  console.log(
    `2 SEMANTIC (L2 over code): degraded=${semantic.value.degraded} | concepts=${semantic.value.conceptsExtracted} | KG=${semantic.value.conceptsBoundToKg} | anchors=${semantic.value.anchorsCreated}`,
  );
  const semLayer = store.layer(version.value.version_id, "semantic");
  const concepts = (semLayer?.content as { concepts?: { label: string }[] })?.concepts ?? [];
  for (const c of concepts) console.log(`   • ${c.label}`);

  if (constructs.length < 2) fail("expected ≥2 code constructs parsed");
  if (semantic.value.conceptsExtracted === 0) fail("no concepts extracted over code");
  console.log(
    semantic.value.degraded
      ? "M10 CODE LIVE SMOKE: constructs + pipeline PASSED (semantic degraded — honest)"
      : "M10 CODE LIVE SMOKE: PASSED (code → constructs → real L2 concepts, degraded:false)",
  );
}

main().catch((cause) => {
  console.error("FAIL", cause);
  process.exit(1);
});
