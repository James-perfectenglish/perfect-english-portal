# HANDOVER — 9 July 2026 (evening) · Conditionals Chooser + Modal Match freshness top-up

## Why this session

The Chooser exercises felt stale. We measured why, then quadrupled the English pools for **Conditionals
Chooser (CC)** and **Modal Match (MM)** so a session shows a fresh slice rather than the whole bank.
**DB changes only — 135 new `question_bank` rows (2507–2641), live immediately. No code shipped.**

## The diagnosis (verified in code + Supabase)

Both `src/ConditionalChooser.jsx` and `src/ModalChooser.jsx` do the same thing in `fetchQuestions`:
pull the **entire band pool**, `shuffleArray(...)`, then `.slice(0, 10)`. Freshness therefore depends
only on how much bigger the pool is than the 10 shown. Before this session:

- **CC** — every band held exactly 10 (EN and ES), so students saw **100% of the pool, reshuffled**, every play. No freshness at all.
- **MM** (EN only) — Beginner 12 (~83% seen), Intermediate 42 (~24%, already fresh), Advanced 23 (~43%).

Bands map as: Beginner = A1/A2, Intermediate = B1/B2, Advanced = C1/C2. Each row is tagged
`tags[0]` = a **function** (the coloured pill); CC also carries `tags[1]` = card id
(`zero`/`first`/`second`/`third`/`mixed`/`unless`/`inversion`). The function/pill vocabularies are already
fully codified in both components' `FUNCTION_PHRASE` / `PILL_STYLES` maps.

## What we built

Target: bring every EN band to **~40** (4× the 10 shown), authored function-by-function so coverage is
systematic. Result after insert (verified):

| Surface | Beginner | Intermediate | Advanced |
|---|---|---|---|
| Conditionals Chooser | 10 → **40** | 10 → **40** | 10 → **40** |
| Modal Match | 12 → **40** | 42 (kept) | 23 → **40** |

135 new rows, **question_number 2507–2641**:

- **CC 2507–2596 (90):** Beginner A2 zero/first (general truth, real future, warning, promise); Intermediate B1/B2 second + unless + third (hypothetical now, advice, only if, past regret, criticism); Advanced C1/C2 mixed + inversion (mixed time, formal, past-regret inversion).
- **MM 2597–2641 (45):** Beginner A2 +28 (ability, permission, possibility, obligation, request, offer); Advanced C1/C2 +17 (past deduction, deduction—negative, regret & criticism, hypothetical past, refusal, past habit, concession, absence of obligation). Intermediate left as-is (already fresh).

Integrity verified: 135 distinct numbers, max now 2641, every CC answer is one of its four `options` tiles,
all CC rows have exactly 4 tiles, every MM answer is buildable by the fixed palette, all MM rows have
empty `options` and `hint = NULL`.

## Decisions made this session

- **Content first; the "recently-seen skip" is a separate, later job** (see plan below). We are NOT relying on code changes for freshness right now — pure volume.
- **Register balance:** the first ~10 CC Beginner rows are hospitality-flavoured (calibration batch James approved); **everything else is general, everyday-life English**, deliberately, to push the bank toward ~50/50 general-vs-business. The bosses want work English; students want life English, and many students aren't in hospitality.
- **Hints:** neither Chooser component reads the `hint` column (confirmed — no `hint` reference in either file). For **MM the function pill IS the scaffold**, so MM rows are `hint = NULL`. For **CC we wrote a hint on every row anyway** — harmless now, ready if a hint button is ever wired.
- **ES Conditionals Chooser out of scope** for B2/C1/C2 this round (James's call). Only EN was touched; ES CC untouched.
- **CLAUDE.md updated:** "Last used question number" corrected from the stale **2048** to **2641** (next batch **2642**).

## Gotchas / notes for next time

- Both Choosers fetch the **whole band client-side** then slice. Fine at tens of rows; if any band ever grows into the hundreds, move the random sample server-side.
- The whole run is cleanly reversible: `DELETE FROM question_bank WHERE question_number BETWEEN 2507 AND 2641`. (Describe-then-confirm before running, per house rules.)
- New rows are **live first-draft**. Best reviewed in **TeacherBrowse** — the coloured function pills make it easy to scan by type.
- Row shapes for reference — CC: `tags = ARRAY['<function>','<cardid>']`, `options` = jsonb array of 4 tiles, `hint` populated. MM: `tags = ARRAY['<function>']`, `options = '[]'::jsonb`, `hint = NULL`. Both inserted with `gen_random_uuid()`, dollar-quoted text (`$Q$…$Q$`) and `::jsonb` casts.

## Parked / next up

- **Recently-seen skip — Tier 1 only, next (tomorrow / weekend).** Scope trimmed this session:
  - **Tier 1 (do it):** the `question_bank` surfaces that already log to `student_answers.question_id` — RPE, Topic Practice, Conditionals Chooser, Modal Match. Reusable helper: read the student's recently-seen `question_number`s, filter them out before the shuffle, with a fallback so the pool never drops below the session size. No new table, no new write path, reversible. ~one focused session; ~80% of the "feels fresh" value.
  - **Tier 2 (mostly dropped):** only **Matching** is worth it — and **new Matching content is a priority for next week** regardless.
  - **Tier 3 (dropped):** Tense Tagger / big pools — either date-gated or too large to be a repetition problem.
  - **Open decision before we spec it:** the window model — skip the *last N items*, skip *the last K days*, or *cycle the whole pool then reset* (nicest, but needs per-student progress).
- **New Matching content — priority next week.**
- First-draft pedagogical review of the 135 new CC/MM rows in TeacherBrowse when convenient.

## One-line state

CC and MM English pools are now 40 per band (MM Intermediate 42); QB max is 2641; next work is the
Tier-1 recently-seen skip across the question_bank surfaces, plus new Matching content next week.
