/**
 * Event family registry — the canonical catalog from spec/events/event-taxonomy.md.
 * Each family declares owner, retention, replay behavior, classification, producers, consumers.
 */
import { type EventFamilyRegistration, SCHEMA_IDS, defaultValidator } from "@inevitable/protocols";

export const DEFAULT_EVENT_FAMILIES: readonly EventFamilyRegistration[] = [
  fam("intent", "kernel", "1y-archive", "replayable", "internal"),
  fam("context", "kernel", "90d", "replayable", "internal"),
  fam("agent", "runtime", "1y-archive", "replayable", "internal"),
  fam("reasoning", "reasoning", "30d-hot", "recorded-observation", "internal"),
  fam("memory", "memory", "permanent", "replayable", "internal"),
  fam("world", "world-state", "permanent", "replayable", "internal"),
  fam("orchestration", "orchestration", "90d", "replayable", "internal"),
  fam("workflow", "workflow", "1y-archive", "replayable", "internal"),
  fam("governance", "governance", "permanent", "replayable", "audit"),
  fam("security", "security", "permanent", "replayable", "audit"),
  fam("observability", "observability", "30d", "non-replayable", "internal"),
  fam("evolution", "evolution", "permanent", "replayable", "internal"),
  fam("kernel", "kernel", "1y-archive", "recorded-observation", "audit"),
  fam("system", "kernel", "90d", "non-replayable", "internal"),
];

function fam(
  family: string,
  owner: string,
  retention: string,
  replay: EventFamilyRegistration["replay_behavior"],
  classification: EventFamilyRegistration["classification"],
): EventFamilyRegistration {
  return {
    family,
    owner,
    schema_version: "1.0.0",
    retention,
    replay_behavior: replay,
    classification,
    producers: [],
    consumers: [],
    failure_behavior: "dead-letter",
  };
}

export class EventFamilyRegistry {
  private readonly byFamily = new Map<string, EventFamilyRegistration>();

  constructor(families: readonly EventFamilyRegistration[] = DEFAULT_EVENT_FAMILIES) {
    for (const f of families) this.register(f);
  }

  register(registration: EventFamilyRegistration): void {
    const result = defaultValidator.validate(SCHEMA_IDS.eventFamilyRegistration, registration);
    if (!result.ok) throw result.error;
    this.byFamily.set(registration.family, registration);
  }

  has(family: string): boolean {
    return this.byFamily.has(family);
  }

  get(family: string): EventFamilyRegistration | undefined {
    return this.byFamily.get(family);
  }

  list(): EventFamilyRegistration[] {
    return [...this.byFamily.values()];
  }
}

export const defaultFamilyRegistry = new EventFamilyRegistry();
