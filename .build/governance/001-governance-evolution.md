# 001 - Governance evolution: the constitution is living law, changed by proposal

STATUS: RATIFIED

Requested by the project lead ("I want CLAUDE.md to include this. Add it now, we've discussed it
enough"). Drafted, not applied: `references/govern.md` — *propose, never apply; proposing and
applying are different turns*. `CLAUDE.md`, `CODEX.md`, and `AGENTS.md` are untouched.

## Current rule

`CLAUDE.md:220-230`, §9 *Governance of this file* — verbatim:

> **May be added:** identity framing, laws, the truth model, working doctrine, governance rules, and
> retrieval pointers. **Must never be added:** changelog entries, milestone summaries, phase details,
> implementation inventories, package catalogs, component descriptions, test counts, feature lists,
> dated narratives, or any capability status. If it describes what was built rather than how to think
> and where to look, it does not belong here.
>
> **Size law:** under ~230 lines — compress or relocate, never append. This file summarizes and points
> to the two vision documents; it never forks them. `CLAUDE.md`, `CODEX.md`, and `AGENTS.md` stay
> identical.

And `CLAUDE.md:130-133`, §3:

> The system never edits its own constitution or the rubrics that judge it.

## Evidence

1. **§9 says what may go in, never how it changes.** `CLAUDE.md:220-230` defines admissible content,
   a size ceiling, and three-file identity — and no procedure for amendment. The rule the lead is
   asking for has no home in the file today. Incompleteness, not obsolescence.
2. **The procedure exists, but is not project law.** `.claude/skills/build-anything/references/govern.md`
   already defines propose/ratify. That path is untracked and local-only: it does not survive a fresh
   clone, and nothing in `CLAUDE.md` points at it. A rule enforced only by a local skill is not a rule.
3. **Three-file identity has actually drifted.** At commit `83b0574` the three files were three
   different documents — 110 / 114 / 228 lines, md5 `cadfdfdb…` / `50390c17…` / `e819176…`. In the
   current main working tree they are identical (`e695c2bd…`, 230 / 230 / 230). The rule held only
   because someone resynced by hand, so an amendment procedure must name the three-file step.
4. **The file is exactly full.** `wc -l` = 230 against a "~230" ceiling. Any addition must compress.
5. **The literal wording as requested would contradict §3.** "Propose a CLAUDE.md evolution" is
   compatible with §3 only if proposing and applying are different turns by different actors. The
   draft below makes that split explicit; the lead's wording left it implicit.

## What changed in reality

§9 was written to stop the file growing into a status report. It never anticipated the opposite
case: evidence from shipped code that a law itself is wrong. Left unsaid, that pressure resolves the
worst way — an agent edits the constitution mid-task and calls a lead's message ratification.

## Proposed text

Insert into §9, between the admissibility paragraph and the size law (5 lines):

```
**Evolution.** Living law, not a frozen file — but §3 holds: an agent **proposes, never applies**.
When implementation, verification, or research shows a rule obsolete, incomplete, contradictory, or
too weak, write a proposal: the rule, the evidence (file, line, or commit), the replacement text,
what it compresses. Only the owner ratifies, in a later turn; no agent message ratifies. A ratified
change lands in all three files at once, logged in `CHANGELOG.md`: what changed, why, its evidence.
```

Full measured candidate, 230 lines, ready to copy on ratification:
`.build/governance/001-CLAUDE.candidate.md`.

## What this invalidates

- Nothing in code. No contract, migration, or test depends on §9.
- `.claude/skills/build-anything/references/govern.md` becomes the *expansion* of a constitutional
  rule rather than a free-standing local convention. Its proposal format and `.build/governance/`
  path stay as they are.
- §5's documentation clause ("`CHANGELOG.md` … only when a major milestone lands") gains one more
  reason to write: a ratified constitutional change.

## Admissibility (§9)

Admissible as **governance rules** — an explicitly listed category. It is not a status claim: it
describes how the file changes, never what was built. No milestone, count, inventory, or date.

## Size law

Before: 230 lines. After: **230 lines**. Measured on a built candidate, not estimated. Net zero via:

| Change | Lines |
|---|---|
| §9 — new **Evolution** paragraph + blank | +6 |
| §8 — collapse the ```bash fence to one inline line; merge the Windows/commitlint note into two lines (no content dropped) | −4 |
| §6 — drop three anti-patterns that restate §3 verbatim: "bypass governance, the causal record, or verification for convenience", "mistake reflection for learning", "resume the steps while losing the reasons" | −2 |

The §6 deletions are the only judgment call here; each is stated as law in §3 and §1, so the file
loses repetition, not doctrine. **If the owner would rather keep them, the alternative is to relocate
§8's build detail to `README.md` and leave §6 alone — same net zero.**

## Ratification checklist (do not run until ratified)

1. Apply the identical edit to `CLAUDE.md`, `CODEX.md`, `AGENTS.md`
2. `md5sum CLAUDE.md CODEX.md AGENTS.md` — all three must match
3. `wc -l CLAUDE.md` — must be ≤ 230
4. Set `STATUS: RATIFIED`, record the deciding instruction here
5. Note the change in `CHANGELOG.md`

## Decision

RATIFIED by the owner on 2026-10-01, answering "Ratify both" to the question "How do you rule?" on proposals 001 and 002 (session 50e2b9fb-1024-4a60-bf20-ceea7e3bbe73), in a turn after the proposal was written. Applied identically to CLAUDE.md, CODEX.md and AGENTS.md (230 lines each, identical after CRLF normalisation); `node .build/bin/ba.mjs check` passed. Logged in CHANGELOG.md. Applied as the primary variant: §8 collapsed and the three §6 anti-patterns dropped (the README relocation alternative was not chosen).
