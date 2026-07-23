/**
 * Cognitive Source Environment — real knowledge artifacts becoming living cognitive environments.
 * Every stage described is shipping (ADR-0032…0053): anchors, living reference, understanding map,
 * theater, fusion, claim graph, frontier, creation, contribution, commons.
 */
import { Page } from "../Page";
import { GlassCard, NextStep, PageHero, Quote, Reveal, Section } from "../primitives";

const PIPELINE: readonly { title: string; text: string }[] = [
  {
    title: "Any source becomes cognitive",
    text: "Books, papers, web pages, codebases, videos — any artifact becomes a Cognitive Source with identity, versions, and progressively deepening understanding. No blocking import step; canonicalization follows your attention.",
  },
  {
    title: "Anchors, not page numbers",
    text: "Every reference into a source resolves through a typed, version-stable anchor. Highlights, citations, and narration survive new editions — meaning is addressed, not pixels.",
  },
  {
    title: "The Living Reference",
    text: "The source renders on the surface itself — semantic viewports, meaningful highlights, every paragraph and equation expandable into explanation without leaving the text.",
  },
  {
    title: "The Understanding Map",
    text: "The system infers the meaning inside the source — intent, causality, analogy, abstraction — and tracks how your understanding of it changes with every encounter.",
  },
  {
    title: "The Cognitive Theater",
    text: "A director choreographs how the source is taught: semantic zoom, spotlight, dissolve, hold — the shot grammar of understanding, applied as pedagogy.",
  },
  {
    title: "Fusion & the Claim Graph",
    text: "Many sources reconcile into one environment. Claims are extracted and compared; contradictions surface honestly; the system knows what is established, what is contested, and where the frontier begins.",
  },
  {
    title: "The frontier, grounded",
    text: "Past mastery, the environment surfaces real gaps and unexplored cross-pollinations — cited, web-grounded, honest about uncertainty.",
  },
  {
    title: "Creation",
    text: "You author — essays, proofs, research drafts — with the system as a disclosed thinking partner. Every assist is visible provenance. The work remains unambiguously yours.",
  },
  {
    title: "Contribution & the Knowledge Commons",
    text: "With your explicit consent, a finished creation registers as a first-class Cognitive Source others can learn from, cite, and build on. The system's outputs become its inputs — knowledge turns recursive.",
  },
];

export default function SourcePage() {
  return (
    <Page
      title="Source Environment"
      description="The Cognitive Source Environment: books, papers, code, and video become living, anchored, teachable environments — fused, contradiction-aware, and consent-gated all the way to a shared Knowledge Commons."
      hue="#63dfa1"
      seed={41}
      cinema="/cinema/deep-field.webp"
      cinemaPosition="50% 60%"
    >
      <PageHero
        eyebrow="Cognitive Source Environment"
        canon="Documents end. Sources live."
        gloss="Humanity's knowledge lives in books, papers, codebases, and lectures. The Source Environment turns those artifacts into living cognitive environments — anchored, adaptive, fused across sources, and honest about what is known, contested, and unknown."
      />

      <Section kicker="The pipeline" title="From artifact to living knowledge">
        <ol className="site-pipeline">
          {PIPELINE.map((s, i) => (
            <Reveal as="li" key={s.title} delay={i * 40}>
              <span className="site-pipeline-title">{s.title}</span>
              <span className="site-pipeline-text">{s.text}</span>
            </Reveal>
          ))}
        </ol>
      </Section>

      <Section kicker="The laws" title="Sovereignty is structural">
        <div className="site-grid">
          <Reveal>
            <GlassCard title="The No-Ghostwriter law">
              <p>
                What you contribute is exactly what you authored. The system's assists travel as
                disclosed provenance metadata — never as silent co-writing. The shared, citable work
                is unambiguously human.
              </p>
            </GlassCard>
          </Reveal>
          <Reveal delay={60}>
            <GlassCard title="Consent-gated, always">
              <p>
                Nothing you make is shared automatically. Contribution to the commons is an
                explicit, granular, revocable act — and private work never appears there, for
                anyone.
              </p>
            </GlassCard>
          </Reveal>
          <Reveal delay={120}>
            <GlassCard title="Attribution by architecture">
              <p>
                The commons is a projection of consented contributions — attributed, least-
                disclosure, learner-sovereign. Collective intelligence without surrendering the
                individual mind.
              </p>
            </GlassCard>
          </Reveal>
        </div>
        <Quote>
          A learner's finished work re-enters the shared universe of knowledge — so the next learner
          starts where the last one arrived.
        </Quote>
      </Section>

      <NextStep
        to="/infrastructure"
        title="All of this rests on a substrate where every thought is an event — governed, replayable, observable."
        cta="See the infrastructure"
      />
    </Page>
  );
}
