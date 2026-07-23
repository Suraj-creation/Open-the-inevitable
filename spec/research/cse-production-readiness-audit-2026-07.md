# The Cognitive Source Environment — Production Readiness Audit

_Date: 2026-07-18 · Basis: full spec-corpus read (CSE-001…016, ADR-0030/0032…0054, SRF-001…006,
F09/F15/F16, CDL v1/v2/v3, the founding draft), full code trace (apps/web, apps/api,
packages/source-environment, packages/surface, packages/product-cognition, packages/intelligence),
and an external state-of-the-art survey (2026-07). Companion to
`spec/research/ucs-implementation-review-2026-07.md` (the 2026-07-02 UCS review)._

This document answers one question, asked as a production audit rather than a milestone check:

> **If a learner uploads a textbook, research paper, lecture, website, codebase, or video today,
> do they experience a living cognitive environment where the source itself becomes an intelligent
> teaching medium?**

---

## 0. Executive Verdict

**No — and the reason is precise.** The CSE substrate is real, deep, governed, and live-proven
(M1–M12 + ADR-0051…0054, `pnpm verify` green across 28 tasks). But the learner-facing product
does not deliver the CSE vision, for five structural reasons, in descending severity:

1. **There is no front door.** A learner cannot upload a PDF, paste a URL, add a video, or add
   code through the Cognitive Surface. `POST /api/sources` and `POST /api/sources/crawl` have
   **zero callers in `apps/web`** — no file input, no drop zone, no URL field exists anywhere in
   the product. The only in-product source acquisition is attaching a peer's contributed creation
   from the Commons, or contributing one's own typed draft. Everything CSE M1–M10 built is
   reachable only by `curl` and dev smoke scripts.
2. **Teaching is source-adjacent, not source-anchored.** Even when a source is attached (via
   API), the lesson never consults it: the curriculum derives from the goal string alone, the
   frame planner and composer prompts contain **no source text**, the Director's
   `focus.source_anchor_ref` is structurally always `null`, and narration never quotes or
   references the document. Source anchors are bolted on *after* composition by lexical
   token-overlap of the concept title (top 2 regions), and narration→viewport sync is
   index-positional, not semantic. The document is a witness beside the lesson, never the medium
   of it. "The document becomes the timeline" does not exist in any form.
3. **The Theater is half dead at render time.** Cinematography shots (14-kind grammar) are
   planned, emitted, folded — and consumed by **nothing** in `apps/web`. Scene actors, lighting,
   recession: folded, unrendered (only a board tint and Mark badges survive). Director pacing
   (`dwell_hint_ms`, `tempo`, `silence`): consumed by nothing; playback pacing is a hardcoded
   1400 ms constant. The 11-role semantic highlight grammar has a single producer that hardcodes
   `role: "evidence"`. `surface.attention.budgeted` has a fold slice and **no producer anywhere**.
4. **Memory's read side is starved.** Episodes, Understanding Deltas, and resume cards distill
   only on session `close` — and the web app **never sends `close`** (no caller, no
   `beforeunload`). For a pure-web learner, the Understanding Map is permanently empty and the
   resume card never fires.
5. **The source plane evaporates on restart.** SourceHub is process-lifetime: source
   registrations, canonical bytes, the Knowledge Commons catalog, consent envelopes, **and the
   redaction set** are in-memory Maps. A deploy forgets a learner's *revocation* — the 410-Gone
   guarantee degrades to a 404, and "Revoke & redact" is a promise the current topology cannot
   keep. This is the ethically load-bearing gap.

**What is genuinely real and good:** the goal-driven teaching loop (frames + word-synced
narration + staged reveal + real graded practice + gold-leaf mastery + consolidation + prerequisite
descent + continue-ribbon + silent cross-session mastery seeding) reads as one living organism —
the ADR-0031 hardening delivered. The Living Reference pane, when a source exists, renders
**canonical bytes natively** (pdf.js page + bbox highlight overlays, hash fidelity proof,
auto-scroll with learner-override + "Resume guide") — the plumbing of the attention contract works
end-to-end. Creative Cognition (M11) is the best-in-repo loop: structural No-Ghostwriter,
disclosed assists, consent-gated contribution. KaTeX math, honest degradation, and the CDL visual
language are production-quality.

**Scores** (method of the 2026-07-02 review, applied to the CSE vision):

| Axis | Score | Rationale |
| --- | --- | --- |
| Substrate & runtime capability (anchors, canonicalization, modalities, fusion, claims, frontier, temporal, intelligence plane) | 9/10 | Built, governed, replay-safe, live-proven; gaps are named deferrals |
| Gateway coverage | 8/10 | Every capability routed; binary upload is raw-bytes only; no multi-file |
| Learner reachability of the source plane | 2/10 | No acquisition UI; fusion/claims/contradictions effectively unreachable |
| Source-anchored teaching (the heart of the vision) | 2/10 | Post-hoc lexical anchoring + positional sync only; nothing upstream consults the source |
| Theater rendered (Director/Scene/Cinematography visible) | 3/10 | Directive chip + tint real; shots/lighting/pacing dead at render |
| Living knowledge integrated into teaching | 3/10 | Six well-crafted panels that never change what frames teach |
| Memory/episodic experienced | 3/10 | Machinery complete; starved by the missing `close` |
| Creative cognition | 8/10 | Production-ready loop; draft persistence + restart durability missing |
| **CSE-as-experienced, overall** | **3/10** | The substrate is ahead of the product by roughly two milestones of UI work |

The July pattern has recurred one level up. The 2026-07-02 review said of the UCS: *"the
architecture is faithful; the experience is not"* (4.5/10) — and the hardening passes closed that
gap for the goal-driven loop. The CSE then landed twelve milestones of substrate in six weeks
**without a single acquisition affordance or source-fed prompt**, re-opening the same gap around
the new domain. The good news is symmetrical: because the substrate is real, most of this audit's
findings are wiring and projection work, not new infrastructure.

---

## 1. The Original Vision (what was promised)

From the founding draft (`spec/research/cse-draft-v1-2026-07.md`) and CSE-001:

- **Principle Zero:** sources are evidence; *the learner's understanding is the primary object*.
- The learner hands the system any artifact of human knowledge. The system converts it into a
  **living cognitive environment** — not a document viewer, not chat-grounded-in-documents (the
  explicitly rejected NotebookLM shape), not a summarizer.
- The **Living Reference** renders the original faithfully (sacred, never rewritten); all
  cognitive markup is a non-destructive overlay; a raw-source toggle strips everything.
- **Dynamic Cognitive Synchronization:** as narration discusses a passage, the source auto-scrolls,
  the exact paragraph soft-highlights, equations and figures glow — perceptually simultaneous
  (≤150 ms), and the learner's own scroll always cancels pending motion.
- The **Director** selects the most pedagogically meaningful region — a paragraph, an equation, a
  figure, half a page — and that region becomes the current Cognitive Frame. Frame by frame, the
  learner traverses the entire source: **the document becomes the timeline.**
- Around this core: semantic viewports ("an expert teacher's gaze"), an 11-role typed highlight
  grammar, a 14-shot cinematography grammar, 37 interaction primitives, Scenes with actors and
  lighting, episodes and Understanding Deltas, frontier overlays on old sources, Source Fusion
  into one reconciled environment, and Creation as the arc's endpoint —
  `Read → Understand → Master → Connect → Question → Experiment → Research → Discover → Create`.

The full spec-promise inventory (102 learner-facing capabilities with owning sections) was
compiled during this audit and is reflected in the classification table below.

---

## 2. The Learner Journey, Audited End-to-End

Each transition of the intended pipeline, classified. (Legend: ✅ production-ready ·
🟡 exists-but-degraded as noted · ❌ missing.)

| # | Transition | Status | Evidence |
| --- | --- | --- | --- |
| 1 | **Upload / acquire** | ❌ missing (UI); 🟡 backend-only (API) | No file input / drop zone / URL field in `apps/web` (grep-verified); routes ready at `apps/api/src/server.ts:332-352` |
| 2 | **Canonicalize (progressive)** | ✅ runtime · ❌ loading narrative UI | Eight-layer artifacts + usable-at-L1+anchors (`packages/source-environment`); the CSE-009 §7 "waiting teaches" narrative has no surface |
| 3 | **Source representation (anchors, versions)** | ✅ runtime | Multi-selector anchors, pure resolution, migration; content-addressed versions |
| 4 | **Meaning layer (MRL)** | 🟡 runtime + panel | MeaningUnits distilled (M6); reach the Understanding Map, never the composer prompts |
| 5 | **Agent society / enrichment decisions** | 🟡 partial | Ensemble fan-out + proposals + disagreement exist (S1.2); CSE-007's arbitrated Enrichment Decision incl. "decided: nothing" not implemented as such |
| 6 | **Director** | 🟡 real-but-blind | Authored 8-rule FSM (`packages/surface/src/theater.ts:224-356`); `focus.source_anchor_ref` always `null` (:228); pacing fields consumed by nothing |
| 7 | **Scene** | 🟡 folded-unrendered | Fold at `projection.ts:1392-1450`; render = board tint + Mark badges only |
| 8 | **Knowledge Cinematography** | 🟡 implemented-not-exposed | Planned + emitted + folded (`cinematography.ts:120-184`); zero consumers in `apps/web` |
| 9 | **Narration** | ✅ MCCR-synced · ❌ document-aware | Word-level caption sweep, per-element reveal; composer prompt contains no source text (`surface-composer-unit.ts:568`) |
| 10 | **Viewport synchronization** | 🟡 coarse | ≤3 lexically-chosen viewports/frame; segment *i* → viewport *min(i, n−1)* (`source-projection.ts:364-371`) — positional, not semantic |
| 11 | **Highlight grammar** | 🟡 grammar-without-producers | 11 roles × 3 amplitudes × 3 lifetimes typed + full CSS palette; sole producer hardcodes `"evidence"` (`source-projection.ts:357`); `highlight.cleared` never emitted |
| 12 | **Interaction grammar** | 🟡 ~8 of 37 wired | interrupt / simpler / deeper / example / challenge / mark / branch / jump; Attend, Reason, Express, pacing verbs unreachable; non-special kinds collapse into 4 reframe prompts (`session.ts:2405-2432`) |
| 13 | **Practice / assessment / mastery** | ✅ | Real grading → honest gate → feedback frame → gold-leaf → consolidation; fragile title-prefix detection (4 files) |
| 14 | **Memory / episodes** | 🟡 starved | Distillation only on `close` (`host.ts:526-541`); web never closes a session |
| 15 | **Research / frontier** | 🟡 split | Proactive chip ✅ integrated; grounded cited research block renders only on the legacy block path, never mounted on the frame path (`blocks.tsx:266-301` vs `SurfaceView.tsx:245-268`) |
| 16 | **Fusion / claims / contradictions** | 🟡 unreachable in practice | Requires ≥2 sources — impossible to achieve from the UI except via two Commons attaches |
| 17 | **Creative cognition** | ✅ | Full Read→Create loop, No-Ghostwriter structural, disclosed assists |
| 18 | **Contribution / commons / consent** | ✅ flow · 🟡 volatility | Works end-to-end; commons + consent + redaction in-memory (`sources.ts:204-208`) |
| 19 | **Persistence** | 🟡 split-brain | Surfaces/learners/media durable under `COS_PERSIST_DIR`; the entire source plane process-lifetime (`sources.ts:17-18`); rehydrated surfaces forget their sources (`host.ts:776-778`) |
| 20 | **Replay** | 🟡 partial | Session scrub + URL resume ✅; no past-session browser, no Replay Rail, no Time Machine (spec-only) |

---

## 3. Master Capability Classification

Consolidated from the three code-trace investigations. Classifications use the audit taxonomy.

### 3.1 Acquisition (modality matrix)

| Modality | Learner input via UI | Route | Adapter | What the adapter really needs | Classification |
| --- | --- | --- | --- | --- | --- |
| PDF / book / paper | ❌ | ✅ raw bytes | ✅ real pdfjs parse (page/bbox geometry; scanned pages → honest low-confidence, no OCR) | Actual PDF bytes | 🟡 **backend-only** |
| Website | ❌ (no URL field) | ✅ crawl (SSRF-gated) + client-HTML | ✅ regex HTML extraction | HTML (SPAs won't extract); DNS-rebinding deferred | 🟡 **backend-only** |
| Video | ❌ | ✅ | ✅ transcript adapter + L4 temporal layer | **A pre-made timed transcript** — not a video file; no ASR, no YouTube | 🟡 **prototype + backend-only** |
| Codebase | ❌ | ✅ | ✅ single file, heuristic symbols | One code file as UTF-8 string; no repo/multi-file | 🟡 **backend-only, single-file** |
| Markdown / text | 🟡 only via Create→Contribute | ✅ | ✅ | UTF-8 text | 🟡 **partial** |
| epub / notebook / presentation / audio / dataset / image | ❌ | modality name accepted → **422** at canonicalize (no adapter registered) | ❌ | — | ❌ **missing** |

### 3.2 The source on the surface

| Capability | Classification | One-line evidence |
| --- | --- | --- |
| Living Reference pane (native render + fidelity hash) | 🟡 runtime-only (unreachable without API attach) | pdf.js canvas + bbox overlays + "✓ exact" badge (`SourceReference.tsx:99-132, 313-425`) |
| Source rendered *as the stage* | ❌ missing | Stage = FrameDeck; source = 34%-width `<aside>`; on-board source = one 240-char quote card |
| Semantic viewport (expert gaze) | 🟡 partial | Lexical token-overlap region choice, top 2 (`sources.ts:1412-1466`) |
| Viewport choreography / auto-scroll | 🟡 coarse | Moves once or twice per frame, then parks |
| Attention contract (≤150 ms narration↔source) | 🟡 partial | Works mechanically; binding is index arithmetic, not meaning |
| Semantic highlight roles (11) | 🟡 grammar-without-producers | Only `"evidence"` ever emitted |
| Raw-source toggle | ❌ missing (UI) | Fidelity hash exists; no toggle affordance |
| Multi-source alignment | ❌ missing (UI/UX) | Types + events declared (CSE-008 §10); nothing renders |
| Learner annotations on source | ❌ missing | `annotation.recorded` declared, not activated in SRF-002 |
| Media intents (jump-to-concept, video) | ❌ missing | Declared in CSE-008 §8; no producer/consumer |
| Source-as-timeline traversal | ❌ missing | No mode teaches a document region-by-region; lesson is concept-shaped from the goal string |

### 3.3 The Theater

| Capability | Classification | One-line evidence |
| --- | --- | --- |
| Director FSM + directive events | 🟡 partial (real but thin) | Chip + "why this pace" popover + board tint render; pacing/silence consumed by nothing |
| Director selects source regions | ❌ missing | `source_anchor_ref: null` structurally (`theater.ts:228`) |
| Scene actors / lighting / in-place evolution | 🟡 folded-unrendered | Mark → Scene delta works; actors/lighting/recession invisible |
| Cinematography 14-shot grammar | 🟡 implemented-not-exposed | Zero `apps/web` consumers; de-facto camera is the independent HighlightLayer marker |
| Shot↔narration binding | ❌ missing | Shots never realized, so never bound |
| Interaction grammar (37 primitives) | 🟡 ~8 wired | Registry ~30, gateway 17, UI 8 |
| Affect channel (visible, opt-out) | 🟡 half-wired | `inferAffect` feeds the FSM silently; never rendered; no opt-out |
| Attention budget / interruption law | ❌ missing producer | Fold slice exists; nothing ever emits `surface.attention.budgeted` |
| Staged element reveal | ✅ | Elements arrive as narration reaches them |
| Progressive derivation (line-by-line) | 🟡 partial | `key_formula.lines[]` exists; renders all-at-once when its element reveals |
| KaTeX math / diagrams / images | ✅ | Publication-grade math; 5 deterministic diagram layouts; image agent with honest degradation |

### 3.4 Living knowledge, memory, creation

| Capability | Classification | One-line evidence |
| --- | --- | --- |
| Source Fusion + fused synthesis | 🟡 implemented-unreachable | Needs ≥2 sources; passive panel; result never feeds frames |
| Claim graph + contradictions | 🟡 backend-only in practice | Text pairs inside FusedView; no graph viz; "no world at the gateway yet" (`sources.ts:320-321`) |
| Frontier (proactive chip) | ✅ | Auto-appears after verified mastery; launches a real ask |
| Frontier / research cited entries | 🟡 partial | Render only on the never-mounted legacy block path |
| Temporal knowledge panel | 🟡 hidden-behind-toggle, works | Honest-empty without model |
| Cognitive Time Machine / Replay Rail | ❌ missing | Spec-only (CSE-009 §3; ADR-0044 defers the scrub UI) |
| Understanding Map / episodes / resume cards | 🟡 implemented-but-starved | No web `close` ⇒ nothing distills; UI honestly says "finish a session" — which the web cannot do |
| Learner identity / continuity | 🟡 partial | Silent localStorage identity; no login, no "my surfaces" list, clearing storage orphans everything |
| Creative cognition (M11) | ✅ | Best loop in the repo; drafts lost on tab close (React-state only) |
| Contribution / Commons / consent+revoke | ✅ flow · 🟡 volatile | In-memory commons/consent/redaction; contribute binds **without** emitting `surface.source.attached`, so the Fuse gate can't see it |
| Source cognition transparency (Runtime panel) | ✅ as transparency | Host-level (cross-learner) counts, not per-session |
| Observatory | 🟡 hybrid | Top half learner-facing craft; bottom half operator debug one click from the learner |
| Governance & Privacy Center | ❌ missing | No UI for what's-remembered / agents-active / forget-this / export |
| Onboarding (principles-first, sync demo) | ❌ missing | `/enter` is a goal input + two chips |

---

## 4. The Six Structural Gaps

1. **The Acquisition Gap.** The single missing link that gates everything else. Server routes,
   adapters, governance (SSRF, consent, redaction), and the teach-from-source projection are all
   built; the browser never calls them. Spec root cause: *no spec owns the acquisition
   experience* — F15 specifies events, not an interface; the founding draft's Source Library /
   drag-drop entry was superseded without replacement; CSE-009 carries no upload archetype.
2. **The Source-Adjacency Gap.** Source evidence enters the pipeline only *after* composition,
   lexically. Every prompt upstream (curriculum, frame plan, composition, narration) is
   source-blind; the frame planner is even explicitly instructed "never a scrolling document."
   Consequently, semantic viewports, document-aware narration, and the attention contract can only
   ever be approximations, no matter how good the downstream rendering is.
3. **The Dead Theater Gap.** A large fraction of M7–M8 is folded-but-unrendered: shots, actors,
   lighting, pacing, attention budget, highlight roles. The event law and replay story are intact;
   the learner sees almost none of it.
4. **The Distillation Gap.** One missing HTTP call (`close`) severs the entire memory read side —
   episodes, deltas, resume cards, blind spots — from the web learner.
5. **The Volatility Gap.** The source plane (sources, bytes, commons, consent envelopes,
   redaction set, creations) is process-lifetime. Restart consequences: rehydrated surfaces 404
   their Living Reference; the commons empties; **revocations are forgotten**. The consent
   guarantee must be durable before any real deployment.
6. **The Constellation-of-Panels Gap.** Fuse, Frontier, Timeline, Mind, Commons, Runtime are six
   sibling icon-buttons opening six read-only overlays. None of their results ever changes what
   the frames teach. The teaching loop is an organism; the CSE capabilities orbit it as satellites.

---

## 5. Architectural Inconsistencies

- `DirectorDirective.focus.source_anchor_ref` typed and always `null` — CSE-011's central
  promise structurally unfulfilled at the producer.
- ADR-0033 promises "~25" interaction primitives; CSE-014 enumerates 37; the registry holds ~30;
  the gateway accepts 17; the UI wires 8. Four inconsistent counts of the same law.
- `contributeCreation` binds the new source to `hosted.sourceBindings` without emitting
  `surface.source.attached` (`host.ts:633-643`) — the client fold (and the Fuse gate at
  `SurfaceView.tsx:78`) disagrees with the server about what sources exist. An event-sourcing
  violation in spirit: state changed without its event.
- `surface.source.highlight.cleared` and `surface.attention.budgeted` have fold slices and no
  emitters — schema law running ahead of producers with no tracking of the difference.
- Research/motivation **block** renderers exist only on the legacy block stage, which the frame
  path never mounts — an entire render path silently orphaned by the frames migration.
- Practice-frame semantics carried by `title.toLowerCase().startsWith("practice")` duplicated in
  four web files — pedagogically load-bearing behavior hanging off a string prefix.
- Narration→viewport binding is positional (`segment i → viewport min(i, n−1)`) while SRF-002
  declares semantic sync bindings — the event shape suggests meaning the producer doesn't have.
- Six modalities accepted by `isSourceModality` but guaranteed to 422 at canonicalization —
  the type system promises what the registry can't deliver.
- The frame-planner prompt's "never a scrolling document" instruction — written to enforce the
  no-scroll frame law — also functions as an anti-source bias baked into the planning prompt.
- CSE specs now embed "Implementation status / Deferred" confessions inside normative text
  (CSE-002/003/006/015/016) — useful honesty, but promise and delivery are blurring inside the
  law itself; CSE-010's phase table is superseded by a roadmap doc, leaving two sequencing sources.

## 6. Technical Debt Register

Named in code or established by this audit:

1. No web `close` ⇒ no distillation (the single biggest experience break).
2. No acquisition UI (`POST /api/sources`, `/crawl` uncalled by the product).
3. Source-store durability + rehydration "a named later increment" (`sources.ts:17-18`); Supabase
   byte upload is write-only best-effort with no read path.
4. Consent envelopes + redaction set in-memory — revocation not durable.
5. Crawler DNS-rebinding validation deferred (ADR-0052 T1).
6. Retroactive downstream retraction after revoke deferred (`sources.ts:557`).
7. Restored-without-snapshots surfaces are read-only ("live continuity after restart is Phase 2").
8. Identity minting not yet through kernel `IdentityService`; no credentialed auth; localStorage
   identity is silently orphanable.
9. Claim Graph has no world-state at the gateway (M2b/M3 cutover pending).
10. `E_MODEL_OUTPUT_TRUNCATED` deterministic-fallback paths in 9 cognition units — honestly
    surfaced, but a truncation storm degrades whole lessons to templates.
11. Title-prefix practice detection ×4 files.
12. Creation drafts unpersisted (client React state + in-memory server map).
13. Video concept scrubber, audio transcription, epub/notebook/presentation adapters: absent.
14. Curriculum cache lost on restart ⇒ first `advance` falls back to a full re-ask.

---

## 7. External Landscape (2026-07) — and the White Space

Full dossier gathered during this audit; the strategic distillation:

**Verified: no shipping or published system teaches FROM the visible document cinematically.**
Everything either (a) augments the document statically (AI2 Semantic Reader, SciSpace,
Explainpaper), (b) syncs voice to words mechanically with zero pedagogy (Speechify, ElevenLabs
Reader, Whispersync, Calliope), (c) generates a *replacement artifact* — podcast, slide video —
and abandons the source (NotebookLM Audio/Video Overviews, Acrobat AI, Paper2Video, AutoLectures),
or (d) does pedagogy without a document stage (ChatGPT Study Mode, Gemini Guided Learning).

The unclaimed intersection — exactly this project's vision — is five properties no one combines:
1. the source document as the stage; 2. generated semantic choreography as a live, scrubbable
axis (not offline video); 3. in-place progressive formalism (the document's own equations
deriving stepwise); 4. expertise-reversal-aware adaptive representation; 5. a director whose plan
is an inspectable, replayable artifact. Feasibility of each component is proven in 2025-26
research (AutoLectures: narration-phrase→region grounding F1 > 92% at < $1/hr; ElevenLabs
character-level timestamps; Paper2Video's multi-agent direction) — **the integration under
pedagogical law is the moat.**

Five risks their failures reveal (each is a design constraint below):
1. **Prosumer thinness** (Muse walked away; LiquidText's pivot backlash) → distribution through
   education/institutions, and the first-run must show choreography in seconds or be slotted as
   "another PDF chat."
2. **The passive-consumption trap** (NotebookLM's most viral features are its least pedagogical;
   Mayer's generative-activity principle) → retrieval, self-explanation, and learner control must
   be structural in the timeline, not optional.
3. **The transient-information effect** — narrated, auto-scrolling, animated content vanishes
   from working memory → narration must leave *persistent residue* (highlights that stay, notes
   that accumulate) and be fully scrubbable. A correctness constraint on the whole premise.
4. **Visual authority amplifies grounding errors** — a confident voice highlighting the wrong
   passage asserts false evidence (worse than a wrong chat answer; CHI 2024: irrelevant
   highlights actively damage comprehension) → narration-claim↔highlighted-region verification
   must be a gate, not a hope.
5. **Runtime-generation reliability** (< 80% compile success for freeform generated UI) → models
   emit *plans over a closed vocabulary of deterministic primitives* — which is exactly the MCCR
   architecture already in place. Keep that shape; widen the vocabulary.

---

## 8. Recommended Redesigns

1. **Invert the pipeline: source evidence flows INTO planning.** Today:
   `plan → compose → narrate → (append source anchors lexically)`. Required:
   `select source region (Director, model-backed) → plan frame FROM the region → compose WITH the
   source text in-prompt → narrate ABOUT the document → bind sync semantically`. The
   `sourceEvidenceFor` seam moves from `emitFrameArtifacts` to `dispatchFramePlan`'s inputs.
2. **A "Teach this source" mode beside "Teach me X".** Curriculum derived from the canonical
   structural + semantic layers (chapters → concepts → prerequisite order), not the goal string;
   frames traverse document regions; the path view doubles as the document's own map. This is
   "the document becomes the timeline," implementable entirely over existing primitives
   (anchors, viewports, frames, the KG engine).
3. **Source-as-stage projection archetype.** When teaching from a source, the document renders
   center-stage (full-bleed Living Reference) and MCCR anchors become overlays/side-glosses at
   the anchored regions — inverting today's board-center/source-aside layout. Spatial-contiguity
   law (Mayer #5): explanations render *at* the region, not beside it.
4. **A semantic alignment service with a verification gate.** Narration sentences ground to
   anchors by alignment (AutoLectures technique: string + model alignment), and a cheap
   entailment check gates every sync binding — a wrong highlight is degraded to no highlight,
   never shown. Replaces the positional `min(i, n−1)` binding.
5. **Session lifecycle.** `navigator.sendBeacon("…/command", {type:"close"})` on
   `visibilitychange`/`pagehide` + idle-timeout close server-side + periodic in-session
   distillation checkpoints. One small change opens the entire memory read side.
6. **Source-plane durability** by the established DPS pattern (append-only JSONL / Supabase
   behind the same contracts): source registry + bytes + commons + consent + redaction survive
   restart; version ids stable by content-address (already true) + persisted identity map.
7. **Render the Theater or prune it.** Either shots/lighting/pacing get consumers (see roadmap
   R3) or the producers should be feature-flagged out of the hot path. Folded-but-unrendered
   machinery that "will be used later" without a tracking increment is drift.
8. **One taxonomy for interaction primitives.** Reconcile ADR-0033 (~25) / CSE-014 (37) /
   registry (~30) / gateway (17) / UI (8) into one table with per-primitive status, and wire the
   highest-value missing classes (Attend via hover/dwell telemetry; Express via predict +
   teach-back — both feed the affect channel and the Self-Explanation Console).

---

## 9. Prioritized Production Roadmap

Sequenced by the audit's severity order; each phase has an acceptance bar phrased as a learner
experience, per the project's own verification doctrine. (Effort: S ≤ 2 days, M ≤ 1 week,
L = multi-week, at the repo's demonstrated velocity.)

### R0 — Integrity & durability (the product must keep its promises) — effort M

1. Durable source plane: registry, bytes, commons, consent envelopes, redaction set
   (DPS pattern; ADR required). Revocation survives restart; content route still 410s after deploy.
2. Session close: sendBeacon + server idle-close + distillation trigger. Episodes/resume cards
   flow for pure-web learners.
3. Emit `surface.source.attached` on contribute-bind (fix the fold/server disagreement).
4. Typed frame kind replaces title-prefix practice detection (schema field, 4 call sites).
5. Creation draft persistence (server-side, keyed to creation id).

**Acceptance:** a learner contributes a creation, revokes it, the operator restarts the gateway —
the commons stays delisted and the content route returns 410. A learner closes the tab
mid-session and returns tomorrow — a resume card appears.

### R1 — The front door (the Source Dock) — effort M

Spec-first: author the acquisition experience (new CSE-009 archetype or `CSE-017-source-dock.md`
+ F15 experience section — the audit found no owning spec). Then:

1. Upload affordance on the surface + `/enter`: drag-drop / file picker (PDF, md, txt, code),
   URL field (crawl route), paste-transcript path for video; multipart or base64 body handling
   at the gateway.
2. The honest loading narrative (CSE-009 §7): canonicalization stages narrated live from
   `source.*` events — waiting itself teaches.
3. A minimal source library per learner ("my sources," attach to surface, raw-source toggle).
4. Honest refusal for unadaptered modalities (epub/notebook/presentation greyed with "not yet",
   never a 422 surprise).

**Acceptance:** a learner drags a textbook-chapter PDF into the browser, watches the system
understand it in stages, and sees it appear in the Living Reference — zero curl.

### R2 — Source-anchored teaching (the heart of the vision) — effort L

1. "Teach this source" mode: curriculum from canonical layers; frames as document regions;
   Director's `source_anchor_ref` populated by a model-backed region-selection step (the
   "expert gaze"), replacing lexical token-overlap.
2. Source text (the selected region + neighbors) enters the frame-planner and composer prompts;
   narration is authored *about* the document (quotes it, names its figures).
3. Semantic sync bindings + entailment gate (redesign #4); highlight roles emitted per meaning
   (definition/misconception/mathematical-focus/citation…), not hardcoded `evidence`;
   `highlight.cleared` emitted on focus moves.
4. Source-as-stage archetype (redesign #3) for source-mode frames; board-as-stage retained for
   goal-mode.
5. Document-progress projection: the path view shows position *in the document*.

**Acceptance:** the audit's own success criterion — upload a chapter, press "Teach me this," and
the system walks the chapter region by region: viewport gliding, typed highlights moving with the
voice, equations activating, each frame a region of the actual document. Verified live with real
Gemini and captured as an E2E script like `m5-live-e2e.ts`.

### R3 — The living stage (render the Theater) — effort M

1. A cinematography consumer in `apps/web`: realize the shot grammar (spotlight, semantic zoom,
   dissolve, hold…) over both the board and the source pane, with CSE-013 §6's mandated
   reduced-motion realizations.
2. Consume Director pacing: `dwell_hint_ms`/`tempo` drive `useChoreographer` (replace the fixed
   1400 ms); `silence` renders as deliberate stillness.
3. Scene lighting: focal actor emphasis + sibling recession (the CSS machinery exists).
4. Attention-budget producer + affect visibility with opt-out (CSE-005 §3.5's promise).
5. Progressive derivation: `key_formula.lines[]` revealed line-by-line on narration beats.

**Acceptance:** a lesson visibly breathes — the camera moves only when narration warrants it,
derivations unfold like a whiteboard, and a fatigued learner sees the surface fall still.

### R4 — The Representation Intelligence layer (Production Goal II) — effort L

See Part II below. The RIA agent + MCCR 2.0 representation grammars + the representation laws.

### R5 — Compounding & breadth — effort L (parallelizable)

Episodes surfaced in-session; Understanding Map feeding the Director; fusion results cited by
frames (fusion becomes an input to composition when >1 source is bound); claim-graph
visualization; Replay Rail + past-session browser; video ASR + the concept scrubber; multi-file
code ingestion; epub adapter; multi-source alignment UX; Governance & Privacy Center;
principles-first onboarding with the live sync demo; F11 educator/cohort layer.

---

# Part II — The Cognitive Representation Engine (Production Goal II)

## 10. Diagnosis

The representation layer is a **closed 10-slot MCCR vocabulary rendered by a hardcoded (excellent)
design system**. The model chooses *which* slots and their text; every visual decision —
typography role, hue, layout, animation, reveal order — is fixed in the CDL. This bought
consistency, replay-safety, and honest degradation, and it is the right architecture (the
external evidence is unambiguous: freeform generated UI fails ~20%+ of the time; plans over
closed vocabularies win). But the vocabulary is too small and the plan too shallow for the
representation to be *cognitive*:

- Five archetypes collapse to ~3 grid templates; every frame is the same anatomy with different
  words.
- Derivations render complete; diagrams are fixed-canvas dot-and-label; graphs never construct
  themselves; nothing unfolds *with* the explanation except element-level reveal.
- Representation does not vary by concept type (a theorem, an algorithm, and a biological process
  get the same board), by learner expertise (no expertise-reversal adaptation), or by source
  modality.
- Important relationships between ideas are stated in prose, rarely reinforced spatially.
- Density recomposition can fold essential content behind disclosure chips — the "hidden
  knowledge" the vision forbids.

**The fix is not to let the model draw. It is to let the model *plan representation* over a much
richer deterministic vocabulary — and to make that plan a governed, replayable artifact.**

## 11. The Representation Intelligence Agent (RIA)

A new privileged cognition unit — working name `agent.representation` — the guardian of
representation quality. Its responsibility is **cognitive representation, not UI design**: it
converts cognitive intent into the most cognitively effective multimodal plan before anything
reaches the learner.

**Position in the pipeline** (evolving the current one, not replacing it):

```
Learning goal / source region
  → Director            (what cognitive state, what pace, WHICH source region)
  → Frame Planner       (what frames, what sub-focus)
  → Explainer/Composer  (what content: MCCR slots + narration script)
  → RIA                 (HOW: the RepresentationPlan — see §12)
  → Cinematography      (camera realization of the plan's emphasis timeline)
  → Delivery            (fold → render; the plan is deterministic to execute)
```

The RIA runs on the same governed dispatch path as every cognition unit (model-backed, D3
recorded, deterministic fallback = today's behavior — which makes rollout safe: the fallback plan
is exactly the current rendering).

**Inputs:** the composed frame (MCCR + narration segments), concept type (from the KG layer +
MRL MeaningUnits), learner state (mastery, development stage, affect, expertise), source evidence
(anchors + region geometry), Director directive (state, pacing, intensity), viewport constraints
(available space, reduced-motion), modality.

**Output — the `RepresentationPlan`** (a new event, `surface.representation.planned`, folded into
a `representation` slice; fully replayable; inspectable via "why this representation?" exactly
like directive rationale):

- **Composition:** which elements, their spatial arrangement (from a layout grammar, §13), their
  representational hierarchy (primary / supporting / residue), and the explicit *exclusion* list
  (what was considered and left out — coherence principle, recorded).
- **Reveal schedule:** per element, the narration beat that reveals it — including *sub-element*
  schedules: derivation lines, diagram construction steps, graph traces, table rows.
- **Emphasis timeline:** the typed highlight/spotlight sequence handed to Cinematography.
- **Typography & color semantics:** each element tagged with its epistemic role (canonical /
  definition / reasoning / example / warning / misconception / insight / memory-cue / question /
  hypothesis / proof-step / observation) — the CDL renders the tag; the RIA assigns it.
- **Density verdict:** bounded element-interactivity per beat (CLT); if the frame exceeds budget,
  the RIA splits the frame *upstream* rather than letting the client fold essentials into chips.
- **Adaptivity record:** what was changed for this learner and why ("full choreography — novice
  at this concept"; "terse signaling — expertise-reversal"), disclosed like every adaptation.

**Collaborations:** Director (receives state/pacing law), Frame Planner (may request frame
splits), Composer (may request missing elements: "this proof needs a geometric interpretation"),
Image Agent (every image request carries a pedagogical rationale: what misunderstanding it
resolves, how narration will interact with it, whether it should animate/zoom/highlight),
Cinematography (consumes the emphasis timeline), Assessment (representation of feedback),
Memory (memory-cue placement).

## 12. The Representation Laws (proposed spec: `CSE-017-representation-intelligence.md`)

1. **No Hidden Knowledge.** Content essential to the current explanation is visible without
   interaction. Interaction deepens understanding; it never reveals what should already be shown.
   (Density recomposition may fold *supporting* material only; the RIA's hierarchy tags decide.)
2. **Progressive Construction.** Anything with internal structure — derivation, proof, algorithm,
   diagram, flowchart, reaction, argument, code walkthrough — unfolds step-by-step on narration
   beats. The learner watches understanding being constructed, never receives the completed
   artifact first. (Worked-example effect; the whiteboard law.)
3. **Intelligent Density.** Each beat carries exactly the elements required for the current
   understanding step, within a working-memory budget. Not minimal, not maximal — bounded.
4. **Persistent Residue.** Narrated cognition leaves durable marks: constructed lines stay,
   highlights decay to persistent tint, key insights crystallize into board residue. Nothing
   important lives only in the transient audio channel. (Transient-information effect.)
5. **Semantic Typography & Color.** The learner recognizes the *kind* of knowledge — canonical
   principle vs. hypothesis vs. misconception vs. memory cue — from visual language alone, never
   labels. (The CDL's role/hue system, driven per-element by the RIA rather than per-slot-type.)
6. **No Redundancy.** Narration is never subtitled verbatim onto the stage; the caption channel
   (Voice Line) is the only verbatim text. On-stage text signals structure, never repeats speech.
7. **Spatial & Temporal Contiguity.** Explanation renders at the thing explained (gloss at the
   anchored region, annotation on the equation, label on the diagram part) and within the same
   narration beat.
8. **Expertise Reversal.** Choreography degrades as mastery rises: fewer highlights, faster
   pacing, terser scaffolds, worked examples fading to completion problems. The RIA reads the
   development ladder and adapts — and discloses the adaptation.
9. **Pedagogical Images Only.** Every image carries its recorded rationale; decoration is a
   defect. Images participate in the reveal/emphasis schedule like every other element.
10. **A move with no cognitive reason is a defect** (inherited from CSE-013, extended to all
    representation: every animation, color, and layout choice traces to a law or a plan entry).

## 13. Representation Grammars (MCCR 2.0 — the widened closed vocabulary)

Per concept type, a deterministic grammar the RIA plans over (each an extension of the existing
element/fold/render pattern — schema → fold slice → renderer → deck export):

- **Derivation grammar** (theorem/proof/calculation): step sequence with per-step annotation,
  transformation labels ("substitute", "factor", "by induction"), highlight of the changed
  sub-expression between steps (KaTeX span diffing), optional geometric-interpretation panel.
- **Algorithm grammar:** state + invariant panel, stepped trace over an example input, the
  loop/branch structure as a walked diagram.
- **Process grammar** (biological/chemical/physical): stage diagram constructed stage-by-stage,
  causal arrows drawn as narration names the causation.
- **Comparison grammar:** aligned dual columns with per-row emphasis beats and an explicit
  differences trace.
- **Graph/plot grammar:** axes first, then the curve *drawn* as a trace, then annotations landing
  on features as narration reaches them; parameter variation as an interactive residue.
- **Structure grammar** (taxonomies, architectures): semantic-zoom tree — the existing diagram
  kinds gain construction schedules and zoom levels.
- **Misconception grammar:** wrong-model shown, *dissolved* (the CSE-013 shot), right-model
  constructed in its place — the contrast preserved as residue.
- **Code grammar:** the source file (or generated snippet) with line-anchored narration beats,
  value-flow annotations, and executed-example residue.

Each grammar is deterministic to render and replay; the RIA chooses grammar + parameters +
schedule. This is exactly the proven MCCR architecture, deepened — not a new rendering paradigm.

## 14. Learning-Science Conformance Map

The external principles this design encodes, with current status:

| Principle | Today | After R2–R4 |
| --- | --- | --- |
| Multimedia (words + pictures) | Partial (images sometimes) | Every narrated concept has a visual anchor (RIA law 9) |
| Coherence (cut extraneous) | Good (density law) | Exclusion list recorded per frame |
| Signaling | Element highlight only | Typed semantic highlights on board *and* source |
| Redundancy | Caption-only verbatim ✅ | Law 6 makes it structural |
| Spatial/temporal contiguity | Violated (side panel; all-at-once derivations) | Laws 2 & 7 |
| Segmenting | Frames ✅ | Beats within frames |
| Modality (voice over visible graphics) | ✅ core architecture | unchanged |
| Personalization/voice | Conversational narration ✅ | persona pacing (deferred v3 scope) |
| Generative activity | Practice + grading ✅ | prediction/self-explanation beats in the timeline |
| Worked examples + fading | Static examples | Derivation grammar + fade states (CSE-009 §4) |
| Expertise reversal | None | Law 8 |
| Transient-information mitigation | Scrub + board residue partial | Law 4 |

## 15. Spec-First Artifacts Required (before any Part II code)

1. **`spec/source-environment/CSE-017-representation-intelligence.md`** — the RIA: identity,
   laws (§12), the RepresentationPlan contract, grammar registry (§13), collaboration seams,
   failure modes (fallback = current rendering), observability (plan events, "why this
   representation?"), non-goals (not UI generation, not layout freedom, not aesthetics).
2. **ADR — Representation Intelligence adoption** (pipeline position, the closed-vocabulary
   decision with the external evidence, rollout via deterministic-fallback parity).
3. **SRF-002 schema bump** — `surface.representation.planned` (+ sub-element reveal events if the
   choreographer needs them individually addressable).
4. **CDL v1 §-addition** — the epistemic-role typography/color table becomes per-element law.
5. **Acquisition experience spec** (R1's prerequisite, same spec-first rule).
6. Index updates per doctrine (`spec/indexes/`, CSE README table, event-index for new families).

---

## 16. Closing

The success criterion, restated from the audit brief: *not* that implementation matches
specification — the repo is already unusually good at that — but that a learner studying a real
textbook, paper, theorem, algorithm, or codebase experiences the most coherent, synchronized,
visually expressive, intellectually supportive learning environment buildable today.

The audit's finding is that this criterion is currently unmet **for reasons that are almost
entirely in the last mile**: one missing front door (R1), one pipeline inversion (R2), one render
pass over already-emitted events (R3), and one new planning agent over the existing MCCR
architecture (R4) — on top of an integrity pass (R0) that the consent promise makes
non-negotiable. The substrate below them is genuinely ahead of the state of the art surveyed in
§7, and the white space it targets — a live, replayable, source-grounded teaching performance
over the original document — remains unoccupied by anyone.
