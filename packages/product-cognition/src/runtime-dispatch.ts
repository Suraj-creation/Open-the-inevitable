import type { EventBus } from "@inevitable/events";
import { type GovernanceEngine, guard } from "@inevitable/governance";
import { withSpan } from "@inevitable/observability";
import type {
  AgentManifest,
  CognitiveIdentity,
  CognitionPacket,
  CognitiveWorkItem,
  ContextLease,
  UnitDescriptor,
  UnitLifecycleState,
} from "@inevitable/protocols";
import { SCHEMA_IDS } from "@inevitable/protocols";
import {
  CognitiveUnitHost,
  type CognitiveHealth,
  type CognitionFrame,
  type CognitiveUnit,
  type Emissions,
} from "@inevitable/runtime";
import { DepthScheduler, type DepthSchedulerOptions } from "@inevitable/scheduler";
import {
  CosError,
  CryptoIdGenerator,
  type Clock,
  type Hlc,
  type IdGenerator,
  type Result,
  SystemClock,
  err,
  hlcInit,
  hlcTick,
  hlcToString,
  newPacketId,
  newSpanId,
  newTraceId,
  newWorkId,
  ok,
} from "@inevitable/shared";

import type { OnboardingSession } from "./types";

export type ProductRuntimeAgentId =
  | "supervisor"
  | "curriculum"
  | "explanation"
  | "practice"
  | "assessment"
  | "revision"
  | "memory"
  | "intent"
  | "research"
  | "motivation"
  | "reflection"
  | "debate"
  | "composer"
  | "frameplanner"
  | "imageplanner";

export interface RuntimeAgentBinding {
  readonly identity: CognitiveIdentity;
  readonly unit: CognitiveUnit;
}

export interface ProductRuntimeDispatcherDeps {
  readonly bus: EventBus;
  readonly agent: RuntimeAgentBinding;
  readonly scheduler?: DepthScheduler;
  readonly schedulerOptions?: DepthSchedulerOptions;
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
  readonly nodeId?: string;
  /**
   * Optional governance engine. When provided, every dispatch is evaluated against the
   * registered policies before work is admitted. Blocked requests return an error without
   * touching the scheduler or host.
   * Spec: spec/product/product-cognition-runtime.md §10, spec/kernel/governance-kernel.md.
   */
  readonly governance?: GovernanceEngine;
  /**
   * Optional capability registry (GOV-P03). When provided, the dispatching subject's active
   * capabilities are added to the governance context so a revoked `dispatch.<agentId>` blocks the next
   * dispatch. Structural type to avoid a kernel dependency. Spec: spec/kernel/capability-registry.md.
   */
  readonly capabilityRegistry?: { granted(subjectCid: string): string[] };
}

export interface ProductDispatchInput {
  readonly session: OnboardingSession;
  readonly targetAgentId: ProductRuntimeAgentId;
  readonly intent: string;
  readonly conceptIds?: readonly string[];
  readonly domainIds?: readonly string[];
  readonly content?: Record<string, unknown>;
  readonly priority?: number;
  readonly workType?: CognitiveWorkItem["work_type"];
  readonly maxTimeSeconds?: number;
  readonly costBudgetUsd?: number | null;
  readonly riskClass?: CognitiveWorkItem["risk_class"];
}

export interface ProductDispatchResult {
  readonly workItem: CognitiveWorkItem;
  readonly packet: CognitionPacket;
  readonly emissions: Emissions;
  readonly responsePackets: readonly CognitionPacket[];
}

function productDispatchError(message: string, details?: Record<string, unknown>): CosError {
  return new CosError("E_PRODUCT_RUNTIME_DISPATCH", message, {
    specRef: "spec/product/product-cognition-runtime.md",
    details,
  });
}

function workTypeFor(agentId: ProductRuntimeAgentId): CognitiveWorkItem["work_type"] {
  switch (agentId) {
    case "assessment":
      return "assessment";
    case "curriculum":
      return "curriculum_planning";
    case "memory":
      return "memory_consolidation";
    case "supervisor":
    case "explanation":
    case "practice":
    case "revision":
    case "intent":
    case "motivation":
    case "reflection":
    case "debate":
    case "composer":
    case "imageplanner":
      return "student_interaction";
    case "research":
    case "frameplanner":
      return "curriculum_planning";
  }
}

function clampPriority(priority: number | undefined): number {
  if (priority === undefined) return 5;
  return Math.min(10, Math.max(1, Math.trunc(priority)));
}

function descriptorFromManifest(manifest: AgentManifest): UnitDescriptor {
  const memory = manifest.memory_access;
  return {
    unit_id: manifest.id,
    unit_type: manifest.id,
    version: manifest.version,
    abi_version: manifest.abi_version,
    capabilities: manifest.capabilities,
    input_schemas: [SCHEMA_IDS.cognitionPacket],
    output_schemas: [SCHEMA_IDS.cognitionPacket],
    policy_needs: manifest.policies,
    memory_scope_needs: [...(memory.read ?? []), ...(memory.write ?? [])],
    observability_contract: manifest.observability.required_events ?? [],
    resource_budget: manifest.resources,
    evolution_policy: "frozen",
  };
}

export class DeterministicMvpUnit implements CognitiveUnit {
  private preparedLeaseId: string | null = null;

  constructor(
    private readonly manifest: AgentManifest,
    private readonly idGenerator: IdGenerator = new CryptoIdGenerator(),
  ) {}

  describe(): UnitDescriptor {
    return descriptorFromManifest(this.manifest);
  }

  prepare(lease: ContextLease): void {
    this.preparedLeaseId = lease.lease_id;
  }

  execute(packet: CognitionPacket): Emissions {
    const response: CognitionPacket = {
      packet_id: newPacketId(this.idGenerator),
      schema_version: packet.schema_version,
      source_cid: packet.target_cid ?? this.manifest.id,
      target_cid: packet.source_cid,
      tenant_id: packet.tenant_id ?? null,
      session_id: packet.session_id ?? null,
      causation_id: packet.packet_id,
      correlation_id: packet.correlation_id ?? packet.packet_id,
      timestamp: packet.timestamp,
      hlc: packet.hlc,
      sequence_number: (packet.sequence_number ?? 0) + 1,
      packet_type: "response",
      intent: packet.intent ?? null,
      concept_ids: packet.concept_ids ?? [],
      domain_ids: packet.domain_ids ?? [],
      content: {
        handled_by: this.manifest.id,
        intent: packet.intent ?? null,
        concepts: packet.concept_ids ?? [],
        response_kind: "deterministic-product-cognition",
        prepared_lease_id: this.preparedLeaseId,
      },
      evidence: [
        {
          kind: "deterministic-mvp-unit",
          source_packet_id: packet.packet_id,
        },
      ],
      confidence: 1,
      uncertainty_estimate: 0,
      reasoning_depth: packet.reasoning_depth ?? 0,
      classification: packet.classification ?? "internal",
      policy_tags: packet.policy_tags ?? [],
      requires_human_review: false,
      priority: packet.priority,
      expiry: packet.expiry ?? null,
      trace_id: packet.trace_id,
      span_id: packet.span_id,
    };
    return { packets: [response] };
  }

  reflect(): string | null {
    return null;
  }

  checkpoint(): CognitionFrame {
    return {
      unitId: this.manifest.id,
      state: "Ready" as UnitLifecycleState,
      data: { preparedLeaseId: this.preparedLeaseId },
    };
  }

  restore(frame: CognitionFrame): void {
    this.preparedLeaseId =
      typeof frame.data["preparedLeaseId"] === "string" ? frame.data["preparedLeaseId"] : null;
  }

  shutdown(): void {
    this.preparedLeaseId = null;
  }

  health(): CognitiveHealth {
    return { runtime: "ok", drift: 0, confidence: 1, loadFactor: 0 };
  }
}

export class ProductRuntimeDispatcher {
  private readonly scheduler: DepthScheduler;
  private readonly host: CognitiveUnitHost;
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;
  private readonly agent: RuntimeAgentBinding;
  private readonly governance: GovernanceEngine | undefined;
  private readonly capabilityRegistry: { granted(subjectCid: string): string[] } | undefined;
  private hlc: Hlc;
  private activated = false;

  constructor(private readonly deps: ProductRuntimeDispatcherDeps) {
    this.clock = deps.clock ?? new SystemClock();
    this.idGenerator = deps.idGenerator ?? new CryptoIdGenerator();
    this.agent = deps.agent;
    this.governance = deps.governance;
    this.capabilityRegistry = deps.capabilityRegistry;
    this.scheduler = deps.scheduler ?? new DepthScheduler(deps.schedulerOptions);
    this.hlc = hlcInit(deps.nodeId ?? "product-runtime-dispatch");
    this.host = new CognitiveUnitHost(deps.agent.unit, deps.agent.identity, {
      bus: deps.bus,
      clock: this.clock,
      idGenerator: this.idGenerator,
      nodeId: deps.nodeId ?? "product-runtime-dispatch",
    });
  }

  async dispatch(input: ProductDispatchInput): Promise<Result<ProductDispatchResult, CosError>> {
    // Governance gate (kernel primitive). Must be the first check — before any state changes.
    // Spec: spec/product/product-cognition-runtime.md §10, spec/kernel/governance-kernel.md.
    if (this.governance) {
      const govResult = guard(this.governance, {
        subjectCid: input.session.learnerIdentity.cid,
        resource: "product.cognition.dispatch",
        action: `dispatch.${input.targetAgentId}`,
        context: {
          trustLevel: input.session.learnerIdentity.trust_level,
          targetAgentId: input.targetAgentId,
          // GOV-P03 (opt-in): the subject's active capabilities, present only when a registry is wired.
          ...(this.capabilityRegistry
            ? { capabilities: this.capabilityRegistry.granted(input.session.learnerIdentity.cid) }
            : {}),
        },
        classification: input.session.capabilityEnvelope.data_classification_ceiling,
      });
      if (!govResult.allowed) {
        return err(
          productDispatchError("governance policy blocked product dispatch", {
            decisionId: govResult.decision.decision_id,
            policyId: govResult.decision.policy_id,
            reason: govResult.decision.reason,
            outcome: govResult.decision.decision,
          }),
        );
      }
    }

    const packet = this.createPacket(input);
    const workItem = this.createWorkItem(input, packet);
    const admission = this.scheduler.submit(workItem);
    if (!admission.admitted) {
      return err(
        productDispatchError("scheduler rejected product cognition work", {
          reason: admission.reason,
          workId: workItem.work_id,
        }),
      );
    }

    const dispatched = this.scheduler.dispatch();
    if (!dispatched || dispatched.work_id !== workItem.work_id) {
      return err(
        productDispatchError("scheduler did not dispatch admitted product cognition work", {
          workId: workItem.work_id,
          dispatchedWorkId: dispatched?.work_id,
        }),
      );
    }

    try {
      if (!this.activated) {
        await this.host.activate(input.session.contextLease);
        this.activated = true;
      }
      // Wrap host.handle() in an OTel span for end-to-end trace capture.
      // Spec: spec/product/product-cognition-runtime.md §8, spec/telemetry/otel-edge.md.
      // Without a registered SDK the span is a no-op — safe in offline tests.
      const emissions = await withSpan("cos.agent.dispatch", () => this.host.handle(packet), {
        "cos.packet_id": packet.packet_id,
        "cos.agent_id": this.agent.identity.cid,
        "cos.agent_unit_type": this.agent.identity.unit_type,
        "cos.intent": input.intent ?? "",
        "cos.concept_ids": (input.conceptIds ?? []).join(","),
        "cos.trace_id": packet.trace_id,
        "cos.span_id": packet.span_id,
      });
      this.scheduler.complete(workItem.work_id);
      return ok({
        workItem: dispatched,
        packet,
        emissions,
        responsePackets: emissions.packets ?? [],
      });
    } catch (cause) {
      this.scheduler.complete(workItem.work_id);
      // Reset activated so the next dispatch re-activates (a fresh Ready state),
      // enabling recovery after a unit execution failure or Quarantine transition.
      this.activated = false;
      return err(
        productDispatchError("runtime host failed to execute product cognition work", {
          workId: workItem.work_id,
          cause: cause instanceof Error ? cause.message : String(cause),
        }),
      );
    }
  }

  private createPacket(input: ProductDispatchInput): CognitionPacket {
    this.hlc = hlcTick(this.hlc, this.clock);
    const packetId = newPacketId(this.idGenerator);
    return {
      packet_id: packetId,
      schema_version: "1.0.0",
      source_cid: input.session.learnerIdentity.cid,
      target_cid: this.agent.identity.cid,
      tenant_id: input.session.learnerIdentity.tenant_id ?? null,
      session_id: input.session.intentLease.intent_id,
      causation_id: input.session.intentLease.intent_id,
      correlation_id: newPacketId(this.idGenerator),
      timestamp: new Date(this.clock.nowMs()).toISOString(),
      hlc: hlcToString(this.hlc),
      sequence_number: 0,
      packet_type: "intent",
      intent: input.intent,
      concept_ids: [...(input.conceptIds ?? [])],
      domain_ids: [...(input.domainIds ?? [])],
      content: input.content ?? {},
      evidence: [
        {
          kind: "product-dispatch",
          intent_id: input.session.intentLease.intent_id,
        },
      ],
      confidence: input.session.intentLease.confidence,
      uncertainty_estimate: 0,
      reasoning_depth: 0,
      classification: input.session.capabilityEnvelope.data_classification_ceiling ?? "internal",
      policy_tags: input.session.intentLease.constraints ?? [],
      requires_human_review: false,
      priority: clampPriority(input.priority),
      expiry: input.session.intentLease.expires_at,
      trace_id: newTraceId(this.idGenerator),
      span_id: newSpanId(this.idGenerator),
    };
  }

  private createWorkItem(input: ProductDispatchInput, packet: CognitionPacket): CognitiveWorkItem {
    return {
      work_id: newWorkId(this.idGenerator),
      work_type: input.workType ?? workTypeFor(input.targetAgentId),
      requester_cid: input.session.learnerIdentity.cid,
      target_unit_type: `agent.${input.targetAgentId}`,
      packet_ref: packet.packet_id,
      priority: packet.priority ?? 5,
      max_time_seconds: input.maxTimeSeconds ?? 5,
      cost_budget_usd: input.costBudgetUsd ?? 0,
      risk_class: input.riskClass ?? "low",
    };
  }
}
