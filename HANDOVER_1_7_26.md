# Handover — 1 July 2026

## This session: Teacher Dashboard redesign — activity data layer, per-student panel, usage map, rebuilt student table

The dashboard previously read almost entirely from `student_answers` (written question types) plus a narrow "passed" aggregate, so a games-only student looked idle and ~20 activity surfaces went uncounted. This session built a unified activity data layer and three features on top of it: a per-student detail panel, a product-level usage map, and a rebuilt student table. Public/private modes were collapsed into one view.

Everything is built and validated (JSX parses via esbuild). **The database layer is live**; the **code changes need James's push + deploy + PWA refresh**. James is sitting with it before iterating.

---

## Database (live via MCP — no migration step for James)

All objects are `security_invoker` / `SECURITY INVOKER`. **Caveat:** MCP runs as the service role and bypasses RLS, so the authenticated-teacher read path is only verifiable **in-app**. The existing dashboard already does cross-student reads on these base tables, so it's expected to work; if the panel / usage map / table come up empty for the teacher, it's a base-table read policy, not the views.

- **`clean_surface(text)`** — immutable helper; strips emoji/symbols and collapses whitespace. Used where a surface label comes from data (exercise titles carry emoji, e.g. "Vocabulary 📒").
- **`student_activity`** (view) — the spine. One row per activity event, unified across 22 surfaces: `student_id, category, surface, occurred_at, is_success, score`.
  - `is_success` is **tri-state**: boolean where a right/wrong exists; `null` + a `score` for score-only surfaces (Spelling Bee, Word Snake, Blurt, Sentence Auction, Lyrics); both `null` for pure-effort surfaces (Memory, Flashcards).
  - Three tables key on **`user_id`** (aliased to `student_id`): `crossword_scores`, `spelling_bee_scores`, `wordsearch_scores`.
  - Exercises are **answer-grain** from `student_answers`. `topic_sessions` and `student_attempts` are **deliberately excluded** as event arms — topic-practice answers already live in `student_answers`, so counting the session too would double-count.
  - `answered_at` (naive timestamp) is cast `AT TIME ZONE 'UTC'`; wordle/connections use `COALESCE(completed_at, play_date)`.
- **`student_activity_summary`** (view) — `student_activity` grouped by `(student_id, category, surface)`: `events, last_active, success_count, graded_count, scored_count, avg_score, best_score`. Powers the panel (filter by student) and could back the usage map.
- **`daily_sentence_feed`** (view) — unifies the three daily-prompt submission tables (WOTD + GOTD + PVOTD) with their parent prompt: `student_id, prompt_type (word|grammar|phrasal), prompt, prompt_detail, level, language, sentence, is_correct, is_soft_pass (WOTD only), ai_feedback, submitted_at`. This is the PVOTD/GOTD fold-in James asked for. **Currently only the panel consumes it** — see Outstanding #5.
- **`usage_map(p_days int DEFAULT NULL)`** (function) — per-surface rollup, windowed (`null` = all time): `category, surface, events, students, success_pct, scored_avg, last_active`. Powers UsageMap's All-time / Last-30-days toggle.
- **`student_overview()`** (function) — per-student rollup: `total_events, events_7d, events_30d, success_pct, last_active`, plus `cat_exercises / cat_speaking_listening / cat_games / cat_daily_prompt / cat_flashcards` counts. Feeds the rebuilt table columns.

To remove the whole layer: `DROP VIEW daily_sentence_feed, student_activity_summary, student_activity; DROP FUNCTION usage_map(int), student_overview(); DROP FUNCTION clean_surface(text);` (drop views before the function they depend on).

---

## Code (built + validated — needs push/deploy/refresh)

### New files
- **`src/components/StudentPanel.jsx`** — click any student row → slide-over. Header (level, last active, total activities, overall correct %), a category-mix bar, then each of the five categories broken down surface-by-surface (`count · last active · %` where graded / `avg N` where score-only / nothing for effort), then their recent daily-prompt sentences with AI feedback, colour-coded by pass/fail and badged word/grammar/phrasal. Fetches `student_activity_summary` + `daily_sentence_feed` by `student_id`.
- **`src/components/UsageMap.jsx`** — collapsible product-level section under the table. **All-time / Last-30-days** toggle (reswitches bar sizing), per-category surface rows with volume bar, reach (student count), success% or ~avg score, last-active, and a **"dormant" tag** on anything with zero activity in 30 days. Calls `usage_map(null)` + `usage_map(30)`.

### Modified file — `src/TeacherDashboard.jsx`
- Imports both new components; renders `<UsageMap />` beneath the table.
- **Rows are clickable** → open StudentPanel (`viewingStudent` state). Award-star button uses `e.stopPropagation()` so it doesn't also open the panel.
- **Public/private collapsed into one always-on table.** `privateMode` removed. Replaced by a lightweight **"Hide names"** toggle (swaps names → initials for screen-share). CSV export is now always available (and keeps real names regardless of Hide-names, since it's for records/reports).
- **New columns:** Student (with dropoff dot) · Level · **Mix** (`MixBar`) · **Activity** (all surfaces) · **Last 7d** · **Success** (all graded surfaces) · Last active · ⭐. Retired: Questions, Passed, Best Type, Worst Type (depth now lives in the panel).
- `fetchAllData` merges `student_overview()` into each student (`activityTotal, events7d, events30d, successAll, mix, dropped`) and now sets `lastActive` from the activity view via `latestOf` — so it reflects **all 22 surfaces**, not the nine the old client-side calc checked.
- `MixBar` component + `MIX_CATS` added (thin 5-segment category bar). `exportCSV` rewritten to the new columns.
- **Dropoff dot** (amber, beside name): `activityTotal >= 20 && events7d === 0 && 7 <= daysQuiet <= 60`. Thresholds inline in `fetchAllData`, easy to tune.

---

## Architecture notes / gotchas

- **`student_answers.exercise_id` is essentially unpopulated** — answers carry `question_id`, not `exercise_id`. So all question work collapses into a single **"Question bank"** surface in the view. Per-pack/topic granularity was **deferred by decision (whole for v1)**; when wanted, join `question_id → question_bank` and group by `topic` (or `type`), not `exercise_id`.
- **No time-on-task data.** Session tables store only `completed_at` (no start), so all metrics are **frequency/volume**, not minutes. Parked deliberately — even a start+end pair can't distinguish focus from a tab left open.
- **`exercise_opens` is reach-only** (records first opens per student, not frequency) and has emoji **title drift** ("Wordle 🟩" vs "Wordle"). It is **not** used for the usage map — usage is driven off the session tables via `student_activity`. `clean_surface()` handles drift where data-derived names appear.
- **Class Accuracy summary card** still reflects question-only accuracy (unchanged); the table's **Success** column is all-graded. They measure different things by design — align later if it confuses.
- Editing pattern held: `dryRun` on every `edit_file`, whole-file `write_file` for the two new components, esbuild parse-check after each change.

---

## Outstanding / next

1. **Observe before iterating.** James is sitting with the redesign to see how it reads against real people.
2. **Tune the dropoff dot** (20+ lifetime / quiet 7d / 60d cap) once watched for a few days — may be too trigger-happy or too quiet.
3. **Deferred:** per-pack / per-topic breakdown of the "Question bank" surface (v1 keeps it whole).
4. **Parked (future, B2B):** segment students by **employer / course** for progress reports to the orgs paying for courses (ties to the GET21 channel). Data is already per-student; needs an `employer`/`course` field on `profiles` + group/filter in the table and CSV.
5. **Optional:** rewire the dashboard's existing **Word-of-the-Day section** to the unified `daily_sentence_feed`, so GOTD + PVOTD sentences surface there too (the view exists; only the panel uses it so far).

### Standing state (carried, verified 30 Jun)
- **`question_bank` MAX(question_number) = 2369** → next content batch starts at **2370**. (Always re-verify live at session start.)
- Legacy markers unchanged: 888–907 = A2 Spanish MC; 908–910 = A2 Spanish sentence_auction.
- Daily-puzzle surfaces topped up to end of July 2026.
- **Tense Explainer content pass still open** (30 Jun): review `watchOut` + `uses` examples in `tenseExplainEn.js` / `tenseExplainEs.js`.

### Carried-forward backlog
- Spanish GOTD: B1/B2 and C1/C2 tracks still empty (only A1/A2).
- ES Word of the Day: B1+ tracks still A-level only.
- Flashcard rebuild (long-standing).
- Error Correction batch from Q2370 onward.
- Marker tuning: two known biases (over-strict on correct concise answers; under-strict on errors outside the target word).
- Monthly content top-up cadence: all surfaces should end on the last day of the month.
