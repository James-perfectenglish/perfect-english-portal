# HANDOVER — 20 July 2026 (SC gating · exercise parity · Spanish matching)

## Session summary
Two threads. **Code**: the Sentence Challenge now fires once per *form* per visit
across Modal Match, Conditionals Chooser and Tense Tagger, and Tense Tagger was
restructured into sets of 10 to match the other two. **Content**: the Spanish
track gained 27 Matching questions — 15 image sets reusing yesterday's assets and
12 audio sets covering r/rr, n/ñ and stress. Question bank now ends at **2699**.

---

## Code changes (on disk, NOT committed — James to push)

All three esbuild-validated (Linux esbuild in sandbox; repo binary is macOS-only).
Diffs were dry-run and reviewed before applying.

### The SC-gating rule (all three components)
Previously the Sentence Challenge was the *only* route to the next question, so a
student produced a sentence for every item — including the fourth second-conditional
in a row. Now a `seenFormsRef` (a `Set` in a ref) records which forms have had their
produce step. First sighting → SC as before. Repeat → the button becomes a plain
**"Next →"**; the 📖 card button is unaffected. The Set survives Try Again and band
switches, and resets only when the student leaves the exercise.

Form keys, chosen so that genuinely different teaching points stay separate:
- **`src/ConditionalChooser.jsx`** — `tags[1]`, the Explainer card id (zero / first /
  second / third / mixed). Falls back to the normalised `correct_answer` if absent.
- **`src/ModalChooser.jsx`** — `cardIdForAnswer(feedback.answer)`, so *must* and
  *have to* count as different forms. Keyed off the answer the SC would actually
  practise (i.e. the matched alternative when one is hit), not the primary key.
- **`src/components/TenseTagger.jsx`** — the tense name.

Implementation note: `scDue` is computed in `checkAnswer` and carried on the
`feedback` object rather than read at render time, so the flag can't drift if the
student lingers on the feedback panel.

**Decision taken (flagged at the time, agreed):** a *wrong* answer on a repeat form
also skips the SC. The produce step is a teaching move, not a punishment. Easy to
reverse — make `scDue` also true when `result === 'wrong'`.

### `src/components/TenseTagger.jsx` — sets of 10
The bigger change. TT was an endless stream; it's now shaped like MM/CC:
- New `qNum` / `score` state, a Progress/Score bar in the MM/CC visual idiom, and a
  new `finished` phase.
- **The tagging step is the scored step** — 1 point for correct tags, first attempt.
  The C1 function question remains unscored enrichment.
- New `advance()` (next specimen, or the completion screen after 10) replaces the
  old bare `reset()` calls. `restartSet()` backs Try Again; `changeLevel` and
  `clearLock` reset the counters.
- Wrong tags → answer shown as now → "Next →" (was "↻ New sentence").
- Dismissing the SC sheet without passing now advances the set instead of dealing a
  bonus specimen — the item was already scored at the tag step.
- Completion screen mirrors MM/CC exactly: same 🏆/⭐/👍/💪 tiers, green at 7+.
- `tense_attempts` logging and the star-per-passed-production path are **unchanged**,
  so Teacher Dashboard data is unaffected.

**Consequence worth watching:** star income drops, because production now happens
once per tense rather than once per item. In locked "Practise this" mode that means
recognise ×10, produce ×1. I think that's the right drill shape, but it's the one
change a student might notice.

### Suggested test run before pushing
1. One MM set — confirm the second *should* item shows "Next →", not "Your turn".
2. One CC set — same check on a repeated conditional.
3. One TT set to the completion screen — check the counter reaches 10/10.
4. Dismiss a TT Sentence Challenge without passing — it should advance the set.

---

## DB changes (question_bank) — live now, no deploy needed

### 2673–2687 · Spanish image matching (15 sets)
Yesterday's OpenMoji and generated assets reused as-is; filenames are invisible to
students, so no re-upload was needed. `language='es'`, `topic='spanish'`,
tags `['Vocabulario']`, stem *"Match the picture to the correct Spanish word."*
- **2673–2681** (A1, OpenMoji): travel · tickets/map/camera · beach · hotel room ·
  bathroom · electricals · drinks · table items · breakfast.
- **2682–2687** (A2, generated/B2B): housekeeping tools · laundry/waste · appliances ·
  bathroom linen · restaurant service · hotel room realia.

James's lexical calls: **entrada** (not *billete* — the OpenMoji is an admission
ticket), **espray** (not *pulverizador*), both "more typical here". Retained from the
draft: **carta** for the restaurant menu, **tarta**, **tarjeta llave**.

Verified: 45 image references, 0 broken. These carry no `sequence_group`, so they
**do** feed Fix it!

### 2688–2699 · Spanish sound matching (3 groups × 4)
Same locked architecture as the English sets: warm-up → forced discrimination →
meaning capstone. All A2, `language='es'`, `topic='spanish'`,
tags `['Pronunciación']`, `correct_answer='match_all_pairs'`. Instructions in
English, per the ES-track convention (the audience is English speakers).

| Group | Nums | Shape |
|---|---|---|
| `es_r_rr` | 2688–2691 | pero·carro·coro·cerro → **pero/perro + caro/carro** → **coro/corro + cero/cerro** → meanings |
| `es_n_ny` | 2692–2695 | campana·soñar·moño·caña → **campana/campaña + sonar/soñar** → **mono/moño + cana/caña** → meanings |
| `es_stress` | 2696–2699 | habló·canto·llegó·papá → **hablo/habló + canto/cantó** → **llego/llegó + papa/papá** → meanings |

24 ElevenLabs clips in `audio/matching/`. **Multilingual v2 throughout, no phoneme
tags** — Spanish orthography encodes both the trill and the stress, so none of the
English heteronym gymnastics were needed.

Verified: 48 audio references, 24 distinct clips, **0 broken**; all groups have
orders 1–4 with 4 pairs each; no set contains a duplicate clip or duplicate word
(which would make a board unsolvable).

---

## Design decisions locked this session

- **Group id `es_n_ny`, not `es_n_ñ`** — internal identifier kept ASCII to match the
  audio filenames and stay safe in scripts/URLs. The ñ appears correctly everywhere
  the student looks (tiles, explanations). Trivially renameable.
- **Storage filenames ASCII, display text accented**: `campanya.mp3` → "campaña",
  `hablo-past.mp3` → "habló", `papa-dad.mp3` → "papá". Storage keys with ñ/accents
  are unreliable; the DB has no such problem.
- **`topic='spanish'` is mandatory on ES matching rows** — discovered while checking
  routing. `MatchingExercise.fetchCounts()` (the English level-select counts) filters
  on `.neq('topic','spanish')` with **no language filter**, so an ES row tagged
  `topic='pronunciation'` would silently inflate the English counts. The playing-path
  fetch is language-filtered and would have been fine; the counts would not.
- **Audio sets never trigger a Sentence Challenge** — `getMatchingChallengeWord` only
  picks a *text*-type left tile, so pronunciation sets are structurally exempt. Right
  outcome, achieved for free.

---

## Fix it! — investigated, parked (James: "keep it in mind")

Question asked: do MM/CC/TT errors reach Fix it!? **Currently no**, for three
different reasons:

- **MM/CC** — wrong answers *are* written to `student_answers`, but the
  `fixups_queue` RPC has a type whitelist (`gap_fill`, `multiple_choice`,
  `sentence_building`, `odd_one_out`, `error_correction`, plus non-sequence
  `matching`). `modal_chooser` / `conditional_chooser` are excluded deliberately,
  because Fix it! replays through `RandomPracticeExercise`, which can't render their
  bespoke UIs (fixed palette + toggles; per-question tiles).
- **TT** — never touches `student_answers` at all. Recognition goes to
  `tense_attempts`, and specimens aren't bank rows, so it sits structurally outside
  Fix it!

Two routes if it comes back: (a) teach RPE to render both chooser types, then widen
the whitelist — a proper job, not a toggle; or (b) cheaper, bias each new MM/CC set
to serve the student's queued wrong items first, keeping the loop inside the
exercise. TT would need an identity scheme for generated specimens — I'd leave it.

---

## ⚠️ Deploy summary

- **Live now (DB-only):** 2673–2699, all 27 Spanish matching questions.
- **Awaiting push:** `src/ConditionalChooser.jsx`, `src/ModalChooser.jsx`,
  `src/components/TenseTagger.jsx`, plus this handover.
- **Confirm from 15 July:** `scripts/matching-images/*` and `MatchingPairs.jsx`
  (`objectFit: 'contain'`) — check these went up, they were pending at last handover.

---

## 🔥 Near-term cliff — every daily stream ends 31 July (11 days)

All 14 streams run out on the same date, so this is one job, not fourteen:
crossword en A/B/C + es A · wordsearch en/es · wordle en/es · connections en/es ·
spelling bee en/es · word of the day en/es.

Crossword: `python3 scripts/crossword/generate_batch.py --start 2026-08-01 --days N --commit`.
Wordsearch: `scripts/generate_wordsearch.py`, always pass `--seed` explicitly.

---

## Pending / next session

1. **James: push** the three components + this handover.
2. **James: delete the 15 old `matching/*.png`** from the Storage dashboard —
   re-verified this session: still present, still referenced by **0** questions.
3. **OpenMoji attribution** — "Icons by OpenMoji (CC BY-SA 4.0)" somewhere discreet
   (footer / about). Small but licence-required. Carried from 15 July.
4. **Listen-through of 2689 and 2697** — the forced-discrimination rounds are where a
   flat ElevenLabs read would show up, if anywhere.
5. In-class spot-check of the new ES image sets and the reshaped Tense Tagger.
6. Carried forward: 2370 EC batch · `helper verb` → `auxiliary verb` sweep (codebase +
   bank hint/explanation text) · ES GOTD B1+ and ES WOTD B1+ gaps · flashcard rebuild ·
   Spanish Modal Explainer · `api/mark-free.js` consolidated push.

---

## Verified live state (queried this session)

| Metric | Value |
|---|---|
| `question_bank` MAX(question_number) | **2699** — next batch 2700, no gaps |
| Matching questions total | 173 (121 en/both · 52 es) |
| New this session | 27 (2673–2687 image · 2688–2699 audio) |
| Broken asset references across new rows | **0** (93 refs checked against `storage.objects`) |
| Old `matching/*.png` in Storage | 15, all unreferenced — safe to delete |
| All daily content streams | last date **2026-07-31** |

Last question number: **2699**. Always verify live before inserting.
