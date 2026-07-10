# HANDOVER — 10 July 2026 (evening) · Recently-seen skip (Tier 1) shipped across all question_bank surfaces

## Why this session

Follow-through on the plan parked in `HANDOVER_9_7_26_evening.md`: the Tier-1 "recently-seen skip" for
the question_bank surfaces. **One DB migration is live; all code changes sit on disk, uncommitted** —
they stack on top of this morning's teacher-sidebar work for a single push.

## The design decision (kills the open question from 9/7)

The 9/7 handover left the window model open: skip *last N items*, skip *last K days*, or *cycle the
whole pool then reset* ("nicest, but needs per-student progress"). Resolution: **the per-student
progress already exists — `student_answers` IS it.** So we shipped the nicest model with zero new
state, as **least-recently-seen ordering** rather than a hard skip:

- Each session serves **never-seen questions first** (shuffled), then previously-seen ones
  **oldest-last-seen first**; the final slice is reshuffled so display order never telegraphs age.
- A fresh 40-row band therefore yields four fully disjoint sessions, then cycles back to the oldest —
  automatic reset, forever.
- Nothing is ever *excluded*, only reordered, so a session can never come up short — the fallback the
  9/7 plan asked for comes free.
- Every failure mode (no user, query error, no history) degrades to today's pure shuffle.

## What shipped

### DB (live now)
- Migration `add_student_answers_student_created_idx`:
  `CREATE INDEX idx_student_answers_student_created ON student_answers (student_id, created_at DESC)`.
  The table had only its pkey; this read is now on the hot path of four exercises (27k rows,
  ~4k/month growth). Verified present. Reversible: `DROP INDEX idx_student_answers_student_created`.

### Code (on disk, for your push)
- **`src/lib/questionFreshness.js` — new.** Two exports:
  - `fetchSeenMap(supabase, { days = 30, limit = 1500 })` → `Map(question_number → last_seen)`.
    One read per exercise start: own rows only (RLS-checked — students have a SELECT-own policy),
    last 30 days, newest-first, capped at 1,500 rows. The window bounds the **query**, not the
    pedagogy: month-old = unseen. The cap covers the heaviest student's month (~1,600/30d) and
    truncates oldest-first, the safe direction.
  - `pickFresh(pool, seenMap, n)` → the ordering described above. Returns the pool's own row objects
    (no cloning), so callers' identity-based `Set`s keep working.
- **`src/ConditionalChooser.jsx`** — seen-map fetched via `Promise.all` alongside the band pool (no
  added latency); `pickFresh(data, seenMap, 10)` replaces shuffle+slice. `classMode` skips the
  history read (teacher previews aren't freshness-shaped).
- **`src/ModalChooser.jsx`** — same treatment. Also **deleted its local `shuffleArray`** (the edit
  orphaned its only call site). `liveTiles` still computes from the full pre-slice band — untouched.
- **`src/components/RandomPracticeExercise.jsx`** — `seenMap` added to the existing `Promise.all`;
  both the per-type `pick` helper and the MC shortfall top-up now route through `pickFresh`.
  **Fix It! is untouched by construction** — its branch early-returns before the pool pick, and its
  whole job is re-showing seen questions. Nice interaction: fixing a question bumps its `last_seen`,
  pushing it to the back of the normal rotation. Dictation/pronunciation out of scope (different
  table, no `question_number`).
- **`src/TopicPracticeExercise.jsx`** — two parts:
  1. **New `recordAnswer` logger.** Correction to the 9/7 plan: TP did **not** already log to
     `student_answers` (only `topic_sessions` + `sc_sentences`). Added the logger mirroring
     `recordChooserAnswer` — called from `checkMC` and from `checkGapFill`'s `finish()` closure, so
     all five gap-fill outcome paths (exact/alternative/informal/fuzzy/AI) log. `is_correct` records
     **raw correctness**, not the hint-penalised point, matching RPE semantics. Side benefit: TP
     rounds now surface on the Teacher Dashboard per-question under "Question bank", like the
     choosers do since 9/7's Ship 1.
  2. Both fetch paths — EN's three level-group branches and `fetchQuestionsSpanish` — now
     freshness-ordered via `pickFresh`, seen-map fetched in parallel.

## Verification done this session

- **esbuild** parse-check passed on all five files (Linux esbuild in the sandbox; repo binary is
  macOS-only as noted 10/7 morning).
- **8 behavioural tests** on `pickFresh` (Node, against the actual module): all-unseen-served,
  oldest-first top-up, full-pool cycling back to exactly the ten oldest, pool < n, n = 0 (RPE mixes
  can zero a type), nullish seen-map, string/number key normalisation. All pass.
- **Byte-compare**: every on-disk repo file matches its sandbox-validated copy exactly.
- All 18 edit hunks applied with unique-match verification (no accidental double-replacements).
- RLS on `student_answers` audited: students SELECT own rows ✓; the existing "Teachers cannot insert"
  policy means a teacher playing outside classMode fails the insert silently inside try/catch — by
  design, no pollution.

## Test checklist (after your push — runtime-only bits)

1. **Modal Match twice back-to-back as María** — second round should be a near-fully different ten
   (Advanced band = 40, her history there is thin).
2. **One Topic Practice round as María** — confirm it appears in her Activity/Mix ("Question bank"
   surface). This is TP's per-question logging debut.
3. **RPE**: a normal round works; **Fix It!** still serves the queue in order.
4. **Browse → 🧠 Grammar tools** in classMode: CC/MM launch, write nothing, and show an ordinary
   (non-freshness) shuffle.

## Gotchas / notes

- **Freshness ramps up where logging is new.** RPE has months of `student_answers` history — it feels
  different immediately. CC/MM only started logging with 9/7's Ship 1 and TP starts with this push,
  so day one behaves like today and improves as history accrues. Expected, graceful.
- The 9/7 note stands: if any band ever grows into the hundreds, move the sample server-side. The
  freshness read itself is already bounded regardless of pool size.
- If the seen-history read ever needs to shrink further, the upgrade path is a tiny security-invoker
  RPC doing `GROUP BY question_id` server-side (one row per distinct question, and could return
  last-attempt correctness for a "wrong ones resurface sooner" refinement). Not needed at current
  volumes.

## Standing state

- `question_bank` MAX(question_number) = **2641**, verified live this session (next batch **2642**).
  The 10/7 morning handover's "2369" was itself stale — the always-check-live rule keeps winning.
- Vercel serverless functions: **8/12 (unchanged)** — no new API routes.
- Teacher UUID `bedd04fd-71fe-40ef-a0c1-6390d02ab362`; María demo student
  `1cee5fbd-41ce-4a00-aaf0-9c27eda448d0`.

### Carried-forward backlog
- **New Matching content — priority next week** (per 9/7 evening). Matching was also the one Tier-2
  freshness candidate worth doing; new content first, then the same `pickFresh` treatment is trivial
  if wanted.
- First-draft pedagogical review: the 135 CC/MM rows (2507–2641) in TeacherBrowse; Conditionals
  cards/questions; `watchOut` lines in `tenseExplainEn.js` / `tenseExplainEs.js`.
- "helper verb" → "auxiliary verb" codebase + question-bank sweep.
- Tense engine Phases 2–4; Spanish Modal Explainer; Spanish GOTD B1+ / ES WOTD B1+.
- Flashcard rebuild (long-standing). GET21 B2B. Irregular Verbs push (title rename confirmation).
- Marker tuning (two known biases). Monthly content top-up across daily surfaces.

## One-line state

Least-recently-seen ordering is live in code across RPE, Topic Practice, Conditionals Chooser and
Modal Match (with TP now logging per-question answers), backed by a new `student_answers` index;
everything sits uncommitted on disk with this morning's sidebar work, ready for one push.
