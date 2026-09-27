---
name: build-anything
description: Use when work in this repository reaches a boundary rather than a keystroke - a milestone is being closed or advanced, project position must be recorded or recovered after a gap, implemented code appears to conflict with a law in CLAUDE.md section 3, or a governing rule looks obsolete. Not for ordinary implementation.
---

# Build Anything

## What this owns, and what it does not

`brainstorming` already owns classification (Spike / Bounded / Architectural), design, and the
approval gate, then hands to `writing-plans`. **Do not re-classify work here. Do not introduce
competing vocabulary.** This skill begins where that handoff ends.

Baseline runs against this repo established that agents already reason well about completeness,
law conflicts, and next actions. What they lack is a trigger, a place to put findings, criteria
agreed in advance, and evidence bound to a commit. That is all this skill supplies. It teaches
no discipline that the existing skills already teach.

## The four mechanisms

| Mechanism | Rule |
|---|---|
| **Trigger** | These checks do not fire on their own. The table below is the only authority on when they run. |
| **Ledger** | `IMPLEMENTATION.md` is the only place a status claim may live outside tests (§2). **Never create a parallel state file.** It records what exists, why work stopped, and what must not be built yet - never what `git log` already answers. |
| **Criteria** | A milestone's acceptance list is written when the milestone *starts*, in `IMPLEMENTATION.md`. A milestone with no acceptance list cannot be closed; write the list, then judge against it. |
| **Evidence binding** | A status claim names a commit SHA or a named test. **A green run against a dirty tree is evidence about the tree, not about the commit.** State which. |

## When each check fires

| Trigger | Run |
|---|---|
| Closing or advancing a milestone | `references/gate.md` |
| Resuming after a gap, or position is unclear | Read `IMPLEMENTATION.md` first. If it is missing or stale, say so before recommending anything. |
| Code conflicts with a law in `CLAUDE.md` §3 | `references/drift.md` |
| A law looks obsolete, incomplete, or contradictory | `references/govern.md` |
| `brainstorming` classified the work Architectural | `references/brief.md` before designing |
| Anything else | Nothing here. Return to the normal skills. |

## Escalation triggers

`brainstorming` says "when in doubt take the heavier one" but gives no test. These are the test.
Work is **Architectural** - regardless of how small the diff looks - if it touches any of:

1. A versioned contract (`packages/protocols/schemas/`, `packages/contracts/`)
2. A durable table or a migration
3. An authority or permission boundary
4. A second owner for a concept that already has one
5. A law in `CLAUDE.md` §3

The ratchet is one-way, as `brainstorming` defines it: discovering one of these mid-task
**upgrades** the path. Say so and step up. **Nothing downgrades mid-task** - "on reflection this
is simpler than I thought" is the rationalization this rule exists to refuse.

## Delegation

Do not reimplement any of these. Call them by name.

| Need | Skill |
|---|---|
| Classify, design, get approval | `brainstorming` |
| Spec into a plan | `writing-plans` |
| Execute a plan | `executing-plans`, or `subagent-driven-development` |
| Find a root cause | `systematic-debugging` |
| Write tests | `test-driven-development` |
| Prove something is done | `verification-before-completion` |
| Independent judgment of a diff | `requesting-code-review` |
| Parallel independent work | `dispatching-parallel-agents` |
| Land a branch | `finishing-a-development-branch` |

## Playbooks

Each is self-contained. Read the one the trigger table names; do not read all four.

- **`references/gate.md`** - milestone acceptance lists and the definition-of-done ladder
- **`references/drift.md`** - implemented code against the laws, and what to do about a conflict
- **`references/govern.md`** - proposing a change to `CLAUDE.md`, never applying one
- **`references/brief.md`** - the whole-system dimension sweep for Architectural work

## Red flags

Each of these means stop and run the matching playbook.

| Thought | Reality |
|---|---|
| "Tests are green, so the milestone is done" | Green describes a tree. Name the commit, and the consumer of each shipped claim. |
| "I'll record the status at the end" | Three status files in this repo decayed exactly that way. Record it, or say plainly that it was not recorded. |
| "The code violates a law, so fix the code" | Argue the law is out of date **first**. Only then recommend either side. That ordering is the whole point of `drift.md`. |
| "The user approved it, so I'll edit CLAUDE.md now" | Proposing and applying are separate turns. §3: the system never edits its own constitution. |
| "This is a small change to a schema" | Trigger 1. It is Architectural. |
| "A state file would make this easier to track" | §2 already names `IMPLEMENTATION.md`. A second one is a second authority. |
