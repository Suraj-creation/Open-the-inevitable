/**
 * Infrastructure — the credibility page: the ten invariants, the event-sourced substrate, the
 * governance kernel, the adapter law, and the engineering identity. Every claim verifiable in the
 * repo (blueprint §25.4, ADR-0003/0005/0007/0021/0022, IMPLEMENTATION.md).
 */
import { Page } from "../Page";
import { GlassCard, NextStep, PageHero, Quote, Reveal, Section } from "../primitives";

const INVARIANTS: readonly string[] = [
  "No direct agent-to-agent calls without protocol and event visibility.",
  "No memory write without a typed Memory Mutation.",
  "No long-running workflow without an Intent Lease.",
  "No context access without a Context Lease.",
  "No side-effecting tool call without a governance decision.",
  "No agent runtime without manifest, identity, and capability envelope.",
  "No architecture evolution without an Evolution Proposal.",
  "No high-risk output without evidence requirements.",
  "No hidden state mutation outside event sourcing.",
  "No production cognitive unit without an observability contract.",
];

const PILLARS: readonly { title: string; body: string }[] = [
  {
    title: "Event-sourced, deterministically replayable",
    body: "The canonical record is an append-only event log; all state is a pure fold over it. Model outputs are recorded before use and replay never re-invokes a provider — the same session reproduces byte-identically on any machine.",
  },
  {
    title: "Memory as a governed ledger",
    body: "The only legal way memory changes is a typed mutation carrying evidence, confidence, source identity, and reversibility. Consolidation, decay, redaction, and quarantine are first-class operations — not database writes.",
  },
  {
    title: "Governance in the kernel",
    body: "Every decision boundary — admission, dispatch, tool invocation, evolution — passes a typed policy gate. Decisions are auditable and reversible. Pedagogical integrity is enforced architecturally: skipping prerequisites is a violation the kernel refuses.",
  },
  {
    title: "One cognitive bus",
    body: "No component calls another in the dark. Every interaction is a typed, causally-ordered event with identity, hybrid logical time, and governance tags — the nervous system of the whole OS.",
  },
  {
    title: "Observability of thought",
    body: "Reasoning quality, confidence calibration, drift, disagreement, and learning outcomes are continuously measured and emitted as first-class signals — introspection as a kernel primitive, not a logging sidecar.",
  },
  {
    title: "Governed self-evolution",
    body: "The platform improves its own pedagogy through an explicit lifecycle: proposal → deterministic shadow test → governance gate → rollout or idempotent rollback. Every transition is a permanent event. Never a dark update.",
  },
];

export default function InfrastructurePage() {
  return (
    <Page
      title="Infrastructure"
      description="The Cognitive Operating System substrate: ten non-negotiable invariants, event-sourced replay, a governance kernel, typed memory, and a vendor-free adapter architecture."
      hue="#7fa8ff"
      seed={53}
      cinema="/cinema/earth-night.webp"
    >
      <PageHero
        eyebrow="Universal Cognitive Infrastructure"
        canon="Intelligence becomes infrastructure when every act of cognition is a governed, replayable state transition."
        gloss="Beneath the surface is a Cognitive Operating System built the way critical infrastructure is built: typed contracts, event sourcing, deterministic replay, governance in the kernel, and observability of thought itself."
      />

      <Section kicker="The ten invariants" title="Laws the kernel enforces">
        <p className="site-gloss">
          These are not guidelines. Code that violates them is invalid implementation even if it
          works:
        </p>
        <ol className="site-laws">
          {INVARIANTS.map((law, i) => (
            <Reveal as="li" className="site-law" key={i} delay={i * 30}>
              <span className="site-law-n">{String(i + 1).padStart(2, "0")}</span>
              <span className="site-law-text">{law}</span>
            </Reveal>
          ))}
        </ol>
      </Section>

      <Section kicker="The substrate" title="How cognition is engineered">
        <div className="site-grid">
          {PILLARS.map((p, i) => (
            <Reveal key={p.title} delay={i * 50}>
              <GlassCard title={p.title}>
                <p>{p.body}</p>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section kicker="Independence" title="No vendor reaches the substrate">
        <div className="site-prose">
          <p>
            All infrastructure — transport, graph, vector, relational, model, tools, observability,
            workflow — sits behind <strong>eight adapter contracts</strong>. No vendor SDK, model
            client, or store leaks past its adapter; implementations are provisioned at the edge and
            swappable. The entire workspace verifies green with zero live infrastructure: no
            database, no broker, no model API.
          </p>
          <p>
            The substrate/manifestation law is proven mechanically: the platform SDK carries{" "}
            <strong>zero internal dependencies</strong>, and a second manifestation (an MCP server)
            is built purely on it. Every surface — web, API, CLI, protocol — is a projection of the
            same substrate.
          </p>
        </div>
        <div className="site-stats">
          <Reveal>
            <div className="site-stat">
              <span className="site-stat-value">53</span>
              <span className="site-stat-label">Architecture decision records</span>
            </div>
          </Reveal>
          <Reveal delay={50}>
            <div className="site-stat">
              <span className="site-stat-value">27</span>
              <span className="site-stat-label">Packages &amp; apps, spec-governed</span>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="site-stat">
              <span className="site-stat-value">8</span>
              <span className="site-stat-label">Adapter contracts — zero vendor leak</span>
            </div>
          </Reveal>
          <Reveal delay={150}>
            <div className="site-stat">
              <span className="site-stat-value">D3</span>
              <span className="site-stat-label">Deterministic replay, model calls included</span>
            </div>
          </Reveal>
        </div>
        <Quote source="COS blueprint, §25">
          No hidden state mutation outside event sourcing. No production cognitive unit without an
          observability contract.
        </Quote>
      </Section>

      <NextStep
        to="/research"
        title="An architecture built to be studied — and to study itself."
        cta="Explore the research"
      />
    </Page>
  );
}
