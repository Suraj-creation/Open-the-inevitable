# ADR-0059: Jupyter notebook modality adapter

**Status:** Accepted
**Date:** 2026-07-23
**Related:** CSE-002 (canonical source representation — the modality-adapter seam), ADR-0046 (code
modality), ADR-0056 (Source Dock — the honest-refusal front door), CSE-018 §6 (the `code` MCCR
grammar this feeds), the CSE production-readiness audit R5 (breadth).

## Context

`SourceModality` already names `notebook`, but no adapter existed, so the Source Dock *refused*
`.ipynb` before upload. A notebook is the canonical artifact of code/data learning and pairs
directly with the `code` MCCR grammar just shipped (R4e). The adapter seam (`ModalityAdapter`,
`registerAdapter`) is established — five reference adapters already plug into it — so this is a new
*modality*, not new architecture.

## Decision

Add a deterministic, dependency-free `NotebookReferenceAdapter` (text modality — the `.ipynb` JSON
is UTF-8). It parses `cells` in document order: a **markdown** cell reuses the markdown block
splitter (headings/paragraphs/lists/fenced code); a **code** cell becomes one `code` structural
region; `raw`/unknown cells fall back to a paragraph. Cell `source` is a string or string[] (joined).
Empty/invalid JSON → `E_SOURCE_PARSE_EMPTY` (honest refusal, never a silent drop). Register it in the
`SourceHub`, add its MIME, and turn the Dock's `ipynb` refusal into `.ipynb → notebook`. Outputs are
outputs-free (executed cell outputs are not source content); only the authored cells canonicalize.

The same decision applies to the **dataset (CSV)** modality (also already named, also refused): a
dependency-free `DatasetReferenceAdapter` parses RFC-4180-ish CSV (quoted commas/newlines, `""`
escapes) into a `heading` (shape), a `list` (schema), and a bounded `table` preview — coarse honest
structure, never a region per row. `.xlsx` stays refused (binary/zip). Both adapters plug into the
existing `ModalityAdapter`/`registerAdapter` seam; no new architecture.

## Rejected alternatives

- **Flatten the notebook to one text blob.** Loses the cell structure anchors depend on; the code
  cells must be `code` regions so the `code` grammar and anchoring work.
- **Include executed cell outputs as source content.** Rejected — outputs are derived, not authored;
  including them would misattribute generated text/plots as the source's own words.
- **A new binary modality / nbconvert dependency.** Unnecessary: `.ipynb` is JSON; the reference
  adapter stays hermetic and deterministic like the others.

## Deferred

- Rich output rendering (plots/tables from executed cells) — outputs are excluded for now.
- Per-cell execution-count / kernel metadata as structural signal.
