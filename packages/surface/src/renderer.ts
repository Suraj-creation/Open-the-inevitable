/**
 * SurfaceRenderer — the UI is merely a projection.
 *
 * A renderer is a pure function from SurfaceState to a frame. Phase 2A ships a text
 * renderer; future renderers (scene-graph, immersive) consume the same state without
 * any runtime change.
 *
 * Spec: spec/surface/cognitive-surface-runtime.md §4.6.
 */
import type { SurfaceState } from "./projection";
import type { TimelineNodeStatus } from "./timeline";

export interface SurfaceRenderer {
  render(state: SurfaceState): string;
}

const STATUS_GLYPH: Record<TimelineNodeStatus, string> = {
  mastered: "[x]",
  in_progress: "[>]",
  available: "[ ]",
  locked: "[#]",
};

/**
 * Deterministic plain-text projection of a surface. Rendering the same state twice
 * yields identical frames (purity is a tested invariant).
 */
export class TextSurfaceRenderer implements SurfaceRenderer {
  render(state: SurfaceState): string {
    const lines: string[] = [];
    lines.push(`=== Cognitive Surface ${state.surface_id} [${state.status}] ===`);
    if (state.goal) lines.push(`Goal: ${state.goal}`);
    lines.push(`Learner: ${state.learner_cid}  Session: ${state.session_id}`);
    lines.push("");

    if (state.timeline) {
      lines.push(
        `--- Living Timeline (v${state.timeline.version}${state.timeline.completed ? ", completed" : ""}) ---`,
      );
      for (const node of state.timeline.nodes) {
        const milestone = node.milestone ? " *milestone*" : "";
        lines.push(
          `  ${STATUS_GLYPH[node.status]} ${node.order + 1}. ${node.title} (${node.status})${milestone}`,
        );
      }
      lines.push("");
    }

    lines.push(`--- Cognition Blocks (${state.blocks.length}) ---`);
    for (const block of state.blocks) {
      lines.push(
        `  (${block.block_type} v${block.version}) ${block.title} — by ${
          block.provenance.agent_id ?? block.provenance.producer_cid
        } [confidence ${block.confidence.toFixed(2)}]`,
      );
      const summary = block.content["summary"];
      if (typeof summary === "string") lines.push(`      ${summary}`);
      const layers = block.content["layers"] as Record<string, unknown> | undefined;
      if (layers) {
        for (const [layer, text] of Object.entries(layers)) {
          if (typeof text === "string") lines.push(`      ${layer}: ${text}`);
        }
      }
    }

    if (state.routing_decisions.length > 0) {
      lines.push("");
      lines.push("--- Supervisor Decisions ---");
      for (const decision of state.routing_decisions) {
        lines.push(`  -> ${decision.target_agent}: ${decision.reason}`);
      }
    }

    if (state.agents_joined.length > 0) {
      lines.push("");
      lines.push(`Agents: ${state.agents_joined.join(", ")}`);
    }

    return lines.join("\n");
  }
}
