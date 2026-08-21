/**
 * CognitiveHarness — the composable, INSPECTABLE execution environment of one cognitive process
 * (11 §3). It is NOT an opaque dependency bag: it is composed from a CapabilityRegistry
 * (transactionally — the constructor throws if the registry is incomplete) and its composition is
 * itself reconstructable via `describe()` — the answer to "what cognitive environment was this
 * process given?". The environment (the learner) is injected separately at `deps()` time; the harness
 * owns the process's capabilities, not the world it acts on.
 */
import type { Clock, IdGenerator } from "@inevitable/shared";
import type {
  CapabilityDescriptor,
  CapabilityRegistry,
  HarnessCapabilities,
} from "./capability-registry";
import type { EpisodeDeps } from "./episode";
import type { CognitiveEventLog } from "./events";
import { LoopEventEmitter } from "./events";
import type { LearnerSimulator } from "./learner-simulator";

export interface CompositionManifest {
  readonly capabilities: readonly CapabilityDescriptor[];
  readonly protected_seams: readonly string[];
}

export class CognitiveHarness {
  private readonly registry: CapabilityRegistry;
  private readonly caps: HarnessCapabilities;
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;
  private readonly producerCid: string;
  private readonly nodeId: string;

  constructor(
    registry: CapabilityRegistry,
    clock: Clock,
    idGenerator: IdGenerator,
    producerCid: string,
    nodeId = "cognitive-loop",
  ) {
    this.registry = registry;
    this.caps = registry.compose(); // transactional — throws (rollback) if incomplete
    this.clock = clock;
    this.idGenerator = idGenerator;
    this.producerCid = producerCid;
    this.nodeId = nodeId;
  }

  /** The process capabilities as EpisodeDeps, injecting the environment and a fresh event emitter. */
  deps(learnerSim: LearnerSimulator): EpisodeDeps {
    const emitter = new LoopEventEmitter(
      this.caps.eventLog,
      this.producerCid,
      this.clock,
      this.idGenerator,
      this.nodeId,
    );
    return {
      compiler: this.caps.compiler,
      faculty: this.caps.faculty,
      learnerSim,
      reflection: this.caps.reflection,
      governor: this.caps.governor,
      policies: this.caps.policies,
      emitter,
      idGenerator: this.idGenerator,
      capabilityManifest: this.registry.describe().map((c) => c.key),
    };
  }

  describe(): CompositionManifest {
    const capabilities = this.registry.describe();
    return {
      capabilities,
      protected_seams: capabilities.filter((c) => c.protected).map((c) => c.key),
    };
  }

  get eventLog(): CognitiveEventLog {
    return this.caps.eventLog;
  }
}
