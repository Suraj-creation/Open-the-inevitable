/**
 * AgentContributionRuntime — agents contribute directly to the surface.
 *
 * Converts governed agent outputs (CognitionPackets from ProductRuntimeDispatcher dispatches)
 * into typed Cognition Blocks, announcing each via surface.agent.joined (first contribution),
 * surface.agent.contributed, and surface.block.generated events. The surface becomes the
 * visible manifestation of agent cognition.
 *
 * Spec: spec/surface/cognitive-surface-runtime.md §6.1 (ask step c), §7.
 */
import { createEvent, type EventBus } from "@inevitable/events";
import type { ProductDispatchResult } from "@inevitable/product-cognition";
import {
  CryptoIdGenerator,
  SystemClock,
  hlcInit,
  hlcTick,
  hlcToString,
  ok,
  type Clock,
  type CosError,
  type Hlc,
  type IdGenerator,
  type Result,
} from "@inevitable/shared";

import {
  createCognitionBlock,
  type BlockClassification,
  type CognitionBlock,
  type CognitionBlockType,
} from "./blocks";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentContribution {
  readonly surface_id: string;
  readonly agent_id: string;
  readonly agent_cid: string;
  readonly block_type: CognitionBlockType;
  readonly title: string;
  readonly content: Record<string, unknown>;
  readonly concept_ids: readonly string[];
  readonly reason: string;
  readonly packet_id?: string | null;
  readonly trace_id?: string | null;
  readonly confidence?: number;
  readonly classification?: BlockClassification;
  readonly world_state_nodes?: readonly string[];
  readonly memory_mutation_id?: string | null;
}

export interface AgentContributionRuntimeDeps {
  readonly bus: EventBus;
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
  readonly nodeId?: string;
}

/**
 * Build an AgentContribution from a governed dispatch result: content, confidence,
 * classification, packet linkage, and trace id all come from the agent's response packet.
 */
export function contributionFromDispatch(args: {
  readonly surface_id: string;
  readonly agent_id: string;
  readonly block_type: CognitionBlockType;
  readonly title: string;
  readonly dispatch: ProductDispatchResult;
  readonly reason: string;
  readonly concept_ids?: readonly string[];
  readonly world_state_nodes?: readonly string[];
}): AgentContribution {
  const response = args.dispatch.responsePackets[0];
  return {
    surface_id: args.surface_id,
    agent_id: args.agent_id,
    agent_cid: response?.source_cid ?? args.dispatch.packet.target_cid ?? args.agent_id,
    block_type: args.block_type,
    title: args.title,
    content: (response?.content as Record<string, unknown> | undefined) ?? {},
    concept_ids: args.concept_ids ?? args.dispatch.packet.concept_ids ?? [],
    reason: args.reason,
    packet_id: args.dispatch.packet.packet_id,
    trace_id: args.dispatch.packet.trace_id ?? null,
    confidence: response?.confidence ?? 1,
    classification: (response?.classification ?? "internal") as BlockClassification,
    world_state_nodes: args.world_state_nodes ?? [],
  };
}

// ---------------------------------------------------------------------------
// AgentContributionRuntime
// ---------------------------------------------------------------------------

export class AgentContributionRuntime {
  private readonly bus: EventBus;
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;
  private readonly joined = new Set<string>();
  private hlc: Hlc;

  constructor(deps: AgentContributionRuntimeDeps) {
    this.bus = deps.bus;
    this.clock = deps.clock ?? new SystemClock();
    this.idGenerator = deps.idGenerator ?? new CryptoIdGenerator();
    this.hlc = hlcInit(deps.nodeId ?? "surface-contribution");
  }

  /**
   * Accept an agent contribution: create the block (validated, provenance-mandatory) and
   * announce it. Event order: agent.joined (first time per CID) → block.generated →
   * agent.contributed.
   */
  async contribute(contribution: AgentContribution): Promise<Result<CognitionBlock, CosError>> {
    this.hlc = hlcTick(this.hlc, this.clock);
    const blockResult = createCognitionBlock(
      {
        surface_id: contribution.surface_id,
        block_type: contribution.block_type,
        title: contribution.title,
        content: contribution.content,
        concept_ids: contribution.concept_ids,
        classification: contribution.classification ?? "internal",
        confidence: contribution.confidence ?? 1,
        provenance: {
          packet_id: contribution.packet_id ?? null,
          producer_cid: contribution.agent_cid,
          agent_id: contribution.agent_id,
          world_state_nodes: contribution.world_state_nodes ?? [],
          memory_mutation_id: contribution.memory_mutation_id ?? null,
          trace_id: contribution.trace_id ?? null,
          reason: contribution.reason,
        },
      },
      { clock: this.clock, idGenerator: this.idGenerator, hlc: hlcToString(this.hlc) },
    );
    if (!blockResult.ok) return blockResult;
    const block = blockResult.value;

    if (!this.joined.has(contribution.agent_cid)) {
      this.joined.add(contribution.agent_cid);
      await this.emit("surface.agent.joined", contribution.agent_cid, {
        surface_id: contribution.surface_id,
        agent_cid: contribution.agent_cid,
        agent_id: contribution.agent_id,
      });
    }

    await this.emit("surface.block.generated", contribution.agent_cid, {
      surface_id: contribution.surface_id,
      block,
    });

    await this.emit("surface.agent.contributed", contribution.agent_cid, {
      surface_id: contribution.surface_id,
      agent_cid: contribution.agent_cid,
      agent_id: contribution.agent_id,
      block_ids: [block.block_id],
      packet_id: contribution.packet_id ?? null,
    });

    return ok(block);
  }

  private async emit(
    eventType: string,
    producerCid: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const created = createEvent(
      {
        eventType,
        producerCid,
        producerType: "product.surface",
        payload,
        topic: `cos.${eventType}`,
        classification: "internal",
      },
      { clock: this.clock, hlc: this.hlc, idGenerator: this.idGenerator },
    );
    this.hlc = created.hlc;
    await this.bus.publish(created.event);
  }
}
