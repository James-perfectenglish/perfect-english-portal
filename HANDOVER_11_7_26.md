# HANDOVER — 11 July 2026 · Live-lesson screenshot triage: marker over-strictness, defensible distractors, teacher RLS gap, account clean-up

## Why this session

Two batches of screenshots from GET21 lessons (6–10 July), plus the account questions they surfaced.
Everything divides cleanly:

- **DB changes are already live** — question bank, RLS, accounts. Nothing to push, testable right now.
- **One code file is on disk, uncommitted** — `api/mark-free.js`. It stacks with the 10/7 morning
  (teacher sidebar) and 10/7 evening (freshness) work for **one push covering three sessions**.

---

## 1. The marker — over-strict bias, second front

`api/mark-free.js`, the `isModal` branch (the "Your turn" produce step). Three false negatives from
live lessons, all on sentences that were **correct**:

| student sentence | target function | why the marker failed it |
|---|---|---|
| "Please may I borrow your car tomorrow afternoon?" | ask permission | **word order** — demanded "May I…" first |
| "I travelled 100km in my car, the fuel tank must be empty" | confident deduction | **fuel-tank physics** — "the tank would be *less* full, not empty" |
| "I wouldn't have gone to India if my friend had asked me" | imagine a different past | **the student's own causality** — "reads backwards" |

In two of the three the marker **explicitly conceded the function landed and then failed the sentence
anyway** ("You've used 'must' to state a logical conclusion, which is great! But…"). That's the
19/6 over-strict bias, but a different facet: not the "wants elaboration" one, this is the marker
adjudicating **style** and **real-world plausibility** — neither of which is any of its business.

Irony worth holding on to: the 7/7 `isModal` prompt is what taught the marker to check *function*,
and it overshot into policing the *world*.

### The rewrite (on disk, esbuild-clean)

Rules 1–6 plus a closing line. Rule 1 no longer vetoes on "unnatural"; **rule 2 (the function gate)
is untouched.** New:

- **3. CONTENT IS THE STUDENT'S TO CHOOSE.** Never judge plausibility, the reasoning, or how the
  imagined situation "should" work. *Never concede the function landed and then fail the sentence.*
- **4. STYLE IS NOT AN ERROR.** No rejection for word order, register, politeness markers, length.
  British norms: *"Please may I borrow your car?"* asks permission perfectly well.
- **5.** Cosmetic slips → note, never fail.
- **6.** Genuine grammar error elsewhere → goes in the feedback; only fails if it obscures meaning.

### The line that nearly shipped as a bug

I first closed the prompt with a bare **"When in doubt, PASS."** A 6 July screenshot then landed
showing *"you could go to the shop"* passing green **for a wish** — the exact false *positive* the
7/7 `isModal` branch was built to kill, and the literal worked example inside rule 2. That
unguarded line was an open invitation back to rubber-stamping. Now scoped:

> When in doubt about **style, content, register or a small slip**, PASS — a false "not quite" costs
> more than a lenient tick. **But never be lenient about rule 2**: the function is the one hard gate,
> and a sentence that does not perform it fails however natural it sounds.

**The standing lesson: the two marker biases are a see-saw, not a checklist.** Every loosening is a
nudge toward the under-strict end. Any future marker tuning must re-run known false *positives*
alongside the false negatives, or fixing one bias silently re-opens the other.

---

## 2. Question bank — defensible distractors (all live, all updates, no inserts)

| Q | type · level · function | change |
|---|---|---|
| **2547** | conditional · B1 · advice | distractor `would have asked` → **`had asked`** |
| **2609** | modal · A2 · possibility | + `could` |
| **2399** | modal · B2 · warning | + `have to` · `must` · `should` |
| **2400, 2422** | modal · B2 · warning (`had better not`) | + `mustn't` · `shouldn't` |
| **2631** | modal · C1 · hypothetical past | + `could have` |
| **2626** | modal · C1 · deduction | **stem rewritten** |

**2547** — *"If I were in your shoes, I \_\_\_ for the refund."* The stem has **no time anchor**, so
`would have asked` is a legitimate mixed conditional (permanent trait → past result). James chose to
**kill the ambiguity rather than accept the alternative**: at B1 the teaching point is *advice =
second conditional*, and accepting a mixed reading muddies it. `had asked` is unambiguously wrong in
a result clause but still tempting. Same shape, milder, at **2546 / 2548 / 2543** — left alone.

**Why the C1 mixed-time set never has this problem:** 2567, 2570, 2571, 2577 all anchor the time
explicitly ("now", "today", "right now"). That's the design rule worth reusing when writing
conditionals: *if the would/would-have contrast is not the teaching point, anchor the time.*

**2399** — the twin of 2398 (fixed 7/7) and missed then. Closes the "spot-check other Modal Match
items for the same gap" item queued on 7/7. **The full 272-row CC/MM audit is now done** — these
were the only gaps; everything else was already sound.

**2626** — was *"She's not answering — she \_\_\_ left already."* (deduction → `must have`), colliding
with **2427** (possibility → `might have`), whose stem opens *"She's not answering — she \_\_\_ left
her phone in the taxi."* Same opener, opposite answers, only the function badge to tell them apart.
Now: **"Her coat's gone and her desk is cleared — she \_\_\_ left already."** Decisive evidence forces
the conclusion, the way 2379/2380 do.

### Rejected: an "amber" tier for near-miss modals

Considered and **deliberately not built**. Three reasons, worth recording so it doesn't come back:

1. **It can't stay at two questions.** Once amber exists in the modal grid it's owed everywhere a
   weaker-but-defensible modal sits — `might` for deduction, `should` for warning, `can` for
   permission. That's a triage pass over all 122 modal rows.
2. **`is_correct` is a boolean.** The choosers log to `student_answers`, which feeds the dashboard's
   success %. An amber would have to lie in one direction — corrupting the marking data to express a
   shade of meaning.
3. **The RPE soft-pass isn't the same thing.** That's for *free text*, where an answer can genuinely
   be part-right. In a chooser the student presses one tile. There is no partial credit to express.

The cheap fix that buys the same pedagogy is always: **stop the stems colliding.**

---

## 3. Teacher RLS gap — crosswords (and spelling bees) invisible in the student panel

**Migration `add_teacher_select_crossword_spelling_bee` (live).** Teacher SELECT policies on
`crossword_scores` and `spelling_bee_scores`, mirroring the existing wordsearch one.

Root cause: `student_activity` / `student_activity_summary` are **`security_invoker=true`**, and
`StudentPanel.jsx` queries the summary view **directly from the client**. So base-table RLS applies
to the teacher — and both tables had own-row-only policies. Rows came back **empty, with no error**:
the classic silent RLS failure. Carolina had **62 crosswords and 59 spelling bees** invisible.

**This refines the 9/7 audit rather than contradicting it.** That session concluded "crosswords ARE
scraped" — true of the dashboard *table*, which goes through the `student_overview()` RPC. The
per-student *panel* takes a different path. **Two paths to the same data; only one was blocked.**
Worth remembering whenever a "surface is missing" question comes up.

---

## 4. Accounts — 66 → 59 students, and the leak that made them

### Deleted (8 profiles, all archived first)

New table **`_archive_deleted_profiles`** (RLS on, no policy → service-role only): full `profiles`
row + `auth.users` snapshot + reason, per deletion. **Everything below is restorable from it.**

| | why |
|---|---|
| Test (`james_harley@icloud.com`) | own test profile, no auth user, zero rows |
| Luis Davila ×2 | orphan profile rows from failed signups |
| Loli Perdomo Martel (gmail) | duplicate; `nltg.com` work account kept |
| Marina, Isabel Mateo, Mayuko | email never confirmed, **never signed in**, zero rows |
| Vagif Morozov | can't reach the app from Russia (firewall) |

Every one verified at **zero rows across all 33 tables** carrying a `student_id`/`user_id` before
deletion. Auth users deleted too where they existed — a profile delete alone leaves the login alive.

### The leak: no FK between `profiles` and `auth.users`

`Signup.jsx` never touches `profiles` — it's pure `auth.signUp`, and the
`on_auth_user_created` → `handle_new_user()` trigger builds the profile. That half was always right.
What was missing was the link **back**: nothing tied a profile to its auth user, so when **GoTrue
replaces an unconfirmed signup on retry** it deleted the auth user and **left the profile behind**.
Luis's trail is the proof: 31 May, 25 Jun 10:09, 25 Jun 10:14 — three attempts, three profiles, one
surviving auth user.

**Migration `add_profiles_auth_users_fk_cascade` (live):**
`profiles.id → auth.users(id) ON DELETE CASCADE`.

**This cannot become a data-wipe.** Of the child tables, **12 carry `NO ACTION` FKs** — so deleting
the auth user of a student with any real history is *blocked* by Postgres. The cascade only fires on
accounts with nothing behind them. Exactly the target.

Tested live end-to-end: inserted a fake `auth.users` row → profile appeared via the trigger; deleted
the auth row → profile vanished. Test row removed.

### Whitespace

13 names carried trailing spaces (Carolina, Belinda, Beatriz, Luis, Bruja…) — which is precisely how
Carolina's duplicate hid from an exact-name duplicate check. All trimmed. **Migration
`handle_new_user_trim_full_name`** now trims + collapses whitespace on the way in; tested with
`"  Messy   Name  "` → stored `Messy Name`. Bruja's emoji survives.

### Carolina Santana — deliberately NOT merged

Two real accounts, kept separate **by decision** (she's leaving Sunwing):

- `carolina.santana@sunwing.net` — **799 events**, last active 10 Jul
- `carolinasantanafalcon@gmail.com` — 178 events, last active 28 May

The merge was fully scoped: 219 ghost rows across 17 tables, **203 repoint cleanly, 16 collide** on
unique constraints (`exercise_opens` 10, `connections_sessions` 5, `spelling_bee_scores` 1).
Doable whenever wanted.

⚠️ **Live risk worth acting on before she leaves:** all 799 events sit behind the **work** address.
When that mailbox dies she can still log in *if she remembers the password* — but she can never
reset it. **One forgotten password from losing the lot.** Cheapest fix: change the email on that
auth account to her Gmail (keeps the account and all history, just re-points the login). Her call.

### Left alone, on purpose

- **Laura Tomillo** — two accounts (personal + `nltg.com`), both zero events. *Anyone in the courses
  stays* — they see the app in class and may yet use it.
- **15 lapsed zero-event profiles** (Giada, Juan Miguel, Marilo, Angel, Manoli, Ángeles, Rosa María,
  Lazaro, javier, Mercedes, Bruja, Laura ×2, Luis…). Signed up, logged in once, never returned. They
  are lapsed prospects, not corrupt rows, and the dashboard already hides them behind "never active".
  Deleting them would destroy the record that they ever signed up.
- **`monica.pieptanar@sunwing.net`** — **zero events, last login 6 February**, yet she is in the Zoom
  screenshots of the 7 and 10 July lessons. She's in the classes and never touches the app between
  them. **That's an engagement finding, not a data one** — and a live one for GET21.

---

## Verification done this session

- Every DB mutation followed by a `SELECT` (question bank rows, RLS policies, profile counts).
- FK + trigger proven with **real `auth.users` insert/delete cycles**, not assumed. Both test rows removed.
- `api/mark-free.js` esbuild-clean (`--format=esm`).
- Final state asserted: **59 students · 0 orphan profiles · 0 stray-whitespace names · 0 duplicate
  accounts** (bar Carolina's, deliberately).

---

## Test checklist — this push covers THREE sessions

The DB half needs no push and can be checked immediately. The code half is the 10/7 morning sidebar
work + the 10/7 evening freshness work + today's marker.

### A. Live now, no push needed

1. **Teacher panel → Carolina** — Crossword and Spelling Bee rows now appear (62 / 59).
2. **Modal Match, Intermediate** — 2399 *"We \_\_\_ book a table…"*: `must` passes green with a note.
   2400 / 2422: `mustn't` passes. 2609 (Beginner) *"We \_\_\_ go to Greece…"*: `could` passes.
3. **Conditionals, B1** — 2547: the fourth tile is now `had asked`, not `would have asked`.
4. **Modal Match, Advanced** — 2626 reads *"Her coat's gone and her desk is cleared…"*.
5. **Student list** — 59 students, no "Test", no duplicate Luis/Loli.

### B. Today's marker (after push) — test BOTH directions

6. **Must PASS:** *"Please may I borrow your car?"* (permission) · something odd-but-grammatical for
   deduction · a sentence with a typo on a non-target word.
7. **Must STILL FAIL:** *"you could go to the shop"* for **a wish**. ← the regression canary.
   If this ever ticks green, the leniency has leaked past rule 2.

### C. Carried from 10/7 evening (freshness — never tested)

8. **Modal Match twice back-to-back as María** — the second round should be a near-fully different ten.
9. **One Topic Practice round as María** — confirm it appears in her Activity/Mix under "Question
   bank". This is TP's per-question logging debut.
10. **RPE** — a normal round works; **Fix It!** still serves the queue in order.
11. **Browse → 🧠 Grammar tools** in classMode — CC/MM launch, write nothing, ordinary shuffle.

### D. Carried from 10/7 morning (teacher sidebar — never tested)

12. **Games/Learn tab bug** — navigate `/learn` → `/play` → `/listen` in-app; the tab must follow.
13. **Sidebar** — 🇬🇧/🇪🇸 toggle, level cycling (🟩 A2 · 🟦 B1↔B2 · 🟧 C1↔C2), multi-select track
    filters. Desktop ≥768px only.
14. **Teacher list filtering** — no track filter = general only; track filter(s) = track-only,
    combinable. **Students must be unaffected** (⭐ For You still works for them).

---

## Standing state

- `question_bank` **MAX(question_number) = 2641** — verified live, unchanged (all edits, no inserts).
  Next batch **2642**. *(Always re-`SELECT MAX` before inserting — stored figures go stale fast.)*
- **Students: 59.** Teacher UUID `bedd04fd-71fe-40ef-a0c1-6390d02ab362`. María demo student
  `1cee5fbd-41ce-4a00-aaf0-9c27eda448d0`.
- Vercel serverless functions: **8/12 (unchanged)** — no new API routes.
- New table: `_archive_deleted_profiles`. New constraint: `profiles_id_fkey`.

### Carried-forward backlog

- **New Matching content — priority.** Then the same `pickFresh` treatment if wanted.
- **Carolina's login** before she leaves Sunwing (see the ⚠️ above).
- **8 tables still have no FK to `profiles`/`auth.users` at all** — `student_answers`,
  `crossword_scores`, `word_snake_sessions`, `word_snake_leaderboard`, `student_progress`,
  `grammar_of_the_day_submissions`, `phrasal_verb_of_the_day_submissions`, `queen_bee_alerts`. They
  keep orphan rows when an account is deleted. Not urgent (the new FK covers the profile itself), but
  it's the remaining hole.
- `src/components/TeacherToolbar.jsx` is dead code — safe to delete whenever.
- First-draft pedagogical review: the 135 CC/MM rows (2507–2641) in TeacherBrowse; Conditionals
  cards/questions; `watchOut` lines in `tenseExplainEn.js` / `tenseExplainEs.js`.
- "helper verb" → "auxiliary verb" codebase + question-bank sweep.
- Tense engine Phases 2–4; Spanish Modal Explainer; Spanish GOTD B1+ / ES WOTD B1+.
- Flashcard rebuild. GET21 B2B. Irregular Verbs push (title rename confirmation).
- Monthly content top-up across daily surfaces.

## One-line state

Marker over-strictness fixed on two fronts with the function gate held firm; six question-bank rows
de-ambiguated and the CC/MM audit closed; the teacher's crossword/spelling-bee blindness traced to a
security-invoker RLS gap and patched; and the student list cleaned from 66 to 59 with the signup leak
that caused it sealed by an FK — DB all live, `api/mark-free.js` waiting on the push.
