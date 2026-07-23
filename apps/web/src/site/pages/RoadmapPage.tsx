/**
 * Roadmap — now / next / horizon, honestly. "Now" is verifiable in the repo (IMPLEMENTATION.md);
 * "horizon" is the multi-decade arc from the vision corpus, stated as intent, not promise.
 */
import { Page } from "../Page";
import { GlassCard, NextStep, PageHero, Quote, Reveal, Section } from "../primitives";

const NOW: readonly { title: string; body: string }[] = [
  {
    title: "The substrate, complete and verified",
    body: "Event-sourced kernel, governed dispatch, typed memory tiers, world-state graph, capability registry, digital-twin lifecycle, governed self-evolution, platform SDK — all shipping, all offline-verifiable, all replay-tested.",
  },
  {
    title: "The Cognitive Surface, live",
    body: "Frames and anchors, word-synced narration, the visible agent ensemble, real five-test mastery grading, prerequisite descent, the constellation path — running end-to-end on live models today.",
  },
  {
    title: "The Source Environment, live",
    body: "PDF, web, code, and video sources with stable anchors; living reference; understanding maps; cognitive theater; multi-source fusion with contradiction detection; grounded frontier; creation; consent-gated contribution; the Knowledge Commons.",
  },
  {
    title: "The design language, law",
    body: "The Cognitive Design Language governs every manifestation — depth planes, state light, motion-as-cognition, glass as instrument — specified, implemented, and versioned like the architecture it dresses.",
  },
];

const NEXT: readonly { title: string; body: string }[] = [
  {
    title: "Durability & scale",
    body: "Streaming with backpressure, durable consent envelopes with revocation cascade, production persistence graduation — the path from live prototype to institution-ready service.",
  },
  {
    title: "The educator & cohort layer",
    body: "Teaching signatures, cohort visibility with consent, institutional memory — educators as co-architects, structurally.",
  },
  {
    title: "The cinematic film",
    body: "The public journey's generated cinema — one visual universe, art-directed shot by shot — composited into the living WebGL world.",
  },
];

const HORIZON: readonly { title: string; body: string }[] = [
  {
    title: "Lifelong cognitive partnership",
    body: "One persistent, consent-governed cognitive model that compounds across decades — learning, career, research, and reflection as one continuous journey.",
  },
  {
    title: "Institutions of discovery",
    body: "Universities, laboratories, and schools with durable institutional memory and evidence-improving pedagogy — centers of original research at every level.",
  },
  {
    title: "The research frontier, industrialized",
    body: "Frontier laboratories dedicated to understanding intelligence itself — and to carrying millions of minds to the edge of what is known.",
  },
];

export default function RoadmapPage() {
  return (
    <Page
      title="Roadmap"
      description="Where The Inevitable stands today — verifiable in the open — and the multi-decade arc it is built for."
      hue="#ffd98e"
      seed={71}
      cinema="/cinema/nebula.webp"
      cinemaPosition="50% 70%"
    >
      <PageHero
        eyebrow="Roadmap"
        canon="Built in the open. Claimed only when verified."
        gloss="This page follows one rule: 'now' means running and replay-tested in the repository; 'next' means specified and scheduled; 'horizon' means intent we are architecting toward — stated plainly, promised to no one."
      />

      <Section kicker="Now" title="What exists and is verified">
        <div className="site-grid">
          {NOW.map((x, i) => (
            <Reveal key={x.title} delay={i * 50}>
              <GlassCard title={x.title} hue="#63dfa1">
                <p>{x.body}</p>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section kicker="Next" title="What is specified and underway">
        <div className="site-grid">
          {NEXT.map((x, i) => (
            <Reveal key={x.title} delay={i * 50}>
              <GlassCard title={x.title} hue="#57c9de">
                <p>{x.body}</p>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section kicker="Horizon" title="What this is for">
        <div className="site-grid">
          {HORIZON.map((x, i) => (
            <Reveal key={x.title} delay={i * 50}>
              <GlassCard title={x.title} hue="#ffd98e">
                <p>{x.body}</p>
              </GlassCard>
            </Reveal>
          ))}
        </div>
        <Quote source="Master vision">
          Success will not be measured by the number of users or products we build, but by the
          number of people empowered to create original knowledge, solve meaningful problems, and
          contribute to humanity's next era of progress.
        </Quote>
      </Section>

      <NextStep
        to="/about"
        title="Who is behind this, and how to reach them."
        cta="About & contact"
      />
    </Page>
  );
}
