# CLAUDE.md — Perfect English Portal

Standing context for Claude Code sessions. Read this first.

---

## Project

**Perfect English Portal** (app.perfect-english.org) — a React + Vite + Supabase + Vercel PWA for adult English learners, primarily in Mallorcan hotel and hospitality contexts. Sole developer and teacher/admin: James.

Secondary Spanish track for native-English learners.

---

## Stack

- **Frontend**: React + Vite, PWA via vite-plugin-pwa
- **Backend**: Supabase (Postgres + Storage + Realtime + Auth)
- **Hosting**: Vercel hobby plan (~12 serverless function limit — currently at the cap, consolidation is a parked priority)
- **AI marking**: Anthropic API via Vercel serverless functions (`mark-gap.js`, `mark-free.js`, `mark-correction.js`, `mark-sentence.js`, etc.)
- **Audio**: ElevenLabs for dictation/pronunciation recording; files in Supabase Storage at `audio/dictation/` with convention `quick-[level]-[number].mp3`
- **Local path**: `/Users/james/perfect-english-portal/`
- **Editor**: VSCode (primary, not GitHub web editor)

---

## Supabase

- Project ID: `dyxmgicedabvmsbuvxny`
- Connection: session pooler (`aws-1-eu-west-1.pooler.supabase.com:5432`)
- `$SUPABASE_DB` set in `~/.zshrc`
- Direct connection blocked on non-enterprise plan

---

## Working style (READ THIS)

James strongly prefers:

1. **Propose, confirm, execute autonomously.** After James confirms a plan, execute it — including DB queries, code edits, deployment steps. Do not delegate steps back to James that you can handle with available tools.

2. **Never run destructive or irreversible operations without explicit confirmation.** DELETEs, schema drops, force pushes, mass content rewrites — describe the plan, wait for an explicit "yes" or "go ahead". Count-only duplicate checks before delete are insufficient — always inspect actual content before deleting.

3. **One change at a time.** Small reversible steps over grand unified solutions. Each ship lands on its own. Resist the urge to do too much at once.

4. **Verify before assuming.** Don't claim "X is the case" without checking — query the DB, read the file, run the search.

5. **Direct feedback.** James gives real-device screenshots when they help. Don't ask for screenshots unless the situation is genuinely visual or ambiguous — they consume time.

6. **Handover docs at the end of major sessions.** Format: `HANDOVER_<D_M_YY>.md` at the project root. Covers shipped work, parked work, open questions, content pipeline status, gotchas. **Always read the most recent handover at the start of a session** — it's the running state of the project.

---

## Key files and structure

- `src/components/` — React components (`SentenceChallenge.jsx`, `WordSearchGame.jsx`, `ExerciseList.jsx`, etc.)
- `src/components/ExerciseList.jsx` — Play tab listing, registered in **three places**: `ACTIVE_EXERCISES`, `EXERCISE_ICONS`, `startExercise`. **Title-key drift across these three is the first thing to check** when a Play tile shows a "Soon" badge with the wrong icon, or any similar misbehaviour.
- `api/` — Vercel serverless functions
- `scripts/` — content generation scripts
- `generate_wordsearch.py` — daily puzzle generator pattern; theme banks defined inline (12 EN / 6 ES as of last check; ES bank is thin and flagged for expansion)
- `backups/` — DB backups
- `HANDOVER_*.md` — session summaries at project root

---

## Database conventions

### `question_bank`
- `acceptable_alternatives` is **JSONB**: `'[{"answer":"...","feedback":"..."}]'::jsonb`. `feedback: ""` = green pass; non-empty = amber. Never plain array syntax.
- `tags` is **text[]**: use `ARRAY['tag1','tag2']`. Never JSONB.
- Gap fill questions: `options` is `NULL`. Single blank only — no two-blank questions.
- MC questions: `options` is a JSONB array.
- Error correction: error must be fixable by **exactly ONE tile**.
- Sentence building tiles: lowercase at insertion time, except "I" and proper nouns. Strip `¿` and `¡` from Spanish `correct_answer` fields (tile assembly never produces those characters).
- Phrasal verb gap fills: complete verb+particle in the blank — never split around an object.
- **Always check `SELECT MAX(question_number)` and the target range before insert.** Never assume a range is free.
- Last used question number: **2048**. Next batch starts from **2049**.

### `stars` (unified)
- Columns: `id`, `student_id`, `source`, `subtype`, `context` (JSONB), `awarded_at`
- Sources: `wordle`, `spelling_bee`, `connections`, `wotd`, `gotd`, `topic_practice`, `rpe`, `listening`, `dictation`, `pronunciation`, `matching`, `wordsearch`, `teacher_awarded`
- Anti-farming via `ux_stars_dedupe` partial unique index on `(student_id, source, subtype, (context->>'dedupe_key'))` where `context ? 'dedupe_key'`.
- Writers opt in by including `dedupe_key` in `context`. RPE / `topic_practice` intentionally omit it.
- **`supabase-js` `.onConflict()` cannot target expression-based partial indexes.** Pattern: plain `.insert()` and catch `error.code === '23505'` silently.

### `exercises`
- `title` is the join key across `ExerciseList.jsx`'s three registration points. Drift causes simultaneous "Soon" badge + icon fallback.
- Game tile titles dropped emojis (7 May 2026): `Wordle`, `Connections`, `Spelling Bee`, `Wordsearch`.

### Hints
- **Hint vocabulary must be at or below the level of the question being hinted.**
- Gap fill: three-staged (text → letter count → first letter; third stage forfeits point).
- MC: single-stage.
- Wrong answer → auto-reveal text hint.
- Blue "Correct with a hint" feedback distinguishes from standard green.
- Prefer playful/indirect hints (etymology, domain references) over straight definitions.

### Other
- Spanish tracks stored as lowercase `'spanish'`.
- Level values individual (`'B1'`, not `'B1/B2'`).
- Apostrophes in SQL → `''`.
- `student_answers.question_id` is `int4` (question_number).
- `word_of_the_day.id` is auto-increment — omit from INSERT.
- `spelling_bee_puzzles` has unique constraint on `(play_date, language)` — blocks CASE-statement date swaps.
- Connections inserts via DO block with `RETURNING id INTO p_id`. Always run dup-word check after.
- **RLS enabled with no policies = silent null data**, indistinguishable from missing data. Always verify both RLS status and policy count when debugging missing data.

---

## iOS gotchas

- Input text blue colouring on iOS: add `autoCorrect="off" autoCapitalize="off" spellCheck={false}` plus `WebkitTextFillColor: '#2d3748'` (set explicit `color` for symmetry).
- Same hardening applies to password inputs.

---

## Deployment

- **Supabase changes** take effect immediately.
- **Code changes** deploy via `git push` → Vercel auto-deploy.
- `git pull --rebase` on Mondays after Sunday backup, AND any time `git push` is rejected because the remote has commits the local branch doesn't.
- PWA updates: students need to fully close and reopen the app once after deploy.
- Browser caching: hard refresh (`Cmd+Shift+R`) when testing JS changes.

---

## Useful identifiers

- James's teacher UUID: `bedd04fd-71fe-40ef-a0c1-6390d02ab362`
- Demo / test student María Rodríguez UUID: `1cee5fbd-41ce-4a00-aaf0-9c27eda448d0`

---

## Design philosophy

- Build for students who need **"dignified permission to not know"** — self-confidence and fear of judgement, not level, drive engagement patterns.
- Use **"infinitive"** not "base-verb" in grammar explanations.
- Hints should feel like a friendly nudge, not a failure. Blue "with a hint" feedback respects students who needed help.
- Students don't navigate raw topics directly. Topics are a content-management tool for James; the Learn tab shows ~10 curated cards.
- Flashcards are a structural engagement problem (no return hook, buried in a tab) rather than a concept failure. The app is both a practice and a learning platform.

---

## Bulk operations

- Bulk DB writes: BEGIN/COMMIT transactions of 50–150 rows work well via Supabase.
- For larger imports: psycopg2 from Mac via session pooler.

---

## Chat shortcuts James uses

`q` = question, `qs` = questions, `ss` = students, `git` = GitHub, `sb` = Supabase, `ex` = exercise, `exs` = exercises, `vs` = VSCode

---

## What NOT to do

- Don't create new question numbers without checking `MAX(question_number)` first.
- Don't run DELETE / DROP / mass UPDATE without describing the affected rows first and waiting for explicit confirmation.
- Don't reach for grand unified refactors. James will resist them and he's usually right.
- Don't ask James to do things you can do yourself with available tools.
- Don't introduce new dependencies casually — Vercel function count is at its hobby-plan cap.
- Don't use plain JS array syntax for `acceptable_alternatives` (it's JSONB) or JSONB for `tags` (it's `text[]`).
- Don't assume `acceptable_alternatives` empty-string feedback behaves like populated feedback — empty = green, populated = amber.
