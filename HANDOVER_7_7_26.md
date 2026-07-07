# HANDOVER — 7 July 2026 · Live-lesson polish (Modal Match + Fix It + Conditionals placement)

## What shipped this session

A small, targeted polish/bug-fix pass driven by screenshots from a live GET21 lesson
(Antonio / Pau) plus earlier session shots, and the Conditionals Explainer placement you
asked for. Six changes: three DB (live now), three code files (ready for your push).

## Database — already live

- **exercises reorder** — `Conditionals Explainer` moved to `recommended_order 2`, so it now
  sits as **card 3 in Learn, straight after Modal Explainer** (order 1), uniquely, for every
  track. Done via a `+1` cascade on all `category='learn'` rows with `recommended_order >= 2`,
  then setting Conditionals to 2. Full learn order re-verified after.
- **question_bank 2382** (modal_chooser · *deduction — negative*) — **data bug fixed.** The stem
  carried a stray "have": *"she \_\_\_ have gone far."* Every one of the 20 sibling perfect-form
  items uses the pattern "\_\_\_ [participle]" and lets the +have toggle / answer supply "have".
  2382 was the only one with the extra word, so a student building "couldn't" rendered a
  correct-*looking* "she couldn't have gone far" but was marked wrong, and the "correct" path
  would have shown a double "have". Stem is now *"She was here two minutes ago — she \_\_\_ gone
  far."* → build "couldn't have" (could+n't+have) = correct; bare "couldn't" now properly wrong.
- **question_bank 2398** (modal_chooser · *warning*) — added **have to · must · should** as
  `acceptable_alternatives`, each with a register note pointing back to *had better* as the true
  warning (built-in bad-outcome). Closes a defensible-distractor leak: all three are natural in
  *"You \_\_\_ leave now, or you'll miss the last bus."* Remaining tiles are all genuinely wrong
  for a warning there.

## Code — ready for your push

- **`src/components/ExplainerOverlay.jsx`** — the ✕ close button (📖 See the full card overlay)
  wasn't flex-centred, so the glyph drifted high/left in its circle. Added
  `display:flex; align-items:center; justify-content:center; padding:0`.
- **`api/mark-free.js`** — new **`context: 'modal'`** branch inside `handleSentence`
  (`isModal` flag + `targetFunction` destructured). The Modal Match "Your turn" step was
  routing to the generic `challenge` marker, which only checks the modal is *used correctly* —
  the target **function** ("make a wish / If only…") was shown to the student but never sent to
  the marker, so off-function sentences (e.g. *"you could go to the shop"* for a wish) were
  rubber-stamped. The new prompt requires the sentence to genuinely **perform** the function,
  with a nudge + tiny model on fail. Isolated — WOTD / Wordle / GOTD / PVOTD / challenge
  untouched. Same consolidated function → **Vercel stays at 8/12**.
- **`src/ModalChooser.jsx`** — the "Your turn" `SentenceChallenge` now passes
  `apiContext="modal"` + `apiExtraFields={{ targetFunction: functionPhrase((q.tags && q.tags[0]) || '') }}`.
- **`src/components/RandomPracticeExercise.jsx`** — **Fix It now has its own finished screen**
  (it reused the generic one, which said "Practice Complete!" with Best/Average tiles that
  aren't comparable across variable Fix It sets, and a wrong "Back to Levels" label). New screen:
  "🔧✨ Repairs done!", a **"Fixed today X / Y"** hero stat, a green **"N cleared out of your box
  for good!"** line when applicable, and **Done / Try-these-again** buttons. Best/Average dropped
  for Fix It; the generic practice screen is unchanged (branched on `isFixupMode`).
  Plumbing: new `clearedForGoodRef` (Set) + `clearedForGood` state; tally added in `saveAnswer`
  (correct AND `fixes_so_far >= 1`, deduped by question_number — matches the per-question
  "out of your box for good" message); reset in `startExercise`; snapshotted in `finishExercise`.

Validation: all four edited files passed esbuild (`--format=esm --loader:.jsx=jsx` for the JSX,
plain for `mark-free.js`). Repo files edited in place via Filesystem MCP with dry-run previews.

## Question bank

- **Last used number: 2506 (unchanged).** No inserts this session — 2382 and 2398 were updates.
  Next batch starts at 2507.

## Testing checklist (after your push)

1. **Learn tab** (general + Spanish): Conditionals Explainer 📘 now sits 3rd, right after Modal
   Explainer.
2. **Overlay ✕**: open 📖 See the full card in Modal Match — the ✕ is dead-centre now.
3. **Modal Match "Your turn"**: an off-function sentence (e.g. *"you could go to the shop"* for a
   wish) now **fails** with a nudge; a genuine wish (*"If only I could…"*) passes. Try one or two
   other functions to confirm the marker is checking meaning, not just the modal.
4. **Modal Match intermediate**: 2382 *"she \_\_\_ gone far"* → build **couldn't have** = correct,
   bare **couldn't** = wrong; 2398 *"you \_\_\_ leave now…"* → **have to / must / should** all pass
   green with notes, **had better** still the model answer.
5. **Fix It finish**: complete a Fix It set → repair-themed screen; if any question was already
   fixed once before today, the green "cleared for good" counter appears.

## Queued next (unchanged)

- "helper verb" → "auxiliary verb" codebase sweep
- Tense engine Phases 2–4 (`scripts/generate_tense_specimens.mjs` — you run locally)
- `practisable: true` engine support for the new ES tenses
- Spanish Modal Explainer · GET21 B2B org structures · flashcard rebuild · Spanish GOTD B1+
- Irregular Verbs push still pending (title rename confirmation)
- Optional spot-check: other Modal Match items for the same defensible-alternative gap 2398 had.
