# HANDOVER — 28 June 2026

One clear goal this session: **align every daily content surface to finish on the last day of the month**, and top everything up to **31 July 2026**. Done, all six features. Plus a real bug fix to the wordsearch generator surfaced along the way.

Everything below is verified against the live DB and filesystem this session, not memory. The closing audit query confirmed all six surfaces now end on `2026-07-31`.

---

## 🎯 The new operating convention: month-end alignment

**Every daily surface should run out on the last calendar day of the month.** This is now the standard. Rationale (your call): it makes coverage trivial to track — at month-end, *everything* needs topping up together, and the next batch is always "the 1st for N days" where N = days in the month.

Before this session things were ragged (Wordle EN was at 4 Jul, crossword had already lapsed on 24 Jun, the rest sat at 30 Jun). They're now all squared on 31 Jul, so from August onward the monthly top-up is one coordinated pass.

**The monthly recipe (next: August, 1–31 Aug = 31 days):**

```
python3 scripts/crossword/generate_batch.py --start 2026-08-01 --days 31 --commit
python3 scripts/generate_wordsearch.py --days 31 --start 2026-08-01 --seed 42 --commit
```

…then the other four (Wordle, Spelling Bee, Word of the Day, Connections) are **authored + direct-inserted** (no generators exist for them — see below). `--days`/day-count is just the number of days in that month. Crossword/wordsearch both carry conflict guards, so a re-run is safe.

---

## 🟢 Generators — crossword + wordsearch

These two have committed Python generators and write straight to Supabase (no deploy needed).

- **Crossword** had lapsed on 24 Jun. Ran `generate_batch.py --start 2026-06-25 --days 37 --commit` → fills 25 Jun–31 Jul across `en A/B/C + es A`. Clean.
- **Wordsearch** ran 1–31 Jul after the fix below.

### 🐛 Wordsearch generator bug — fixed + committed

**Symptom:** crash on the first ES puzzle of the run:
`ValueError: empty range in randrange(10, 10)` in `place_word` (line ~416).

**Root cause:** `place_word` picks a random direction, then computes the start cell with `rng.randint(...)`. For a word **longer than the grid's short side**, the range goes empty and `randint` *raises* (it doesn't just fail to place). The bank's longest words are **11 letters** (ES `MANTEQUILLA`, `CELEBRACIÓN`, `ANIVERSARIO`; EN `SCREWDRIVER`, `ELECTRICIAN`), and two grid variants — `(10,14)` and `(14,10)` — have a side of only **10**. So an 11-letter word dropped into the 10-side blew up. (EN day-1 happened to dodge it; ES `MANTEQUILLA` hit it.)

Also worth noting: the script only calls `conn.commit()` **once at the very end**, so the mid-loop crash rolled the whole run back — the `id=111` it printed was never persisted. Verified zero July rows existed before the re-run.

**Fix** (in `place_word`): skip any direction that physically can't hold the word, so it just tries another orientation instead of crashing —

```python
if dr != 0 and len(word) > rows:
    continue
if dc != 0 and len(word) > cols:
    continue
```

No regression: the longest word (11) always fits the long side of every variant (≥12), so a valid orientation always exists. With `--seed 42` the run is deterministic, so the re-run placed `MANTEQUILLA` happily (19 bonus words) and completed to 31 Jul.

**Committed + pushed** as `Fix wordsearch crash: skip directions too short for long words` (commit `35045ed`). *(Push needed a rebase — remote was ahead, plus a working-tree `HANDOVER_8_4_26.md` deletion / `HANDOVER_19_6_26.md` untracked had to be committed first before `pull --rebase` would run. All resolved.)*

---

## 🔵 Content features — authored + direct-inserted

Wordle, Spelling Bee, Word of the Day and Connections have **no generator** — they're content inserts via Supabase MCP. You OK'd direct inserts for the batch. **Every word/pangram/puzzle/title was deduped against the full existing history** before generating.

| Feature | July rows | Notes |
|---|---|---|
| **Wordle** | **58** | EN 5–31 Jul (27) + ES 1–31 Jul (31). EN lowercase, ES UPPERCASE accent-stripped. |
| **Spelling Bee** | **62** | EN 31 + ES 31. Each = one 7-distinct-letter pangram + centre. |
| **Word of the Day** | **124** | EN 31 × 3 levels (93) + ES 31 × A1/A2 (31). |
| **Connections** | **62 puzzles + 248 groups** | EN 31 + ES 31, 4 groups each. |

### Schema/convention facts confirmed this session (for next time)

- **`wordle_words`** — `(word, play_date, language)`. EN stored lowercase, ES uppercase with accents stripped (no Ñ). Unique on `(play_date, language)`.
- **`spelling_bee_puzzles`** — `(play_date, language, centre_letter, outer_letters text[], valid_words text[], pangrams text[], max_score int)`. **Recent convention: `valid_words = '{}'` (empty) and `max_score = 0`** — the app scores client-side from the 7 letters. Everything stored **lowercase**. So a puzzle is just a pangram (exactly 7 distinct letters) + a chosen centre letter; the other 6 are `outer_letters`.
- **`word_of_the_day`** — column is **`date`** (not `play_date`): `(date, level, language, word, part_of_speech, definition, example_sentence)`. **EN runs 3 levels/day** (`A1/A2`, `B1/B2`, `C1/C2`); **ES runs A1/A2 only** (its B1+ track is still parked). EN `part_of_speech` in English (`verb`/`noun`/`adjective`), ES in Spanish (`verbo`/`sustantivo`/`adjetivo`/`adverbio`).
- **Connections is two tables.** `connections_puzzles (id, play_date, title, language)` + `connections_groups (id, puzzle_id, category, colour_rank, words text[])`. **`colour_rank` 1 = easiest → 4 = hardest.** Words UPPERCASE (ES keeps accents). Insert pattern used (atomic, single statement):

  ```sql
  WITH np AS (
    INSERT INTO connections_puzzles (play_date, title, language) VALUES (...)
    RETURNING id, play_date, language
  ), ig AS (
    INSERT INTO connections_groups (puzzle_id, colour_rank, category, words)
    SELECT np.id, v.colour_rank, v.category, v.words FROM np
    JOIN (VALUES (...) ) AS v(play_date, language, colour_rank, category, words)
      ON np.play_date = v.play_date AND np.language = v.language
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM np), (SELECT count(*) FROM ig);
  ```
  The CTE inserts puzzles, returns their ids keyed by `(play_date, language)`, then joins the group VALUES onto them — no need to hand-wire 62 returned ids.

- **Connections design rule:** the 16 words per puzzle must be **unambiguously sortable** — no word may plausibly fit two of its four groups. Drafted with an umbrella title + 4 distinct categories (e.g. "Cooking basics" → Cutlery / Appliances / Ways to cook / Tastes). Cross-puzzle word reuse across different dates is fine; within a single puzzle it must be clean.

---

## ✅ Verified live state (queried this session)

**Coverage — all six surfaces end 2026-07-31:**

| Feature | EN | ES |
|---|---|---|
| Wordle | 31 Jul | 31 Jul |
| Connections | 31 Jul | 31 Jul |
| Spelling Bee | 31 Jul | 31 Jul |
| Word of the Day | 31 Jul (×3 levels) | 31 Jul (A1/A2) |
| Wordsearch | 31 Jul | 31 Jul |
| Crossword | 31 Jul (A/B/C) | 31 Jul (A) |

- **Connections integrity:** EN 31 puzzles / 124 groups, ES 31 / 124. `bad_word_count = 0`, `bad_rank = 0` (every group has exactly 4 words; all ranks 1–4).
- **ES WOTD B1/B2 + C1/C2** still sit at `2026-03-03` (5 rows each) — **expected**, these are the parked historical entries, not the daily track. Untouched.

---

## ⚠️ Deploy / git state

- **All content is live now** — pure DB inserts via Supabase MCP, no deploy step.
- **One code change this session:** the wordsearch `place_word` fix — **committed + pushed** (`35045ed`). Nothing else touched in code.
- Generators run from local disk, so the fix is already effective for your runs.

---

## 🧩 Loose ends / next session

1. **August top-up at month-end** — run the two generator commands above (`--start 2026-08-01 --days 31`), then ping me to author + insert the four content features (Wordle/Spelling Bee/WOTD/Connections), deduped as before.
2. **Consider generators for the four content features.** They're the only surfaces still hand-fed. The content itself can't be fully auto-generated (it needs real words/puzzles), but a thin month-parametrised seed script per feature would make the monthly pass a one-liner like crossword/wordsearch. Not built — flagged as the obvious next efficiency step toward the "easier to track" goal.

### Carried forward (unchanged — parked)
- **Marker-tuning session** — the two systematic biases from the 19 Jun tagging run (over-strict on strong students; under-strict on errors away from the target word). Still the big one.
- **Spanish GOTD B1/B2 + C1/C2**, and **ES WOTD B1+** (daily ES still A1/A2 only).
- **EC batch** with leading-word deletions (from Q2330 learnings) — not started.
- **Flashcard rebuild** — pending.
- **PVOTD bank expansion** (145 entries in place).
- **`topic` column whitespace audit** (`past_tenses\n` trailing newline fragmenting GROUP BY).
- **GET21 partnership follow-up.**
- Question bank: last used number **2048**; next batch from **2049** (topic/level steer needed). Always re-check `SELECT MAX(question_number)` at session start.

---

## 🛠️ Technical notes / learnings

- **`rng.randint(a, b)` raises on an empty range** (`a > b`) rather than returning a sentinel — so any range arithmetic that can invert needs a guard *before* the call, not a try/except after. The wordsearch crash was exactly this: word longer than the grid dimension → inverted range → hard crash mid-run.
- **The wordsearch generator commits once at the end**, so any mid-loop crash rolls the entire batch back. Re-runs are clean (and `ON CONFLICT (play_date, language) DO NOTHING` double-covers). Always verify actual rows landed rather than trusting the printed `id=...`, which is assigned pre-commit.
- **Spelling Bee no longer needs a precomputed word list.** Recent rows carry `valid_words = '{}'`, `max_score = 0`; scoring is client-side. So authoring a puzzle is just: pick a real word with exactly 7 distinct letters (the pangram), choose a versatile centre letter (vowels/`a`/`e`/`o` give richer puzzles), done.
- **Connections via the CTE+JOIN pattern** is the clean way to insert puzzle+groups together — insert parents `RETURNING` their keys, then join the child VALUES on `(play_date, language)`. Atomic, and the final `SELECT count` gives an immediate row-count check.
- **Month-end maths:** `--days` for a full month = days in that month (Jul/Aug = 31, Sep = 30, Feb 2026 = 28). Crossword start was 25 Jun this time only because it had lapsed; normally each month's batch starts on the 1st.
- **`word_of_the_day` keys on `date`, not `play_date`** — easy to trip on when writing the cross-feature coverage audit (it needs its own `MAX(date)` branch in the UNION).

---

## 🪞 Bigger picture

**The daily content is now on a predictable monthly rhythm.** Six surfaces, two languages, all finishing the same day — so "what needs topping up?" has a one-word answer at month-end ("everything"), and the refill is one coordinated pass instead of six separate cliff-watches. The two generators are one-liners; the four authored features are a deduped batch I can regenerate on cue.

**Same shape as always — verify, fix at the root, stage the rest.** The wordsearch crash got a proper root-cause guard rather than a seed-gamble; every insert was deduped against live history and row-counted on the way in; and the speculative win (seed scripts for the four content features) is left named, not built on spec.
