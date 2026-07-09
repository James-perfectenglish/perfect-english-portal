# HANDOVER — 9 July 2026 · Teacher visibility: Modal / Conditional / Tense consistent everywhere

## Why this session

You asked two questions: (1) are **all surfaces scraped** into the Teacher Dashboard — crosswords in
particular — and (2) are the recently-built **Modals / Conditionals / Tense** exercises **displayable in
Teacher Browse**. The audit turned up one real data gap, which drove three code ships. **No DB changes
this session — all code, ready for your push.** Nothing committed; the changes sit on disk.

## What the audit found (verified live against Supabase)

- **Crosswords ARE scraped.** The dashboard's Activity / Mix / Success / Last-active columns all come
  from the `student_overview()` RPC, which reads the **`student_activity` view** — a `UNION ALL` across
  ~21 surfaces including Crossword (`crossword_scores`), Wordsearch (`wordsearch_scores`), Spelling Bee
  (`spelling_bee_scores`), Wordle, Connections, **Tense Tagger** (`tense_attempts`), Sentence Challenge
  (`sc_sentences`), GOTD, PVOTD, WOTD, Flashcards, etc. Live: Crossword = 248 activity events + 532
  stars, current. The "Stars this week" leaderboard also has a dedicated Crossword column. So crosswords
  are covered end-to-end.
- **The real gap: Modal Match + Conditionals Chooser were invisible to the dashboard.** Their content
  lives in `question_bank` (77 `modal_chooser` + 60 `conditional_chooser` rows), but the choosers only
  scored locally + harvested the *produce* step to `sc_sentences`. The **choose step wrote nothing** —
  `student_answers` had **0 rows** in both question ranges, there's no dedicated attempts table, and
  they're absent from the `student_activity` view. Only stars fired (73 modal, 15 conditional), lumped
  into the leaderboard's generic "✍️" column. Tense Tagger, by contrast, was already captured
  (`tense_attempts` → 330 events).
- **Teacher Browse:** modal/conditional rows leaked into "All / Questions" results but rendered
  half-broken (blank type badge, no working student preview, not in the Type filter). **Tense had zero
  presence** — its content is in `tense_specimens`, which Browse never queried.

## Ship 1 — Modal / Conditional now count on the dashboard

- **`src/ModalChooser.jsx`**, **`src/ConditionalChooser.jsx`** — `checkAnswer` now logs each choose-step
  attempt to **`student_answers`** via a new `recordChooserAnswer(question, studentAnswer, isCorrect)`
  helper, mirroring `RandomPracticeExercise`'s exact shape (`student_id`, `question_id =
  question_number`, `student_answer`, `correct_answer`, `is_correct`). Fire-and-forget, try/catch, one
  insert per answered question. They're `question_bank` rows, so they flow into `student_activity` →
  the dashboard automatically under the **"Question bank"** surface. No schema/view change needed.

## Ship 2 — Modal / Conditional first-class in Teacher Browse

- **`src/TeacherBrowse.jsx`** — added `modal_chooser` + `conditional_chooser` to the top-level
  `TYPE_INFO` (badge + Type filter), and a dedicated `InteractiveQuestion` preview branch:
  conditionals render as an **interactive tile-pick** (their rows carry four `options`), modals as a
  **reveal** (all 77 rows have empty `options` — the live app uses a fixed palette, so there's nothing
  to tile). Both excluded from the generic feedback/Check footers so the branch owns its own UI.
- **`src/components/BadgePill.jsx`** — matching `TypeBadge` entries (🎛️ Modal Match / 🔀 Conditionals).
- **`src/Progress.jsx`**, **`src/TeacherDashboard.jsx`** — added the two labels to each file's local
  `TYPE_INFO` so they read correctly in the student Progress breakdown and the dashboard's flagged-
  question panel (both places these types can now surface).

## Ship 3a — no-write "class mode" on the practice tools

Prerequisite for launching the tools in Browse without polluting data as you (the games do this via a
`classPuzzle` prop; the grammar tools had no equivalent). Added a **`classMode` prop (default `false` =
zero behaviour change)** that short-circuits every write:

- **`src/components/TenseTagger.jsx`**, **`src/components/TenseTaggerES.jsx`** — guards `logAttempt`
  (`tense_attempts`), `awardStar` (`stars`), `harvestSentence` (`sc_sentences`).
- **`src/ModalChooser.jsx`**, **`src/ConditionalChooser.jsx`** — guards `recordChooserAnswer`
  (`student_answers`) + `harvestModalSentence` / `harvestConditionalSentence` (`sc_sentences`), and
  passes **`noStars={classMode}`** to the child `SentenceChallenge` (which already had a `noStars` prop
  built for exactly this). The taggers already ran SC `noStars`.

## Ship 3b — "Grammar tools" launcher in Teacher Browse

- **`src/TeacherBrowse.jsx`** — new **🧠 Grammar tools** entry in the Content group. A static launcher
  list (no DB) that respects the Language filter and opens the real component in a **Class-Play overlay
  in `classMode`**, mirroring the games' overlay pattern:
  - EN: Tense Tagger, Modal Match, Conditionals Chooser, Tense Explainer, Modal Explainer,
    Conditionals Explainer.
  - ES (under the 🇪🇸 filter): Tense Tagger, Conditionals Chooser, Tense Explainer, Conditionals
    Explainer. (No ES Modal — component doesn't exist yet.)
  - Practice tools get `classMode` (+ `onBack`/`language` where they take them); the five **Explainers
    are read-only and were not edited** — launched as-is with a no-op `onPractise`.
  - Added `import`s for the nine components, `'grammar'` to `CONTENT_SOURCES`, a `grammarFocus` state,
    the `search()` branch, the sidebar entry, the results card, the `handleItemClick` case, the
    overlay, and a `filters.source !== 'grammar'` guard on the date-range filter.

## Validation

Every touched file passed esbuild (`--format=esm --loader:.jsx=jsx`). Beyond syntax, I bundle-resolved
**TeacherBrowse's full local import graph** (`--bundle --packages=external`) and the **whole app from
`src/main.jsx`** — both clean, confirming all nine new imports resolve, export a default, and nothing
in the tree broke.

## Test checklist (after your push — the runtime-only bits)

1. **Dashboard capture** (demo student María): play one **Modal Match** round → confirm it appears in
   her Activity total / Mix / Last-active. Same for **Conditionals Chooser**. (Pre-push, both were
   invisible.)
2. **Browse — Questions**: filter Type → **Modal Match** / **Conditionals**; badges show, cards render.
   Student-preview: conditionals let you pick a tile with correct/incorrect feedback; modals show a
   **Show answer** reveal (answer + alternatives + explanation).
3. **Browse — 🧠 Grammar tools**: open each launcher. Practice tools run; **confirm they write nothing**
   as you (no new `stars` / `student_answers` / `tense_attempts` / `sc_sentences` on your teacher UUID).
   Switch the Language filter to 🇪🇸 and confirm the Spanish tools list + launch.
4. **No student regression**: a *normal* (non-classMode) Modal Match/Conditionals round still awards its
   star via SentenceChallenge and now also logs the choose step — both expected.

## Gotchas / notes

- **The choosers now write to `student_answers`** — they must only ever run on a student's own account.
  The `classMode` guard is what keeps the Browse launchers clean; **keep it intact** if you refactor.
- **Star-leaderboard bucket** (`TeacherDashboard.fetchStarsLeaderboard`) still lumps `pvotd`,
  `modal_match`, `conditional_chooser`, `tense_tagger`, `topic_practice`, `rpe` into the single "✍️"
  (`other`) column. Cosmetic, not a capture gap — flag if you want dedicated columns later.
- **Redundant legacy code** (not touched): `TeacherDashboard.fetchAllData` still hand-unions a subset of
  session tables for `lastActive` (omits crossword/wordsearch/spelling-bee/gotd/pvotd), but the RPC's
  `last_active` backfills it, so the table is correct. Safe to simplify one day.
- **Considered but not done:** a read-only `tense_specimens` browse. You chose full Class-Play launchers
  instead (Ship 3b), which supersedes it.

## Question bank

- **Last used number: 2506 (unchanged).** No inserts or content edits this session. Next batch → 2507.
- Vercel serverless functions: **8/12 (unchanged)** — no new API routes.

## Queued next (carried forward)

- "helper verb" → "auxiliary verb" codebase sweep
- Tense engine Phases 2–4 (`scripts/generate_tense_specimens.mjs` — you run locally); `practisable: true`
  engine support for the new ES tenses
- Spanish Modal Explainer · GET21 B2B org structures · flashcard rebuild · Spanish GOTD B1+
- Irregular Verbs push still pending (title rename confirmation)
- First-draft content review: Conditionals cards/questions, `watchOut` lines in `tenseExplainEn.js` /
  `tenseExplainEs.js`
