---
name: build-anything
description: Use when work in this repository reaches a boundary rather than a keystroke - a session starts or resumes and the BUILD ANYTHING position block shows a boundary, a milestone is being started, closed or advanced, the next action must be chosen, work is pausing, code appears to conflict with a law in CLAUDE.md section 3, or a governing rule looks obsolete. Not for ordinary implementation.
---

# Build Anything

Project control for this repository. Agents already reason well about completeness, law conflicts,
and next actions. What gets lost between sessions is mechanical, and this skill supplies only that:

| Mechanism | What carries it |
|---|---|
| **Trigger** | Hooks in `.claude/settings.json` (they fire on their own). `SessionStart` injects the computed position. Editing `CLAUDE.md`/`CODEX.md`/`AGENTS.md` asks the owner. |
| **Position** | `node .build/bin/ba.mjs status`: computed from git, the tree, and the journal. Never stored, so it cannot go stale. |
| **Intent** | `.build/journal.jsonl`: typed, append-only, commit-bound records of what git cannot answer. Written only through `ba record`. |
| **Criteria** | A milestone's acceptance list is recorded (`criteria`) when it *starts*. A milestone with no list cannot be closed. |
| **Evidence binding** | Every record is stamped with HEAD and a clean/dirty flag. **A green run on a dirty tree is evidence about the tree, not the commit.** A dirty-tree verdict must say what is uncommitted. |

Status claims live in journal `verdict`s or the capability's own tests (governance proposal 002
repoints CLAUDE.md §2 to the journal). `ba view` renders current state on demand. **Never hand-keep a
state file.** The view is generated, and a second written ledger is a second authority.

## The journal: only what git cannot answer

`ba record <kind> --json '{...}'` (`by` is required on every entry; `refs` are pointers, never copies):

| Kind | Required fields | Record it when |
|---|---|---|
| `decision` | `text`, `reasons[]`, `rejected[]?` | a direction is chosen. Rejected options are shown at every session start. |
| `hypothesis` | `text`, `settle` | a belief is being acted on before it is proven |
| `question` | `text` | something only the owner, or an experiment, can answer |
| `non-goal` | `text`, `until?` | something is deliberately left out |
| `criteria` | `milestone`, `items[]` | a milestone starts |
| `verdict` | `milestone`, `result`, `met[]`, `unmet[]`, `gaps[]?` | a gate runs (`references/gate.md`) |
| `stop` | `text`, `next`, `unfinished[]?` | work pauses with the tree or plan mid-flight |
| `next` | see Arbitrate | the next action is chosen |
| `resolve` | `target`, `text` | a question, hypothesis, or criteria list is settled |

Never restate commits, code structure, or `archit/` direction; point at them. Never edit a line;
correct an entry with a new one that `supersedes` it (`ba check` fails on edited history).

## When each check fires

| Boundary | Do |
|---|---|
| Session start shows `!` boundaries | Address them before new work. **Never invent intent for unexplained dirty work.** Ask, or record a `question`. |
| Choosing what to do next | **Arbitrate** (below) |
| A milestone starts | Record `criteria` before implementation |
| Closing or advancing a milestone | `references/gate.md` |
| Work pauses mid-flight | Record a `stop` |
| Code conflicts with a law in `CLAUDE.md` §3 | `references/drift.md` |
| A law looks obsolete, incomplete, or contradictory | `references/govern.md` |
| Work classified Architectural | `references/brief.md` before designing |
| Anything else | Nothing here. Return to normal work. |

No hook ran (another tool, or hooks disabled)? Run `node .build/bin/ba.mjs status` yourself first.

## Arbitrate: choosing the next action

Not a checklist. Reason from the `ba status` evidence, then answer in this shape and record it as
`next`:

```
Do:            <one action>
Why now:       <the evidence that makes it highest-value now, cited from status/journal/code>
Depends on:    <what must be true first; an unanswered owner question blocks, say so>
Reduces:       <which uncertainty or risk this retires>
Alternatives:  <2+ considered, each with why not now>
Not yet:       <what must not be started yet, and what would unlock it>
```

- Blocked on a human decision? Then that decision is the next action. Say what it unblocks.
- An option matching a `rejected` entry needs a citation of what changed, or it is not an option.
- The last `next` shows commits since it was chosen. Check whether it happened before choosing again.

## Lifecycle: delegate the work, keep the boundaries

Each stage has an output contract. Use the named skill if this runtime has it. If it doesn't
(skill sets differ between config dirs), **do the step directly against the same contract**.

| Stage | Output contract | Preferred skill |
|---|---|---|
| Orient | position + boundaries addressed | `ba status` (automatic) |
| Intent | approved design; Spike / Bounded / Architectural | `brainstorming` |
| Criteria | falsifiable acceptance list, recorded | `ba record criteria` |
| Plan | steps with verification per step | `writing-plans` |
| Implement | code + tests that fail without it | `test-driven-development`, `executing-plans`, `subagent-driven-development` |
| Debug | root cause before fix | `systematic-debugging` |
| Verify | evidence bound to a commit | `verification-before-completion` |
| Independent review | judgment by something outside the author | `requesting-code-review`, `/code-review` |
| Architecture / drift | `references/drift.md` run on what changed | this skill |
| Gate | verdict recorded | `references/gate.md` |
| Record + next | `stop` or `next` recorded | Arbitrate |
| Land | branch finished | `finishing-a-development-branch` |

## Escalation triggers

Work is **Architectural**, however small the diff, if it touches:

1. A versioned contract (`packages/protocols/schemas/`, `packages/contracts/`)
2. A durable table or a migration
3. An authority or permission boundary
4. A second owner for a concept that already has one
5. A law in `CLAUDE.md` §3

Triggers 1, 2, and 5 are also detected mechanically (`ba status`, the edit hook). The ratchet is
one-way: discovering a trigger mid-task **upgrades** the path. **Nothing downgrades mid-task.**

## Playbooks

Each is self-contained. Read only the one the boundary names.

- **`references/gate.md`**: acceptance lists, the definition-of-done ladder, verdicts
- **`references/drift.md`**: implemented code against the laws, and the forced ordering
- **`references/govern.md`**: proposing a change to the constitution, never applying one
- **`references/brief.md`**: the whole-system dimension sweep for Architectural work

## Red flags

| Thought | Reality |
|---|---|
| "Tests are green, so the milestone is done" | Green describes a tree. Name the commit, and the consumer of each shipped claim. |
| "I'll record the stop/decision at the end" | Sessions end without warning. Record it when it happens. |
| "The dirty files are obviously X" | Unrecorded intent is unknown. Ask, or record a `question`. |
| "The code violates a law, so fix the code" | Argue the law is out of date **first** (`drift.md`). |
| "The owner approved, so I'll edit CLAUDE.md now" | Proposing and applying are separate turns. The edit hook asks the owner directly. |
| "This is a small change to a schema" | Trigger 1. It is Architectural. |
| "A status file would make this easier" | Rejected (`decision-20261001-d0ea`). Use `ba view`. |
| "I'll fix that journal line" | Append a superseding entry. History is evidence. |
