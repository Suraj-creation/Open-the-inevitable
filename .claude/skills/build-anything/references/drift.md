# Drift — implemented code against the laws

## Contents

- When this fires
- The forced ordering
- Deciding which side is wrong
- Where the finding goes
- Drift categories
- Worked example

## When this fires

Detection is not the problem. A baseline agent in this repo found a real law conflict, weighed
both sides, and correctly located the deciding authority — without this playbook. What it did not
do was look unprompted, or leave anything behind.

So this fires on a trigger, not on judgment:

- a gate run (always)
- code under review touches a concept named in `CLAUDE.md` §3
- a review, test, or runtime observation contradicts a rule
- resuming work after a gap, on the files that changed

## The forced ordering

**State the case that the law is out of date before recommending either side.**

The default reach is "the code violates the law, fix the code." A baseline agent in this repo
admitted it considered law-obsolescence *"only after I had already picked the finding."* That
ordering bias is what this section exists to break.

Write, in this order:

1. **The rule**, quoted verbatim with its line reference
2. **The code**, quoted with file and line
3. **The case that the code is right and the law is stale** — argued properly, not strawmanned.
   What did the law not anticipate? What has reality shown since it was written?
4. **The case that the law is right and the code is wrong**
5. **What would settle it** — a named experiment, measurement, or reality test, not an opinion
6. **Only now**, a recommendation

If step 3 is one dismissive sentence, you have not done step 3.

## Deciding which side is wrong

The strongest evidence that the *code* is wrong is that it uses the law's own vocabulary for
something the law forbids — naming an edge `verifies_mastery_of` when nothing was verified is the
code convicting itself.

The strongest evidence that the *law* is stale is that the code's behaviour is measurably correct
and the law names no tier for it. That is a real outcome, and it routes to `govern.md`.

Where a reality test in `archit/Universal-Cognitive-Infrastructure.md` §34 applies, name it. A
prediction that can be checked against held-out data settles the question; an argument does not.

## Where the finding goes

A finding that lives only in a transcript did not happen. Every drift finding lands in one of:

- **A fix**, with a test that fails without it
- **A named gap** in `IMPLEMENTATION.md`, if the ceiling is being accepted deliberately
- **A proposal** under `.build/governance/`, if the conclusion is that the law should change
  (see `govern.md`)

Never silently reconcile a contradiction. Surfacing it is the job.

## Drift categories

Classify it; the category determines urgency.

| Category | Looks like |
|---|---|
| Duplicate authority | Two components own one concept |
| Bypassed contract | A path routes around the versioned interface |
| Ephemeral durable state | Cognitive state living in process memory |
| Stage collapse | An actor's report stored as an outcome; inference stored as fact |
| Scaffolding hardened | A temporary workaround that became structural |
| Domain leak | A domain concept inside the kernel or substrate |
| Authority inversion | A surface or UI became the source of truth |

## Worked example

`apps/api/src/host.ts:969` passed `passed: true` to the mastery recorder with evidence reading
*"learner demonstration pending."* In `mastery.ts:81` the five-test depth gate runs only
`if (input.depthTests?.length > 0)`, so with no tests supplied the gate is skipped entirely and
the recorder writes a `verifies_mastery_of` edge and emits `mastery.verified`.

Category: stage collapse. Law: *"an actor's report is never an outcome."*

The case for the law being stale: the call may have intended a readiness signal, and the
verification bar may be aspirational pre-product. What defeats it: the code writes the word
*verified* itself, and `resolveNextConcept` then skips concepts marked mastered — so a learner is
recorded as having mastered something they were never asked about, and the curriculum skips it.

Root cause sits in the shared recorder, not in either caller. One guard there beats a patch at
each call site — and the gate's skip path had no test at all.
