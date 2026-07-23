/**
 * Cognitive Surface — the product page: what it is like to learn inside a place where cognition is
 * visible. Every capability described here is real and shipping (F09/F16, ADR-0030, F14, F03).
 */
import { Page } from "../Page";
import { GlassCard, LensFigure, NextStep, PageHero, Quote, Reveal, Section } from "../primitives";

const INSTRUMENTS: readonly { title: string; body: string }[] = [
  {
    title: "The board is sacred",
    body: "Each moment of teaching is one viewport-complete frame holding only distilled anchors — the concept, its definition, the formula, the diagram. Never walls of prose. Never scrolling past your own understanding.",
  },
  {
    title: "The voice teaches",
    body: "A separate narration carries the explanation, synced to the board word by word. As the voice reaches an idea, the idea lights. When it moves on, the periphery recedes.",
  },
  {
    title: "The Thread of Understanding",
    body: "A hairline of light at the edge of the screen is your whole journey — every segment a thought, every node a concept, filled as understanding completes. You always know where you are and what remains.",
  },
  {
    title: "Agents think in the open",
    body: "Explainer, challenger, coach, assessor — a real ensemble works your question concurrently, and when they disagree, you see both views with their reasoning. Scientific discourse, not a hidden vote.",
  },
  {
    title: "Mastery is earned, not clicked",
    body: "Advancement is gated by five tests of depth — explain it, apply it to a novel problem, connect it, teach it, find its edge cases. The system refuses to advance past confusion.",
  },
  {
    title: "Descent to the true gap",
    body: "When you stall, the surface dives into the missing prerequisite — spatially, with a light trail back — repairs the real foundation, and returns you to where you were.",
  },
];

export default function SurfacePage() {
  return (
    <Page
      title="Cognitive Surface"
      description="A living surface where cognition becomes visible: frames and anchors, word-synced narration, a visible agent ensemble, verified mastery, and a constellation of your understanding."
      hue="#57c9de"
      seed={31}
    >
      <PageHero
        eyebrow="The Cognitive Surface"
        canon="A place where thinking is something you can see."
        gloss="Not a chat window. Not a course player. A living medium where concepts take the stage, agents work in the open, memory forms in front of you — and the interface disappears into the act of understanding."
      />

      <Reveal>
        <LensFigure
          src="/cinema/surface-still.webp"
          alt="The Cognitive Surface teaching 'Vector': the concept as a headline anchor, its definition lit by narration, steering verbs, and the Thread of Understanding"
          caption="The real surface, mid-lesson — the concept holds the board, the voice carries the teaching, the Thread records the journey."
        />
      </Reveal>

      <Section kicker="The instruments" title="How a lesson actually feels">
        <div className="site-grid">
          {INSTRUMENTS.map((c, i) => (
            <Reveal key={c.title} delay={i * 50}>
              <GlassCard title={c.title}>
                <p>{c.body}</p>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section kicker="Steering" title="The lesson bends to you, visibly">
        <div className="site-prose">
          <p>
            Five verbs are always within reach —{" "}
            <strong>Interrupt · Go deeper · Simpler · Example · Challenge</strong> — and any anchor
            on the board can be questioned directly. When the surface reshapes an explanation, the
            change animates and the reasoning appears: adaptivity you can watch, confirm, or
            reverse. Nothing about your lesson is ever decided silently.
          </p>
          <p>
            And everything is <strong>replayable</strong>. Every session is an event log you can
            rewind — every decision traceable to the agent, the evidence, and the reasoning that
            produced it. Ask the surface "why did you teach it this way?" and it can show you.
          </p>
        </div>
      </Section>

      <Section kicker="The constellation" title="Your understanding, as a star map">
        <div className="site-prose">
          <p>
            Every concept you master becomes a point of earned light in a constellation that is
            uniquely yours — prerequisites flowing into concepts, bridges crossing between
            disciplines, the frontier glowing faintly at the edge. Mastered ideas visibly{" "}
            <strong>consolidate</strong> into it: knowledge becoming memory, in front of you.
          </p>
        </div>
        <Quote>
          Watch understanding unfold — agents think, concepts take the stage, and a path forms as
          you learn.
        </Quote>
      </Section>

      <NextStep
        to="/source"
        title="And when the knowledge lives in a book, a paper, a codebase, a lecture? The surface reads with you."
        cta="Meet the Source Environment"
      />
    </Page>
  );
}
