# Handover — 2 July 2026

## Headline: Modal Match shipped end-to-end (drill + reference + produce loop)

Second day of modal work. Yesterday built the Modal Chooser content batch; today built and wired the **full feature**: the practice component, the Learn reference, a Sentence Challenge produce-loop after every item, and a rename. All live in the repo (James pushing) and DB.

**The pair, final names:**
- **Modal Explainer** (Learn) — card-per-modal reference → links to
- **Modal Match** (Practice, *renamed from "Modal Chooser"*) — the blank-fill drill → now **fires a Sentence Challenge after every answer** so students produce a sentence with the modal they just met.

Mirrors the Tense Explainer → Tense Tagger pair, and the Tagger's recognise→produce arc. James's principle driving the produce loop: **"hear → learn → produce."**

---

## What shipped today

### New files
- `src/ModalChooser.jsx` — the **Modal Match** component (file/component keep the internal name `ModalChooser`; only the user-facing title changed).
- `src/lib/modalExplainEn.js` — Modal Explainer content spine (13 modal cards, 4 groups, all 14 Chooser pills + `expectation`/`suggestion`).
- `src/components/ModalExplainer.jsx` — the Learn reference component.

### Edited files
- `src/ExerciseList.jsx` — imports, `ACTIVE_EXERCISES`, `EXERCISE_ICONS` (📗 Explainer, 🔀 Match), routing branches for both, and the **Modal Explainer → Modal Match** practise bridge (`onPractise` opens Modal Match).
- `src/components/TenseTagger.jsx` — retrofit: the "Star earnt" (done) screen now **echoes the student's sentence** ("Your sentence: …"), matching the Sentence Challenge.

### DB (live)
- `exercises` — **Modal Match** `a3f0bd4d-ded4-48e0-9048-9891e83cd31e` (practice / `type=null` / order **2** / tracks general); **Modal Explainer** `cbf1f5b1-93a5-4a2a-b13c-3cd575b5ed45` (learn / reference / order **1** / tracks general). Title renamed Modal Chooser → **Modal Match**.
- **Activities order set 1–7:** Tense Tagger, Modal Match, Sentence Building, Error Correction, Odd One Out, Matching, Real Talk. (practice category holds exactly these 7.)
- Learn: Tense Explainer (0), Modal Explainer (1) — adjacent.
- `question_bank` unchanged today: 39 `modal_chooser` items at **2370–2408**, `MAX(question_number)=2408`.

---

## The Sentence Challenge produce-loop (Modal Match)

After a student checks their modal answer, the feedback + explanation show, then the **existing `SentenceChallenge` component auto-fires as a bottom sheet**, seeded to that item:

- `word` = the item's `correct_answer` (the exact form — carries positive/negative + past/present/future).
- `promptText` = `Now use this modal {functionPhrase}:` — the modal shows as the highlighted chip. Phrasings live in **`FUNCTION_PHRASE`** in `ModalChooser.jsx` (James's exact wording; **his to tune**).
- `exercise='modal_match'` → stars logged with that source, `subtype='sentence'`.
- **Skippable** via the Challenge's built-in "Skip this challenge" (James's compromise: auto-fires but one tap to bypass).
- **Harvest:** every attempt (pass *and* fail) → `sc_sentences` via `onMarkResult` → `harvestModalSentence`:
  `source='modal_match'`, `target=`the function pill, `is_correct`, `ai_feedback`, `input_method`, `language='en'`, `level`. This is the "where are they producing well / badly, by function" dataset.

### Two open UX switches (built one way; one-line flips)
1. **Prompt shows the modal as a chip** (`Now use this modal to give advice:` + **should**) rather than James's literal `Now use "should" to give advice.` — swap = put the form inline in `promptText`.
2. **Challenge auto-fires over the explanation** (bottom sheet). If James wants read-then-produce, gate it behind a "Now produce it →" tap instead of auto-popping.

Both flagged to James in chat; awaiting his verdict after testing.

---

## Modal Explainer detail

- **Two-level accordion:** function-area group → individual modal, **one modal open at a time** (was: whole group expanded at once — too much info).
- Watch-outs use **👁️** (not ⚠️) — ties to Spanish *¡Ojo!*.
- Content (`gloss` / `contrast` / `watchOut`) is **first-draft teacherly layer** in `modalExplainEn.js` — **James's weekend review**. British spelling, "infinitive", hospitality flavour; watch-outs target Spanish-L1 traps (no "to" after core modals, must vs have to, mustn't vs don't have to, etc.).
- Taxonomy: 14 Chooser pills **+ `expectation` (should) + `suggestion` (shall)** — James chose to keep these two reference-only labels to "show the whole gamut."

---

## Known issues / debt

- **Pill styles duplicated:** `PILL_STYLES` in `ModalChooser.jsx` and `FUNCTION_STYLES` in `modalExplainEn.js` are identical copies. Fine for now; **consolidate into `BadgePill.jsx`** (a `FunctionBadge`) when James decides the pill look is final (he wanted to see it in the wild first — that decision is still open).
- **Deploy state:** both `exercises` rows are live in the DB; their routing code deploys when James pushes. Until then, production shows greyed **Modal Explainer** / **Modal Match** cards.
- **Local migration sync** still owed from yesterday: the `question_bank_type_check` change (`add_modal_chooser_to_question_bank_type_check`) is live on the DB but not in local history — `supabase db pull`.

---

## Outstanding / next

1. **James's weekend teaching pass** (his stated plan): the Modal Explainer watch-outs/glosses/contrasts in `modalExplainEn.js`, and the `FUNCTION_PHRASE` produce-prompts in `ModalChooser.jsx`.
2. **C-level Modal Match items** — the Advanced band is empty (shows "· soon"); James flagged writing C1/C2 items now that it's live. New items continue from **`question_number` 2409**, `type='modal_chooser'`, function pill in `tags[0]`, register notes in `acceptable_alternatives`.
3. **Resolve the two UX switches** above once James has tested.
4. **Pill consolidation** into BadgePill (see debt).
5. **Marking prompt** for the produce loop currently uses the generic `apiContext='challenge'` (checks the modal is used in a valid sentence, not that it fits the *function*). Fine for v1; could add a modal-aware context to `mark-free.js` later if James wants function-sensitive marking.

### Parked (unchanged from 1 July)
- **Spanish modal contrasts** (deber vs deber de, tener que vs hay que, saber vs poder) — for the **Tense Explainer expansion** (after subjunctive/conditional/future-of-probability scaffolding), not a parallel feature now.
- **Tense Explainer watch-out review** (`tenseExplainEn.js` / `tenseExplainEs.js`) — still open.

### Carried-forward backlog
- Spanish GOTD B1/B2 + C1/C2; ES Word of the Day B1+ (A-level only).
- Flashcard rebuild.
- **Error Correction batch from Q2409** onward (leading-word deletions permitted).
- Sentence Challenge marker tuning (over-strict on concise correct; under-strict on errors outside the target word).
- Monthly content top-up: all surfaces end on the last day of the month.

---

### Standing state (verified this session)
- `question_bank` `MAX(question_number) = 2408` → **next batch 2409** (Modal Match items 2370–2408, all 14 pills; A2=6, B1=16, B2=17, C-level none yet).
- `question_bank_type_check` allows: gap_fill, multiple_choice, sentence_building, odd_one_out, error_correction, matching, sentence_auction, **modal_chooser**.
- Vercel serverless functions: still **8/12** (produce loop reuses the existing `mark-free.js` — no new endpoint).
- Harvest surfaces now writing to `sc_sentences`: Tense Tagger (`tense_tagger`), Modal Match (`modal_match`), plus the WOTD/GOTD/etc. challenge sources.
