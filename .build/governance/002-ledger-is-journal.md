# 002 - The status ledger is the journal, not a hand-kept file

STATUS: RATIFIED

Drafted from the owner's decision (`decision-20261001-d0ea` in `.build/journal.jsonl`): deleting
`IMPLEMENTATION.md` was intentional, and status claims now live as typed journal entries. That
decision changes where status lives, but the constitution still names the deleted file in three
places. This proposal repoints them. It is drafted, not applied. `CLAUDE.md`, `CODEX.md`, and
`AGENTS.md` are untouched (and an agent edit of them now triggers a permission prompt, see
`.claude/settings.json`).

Quoted lines refer to the owner's **working-tree** constitution (the uncommitted rewrite, 230
lines, three files identical), not to HEAD `2aaa072`. At HEAD the three files differ: 229 / 205 /
228 lines.

## Current rule

`CLAUDE.md:73-74`, §2:

> runtime evidence). Status is asserted only with evidence, in `IMPLEMENTATION.md` or the capability's
> own tests — nowhere else.

`CLAUDE.md:153`, §4:

> | Current state and milestones   | `IMPLEMENTATION.md` · `CHANGELOG.md` · `docs/history/` |

`CLAUDE.md:181`, §5:

> ceremony; `IMPLEMENTATION.md`, `CHANGELOG.md`, `docs/history/` only when a major milestone lands.

## Evidence

1. **The pointer is dangling.** `IMPLEMENTATION.md` is deleted in the working tree.
   `node .build/bin/ba.mjs check` reports: ``CLAUDE.md points at `IMPLEMENTATION.md`, which does not
   exist``. Under §2 as written, no status claim currently has a valid home.
2. **The hand-kept ledger had already decayed before deletion.** Its last committed copy listed CSE
   production-readiness R0–R3 as the active frontier and covered none of the CSE-008 slices that
   shipped after it (`98b6e53`, `8bbea00`). This was found independently by the E1 baseline agent.
3. **Agents follow the dangling pointer.** In the pre-registered E2 baseline (2026-10-01), a fresh
   agent asked about the missing file recommended `git restore IMPLEMENTATION.md`, contradicting
   the owner's decision, because the constitution is the only durable thing that speaks to it.
4. **The replacement is mechanical, not prose.** Journal entries are schema-validated on write,
   bound to a commit SHA and a clean/dirty flag, and append-only (`ba check` fails if history is
   edited). A `verdict` on a dirty tree is rejected unless it names what is uncommitted. Covered by
   `.build/bin/ba.test.mjs` (15 tests).

## What changed in reality

§2 assumed a status file someone keeps current by hand. Three generations of such files decayed in
this repo. The constitution's own law, *state is a projection; records are append-only and typed*,
gives the better shape: verdicts are records, and current state is computed from them
(`ba view`), never hand-maintained.

## Proposed text

Line-for-line replacements. Net change: **0 lines**.

§2, replacing lines 73-74:

```
runtime evidence). Status is asserted only with evidence — a commit-bound verdict in `.build/journal.jsonl`
or the capability's own tests — nowhere else.
```

§4, replacing line 153:

```
| Current state and milestones   | `.build/journal.jsonl` (rendered by `node .build/bin/ba.mjs view`) · `CHANGELOG.md` · `docs/history/` |
```

§5, replacing line 181:

```
ceremony; verdicts and decisions as one-line journal records; `CHANGELOG.md`, `docs/history/` at milestones.
```

## What this invalidates

- §5's "no decision-record ceremony" could be read as forbidding journal `decision` entries. The
  new wording draws the line: a typed one-line record with reasons and rejected alternatives, not
  an ADR document. If the owner wants decisions out of the journal entirely, drop the word
  "decisions" from the §5 line; verdicts must stay.
- `.claude/skills/build-anything/SKILL.md` and `references/gate.md` previously named
  `IMPLEMENTATION.md` as the ledger. They are updated on this branch to the journal.
- `docs/history/implementation-log.md` describes a workflow that rewrites `IMPLEMENTATION.md`. It
  is a historical narrative and is left as is.

## Admissibility (§9)

Retrieval pointers ("where truth lives") and the truth model, both admissible. No status, no
inventory: the lines say *where* status lives, not what it is.

## Size law

0 net lines. All three replacements keep their line count. `CLAUDE.md` stays at 230. Interaction
with proposal 001: independent edits to different lines. If 001 is ratified first, its candidate
already compresses §6/§8, and this proposal applies unchanged.

## Decision

RATIFIED by the owner on 2026-10-01, answering "Ratify both" to the question "How do you rule?" on proposals 001 and 002 (session 50e2b9fb-1024-4a60-bf20-ceea7e3bbe73), in a turn after the proposal was written. Applied identically to CLAUDE.md, CODEX.md and AGENTS.md (230 lines each, identical after CRLF normalisation); `node .build/bin/ba.mjs check` passed. Logged in CHANGELOG.md. Missed by this proposal and fixed in the same commit: CHANGELOG.md's preamble also said current state lives in IMPLEMENTATION.md; it now points to the journal.
