# 08 — Ingestion and Grounding

> **Question.** Should everything UCI ingests pass through one common substrate, or through modality-specific pipelines?
> Everything here means conversations, documents, books, web pages, code, images, screenshots, audio, video, datasets,
> tool outputs, human corrections, external events, and UCI's own trajectories. Which stages are universal, and which are
> modality- or domain-specific?
>
> **Answer in brief (STRONG HYPOTHESIS; grounded in `research/R3`).**
>
> - Neither a single pipeline nor independent silos. The evidence supports **modality-specific operator stacks that
>   converge on a small set of universal evidential objects**: an evidence envelope, anchors, derivation records,
>   temporal grounding frames, identity hypotheses, and claims.
> - **Every parser, transcriber and extractor is an *interpretation* operator**, fallible and versioned. It is never
>   evidence.
> - "An ingestion layer" is *not* adopted as an architectural layer. Ingestion is a family of formation operators over a
>   universal evidence model.

---

## 1. The evidence that forces this shape

| Finding | Evidence (`R3`) | Status | Consequence |
|---|---|---|---|
| The best operator per modality changes fast. Document parsers flipped between 2024 and 2026: small document VLMs (94.9) now beat MinerU (86.5) and Marker (78.4). | OmniDocBench | OBSERVED | A common pipeline would freeze the wrong operator. Operators must be swappable adapters with evaluators. |
| Strong operators fail in ways their headline metrics hide. Whisper invents sentences in about 1% of transcripts, 38% of them harmful. Parsers loop. Answer-region grounding scores F1 ≈ 0.09 against a human 0.60. | Whisper hallucination studies; ViDoRe V3 | OBSERVED | Operator outputs are **interpretations** that must be re-checkable against raw evidence. Always keep raw media. |
| Page-image retrieval beats text on visual documents (ColPali 0.81 vs 0.66 nDCG@5). Text wins on long, text-rich, unfamiliar documents. Hybrid wins end to end. | ColPali; ArXivDoc; ViDoRe V3 | CONTESTED → hybrid | Keep multiple representations per anchorable unit. Routing between them is learned per corpus. |
| Exact and similarity retrieval are different operators. BM25 71.2% vs dense 49.7% on long-tail entities. Dense recall under 20% on LIMIT, which has a provable capacity limit. | EntityQuestions; LIMIT | REPLICATED | Exact retrieval (with completeness guarantees) and similarity retrieval (recall@k) are distinct services |
| GraphRAG's gains largely vanish when evaluated at a matched budget (69.33 vs 69.01). Graphs help only for temporal, comparative and corpus-wide questions. | Han et al. re-evaluation | OBSERVED | Graphs are **indexes**, not cognition. Their summaries are interpretations that must cite inputs. |
| Cross-modal alignment works only with a shared address algebra: text offsets plus quotes, page and bbox, media time ranges, UI nodes. | W3C Web Annotation; Media Fragments; PROV | REPLICATED (standards) | A universal **anchor** model is required |

---

## 2. The universal core

These are identical for every modality and domain. They belong in the substrate, and their *contracts* belong in the
kernel.

| Object | Contents | Invariant |
|---|---|---|
| **Evidence envelope** | Immutable bytes; content-hash identity; media type; source; `captured_at` (and `authored_at` if known); capturing agent; consent label; authority scope; trust class | Never revised. The unit of forgetting. |
| **Anchor** | Evidence id@hash + a selector chain: text position + quote, page, bbox, time range, frame, DOM or accessibility node, table cell | Every interpretation, claim and context item resolves to anchors |
| **Derivation record** | Outputs, operator@version, input anchors, parameters, model, time, *measured operator quality* | Every interpretation is re-derivable, and its quality is known |
| **Interpretation** | Typed operator output: a transcript word, a layout element, a table, a caption, an entity mention, a normalized time, a claim. Carries anchors and confidence. | Always marked as an interpretation, never as evidence |
| **Temporal grounding frame** | Capture time; the reference anchor used; normalized value; granularity; uncertainty | Relative times resolve against capture context, never processing time |
| **Identity hypothesis** | A mention anchor → an entity candidate, with score and resolver@version; reversible | Similarity ≠ identity. Merges are reversible events. |
| **Claim** | See `03`: an atomic statement, its supporting anchors, and verification resolutions | Source-reported claims keep their attribution |
| **Multi-representation index** | Per anchorable unit: lexical, dense, late-interaction, page-image and structural keys | Indexes are projections, rebuildable from evidence |

---

## 3. Modality-specific operators (the harness operator library)

- Layout, OCR, table and formula parsers.
- Page-image embedders.
- ASR with forced alignment and diarization.
- Shot and scene segmentation, frame captioning, and OCR on frames.
- Screen parsers: element detection, set-of-marks, accessibility-tree readers.
- Code parsers: ASTs and symbol tables.
- Tabular profilers.

Each is a **versioned operator adapter with its own evaluator**. The absorption principle applies directly: operators
are replaced as better ones appear, and their outputs are **re-derived from kept evidence** (retroactive
re-derivation, `06` §3).

---

## 4. Domain-specific (environments)

Environments decide:
- which entity and relation types matter, and the rules for disambiguating them;
- which derived views to materialize: a textbook's chapter/section/exercise/figure tree, a learner's misconception
  claims, a codebase's call graph;
- which summaries or hierarchies are worth paying for;
- which domain verifiers exist.

"Did the learner answer correctly?" is a domain evaluator. "Is this claim supported by page 42?" is universal.

---

## 5. Where each stage falls

```
UNIVERSAL   capture → envelope + hash → consent / authority / trust label → store raw
SPECIFIC    modality operators → interpretations (anchored, versioned, confidence)
UNIVERSAL   anchor normalization → temporal grounding → multi-representation indexing
MIXED       mention detection (universal mechanics) → entity resolution (domain rules)
DOMAIN      claim / relation schemas · materialized views · domain evaluators
UNIVERSAL   claim verification against anchors → adjudication (04 §4) → claims (03)
```

This answers the research brief's question about the ingestion chain (raw evidence → segmentation → canonicalization →
extraction → entity grounding → temporal grounding → provenance → epistemic interpretation → relationship construction →
indexing → memory formation → contextual availability):

| Stage | Where it lives |
|---|---|
| Provenance, temporal grounding, indexing hooks, epistemic interpretation | **Universal** |
| Segmentation, canonicalization, extraction | **Specific** |
| Relationship construction, materialized views | **Domain** |
| Memory formation | The governed formation operators of `04` |
| Contextual availability | Attention (`05`) |

---

## 6. UCI's own trajectories are ingested the same way

The system's trajectories, decision records, manifests, tool outputs and human corrections enter as evidence envelopes
with anchors, exactly like external evidence (UCI §8, law 3). A human correction is evidence of origin
*stated-by-person*. It triggers adjudication and a *correction*-type contradiction event (`04` §5).

**Archaeology precedent (for exact capture of the system's own acts):**
- HER stores exact wire bytes (`A-HER §19.1`).
- OHS keeps the raw tool call beside the typed action (`A-OHS §19.3`).
- DSH embeds the exact model stream (`A-DSH §19.9`).

---

## 7. Ingestion quality must reach belief confidence

Open in the literature (`R3` §7.5 item 2; no system does it). The extraction-confidence component of a claim's
confidence vector should come from the **measured quality of the operator that produced it**, as recorded in the
derivation record, not from a constant.

Example: a claim extracted from a noisy scanned page by an operator with measured 86% layout accuracy should carry
lower extraction confidence than the same claim extracted from born-digital text.

**Status.** STRONG HYPOTHESIS (E-IG2).

---

## 8. Education instance: a learner's book

| What | Represented as |
|---|---|
| The PDF | An evidence envelope (content-hashed, labelled as the learner's) |
| Chapters, figures and exercises | Anchored interpretations produced by a layout operator |
| Page images | Kept retrievable for figure-heavy material |
| Long text-rich chapters | Text stays primary (hybrid retrieval) |
| "The learner's chapter 3" | Resolved by a domain disambiguation rule |
| Explanations cite | Anchors: page and region where grounding is reliable, page-level otherwise |

The honest citation granularity for visual evidence today is **page-level** (region grounding F1 ≈ 0.09).

---

## 9. Experiments

| ID | Experiment | Graduation | Status |
|---|---|---|---|
| E-IG1 | Operator swap with retroactive re-derivation: replace the parser and re-derive a learner's library; compare claims, citations and downstream teaching quality | Improvement with zero evidence loss; old derivations superseded | OPEN |
| E-IG2 | Operator-quality-weighted extraction confidence vs constant | Better calibration of source-reported claims | OPEN |
| E-IG3 | Hybrid (text + page-image) retrieval with learned routing vs either alone, on education corpora | Hybrid wins on the corpus mix | OPEN |
| E-IG4 | Exact retrieval vs similarity retrieval on identifier and long-tail queries inside UCI | Exact retrieval guaranteed-complete where applicable | OPEN |
| E-IG5 | Reversible entity resolution in a personal corpus over months: merge error rate and repair cost | Bounded error; merges fully reversible | OPEN |
| E-IG6 | Anchor-resolvable citations: share of explanation citations that resolve to source bytes and are faithful (supported, not post hoc) | High faithfulness, well above the 74.5% baseline | OPEN |
