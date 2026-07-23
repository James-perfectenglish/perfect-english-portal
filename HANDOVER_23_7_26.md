# Handover — 23 July 2026

## Session summary

Built and inserted all August 2026 daily content for the four streams Claude
generates. **620 rows, live in Supabase.** Crossword and wordsearch are still
outstanding — James runs those locally.

---

## Inserted this session

| Stream | Rows | Coverage |
|---|---|---|
| `wordle_words` | 62 | 31 EN + 31 ES, 1–31 Aug |
| `spelling_bee_puzzles` | 62 | 31 EN + 31 ES, 1–31 Aug |
| `word_of_the_day` | 186 | 6 tracks × 31 (EN A1/A2, B1/B2, C1/C2 · ES A1/A2, B1/B2, C1/C2) |
| `connections_puzzles` | 62 | 31 EN + 31 ES |
| `connections_groups` | 248 | 4 per board |

Verified post-insert: every stream returns exactly 31 rows across 31 distinct
days, `MAX(play_date) = 2026-08-31`. Connections integrity confirmed — all 62
boards have exactly 4 groups, 4 distinct `colour_rank` values (1–4), and 16
distinct tiles.

### Spot-check anchors

- **Wordle 1 Aug** `snack` / `FALDA` · **31 Aug** `shape` / `PLAZA`
- **Bee 1 Aug** centre `t`, pangram *kitchen* / centre `m`, *mercado*
- **WOTD 1 Aug** A1 `fridge` · B1 `brief` · C1 `scrupulous` /
  A1 `lejos` · B1 `ahorrar` · C1 `idóneo/a`
- **Connections 1 Aug** "On the housekeeping trolley" / "El carro de limpieza"

### ES WOTD B1/B2 + C1/C2 revived

Both tracks had been empty since 2026-03-03. Now filled for August (62 rows).
Format follows the March stubs: definition and example in Spanish, `part_of_speech`
in English with gender marking (`noun (m)`, `noun (f)`, `verb`, `adjective`),
adjectives written as `-o/a`.

---

## Bugs found in EXISTING content

All three pre-date this session. August fixes them going forward; **July was not
retroactively patched.**

### 1. July Wordle ran alphabetically
EN: `eight, fault, greet…`. ES was a perfect A–Z march, `BARCO` → `VIAJE`.
Leaks the first letter to any student who spots the pattern.
**Fixed for August** — shuffled so no two consecutive words share a first letter.
Longest ascending run: EN 4, ES 3 (July was 31).

### 2. Spelling Bee centre letter stuck on `a`
Every day of July, both languages. All-time: 39/109 EN and 61/102 ES puzzles
used `a` as centre.
**Fixed for August** — 21 distinct EN centres, 19 distinct ES, max repeat 2,
never the same centre on consecutive days.

### 3. ⚠️ ES `word_lists` has no plural forms — NEEDS A DECISION

11 of July's 31 ES Spelling Bee puzzles have a pangram the game will not accept:
`maduros, abrigos, blancos, menudos, vendias, nevados, templos, dibujos,
tiburon, regadio, faroles`. EN is clean, 31/31.

Probing ~40 further candidates, **every** missing word was a plural (`cambios`,
`colegas`, `compras`, `cuadros`, `guantes`, `maderos`, `premios`, `tejados`,
`vecinos`) or an inflected verb form (`hospeda`, `levanto`, `negocia`).

This is bigger than pangrams: students lose points on **every valid plural they
find**, every day, in every ES Spelling Bee. Fixing it means generating plural
forms into `word_lists` where `language='es'`. Not touched without sign-off.

All 31 August ES pangrams were verified present in `word_lists` before insert.

---

## Connections — 5 boards redesigned

Drafted 31 boards, then tested each 16-tile board against all 138 existing EN
puzzles for word overlap. Five were substantial re-treads and were replaced:

| Original | Overlap | Replaced with |
|---|---|---|
| In the kitchen | 11/16 | **In the storeroom** |
| Sports day | 10/16 | **Board games and cards** |
| Around the house | 9/16 | **Tools and DIY** |
| At the hotel | 8/16 | **On the housekeeping trolley** |
| Feelings | 8/16 | **Nerves and courage** |

Replacements now overlap by ≤6, four of the five by ≤2. Remaining 26 boards sit
at ≤7/16, judged acceptable — some vocabulary recurrence reads as revision
rather than repetition in a learning app.

### Theme saturation — worth planning for September

138 EN Connections themes already exist. Everyday topic space is close to
exhausted: Weather, Travel, Money, Feelings, Shopping, Kitchen, Animals, Body,
Work, Sport, Clothes, Music, Colours, Time, Reading are all taken, most more
than once.

The untapped seam is the **structural/wordplay** type already present in the
bank and much harder to exhaust:
`GET ___`, `MAKE ___`, `TAKE ___`, `BREAK ___`, `OVER + ___`,
"Make it negative", "Say it formally", "Ways to say said", "Hidden words",
"Halfway there", "Famous pairs".

Recommend September leans this way rather than another round of topic boards.

---

## Data inconsistency standardised (not retroactively fixed)

`word_of_the_day.part_of_speech` for ES is currently mixed:
`sustantivo` 40 / `noun` 11 · `verbo` 24 / `verb` 25 · `adjetivo` 22 /
`adjective` 22.

August ES rows use **English labels with gender** throughout, matching the
B1/B2 and C1/C2 stubs. Legacy A1/A2 rows remain mixed — a cleanup `UPDATE` pass
is available if wanted.

---

## Outstanding

### James to run locally
```
python3 scripts/crossword/generate_batch.py --start 2026-08-01 --days 31 --commit
python3 scripts/generate_wordsearch.py --days 31 --start 2026-08-01 --seed 43
```
Crossword produces 124 rows (en A/B/C + es A). Wordsearch: dry-run first, then
re-run with `--commit`. Seed 43 rather than 42 to avoid re-treading July themes.

Both streams currently end **2026-07-31** — 8 days of headroom from today.

### Decisions needed
1. **ES `word_lists` plurals** — fix or accept? (see bug 3 above)
2. **September Connections direction** — structural/wordplay vs more topics?
3. **ES `part_of_speech` cleanup** — normalise legacy A1/A2 rows?

### Carried over from previous sessions
- `api/mark-free.js` — 3 sessions of uncommitted work awaiting a single
  consolidated push with full test checklist
- Matching exercise DB inserts — pending asset upload confirmation
- 37 ElevenLabs audio clips to record
- 18 B2B images to generate, then `--strip-bg --upload`
- `helper verb` → `auxiliary verb` sweep (codebase + question bank)
- Flashcard rebuild (long-parked)

---

## Notes for next session

- Question bank untouched this session. Verify `SELECT MAX(question_number)
  FROM question_bank` live before any insert — stored figures drift.
- `execute_sql` ~40KB ceiling held fine; WOTD split EN/ES at ~13KB each,
  Connections groups split by language at ~13KB each.
- Connections groups were inserted via `INSERT … SELECT` joining on
  `(play_date, language)` to resolve the serial `puzzle_id` — puzzles must be
  inserted first.
- Dollar-quoting (`$w$…$w$`, `$x$…$x$`) used throughout for accents and
  apostrophes.
