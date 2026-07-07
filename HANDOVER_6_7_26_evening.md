# HANDOVER — 6 July 2026 (evening) · Conditionals Explainer + Chooser

## What shipped this session

The full conditionals build, both tracks, agreed this morning and executed this evening:
a **Conditionals Explainer** (Learn reference, EN + ES) and a **Conditionals Chooser**
(practice game, EN + ES), with the Sentence Challenge produce loop and 60 bank questions.

### Design rulings applied (yours, 6 Jul)
- Advanced **formal inversion** card included (EN); ES counterpart is **de + infinitivo / yo que tú**.
- **Negatives woven in as first-class rows on every card** — each card has a `negative`
  {formula, examples} section, and negative blanks appear throughout the question set.
- ES subjunctive forms (imperfecto de subjuntivo, pluscuamperfecto, condicional compuesto)
  taught **inline via per-card `formation` boxes** — no Conjugator expansion (still parked).
- Chooser uses **per-question 4-option tiles** in `options` jsonb (shuffled once at fetch).
- SC produce loop shipped in v1: `apiType='conditional'` → new `handleConditional` in
  mark-free.js (same consolidated function — **Vercel stays at 8/12**).

## Files changed — ready for your push

**New (7):**
- `src/lib/conditionalExplainEn.js` — 7 EN cards: zero · first · second · third · mixed · unless · inversion
- `src/lib/conditionalExplainEs.js` — 7 ES cards: tipo0 · tipo1 · tipo2 · tipo3 · mixto · amenosque · deinf
- `src/components/ConditionalCard.jsx` — EN card + ConditionalTimeline (condition→result dots; solid = real, dashed hollow = hypothetical)
- `src/components/ConditionalCardES.jsx` — ES mirror + CondTimelineES (pasado/ahora/futuro) + formation-box renderer
- `src/components/ConditionalExplainer.jsx` — EN accordion page (groups, level ladder, Show-all toggle, onPractise)
- `src/components/ConditionalExplainerES.jsx` — ES accordion page
- `src/ConditionalChooser.jsx` — the game; `language` prop routes track; function pill = tags[0]; 📖 card = tags[1]; client-side deterministic marking; SC produce; harvest to `sc_sentences` (source `conditional_chooser`)

**Edited (2):**
- `api/mark-free.js` — `type: 'conditional'` route + `handleConditional` (EN + ES prompts; -ra/-se equal; hubiera OK in tipo-3 result; si+condicional/si+futuro always fail; inversion card requires inversion; cosmetics never fail)
- `src/ExerciseList.jsx` — imports, ACTIVE_EXERCISES, EXERCISE_ICONS (📘 / 🎯), and both routing branches (Explainer track-routes EN/ES; Chooser gets `language={isSpanishTrack ? 'es' : 'en'}`)

All 7 new files + edited ExerciseList passed esbuild (`--format=esm --loader:.jsx=jsx`);
both libs passed node smoke tests (7 cards each, unique ids, negative + watchOuts on every
card, byId coverage, ladder A2 view = zero/first & tipo0/tipo1). Repo copies diff-verified
byte-identical against the validated container originals.

## Database — already live

- **Migration** `add_conditional_chooser_question_type`: extended the
  `question_bank_type_check` constraint with `conditional_chooser` (same pattern as
  `modal_chooser` before it).
- **exercises** (2 rows): `Conditionals Explainer` (learn / reference / A1-C2 / ['general'] /
  recommended_order 4) and `Conditionals Chooser` (practice / A1-C2 / ['general'] /
  recommended_order 3). Titles byte-match ExerciseList's four registration points.
- **question_bank** (60 rows): EN **2447–2476**, ES **2477–2506**, type
  `conditional_chooser`, topic `conditionals`. 10 per band per language
  (EN: A2×10 · B1/B2×10 · C1/C2×10; ES the same). tags = [function pill, card id];
  options = 4 tiles, lowercase (capFirst handles sentence-initial); explanations + hints
  in the original INSERT; acceptable_alternatives empty on all.
- Post-insert verification: answers ∈ options (0 failures), 4 tiles everywhere, all card
  tags valid, exactly one blank per question.
- **⚠️ Question bank last used number: 2506. Next batch starts at 2507.**

## ⚠️ Content review needed (your turf)

Everything student-facing is a **first draft**: 14 cards (glosses, examples, negatives,
watch-outs, ES formation boxes) and 60 questions (stems, distractors, hints, explanations).
Specific flags:
- EN unless card watch-out claims *unless* sounds heavy with the third conditional — your call.
- ES amenosque card teaches *por si* + indicativo (por si + imperfecto subj exists in past contexts — simplified for the card).
- 2505 uses the idiom *otro gallo cantaría* (glossed in the explanation) — C2, deliberate stretch.
- Distractor discipline applied throughout: no was/were pairs, no zero-vs-will result blanks,
  no habría/hubiera in ES result blanks, no tuviera/tuviese, no de saber/de haber sabido pairs;
  time anchors (*now*, *ahora*, *that evening*, *aquella noche*) added where a mixed reading
  could otherwise be defensible.

## Testing checklist (after your push)

1. General track: Learn → Conditionals Explainer 📘 (ladder at your level, Show all, ahead badges, timelines, negatives, watch-outs; Practise button opens the Chooser).
2. Spanish track (María, B2): same tile → ES explainer; tipo 2/3 formation boxes render; subjuntivo chips.
3. Chooser, all three bands, both tracks: pills, tile select/clear/check, wrong-answer explanation, Coming Soon fallback (shouldn't appear — all bands stocked).
4. 📖 See the full card overlay from a question (EN + ES).
5. SC produce loop: write a matching conditional (pass), a wrong-type conditional (fail with type named), inversion card with a plain if-sentence (fail), Spanish with -se forms and with hubiera-result (both pass). Voice input via Jon if possible.
6. `sc_sentences` rows arriving with source `conditional_chooser`.

Tiles show as active only after your push — the DB rows are live now, so the exercises will
appear with "Coming Soon"-free content the moment the frontend deploys.

## Queued next (unchanged from this morning's handover)

- Tense engine Phases 2–4 (`scripts/generate_tense_specimens.mjs` — you run locally)
- "helper verb" → "auxiliary verb" codebase sweep
- Spanish Modal Explainer · GET21 B2B structures · flashcard rebuild · Spanish GOTD B1+
- Irregular Verbs push still pending (title rename confirmation)
- `practisable: true` engine support for the new ES tenses
