# R3 — Multimodal Ingestion, Grounding, and Context Construction

Research pass for UCI (architecture research, topic R3). Sources fetched 2026-09. This document is
research input, not evidence that any UCI capability exists. Numbers are as reported by the cited
source; items not verifiable from the source are marked CLAIMED.

**Bottom line.** Ingestion should be *modality-specific operator stacks converging on universal
evidential objects*: an immutable evidence envelope, a W3C-style anchor/selector algebra, PROV-style
derivation records, temporal grounding against capture time, and reversible identity hypotheses.
Parsers, transcripts, captions, graphs, and summaries are all revisable interpretations. Long
context degrades with length alone, so the context compiler is a cognitive operator whose selection,
ordering, transformation, and exclusion decisions must be logged in a manifest. Compaction loses
constraints and exact details at rates that task-success metrics hide, so it must be restorable and
measured with typed recall probes.

## 0. Questions and method

Questions: (Q1) common ingestion substrate vs modality-specific pipelines converging on shared
evidential/semantic objects; (Q2) which stages are universal vs domain-specific; (Q3) what research
establishes about constructing the model's context (relevance, attention, compression, long-context).

Method: primary papers, official docs, source repos 2023–2026, fetched September 2026. Each source
records: citation · mechanism · empirical result · evidence strength · UCI primitive/invariant ·
conflicts · status.

Status vocabulary (used per source):
- **OBSERVED** — reported in one primary source with a reproducible artifact (code/benchmark).
- **REPLICATED** — independently reproduced, or consistent across ≥2 independent groups/benchmarks.
- **CLAIMED** — vendor/author claim without an independent or public reproducible eval.
- **CONTESTED** — at least one credible source reports the opposite or a sharp boundary condition.
- **SPECULATIVE** — our inference, or an untested proposal.

Convention: lines prefixed **Inference:** are this report's reasoning, not source evidence.

## 1. Document understanding and parsing

The field splits into three families. (a) **Modular pipelines**: layout detector → OCR / native
text → table-structure model → formula model → reading order → serializer (Docling, MinerU-pipeline,
Marker, Unstructured). (b) **End-to-end page VLMs** that emit markup directly (Nougat, MinerU2.5,
PaddleOCR-VL, dots.ocr, GLM-OCR, general VLMs; LlamaParse and cloud Document AI wrap such models).
(c) **Parse-free visual retrieval**: embed the page image itself and hand the page image to a VLM
(DSE, ColPali/ColQwen). The evidence says these are complementary, not rival, and that the choice
changes which *addressing scheme* your evidence can support.

### 1.1 Docling (IBM Research)
- **Citation:** Auer et al., "Docling Technical Report", arXiv:2408.09869 (Aug 2024).
  https://arxiv.org/abs/2408.09869 · repo https://github.com/docling-project/docling
- **Mechanism:** Modular pipeline: native PDF text cells + layout model (DocLayNet-trained RT-DETR
  family) + TableFormer for table structure. TableFormer receives the table image crop *plus the
  PDF text cells*, and structure predictions are **matched back to PDF cells** instead of
  re-transcribing — the output keeps page coordinates (bounding boxes) per element. Output is a
  typed `DoclingDocument` (texts, tables, pictures, groups, provenance with page + bbox) that
  serializes to Markdown/JSON; a `HybridChunker` chunks along the document tree.
- **Result:** Tables take ~2–6 s each on CPU, dependent on cell count (report). Runs on commodity
  hardware. On OmniDocBench end-to-end, pipeline tools of this class trail specialized VLMs (below).
- **Strength:** Medium (tech report, open code; speed numbers are author-measured).
- **UCI primitive:** *Typed document object with per-element provenance (page, bbox, element type,
  parent)* — i.e., a span/region address that survives serialization. The "match back to source
  cells rather than re-generate" pattern is the key anti-hallucination invariant: **derived
  structure must point to source coordinates, not replace them.**
- **Conflicts:** Accuracy below VLM parsers on OmniDocBench; VLM parsers often lack coordinate
  provenance.
- **Status:** OBSERVED.

### 1.2 OmniDocBench and the pipeline-vs-VLM parser race
- **Citation:** Ouyang et al., "OmniDocBench: Benchmarking Diverse PDF Document Parsing with
  Comprehensive Annotations", CVPR 2025. https://github.com/opendatalab/OmniDocBench ·
  https://openaccess.thecvf.com/content/CVPR2025/papers/Ouyang_OmniDocBench_Benchmarking_Diverse_PDF_Document_Parsing_with_Comprehensive_Annotations_CVPR_2025_paper.pdf
- **Mechanism:** 1,651 annotated pages (v1.0; later v1.5), 10 document types, 5 layout types,
  multiple languages; separate metrics for text (normalized edit distance), tables (TEDS),
  formulas (CDM), reading order; end-to-end "Overall" score.
- **Result (repo leaderboard, fetched 2026-09):** MinerU-pipeline Overall 86.47 (text ED 0.055,
  table TEDS 81.88, formula CDM 83.07); Marker v1.8.2 78.44 (ED 0.157, TEDS 65.77); GPT-4o 86.59
  (ED 0.114, TEDS 82.95); Gemini-3 Pro 92.91; dots.ocr (3B) 90.77; MinerU2.5 (1.2B) 93.04 (ED 0.045,
  TEDS 87.88, CDM 95.77); PaddleOCR-VL-1.5 (0.9B) 94.93 (ED 0.038, TEDS 91.67). GLM-OCR tech report
  (arXiv:2603.10910) claims 94.6 on v1.5. Original v1.0 paper: pipelines beat general VLMs, which
  lagged ~20–30% on Chinese pages.
- **Strength:** Medium-high (public benchmark, many independent submissions; but submitters tune to
  it, and it is page-level PDF only).
- **UCI primitive:** *Per-element-type quality metrics* (text vs table vs formula vs reading
  order) — ingestion quality is not one number. A parser is a versioned operator whose output
  quality varies by element type, so **every derived element must carry `operator@version`** so
  it can be recomputed when a better parser ships (and 2024→2026 shows parsers improve fast).
- **Conflicts:** v1.0 (2024) found pipelines ahead; by 2025–26 small specialized VLMs lead. The
  ranking is time-dependent — itself evidence for re-derivability.
- **Status:** REPLICATED (trend: small doc-VLMs > pipelines > general VLMs on this benchmark, across
  multiple independent model teams).

### 1.3 Nougat, Marker, MinerU, Unstructured, LlamaParse, cloud Document AI
- **Citations:** Blecher et al., "Nougat: Neural Optical Understanding for Academic Documents",
  arXiv:2308.13418 (2023) https://arxiv.org/abs/2308.13418 · Marker https://github.com/datalab-to/marker
  · MinerU https://github.com/opendatalab/MinerU and MinerU2.5 arXiv:2509.22186 · Unstructured
  https://docs.unstructured.io · LlamaParse https://docs.llamaindex.ai · Azure AI Document
  Intelligence https://learn.microsoft.com/azure/ai-services/document-intelligence/ · Google
  Document AI https://cloud.google.com/document-ai/docs.
- **Mechanism:** Nougat: Swin encoder → mBART decoder emitting Mathpix-style markdown for academic
  pages; no bboxes. Known failure: **repetition/hallucination loops** on out-of-domain pages,
  detected heuristically. MinerU2.5: decoupled two-stage VLM — low-res global layout pass, then
  native-resolution crops for content recognition (efficiency + accuracy). Unstructured: partitions
  into typed *elements* (Title, NarrativeText, Table, ListItem, Image) with metadata (page, coords,
  parent_id) and "chunk_by_title". Azure/Google: layout + key-value + table APIs returning
  **polygons/bounding boxes and span offsets into a single `content` string** (Azure `spans`:
  offset/length) — a production example of span addressing over a canonical text.
- **Result:** MinerU2.5 top-tier on OmniDocBench at 1.2B params (above). Nougat numbers are
  arXiv-domain only. Vendor services publish few comparable public numbers.
- **Strength:** Nougat/MinerU medium (paper + code); LlamaParse/cloud: low (CLAIMED quality).
- **UCI primitive:** *Canonical text + offset spans + geometric regions* (Azure pattern);
  *element typing with parent pointers* (Unstructured). **End-to-end generative parsers can
  hallucinate text that is not on the page** — so generative transcription is *interpretation*,
  not *evidence*; the page image/bytes remain the evidence.
- **Conflicts:** Generative parsers score higher but lose coordinate provenance unless they emit
  boxes (MinerU2.5, dots.ocr, PaddleOCR-VL do emit layout boxes; Nougat does not).
- **Status:** OBSERVED (Nougat failure mode; MinerU); CLAIMED (LlamaParse, cloud quality).

### 1.4 Parse-free visual retrieval: DSE, ColPali/ColQwen
- **Citations:** Ma et al., "Unifying Multimodal Retrieval via Document Screenshot Embedding",
  EMNLP 2024, arXiv:2406.11251 https://aclanthology.org/2024.emnlp-main.373/ · Faysse et al.,
  "ColPali: Efficient Document Retrieval with Vision Language Models", ICLR 2025, arXiv:2407.01449
  https://arxiv.org/abs/2407.01449 · ViDoRe https://github.com/illuin-tech/vidore-benchmark.
- **Mechanism:** DSE: a VLM encodes the page *screenshot* to one dense vector. ColPali: PaliGemma
  (later Qwen2-VL → ColQwen) produces **one embedding per image patch** and scores queries by
  ColBERT-style late interaction (MaxSim over query tokens × page patches).
- **Result:** DSE on Wiki-SS/NQ: nDCG@10 75.3 vs BM25-on-text 55.8; +17 pts top-1; SlideVQA +8
  nDCG@10 vs BM25 and >15 over OCR-text retrieval. ColPali on ViDoRe v1: nDCG@5 0.81 vs 0.66 for
  the best parse-OCR-embed text pipeline; biggest gains on figure/table-heavy sets (ArxivQA,
  TabFQuAD). Indexing is much faster (no OCR/layout), but storage is ~1k vectors per page.
- **Strength:** Medium-high (peer-reviewed, public benchmark, widely reproduced by ColQwen/others).
- **UCI primitive:** *The page image is itself a retrievable evidence unit.* Retrieval can operate
  on the raw modality; text extraction is one interpretation among several, not a gate.
- **Conflicts:** see 1.5–1.6; ViDoRe v1 was built by the same group; v1 is near-saturated.
- **Status:** REPLICATED (vision retrievers beat OCR-text pipelines on visually rich pages).

### 1.5 Where visual retrieval fails (boundary conditions)
- **Citations:** Most et al., "Lost in OCR Translation? Vision-Based Approaches to Robust Document
  Retrieval", arXiv:2505.05666 (2025) https://arxiv.org/abs/2505.05666 · "Document-as-Image
  Representations Fall Short for Scientific Retrieval" (ArXivDoc), arXiv:2604.18508 (2026)
  https://arxiv.org/abs/2604.18508 · Loison et al., "ViDoRe V3", arXiv:2601.08620 (Jan 2026)
  https://arxiv.org/abs/2601.08620.
- **Mechanism / result:** (a) Most et al.: ColPali vs OCR (Nougat/Llama-3.2-90B) RAG on degraded
  scans with an answer-level eval — vision RAG does well in-distribution, **OCR-based RAG
  generalizes better to unseen documents of varying quality**. (b) ArXivDoc (built from LaTeX
  sources so evidence type is known): document-as-image is consistently suboptimal, worse as
  documents lengthen; **text is best even for figure queries** (captions + surrounding text);
  interleaved text+image beats page-image without special training. (c) ViDoRe V3 (26k pages,
  3,099 human-verified queries, 10 enterprise datasets, 6 languages): visual retrievers beat
  textual at equal parameter count, late interaction beats single-vector dense, textual
  reranking helps substantially, **hybrid text+image context gives best end-to-end answers on
  hard queries**, and fine-grained visual grounding (bbox localization of the answer) is far
  below humans (reported F1 ≈0.09 vs ≈0.60 inter-annotator).
- **Strength:** Medium (three independent groups; ArXivDoc and Most et al. are preprints).
- **UCI primitive:** *Multiple parallel representations of the same evidence unit* (image,
  transcription, structure) indexed side by side, with fusion; **region-level grounding is
  unsolved**, so claims must cite the finest address the operator can actually justify (page,
  not bbox, when localization is weak).
- **Conflicts:** Directly qualifies 1.4. Resolution: vision wins on visually rich, short,
  in-distribution pages; text wins on long, text-rich, structured, or out-of-distribution
  documents; hybrid wins end-to-end.
- **Status:** CONTESTED → converging on "hybrid".

### 1.6 Layout-aware (element-based) chunking vs fixed and semantic chunking
- **Citations:** Jimeno Yepes et al., "Financial Report Chunking for Effective Retrieval Augmented
  Generation", arXiv:2402.05131 (2024) https://arxiv.org/abs/2402.05131 · Qu, Tu, Bao (Vectara),
  "Is Semantic Chunking Worth the Computational Cost?", NAACL Findings 2025, arXiv:2410.13070
  https://arxiv.org/abs/2410.13070 · Anthropic, "Introducing Contextual Retrieval" (Sep 2024)
  https://www.anthropic.com/engineering/contextual-retrieval.
- **Mechanism:** (a) Chunk by document elements (title/table/text, via Unstructured "Chipper"),
  prefix with titles, add table descriptions. (b) Compare fixed-size vs embedding-breakpoint vs
  clustering "semantic" chunkers. (c) Prepend an LLM-written 50–100 token context blurb (situating
  the chunk in its document) before embedding and BM25 indexing.
- **Result:** (a) FinanceBench: element-based page-retrieval accuracy 84.4% vs 68–73% for
  fixed 128/256/512-token chunks, with half the chunks of 128-token; QA manual accuracy 53.2% vs
  48.2% (512-token) and 35–37% (128/256). (b) Semantic chunking gains are inconsistent and do not
  justify the compute; fixed-size is competitive on realistic (non-stitched) documents. (c) Top-20
  retrieval failure: 5.7% baseline → 3.7% contextual embeddings → 2.9% + contextual BM25 → 1.9% +
  reranking (−67%).
- **Strength:** (a) medium (single domain, 141 questions); (b) medium (peer-reviewed, negative
  result); (c) CLAIMED (vendor eval, datasets not fully public, but method reproduced widely).
- **UCI primitive:** *Chunks are views, not evidence.* Structural boundaries from the parse tree
  beat learned "semantic" boundaries; context lost at chunking must be re-attached (document
  path, heading chain, situating summary). **Chunk = (evidence_id, span range, structural path,
  context-prefix@operator-version)**, recomputable.
- **Conflicts:** (a) vs (b) are compatible: structure (from layout) ≠ semantic similarity
  boundaries.
- **Status:** REPLICATED (structure-aware + contextualized chunking > naive fixed); semantic
  chunking = CONTESTED.

**Inference (section 1):** No single parser is evidence. The evidence object is the original bytes
(PDF/page image) plus a *stable address space* (page → region bbox → canonical-text offsets). Every
parser/VLM transcription, table structure, and caption is an interpretation layer keyed to that
address space, tagged with operator@version and re-derivable. Parse-free retrieval argues for
keeping the page image as a first-class indexable view, not only the text.
## 2. Multimodal ingestion (audio, video, screenshots, timelines)

The common pattern across serious systems is the same as for documents: raw media is kept; one
or more **versioned operators** produce time- or region-addressed interpretations (transcript
words with timestamps, speaker turns, shot boundaries, captions, UI element boxes); those
interpretations are aligned on a shared **media clock** and addressed with standard fragment
syntax. What differs per modality is the operator stack and the address type (character offset,
page+bbox, seconds, frame+bbox, DOM/accessibility node).

### 2.1 Audio: ASR + forced alignment + diarization (WhisperX, pyannote)
- **Citations:** Bain et al., "WhisperX: Time-Accurate Speech Transcription of Long-Form Audio",
  Interspeech 2023, arXiv:2303.00747 https://arxiv.org/abs/2303.00747 · pyannote.audio
  https://github.com/pyannote/pyannote-audio · model card
  https://huggingface.co/pyannote/speaker-diarization-3.1.
- **Mechanism:** Voice-activity detection → "cut & merge" into ~30 s chunks → batched Whisper ASR
  → **forced phoneme alignment** with a wav2vec2 model to get word-level start/end times →
  diarization (pyannote: segmentation + speaker embeddings + clustering) → assign each word to the
  speaker turn it overlaps.
- **Result:** VAD cut & merge gives ~12× faster batched transcription without WER loss, and fewer
  hallucinations and repetitions than vanilla long-form Whisper. Word timestamps are much tighter
  than Whisper's native segment times (secondary sources cite about ±50 ms vs about ±500 ms; the
  paper reports SOTA word segmentation precision/recall). pyannote 3.1 DER (full, no collar,
  overlap scored): AMI-IHM 18.8%, AMI-SDM 22.7%, DIHARD-3 21.4%. So **roughly one fifth of
  speech time is attributed to the wrong speaker or missed** on hard meeting audio.
- **Strength:** High for the mechanism (peer-reviewed, very widely used); DER is author-reported
  on public benchmarks.
- **UCI primitive:** *Time-addressed evidence spans* `(media_id, t_start, t_end)` with word-level
  granularity; *speaker attribution as a revisable interpretation with confidence*, not a fact.
  "Who said X" is an inference with a ~20% error floor on meetings.
- **Conflicts:** None on the mechanism; end-to-end speech LLMs (e.g., Gemini audio) skip
  alignment and give coarser, less verifiable timestamps.
- **Status:** REPLICATED.

### 2.2 ASR hallucination as an evidence-integrity hazard
- **Citation:** Koenecke et al., "Careless Whisper: Speech-to-Text Hallucination Harms", FAccT
  2024, arXiv:2402.08021 https://arxiv.org/abs/2402.08021.
- **Mechanism:** Audited Whisper transcripts of speech (including aphasia speakers) against the audio.
- **Result:** ~1% of transcriptions contained **entire hallucinated phrases or sentences absent
  from the audio**; 38% of those hallucinations contained explicit harms (violence, false
  associations, false authority). Hallucinations clustered around longer non-vocal pauses. No
  comparable hallucination was found in Google, Amazon, Microsoft, AssemblyAI, or RevAI ASR at the
  time.
- **Strength:** Medium-high (peer-reviewed audit; model versions have since changed).
- **UCI primitive:** **A transcript is interpretation, never evidence.** The audio must be kept,
  and every transcript span must be re-checkable against its audio segment (time-addressed). This
  justifies per-span confidence and a "verify against source" operator for high-stakes claims.
- **Conflicts:** Generative ASR is usually accurate on WER, yet WER does not capture rare
  fabrication. Aggregate metrics hide tail fabrication; the same holds for generative PDF parsers (1.3).
- **Status:** OBSERVED (a specific model family and time; the pattern generalizes by inference).

### 2.3 Video: temporal segmentation, frame sampling, and the value of the speech channel
- **Citations:** Fu et al., "Video-MME", CVPR 2025, arXiv:2405.21075
  https://video-mme.github.io/home_page.html · Wu et al., "LongVideoBench", NeurIPS 2024
  D&B (arXiv:2407.15754) · recent query-grounded frame-selection papers (e.g., arXiv:2608.05707,
  arXiv:2607.28463; 2026 preprints).
- **Mechanism:** Benchmarks with 900 videos / 2,700 QA (Video-MME, 11 s–1 h) and 3,763 videos /
  6,678 QA (LongVideoBench, interleaved subtitles, "referring" queries that point to a moment).
  Systems either (a) uniformly sample N frames into the context, or (b) segment into shots/scenes,
  caption and index segments, and retrieve query-relevant frames ("agentic" or query-grounded
  sampling).
- **Result:** Gemini 1.5 Pro had the best Video-MME score at release, 75.0% (GPT-4o 71.9%).
  Accuracy **drops ~14 points from short to long videos**. Subtitles help more than raw audio;
  audio adds ~6 pts on long videos. Query-grounded frame selection consistently beats uniform
  sampling at a fixed frame budget (2025–26 preprints; margins vary).
- **Strength:** Medium-high for the benchmarks; medium for the sampling papers (many preprints,
  benchmark-tuned).
- **UCI primitive:** *Video = several synchronized tracks on one clock* (frames, ASR words,
  speakers, on-screen text/OCR, shot boundaries). The **text track (ASR/subtitles) carries most
  retrievable semantics**, so it must be time-aligned to frames. Frame selection is a *retrieval*
  decision and belongs in the context manifest.
- **Conflicts:** Long-context "put the whole video in" (Gemini) vs segment+retrieve. Evidence: both
  degrade with length; retrieval wins at a fixed budget.
- **Status:** REPLICATED (long-video degradation; subtitle benefit); OBSERVED (specific sampling gains).

### 2.4 Screenshots and UI understanding
- **Citations:** Lu et al., "OmniParser for Pure Vision Based GUI Agent", arXiv:2408.00203 (2024)
  https://arxiv.org/abs/2408.00203 · Li et al., "ScreenSpot-Pro: GUI Grounding for Professional
  High-Resolution Computer Use", ACM MM 2025, arXiv:2504.07981 https://arxiv.org/abs/2504.07981.
- **Mechanism:** OmniParser detects interactable regions (fine-tuned detector) and captions icons,
  then overlays numbered boxes ("set-of-marks"), so the LLM selects an element ID instead of
  emitting pixel coordinates. ScreenSpot-Pro tests grounding of instructions to elements on 4K
  professional app screenshots (23 apps, 5 industries, 3 OSes).
- **Result:** OmniParser raised GPT-4V element-assignment accuracy from 0.705 to 0.938 with local
  semantics. The fine-tuned detector added +4.3% over raw Grounding DINO. OmniParser beat
  GUI-fine-tuned models (SeeClick, CogAgent, Fuyu) on ScreenSpot. On ScreenSpot-Pro the best model
  at release reached **18.9%**, and a training-free zoom/search strategy (ScreenSeekeR) reached
  48.1%. Frontier models have since improved sharply (a public leaderboard reported ~0.88 for
  the top model in 2026; leaderboard aggregator, not a peer-reviewed number).
- **Strength:** Medium (papers + code; the leaderboard is secondary).
- **UCI primitive:** *Parse the screen into addressable elements (id, bbox, role, text) before
  reasoning.* The model's choice is then a discrete, loggable reference, not a coordinate guess.
  When a DOM or accessibility tree exists, it is the native structure and preferred evidence;
  pixels are the fallback.
- **Conflicts:** End-to-end "pixel-native" agents (computer-use models) are closing the gap; the
  parse-first advantage shrinks as models improve (a scaffolding-vs-structure question).
- **Status:** REPLICATED (structured/marked screens help weaker models); CONTESTED for frontier models.

### 2.5 Aligning modalities on a timeline and on addresses (standards)
- **Citations:** W3C Media Fragments URI 1.0 https://www.w3.org/TR/media-frags/ · W3C Web
  Annotation Data Model (2017) https://www.w3.org/TR/annotation-model/ · W3C Selectors and States
  https://www.w3.org/TR/selectors-states/ · WebVTT https://www.w3.org/TR/webvtt1/.
- **Mechanism:** Media fragments give standard addresses: `#t=10,20` (temporal), `#xywh=pixel:x,y,w,h`
  (spatial), and track/id selectors. The Web Annotation model defines composable **selectors**:
  `TextPositionSelector` (start/end offsets), `TextQuoteSelector` (exact + prefix + suffix,
  robust to re-parsing), `FragmentSelector` (media fragments, PDF page), `SvgSelector`,
  `RangeSelector`, plus `refinedBy` chaining (page → region → text) and `State` (the resource as of a
  time or version).
- **Result:** Standards, not experiments. These are mature W3C Recommendations with multiple
  implementations (Hypothes.is uses position + quote selectors for re-anchoring after documents change).
- **Strength:** High (standard, widely deployed).
- **UCI primitive:** **A universal `EvidenceAnchor` = (evidence_id@content_hash, selector chain,
  state/version).** Position selectors are fast but brittle; quote selectors are robust. Store
  both, and re-anchor on re-parse. The same abstraction covers text offsets, PDF regions, audio/video
  time ranges, and image regions.
- **Conflicts:** None substantive; the cost is implementation effort.
- **Status:** REPLICATED (standardized, deployed).

**Inference (section 2):** Across modalities, the **evidence envelope and the anchor/selector
algebra are universal**. The operator stacks (ASR+alignment+diarization; shot detection+captioning;
screen parsing; layout+OCR) are modality-specific. Every operator output is an interpretation with
confidence, operator@version, and anchors back to raw media. Timelines align through one media clock
per source plus capture time (wall clock), which also feeds temporal grounding (§3.4).
## 3. Knowledge construction (entities, graphs, temporal grounding, provenance, attribution)

### 3.1 Microsoft GraphRAG (community summaries)
- **Citation:** Edge et al., "From Local to Global: A Graph RAG Approach to Query-Focused
  Summarization", arXiv:2404.16130 (2024) https://arxiv.org/abs/2404.16130 · repo
  https://github.com/microsoft/graphrag.
- **Mechanism:** LLM extracts entities, relations and claims per chunk → graph → Leiden community
  detection (hierarchical) → an LLM summary per community → global queries answered by map-reduce
  over community summaries; "local search" mixes entity neighborhoods with text units.
- **Result:** On ~1M-token corpora (podcast transcripts, news), **global sensemaking** questions:
  72–83% win rate on comprehensiveness and 62–82% on diversity vs vector RAG, judged by an LLM
  pairwise; root-level summaries used up to 97% fewer tokens than source-text map-reduce.
- **Strength:** Low-medium (LLM-as-judge, questions generated by an LLM from the corpus, no
  factual gold).
- **UCI primitive:** *Hierarchical derived summaries over a corpus* — useful for "what is this
  whole thing about" queries that retrieval cannot answer. But these are **derived, lossy,
  operator-versioned interpretations**; each summary must list the entity/claim/chunk ids it
  was built from so it can be invalidated when inputs change.
- **Conflicts:** 3.2 (unbiased re-evaluations).
- **Status:** CONTESTED.

### 3.2 Independent re-evaluations of GraphRAG
- **Citations:** Han et al., "RAG vs. GraphRAG: A Systematic Evaluation and Key Insights",
  arXiv:2502.11371 (KDD 2026) https://arxiv.org/abs/2502.11371 · "How Significant Are the Real
  Performance Gains? An Unbiased Evaluation Framework for GraphRAG", arXiv:2506.06331
  https://arxiv.org/abs/2506.06331 · "When to use Graphs in RAG" (GraphRAG-Bench),
  arXiv:2506.05690 https://graphrag-bench.github.io/.
- **Mechanism:** Same LLM (Llama-3.1-8B) and matched token budgets; question generation grounded in
  the graph and the text; debiased LLM judging (controls for position and length).
- **Result:** Han et al.: GraphRAG's multi-hop edge came from feeding **9,770 vs 3,631 retrieved
  tokens**; at matched budget RAG 69.33 vs GraphRAG 69.01 on MultiHop-RAG. GraphRAG kept an
  advantage on **temporal and comparison queries**; RAG is better on single-hop detail. Unbiased
  framework: gains are "much more moderate than reported". GraphRAG-Bench: graphs help on complex
  reasoning/summarization and hurt or tie on simple fact retrieval, at high construction cost.
- **Strength:** Medium-high (independent groups, controlled comparisons).
- **UCI primitive:** **Retrieval evaluations must control the context token budget**, or they
  measure budget, not method. A graph is a *routing/aggregation* structure for specific query types
  (relational, temporal, global), not a universal replacement for evidence retrieval.
- **Conflicts:** Directly qualifies 3.1 and LightRAG's LLM-judged claims.
- **Status:** REPLICATED (budget-matched gains are small and query-type-dependent).

### 3.3 LightRAG, RAPTOR, HippoRAG 2
- **Citations:** Guo et al., "LightRAG: Simple and Fast Retrieval-Augmented Generation",
  EMNLP Findings 2025, arXiv:2410.05779 https://github.com/hkuds/lightrag · Sarthi et al.,
  "RAPTOR: Recursive Abstractive Processing for Tree-Organized Retrieval", ICLR 2024,
  arXiv:2401.18059 https://arxiv.org/abs/2401.18059 · Gutiérrez et al., "From RAG to Memory:
  Non-Parametric Continual Learning for LLMs" (HippoRAG 2), ICML 2025, arXiv:2502.14802
  https://arxiv.org/abs/2502.14802 (HippoRAG v1: NeurIPS 2024, arXiv:2405.14831).
- **Mechanism:** LightRAG: entity/relation graph with keys for low-level (entity) and
  high-level (theme) retrieval, plus **incremental graph updates** without full rebuild. RAPTOR:
  embed → cluster (GMM on UMAP) → summarize → recurse, giving a summary tree; retrieve across
  levels ("collapsed tree"). HippoRAG: OpenIE triples form a KG of phrase nodes; the query's
  entities seed **Personalized PageRank**; v2 adds passage nodes and LLM "recognition memory"
  filtering of triples.
- **Result:** RAPTOR+GPT-4 on QuALITY: 82.6% test (76.2% hard) vs previous SOTA 62.3% (the "+20
  points absolute" claim, much of which is the stronger GPT-4 reader; controlled same-reader
  comparisons vs flat retrieval in the paper show smaller, single-digit gains); QASPER 55.7 F1 vs
  53.9; NarrativeQA METEOR 19.1. HippoRAG 2: ~+7 points on
  associative (multi-hop) memory tasks over NV-Embed-v2 while **not degrading simple factual QA**,
  which earlier structure-augmented methods (GraphRAG, LightRAG, RAPTOR) did in its comparison.
  LightRAG: LLM-judged win rates vs NaiveRAG/GraphRAG (subject to the 3.2 caveats).
- **Strength:** RAPTOR / HippoRAG 2 medium (peer-reviewed, public benchmarks, code); LightRAG
  low-medium (LLM-judged).
- **UCI primitive:** (a) *Multi-resolution views* (RAPTOR tree = hierarchy of lossy views over
  evidence spans). (b) *Graph as associative index* (HippoRAG: the graph routes to passages, and the
  passages remain the evidence). (c) *Incremental derivation*: new evidence updates derived
  structures locally (LightRAG), which a lifelong system needs.
- **Conflicts:** HippoRAG 2 reports that RAPTOR/GraphRAG/LightRAG *hurt* simple QA vs a strong
  dense retriever; this is consistent with 3.2.
- **Status:** OBSERVED (each); REPLICATED (pattern: structure helps multi-hop/global, can hurt simple lookup).

### 3.4 Graphiti / Zep (bi-temporal knowledge graph for agent memory)
- **Citation:** Rasmussen et al., "Zep: A Temporal Knowledge Graph Architecture for Agent
  Memory", arXiv:2501.13956 (2025) https://arxiv.org/abs/2501.13956 · repo
  https://github.com/getzep/graphiti.
- **Mechanism:** Three subgraphs: **episodes** (raw messages or data, kept), **semantic entities
  and facts** (edges extracted from episodes, each linked back to its episode), and
  **communities**. Every fact edge is **bi-temporal**: `valid_at/invalid_at` (when it holds in the
  world) and `created_at/expired_at` (when the system learned or retracted it). Relative dates are
  resolved against the episode's reference timestamp. Contradicting new facts *invalidate* old edges
  instead of deleting them. Entity resolution is embedding + full-text candidate search followed
  by LLM dedup. Retrieval is hybrid (cosine + BM25 + graph BFS) with rerankers (RRF, MMR,
  episode-mentions, node distance, cross-encoder).
- **Result:** DMR 94.8% vs MemGPT 93.4%; LongMemEval up to +18.5% accuracy and ~90% lower
  latency vs full-context baseline (vendor paper).
- **Strength:** Low-medium (vendor-authored; DMR is saturated and weak; LongMemEval gains vary
  by model).
- **UCI primitive:** **Bi-temporal facts with episode provenance and invalidation instead of
  deletion** — this matches the "beliefs change by revision, never overwrite" law. *Temporal
  grounding of relative expressions against capture time* is performed at ingestion.
- **Conflicts:** Vendor numbers; competing memory vendors (Mem0 etc.) publish conflicting
  LoCoMo/LongMemEval comparisons. Treat the benchmark numbers as CLAIMED and the design as sound.
- **Status:** CLAIMED (numbers); design pattern OBSERVED in code.

### 3.5 Entity resolution / entity linking
- **Citations:** Wu et al., BLINK, "Scalable Zero-shot Entity Linking with Dense Entity
  Retrieval", EMNLP 2020 (baseline) · Ayoola et al., ReFinED (NAACL 2022) · Liu et al., "OneNet:
  A Fine-Tuning Free Framework for Few-Shot Entity Linking via LLM Prompting", EMNLP 2024
  https://aclanthology.org/2024.emnlp-main.756/ · Ding et al., "ChatEL: Entity Linking with
  Chatbots", LREC-COLING 2024 · "LELA", arXiv:2601.05192 (2026).
- **Mechanism:** Two-stage *candidate generation* (dense/bi-encoder or alias table) → *disambiguation*
  (cross-encoder or LLM reasoning over candidates); LLM methods add consistency/voting to reduce
  hallucinated links.
- **Result:** ChatEL: +16.9 F1 on hard KORE50 vs fine-tuned baselines; LLM methods are strongest
  out-of-domain. LELA reports zero-shot parity with supervised ReFinED/ReLiK on general data and ~+18
  pts on scientific abstracts. Still, zero-shot EL in new domains can be low (one 2026 report cites
  OneNet at 23.7 F1 vs 45.7 for a newer method on a hard setting). Numbers vary widely by domain.
- **Strength:** Medium (peer-reviewed, heterogeneous benchmarks).
- **UCI primitive:** **Identity is a hypothesis with confidence and evidence, not a merge.**
  An entity-resolution decision (mention m → entity e) is a revisable interpretation linked to
  the mention anchor; merges must be reversible (split later). Candidate generation is universal
  (similarity), but *disambiguation criteria are domain-specific* (e.g., a learner's "chapter 3"
  refers to their own book).
- **Conflicts:** Embedding similarity used as identity is exactly the "similarity is not identity"
  law violation; Graphiti's LLM dedup is a pragmatic compromise without a reported error rate.
- **Status:** REPLICATED (LLM EL strong out-of-domain but unreliable in the tail).

### 3.6 Temporal grounding of text
- **Citations:** ISO-TimeML / TIMEX3 (Pustejovsky et al.; ISO 24617-1) · TempEval-3 (UzZaman et
  al., SemEval 2013) · Clinical TempEval / THYME (DocTimeRel) · "Generative LLMs for Multilingual
  Temporal Expression Normalization" (2024) · "Discourse-Aware In-Context Learning for Temporal
  Expression Normalization", NAACL 2024 https://aclanthology.org/2024.naacl-short.27.pdf ·
  Graphiti reference-time resolution (3.4).
- **Mechanism:** Temporal expressions are detected, typed (DATE/TIME/DURATION/SET), and
  **normalized relative to an anchor, usually the document creation time (DCT)**: "yesterday" with
  DCT 2022-05-01 → 2022-04-30. Events get a relation to the DCT (BEFORE/OVERLAP/AFTER). LLM
  in-context normalization is competitive with rule systems (HeidelTime/SUTime) on common
  expressions; vague expressions ("a while ago") remain hard.
- **Result:** Rule-based normalizers reached ~0.7–0.8 F1 on TempEval-3 normalization; 2024 LLM ICL
  results are competitive, with discourse-aware example selection helping (exact numbers vary per
  language and dataset, so this report does not pin one figure).
- **Strength:** Medium (long-standing task and standards; LLM results are recent).
- **UCI primitive:** **Every evidence envelope needs `captured_at` (and, if different,
  `authored_at` / `refers_to` time), because relative expressions are ungroundable without an
  anchor.** Normalized time is an interpretation (value + granularity + confidence + anchor used),
  never an overwrite of the original surface text. A wrong DCT silently corrupts every derived date,
  so the anchor must be recorded in the derivation.
- **Conflicts:** None substantive; the practical failure is missing or ambiguous DCT (for example,
  a forwarded message, or a book edition date vs reading date).
- **Status:** REPLICATED (anchor-relative normalization is the standard); OBSERVED (LLM parity).

### 3.7 Provenance standards: W3C PROV, nanopublications, Web Annotation
- **Citations:** W3C PROV-O / PROV-DM (Recommendation, 2013) https://www.w3.org/TR/prov-o/ ·
  Groth, Gibson, Velterop, "The anatomy of a nanopublication", Information Services & Use 2010;
  Kuhn et al., "Decentralized provenance-aware publishing with nanopublications", PeerJ CS 2016
  https://nanopub.net · W3C Web Annotation (2.5).
- **Mechanism:** PROV: **Entity** (a thing), **Activity** (a process over time), **Agent**
  (responsible party), with relations `wasGeneratedBy`, `used`, `wasDerivedFrom`,
  `wasAttributedTo`, `wasAssociatedWith`, `actedOnBehalfOf`, `wasInvalidatedBy`, plus
  `prov:Plan` and qualified relations carrying roles and times. Nanopublication: the smallest
  publishable claim = **assertion graph + provenance graph (how the assertion came to be) +
  publication-info graph (who/when published)**, with trusty URIs (content hashes) for
  immutability.
- **Result:** Standards with long deployment in science (life-science nanopubs number in the
  millions); no accuracy numbers apply.
- **Strength:** High (standards).
- **UCI primitive:** The derivation record for *every* interpretation = PROV triple-set
  (output entity, generating activity = operator@version run, used inputs = evidence anchors,
  associated agent = model/person, time). **The nanopublication split — assertion vs how derived vs
  who published — maps cleanly onto claim / derivation / attribution** and onto the
  evidence → interpretation → claim → belief stage chain. Content-hash identifiers give immutability.
- **Conflicts:** RDF-first tooling is heavy; the *model* is what matters, not the serialization.
- **Status:** REPLICATED (mature standards).

### 3.8 Attribution and citation faithfulness
- **Citations:** Liu, Zhang, Liang, "Evaluating Verifiability in Generative Search Engines",
  EMNLP Findings 2023, arXiv:2304.09848 https://arxiv.org/abs/2304.09848 · Gao et al., ALCE,
  "Enabling LLMs to Generate Text with Citations", EMNLP 2023, arXiv:2305.14627
  https://github.com/princeton-nlp/ALCE · Rashkin et al., "Measuring Attribution in NLG Models"
  (AIS), Computational Linguistics 2023 · Wallat et al., "Correctness is not Faithfulness in RAG
  Attributions", ICTIR 2025, arXiv:2412.18004 https://arxiv.org/abs/2412.18004 · Anthropic
  Citations API docs https://platform.claude.com/docs/en/build-with-claude/citations.
- **Mechanism:** AIS ("Attributable to Identified Sources"): a statement is attributable if a
  generic reader would agree "according to source S, statement X". ALCE automates **citation
  recall** (is each statement entailed by its cited set?) and **citation precision** (is each
  cite necessary/relevant?) with an NLI model (TRUE/T5-11B). Wallat et al. separate *correctness*
  (the cited doc supports the statement) from *faithfulness* (the model actually *used* the doc,
  vs post-rationalization). Anthropic Citations: the document is chunked into sentences (or
  caller-defined content blocks), the model emits pointers, and the API returns `char_location` /
  `page_location` / `content_block_location` with `cited_text` extracted **from the source, not
  generated** (does not count as output tokens).
- **Result:** Generative search engines: **51.5%** of sentences fully supported by their
  citations; **74.5%** of citations support their sentence (human eval, 4 engines, 2023). ALCE:
  the best systems still lacked complete citation support for about half of ELI5 statements (author
  statement); NLI misses "partial support". Wallat et al.: **up to 57% of citations are
  unfaithful** (post-rationalized) even when correct.
- **Strength:** High for Liu et al. (human audit); medium for ALCE (automatic NLI); medium for Wallat.
- **UCI primitive:** (a) **Citation = pointer into an evidence anchor, resolved by the system, with
  the quoted text copied from source, never generated.** (b) Correct ≠ faithful: a citation does not
  prove the model's reasoning used the source. Faithfulness needs *counterfactual* checks (remove or
  alter the cited source; does the answer change?). (c) Verification is a separate operator
  (NLI/judge) whose verdict is logged with its own version.
- **Conflicts:** None; they agree the problem is large.
- **Status:** REPLICATED (citation support is far from complete across systems and years).

**Inference (section 3):** Knowledge construction splits into (1) *universal mechanics* —
mention anchoring, candidate generation, derivation provenance (PROV), bi-temporal validity,
invalidation-not-deletion, content-hashed identity; and (2) *domain-specific judgement* — which
entity types and relations matter, disambiguation rules, and which summaries are worth
materializing. Graph and summary structures are **indexes and lossy views**; independent evaluations
show they help relational, temporal, and global queries and do not replace span-level evidence
retrieval. Attribution research says a citation proves correctness at best, not use; UCI needs both
pointer-based citations (mechanical) and counterfactual faithfulness checks (measured).
## 4. Retrieval

### 4.1 BEIR: BM25 is the robust baseline; cross-encoder reranking is the ceiling
- **Citation:** Thakur et al., "BEIR: A Heterogeneous Benchmark for Zero-shot Evaluation of
  Information Retrieval Models", NeurIPS 2021 D&B, arXiv:2104.08663 · Rosa et al., "In Defense of
  Cross-Encoders for Zero-Shot Retrieval", arXiv:2212.06121 · MTEB leaderboard (2023–26).
- **Mechanism:** 18 heterogeneous datasets, zero-shot; compares lexical, sparse-learned, dense,
  late-interaction, and re-ranking systems.
- **Result:** At release, BM25 beat most dense retrievers out-of-domain (large losses for dense on
  BioASQ and Touché); BM25 + cross-encoder rerank was best on most tasks. ColBERTv2 (late
  interaction) was the strongest first-stage neural retriever. Later dense models (E5, GTE, NV-Embed,
  and so on, trained on massive mixed data) surpass BM25 on aggregate nDCG@10, but gains are uneven
  across datasets.
- **Strength:** High (standard benchmark, widely replicated).
- **UCI primitive:** *Multi-stage retrieval = cheap high-recall candidate generation (lexical +
  dense) → expensive precise reranking.* Each stage is a versioned operator whose candidate list and
  scores should be logged.
- **Conflicts:** Modern dense > BM25 on average, but not per-domain (see 4.2–4.4).
- **Status:** REPLICATED.

### 4.2 Where dense retrieval fails: entities, exact tokens, combinatorial relevance
- **Citations:** Sciavolino et al., "Simple Entity-Centric Questions Challenge Dense
  Retrievers", EMNLP 2021, arXiv:2109.08535 https://github.com/princeton-nlp/EntityQuestions ·
  Weller et al. (Google DeepMind), "On the Theoretical Limitations of Embedding-Based Retrieval"
  (LIMIT), arXiv:2508.21038 (ICLR 2026).
- **Mechanism:** (a) Template questions about long-tail entities ("Where was [E] born?"). (b)
  Theory: the sign-rank of the qrel matrix lower-bounds the embedding dimension needed to realize
  all top-k combinations. LIMIT dataset: simple "who likes X" queries with dense combinatorial
  relevance.
- **Result:** (a) DPR top-20 49.7% vs **BM25 71.2%**; "Where was [E] born?" DPR 25.4% vs BM25
  75.2%; multi-dataset DPR only 56.7%. (b) On LIMIT, SOTA single-vector embedders (up to 4096-d)
  get **<20% recall@100**, while BM25 gets ~85–94%+, and multi-vector (ColBERT-style) models do much
  better than single-vector ones.
- **Strength:** High (a is peer-reviewed and widely cited; b has a formal bound plus experiments,
  peer-reviewed).
- **UCI primitive:** **Exact retrieval and similarity retrieval are different operators with
  different guarantees.** Identifiers, names, code symbols, quotes, dates, and "all items matching a
  predicate" require lexical/structured (key, index, filter) retrieval. Similarity retrieval is
  inherently lossy and has a provable capacity ceiling. This underlies the law "operational memory
  is read by key, never by similarity."
- **Conflicts:** None; dense proponents accept this and add hybrid.
- **Status:** REPLICATED.

### 4.3 Reasoning-intensive retrieval (BRIGHT)
- **Citation:** Su et al., "BRIGHT: A Realistic and Challenging Benchmark for Reasoning-Intensive
  Retrieval", ICLR 2025, arXiv:2407.12883 https://arxiv.org/abs/2407.12883 · follow-ups
  ReasonEmbed (ACL 2026), DIVER (arXiv:2508.07995).
- **Mechanism:** Queries whose relevant documents share no surface or topical similarity and need
  reasoning to connect (StackExchange, coding, math theorems).
- **Result:** The MTEB leader at the time (SFR-Embedding-Mistral, 59.0 nDCG@10 on MTEB) scored
  **18.3** on BRIGHT. LLM-generated reasoning query expansion improves by up to 12.2 points, and
  BM25 gains most; BM25 + GPT-4 reasoning reached 26.5. Later reasoning-trained embedders reach ~38
  (ReasonEmbed), and multi-stage hybrid + reranking reaches ~46.8 (DIVER).
- **Strength:** Medium-high (peer-reviewed, public, many follow-ups).
- **UCI primitive:** **Retrieval for hard queries is an iterative cognitive act** (reformulate →
  retrieve → judge → re-query), not a single similarity lookup. This is the clearest evidence for
  where retrieval and cognition interleave (§7.2).
- **Conflicts:** None.
- **Status:** REPLICATED.

### 4.4 Hybrid fusion, late interaction, contextualized indexing
- **Citations:** Cormack et al., "Reciprocal Rank Fusion outperforms Condorcet and individual rank
  learning methods", SIGIR 2009 · Santhanam et al., "ColBERTv2", NAACL 2022 · Elastic hybrid
  evaluation https://www.elastic.co/search-labs/blog/improving-information-retrieval-elastic-stack-hybrid
  · Anthropic Contextual Retrieval (1.6) · Cursor, "Improving agent with semantic search" (Nov
  2025) https://cursor.com/blog/semsearch · "Is Grep All You Need? How Agent Harnesses Reshape
  Agentic Search", arXiv:2605.15184 (2026).
- **Mechanism:** RRF: score = Σ 1/(k + rank_i) across retrievers, with no score calibration needed.
  Late interaction: token-level vectors with MaxSim. Agentic search: the model calls grep/glob/read
  tools iteratively instead of receiving pre-retrieved chunks.
- **Result:** Elastic on BEIR: RRF(BM25 + learned sparse) +1.4% nDCG@10 over learned sparse alone,
  +18% over BM25 alone. Anthropic: hybrid + rerank cuts failures 67% (1.6). Cursor (vendor): adding
  semantic search to grep raised agent answer accuracy by **12.5% on average (6.5–23.5% by model)**
  on an internal benchmark, with the biggest gains in large codebases; grep + semantic was best.
  "Is Grep All You Need?": on a 116-question LongMemEval subset across Claude Code, Codex, Gemini
  CLI and others, **grep generally beat vector retrieval, but the harness and tool-output style
  moved scores as much as the retriever did**.
- **Strength:** RRF/ColBERT high; Cursor CLAIMED (internal eval); grep study medium (preprint,
  small sample).
- **UCI primitive:** *Fusion over heterogeneous retrievers (lexical, dense, late-interaction,
  structural/graph, temporal filter) with rank-based combination*, plus **logging of each
  retriever's contribution**, so a context item's reason for selection is attributable.
- **Conflicts:** Cursor vs grep study: the domain (code vs conversation memory) and harness differ.
  Both support hybrid; neither supports a single retriever.
- **Status:** REPLICATED (hybrid ≥ either alone); CONTESTED (grep-only vs semantic for agents).

### 4.5 Hierarchical and graph retrieval (see §3)
- **Summary of evidence:** Tree/graph retrieval helps global sensemaking, multi-hop, temporal and
  comparison queries (RAPTOR, HippoRAG 2, GraphRAG local/global). At matched token budgets, gains
  over flat RAG shrink to near zero for multi-hop factoid QA (Han et al.) and can be negative for
  simple lookup (HippoRAG 2's comparison). **Status:** REPLICATED (query-type dependence).
- **UCI primitive:** *Query-type-aware routing* among exact, similarity, hierarchical, and graph
  retrieval, with the routing decision logged. Routing is scaffolding and must be ablation-tested.

### 4.6 Retrieval failure taxonomy (synthesized from 4.1–4.5 and §1–3)
| Failure | Mechanism | Best-evidenced mitigation | Example number |
| --- | --- | --- | --- |
| Long-tail entity miss | dense vectors do not encode rare names | BM25/lexical, hybrid | DPR 49.7 vs BM25 71.2 top-20 |
| Combinatorial relevance | single-vector capacity bound | lexical, multi-vector, structured filter | <20% recall@100 dense on LIMIT |
| Reasoning gap | no surface overlap | LLM query reasoning + rerank, iterative | 18.3 → 26.5 → ~46.8 nDCG@10 |
| Context loss at chunking | chunk lacks document context | contextual prefix, element chunking | 5.7% → 1.9% failures |
| Visual-only evidence | text extraction drops figures/layout | page-image retrieval, hybrid | 0.66 → 0.81 nDCG@5 (ViDoRe v1) |
| Global questions | answer spread across corpus | hierarchical summaries (with caveats) | 72–83% LLM-judged win rate |
| Budget confound | more tokens ≠ better method | matched-budget evaluation | 69.33 vs 69.01 when matched |
## 5. Context engineering and long context

### 5.1 Lost in the Middle (position effects)
- **Citation:** Liu et al., "Lost in the Middle: How Language Models Use Long Contexts", TACL
  2024, arXiv:2307.03172 https://aclanthology.org/2024.tacl-1.9/ · code
  https://github.com/nelson-liu/lost-in-the-middle.
- **Mechanism:** Multi-doc QA (10/20/30 NQ passages, one containing the answer) and synthetic
  key-value retrieval, varying the gold item's position.
- **Result:** U-shaped accuracy: best at the start (primacy) or end (recency), worst in the middle.
  For GPT-3.5-Turbo with 20 docs, mid-position accuracy fell **below its closed-book score (56.1%)**,
  so adding the gold document in the middle was worse than giving no documents. Extended-context
  variants were no better at using their context.
- **Strength:** High (peer-reviewed, widely replicated; later models flatten but do not eliminate
  the curve; 2026 work reports *primacy* bias in multimodal RAG, arXiv:2606.16494).
- **UCI primitive:** **Order is a semantic decision.** The context compiler must choose positions
  deliberately (critical items at the edges, instructions near the query) and record the order in the
  manifest, because position changes the outcome.
- **Conflicts:** Magnitude shrinks in newer models; the direction (primacy or recency) varies by
  model and modality.
- **Status:** REPLICATED.

### 5.2 Effective vs advertised context: RULER, NoLiMa, LongBench v2, context rot
- **Citations:** Hsieh et al. (NVIDIA), "RULER: What's the Real Context Size of Your Long-Context
  LMs?", COLM 2024, arXiv:2404.06654 https://github.com/NVIDIA/RULER · Modarressi et al. (Adobe),
  "NoLiMa: Long-Context Evaluation Beyond Literal Matching", ICML 2025, arXiv:2502.05167 · Bai et
  al., "LongBench v2", ACL 2025, arXiv:2412.15204 · Hong, Troynikov, Huber (Chroma), "Context Rot:
  How Increasing Input Tokens Impacts LLM Performance" (Jul 2025)
  https://research.trychroma.com/context-rot · Du et al., "Context Length Alone Hurts LLM
  Performance Despite Perfect Retrieval", EMNLP Findings 2025, arXiv:2510.05381.
- **Mechanism:** RULER: synthetic retrieval, multi-hop tracing, aggregation, and QA at 4K–128K;
  "effective length" = longest length above a threshold. NoLiMa: needle and question share *no
  lexical overlap*, so latent association is required. LongBench v2: 503 expert-written MCQs over
  8k–2M-word contexts. Chroma: 18 frontier models on controlled variations (needle–question
  similarity, distractors, haystack coherence, repeated-words task). Du et al.: replace irrelevant
  tokens with whitespace or mask them, so the evidence is perfectly retrievable.
- **Result:** RULER: near-perfect NIAH, yet only 4 of 10 models claiming ≥32K kept satisfactory
  performance at 32K. NoLiMa: of 13 models claiming ≥128K, **11 fell below 50% of their short-context
  score at 32K**. LongBench v2: best direct-answer model 50.1% vs human experts 53.7% (15-minute
  limit); o1-preview 57.7% with long reasoning. Chroma: **every one of the 18 models degraded as
  input length grew**, including on trivial tasks; distractors and low needle–question similarity
  make it worse, and, counterintuitively, logically *coherent* haystacks hurt more than shuffled ones.
  Du et al.: **13.9%–85% degradation from length alone**, even with whitespace padding or masked
  distractors and the evidence placed right before the question. Having the model recite the
  evidence first recovered up to 4% (GPT-4o, RULER).
- **Strength:** High (multiple independent groups, public code; Chroma is an industry report with
  released code).
- **UCI primitive:** **Context is a scarce, degrading resource, not a store.** The context window
  must never be the record. Budget is a first-class compiler parameter, and "put everything in"
  is measurably worse than selection. **NIAH-style recall is not evidence of reasoning over the
  context.**
- **Conflicts:** Frontier models improve every generation (for example, Gemini 1.5 held up at 128K on
  RULER), but no study finds length-invariant performance on non-literal tasks.
- **Status:** REPLICATED.

### 5.3 Primary guidance: Anthropic "Effective context engineering for AI agents" (2025), Manus
- **Citations:** Anthropic Applied AI, "Effective context engineering for AI agents" (Sep 2025)
  https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents · Ji (Manus),
  "Context Engineering for AI Agents: Lessons from Building Manus" (Jul 2025)
  https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus.
- **Mechanism (Anthropic):** Treat context as a finite **attention budget** subject to context rot;
  goal = "the smallest possible set of high-signal tokens that maximize the likelihood of some
  desired outcome." Techniques: **just-in-time retrieval** (keep lightweight references such as
  paths, queries, and links, and load on demand via tools such as grep/glob), **compaction**
  (summarize the history near the limit, keeping decisions, unresolved bugs, and implementation details),
  **tool-result clearing**, **structured note-taking** outside the window (NOTES.md, to-do lists),
  and **sub-agents** with clean windows that return condensed 1–2k-token summaries.
- **Mechanism (Manus):** **KV-cache hit rate is "the single most important metric"** for
  production agents (cached $0.30/MTok vs $3/MTok uncached, Claude Sonnet, 10×); ~**100:1
  input:output token ratio**; keep the prompt prefix stable and the context append-only; *mask* tool
  logits instead of removing tools (removal invalidates the cache); treat the **file system as
  externalized, restorable memory** (drop page content but keep the URL, and drop file content but
  keep the path); **keep errors in context**; recite goals (todo.md) to push them into recent attention
  across ~50 tool calls; add structured variation to avoid few-shot mimicry.
- **Result:** Practitioner guidance; few controlled numbers beyond cost ratios.
- **Strength:** Medium as design guidance (practitioners with scale); low as empirical evidence.
- **UCI primitive:** (a) *References over payloads*: context items should be pointers that can
  be dereferenced again, so compression is **restorable**. (b) *Append-only, stable-prefix
  compilation* for cache economics, which favors a deterministic compiler with a stable ordering of
  typed sections. (c) *Externalized working state*: the durable record lives outside the window.
  Both sources describe *restorable* compaction but neither logs why an item was included.
- **Conflicts:** Manus says keep errors and do not remove tools; Anthropic endorses clearing tool
  results. These are compatible, since stale tool *outputs* are cleared while *error lessons* are kept.
- **Status:** CLAIMED (practitioner reports), consistent with 5.2 evidence.

### 5.4 Context compression: LLMLingua family, gist tokens, observation masking, summarization
- **Citations:** Jiang et al., "LLMLingua", EMNLP 2023, arXiv:2310.05736 · Jiang et al.,
  "LongLLMLingua", ACL 2024, arXiv:2310.06839 · Pan et al., "LLMLingua-2", ACL Findings 2024 · Mu,
  Li, Goodman, "Learning to Compress Prompts with Gist Tokens", NeurIPS 2023, arXiv:2304.08467 ·
  Lindenbauer et al. (JetBrains), "The Complexity Trap: Simple Observation Masking Is as Efficient
  as LLM Summarization for Agent Context Management", NeurIPS DL4Code 2025, arXiv:2508.21433 · Kim et
  al., "FABLES: Evaluating faithfulness and content selection in book-length summarization",
  COLM 2024, arXiv:2404.01261.
- **Mechanism:** LLMLingua: a small LM scores token perplexity and drops low-information tokens
  (budget controller, iterative). LongLLMLingua: *question-aware* coarse-to-fine compression plus
  document reordering. Gist tokens: fine-tune the model to compress a prompt into k learned virtual
  tokens (model-specific, not human-readable). Observation masking: replace old tool observations with
  a placeholder and keep the reasoning and action history. Summarization: an LLM rewrites the history.
- **Result:** LLMLingua: up to **20× compression with ~1.5-point loss** on GSM8K/BBH-style reasoning.
  LongLLMLingua: **+21.4% on NQ with gold in the middle using ~4× fewer tokens** (it mitigates
  lost-in-the-middle by reordering), with 71.7–94% cost reduction across benchmarks. Gist: up to
  26× prompt compression, ~40% FLOPs reduction, with small quality loss on instruction following.
  Complexity Trap: on SWE-bench Verified across 5 model settings, **masking matched or slightly beat
  LLM summarization and halved cost vs the raw agent** (e.g., Qwen3-Coder-480B 53.8% → 54.8%), and a
  hybrid cut a further 7–11%. FABLES: 3,158 claims annotated across 26 books; even the best model
  (Claude-3-Opus) produced unfaithful claims, mostly about events and character states that need
  indirect reasoning to refute; **omissions of crucial narrative elements were systematic**, and
  long-context models **over-weighted the end of the book**.
- **Strength:** LLMLingua family medium-high (peer-reviewed, code); gist medium; Complexity Trap
  medium (workshop, public code, one benchmark); FABLES high (large human annotation).
- **UCI primitive:** **Compression is a lossy, versioned derivation, never a replacement.**
  Token-dropping and gist compression are unreadable or unauditable. Summarization introduces both
  *fabrication* and *omission* with positional bias. Masking with a pointer back ("observation
  elided; see event #n") is cheap, restorable, and empirically as good for coding agents. Prefer
  **elision-with-reference over rewriting**; when rewriting, keep the shadowed events and measure
  recall (see 6.3).
- **Conflicts:** Compression "improving" accuracy (LongLLMLingua) is partly a position and
  distraction effect (5.1–5.2), not information gain.
- **Status:** REPLICATED (compression feasible at high ratios on benchmarks); OBSERVED (masking ≈
  summarization); REPLICATED (summaries omit and fabricate).

### 5.5 Prompt caching economics
- **Citations:** Anthropic prompt caching docs
  https://platform.claude.com/docs/en/build-with-claude/prompt-caching and pricing
  https://platform.claude.com/docs/en/about-claude/pricing · OpenAI prompt caching docs (automatic
  prefix caching, discounted cached input) · Manus (5.3).
- **Mechanism:** The provider caches the KV state of an exact prompt *prefix* up to a breakpoint.
  Any change earlier in the prompt invalidates everything after it.
- **Result:** Anthropic: cache write 1.25× base input (5-minute TTL) or 2× (1-hour TTL), cache read
  **0.1×**. Break-even after 1 read (5-minute) or 2 reads (1-hour). Anthropic's launch post claimed
  up to 90% cost and 85% latency reduction for long prompts (vendor claim). With 100:1 input:output
  ratios (Manus), cache hit rate dominates agent cost.
- **Strength:** High (published pricing); latency claims CLAIMED.
- **UCI primitive:** **Context compilation must be prefix-stable and deterministic.** Order sections
  from most stable to most volatile (constitution → tools → durable working state → retrieved
  evidence → recent events → query). Non-destructive compaction that rewrites early context
  destroys the cache. The manifest should record cache breakpoints and hit/miss for cost attribution.
- **Conflicts:** Cache stability conflicts with relevance-optimal reordering (5.1) and with
  "recency-edge" placement. This is a real trade-off to resolve by section design.
- **Status:** REPLICATED (pricing mechanics).

### 5.6 Structured and typed context
- **Citations:** He et al. (Microsoft), "Does Prompt Formatting Have Any Impact on LLM
  Performance?", arXiv:2411.10541 (2024) · Anthropic prompt-engineering docs (XML tags for sections,
  long documents at the top, query at the end) · POML, "Prompt Orchestration Markup Language",
  arXiv:2508.13948.
- **Mechanism:** The same content rendered as plain text, Markdown, JSON, or YAML; compare task accuracy.
- **Result:** GPT-3.5-turbo varied **up to 40%** on code translation by template, while GPT-4 was
  more robust. The best format was model-dependent (JSON for GPT-3.5, Markdown for GPT-4 in their
  tests). Anthropic guidance reports that placing long documents *before* the query improves quality
  (vendor internal testing cites up to ~30% on complex multi-document inputs; CLAIMED).
- **Strength:** Medium (single group; model-generation dependent).
- **UCI primitive:** **Rendering is a per-model compiler backend.** Working state is typed and
  model-independent; its rendering (tags, ordering, format) is a model-specific, versioned template,
  recorded in the manifest so a model swap can re-render instead of re-deriving.
- **Conflicts:** Newer models are less format-sensitive; the separation still costs nothing.
- **Status:** OBSERVED.

### 5.7 Context provenance and attribution: what exists
- **Citations:** Cohen-Wang et al. (MIT), "ContextCite: Attributing Model Generation to
  Context", NeurIPS 2024, arXiv:2409.00729 https://gradientscience.org/contextcite/ · AttriBoT,
  arXiv:2411.15102 · SelfCite, arXiv:2502.09604 · OpenTelemetry GenAI semantic conventions
  https://opentelemetry.io/docs/specs/semconv/gen-ai/ · the caller's 7-harness study (no context
  manifest found; non-destructive compaction in some).
- **Mechanism:** ContextCite randomly ablates context sources, measures the change in
  response log-probability, and fits a sparse linear (Lasso) surrogate, giving a per-source
  attribution score from O(s log n) ablation passes. OTel GenAI conventions log model, token counts,
  and optionally prompt and completion content per span, which is *what* was sent but not *why*.
- **Result:** ContextCite surrogates predict ablation effects faithfully and beat attention- and
  gradient-based baselines at identifying responsible sources. Its attributions can prune the context
  (keep top-k sources) and **improve** QA, and can detect poisoning.
- **Strength:** Medium-high (peer-reviewed, code, follow-ups).
- **UCI primitive:** Two distinct records: (1) **inclusion provenance**, *why* each item entered
  the context (retriever, score, rule, budget decision), which is logged by the compiler at build time;
  and (2) **use attribution**, *which* items actually influenced the output, measured post hoc by
  counterfactual ablation (ContextCite) and sampled, not run on every step. Observability standards
  capture only the payload.
- **Conflicts:** None. No surveyed system or standard combines the two into a manifest (consistent
  with the caller's harness finding).
- **Status:** OBSERVED (ContextCite); SPECULATIVE (manifest design, §7.3).
## 6. Evaluation of ingestion and grounding

### 6.1 Faithfulness / groundedness metrics
- **Citations:** Min et al., "FActScore: Fine-grained Atomic Evaluation of Factual Precision in
  Long Form Text Generation", EMNLP 2023, arXiv:2305.14251 · Es et al., "RAGAS: Automated
  Evaluation of Retrieval Augmented Generation", EACL 2024 demo, arXiv:2309.15217 · Saad-Falcon et
  al., "ARES", NAACL 2024 · Honovich et al., "TRUE: Re-evaluating Factual Consistency Evaluation",
  NAACL 2022 · Zha et al., "AlignScore", ACL 2023 · Rashkin et al., AIS (3.8) · Zheng et al.,
  "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena", NeurIPS 2023 D&B.
- **Mechanism:** Common structure: **decompose the output into atomic claims → retrieve or align
  each claim to evidence → verify by NLI or judge → aggregate** (precision = supported/total;
  recall = evidence facts covered). RAGAS splits *faithfulness* (answer claims entailed by the
  retrieved context), *answer relevance*, *context precision*, and *context recall*. ARES trains
  lightweight judges with prediction-powered inference to give confidence intervals from few
  human labels.
- **Result:** FActScore: ChatGPT biographies scored **58%** factual precision. The automated
  estimator (retrieval + LM) had **<2% error** vs human FActScore at the system level. TRUE/AlignScore:
  NLI-style checkers generalize across consistency tasks better than n-gram metrics. MT-Bench:
  GPT-4 judges reached ~80% agreement with humans (≈ human–human), with documented **position,
  verbosity, and self-enhancement biases**.
- **Strength:** High for the decomposition paradigm (widely replicated); medium for any single metric.
- **UCI primitive:** **Claim-level verification against anchored evidence** is the universal
  grounding check: Claim(text, anchors[]) → Verdict(supported / contradicted / unverifiable,
  verifier@version, confidence). The same atomization serves attribution (3.8), faithfulness
  scoring, and compaction recall (6.3). Judges are operators with known biases and must be
  versioned and calibrated against human labels.
- **Conflicts:** System-level accuracy of automated estimators (<2%) ≠ claim-level accuracy.
  Per-claim verdicts are noisier, and "partial support" is missed by NLI (ALCE).
- **Status:** REPLICATED.

### 6.2 Hallucination in RAG (measured)
- **Citations:** Niu et al., "RAGTruth: A Hallucination Corpus for Developing Trustworthy
  Retrieval-Augmented Language Models", ACL 2024, arXiv:2401.00396
  https://github.com/ParticleMedia/RAGTruth · Liu et al. 2023 (3.8) · Vectara HHEM leaderboard
  https://github.com/vectara/hallucination-leaderboard.
- **Mechanism:** RAGTruth: ~18,000 naturally generated RAG responses (QA/MS MARCO, data-to-text/Yelp,
  news summarization) from six LLMs, annotated at **word/span level** with a four-class taxonomy
  (evident / subtle × conflict / baseless introduction). There was >91% response-level agreement.
  HHEM: summarize fixed documents, score with a trained consistency classifier.
- **Result:** Every model hallucinated even with correct context, with rates varying strongly by
  task (data-to-text was highest). A **fine-tuned small model (Llama-2-13B) matched or beat
  prompt-based GPT-4 detection** at span level. HHEM reports summarization hallucination rates from
  under 1% to over 20% across models (vendor leaderboard; its own classifier is the judge).
- **Strength:** RAGTruth high (large human annotation); HHEM CLAIMED.
- **UCI primitive:** *Span-level hallucination labels on outputs, keyed to input anchors.* A cheap,
  specialized verifier is viable, so verification can run on many steps without the largest model
  (consistent with "don't run the largest model on every event").
- **Conflicts:** None substantive.
- **Status:** REPLICATED.

### 6.3 Measuring what compaction loses (recall-after-compression)
- **Citations:** Wu et al., "LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive
  Memory", ICLR 2025, arXiv:2410.10813 https://github.com/xiaowu0162/LongMemEval · "Lost in
  Compaction: Evaluating Side-Constraint Loss under Context Compaction" (COMPINT),
  arXiv:2608.11242 (2026) · "The Compaction Cliff in Long-Running AI Agent Memory",
  arXiv:2608.22752 (2026) · "Addressable Recall Compaction for Long Context-Window Control in AI
  Agents" (ARC), arXiv:2607.25066 (2026) · "What to Keep, What to Forget: A Rate–Distortion View of
  Memory Compaction", arXiv:2607.08032 (2026) · Hermes recall eval (reported in the caller's
  7-harness study) · Complexity Trap (5.4) · FABLES (5.4).
- **Mechanism:** (a) LongMemEval: 500 questions embedded in scalable chat histories testing
  information extraction, multi-session reasoning, **temporal reasoning, knowledge updates,
  abstention**. It decomposes memory into *indexing → retrieval → reading*. (b) COMPINT: inject
  session constraints ("do not delete emails until I confirm") into conversations, agent
  trajectories, and research tasks; compact; probe retention. (c) Compaction Cliff: measure safety
  rule preservation over *repeated* compaction rounds; type-aware triage (pin rules verbatim, compact
  logs, retrieve the rest). (d) ARC: append-only, ID-addressable observation log; old observations
  replaced by citations the agent can dereference.
- **Result:** (a) Commercial assistants and long-context LLMs showed **~30% accuracy drop** on
  sustained-interaction memory. Session decomposition, fact-augmented keys, and **time-aware query
  expansion** improved recall and QA. (b) Current compactors retain **only ~17% of injected session
  constraints on average**, and most do worse than no compaction; a constraint-aware extractor
  reaches **>90%** retention. (c) A production coding-agent compaction prompt kept **53% of safety
  rules after one round and 10% after five** (the "cliff"). Type-aware compaction preserved 2–4×
  more, with 96% recall over five rounds; pinned-rule retrieval reached 100% recall@50 vs 73%. (d)
  ARC: NIAH exact-answer **99.4% vs 88.1%** for the best summarization/truncation baseline;
  LongBench-v2-Hard 29.97% vs 28.25%. A 2026 practitioner report describes holistic judge scores of
  97–99% "good reply" while probe-based memory recall in the same sessions was 58%, so **holistic
  quality judges hide recall loss**.
- **Strength:** LongMemEval high (peer-reviewed, public). The 2026 compaction papers are preprints,
  medium-low individually, but consistent with each other and with FABLES (omissions) and the
  caller's Hermes finding.
- **UCI primitive:** **Compaction recall is measured by probes seeded before compaction and
  asked after it**, stratified by *type* (constraint, decision, fact, identifier or exact string,
  temporal fact, preference, open question), and **tracked across repeated rounds** (loss compounds).
  Items with deontic force (constraints, authority, safety rules) are never summarized; they are pinned
  or kept verbatim by reference. Compaction outputs must cite the shadowed event ids (the caller's
  "replacements that cite shadowed events"), so every lost item is recoverable by address.
- **Conflicts:** Complexity Trap finds cheap masking ≈ summarization on *task success* (SWE-bench),
  while these find large *recall* loss. The two are compatible: end-task metrics on short tasks are
  insensitive to what was forgotten. **Measure recall directly, not only task success.**
- **Status:** REPLICATED (compaction loses a lot, and task metrics hide it), with individual numbers
  OBSERVED.

### 6.4 Evaluating ingestion itself
- **Evidence:** Element-type parse metrics (OmniDocBench: text ED, TEDS, CDM, reading order),
  ASR WER + DER + timestamp error (2.1), hallucinated-transcription audits (2.2), grounding F1 for
  region localization (ViDoRe V3, ≈0.09 vs 0.60 human), EL F1 per domain (3.5), and temporal
  normalization accuracy (3.6).
- **UCI primitive:** **Each ingestion operator ships with its own evaluator and a gold slice**, and
  its measured quality is stored with the operator version so downstream confidence can
  inherit it (a claim derived from a 0.8-TEDS table parse should not be held at 0.99 confidence).
  **Inference:** no surveyed system propagates ingestion quality into downstream belief confidence.
- **Status:** SPECULATIVE (propagation), with the metrics themselves REPLICATED.
## 7. Synthesis

Everything in this section is **inference** from the evidence above unless a source is cited.

### 7.1 Ingestion abstraction boundary

**Answer to Q1:** neither a single common pipeline nor independent silos. The evidence supports
**modality-specific operator stacks that converge on a small set of universal evidential
objects.** Three findings force this:
1. The best operator per modality changes quickly (OmniDocBench leaders 2024 → 2026; Whisper →
   WhisperX; OCR → page-image retrieval). A common pipeline would freeze the wrong operator.
2. Every strong operator is *generative and fallible* in ways its headline metric hides (Nougat
   loops, Whisper's ~1% fabricated sentences, ~20% DER, generative parsers without coordinates,
   ViDoRe V3 grounding F1 ≈0.09). Their outputs must be *interpretations* re-checkable against raw
   evidence, which requires a universal address space.
3. Retrieval, attribution, and verification are only possible across modalities when all outputs share
   one anchor/selector algebra (W3C selectors, media fragments, Azure-style offset spans) and one
   derivation record (PROV).

**Universal (kernel/substrate; identical for every modality and domain):**
| Primitive | Contents | Evidence basis |
| --- | --- | --- |
| Evidence envelope | immutable bytes, content hash id, media type, source/URI, `captured_at`, `authored_at?`, capturing agent, consent label, authority scope | PROV Entity; nanopub trusty URIs; §2.2 (keep the audio) |
| Evidence anchor | `(evidence_id@hash, selector chain, state)`; selectors: text position + quote, page, bbox/polygon, time range, frame, DOM/a11y node, table cell | W3C Web Annotation, Media Fragments, Azure spans |
| Derivation record | output ids, operator@version, inputs (anchors), parameters, agent/model, time, measured operator quality | PROV Activity; §1.2 (re-derivability) |
| Interpretation | typed output of an operator (transcript word, layout element, table, caption, entity mention, normalized time, claim) + anchors + confidence | Docling, Unstructured, WhisperX outputs |
| Temporal grounding frame | capture time, reference anchor used, normalized value, granularity, uncertainty; bi-temporal validity for facts | TimeML DCT; Graphiti bi-temporal |
| Identity hypothesis | mention anchor → entity candidate, score, resolver@version, reversible | EL literature; "similarity ≠ identity" |
| Claim | atomic statement + supporting anchors + verifier verdicts | FActScore, AIS, nanopub assertion |
| Multi-representation index | per anchor-able unit: lexical, dense, late-interaction, page-image, structural keys | §1.4–1.5, §4 |

**Modality-specific (harness operator library):** layout/OCR/table/formula parsers; page-image
embedders; ASR + forced alignment + diarization; shot/scene segmentation + frame captioning + OCR on
frames; screen parsers (element detection, set-of-marks, a11y tree readers); code parsers
(AST/symbol tables); tabular profilers. Each is a versioned operator with an evaluator (§6.4).

**Domain-specific (environments):** which entity/relation types matter and their disambiguation
rules; which derived views to materialize (a textbook's chapter/section/exercise/figure tree; a
learner's misconception claims; a codebase's call graph); which summaries or hierarchies are worth
paying for; domain verifiers (for example, "did the learner answer correctly" is a domain evaluator,
while "is this claim supported by page 42" is universal).

**Where the stages fall:**
```
UNIVERSAL   capture → envelope+hash → consent/authority label → store raw
SPECIFIC    modality operators → interpretations (anchored, versioned, confidence)
UNIVERSAL   anchor normalization → temporal grounding → multi-index (lexical/dense/visual/structural)
MIXED       mention detection (universal mechanics) → entity resolution (domain rules)
DOMAIN      claim/relation schemas, materialized views (hierarchies, graphs), domain evaluators
UNIVERSAL   claim verification against anchors → belief revision (logged, bi-temporal)
```
For education specifically: a learner's book is an evidence envelope; its chapters and figures are
anchored interpretations (layout operator); "the learner's chapter 3" is a domain disambiguation
rule; the page image stays retrievable for figure-heavy material (§1.4), while text stays primary for long
text-rich chapters (§1.5).

### 7.2 Where retrieval ends and cognition begins

Evidence-based boundary:
- **Retrieval proper = candidate generation with guarantees.** Exact retrieval (key, lexical,
  structured filter, time range) has *completeness* guarantees; similarity retrieval has
  *recall-at-k* guarantees only, with provable capacity limits (LIMIT) and known blind spots
  (long-tail entities). These are mechanical, cheap, and loggable.
- **Reranking = the first cognitive judgement.** Cross-encoders and LLM rerankers judge relevance to
  intent and give the largest single gains (BEIR; Contextual Retrieval −67% failures; ViDoRe V3). They are
  model-based, fallible, and belong on the log with scores.
- **Cognition begins where the query itself changes**: reformulation with reasoning (BRIGHT: 18.3
  → 26.5 → ~46.8 nDCG@10 only via reasoning, iteration, and reranking), multi-hop chaining (HippoRAG, agentic
  grep loops), deciding *that* information is missing (abstention; LongMemEval), resolving
  contradictions across time (knowledge updates), and choosing what to put in the context and in what
  order under a budget (§5.1–5.2).
- **Graph/hierarchy structures are indexes, not cognition.** Budget-matched evaluations (Han et al.)
  show they route and aggregate; the reasoning remains the model's. Their summaries are lossy
  interpretations that must cite their inputs.
- **Design consequence:** *the context compiler is a cognitive operator* (selection, ordering,
  compression, and rendering are decisions that change outcomes by 10–40%, per §5.1, §5.4, §5.6), so its
  decisions must be logged like any other act. Retrieval operators return candidates with scores;
  the compiler decides and records why.

### 7.3 What a context manifest must contain to answer "why did the model see this?"

No surveyed system produces one (caller's harness study; OTel logs payloads only; ContextCite
measures use post hoc). Minimum contents, each justified by evidence:
1. **Identity:** manifest id, process/step id, model id@version, compiler@version, rendering
   template@version (format sensitivity up to 40%, §5.6), timestamp.
2. **Budget:** token budget, tokens used per section, what was cut for budget (budget confounds
   results, §3.2; length alone degrades 13.9–85%, §5.2).
3. **Per item (the core):**
   - `item_id`, `kind` (instruction, constitution, working-state field, evidence span, memory/belief,
     tool result, summary), and **the anchor or source id it renders** (evidence_id + selector, or
     event id range for summaries).
   - **Inclusion reason:** `pinned-rule` | `working-state` | `retrieved` | `recent-event` |
     `tool-output` | `user-provided` | `delegated-summary`.
   - **If retrieved:** query text (and reformulations), each retriever that returned it with
     rank and score, fusion method, reranker score, and the threshold or top-k cutoff (hybrid
     attribution, §4.4).
   - **Transformation:** verbatim | elided-with-pointer | summarized (by operator@version, citing
     the shadowed event ids) | compressed (method, ratio). This is what makes compaction restorable
     (ARC, Manus) and auditable.
   - **Position:** section and ordinal (position changes accuracy, §5.1) and cache-prefix membership (§5.5).
   - **Trust label:** provenance class (user, first-party tool, untrusted web, model-generated), consent
     label, and whether it is *data* or *instruction* ("untrusted content is data").
   - **Temporal validity:** as-of time or validity interval of the rendered fact (knowledge updates, §3.4).
4. **Exclusions that matter:** candidates above threshold that were dropped, and why (budget,
   dedup, consent, authority, staleness). "Why did the model *not* see X" is half of debugging.
5. **Cache accounting:** breakpoints, hit/miss, cost (economics dominated by cache hits, §5.5).
6. **Post-hoc use attribution (sampled, optional):** ContextCite-style ablation scores linking output
   claims to items. This separates *seen* from *used* (Wallat: up to 57% of citations unfaithful).
7. **Output linkage:** claims in the response → cited item ids → anchors, so a citation resolves to
   source bytes, not to generated text (Anthropic Citations pattern).

Invariant (checkable): **every token span in the rendered context maps to exactly one manifest item,
and every manifest item maps to a durable id (anchor, event, or state field).** A test can fail on
unmapped spans. Replaying the manifest against the substrate must re-render the same context
(compiler determinism), which also secures cache stability.

### 7.4 What compaction strategies lose, and how to measure it

**What is lost (evidence):**
| Strategy | Typical loss | Evidence |
| --- | --- | --- |
| LLM summarization (rewrite) | constraints and rules (17% retained; 53% → 10% over 5 rounds), exact strings/ids, omissions of crucial items, end-of-input bias, fabricated claims | COMPINT, Compaction Cliff, FABLES, ARC NIAH 88% |
| Token-level compression (LLMLingua) | readability and auditability; exact spans; small benchmark loss at up to 20× | LLMLingua |
| Learned soft compression (gist) | everything human-inspectable; model-locked (breaks model swap) | Gist tokens |
| Observation masking / tool-result clearing | the raw observation (restorable only if kept elsewhere) | Complexity Trap (task parity) |
| Truncation / sliding window | everything old, with no trace | baseline in ARC and others |
| Hierarchical/community summaries | detail and single-hop facts (can hurt simple QA) | HippoRAG 2 comparisons, Han et al. |
| Addressable elision (pointer + log) | little, as long as the agent dereferences; cost is extra tool calls | ARC 99.4% NIAH |

**Measurement protocol (derived; SPECULATIVE as a whole, each element evidenced):**
1. **Seed typed probes before compaction**: facts, exact identifiers and strings, constraints and
   rules, decisions + rationale, open questions, preferences, temporal facts and knowledge updates,
   and "negative" facts (what was ruled out). Stratify by type and by position (start, middle, end).
2. **Probe after each compaction round**, over ≥5 rounds (loss compounds; Compaction Cliff).
3. **Score recall per type**, exact match for strings/ids, NLI or claim verification for facts
   (§6.1), and **abstention correctness** (does it say "I don't know" rather than fabricate; LongMemEval).
4. **Score fabrication**: claims in the compacted artifact not entailed by the shadowed events
   (FABLES-style claim audit, automated with a calibrated verifier).
5. **Report task success separately.** It is insensitive to recall loss (Complexity Trap vs
   COMPINT; the practitioner's 97–99% judge vs 58% recall).
6. **Restorability metric**: fraction of lost probes recoverable by dereferencing citations to
   shadowed events (should be 100% when compaction is non-destructive; ARC design).
7. **Cost**: tokens, cache invalidation (did compaction rewrite the prefix?), latency.
This generalizes the caller's Hermes recall eval into a reality test ("compaction" test in UCI §34).

### 7.5 Open problems
1. **Region-level grounding** of claims in visual documents is far below human (ViDoRe V3 F1 ≈0.09
   vs 0.60). Page-level citation is the honest granularity today for visual evidence.
2. **Propagating ingestion quality into belief confidence**: no system found does it (§6.4).
3. **Faithfulness vs correctness of citations** at scale: counterfactual attribution (ContextCite)
   costs O(s log n) extra passes. Which steps deserve it, and how often, is unmeasured.
4. **Cache stability vs relevance-optimal ordering**: position effects (§5.1) and the recency of
   working state argue for reordering, while cache economics (§5.5) argue for append-only. No study
   quantifies the trade-off.
5. **Entity resolution error rates in lifelong personal corpora** (reversible merges, drift over
   years) are unbenchmarked. EL benchmarks are encyclopedic.
6. **Temporal grounding with ambiguous anchors** (forwarded content, book edition vs reading date,
   screenshots of old content): anchor selection is itself an inference that needs confidence.
7. **Evaluation contamination by LLM judges**: GraphRAG/LightRAG gains shrank under debiased,
   budget-matched evaluation. UCI's own evaluators need human-calibrated slices and bias controls.
8. **Video/long-audio at lifelong scale**: long-video accuracy drops ~14 pts short→long even for
   the best models. How much frame-level evidence to retain vs re-derive is open.
9. **When parse-free beats parse-first** is domain- and length-dependent (§1.4 vs §1.5). The
   routing policy must be learned per corpus and ablation-tested.
10. **Compaction of deontic content**: constraints and authority must never be summarized away. How to
   *detect* that a span is deontic (COMPINT's extractor reaches >90%) is itself a fallible operator.

## 8. Source index

| # | Source | Year | Status |
| --- | --- | --- | --- |
| 1 | Docling Technical Report, arXiv:2408.09869 | 2024 | OBSERVED |
| 2 | OmniDocBench (CVPR 2025) + leaderboard | 2025–26 | REPLICATED |
| 3 | Nougat arXiv:2308.13418; MinerU2.5 arXiv:2509.22186; Marker; Unstructured; LlamaParse; Azure/Google DocAI | 2023–25 | OBSERVED / CLAIMED |
| 4 | DSE, EMNLP 2024, arXiv:2406.11251 | 2024 | REPLICATED |
| 5 | ColPali, ICLR 2025, arXiv:2407.01449 | 2025 | REPLICATED |
| 6 | Lost in OCR Translation, arXiv:2505.05666 | 2025 | CONTESTED |
| 7 | Document-as-Image Falls Short (ArXivDoc), arXiv:2604.18508 | 2026 | CONTESTED |
| 8 | ViDoRe V3, arXiv:2601.08620 | 2026 | OBSERVED |
| 9 | Financial Report Chunking, arXiv:2402.05131 | 2024 | OBSERVED |
| 10 | Is Semantic Chunking Worth It?, arXiv:2410.13070 | 2025 | OBSERVED |
| 11 | Anthropic Contextual Retrieval | 2024 | CLAIMED |
| 12 | WhisperX, arXiv:2303.00747; pyannote 3.1 | 2023–24 | REPLICATED |
| 13 | Careless Whisper, FAccT 2024, arXiv:2402.08021 | 2024 | OBSERVED |
| 14 | Video-MME arXiv:2405.21075; LongVideoBench arXiv:2407.15754 | 2024–25 | REPLICATED |
| 15 | OmniParser arXiv:2408.00203; ScreenSpot-Pro arXiv:2504.07981 | 2024–25 | REPLICATED / CONTESTED |
| 16 | W3C Media Fragments; Web Annotation; WebVTT | 2012–17 | REPLICATED (standards) |
| 17 | GraphRAG arXiv:2404.16130 | 2024 | CONTESTED |
| 18 | RAG vs GraphRAG arXiv:2502.11371; Unbiased GraphRAG eval arXiv:2506.06331; GraphRAG-Bench arXiv:2506.05690 | 2025 | REPLICATED |
| 19 | LightRAG arXiv:2410.05779 | 2025 | OBSERVED (LLM-judged) |
| 20 | RAPTOR arXiv:2401.18059 | 2024 | OBSERVED |
| 21 | HippoRAG 2 arXiv:2502.14802 | 2025 | OBSERVED |
| 22 | Zep/Graphiti arXiv:2501.13956 | 2025 | CLAIMED (numbers) |
| 23 | OneNet, ChatEL, LELA, ReFinED, BLINK | 2020–26 | REPLICATED |
| 24 | TimeML/TIMEX3, TempEval-3, NAACL 2024 temporal ICL | 2013–24 | REPLICATED |
| 25 | W3C PROV; nanopublications | 2010–16 | REPLICATED (standards) |
| 26 | Liu et al. Verifiability arXiv:2304.09848 | 2023 | REPLICATED |
| 27 | ALCE arXiv:2305.14627; AIS | 2023 | REPLICATED |
| 28 | Correctness ≠ Faithfulness arXiv:2412.18004 | 2024–25 | OBSERVED |
| 29 | Anthropic Citations API docs | 2025–26 | OBSERVED (mechanism) |
| 30 | BEIR arXiv:2104.08663 | 2021 | REPLICATED |
| 31 | EntityQuestions arXiv:2109.08535 | 2021 | REPLICATED |
| 32 | LIMIT arXiv:2508.21038 | 2025 | REPLICATED |
| 33 | BRIGHT arXiv:2407.12883 (+ ReasonEmbed, DIVER) | 2025–26 | REPLICATED |
| 34 | RRF (2009); ColBERTv2; Elastic hybrid; Cursor semsearch; Is Grep All You Need? arXiv:2605.15184 | 2009–26 | REPLICATED / CONTESTED |
| 35 | Lost in the Middle, TACL 2024 | 2024 | REPLICATED |
| 36 | RULER; NoLiMa; LongBench v2; Chroma Context Rot; Context Length Alone Hurts arXiv:2510.05381 | 2024–25 | REPLICATED |
| 37 | Anthropic Effective Context Engineering; Manus Context Engineering | 2025 | CLAIMED |
| 38 | LLMLingua; LongLLMLingua; LLMLingua-2; Gist tokens | 2023–24 | REPLICATED |
| 39 | Complexity Trap arXiv:2508.21433 | 2025 | OBSERVED |
| 40 | FABLES arXiv:2404.01261 | 2024 | REPLICATED |
| 41 | Anthropic prompt caching docs and pricing | 2024–26 | REPLICATED |
| 42 | Prompt formatting arXiv:2411.10541; POML arXiv:2508.13948 | 2024–25 | OBSERVED |
| 43 | ContextCite arXiv:2409.00729; AttriBoT; SelfCite; OTel GenAI semconv | 2024–25 | OBSERVED |
| 44 | FActScore; RAGAS; ARES; TRUE; AlignScore; MT-Bench judge | 2022–24 | REPLICATED |
| 45 | RAGTruth arXiv:2401.00396; Vectara HHEM | 2024 | REPLICATED / CLAIMED |
| 46 | LongMemEval arXiv:2410.10813 | 2025 | REPLICATED |
| 47 | COMPINT arXiv:2608.11242; Compaction Cliff arXiv:2608.22752; ARC arXiv:2607.25066; Rate–Distortion arXiv:2607.08032 | 2026 | OBSERVED (preprints, mutually consistent) |
