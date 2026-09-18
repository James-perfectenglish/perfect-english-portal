# HANDOVER — 18 September 2026

A review-and-fix session rather than a feature session. The app was assessed as a
whole (handovers, code, live usage data), a prioritised list was agreed, and
items 1, 2, 4 and 6 of it were done. Three commits, all in `main`:

- `Wordle double-Enter guard; PWA prompt-mode update banner`
- `Stamp context on student_answers inserts`
- `Practice stars for RPE and topic sets; Progress page star buckets`

Plus database work with no code: the asterisk strip, the `context` column,
Lyrics Mixer archived. Everything below was re-verified against the live DB and
the filesystem before writing. James is moving house — expect a gap before the
next session.

## 1. What the usage data says (the basis for the priorities)

Queried 16 Sep, teacher UUIDs excluded, last 30 days unless stated.

- **65 approved accounts, 13 active, 5–8 carry nearly everything.** Jon alone
  produced 3,643 of 5,255 practice answers. Roughly 45 accounts never did
  anything or went quiet by spring. Three new students joined in September
  (Marina Tur B1, Alejandro Guerrero B2, Toni Coll B2) — all with `tracks: []`,
  so no "For You" section and the full unfiltered catalogue.
- **The daily games are the engagement engine.** Wordle 283 stars, Crossword
  171, Spelling Bee 134, Wordsearch 122, Connections 62. WOTD/GOTD/PVOTD reach
  11 students. Listening 3, Dictation 3, Pronunciation 0, Matching 0, Real
  Talk 0 first-opens in 60 days.
- **Practice answers were unattributable.** `student_answers.exercise_id` is a
  `gen_random_uuid()` default on every surface, `input_method` was never set.
  Fixed — section 4.
- **The star economy paid nothing for practice.** Carolina: 264 stars, 0
  answers. Jon: 3,643 answers, 8 practice stars. Fixed — section 6.
- **Duplicate accounts:** Carolina, Stuart Barr, Javier Pastor, Alejandro
  Guerrero, Laura Tomillo — one pair each. Not touched.

`exercise_opens` records only the *first* open per student per title, so it
measures discovery, not use. Renamed tiles ("Wordle 🟩") leave orphan rows that
re-fire the NEW badge.

## 2. October content — done by James, verified

Every daily stream now ends **31 Oct 2026**: Wordle, Spelling Bee, Connections,
Wordsearch, WOTD (both languages), Crossword (all four tracks). On 16 Sep the
four games and WOTD all ended 30 Sep — fourteen days of runway on the most-used
features. A runway indicator on the Teacher Dashboard was suggested and is
still open (section 9).

## 3. Three quick fixes

**Asterisk strip.** The July batch (2370–2641) used markdown: `**bold**` in 272
explanations, `*italic*` in 99 of those, plus `*italic*` in 63 hints (35 in
that batch, 28 older, back to q114), 2 `hint2`, and 55 `acceptable_alternatives`
feedback strings. Explanations render as plain text (`💡 {feedback.explanation}`
in `RandomPracticeExercise.jsx`), so 523 answers had shown literal asterisks to
7 students since 9 July. Decision: **strip, don't render** — matches the
plain-text convention and would otherwise mean touching every component that
shows hints or explanations. Two-pass `regexp_replace` (`**x**` then `*x*`),
one column at a time, jsonb rewritten per element with order preserved.
Verified read-back: zero asterisks in all four columns, alternatives arrays
unchanged in length/order/`answer`, every text column equal to a plain removal
of asterisks and nothing else, 3,113 questions as before. Originals in
**`question_bank_emphasis_backup`** (302 rows) if a renderer ever arrives.

**Wordle double-Enter.** `submitGuess` read `locked` from a closure frozen at
first render, so the guard only worked for on-screen taps. Now `lockedRef`
(written synchronously, read fresh whichever keyboard the Enter came from), and
the cleared row + new guesses are mirrored into `stateRef` immediately rather
than waiting for the sync effect, because a second Enter can land before the
next render.

**PWA update banner.** The config already had `skipWaiting`/`clientsClaim`, but
the plugin's injected `registerSW.js` was the bare one-liner — register on
`load`, never check again — and a standalone PWA rarely loads, it resumes.
Switched to `registerType: 'prompt'` with **`src/components/UpdateBanner.jsx`**
(new): registers the worker, calls `registration.update()` on every
`visibilitychange` and hourly, shows a purple "New version ready — tap to
update" pill above the bottom nav, reloads only on the tap. Mounted in `App.jsx`
outside the router so the login page gets it too. The explicit
`skipWaiting`/`clientsClaim` lines were **removed** — verified in the plugin
source that prompt mode passes the workbox block through untouched, so leaving
them would have defeated the banner. Verified on a real `vite build` with the
exact config: no `registerSW.js` emitted, `sw.js` carries the `SKIP_WAITING`
listener with no top-level `skipWaiting()`, client bundle has the prompt branch
with the auto-reload branch compiled out. Devices on the old worker need one
more cold start to reach this build, as with every deploy so far; after that,
resuming is enough. **Never re-add `skipWaiting`/`clientsClaim`.**

Also: `mcp__Filesystem__write_file` **does** create new files now. The old
"cannot create files / use `move_file` workaround" note is obsolete.

## 4. `student_answers.context` — answers are attributable

Nullable text column, added 18 Sep (by James in the SQL editor — see section
8). Eight writers now stamp it: `practise` / `fixit` (RandomPracticeExercise
chooses by whether a fixups queue was passed), `topic` (TopicPracticeExercise,
which also sets `exercise_id` to the real `exercises` row — the one surface
with one to point at; omitted rather than nulled when absent so the default
still applies), `modal_match`, `conditionals`, `error_correction`,
`odd_one_out`, `auction`, `survival`. SentenceBuilding does not log to this
table. Null = before 18 Sep; nothing backfilled. Three rows carried a value
within hours of deploy, so it's live. Any new surface that logs answers must set
it. **Never join `exercise_id` to `exercises` except for `context = 'topic'`.**

## 5. Lyrics Mixer removed

`exercises.category` set to `'archived'` for that row. `ExerciseList` only shows
rows whose category matches the active tab, so the tile is gone from student and
teacher lists with no code change; the row and the `/lyrics` route survive;
reverse with one UPDATE. Exclude `category = 'archived'` when counting or
listing exercises.

## 6. Practice stars, and the Progress page

**The schedule as found** (60 days of actual awards): Wordle pays `7 − N` for a
win in N guesses (`solve_6`…`solve_N`, one row each) plus a sentence star;
Crossword 1 + star word + sentence; Wordsearch and Connections the same shape;
Spelling Bee pangram + milestones + sentence; dailies 1 each; Tense Tagger 1 per
production. **Practise, Fix it!, Topic practice and the choosers awarded
nothing** — their only stars came through the shared sentence challenge. The
Wordle tiers are *not* the outlier: only 27 of ~215 tiered stars came from wins
in three or fewer. Left alone.

**What was built.** `rpe` and `topic_practice` now award `set_complete` on
finishing and `set_pass` on passing — RPE at 70%+, topic practice at the
exercise's own `passing_score` (default 7/10, what `topic_sessions.passed`
already uses). Once per level per day for Practise (`practise:<levelKey>:<date>`),
once per day for Fix it! (`fixit:fixit:<date>`), once per topic per day
(`topic:<topic>:<date>`), all via the existing `ux_stars_dedupe` index, 23505
swallowed. **Rows are inserted one at a time, never batched** — a batch is
all-or-nothing, so a morning finish-but-fail would block an afternoon pass star.
The results screens (both RPE branches, topic practice) show ⭐⭐ / ⭐ with a
nudge / "already banked today", state `null` until checked and reset on every
new set. On last month's data the cap pays Jon 26, Natalia 22, Belinda 12,
Carmen 12 — comparable to a games player, not farmable. No DB change was
needed. Zero rows so far: that commit is the newest.

**Progress page.** `bySource` bucketing previously named only Wordle, Spelling
Bee, Connections, WOTD, GOTD and Teacher and lumped everything else — including
Crossword, the second-biggest source — into "✍️ Sentences". Now `NAMED` (adds
Crossword ✜, Wordsearch 🔎, Phrasal verb, Tenses 🏷️) and `PRACTICE` (every
practice surface → one ✏️ Practice tile), with `other` still catching anything
new. Caption now leads with practice sets. **A new star source must be added to
one of those two lists or it lands in "Other".**

Two things James did not answer and which stand as built: whether 70% is the
right RPE pass mark (Marina and Toni completed five sets between them and
passed none — the completion star was the argument for a star just for
finishing), and whether Tense Tagger's one-per-production should join the daily
cap.

## 7. Items reviewed and explicitly deferred

- **3 — Onboarding for GET21.** Set level + tracks at approval in one step; a
  "start here" card for students under ~50 answers; signup check for existing
  accounts. **Waiting on James's conversation with GET21**, expected within two
  weeks, before the house move.
- **5 — Listen / Speak.** James needs to make new listenings (house has taken
  the time). Speak he likes but wants a way to make it enticing before doing
  anything. Teacher activity is excluded from every query, so class-only use of
  either is invisible — worth knowing before hiding tiles.
- **Tense Tagger engine work and the crossword B1/B2 split** — paused in favour
  of the funnel work above; both remain in earlier handovers.

## 8. Tooling note — the Supabase connector

Mid-session every Supabase write (`execute_sql` and `apply_migration` alike)
returned "no approval received" for about ten minutes, then recovered on its own
after James ran the `ALTER TABLE` by hand in the SQL editor. Nothing changed on
this side. Running DDL in the SQL editor is a fine fallback. The ordering hazard
it can create: code that names a column before the column exists makes PostgREST
reject every insert, and every `student_answers` writer is fire-and-forget in a
try/catch, so answers would silently stop being logged. Column first, code
second, always.

The Chrome extension was not connected this session; the review was done from
code and data. A visual pass of the results screens and the Progress tiles after
deploy is still worth two minutes.

## 9. Open

- **Crossword B recalibration check, ~25 Sep** — A and C as controls,
  `hints_used` over `completed` as the early signal. The B1/B2 split is parked
  on this.
- **Content runway indicator** on the Teacher Dashboard ("Wordle: 14 days
  left"). Every stream is one query; the Sept cliff was found by accident.
- **Spanish gap-fill clues** (166 words) — ~20 minutes of fluent review, no UI
  or generator change.
- **Star words repeat across generator runs** — seed `stars_seen` from the last
  60 days.
- **Spelling Bee post-100 UX.**
- **`exercise_opens` orphan titles** from renames re-fire NEW badges.
- **Duplicate accounts** (section 1) — merge or a signup check.
- **Memory file** says last question number 2048; CLAUDE.md's 2641 is correct.
- The nine stripped `hint`/`hint2` rows outside the July batch (q13, q35, q114…)
  had used `*italic*` since much earlier — if the house style ever wants
  emphasis, the backup table is the source and the render sites are the cost.
