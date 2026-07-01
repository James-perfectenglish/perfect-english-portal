# Handover — 30 June 2026

## This session: Tense Explainer (EN + ES) — built, shipped, live

A new **Learn** reference, *Tense Explainer*, paired with the existing Tense Tagger. The idea: the app should teach as well as practise. The Explainer is a cheat sheet (not a class) — every tense with its formula, when you'd use it (signal words + a handcrafted example), and one "watch out" line. It sits at the **top of Learn** and bridges to the Tagger for practice.

Everything below is built, pushed, deployed, and **live** as of this session. James will now sit with it and watch how students use/react before iterating.

---

## What shipped

### New files
- `src/lib/tenseExplainEn.js` — EN content spine: all **19 EN tenses**. Per tense: `formula`, short `use` (both lifted verbatim from the Tagger's `FORMULAS`), `uses[]` (label + signal words + a curated example), `watchOut`, and `band` (A2/B1/B2). Exports helpers: `TENSES`, `formulaByName`, `tensesForLevel(level, showAll)`, `findTense({time,aspect,voice})`, `levelBand`, `BAND_ORDER`. Tense **name keys are computed from the grammar tuple the same way the engine's `tenseName()` does**, so the two can never drift.
- `src/components/TenseExplainer.jsx` — the EN Learn reference. Accordion grouped Present / Past / Future. **Band-default** (a student sees their own band) with a **"Show all tenses ›" toggle** that reveals the full ladder; tenses above the student's level get a small band tag and pull their example from the lowest band that has one. Parametric past–now–future timeline (positioned by time, shaped by aspect). "Show another" streams a level-matched sentence from the bank; "Practise this" bridges to the Tagger.
- `src/lib/tenseExplainEs.js` — ES content spine: the **4 ES tenses** (presente, presente continuo, pretérito, imperfecto), grouped Present / Past. English scaffolding + Spanish examples + English-speaker watch-outs. No ladder (all four are A2/B1). `formula`/`use` lifted from `FORMULAS_ES`. Exports `TENSES_ES`, `formulaByTiempo`, `tensesByGroup()`, `findByTiempo`.
- `src/components/TenseExplainerES.jsx` — the ES Learn reference. Same card design; timeline tuned to the pretérito/imperfecto contrast; bank query on `answer->>tiempo`.

### Modified files
- `src/lib/tenseEngineEn.js` — `makeGenerated(level, only=null)` gained an optional tense filter (back-compatible; existing callers unchanged). Used for the locked offline fallback.
- `src/components/TenseTagger.jsx` — **locked "Practise this" mode**. New `initialTense` prop → `lockedTense` state; when locked, level is set to the tense's band, the deck is pulled tense-filtered straight from `tense_specimens` (engine fallback stays on-tense), the C1-curated branch is skipped, the level pills are replaced by a **"Practising: <tense>  ← all tenses"** strip, and `clearLock()` drops the lock back to the normal random mix.
- `src/lib/tenseEngineEs.js` — `makeES(level, only=null)` gained the same optional tense filter.
- `src/components/TenseTaggerES.jsx` — the same locked mode (`initialTense.tiempo` → `lockedTiempo`, tense-filtered ES deck, escape strip).
- `src/ExerciseList.jsx` — imported both Explainers; added `'Tense Explainer'` to `ACTIVE_EXERCISES` + a 📖 icon; added the routing branch (EN/ES by track); added `taggerTense` bridge state. The Explainer's `onPractise(tense)` sets `taggerTense`, opens the Tense Tagger row, and the Tagger renders with `initialTense={taggerTense}`. `taggerTense` is cleared on `back()`, on navigation (`location.key`), and at the top of `startExercise` (so direct Tagger opens are always unlocked).

### Database (live)
- One row inserted into `exercises`:
  - `id` = `87538930-e530-4b94-baef-779b63088046`
  - `title` = `Tense Explainer`, `category` = `learn`, `recommended_order` = `0` (top of Learn), `tracks` = `['general']`, `type` = `reference`, `level` = `A1-C2`.
- **One row serves both languages** — `tracks: ['general']` shows it to everyone, and `ExerciseList` renders the EN or ES Explainer based on the student's track. No separate Spanish row needed.
- To remove: `DELETE FROM exercises WHERE id = '87538930-e530-4b94-baef-779b63088046';`

---

## Architecture notes / gotchas

- **Single source of truth.** The Explainers and Taggers can share the content libs: `formulaByName` (EN) / `formulaByTiempo` (ES) are drop-in replacements for the Taggers' inline `FORMULAS` maps. Not yet wired into the Taggers (the Taggers still hold their own inline copies) — a future tidy-up, not urgent. The name keys are guaranteed aligned, so it's a safe swap whenever.
- **Bank "Show another" + locked deck use a PostgREST JSON filter** (`.eq('answer->>time', …)` / `.eq('answer->>tiempo', …)`). This is the one thing only verifiable against the running app. If a tense shows "No bank examples for this one yet" or the locked Tagger only ever falls back to generated sentences, that filter is the thing to check. **Everything degrades gracefully** either way (the Explainer shows a quiet note; the locked Tagger falls back to the on-tense engine), so nothing looks broken. **Worth eyeballing in-app first.**
- **Locked-tense band logic** (`tenseBand` in TenseTagger): `perfect_continuous → B2`; `passive` or `perfect → B1`; else `A2`. Mirrors `LEVEL_GATES`. ES has no band logic (all four tenses exist at A2/B1).
- **Example level** for the bank query = the student's band, or the tense's own band if they're peeking ahead via the ladder — so the bank always has rows.
- Bank confirmed populated this session: EN `tense_specimens` ≈ A2 1516 / B1 1505 / B2 1502 / C1 1508; ES ≈ A2 1516 / B1 1514. (So the Tense Tagger "Stage B2" arc — components reading from the bank — is effectively complete and live.)

---

## Outstanding / next

1. **Content pass (James) — the one real open thread.** The `uses` examples and especially the `watchOut` lines in `tenseExplainEn.js` and `tenseExplainEs.js` are first drafts on the teacherly turf. EN watch-outs target Spanish-L1 traps; ES watch-outs target English-speaker traps (over-using the continuous; pretérito vs imperfecto). Review in context and adjust.
2. **Observe before iterating.** James is sitting with it to see real usage/reactions before further changes.
3. Optional tidy-up: point the Taggers' `FORMULAS`/`FORMULAS_ES` at the shared libs (single source of truth) — safe, low priority.
4. Possible follow-ups if it lands well: ES `futuro` (a fast-follow already noted in the ES Tagger), and "Practise this" deep-link analytics.

### Standing state (verified this session)
- **`question_bank` MAX(question_number) = 2369** → next content batch starts at **2370**. (The previously carried figure of 2048 was stale — verified live, per the always-check rule.)
- Legacy markers unchanged: 888–907 = A2 Spanish MC; 908–910 = A2 Spanish sentence_auction.
- Daily-puzzle surfaces were last topped up to end of July 2026 (prior session).

### Carried-forward backlog (from prior handovers)
- Spanish GOTD: B1/B2 and C1/C2 tracks still empty (only A1/A2 exists).
- ES Word of the Day: B1+ tracks still A-level only.
- Flashcard rebuild (long-standing).
- Error Correction batch from Q2370 onward (leading-word deletions now permitted).
- Marker tuning: two known biases (over-strict on correct concise answers; under-strict on errors outside the target word).
- Monthly content top-up cadence: all surfaces should end on the last day of the month.
