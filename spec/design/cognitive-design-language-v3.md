# Cognitive Design Language (CDL) v3 — Multi-Sensory Scope

**Status:** PROPOSED (scope) — not yet active design law. v1 and v2 remain ACTIVE.
**Owns (when accepted):** the extension of the CDL from a visual+motion language into the full
**design language of cognition** — every sensory and temporal channel through which understanding
is guided.
**Upstream:** `spec/design/cognitive-design-language-v1.md` (ACTIVE), `cognitive-design-language-v2.md`
(ACTIVE — cinematic world, lens glass, morph motion), the Cognitive Theater (ADR-0033) and its
organs (`spec/source-environment/CSE-011`…`CSE-014`).
**Downstream (when accepted):** `apps/web/src/tokens.css` and the surface components; the Theater
realizations (Director pacing, Scene lighting, Cinematography shots, Interaction feedback).
**Non-goals:** brand/marketing identity; replacing v1/v2 (v3 *extends* them).

---

## 1. Why v3

v1 made the surface "cognition or light" (visual + depth + the seven planes + state hues + the
motion verbs form/continue/focus/reveal/yield/breathe). v2 made it a continuous cinematic world
(lens glass, morph motion, living substrate). Both are still **primarily visual and spatial**.

The Cognitive Theater (ADR-0033) introduces channels the CDL does not yet govern: a **Director**
that paces time and emotion, **Scenes** with audio actors, a **Cinematography** grammar of shots,
and an **Interaction** grammar of gestures. Each needs a design language, or each will drift into
ad-hoc styling. v3 is the scope proposal for that language. It is written as **scope**, not final
tokens — the token layer follows acceptance (as v1→`tokens.css` did).

## 2. The Twelve Channels

v3 extends the CDL across twelve channels; v1/v2 already own the first two.

| # | Channel | Owns | Status |
|---|---|---|---|
| 1 | **Visual** | color, type, depth, planes (v1 §3–4) | ACTIVE (v1/v2) |
| 2 | **Motion** | the six motion verbs, morph, camera (v1 §5, v2) | ACTIVE (v1/v2) |
| 3 | **Audio** | narration timbre, cognitive-state sound, silence, non-speech cues | v3 |
| 4 | **Spatial** | 2D↔2.5D↔3D/immersive layout, depth-of-field, presence (F09) | v3 |
| 5 | **Interaction** | feedback grammar for the ~25 interaction primitives (CSE-014) | v3 |
| 6 | **Attention** | how focus is claimed and released; the one-focal-accent law over time | v3 |
| 7 | **Emotional pacing** | how the room responds to affect (CSE-011 §3.3) — calm on overload, energy on curiosity | v3 |
| 8 | **Cognitive-load** | density budgets, recomposition, when to simplify the field | v3 (formalizes v1 density work) |
| 9 | **Temporal rhythm** | tempo, dwell, pause, the cadence of reveal vs. hold (CSE-011 pacing) | v3 |
| 10 | **Narrative structure** | the shape of a lesson as a story — setup, tension, resolution | v3 |
| 11 | **Cinematography** | the visual/design realization of CSE-013 shots | v3 |
| 12 | **Transition grammar** | how one Scene/state/concept becomes the next | v3 (extends v1 form/continue) |

## 3. Governing Laws (proposed, extending v1's)

1. **Every channel carries meaning or stays silent.** As color is never decoration (v1), sound is
   never ambience, motion is never flourish, and a pause is never dead air — each communicates a
   cognitive event or does not fire.
2. **The state colors every channel, not just the visuals.** The current cognitive state (CSE-011)
   sets not only the hue but the tempo (rhythm), the sound (audio), the willingness to interrupt
   (attention) — one coherent mood per moment.
3. **Emotional pacing is honest and gentle.** The room may calm, brighten, or slow in response to
   affect, but never manipulates (Constitution #4): every affective adaptation is disclosed
   (CSE-005 §3.5) and none is used to increase engagement against the learner's interest
   (Constitution #5).
4. **Silence and stillness are designed, not absent.** The design language specifies *how* the
   surface holds — visually, sonically, temporally — because the hold is pedagogy (CSE-013 `hold`,
   ADR-0033 L6).
5. **Every non-visual channel degrades to a visual/textual equivalent.** Audio has captions;
   spatial has a 2D fallback; motion has a discrete realization; emotional pacing never gates
   content. Accessibility is conformance, not enhancement (CSE-008 §11).
6. **Reduced-* preferences collapse channels safely.** `prefers-reduced-motion`,
   `prefers-reduced-transparency`, and a proposed `prefers-reduced-audio`/`-stillness` each map to
   a defined, tested collapse.

## 4. Relationship to the Theater

- **Director (CSE-011)** chooses the *mood and tempo*; v3 channels 6/7/9 define how that mood and
  tempo are expressed across senses.
- **Scene (CSE-012)** places *actors*; v3 channels 1/3/4 define how actors look, sound, and sit in
  space.
- **Cinematography (CSE-013)** chooses *shots*; v3 channels 2/11/12 define how shots render and
  ease.
- **Interaction (CSE-014)** captures *intent*; v3 channel 5 defines the feedback that confirms the
  intent was received cognitively.

## 5. Path to ACTIVE

v3 becomes design law only via the CDL governance path (as v1/v2 did): a proposal + audit under
`spec/design/proposals/`, approval, then a token-layer landing in `apps/web/src/tokens.css`. Until
then, the Theater specs reference v3 as *proposed scope*; where a Theater organ needs a design
token today, it uses v1/v2 tokens and flags the v3 dependency. **This document authorizes no
visual change on its own.**

## 6. Open Questions

- Audio language is the least-charted channel: cognitive-state sound design risks gimmickry —
  needs a research pass (owner: design + learning-science) before any token lands.
- Whether spatial/immersive (channel 4) is v3 or a separate v4 tied to the F09 immersive frontier
  — leaning: scope it in v3, land tokens only when an immersive projection is built.
- Emotional-pacing guardrails need a hard ethical review (human-governance) before implementation —
  the line between "responsive" and "manipulative" must be encoded, not assumed.
