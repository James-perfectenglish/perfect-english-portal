# Handover — 3 July 2026

## This session: "Fix it!" mistake-review loop — built, live; plus RLS hardening, Modal Match feedback fix, and small polish

Two headline pieces of work. First, a **security fix** on `profiles`. Second, and the main build: **Fix it!** — a personalised mistake-review mode that replaces the under-used Weak Spots. It resurfaces a student's *own* past wrong answers and lets them clear them. Also: Modal Match now shows its result screen before the Sentence Challenge, the "watch out" emoji is unified to 👁️, and the two Explainers now sit together at the top of Learn.

Everything below is applied to disk (files) or live (DB). **Not committed** — git is James's to run. esbuild validated on every JSX file touched.

---

## 1. Security: `profiles` RLS tightened  ⚠️ was wide open

**The hole:** `profiles` had `UPDATE ... USING (true) WITH CHECK (true)` for `public` — **any authenticated student could update any profile row**, including `is_teacher` and `approved`. SELECT was also `public/true` (readable by `anon`).

**Migration `tighten_profiles_rls` (applied):**
- SELECT → `authenticated` only (was public).
- UPDATE split into two policies: `Users update own profile` (`auth.uid() = id`) and `Teachers update any profile` (`is_teacher()`).
- New `public.is_teacher()` — `SECURITY DEFINER`, `stable`, `search_path=public`, `EXECUTE` revoked from `anon`. Reads the caller's own `is_teacher` without RLS recursion.
- New trigger `protect_profile_flags` (BEFORE UPDATE): if the caller is a non-teacher authenticated user, `is_teacher`/`approved` are frozen to their OLD values even on their own row. Service role (`auth.uid()` null, e.g. `handle_new_user`) is untouched, so signup still sets flags.
- `EXECUTE` on `handle_new_user()` revoked from `anon, authenticated` (it's a trigger fn; nobody should call it via REST).

Verified James's teacher row still has `is_teacher=true, approved=true`, so teacher flows are intact.

**Other advisories still open (noted, not actioned):** leaked-password protection off in Auth (one toggle in dashboard); `word_snake_rooms` has always-true insert/update policies; `snake_add_word_to_class` is `SECURITY DEFINER` callable by `anon`; `crossword_clue_bank` + `sentence_tags` are RLS-enabled-no-policy (believed intentional, service-role-only — confirm).

---

## 2. Fix it! — the mistake-review loop  (replaces Weak Spots)

### The idea
Weak Spots served *random questions of a student's weakest type* — indistinguishable from normal practice, with no sense of progress, so nobody used it. Fix it! instead serves **the exact questions a student got wrong before**, shows them **what they wrote last time**, and lets them **clear** each mistake. The box empties. It works retroactively — every student's queue is already populated from historical `student_answers` (26k rows) the moment it ships.

### The rules (agreed with James)
- A question enters the queue on a **real wrong answer** (`is_correct=false AND is_soft_pass=false`). Soft passes never enter — the marker already showed grace.
- It **retires** after correct answers on **2 distinct days** *after* the most recent wrong answer.
- **Not re-shown the same day** it was last answered (forces the second correct answer onto a different day — the spacing that makes it meaningful).
- Serve **up to 8 per day**, **most-recent mistakes first**, **90-day lookback**.
- The visible count is only what's *ready today* — a student with 284 lifetime mistakes (Belinda) never sees a demoralising pile.

### How it's built — no new table, no new write path
- **Migration `fixups_queue_rpc` (applied): `public.fixups_queue(p_limit int default 8)`.** `SECURITY INVOKER` (runs under the caller's RLS — student sees only their own answers), `stable`, `search_path=public`. Derives the queue live from `student_answers` via CTEs (mistakes → fixes-since → last-seen → last-wrong-text). Returns `question_number, qtype, language, level, topic, last_wrong_answer, last_wrong_at, fixes_so_far`. `EXECUTE` revoked from `anon`, granted to `authenticated`.
  - Type filter in the RPC: serves `gap_fill, multiple_choice, sentence_building, odd_one_out, error_correction`, and non-sequence `matching`. (Dictation/pronunciation deliberately excluded — no clean single-answer replay.)
- **Review answers are recorded like any other answer** — the existing `student_answers` insert in `RandomPracticeExercise` closes the loop. Answer a fix-up right twice on separate days and the RPC stops returning it. Self-cleaning.

### Files
- **`src/components/RandomPracticeExercise.jsx`** — new `fixups` prop. When non-empty: fetches exactly those `question_number`s from `question_bank`, plays them **in queue order** (shuffling only MC/OOO options), and **skips** the normal random-mix build, dictation/pronunciation, and Sentence Challenge injections. Fix it! title/subtitle/back-label. A **pre-answer amber banner** shows "🔧 Last time you wrote: ~~…~~" *before* the student answers (James's call — turns a memory test into error-noticing). A **post-answer status line**: "Right once — …" / "🔧 Fixed! …" / "Back in the box …".
  - **Gotcha fixed:** the fixup↔question join uses `Number(f.question_number) === Number(currentQuestion.question_number)` — PostgREST returns the RPC's ints as strings, strict `===` silently failed and the banner never rendered. Classic bigint-as-string trap.
- **`src/components/PracticePage.jsx`** — `?mode=fixit` replaces the old `?mode=weakspots&weak=…`. Calls `supabase.rpc('fixups_queue')`, shows a loading state, the exercise, or the **"All fixed!" empty state**. All weakspots/weakTypes machinery removed.
- **`src/StudentDashboard.jsx`** — the Weak Spots card is now **Fix it!** with a live count badge (calls `fixups_queue`, shows `data.length`). Dead `getWeakTypes()` + its `question_bank` fetch removed (one fewer query per dashboard load).

### Copy (all James's to tweak — student-facing)
- Card: "Fix it!" / "¡Arréglalo!" · "N past mistakes to fix" · "All fixed — nice work!"
- Start screen: "Questions you got wrong before — time to fix them!" + "N questions from your past sessions. Get each one right twice — on different days — and it's fixed for good." · button "Start Fixing".
- Pre-answer: "🔧 Last time you wrote: ~~has went~~"
- Post-answer: "Right once — get it right on another day and it's fixed." → "🔧 Fixed! This one's out of your box for good." / wrong: "Back in the box — you'll see this one again."
- Empty: "Nothing to fix today. New mistakes will appear here — that's how learning works."
- Spanish variants written throughout.

### One open UX question
On **multiple choice**, showing the previous wrong option before answering removes one distractor. Judged acceptable (goal is fixing, not cold re-testing) but it's a one-line change to make MC blind if James prefers.

---

## 3. Modal Match — result screen now shown before the challenge

**Bug:** the ✅/❌ + explanation box *was* rendering, but `SentenceChallenge` (a full-screen bottom sheet) mounted simultaneously and covered it — students jumped straight to "produce" with no feedback on what they got right/wrong.

**Fix (`src/ModalChooser.jsx`):** new `showSC` state. After Check, the feedback box shows with a **"✏️ Your turn →" button**; tapping it opens the Sentence Challenge. `showSC` resets in `nextQuestion` and `restartExercise`.
- **Side effect:** this settles one of the two parked Modal Match UX questions — the challenge is now **tap-to-fire, not auto-fire**.
- Also: the challenge prompt is now **bold with the modal function in a purple highlight pill** — "**Now use this modal** `for a polite request`**:**" (James asked for the function to be more visible). `promptText` now takes a JSX node, not just a string.

---

## 4. Small polish

- **👁️ "Watch out" emoji unified.** Modal Explainer already used 👁️; switched **Tense Explainer** and **TenseExplainerES** from ⚠️ to match. (Modal Explainer untouched.)
- **Explainers paired at top of Learn.** Root cause: `Modal Explainer` and `Vocabulary 📒` both had `recommended_order = 1` — a tie, so the grid (2-col, fills by order) let Vocabulary grab the top-right slot and bumped Modal Explainer to row 2. **Fix (data only):** renumbered `learn` category so Tense Explainer=0, Modal Explainer=1, Vocabulary=2, rest shifted +1. No ties. Top row is now Tense | Modal on a general-track view. (For-You-track students still see their track section first, per existing personalisation — pairing preserved either way.)

---

## Migrations pending `supabase db pull`
Applied via MCP this session, need syncing to local history:
- `tighten_profiles_rls`
- `fixups_queue_rpc`

(Plus the previously-parked `modal_chooser`. Run `supabase db pull` to reconcile all outstanding.)

---

## Standing state
- **`question_bank` MAX(question_number) = 2369** → next content batch starts at **2370**. (Unchanged this session — no questions added. Always re-verify live at session start; figures go stale.)
- Legacy markers unchanged: 888–907 A2 Spanish MC; 908–910 A2 Spanish sentence_auction.
- Fix it! is content-free — it recycles existing `question_bank` rows, so it needs no top-up cadence and grows automatically as students make (and fix) mistakes.

## Outstanding / next
1. **Observe Fix it! adoption.** James using it in the coming classes. Bellwether: does **Belinda** (daily player, ~284 lifetime mistakes) tap the card? Does the empty-state feel rewarding or the pile feel endless?
2. Decide the MC pre-answer-banner question (blind vs. show previous choice).
3. Auth: turn on leaked-password protection (dashboard toggle).
4. Consider the remaining RLS advisories (`word_snake_rooms`, `snake_add_word_to_class`) if student-writable game state matters.
5. From the wider review earlier this session (parked, James's call on priority): **org/B2B table** for GET21 (cheap to lay the pipe now — `organisations` + `profiles.org_id` — costly to backfill later); **Sentry**; **weekly digest emails via Resend**; **marker-tuning + a small Vitest suite** on the deterministic markers and tense engines.

### Carried-forward backlog
- Tense/Modal Explainer content pass (watch-outs, examples) — James's teacherly review, still open from 30 Jun.
- Point Taggers' inline `FORMULAS`/`FORMULAS_ES` at the shared explain-libs (single source of truth; safe, low priority).
- Spanish GOTD B1/B2 + C1/C2; ES Word of the Day B1+.
- Flashcard rebuild (long-standing — note: Fix it! now arguably fills part of the "personally-relevant review" gap the flashcard rebuild was chasing).
- Error Correction batch from Q2370 (leading-word deletions now permitted).
- Monthly content top-up: all daily surfaces should end on the last day of the month.
