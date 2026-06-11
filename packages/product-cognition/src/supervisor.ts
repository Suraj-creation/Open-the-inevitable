/**
 * SupervisorUnit — the single routing authority in the product-cognition runtime.
 *
 * Reads the learner's world-state (mastery checkpoints + concept phase-tracking props) and
 * returns a `SupervisorRoutingDecision` embedded in the response packet's `content.routing_decision`.
 *
 * Spec: spec/agents/supervisor-agent.md, spec/product/product-cognition-runtime.md §7.
 */
import type { CognitionPacket } from "@inevitable/protocols";
import type { CognitiveUnit, Emissions } from "@inevitable/runtime";
import type { IdGenerator } from "@inevitable/shared";
import type { WorldStateGraph } from "@inevitable/world-state";
import type { AgentManifest } from "@inevitable/protocols";

import { DeterministicMvpUnit } from "./runtime-dispatch";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Which specialist agent the supervisor has selected for the next learning action.
 * Ordered by learning cycle progression:
 *   explanation → practice → assessment → (revision if failed | complete if passed)
 */
export type SupervisorTargetAgent =
  | "explanation"
  | "practice"
  | "assessment"
  | "revision"
  | "complete";

/**
 * The governed routing decision emitted as `content.routing_decision` in the supervisor's
 * response packet and surfaced as a `supervisor.route` event by the calling loop.
 */
export interface SupervisorRoutingDecision {
  readonly targetAgent: SupervisorTargetAgent;
  readonly reason: string;
  readonly conceptId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Mastery checkpoints that pass with confidence below this threshold are treated as
 * insufficiently certain — the supervisor routes to `revision` rather than `complete`
 * to require a reinforcement pass before declaring mastery.
 * Spec: spec/agents/supervisor-agent.md §4 Confidence-Weighted Routing.
 */
export const MASTERY_CONFIDENCE_THRESHOLD = 0.6;

// ---------------------------------------------------------------------------
// SupervisorUnit
// ---------------------------------------------------------------------------

/**
 * A `CognitiveUnit` that routes incoming CognitionPackets to the appropriate specialist agent
 * based on the learner's current mastery state and learning phase in the world-state graph.
 *
 * Extends `DeterministicMvpUnit` to inherit the ABI surface and canonical ID generation,
 * overriding only `execute()` to embed the routing decision.
 *
 * The `WorldStateGraph` is injected at construction (bound via context lease in the full runtime;
 * direct injection in Phase 1E).
 */
export class SupervisorUnit extends DeterministicMvpUnit implements CognitiveUnit {
  constructor(
    manifest: AgentManifest,
    private readonly world: WorldStateGraph,
    idGenerator?: IdGenerator,
  ) {
    super(manifest, idGenerator);
  }

  /** Route this packet and embed the decision in the response content. */
  override execute(packet: CognitionPacket): Emissions {
    const conceptId = packet.concept_ids?.[0] ?? "";
    const learnerUserId =
      ((packet.content as Record<string, unknown> | undefined)?.["learnerUserId"] as
        | string
        | undefined) ?? "";
    const decision = this.route(conceptId, learnerUserId);

    const base = super.execute(packet);
    const [response] = base.packets ?? [];
    if (!response) return base;

    return {
      packets: [
        {
          ...response,
          content: {
            ...response.content,
            routing_decision: decision,
          },
        },
      ],
    };
  }

  /**
   * Core routing logic — pure world-state read, no mutations.
   *
   * Precedence (spec §4):
   *   1a. mastery checkpoint with passed=true AND confidence >= threshold → complete
   *   1b. mastery checkpoint with passed=true BUT confidence < threshold → revision (reinforce)
   *   2.  mastery checkpoint with passed=false (no passing) → revision
   *   3.  concept node has practice_dispatched:<userId>=true → assessment
   *   4.  concept node has explanation_dispatched:<userId>=true → practice
   *   5.  default → explanation
   */
  route(conceptId: string, learnerUserId: string): SupervisorRoutingDecision {
    if (!conceptId) {
      return {
        targetAgent: "explanation",
        reason: "no-concept-id-in-packet",
        conceptId: "",
      };
    }

    // 1 & 2: mastery checkpoint signals (strongest evidence)
    const masteryNodes = this.world
      .nodesByType("mastery_checkpoint")
      .filter(
        (n) => n.props["conceptId"] === conceptId && n.props["ownerUserId"] === learnerUserId,
      );

    const passingNodes = masteryNodes.filter((n) => n.props["passed"] === true);
    if (passingNodes.length > 0) {
      // Confidence-weighted: even a passing checkpoint requires minimum confidence.
      const maxConfidence = Math.max(
        ...passingNodes.map((n) => (n.props["confidence"] as number | undefined) ?? 1),
      );
      if (maxConfidence < MASTERY_CONFIDENCE_THRESHOLD) {
        return {
          targetAgent: "revision",
          reason: `mastery passed but confidence ${maxConfidence.toFixed(2)} below threshold ${MASTERY_CONFIDENCE_THRESHOLD}`,
          conceptId,
        };
      }
      return { targetAgent: "complete", reason: "mastery verified by checkpoint", conceptId };
    }
    if (masteryNodes.some((n) => n.props["passed"] === false)) {
      return { targetAgent: "revision", reason: "assessment failed, revision needed", conceptId };
    }

    // 3 & 4: phase-tracking props on the concept node
    const conceptNode = this.world.getNode(`concept:${conceptId}`);
    const practiceKey = `practice_dispatched:${learnerUserId}`;
    const explanationKey = `explanation_dispatched:${learnerUserId}`;

    if (conceptNode?.props[practiceKey] === true) {
      return {
        targetAgent: "assessment",
        reason: "practice complete, ready for assessment",
        conceptId,
      };
    }
    if (conceptNode?.props[explanationKey] === true) {
      return {
        targetAgent: "practice",
        reason: "explanation complete, ready for practice",
        conceptId,
      };
    }

    // 5: default — nothing has happened yet
    return { targetAgent: "explanation", reason: "concept not yet explained", conceptId };
  }
}
