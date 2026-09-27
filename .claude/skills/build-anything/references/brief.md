# Brief — the whole-system sweep for Architectural work

> **Status: not yet validated by baseline testing.** The other three playbooks were written
> against observed agent failures. This one was not — it encodes judgment that may already be
> present. Treat it as a checklist to consult, not a process to perform, and delete any section
> that never changes a decision.

## Contents

- When this fires
- How to use it
- The sweep
- Output

## When this fires

Only after `brainstorming` has classified work **Architectural**, and before its design is
written. It does not replace any step of `brainstorming` — it supplies the dimensions that a
design for structural work should have considered.

For Spike and Bounded work, skip this entirely. Consulting it there is the ceremony that gets
this skill switched off.

## How to use it

Read the headings. Name the dimensions that are **actually live** for this change, and say which
ones you are deliberately skipping. A sweep that marks every dimension relevant has not been done.

Two or three dimensions genuinely thought through beat twelve listed.

## The sweep

**Ownership** — Which existing component owns this concept? If none does, which layer does it
belong in — kernel, substrate, harness, environment, surface — and is that the lowest layer where
it is still general? If one already owns it, you are extending, not adding.

**Contracts** — What crosses a versioned boundary? A change here is Architectural by definition.
Does any vendor type escape its adapter?

**State** — For each piece: who owns it, is it authoritative or derived, does it persist, how is
it versioned, how is it recovered? Derived state that becomes authoritative is the most common
structural defect.

**Failure** — What happens on restart, on partial completion, on concurrent access, on a
dependency being down? For anything claiming persistence: is there a test that kills it and
brings it back?

**Evidence and provenance** — What does this record, and can a later reader tell what produced it
and from what? Anything derived must name its source and operator.

**Verification** — How will this be shown to work, by something outside the thing that built it?
If the answer is "its own tests assert it," that is rung 2 of the done ladder, not rung 4.

**Interface** — What does a person see during loading, failure, partial completion, and empty
state? Long-running operations without an observable state are a design gap, not a polish item.

**Cost** — What does this spend per invocation — latency, tokens, queries, context? What happens
to that at ten times the data?

**Reversibility** — If this is wrong, what does undoing it cost? Cheap-to-reverse decisions
deserve less deliberation than this list implies; expensive ones deserve more.

**Deliberate non-goals** — What is being left out, and what would have to change for it to come
back? Unstated non-goals get built by the next person.

## Output

A few paragraphs in chat, not a document. It feeds `brainstorming`'s design; it does not become a
separate artifact.

State plainly:

- which dimensions are live, and what each implies
- which are deliberately skipped
- what remains genuinely unknown, and what would resolve it
- the smallest vertical slice that closes a loop end to end

If a dimension is unknown and expensive to get wrong, say so and stop. A `NOT READY - requires
research` is a legitimate outcome and a cheaper one than building the wrong structure.
