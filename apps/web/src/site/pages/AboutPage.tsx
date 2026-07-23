/**
 * About — mission, posture, and contact. Small, calm, human. Future-ready for team/careers/press
 * without pretending to be what it isn't yet.
 */
import { Page } from "../Page";
import { GlassCard, NextStep, PageHero, Quote, Reveal, Section } from "../primitives";

export default function AboutPage() {
  return (
    <Page
      title="About"
      description="The mission behind The Inevitable — Universal Cognitive Infrastructure — and how to reach the people building it."
      hue="#57c9de"
      seed={83}
      cinema="/cinema/earth-night.webp"
      cinemaPosition="50% 65%"
    >
      <PageHero
        eyebrow="About"
        canon="A long-term effort to change what a mind can become."
        gloss="The Inevitable is being built as infrastructure — spec-first, governed, in the open of its own repository — by people who believe the renaissance of human understanding is an engineering problem worth a lifetime."
      />

      <Section kicker="Mission" title="Why we exist">
        <div className="site-prose">
          <p>
            To build the world's first <strong>Universal Cognitive Infrastructure</strong> — a
            lifelong cognitive system in which understanding, memory, reasoning, and research
            continuously compound throughout a person's life. Beginning with education, extending to
            research and institutions, and ultimately to laboratories dedicated to understanding
            intelligence itself.
          </p>
        </div>
        <Quote>
          Be a warrior like Life — transform every sector on this planet, and initiate the most
          sustainable, revolutionized world of innovations for every one of them.
        </Quote>
      </Section>

      <Section kicker="Posture" title="How we work">
        <div className="site-grid">
          <Reveal>
            <GlassCard title="Spec-first">
              <p>
                Specifications are executable law. Every capability traces to a governing spec;
                implementation that violates the spec is invalid even when it works.
              </p>
            </GlassCard>
          </Reveal>
          <Reveal delay={60}>
            <GlassCard title="Verified, always">
              <p>
                One command verifies the entire system — types, tests, contracts, replay — with zero
                live infrastructure. Green is the only definition of done.
              </p>
            </GlassCard>
          </Reveal>
          <Reveal delay={120}>
            <GlassCard title="Honest by architecture">
              <p>
                Degradation is visible, disagreement is public, consent is structural, and every
                claim on this site is checkable against the repository.
              </p>
            </GlassCard>
          </Reveal>
        </div>
      </Section>

      <Section kicker="Contact" title="Reach the work">
        <div className="site-prose">
          <p>
            For research collaboration, institutional pilots, press, or joining the effort:{" "}
            <strong>
              <a className="site-mail" href="mailto:hello@theinevitable.org">
                hello@theinevitable.org
              </a>
            </strong>
            . We read everything; we reply to substance.
          </p>
        </div>
      </Section>

      <NextStep
        to="/enter"
        title="The fastest way to understand it is to watch it think."
        cta="Enter the surface"
      />
    </Page>
  );
}
