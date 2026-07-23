/**
 * CSE M9 T2 — the Claim Graph lit up in Source Fusion (CSE-006 §3.1, ADR-0041). Drives the gateway
 * SourceHub directly (the website backend path) with a fake model — no network, no key — proving:
 * register → per-source claim extraction → cross-source contradiction detection → the fused concept
 * carries each source's claims (traceable to its source) plus a genuine disagreement; and that with
 * a model that finds no conflict, fusion is honestly contradiction-free while claims still attach.
 */
import { describe, expect, it } from "vitest";
import type { ModelGenerationRequest, ModelGenerationResult } from "@inevitable/contracts";
import { SourceHub } from "../src/sources";

const MD_A =
  "# Gradient Descent\n\nGradient descent minimizes a loss function by stepping against the gradient.\n";
const MD_B =
  "# Gradient Descent\n\nGradient descent is an iterative optimization that follows the steepest downhill direction.\n";

/** extract → a claim about gradient-descent (statement varies by source text so the two differ). */
function extractText(prompt: string): string {
  const statement = prompt.includes("steepest downhill")
    ? "Gradient descent follows the steepest downhill direction."
    : "Gradient descent steps against the gradient to minimize loss.";
  return JSON.stringify({
    claims: [
      {
        statement,
        source_anchors: [],
        concept_refs: ["gradient-descent"],
        epistemic_status: "supported",
      },
    ],
  });
}

/** contrast → parse the claim ids in the prompt and contradict the first two from different sources. */
function contrastText(prompt: string, findConflict: boolean): string {
  if (!findConflict) return JSON.stringify({ contradictions: [] });
  const pairs = [...prompt.matchAll(/^(\S+) \[source (\S+)\]/gm)].map((m) => ({
    id: m[1] as string,
    sid: m[2] as string,
  }));
  const a = pairs[0];
  const b = pairs.find((p) => a && p.sid !== a.sid);
  const contradictions =
    a && b
      ? [
          {
            claim_id_a: a.id,
            claim_id_b: b.id,
            nature: "interpretive",
            rationale: "the sources frame gradient descent differently",
          },
        ]
      : [];
  return JSON.stringify({ contradictions });
}

/** synthesis → weave a prose explanation citing every source name offered in the prompt. */
function synthesisText(prompt: string): string {
  const titles = [...new Set([...prompt.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1] as string))];
  return JSON.stringify({
    prose: `On gradient descent, ${titles.map((t) => `[${t}]`).join(" and ")} are woven into one account.`,
    cited_sources: titles,
    acknowledges_disagreement: false,
  });
}

function claimModel(findConflict: boolean) {
  return {
    generate: async (req: ModelGenerationRequest): Promise<ModelGenerationResult> => {
      const key = req.invocation_key ?? "";
      const text = key.includes("claim-extract")
        ? extractText(req.prompt)
        : key.includes("fusion-synthesis")
          ? synthesisText(req.prompt)
          : contrastText(req.prompt, findConflict);
      return { text, model: "fake-claim-model", finishReason: "stop" as const };
    },
    embed: async () => [0],
  };
}

async function registerBoth(hub: SourceHub): Promise<[string, string]> {
  const a = await hub.register({
    content: MD_A,
    modality: "markdown",
    title: "Optimization Textbook",
  });
  const b = await hub.register({ content: MD_B, modality: "markdown", title: "ML Lecture Notes" });
  if (!a.ok || !b.ok) throw new Error("source registration failed");
  return [a.value.source_version_id, b.value.source_version_id];
}

describe("SourceHub claim light-up (M9 T2)", () => {
  it("attaches each source's claims and surfaces a genuine cross-source contradiction", async () => {
    const hub = new SourceHub();
    hub.enableFusionCognition(claimModel(true), "gemini");
    const [a, b] = await registerBoth(hub);

    const result = await hub.fuse([a, b], ["gradient-descent"]);
    const gd = result.concepts.find((c) => c.concept_ref === "gradient-descent");
    expect(gd).toBeDefined();

    // Each source's claim attaches, traceable to its own source (provenance never blurred).
    expect(gd?.claims).toHaveLength(2);
    expect(new Set((gd?.claims ?? []).map((c) => c.source_version_id))).toEqual(new Set([a, b]));

    // A genuine cross-source disagreement is surfaced, typed by nature, between claims of the pair.
    expect(gd?.reconciliation.contradictions).toHaveLength(1);
    const contradiction = gd?.reconciliation.contradictions[0];
    expect(contradiction?.nature).toBe("interpretive");
    expect(new Set(contradiction?.source_version_ids ?? [])).toEqual(new Set([a, b]));

    // M9 T3: a fused explanation is woven, citing both sources; disagreement forced (contradiction).
    expect(gd?.synthesis).toBeDefined();
    expect(gd?.synthesis?.degraded).toBe(false);
    expect(new Set(gd?.synthesis?.cited_source_ids ?? [])).toEqual(new Set([a, b]));
    expect(gd?.synthesis?.acknowledges_disagreement).toBe(true); // forced — a live disagreement exists
  });

  it("stays honestly contradiction-free when the model finds none — claims still attach", async () => {
    const hub = new SourceHub();
    hub.enableFusionCognition(claimModel(false), "gemini");
    const [a, b] = await registerBoth(hub);

    const result = await hub.fuse([a, b], ["gradient-descent"]);
    const gd = result.concepts.find((c) => c.concept_ref === "gradient-descent");
    expect(gd?.claims).toHaveLength(2);
    expect(gd?.reconciliation.contradictions).toEqual([]);
  });

  it("without claim reasoning enabled, fusion is byte-for-byte the T1 coverage view", async () => {
    const hub = new SourceHub();
    const [a, b] = await registerBoth(hub);
    const result = await hub.fuse([a, b], ["gradient-descent"]);
    const gd = result.concepts.find((c) => c.concept_ref === "gradient-descent");
    expect(gd?.claims).toBeUndefined(); // no claims attached
    expect(gd?.reconciliation.contradictions).toEqual([]); // honest absence
    expect(gd?.synthesis).toBeUndefined(); // no synthesis without fusion cognition
  });
});

/** A web-grounded fake: the frontier call returns entries + REAL citations; other calls no-op. */
function frontierModel(withCitations: boolean) {
  return {
    generate: async (req: ModelGenerationRequest): Promise<ModelGenerationResult> => {
      if ((req.invocation_key ?? "").includes("frontier")) {
        return {
          text: JSON.stringify({
            entries: [
              { kind: "latest-research", summary: "Recent work explores adaptive step sizes." },
              { kind: "open-question", summary: "Non-convex convergence guarantees remain open." },
            ],
          }),
          model: "fake-frontier-model",
          finishReason: "stop" as const,
          ...(withCitations
            ? { citations: [{ uri: "https://arxiv.org/abs/2401.1", title: "A 2024 Survey" }] }
            : {}),
        };
      }
      return { text: "{}", model: "fake", finishReason: "stop" as const };
    },
    embed: async () => [0],
  };
}

describe("SourceHub frontier research (M9 Frontier T1)", () => {
  it("returns a grounded overlay when the web search yields real citations", async () => {
    const hub = new SourceHub();
    hub.enableFusionCognition(frontierModel(true), "gemini");
    const overlay = await hub.researchFrontier("gradient-descent");
    expect(overlay.degraded).toBe(false);
    expect(overlay.entries.map((e) => e.kind)).toEqual(["latest-research", "open-question"]);
    // Every entry is grounded in a real, fetchable citation (CSE-006 §4).
    expect(overlay.entries.every((e) => e.external_refs.length > 0)).toBe(true);
    expect(overlay.entries[0]?.external_refs[0]?.uri).toBe("https://arxiv.org/abs/2401.1");
  });

  it("is honestly degraded-empty when the search returns no citation (never fabricated)", async () => {
    const hub = new SourceHub();
    hub.enableFusionCognition(frontierModel(false), "gemini");
    const overlay = await hub.researchFrontier("gradient-descent");
    expect(overlay.entries).toEqual([]);
    expect(overlay.degraded).toBe(true);
  });

  it("without fusion cognition enabled, the frontier is honestly empty (no model, no web)", async () => {
    const hub = new SourceHub();
    const overlay = await hub.researchFrontier("gradient-descent");
    expect(overlay.entries).toEqual([]);
    expect(overlay.degraded).toBe(true);
  });
});

/** A web-grounded fake: the timeline call returns ordered states + a REAL citation; else no-op. */
function temporalModel(withCitations: boolean) {
  return {
    generate: async (req: ModelGenerationRequest): Promise<ModelGenerationResult> => {
      if ((req.invocation_key ?? "").includes("timeline")) {
        return {
          text: JSON.stringify({
            states: [
              { kind: "shift", label: "Deep learning revival", summary: "GPU-scale.", era: "2012" },
              {
                kind: "origin",
                label: "Roots in control theory",
                summary: "Chain rule.",
                era: "1960s",
              },
            ],
          }),
          model: "fake-temporal-model",
          finishReason: "stop" as const,
          ...(withCitations
            ? { citations: [{ uri: "https://en.wikipedia.org/wiki/Backpropagation", title: "BP" }] }
            : {}),
        };
      }
      return { text: "{}", model: "fake", finishReason: "stop" as const };
    },
    embed: async () => [0],
  };
}

describe("SourceHub temporal research (M9 TKM T1)", () => {
  it("returns a grounded, chronologically-ordered timeline when the search yields citations", async () => {
    const hub = new SourceHub();
    hub.enableFusionCognition(temporalModel(true), "gemini");
    const timeline = await hub.researchTimeline("backpropagation");
    expect(timeline.degraded).toBe(false);
    // Ordered by era: 1960s origin before 2012 shift (the model returned them reversed).
    expect(timeline.states.map((s) => s.label)).toEqual([
      "Roots in control theory",
      "Deep learning revival",
    ]);
    expect(timeline.states.every((s) => s.external_refs.length > 0)).toBe(true);
  });

  it("is honestly degraded-empty when the search returns no citation (never a fabricated history)", async () => {
    const hub = new SourceHub();
    hub.enableFusionCognition(temporalModel(false), "gemini");
    const timeline = await hub.researchTimeline("backpropagation");
    expect(timeline.states).toEqual([]);
    expect(timeline.degraded).toBe(true);
  });

  it("without fusion cognition enabled, the timeline is honestly empty", async () => {
    const hub = new SourceHub();
    const timeline = await hub.researchTimeline("backpropagation");
    expect(timeline.states).toEqual([]);
    expect(timeline.degraded).toBe(true);
  });
});
