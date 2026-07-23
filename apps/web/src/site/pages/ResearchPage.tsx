/**
 * Research — the scientific posture: learning science grounding, the evaluation layer, the five
 * emergent cognitive layers, and the bridge from mastery to original contribution (UALRCI, F10).
 */
import { Page } from "../Page";
import { GlassCard, NextStep, PageHero, Quote, Reveal, Section } from "../primitives";

const LAYERS: readonly { title: string; body: string }[] = [
  {
    title: "1 · Cognitive capability",
    body: "Reusable cognitive functions — intent, planning, reflection, retrieval, synthesis, assessment — composed into agents. Capabilities are the unit of reuse; agents are personas over them.",
  },
  {
    title: "2 · Cognitive evaluation",
    body: "Reasoning, memory, planning, and research quality measured continuously against rubrics and benchmarks. This layer is what makes verified mastery — and safe self-evolution — trustworthy.",
  },
  {
    title: "3 · Knowledge",
    body: "Provenance, validity, and lifecycle as typed properties of the knowledge graph: creation, validation, integration, evolution, decay. The system knows how it knows.",
  },
  {
    title: "4 · Research",
    body: "Hypothesis tracking, evidence stores, experiment registries, research graphs — infrastructure for discovery itself, governed like all cognition.",
  },
  {
    title: "5 · Autonomous improvement",
    body: "The recursive apex: the platform applying its own layers to itself — deliberately last, and multiply gated, because structural self-modification is the highest-risk capability in the system.",
  },
];

export default function ResearchPage() {
  return (
    <Page
      title="Research"
      description="The research posture of The Inevitable: learning-science grounding, a continuous cognitive evaluation layer, five emergent cognitive layers, and the pipeline from mastery to original contribution."
      hue="#a78bff"
      seed={61}
      cinema="/cinema/deep-field.webp"
    >
      <PageHero
        eyebrow="Research · The Frontier Lab"
        canon="A system that studies understanding — including its own."
        gloss="The Inevitable is a research organization as much as an engineering one: grounded in the learning sciences, instrumented to measure its own reasoning, and pointed — deliberately, over decades — toward laboratories where discovery itself becomes systematic."
      />

      <Section kicker="Grounding" title="Built on the science of how humans learn">
        <div className="site-prose">
          <p>
            The surface's design is validated against the multimedia-learning corpus — signaling,
            dual coding, extraneous-load minimization — and its core doctrines are learning science
            made structural: <strong>prerequisite resolution</strong> before advancement,{" "}
            <strong>seven layers of understanding</strong> from intuition to formalism,{" "}
            <strong>five-test depth verification</strong> instead of completion, spaced
            reinforcement driven by decay modeling, and confusion treated as signal, never failure.
          </p>
          <p>
            Every learning session doubles as evidence: reasoning traces, calibration curves, drift,
            and outcome statistics are continuously emitted — a live laboratory for the science of
            understanding, with consent and privacy engineered in from the kernel.
          </p>
        </div>
      </Section>

      <Section kicker="The five layers" title="Cognition, evaluated and evolving">
        <div className="site-grid">
          {LAYERS.map((l, i) => (
            <Reveal key={l.title} delay={i * 50}>
              <GlassCard title={l.title}>
                <p>{l.body}</p>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section kicker="The frontier pipeline" title="From understanding a field to advancing it">
        <div className="site-prose">
          <p>
            After verified mastery, the environment changes posture: gap analyses over the claim
            graph, unexplored cross-pollinations between disciplines, hypothesis generation with
            novelty checking, and scaffolded contribution drafting — with the No-Ghostwriter law
            guaranteeing the resulting work is the learner's own. The goal is measured in a number
            no learning platform has ever optimized:{" "}
            <strong>original contributions produced per mind, per lifetime.</strong>
          </p>
        </div>
        <Quote>
          Education usually ends at competent. The most valuable transition in education — from “I
          understand this field” to “I can advance it” — is the one we architected for.
        </Quote>
      </Section>

      <Section kicker="The direction" title="Toward autonomous deep research">
        <div className="site-prose">
          <p>
            The architecture already contains the organs a research laboratory needs: hypothesis
            tracking, evidence stores, experiment registries, claim graphs that know what is
            established and what is contested, and an evaluation layer that scores reasoning itself.
            The direction of the work — stated as direction, not as claim — is to compose them into{" "}
            <strong>frontier laboratories</strong>: systems that form their own hypotheses at the
            edge of the claim graph, gather and weigh evidence across disciplines, run governed
            experiments, and surface candidate discoveries with every step of reasoning visible and
            replayable.
          </p>
          <p>
            Autonomy here never means opacity. The same laws that govern a lesson govern a
            discovery: every inference an event, every claim carrying provenance, every
            self-improvement passing shadow tests and rollback. A laboratory that can explain itself
            — working alongside human researchers, never in place of them.
          </p>
        </div>
      </Section>

      <NextStep
        to="/roadmap"
        title="Where the work stands today — honestly."
        cta="Read the roadmap"
      />
    </Page>
  );
}
