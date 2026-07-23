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
  "representation",
  "canonicalizer",
  "meaning",
  "claim",
  "synthesis",
  "frontier",
  "temporal",
  "creation",
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
  {
    id: "representation",
    role: "Representation Intelligence Agent (RIA): classifies each board element by the KIND of knowledge it carries (epistemic role) and its representational hierarchy, names exclusions, and records learner adaptation — planning over the closed MCCR vocabulary, never drawing (CSE-018, ADR-0058).",
    capabilities: ["representation.plan", "representation.role", "representation.density"],
    memoryRead: ["working", "semantic"],
    memoryWrite: [],
    requiredEvents: ["surface.representation.planned"],
  },
  {
    id: "canonicalizer",
    role: "Source Canonicalizer: constructs the deeper understanding layers of a Canonical Source Environment — the semantic layer (concepts, definitions, prerequisite relations, terminology) and the citation layer (references, lineage) — grounded strictly in structural regions, never outside knowledge (CSE-002, ADR-0032). Privileged: reshapes the shared knowledge graph.",
    capabilities: [
      "source.layer.semantic",
      "source.layer.citation",
      "concept.extract",
      "citation.extract",
    ],
    memoryRead: ["working", "semantic"],
    memoryWrite: [],
    requiredEvents: ["source.layer.constructed"],
  },
  {
    id: "meaning",
    role: "Meaning Representation: infers what a passage is trying to do to a mind — intent, analogies (and where they break), predictable misconceptions with diagnostic probes, and faithful compressions — as typed MeaningUnits grounded in structural regions and extracted concepts, never outside knowledge presented as the source's claim (CSE-003, ADR-0037). Privileged: reshapes shared understanding candidates.",
    capabilities: [
      "source.layer.meaning",
      "meaning.intent",
      "meaning.analogy",
      "meaning.misconception",
      "meaning.compression",
    ],
    memoryRead: ["working", "semantic"],
    memoryWrite: [],
    requiredEvents: ["source.layer.constructed"],
  },
  {
    id: "claim",
    role: "Claim Reasoner: extracts the claims a source actually makes — grounded in its regions, typed by epistemic status — and detects genuine cross-source contradictions, classifying each disagreement's nature (empirical, interpretive, value) and never presenting a value/interpretive difference as a factual one, nor fabricating a contradiction where there is none (CSE-006 §3.1, ADR-0041). Privileged: writes the shared Claim Graph.",
    capabilities: [
      "source.claim.extract",
      "source.claim.contrast",
      "claim.epistemics",
      "contradiction.detect",
    ],
    memoryRead: ["working", "semantic"],
    memoryWrite: [],
    requiredEvents: ["source.claim.recorded"],
  },
  {
    id: "synthesis",
    role: "Fusion Synthesizer: weaves many sources' treatments, claims, and disagreements into ONE fused explanation of a concept — grounded strictly in the provided sources (never outside knowledge), citing every source it draws on, and surfacing cross-source disagreement honestly rather than flattening it into a false consensus (CSE-015 §3.1, ADR-0042). Privileged: composes shared fused understanding.",
    capabilities: ["source.fusion.synthesize", "explanation.weave", "provenance.cite"],
    memoryRead: ["working", "semantic"],
    memoryWrite: [],
    requiredEvents: ["source.fusion.synthesized"],
  },
  {
    id: "frontier",
    role: "Frontier Researcher: connects a concept to the living edge of its field — latest research, open questions, competing theories, future directions — via governed web search, admitting a frontier point only when a real, fetchable citation backs it (no citable origin, no entry; never a fabricated citation — CSE-006 §3.2/§4/§6, ADR-0043). Privileged: reaches outside the learner's sources under capability-enveloped web access.",
    capabilities: ["source.frontier.research", "web.search", "provenance.cite"],
    memoryRead: ["working", "semantic"],
    memoryWrite: [],
    requiredEvents: ["source.frontier.updated"],
  },
  {
    id: "temporal",
    role: "Temporal Researcher: builds a concept's trajectory through time — origin, milestones, paradigm shifts, current debate, open problems — via governed web search, admitting an epistemic state only when a real citation backs it and never inventing a date; timelines stay honestly sparse (a niche concept shows a short strip, never padded history — CSE-006 §3.3/§8, ADR-0044). Privileged: reaches outside the learner's sources under capability-enveloped web access.",
    capabilities: ["source.timeline.research", "web.search", "provenance.cite"],
    memoryRead: ["working", "semantic"],
    memoryWrite: [],
    requiredEvents: ["source.timeline.updated"],
  },
  {
    id: "creation",
    role: "Creation Partner: a thinking partner for the learner's own creation, NEVER a ghostwriter (Constitution #5). It offers only disclosed assists — scaffold (empty structure the learner fills), critique (adversarial findings on the learner's draft, never a rewrite), provocation (generative questions that widen the space, never answers), and reference (grounded pointers to cite). It cannot and does not produce the learner's artifact (CSE-016 §2, ADR-0049). Privileged: composes shared creative-cognition scaffolds + critiques.",
    capabilities: [
      "source.creation.assist",
      "creation.scaffold",
      "creation.critique",
      "creation.provoke",
    ],
    memoryRead: ["working", "semantic"],
    memoryWrite: [],
    requiredEvents: ["source.creation.started"],
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
