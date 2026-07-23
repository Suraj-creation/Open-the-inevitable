/**
 * Philosophy — the manifesto: what the project holds sacred, what it refuses to be, and the values
 * hierarchy it is built on. Grounded in the vision corpus and the constitution (CLAUDE.md §1–2).
 */
import { Page } from "../Page";
import { GlassCard, NextStep, PageHero, Quote, Reveal, Section } from "../primitives";

const VALUES: readonly { over: [string, string]; body: string }[] = [
  {
    over: ["Character", "credentials"],
    body: "Education is measured by the quality of human beings it produces, not the degrees it awards.",
  },
  {
    over: ["Purpose", "position"],
    body: "Learning aligned with meaning, contribution, and impact — not economic climbing.",
  },
  {
    over: ["Wisdom", "wealth"],
    body: "Understanding pursued as a higher good than accumulation.",
  },
  {
    over: ["Contribution", "competition"],
    body: "Collaborative problem-solvers, not competitors hoarding knowledge.",
  },
  {
    over: ["Transparency", "opacity"],
    body: "Every cognitive decision observable, reviewable, and continuously improvable.",
  },
  {
    over: ["Harmony", "hierarchy"],
    body: "No mind made to feel inferior. Every form of honest work carries equal dignity.",
  },
];

const REFUSALS: readonly { title: string; body: string }[] = [
  {
    title: "Not an LLM wrapper",
    body: "The UI is a projection; the runtime is the product. This is infrastructure for how understanding compounds — not a chat window over a model.",
  },
  {
    title: "Not engagement optimization",
    body: "Success is not time-on-app. It is people empowered to create original knowledge and solve meaningful problems. Depth is non-negotiable: speeding up by skipping prerequisites is an architectural violation, not an optimization.",
  },
  {
    title: "Not teacher replacement",
    body: "Educators become co-architects of intelligence — freed from repetition to do the irreplaceably human work: mentorship, vision, connection.",
  },
  {
    title: "Not black-box improvement",
    body: "The system evolves its own pedagogy only through explicit proposals, shadow tests, replay, and rollback. Never a silent update. Never a hidden algorithm.",
  },
  {
    title: "Not data extraction",
    body: "Consent is granular, explicit, and revocable — with full redaction cascading through memory and events. The learner is sovereign over their own cognitive record.",
  },
  {
    title: "Not for the few",
    body: "Designed to democratize the depth of understanding, mentorship, and research capability previously reserved for elites — across age, language, geography, and circumstance.",
  },
];

const LAWS: readonly string[] = [
  "Intelligence is modular, composable, observable, governable, persistent, replayable, and evolvable.",
  "Agents are cognitive runtime containers, not prompts.",
  "Every major interaction flows through protocol-governed events or contracts.",
  "Memory never changes without a typed, evidence-bearing mutation.",
  "Cognition unfolds across time: event sourcing, replay, and causal tracing are core primitives.",
  "Governance is a kernel primitive, not an external moderation layer.",
  "Observability tracks reasoning quality, drift, disagreement, confidence, and learning outcomes.",
  "Self-evolution happens only through governed proposals, evaluation, shadow tests, and rollback.",
  "The system is a substrate; every surface and integration is a manifestation of it.",
];

export default function PhilosophyPage() {
  return (
    <Page
      title="Philosophy"
      description="The principles The Inevitable is built on, the values it holds above convenience, and what it refuses to become."
      hue="#d8b8ad"
      seed={23}
      cinema="/cinema/aurora.webp"
    >
      <PageHero
        eyebrow="Philosophy"
        canon="Education must not merely inform. It must transform."
        gloss="A system that touches how humans think carries obligations deeper than software. These are the commitments The Inevitable is built on — and the things it will not become, at any price."
      />

      <Section kicker="The hierarchy of values" title="What we hold above convenience">
        <div className="site-grid">
          {VALUES.map((v, i) => (
            <Reveal key={v.over[0]} delay={i * 50}>
              <GlassCard
                title={
                  <>
                    {v.over[0]} <span style={{ color: "var(--ink-faint)" }}>over</span> {v.over[1]}
                  </>
                }
              >
                <p>{v.body}</p>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section kicker="Refusals" title="What this will never be">
        <p className="site-gloss">
          A manifesto is defined as much by what it rejects. These refusals are structural — built
          into the architecture, not promised in a policy.
        </p>
        <div className="site-grid">
          {REFUSALS.map((r, i) => (
            <Reveal key={r.title} delay={i * 50}>
              <GlassCard title={r.title}>
                <p>{r.body}</p>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section
        kicker="Architectural law"
        title="Principles enforced by the kernel, not the handbook"
      >
        <p className="site-gloss">
          Values that live in documents decay. Ours live in the substrate — code that violates them
          is invalid even when it works:
        </p>
        <ol className="site-laws">
          {LAWS.map((law, i) => (
            <Reveal as="li" className="site-law" key={i} delay={i * 30}>
              <span className="site-law-n">{String(i + 1).padStart(2, "0")}</span>
              <span className="site-law-text">{law}</span>
            </Reveal>
          ))}
        </ol>
      </Section>

      <Section kicker="The learner's law" title="Thinking partner, never ghostwriter">
        <div className="site-prose">
          <p>
            When a learner creates — an essay, a proof, a research draft — the system assists as a
            thinking partner and every assist is <strong>disclosed</strong>. What the learner
            publishes is exactly what the learner authored; the system's offers travel as honest
            provenance, never as silent co-authorship. The work that carries your name is
            unambiguously yours.
          </p>
        </div>
        <Quote source="Vision corpus">
          To know deeply, to live meaningfully, and to serve wisely — so that every human life
          becomes a force of illumination for the whole of humanity.
        </Quote>
      </Section>

      <NextStep
        to="/surface"
        title="Philosophy becomes real the moment cognition becomes visible."
        cta="See the Cognitive Surface"
      />
    </Page>
  );
}
