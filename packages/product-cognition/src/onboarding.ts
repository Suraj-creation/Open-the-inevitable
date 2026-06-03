import { createEvent, type EventBus } from "@inevitable/events";
import type {
  CapabilityService,
  ContextLeaseService,
  IdentityService,
  IntentLeaseService,
} from "@inevitable/kernel";
import { type MemoryLayer, type MemoryMutation, type TieredMemoryStore } from "@inevitable/memory";
import {
  CryptoIdGenerator,
  type Clock,
  type Hlc,
  type IdGenerator,
  SystemClock,
  hlcInit,
  newMutationId,
} from "@inevitable/shared";
import type { WorldStateGraph } from "@inevitable/world-state";
import type { OnboardingInput, OnboardingSession, PersonaClass } from "./types";
import { assertWorldStateOk } from "./types";

export interface ProductOnboardingDeps {
  readonly identity: IdentityService;
  readonly capabilities: CapabilityService;
  readonly contexts: ContextLeaseService;
  readonly intents: IntentLeaseService;
  readonly memory: TieredMemoryStore;
  readonly world: WorldStateGraph;
  readonly bus: EventBus;
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
  readonly nodeId?: string;
}

const DEFAULT_MEMORY_SCOPES: readonly MemoryLayer[] = ["working", "semantic"];

function unitTypeFor(persona: PersonaClass): string {
  switch (persona) {
    case "child":
      return "human.child";
    case "student":
      return "human.student";
    case "educator":
      return "human.educator";
    case "researcher":
      return "human.researcher";
    case "institution":
      return "institution";
    case "lifelong-learner":
      return "human.lifelong-learner";
    case "open":
      return "human.open";
  }
}

function normalizeScopes(scopes: readonly string[] | undefined): MemoryLayer[] {
  if (!scopes || scopes.length === 0) return [...DEFAULT_MEMORY_SCOPES];
  return scopes as MemoryLayer[];
}

function seedLayer(scopes: readonly MemoryLayer[]): MemoryLayer {
  return scopes.includes("semantic") ? "semantic" : (scopes[0] ?? "working");
}

export class ProductOnboardingService {
  private readonly identity: IdentityService;
  private readonly capabilities: CapabilityService;
  private readonly contexts: ContextLeaseService;
  private readonly intents: IntentLeaseService;
  private readonly memory: TieredMemoryStore;
  private readonly world: WorldStateGraph;
  private readonly bus: EventBus;
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;
  private hlc: Hlc;

  constructor(deps: ProductOnboardingDeps) {
    this.identity = deps.identity;
    this.capabilities = deps.capabilities;
    this.contexts = deps.contexts;
    this.intents = deps.intents;
    this.memory = deps.memory;
    this.world = deps.world;
    this.bus = deps.bus;
    this.clock = deps.clock ?? new SystemClock();
    this.idGenerator = deps.idGenerator ?? new CryptoIdGenerator();
    this.hlc = hlcInit(deps.nodeId ?? "product-cognition");
  }

  async initialize(input: OnboardingInput): Promise<OnboardingSession> {
    const memoryScopes = normalizeScopes(input.consentMemoryScopes);
    const learnerIdentity = this.identity.issue({
      unitType: unitTypeFor(input.persona),
      capabilities: ["product.onboarding", "product.navigation"],
      trustLevel: input.persona === "child" ? 3 : 5,
      tenantId: input.tenantId ?? null,
      governancePolicies: ["product-consent", "memory-scope"],
    });

    await this.emit("onboarding.started", {
      owner_user_id: input.ownerUserId,
      persona: input.persona,
      mode: input.mode,
      learner_cid: learnerIdentity.cid,
    });

    const capabilityEnvelope = this.capabilities.grant({
      grantedTo: learnerIdentity.cid,
      grantedBy: "kernel",
      memoryScopes: [...memoryScopes],
      maxSpawnDepth: 1,
      maxChildUnits: 7,
      networkAccess: false,
      costCeilingUsd: 0,
      dataClassificationCeiling: input.persona === "child" ? "sensitive" : "internal",
    });

    const contextLease = this.contexts.request({
      grantedTo: learnerIdentity.cid,
      memoryLayers: [...memoryScopes],
      allowedUsers: [input.ownerUserId],
      tokenBudget: 16_000,
      grantedBy: "kernel",
    });

    const intentLease = this.intents.create({
      ownerUserId: input.ownerUserId,
      interpretedGoal: input.goal,
      scope: ["learning", input.mode],
      constraints: ["spec-first", "depth-preserving"],
      confidence: 1,
      heldBy: [learnerIdentity.cid],
    });

    const learnerNodeId = `learner:${input.ownerUserId}`;
    const intentNodeId = `intent:${intentLease.intent_id}`;
    assertWorldStateOk(
      this.world.apply(
        {
          kind: "upsert_node",
          id: learnerNodeId,
          type: "learner",
          props: {
            ownerUserId: input.ownerUserId,
            persona: input.persona,
            mode: input.mode,
            cid: learnerIdentity.cid,
            capabilityEnvelopeId: capabilityEnvelope.envelope_id,
          },
        },
        { proposerCid: learnerIdentity.cid },
      ),
    );
    assertWorldStateOk(
      this.world.apply(
        {
          kind: "upsert_node",
          id: intentNodeId,
          type: "intent",
          props: {
            ownerUserId: input.ownerUserId,
            goal: input.goal,
            intentId: intentLease.intent_id,
            status: "open",
          },
        },
        { proposerCid: learnerIdentity.cid },
      ),
    );
    assertWorldStateOk(
      this.world.apply(
        {
          kind: "upsert_edge",
          id: `edge:${learnerNodeId}:holds:${intentNodeId}`,
          from: learnerNodeId,
          to: intentNodeId,
          type: "holds_intent",
          props: { intentId: intentLease.intent_id },
        },
        { proposerCid: learnerIdentity.cid },
      ),
    );

    const seedMutation: MemoryMutation = {
      mutation_id: newMutationId(this.idGenerator),
      proposer_cid: learnerIdentity.cid,
      tenant_id: input.tenantId ?? null,
      memory_layer: seedLayer(memoryScopes),
      mutation_type: "add_fact",
      target: { id: learnerNodeId },
      payload: {
        ownerUserId: input.ownerUserId,
        persona: input.persona,
        mode: input.mode,
        goal: input.goal,
        intentId: intentLease.intent_id,
      },
      evidence: [{ kind: "onboarding-input", ownerUserId: input.ownerUserId }],
      confidence: 1,
      reversible: true,
      context_lease_ref: contextLease.lease_id,
      classification: input.persona === "child" ? "sensitive" : "internal",
    };
    const seedMemoryMutationId = assertWorldStateOk(this.memory.commit(seedMutation)) as string;

    await this.emit("onboarding.completed", {
      owner_user_id: input.ownerUserId,
      learner_cid: learnerIdentity.cid,
      learner_node_id: learnerNodeId,
      intent_node_id: intentNodeId,
      intent_id: intentLease.intent_id,
      seed_memory_mutation_id: seedMemoryMutationId,
    });

    return {
      learnerIdentity,
      capabilityEnvelope,
      contextLease,
      intentLease,
      learnerNodeId,
      intentNodeId,
      seedMemoryMutationId,
    };
  }

  private async emit(eventType: string, payload: Record<string, unknown>): Promise<void> {
    const created = createEvent(
      {
        eventType,
        producerCid: "product-cognition",
        producerType: "product.runtime",
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
