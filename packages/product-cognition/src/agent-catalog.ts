import type { AgentManifest } from "@inevitable/protocols";

const MVP_AGENT_IDS = [
  "supervisor",
  "curriculum",
  "explanation",
  "practice",
  "assessment",
  "revision",
  "memory",
  "intent",
  "research",
  "motivation",
  "reflection",
  "debate",
  "composer",
  "frameplanner",
  "imageplanner",
] as const;

type MvpAgentId = (typeof MVP_AGENT_IDS)[number];

interface ManifestSeed {
  readonly id: MvpAgentId;
  readonly role: string;
  readonly capabilities: readonly string[];
  readonly memoryRead: readonly string[];
  readonly memoryWrite: readonly string[];
  readonly requiredEvents: readonly string[];
}

const SEEDS: readonly ManifestSeed[] = [
  {
    id: "supervisor",
    role: "Routes, arbitrates, and enforces product-cognition orchestration boundaries.",
    capabilities: ["agent.route", "agent.arbitrate", "governance.precheck"],
    memoryRead: ["working", "semantic", "reflective"],
    memoryWrite: [],
    requiredEvents: ["agent.activated", "agent.output.accepted", "agent.output.rejected"],
  },
  {
    id: "curriculum",
    role: "Projects goals into prerequisite-aware learning paths.",
    capabilities: ["path.plan", "prerequisite.project", "timeline.reshape"],
    memoryRead: ["semantic", "procedural"],
    memoryWrite: [],
    requiredEvents: ["navigation.timeline.rendered", "prerequisite.discovered"],
  },
  {
    id: "explanation",
    role: "Delivers layer-aware explanations from graph position and learner state.",
    capabilities: ["concept.explain", "modality.select", "dsp.read"],
    memoryRead: ["working", "semantic", "reflective"],
    memoryWrite: [],
    requiredEvents: ["explanation.delivered", "modality.selected"],
  },
  {
    id: "practice",
    role: "Generates adaptive practice opportunities for current concepts.",
    capabilities: ["practice.generate", "practice.evaluate"],
    memoryRead: ["semantic", "procedural"],
    memoryWrite: [],
    requiredEvents: ["practice.generated", "practice.completed"],
  },
  {
    id: "assessment",
    role: "Records mastery evidence and depth-verification outcomes.",
    capabilities: ["mastery.evaluate", "depth.verify", "research.readiness.gate"],
    memoryRead: ["semantic", "procedural", "reflective"],
    memoryWrite: ["semantic", "procedural"],
    requiredEvents: ["mastery.checkpoint.created", "depth.gate.passed", "depth.gate.failed"],
  },
  {
    id: "revision",
    role: "Detects forgetting risk and proposes spaced reinforcement.",
    capabilities: ["decay.estimate", "revision.propose"],
    memoryRead: ["semantic", "procedural"],
    memoryWrite: [],
    requiredEvents: ["memory.decayed", "revision.proposed"],
  },
  {
    id: "memory",
    role: "Commits memory mutations and distributes accepted memory changes.",
    capabilities: ["memory.commit", "memory.redact", "memory.fanout"],
    memoryRead: ["working", "episodic", "semantic", "procedural", "reflective"],
    memoryWrite: ["working", "episodic", "semantic", "procedural", "reflective"],
    requiredEvents: ["memory.committed", "memory.subscription.fanout"],
  },
  {
    id: "intent",
    role: "Interprets a learner goal into a bounded, confidence-scored intent lease.",
    capabilities: ["intent.interpret", "goal.scope"],
    memoryRead: ["semantic", "reflective"],
    memoryWrite: [],
    requiredEvents: ["intent.received", "intent.interpreted"],
  },
  {
    id: "research",
    role: "Research Agent: maps active frontiers, knowledge gaps, and seed hypotheses for mastered concepts.",
    capabilities: ["research.frontier.map", "research.gap.identify", "research.hypothesis.seed"],
    memoryRead: ["semantic", "reflective"],
    memoryWrite: [],
    requiredEvents: ["surface.research.frontier.detected", "surface.research.frontier.surfaced"],
  },
  {
    id: "motivation",
    role: "Surfaces a motivating message when mastery was barely achieved, sustaining learner momentum.",
    capabilities: ["motivation.surface", "confidence.narrate"],
    memoryRead: ["working", "semantic"],
    memoryWrite: [],
    requiredEvents: ["surface.motivation.surfaced"],
  },
  {
    id: "reflection",
    role: "Guides post-mastery reflection: what connected, what surprised, what to revisit.",
    capabilities: ["reflection.prompt", "metacognition.surface"],
    memoryRead: ["semantic", "episodic", "reflective"],
    memoryWrite: ["reflective"],
    requiredEvents: ["reflection.prompted"],
  },
  {
    id: "debate",
    role: "Challenges a learner's explanation from an adversarial perspective to deepen understanding.",
    capabilities: ["debate.challenge", "explanation.stress_test"],
    memoryRead: ["semantic", "procedural"],
    memoryWrite: [],
    requiredEvents: ["debate.challenge.issued"],
  },
  {
    id: "composer",
    role: "Surface Composer: distills teaching content into the Minimal Complete Cognitive Representation (MCCR) shown on the board, plus a SEPARATE paced narration script and an image decision (UCS, ADR-0030).",
    capabilities: ["mccr.distill", "narration.script", "image.decide", "layout.arrange"],
    memoryRead: ["working", "semantic", "reflective"],
    memoryWrite: [],
    requiredEvents: [
      "surface.frame.composed",
      "surface.narration.script.produced",
      "surface.image.decided",
    ],
  },
  {
    id: "frameplanner",
    role: "Frame Planner: decomposes a concept into progressive Cognitive Frames, sequences and paces them, and prepares discardable look-ahead frames that re-plan on every learner signal (UCS, ADR-0030).",
    capabilities: [
      "frame.decompose",
      "frame.sequence",
      "frame.pace",
      "frame.lookahead",
      "media.plan",
    ],
    memoryRead: ["working", "semantic", "reflective", "procedural"],
    memoryWrite: [],
    requiredEvents: [
      "surface.frame.planned",
      "surface.frame.speculation.prepared",
      "surface.frame.speculation.invalidated",
    ],
  },
  {
    id: "imageplanner",
    role: "Image Agent: decides whether an image benefits a frame, constructs the prompt, and refines it (UCS, ADR-0030).",
    capabilities: ["image.decide", "image.prompt", "image.refine"],
    memoryRead: ["working", "semantic"],
    memoryWrite: [],
    requiredEvents: ["surface.image.decided"],
  },
];

function manifestFrom(seed: ManifestSeed): AgentManifest {
  return {
    id: `agent.${seed.id}`,
    version: "1.0.0",
    abi_version: "1.0.0",
    role: seed.role,
    capabilities: [...seed.capabilities],
    reasoning_engines: { default: "deterministic-stub" },
    memory_access: {
      read: [...seed.memoryRead],
      write: [...seed.memoryWrite],
    },
    policies: ["product-spec-first", "governance-precheck", "reasoning-trace-required"],
    resources: {
      maxConcurrency: 1,
      schedulerPriority:
        seed.id === "supervisor" ? 1 : seed.id === "research" || seed.id === "frameplanner" ? 4 : 5,
    },
    observability: {
      required_events: [...seed.requiredEvents],
      required_traces: ["activation", "proposal", "outcome"],
    },
  };
}

export const MVP_AGENT_MANIFESTS: readonly AgentManifest[] = SEEDS.map(manifestFrom);

export function minimalAgentSet(): MvpAgentId[] {
  return [...MVP_AGENT_IDS];
}
