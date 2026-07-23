/**
 * Vision — why cognition matters, why today's systems fail, and what the Universal Cognitive
 * Infrastructure is. All copy grounded in spec/vision-application/ — the corpus's own argument,
 * written for the web.
 */
import { Page } from "../Page";
import { GlassCard, NextStep, PageHero, Quote, Reveal, Section } from "../primitives";

const FAILURES: readonly { title: string; body: string }[] = [
  {
    title: "Prerequisite blindness",
    body: "A learner struggling with calculus rarely needs better calculus teaching. They need undiagnosed gaps in algebraic intuition rebuilt from foundational number sense. Traditional systems cannot see the dependency tree, so they teach the wrong thing.",
  },
  {
    title: "Fragmented knowledge",
    body: "Education splits reality into disconnected subjects, but nothing in reality is disconnected. The result is superficial understanding — and minds unable to innovate at the intersections where breakthroughs actually happen.",
  },
  {
    title: "No map of the journey",
    body: "Learners have no visibility of where they stand, what is missing, or what comes next. You cannot navigate terrain you cannot see.",
  },
  {
    title: "Passive consumption",
    body: "Understanding is constructed, not delivered. Systems built around content delivery produce recognition, not reasoning.",
  },
  {
    title: "Education stops before contribution",
    body: "Most systems end at competence. The leap from 'I understand this field' to 'I can advance this field' is the most neglected transition in all of education.",
  },
  {
    title: "Amnesiac AI",
    body: "Today's AI answers brilliantly and forgets completely. It optimizes conversations. Nothing compounds. Every session starts from zero.",
  },
];

const LADDER: readonly { stage: string; name: string; text: string; hue: string }[] = [
  {
    stage: "0",
    name: "Ignorance",
    text: "No prior knowledge. No mental models. Honest confusion.",
    hue: "#ff9d6b",
  },
  {
    stage: "1–3",
    name: "Understanding",
    text: "Concepts built layer by layer — intuition first, then visual, conceptual, and formal.",
    hue: "#57c9de",
  },
  {
    stage: "4",
    name: "Mastery",
    text: "Verified depth: explain it, apply it to novel problems, connect it, teach it, find its edges.",
    hue: "#63dfa1",
  },
  {
    stage: "5",
    name: "Innovation",
    text: "Recognizing gaps in what is known. Formulating real research questions.",
    hue: "#a78bff",
  },
  {
    stage: "6",
    name: "Original contribution",
    text: "Producing work that advances the field for everyone.",
    hue: "#ffd98e",
  },
];

const AUDIENCES: readonly { title: string; body: string }[] = [
  {
    title: "Learners",
    body: "From any starting point to genuine, verified mastery — and beyond it. Own your learning curve. Progress from curiosity to mastery to independent research, with a system that remembers how you think.",
  },
  {
    title: "Educators",
    body: "Become co-architects of pedagogy. Your teaching signature — your analogies, pacing, philosophy — shapes the system your students learn from, while you reclaim the human work: mentorship, vision, connection.",
  },
  {
    title: "Researchers",
    body: "A collaborator that maps frontiers, surveys literature, surfaces gaps, and generates testable hypotheses — accelerating the road from question to evidence to contribution.",
  },
  {
    title: "Institutions",
    body: "Institutional memory that survives departures. Cohort understanding made visible with consent. Pedagogy that improves through evidence — degree factories becoming engines of discovery.",
  },
];

export default function VisionPage() {
  return (
    <Page
      title="Vision"
      description="Why cognition matters, why today's education and AI fail to compound understanding, and what the Universal Cognitive Infrastructure is."
      hue="#ffc46b"
      seed={11}
      cinema="/cinema/nebula.webp"
    >
      <PageHero
        eyebrow="Vision"
        canon={<>We have democratized information. We have not democratized understanding.</>}
        gloss="The world's fundamental bottleneck is no longer access to information — it is the ability to transform information into durable understanding that compounds across a lifetime. That is the problem The Inevitable exists to solve."
      />

      <Section kicker="The lineage" title="Every era builds the infrastructure of the next">
        <div className="site-prose">
          <p>
            Transportation moved us. Energy powered us. Communication connected us. Information
            reached everyone. Computation accelerated everything. Each layer of infrastructure made
            the next era of human capability possible — and each looked impossible until it was
            inevitable.
          </p>
          <p>
            The next frontier is the one every other depends on: infrastructure for how humanity{" "}
            <strong>understands, learns, reasons, remembers, researches, and creates</strong>.
            Education is its first manifestation — the place where understanding is first built and
            honestly measured. The ambition runs further: toward lifelong reasoning,
            interdisciplinary research, and laboratories of systematic discovery.
          </p>
        </div>
      </Section>

      <Section kicker="The failure" title="Why understanding doesn't compound today">
        <p className="site-gloss">
          The deepest failure of education is not poor teaching — it is invisible structure. Six
          faults, shared by classrooms and chatbots alike:
        </p>
        <div className="site-grid">
          {FAILURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 60}>
              <GlassCard title={f.title}>
                <p>{f.body}</p>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section kicker="The answer" title="An operating system for human understanding">
        <div className="site-prose">
          <p>
            The Inevitable is not educational software that delivers content. It is a{" "}
            <strong>Cognitive Operating System</strong> — infrastructure that constructs
            understanding. Beneath every learning goal it builds the complete architecture of
            prerequisites, recursively, until every path terminates at intuitions any human already
            holds. No prerequisite is left unstated; no confusion is left untraced to its true
            missing foundation.
          </p>
          <p>
            Knowledge lives as a navigable, interdisciplinary graph — generated for{" "}
            <strong>each learner</strong>, not copied from a syllabus. Explanation adapts through
            seven layers of understanding, from story and intuition to formalism and frontier.
            Memory persists and consolidates, so the system that teaches you in year five knows
            everything it learned about your mind in year one. Understanding, once formed,{" "}
            <strong>compounds</strong>.
          </p>
        </div>
        <Quote source="The Inevitable — mission corpus">
          Most AI systems optimize conversations. The Inevitable optimizes how understanding
          compounds over an entire lifetime.
        </Quote>
      </Section>

      <Section kicker="The whole journey" title="From ignorance to original contribution">
        <p className="site-gloss">
          Education usually ends at competent. The Inevitable is architected for the entire ladder —
          including the climb almost no system attempts.
        </p>
        <ol className="site-ladder">
          {LADDER.map((r) => (
            <Reveal as="li" key={r.name}>
              <span style={{ ["--rung" as string]: r.hue, display: "contents" }}>
                <span className="site-ladder-stage">Stage {r.stage}</span>
                <span className="site-ladder-name">{r.name}</span>
                <span className="site-ladder-text">{r.text}</span>
              </span>
            </Reveal>
          ))}
        </ol>
      </Section>

      <Section kicker="For whom" title="One infrastructure, every mind">
        <div className="site-grid">
          {AUDIENCES.map((a, i) => (
            <Reveal key={a.title} delay={i * 60}>
              <GlassCard title={a.title}>
                <p>{a.body}</p>
              </GlassCard>
            </Reveal>
          ))}
        </div>
        <Quote>
          The objective is not to help people find better answers — it is to help them become better
          thinkers, researchers, and innovators.
        </Quote>
      </Section>

      <Section kicker="The stakes" title="Why this is infrastructure, not an app">
        <div className="site-prose">
          <p>
            Poverty, disease, environmental collapse, conflict — these persist not because solutions
            are impossible, but because we fail to develop enough minds capable of finding them.
            Agriculture scaled food. Industry scaled production. Computing scaled calculation. The
            Internet scaled information.{" "}
            <strong>Universal Cognitive Infrastructure scales understanding</strong> — the one
            resource every other breakthrough depends on.
          </p>
        </div>
      </Section>

      <NextStep
        to="/philosophy"
        title="A vision this large needs principles that refuse to bend."
        cta="Read the philosophy"
      />
    </Page>
  );
}
