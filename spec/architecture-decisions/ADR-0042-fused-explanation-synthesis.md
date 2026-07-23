# ADR-0042: Model-Backed Fused Explanation Synthesis (M9 T3)

**Status:** Accepted
**Date:** 2026-07-16
**Related:** ADR-0040 (Source Fusion T1 — deterministic reconciliation this weaves), ADR-0041 (the
Claim Graph T2 — the claims + contradictions this cites), CSE-015 §3.1/§4/§6 (Source Fusion — the
`fused_explanation_ref`, the grounding + disagreement-honesty audits), CSE-006 (Claim Graph),
ADR-0037 (the MRL unit/service pattern this mirrors), ADR-0027 (the evaluation/grounding-audit
harness), blueprint M9

## Context

T1 (ADR-0040) reconciled each concept across sources — coverage, corroboration, complements — as a
pure function. T2 (ADR-0041) lit up the Claim Graph — each source's claims and the genuine
cross-source contradictions between them. What the learner sees in the Fused view is still a
*structured table*: per-source treatments, claim lists, disagreement chips. CSE-015 §3.1 names the
missing piece — `fused_explanation_ref`, **"an inference-class synthesis citing every contributing
anchor"** — the prose that turns the table into *one understanding drawn from many sources* (§1,
architectural-direction #7).

CSE-015 §4/§6 constrain it: the synthesis is model-backed and **D3-recorded**; it must **cite every
contributing source**; it must be **entailed by its cited anchors** (grounding audit) and **must not
flatten a live contradiction** (disagreement-honesty); on grounding failure it **quarantines and
falls back to the per-source alignment view** (the T2 table). This is the same governed-cognition
pattern as M3/M6/T2: a model-backed unit with a deterministic fallback, dispatched at the gateway.

**Manifestation scope.** Like all model-backed surface cognition, this is **gateway-on, CLI-off** —
a website capability (substrate + gateway backend + `apps/web`). Absent a model, fusion is
byte-identical to T2.

## Decisions

### 1. A `synthesis` agent + `FusionSynthesisUnit` — a distinct cognition, not a claim mode

Synthesis is *generation* (weaving prose), not *extraction* (claims) — so it is its own privileged
`synthesis` agent + `FusionSynthesisUnit` (`@inevitable/product-cognition`), not a third mode of the
`claim` agent. It reads, per concept, the T1 treatments (with quotes/anchors), the T2 claims, and
the T2 contradictions, and produces a **`FusedSynthesis`**: grounded prose that weaves the sources,
the set of **cited source ids** (a subset of the contributing sources — the grounding gate), and an
**acknowledges_disagreement** flag. Deterministic fallback: a structured, honest concatenation of
each source's claim/quote plus an explicit disagreement note — the per-source alignment view in
prose (CSE-015 §6), never a fabricated consensus.

### 2. Grounding + disagreement-honesty are enforced at the parser (T3 tier)

The parser drops any cited source id not among the contributing sources (no invented provenance),
requires non-empty prose, and — when contradictions were supplied — forces
`acknowledges_disagreement` true (a synthesis may not silently flatten a live disagreement, CSE-015
§6 / CSE-003 §6). The deeper **entailment audit** (does the prose follow from the cited anchors?) is
the ADR-0027 judge harness — named for a later tier; T3 enforces the citation + disagreement gates
deterministically and records confidence.

### 3. Synthesis is part of `fuse()` for covered concepts, emitting `source.fusion.synthesized`

`SourceHub.enableFusionCognition(model)` (renamed from `enableClaimReasoning`) now wires the claim
unit *and* the synthesis unit over one recorded model (D3, on the hub bus). In `fuse()`, each concept
with material (a covering treatment or a claim) is synthesized; the `FusedSynthesis` attaches to the
`FusedConcept` and a `source.fusion.synthesized { concept_ref, source_version_ids, cites, degraded }`
event is emitted on the hub bus. Progressive + attention-driven (CSE-015 §4): only the concepts in
the fuse request are synthesized, on demand. **Absent a model, no synthesis is attached and the
result is byte-identical to T2** (the T1/T2 gateway tests unchanged).

## Consequences

- The learner reads one woven explanation per fused concept — corroboration integrated, each source
  named inline, disagreement surfaced — with the T2 claims/contradictions beneath it as evidence.
- Reuses the M5 SourceHub + the T1/T2 structures; one new agent, one new event, no new store.
- The fused synthesis is a per-source-*set* artifact (it cites a specific set) — consistent with
  CSE-015 §7's caching note; T3 computes on demand (no cache yet).

## Deferred (named scope)

- The **ADR-0027 entailment/grounding-audit judge** (does the prose follow from the cited anchors?) —
  T3 enforces citation + disagreement gates deterministically; the model-judge audit + quarantine
  threshold is a later increment (shares the CSE-006 §6 quarantine machinery).
- **Fusion-as-Scene** with `split`/`merge` shots (CSE-015 §4 / CSE-012/013) — the synthesis as a
  Scene actor.
- **Caching** fused syntheses by source-set hash (CSE-015 §7).
- Frontier overlays + the Temporal Knowledge Model (CSE-006 §3.2/§3.3) — separate tracks.

## Rejected

- **A third `claim`-agent mode** for synthesis: generation and extraction are different cognitions
  with different failure modes; a separate agent keeps the grounding + disagreement gates legible.
- **Synthesis without a citation gate** (free prose): violates CSE-015 §2 "fusion never blurs
  provenance" — every fused claim must name its source; an uncited synthesis is quarantined.
- **Flattening contradictions into a smooth consensus**: forbidden by CSE-015 §2 / CSE-006 — a live
  disagreement is content; the synthesis must acknowledge it or fall back to the alignment view.
- **Eager whole-corpus synthesis**: CSE-015 §4 is progressive + attention-driven — synthesize the
  concepts the learner is fusing, on request.
