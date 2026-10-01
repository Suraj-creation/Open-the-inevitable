import type { FacultyRequest, FacultyResponse, ModelFaculty } from "@uci/harness";

/**
 * A deterministic, rule-based reasoner for the tutoring environment, used as the CI faculty. It is a
 * test double for the model in exactly one sense — it is not a neural network — and in no other: it
 * receives ONLY the rendered request (system + prompt text), never the store or the working-state
 * object. Whatever it does, it could do only because the recorded context carried that information.
 * It does its own fraction arithmetic to diagnose answers; it never sees an answer key.
 */
export class ScriptedTutorFaculty implements ModelFaculty {
  readonly id: string;
  readonly model = "scripted-tutor-policy@1";

  constructor(id = "scripted-tutor@1") {
    this.id = id;
  }

  async respond(request: FacultyRequest): Promise<FacultyResponse> {
    const text = JSON.stringify(decide(parse(request.prompt)));
    return {
      text,
      usage: {
        inTokens: Math.ceil((request.system.length + request.prompt.length) / 4),
        outTokens: Math.ceil(text.length / 4),
      },
    };
  }
}

// ---------------------------------------------------------------- reading the rendered context

interface Seen {
  step: number;
  entity: string;
  objectiveId?: string;
  decisions: { id: string; choice: string; revised: boolean }[];
  openDecisions: { id: string; question: string }[];
  claims: { ref: string; proposition: string; stale: boolean }[];
  questions: { id: string; text: string }[];
  inputs: { id: string; replyTo?: string; content: string }[];
  observations: { id: string; action: string; content: string }[];
  practice: { id: string; a: [number, number]; b: [number, number] }[];
  probes: string[];
  bridge: boolean;
}

function section(prompt: string, title: string): string[] {
  const lines = prompt.split("\n");
  const start = lines.findIndex((l) => l.startsWith(`## ${title}`));
  if (start < 0) return [];
  const out: string[] = [];
  for (const l of lines.slice(start + 1)) {
    if (l.startsWith("## ")) break;
    out.push(l);
  }
  return out;
}

function parse(prompt: string): Seen {
  const head = /process \S+ \(step (\d+)\), entity (\S+)/.exec(prompt);
  const decisions: Seen["decisions"] = [];
  for (const l of section(prompt, "Decisions in force")) {
    const m = /^- (\S+): choice "(.*?)"\./.exec(l);
    if (m?.[1]) decisions.push({ id: m[1], choice: m[2] ?? "", revised: false });
    else if (l.includes("PREMISE REVISED") && decisions.length)
      (decisions.at(-1) as { revised: boolean }).revised = true;
  }
  const claims: Seen["claims"] = [];
  for (const l of section(prompt, "Claims (current)")) {
    const m = /^- (\S+@v\d+) \(.*?\): "(.*?)"/.exec(l);
    if (m?.[1]) claims.push({ ref: m[1], proposition: m[2] ?? "", stale: false });
    else if (l.includes("STALE") && claims.length)
      (claims.at(-1) as { stale: boolean }).stale = true;
  }
  const evidence = section(prompt, "Recent learner and environment evidence");
  return {
    step: Number(head?.[1] ?? 1),
    entity: head?.[2] ?? "learner",
    objectiveId: /## Objective (\S+)/.exec(prompt)?.[1],
    decisions,
    openDecisions: section(prompt, "Open decisions").flatMap((l) => {
      const m = /^- (\S+): "(.*?)"/.exec(l);
      return m?.[1] ? [{ id: m[1], question: m[2] ?? "" }] : [];
    }),
    claims,
    questions: section(prompt, "Open questions").flatMap((l) => {
      const m = /^- (\S+) \(asked of \w+\): "(.*)"/.exec(l);
      return m?.[1] ? [{ id: m[1], text: m[2] ?? "" }] : [];
    }),
    inputs: evidence.flatMap((l) => {
      const m = /^- (I\d+) \((?:learner|person)(?:, reply to (\S+?))?\): (".*")$/.exec(l);
      return m?.[1]
        ? [
            {
              id: m[1],
              ...(m[2] ? { replyTo: m[2] } : {}),
              content: JSON.parse(m[3] ?? '""') as string,
            },
          ]
        : [];
    }),
    observations: evidence.flatMap((l) => {
      const m = /^- (X\S+) \(environment, after (\w+)\): (".*")$/.exec(l);
      return m?.[1]
        ? [{ id: m[1], action: m[2] ?? "", content: JSON.parse(m[3] ?? '""') as string }]
        : [];
    }),
    practice: section(prompt, "Practice items").flatMap((l) => {
      const m = /^- (i-\d+): (\d+)\/(\d+) \+ (\d+)\/(\d+) = \?/.exec(l);
      return m?.[1]
        ? [
            {
              id: m[1],
              a: [Number(m[2]), Number(m[3])] as [number, number],
              b: [Number(m[4]), Number(m[5])] as [number, number],
            },
          ]
        : [];
    }),
    probes: (/oldest first: (.*)\./.exec(prompt)?.[1] ?? "")
      .split(", ")
      .filter((x) => x === "held" || x === "failed" || x === "indeterminate"),
    bridge: prompt.includes("## Decisions in force"),
  };
}

// ---------------------------------------------------------------- reasoning

const gcd = (x: number, y: number): number => (y === 0 ? x : gcd(y, x % y));
const red = (n: number, d: number): string => `${n / gcd(n, d)}/${d / gcd(n, d)}`;
const fraction = (t: string): string | undefined => {
  const m = /(\d+)\s*\/\s*(\d+)/.exec(t);
  return m ? red(Number(m[1]), Number(m[2])) : undefined;
};

function decide(s: Seen) {
  const lastDecision = s.decisions
    .filter((d) => !/^(revise|withdraw|reaffirm) /.test(d.choice))
    .at(-1);
  const reexamines = s.decisions
    .filter((d) => d.revised)
    .map((d) => ({
      decision_id: d.id,
      verdict: "revise",
      reason: "a claim it relied on was superseded by newer evidence",
    }));
  const claims: {
    subject: string;
    proposition: string;
    confidence: number;
    evidence: string[];
    valid_for_days?: number;
    revises?: string;
  }[] = [];
  const questionsClosed: { question_id: string; reason: string }[] = [];

  // Diagnose practice answers with our own arithmetic.
  const practiceObs = s.observations.filter((o) => o.action === "practice");
  const diagnosed = practiceObs.flatMap((o) => {
    const item = s.practice.find((p) => o.content.includes(`item ${p.id} `));
    const answer = s.inputs.find((i) => i.replyTo === o.id);
    if (!item || !answer) return [];
    const given = fraction(answer.content);
    const correct = red(item.a[0] * item.b[1] + item.b[0] * item.a[1], item.a[1] * item.b[1]);
    const addsDenominators = red(item.a[0] + item.b[0], item.a[1] + item.b[1]);
    return [
      {
        item: item.id,
        input: answer.id,
        correct: given === correct,
        misconception: given === addsDenominators,
      },
    ];
  });
  const misconceptionClaim = s.claims.find(
    (c) => /adds denominators/i.test(c.proposition) && !/does not/i.test(c.proposition),
  );
  const timesClaim = s.claims.find((c) => /multiplication facts/i.test(c.proposition));
  const correction = s.inputs.find(
    (i) => !i.replyTo && /(don'?t|do not|never) add|copied|slip|typo/i.test(i.content),
  );

  if (
    !misconceptionClaim &&
    !s.claims.some((c) => /does not add denominators/i.test(c.proposition))
  ) {
    const wrong = diagnosed.find((d) => d.misconception);
    if (wrong)
      claims.push({
        subject: s.entity,
        proposition: "The learner adds denominators when adding fractions (misconception).",
        confidence: 0.6,
        evidence: [wrong.input],
        valid_for_days: 14,
      });
  }
  if (correction && misconceptionClaim)
    claims.push({
      subject: s.entity,
      proposition:
        "The learner does not add denominators; the earlier wrong answer was a slip, by the learner's own statement.",
      confidence: 0.8,
      evidence: [correction.id],
      revises: misconceptionClaim.ref,
    });

  // Questions answered since they were asked are closed with the answer as the reason.
  for (const q of s.questions) {
    const askStep = q.id.slice(1);
    const answer = s.inputs.find((i) => i.replyTo?.startsWith(`X${askStep}-`));
    if (answer) {
      questionsClosed.push({ question_id: q.id, reason: `answered by ${answer.id}` });
      if (/times tables|multiplication/i.test(q.text) && /yes/i.test(answer.content))
        claims.push({
          subject: s.entity,
          proposition: "The learner is fluent with multiplication facts up to 10x10.",
          confidence: 0.7,
          evidence: [answer.id],
          valid_for_days: 3,
          ...(timesClaim ? { revises: timesClaim.ref } : {}),
        });
    }
  }

  // Rely only on claims that are current, fresh, and not being revised by this very proposal.
  const usable = (
    c: { ref: string; stale: boolean } | undefined,
  ): c is { ref: string; stale: boolean; proposition: string } =>
    !!c && !c.stale && !claims.some((n) => n.revises === c.ref);
  const prerequisite = usable(timesClaim) ? [timesClaim.ref] : [];
  const misconceptionStands = !!misconceptionClaim && !correction;
  const misconceptionRef =
    misconceptionStands && usable(misconceptionClaim) ? [misconceptionClaim.ref] : [];
  // What the learner was told lives in the typed state and in recent observations; the typed state wins.
  const explained =
    s.observations.some((o) => o.action === "explain") ||
    s.decisions.some((d) => d.choice.startsWith("explain"));
  const correctPractice = diagnosed.filter((d) => d.correct).length;
  const asked =
    !!timesClaim || s.observations.some((o) => o.action === "ask_person") || s.questions.length > 0;
  const openAssessDecision = s.openDecisions.find((d) => /assessment/i.test(d.question));

  let action: { type: string; item_id?: string; content?: string };
  let relies: string[] = [];
  let choice: string;
  let alternatives: { option: string; probability: number; rejected_because?: string }[];
  let expectation: { statement: string; probability: number } | undefined;
  let openDecision: object | undefined;
  let resolves: string | undefined;

  const held = s.probes.slice(-3);
  if (held.length === 3 && held.every((o) => o === "held")) {
    action = { type: "conclude" };
    choice = "conclude: acceptance holds on three consecutive environment-selected probes";
    alternatives = [
      { option: "conclude", probability: 0.9 },
      { option: "one more probe", probability: 0.1, rejected_because: "acceptance already holds" },
    ];
  } else if (
    timesClaim?.stale &&
    !s.questions.some((q) => /times tables|multiplication/i.test(q.text))
  ) {
    action = {
      type: "ask_person",
      content: "Quick check: do you still know your times tables (multiplication facts up to 10)?",
    };
    choice = "re-validate the stale belief about multiplication fluency before relying on it";
    alternatives = [
      { option: "re-validate first", probability: 0.8 },
      { option: "proceed without it", probability: 0.2, rejected_because: "the belief has lapsed" },
    ];
  } else if (!asked) {
    action = {
      type: "ask_person",
      content: "Before we start: do you know your times tables (multiplication facts up to 10)?",
    };
    choice = "check the prerequisite (multiplication facts) before teaching";
    alternatives = [
      { option: "check prerequisite", probability: 0.6 },
      {
        option: "start practice directly",
        probability: 0.4,
        rejected_because: "a missing prerequisite would confound diagnosis",
      },
    ];
  } else if (misconceptionStands && !explained) {
    action = {
      type: "explain",
      content:
        "To add fractions with unlike denominators, first rewrite both over a common denominator, then add only the numerators. Example: 1/2 + 1/3 = 3/6 + 2/6 = 5/6.",
    };
    relies = [...misconceptionRef];
    choice =
      "remediate the adds-denominators misconception with a common-denominator worked example";
    alternatives = [
      { option: "worked example", probability: 0.6 },
      { option: "area model", probability: 0.3, rejected_because: "slower for this learner" },
      {
        option: "more practice first",
        probability: 0.1,
        rejected_because: "the misconception would repeat",
      },
    ];
  } else if (correctPractice < 2) {
    const used = new Set(
      practiceObs.map((o) => s.practice.find((p) => o.content.includes(`item ${p.id} `))?.id),
    );
    const next = s.practice.find((p) => !used.has(p.id)) ?? s.practice[0];
    action = { type: "practice", item_id: next?.id ?? "i-1" };
    relies = [...prerequisite, ...misconceptionRef];
    choice = `practice ${next?.id}`;
    alternatives = [
      { option: "practice", probability: 0.7 },
      { option: "assess", probability: 0.3, rejected_because: "not enough correct practice yet" },
    ];
    expectation = {
      statement: `The learner answers ${next?.id} correctly.`,
      probability: misconceptionStands ? 0.3 : 0.75,
    };
    if (!openAssessDecision && s.bridge)
      openDecision = {
        question: "When to move from practice to assessment",
        alternatives: [
          { option: "continue practice", probability: 0.6 },
          { option: "assess", probability: 0.4 },
        ],
        pending_on: [],
      };
  } else {
    action = { type: "assess" };
    relies = [...prerequisite];
    choice = "assess on the next environment-selected probe";
    alternatives = [
      { option: "assess", probability: 0.7 },
      {
        option: "continue practice",
        probability: 0.3,
        rejected_because: "two correct practice answers already",
      },
    ];
    expectation = { statement: "The learner answers the next probe correctly.", probability: 0.8 };
    if (openAssessDecision) resolves = openAssessDecision.id;
  }

  return {
    restatement: {
      objective_id: s.objectiveId ?? "",
      ...(lastDecision ? { rationale_decision_id: lastDecision.id } : {}),
      why: "the learner must reach verified mastery on environment-selected probes",
    },
    reexamines,
    decision: {
      choice,
      alternatives,
      relies_on: relies,
      rationale: choice,
      ...(resolves ? { resolves_open_decision_id: resolves } : {}),
    },
    ...(openDecision ? { open_decision: openDecision } : {}),
    action,
    ...(expectation ? { expectation } : {}),
    claims,
    questions_closed: questionsClosed,
  };
}
