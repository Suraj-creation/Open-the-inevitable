/**
 * Agent identity — agents are visible cognitive characters, not gray metadata.
 *
 * Each role gets a stable identity: a name, a one-word role, an accent, and a geometric SIGIL
 * (a mark, never a cartoon avatar — the specs forbid gamified spectacle). Keyed by role with an
 * agent_id fallback, so presence/provenance always resolve to a recognisable presence.
 */
export interface AgentIdentity {
  readonly key: string;
  readonly label: string;
  readonly role: string;
  /** A CSS custom property reference for this agent's accent. */
  readonly accent: string;
  /** A geometric glyph used as the agent's mark. */
  readonly sigil: string;
}

const REGISTRY: Record<string, AgentIdentity> = {
  explainer: {
    key: "explainer",
    label: "Explainer",
    role: "explanation",
    accent: "var(--agent-explainer)",
    sigil: "◈",
  },
  explanation: {
    key: "explainer",
    label: "Explainer",
    role: "explanation",
    accent: "var(--agent-explainer)",
    sigil: "◈",
  },
  supervisor: {
    key: "supervisor",
    label: "Supervisor",
    role: "orchestration",
    accent: "var(--agent-supervisor)",
    sigil: "✦",
  },
  coach: {
    key: "coach",
    label: "Coach",
    role: "practice",
    accent: "var(--agent-coach)",
    sigil: "▲",
  },
  practice: {
    key: "coach",
    label: "Coach",
    role: "practice",
    accent: "var(--agent-coach)",
    sigil: "▲",
  },
  assessor: {
    key: "assessor",
    label: "Assessor",
    role: "assessment",
    accent: "var(--agent-assessor)",
    sigil: "⬡",
  },
  assessment: {
    key: "assessor",
    label: "Assessor",
    role: "assessment",
    accent: "var(--agent-assessor)",
    sigil: "⬡",
  },
  socratic: {
    key: "socratic",
    label: "Socratic",
    role: "inquiry",
    accent: "var(--agent-socratic)",
    sigil: "❖",
  },
  research: {
    key: "research",
    label: "Research",
    role: "frontier",
    accent: "var(--agent-research)",
    sigil: "✶",
  },
  curriculum: {
    key: "curriculum",
    label: "Curriculum",
    role: "planning",
    accent: "var(--agent-supervisor)",
    sigil: "◆",
  },
  revision: {
    key: "revision",
    label: "Challenger",
    role: "revision",
    accent: "var(--agent-socratic)",
    sigil: "◇",
  },
  composer: {
    key: "composer",
    label: "Composer",
    role: "surface-composition",
    accent: "var(--agent-explainer)",
    sigil: "❐",
  },
  frameplanner: {
    key: "frameplanner",
    label: "Planner",
    role: "frame-planning",
    accent: "var(--agent-supervisor)",
    sigil: "▦",
  },
  imageplanner: {
    key: "imageplanner",
    label: "Illustrator",
    role: "image-cognition",
    accent: "var(--agent-coach)",
    sigil: "◨",
  },
};

const FALLBACK: AgentIdentity = {
  key: "agent",
  label: "Agent",
  role: "cognition",
  accent: "var(--accent)",
  sigil: "○",
};

/** Resolve an identity from a role label or an agent id (e.g. "explainer", "explanation", a CID). */
export function identityFor(roleOrId: string | null | undefined): AgentIdentity {
  if (!roleOrId) return FALLBACK;
  const direct = REGISTRY[roleOrId.toLowerCase()];
  if (direct) return direct;
  // CIDs like "cog-exp-demo" — match on a contained role token.
  const lower = roleOrId.toLowerCase();
  for (const key of Object.keys(REGISTRY)) {
    if (lower.includes(key)) return REGISTRY[key] as AgentIdentity;
  }
  if (lower.includes("exp")) return REGISTRY["explanation"] as AgentIdentity;
  if (lower.includes("sup")) return REGISTRY["supervisor"] as AgentIdentity;
  if (lower.includes("prc") || lower.includes("prac")) return REGISTRY["practice"] as AgentIdentity;
  if (lower.includes("assess")) return REGISTRY["assessment"] as AgentIdentity;
  return { ...FALLBACK, label: roleOrId };
}
