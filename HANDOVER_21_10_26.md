# HANDOVER — 21 October 2026

November top-up, part 1, plus a crossword generator fix. One script changed
(`scripts/crossword/generate_batch.py`, already written to the repo, not committed).
Everything else is DB only. All counts below were read back from the live DB at the
end of the session, not taken from the inserts.

## 1. State at close

| Stream | Last date | November |
|---|---|---|
| Connections | 30 Nov | 30 EN + 30 ES boards, 240 groups (**done today**) |
| Word of the Day | 30 Nov | 6 tracks × 30 = 180 rows (**done today**) |
| Word Bluff | 30 Nov | 450 rows (20 Oct); audio still 0 of 450 |
| Crossword | **31 Oct** | James to run the generator (§2.4) |
| Wordsearch | **31 Oct** | James to run the generator (§2.4) |
| Wordle | **31 Oct** | not started (§5) |
| Spelling Bee | **31 Oct** | not started (§5) |

## 2. Crossword: the "something different" for November

### 2.1 The generator never wrote the dual clue fields

Every English clue in October's puzzles carries `clue_gapfill` + `gapfill_bank_id` and
`clue_definition` + `definition_bank_id` (14 Sep §5). **`generate_batch.py` never
produced those fields.** The 14 Sep session generated October and then filled them in
by hand. A November run of the old script would have shipped:

- **no toggle on any puzzle.** The UI only shows it when both fields exist.
- **gap-fill clues as the default on some A and C days.** Without a preferred type, A
  and C picked from all of a word's rows, gap-fills included (added 14 Sep). October
  was unaffected only because it was generated before the A/C gap-fills existed.

### 2.2 What changed in `generate_batch.py`

- **Clue types.** `DEFAULT_CLUE_KIND` sets the default per level: en-B gap-fill, en-A
  and en-C definition. `text` and `definition` rows both count as definitions.
  - Freshness is computed on the default kind's rows.
  - Every English clue gets both kinds when the word has both, with the same
    field names as October.
  - es-A is unchanged.
- **Star words.** `load_recent_stars()` seeds `stars_seen` with the previous 60 days of
  stars from `crossword_puzzles` (`STAR_LOOKBACK_DAYS`). This fixes the 14 Sep §9
  repeats.
- **`commit()`** only bumps `used_count`/`last_used_date` when the insert actually
  happened (`rowcount`). Previously an `ON CONFLICT DO NOTHING` skip still counted as a
  use. Skipped days are listed.
- **The dry run** now prints the excluded star counts, plus `both clue types n/n` on
  every English line.

Tested here against a stand-in bank built from the real word lists (no DB access from
the sandbox):

- 120 puzzles, 0 failures.
- Every en clue has both fields.
- B defaults to the gap-fill and A/C to the definition.
- No recent star reused.

The written file was checked by md5 against the tested copy.

### 2.3 B clue bank: 287 → 472 words

185 new en-B words, 390 rows (ids **2302–2691**, untagged, `used_count` 0). Each word
has one gap-fill plus one definition, or two definitions where there is a real second
sense or part of speech (HIRE, HOST, DUTY, RARE, DEGREE, SUSPECT…).

- **69 are 3–4 letters** (AIM, FEE, OWE, TAX, GAP, DEBT, LOAN, WAGE, RELY, VARY,
  CALM…). The bank had none, which is what 14 Sep §2 said was blocking denser or
  smaller grids.
- **Gap-fill checks:**
  - none contains its own answer;
  - each was checked by hand for a same-length rival word in all of English, not
    just in the bank;
  - obvious cross-clue giveaways (one clue containing another new answer) were
    reworded.
- **Simulated November for B:**
  - Before the top-up: 280 distinct words over 30 days, so the bank was effectively
    used up.
  - After: **360 distinct words in 360 slots, no repeats**, about 2.3 short words per
    grid, 0 failures, still 12 words at about 13×13.
- New words have `used_count` 0, so they lead early November (about 6 per puzzle)
  and then rotate with the old ones.

Still open from 14 Sep: Spanish gap-fills (needs your review), the unaudited C
definitions, and the B1/B2 split. The split was parked on the recalibration data,
which is still thin: 20 B games from 4 players.

### 2.4 To run (from the repo root)

```
python3 scripts/crossword/generate_batch.py --start 2026-11-01 --days 30
```

Check that English lines say `both clue types 12/12` (or n/n) and that no day says
FAILED, then run the same command with `--commit` added.

```
python3 scripts/generate_wordsearch.py --start 2026-11-01 --days 30 --seed 1101 --commit
```

## 3. Connections: 60 boards

Overlap was checked against all 458 earlier boards, both before and after insert. **The
highest overlap is 6/16** (EN 27 against "Shopping", ES 16 against "De punta en
blanco"). Every board has 4 groups, ranks 1–4 and 16 distinct tiles.

**Structural boards (12 per language, on the same dates):**

| Date | EN | ES |
|---|---|---|
| 1 | idioms by meaning | dichos |
| 3 | add -ER/-IST/-OR/-IAN to make a person | profesión en -ERO/-ISTA/-DOR/-NTE |
| 6 | abbreviations | siglas |
| 8 | Talking British | español coloquial |
| 10 | four sounds of EA | C/QU/G/GU |
| 12 | collective nouns | grupos |
| 15 | borrowed words | palabras viajeras: italiano, francés, náhuatl, árabe |
| 17 | double lives | dobles vidas |
| 19 | at/on/in | signos y símbolos |
| 22 | AROUND/TOGETHER/FORWARD/ASIDE | gentilicios |
| 24 | +BOOK/WAY/BOARD/WORK | palabras compuestas |
| 26 | ways to look/eat/cry/laugh | formas de hablar/comer/mirar/coger |

**Topical boards** (ES mirrors EN on the same date in A2 vocabulary):

- **Dated ones:**
  - 5 Bonfire Night
  - 11 the farm (Sant Martí)
  - 13 Whodunnit (Friday the 13th)
  - 27 Black Friday
  - 30 St Andrew's Day
- **The rest:** comfort food, space, the vet's, the boardroom, crafts, wrap up warm,
  theatre/panto, the pub/de tapas, wedding, royalty (ES palaces include Marivent and
  the Almudaina), landscapes, In court, newsroom.

**Notes:**

- Particle-first sets now used also include AROUND, TOGETHER, FORWARD and ASIDE. Only
  **ACROSS** is left.
- **ES verb-noun expressions (HACER/TENER/TOMAR/ECHAR) and EN make/do/take are spent.**
  Earlier boards used nearly all the obvious collocations. Don't plan another.

## 4. Word of the Day: 180 rows

Read back from the DB:

- every word is new to the table in its language;
- 0 duplicates within November;
- 0 consecutive same first letters in any track;
- longest ascending run is 3 in every track.

**Anti-spoiler** against each day's Connections board was used as a hard constraint
while scheduling:

- the word is never a tile or a category or title word;
- no 4+ letter tile, or its stem, appears in the definition or example.

The DB check finds 0 hits. The pairs were also read by eye for inflections.

**Pinned words:**

- **EN:** poppy (11), freezing (16), dazzling (5), superstitious (13), hearty (2),
  thankful (26), astronomical (4), bucolic (11), sleuth (13), sartorial (16),
  thespian (18), regal (23), litigious (28), canny (30).
- **ES:** recuerdo (1), hoguera (5), chollo (27), aceituna (11), sideral (4),
  pesquisa (13), atavío (16), regio/a (23), pleitear (28).

**Conventions** are as in September: Spanish definitions and examples, English part of
speech with (m)/(f)/(m/f), and `-o/a` adjectives. The British informal words are
labelled as such in the definition (chuffed, skint, fortnight, pernickety, kerfuffle).

## 5. Still to do before 31 October

1. **Wordle and Spelling Bee November** (60 + 60 rows). They come last because they
   must avoid what is now in the DB. Same-day, same language:
   - the Wordle answer and the bee pangram never appear on the Connections board,
     whether as a tile (including inside a two-word tile), a category word or the
     title;
   - they never equal the day's Word of the Day, and never appear in its definition or
     example.

   Also carry over September's rules:
   - Bee: at least 100 words for the centre, enough common words (wordfreq zipf ≥ 3),
     ES around 900 or fewer, no repeated centre on consecutive days, no centre more
     than twice, pangram in `word_lists`, letter set not used before.
   - Wordle: answer in `word_lists`, not reused, `display_word` for accents, no
     consecutive same first letter, ascending run ≤3.
2. **James:** run the crossword and wordsearch (§2.4); generate the Bluff audio
   (20 Oct §4).
3. **December** is the next cliff for every stream, Word Bluff included (returning
   words for 1–21 Dec come from 10–30 Nov). It needs the same top-up around 22 Nov.

## 6. Prompt for a new thread (Wordle + Bee)

> November top-up, part 2: Wordle and Spelling Bee, EN + ES, 1–30 November 2026.
> Read HANDOVER_21_10_26.md §5 and HANDOVER_17_9_26.md §2–3 and §5 first. Connections
> and Word of the Day for November are already in the DB. Pull each day's tiles,
> titles, categories and WOTD rows first and treat them as forbidden for that day's
> Wordle answer and bee pangram. Count bee candidates against `word_lists` before
> choosing. Insert, then verify everything from the DB and write
> HANDOVER_<date>.md to the repo root.

## Commit

```
git add scripts/crossword/generate_batch.py CLAUDE.md HANDOVER_20_10_26.md HANDOVER_21_10_26.md
git commit -m "Crossword generator: both clue types, star dedupe across runs; November handover"
git push
```
