# Gate — closing or advancing a milestone

## Contents

- Write the acceptance list first
- The evidence-binding rule
- The done ladder
- Judging the tests
- Verdict format
- Worked example (CSE-008)

## Write the acceptance list first

A milestone's acceptance list is recorded **when the milestone starts** (`ba record criteria`), not
when it is being closed. A list written at closing time is a description of what happened, not a
test it could fail.

**If the milestone has no acceptance list, it cannot be closed.** Write the list from what the
milestone set out to do, show it, get agreement, then judge against it. Say plainly that the list
was reconstructed after the fact — that is weaker evidence and the verdict should say so.

Do not source criteria from `spec/`. `CLAUDE.md` §4 declares it paused and uncitable.

Each criterion must be falsifiable: a named test, a named consumer in production code, a runtime
observation, or a measurement. "Works correctly" is not a criterion.

## The evidence-binding rule

**A green run against a dirty tree is evidence about the tree, not about the commit.**

Before quoting any verification result, state:

- which commit SHA the claim covers
- whether the working tree was clean, and if not, what is uncommitted and whether it touches the
  files under review
- whether the tests are hermetic or exercised a live runtime

A suite that stubs the network proves the code path, not the integration. Say which you have.

## The done ladder

These never collapse into each other. Name the highest one that is actually true.

| Rung | Met when |
|---|---|
| Implementation | The code exists and typechecks |
| Test | Its tests exist, assert the intent, and pass |
| Integration | A consumer in production code actually calls it |
| Verification | The acceptance criteria are judged met, against a named commit |
| Architectural | It sits in the right layer, adds no second authority, leaks no vendor type |
| Phase | Every criterion is met and the named gaps are recorded |

**Shipped code with no production consumer is at rung 1, whatever its tests say.** Search for
consumers of every field, flag, or type the milestone introduced. If the only readers are the
milestone's own tests, the feature is dead data and the milestone is PARTIAL.

## Judging the tests

Green is evidence, not proof. For each acceptance criterion ask:

- Could the implementation be wrong while this test still passes?
- Does any test cover the path where the guard is **skipped**? Absent inputs, empty arrays, and
  default branches are where fabricated passes hide.
- Does it test the outcome a user would notice, or only the shape of an object?

A gate that is never exercised by a test is an ungated gate.

## Verdict format

Be short. The verdict is the product.

```
VERDICT: READY | PARTIAL | NOT READY
Evidence binds to: <sha>, tree <clean|dirty: what>
Met:      <criterion> -> <test or consumer>
Unmet:    <criterion> -> <what is missing>
Named gap: <ceiling the milestone ships with, stated deliberately>
To close:  <smallest concrete list>
```

PARTIAL is a normal, respectable outcome. A milestone that ships with a **named** ceiling is
honest; one that ships with an unnamed ceiling is a defect. Record the verdict, with named gaps in
`gaps`, via `ba record verdict`. The record is stamped with HEAD and the tree state, and a dirty-tree
verdict is rejected unless a `refs` entry `tree: <what>` says what is uncommitted.

**Every claimed ceiling must come with a concrete input that reaches it.** Trace the path: this
title, in this book, produces this id, which collides here. If you cannot construct a reachable
case, label it `SUSPECTED` and say what you could not construct — do not state it as a finding.

This is not pedantry. A gate run under this playbook produced a confident cross-book id-collision
ceiling that dissolved on tracing: concepts are deduped by `slug(title)`, and a `-n` suffixed id
only ever exists for a title-slug duplicate, which the dedup pass always skips. Looking harder
finds more real defects **and** more plausible-sounding false ones. Trace before you name.

Never advance because code exists, tests are green, one path works, or the implementation looks
plausible.

## Worked example (CSE-008)

A real gate run in this repo returned PARTIAL on four findings, all verified:

- `coveredBy` / `primarySourceVersionId` were computed and consumed **only by the milestone's own
  tests** — the headline feature was dead data, proven dead by its own test
- concept identity was string equality on a slugged title, so two unrelated chapters sharing a
  title collapse and one is silently never taught — a ceiling, unnamed
- no status was recorded in any of the three sanctioned places
- "verify passes" described a tree carrying ~1,771 uncommitted insertions on a different concern,
  including edits to the file under review

The first and last are the ones a reviewer misses by default. Search for consumers; name the tree.
