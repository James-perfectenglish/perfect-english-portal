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
| Crossword | 30 Nov | run by James 22 Oct, seed 49630002; verified from DB (§2.5) |
| Wordsearch | 30 Nov | 30 EN + 30 ES, run by James 22 Oct, seed 1101 |
| Wordle | 30 Nov | 30 EN + 30 ES (22 Oct, §5) |
| Spelling Bee | 30 Nov | 30 EN + 30 ES (22 Oct, §5) |

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
- **Ties are broken at random.** Added 22 Oct, after James's first dry run. The 185
  new words all tie on freshness, and the sort kept them in insert order, short words
  first. So en-B on 1–3 Nov came out as 12 three/four-letter words (stars POLL, CALM,
  PITY). `pick_pool` now shuffles before its stable sort.
- **Short words are capped.** `MAX_SHORT_SHARE = {("en","B"): 0.25}` limits words of 4
  letters or fewer to 9 of en-B's 36-word daily pool. Without it, unplaced short words
  stayed fresh and piled up around 12–14 Nov (8–11 per grid). Now there are 0–4 per
  grid (about 1.6 on average) across three seeds, still 12 words a day, stars 8+
  letters, and 360 distinct words in the month.

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
  - After: **360 distinct words in 360 slots, no repeats**, about 1.6 short words per
    grid, 0 failures, still 12 words at about 13×13.
- New words have `used_count` 0, so they lead early November (about 5–6 per puzzle)
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

### 2.5 November crossword, verified from the DB (22 Oct)

- 120 puzzles, 30 days × 4 tracks.
- Every clue re-spelled from its grid cells: 0 mismatches.
- No orphan letters in any grid.
- Every English clue carries both clue types:
  - 0 bad references to the gap-fill, definition or default rows;
  - the default is the gap-fill at B and the definition at A and C.
- Star words: no repeats within November and none from the previous 60 days.
- en-B: 360 clues covering 360 distinct words. 170 of the clues use the new words
  and 55 are 4 letters or fewer, about 1.8 per grid.

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

## 5. Wordle and Spelling Bee (22 Oct)

Done last because they had to avoid what was already in the DB. For each day and
language, the Wordle answer and the bee pangram never appear on that day's Connections
board (tile, word inside a tile, category or title) and never equal or appear in that
day's Word of the Day (word, definition or example). The DB re-check finds 0 hits.
Pangrams were also kept off the day's Wordle answer.

**Spelling Bee.** September's rules, all re-checked from the DB:

- Each pangram is in `word_lists`.
- 7 letters with 6 outer letters, and the pangram uses exactly those 7.
- No letter set or pangram from any earlier month.
- No centre on consecutive days, and no centre more than twice.
- `valid_words` is `'{}'` and `max_score` 0, as before.

The thresholds:

- **Dictionary words** (4+ letters, centre included, from `word_lists.word_key`): at
  least 100 in both languages. EN runs 104–255. ES runs 136–770, under the 900 ceiling.
- **Common words** (wordfreq zipf ≥ 3): at least 40, matching October's lowest.

Candidates were counted before choosing. Rejected:

- *november*: not in `word_lists`.
- *bathroom*, *ceremony*, *ordinary*, *magazine*: under 100 with every centre.
- **Too productive in ES:** *carnicero*/*cocinera*, *linterna*, *noticias*,
  *panadero*, *mariposa*, *merienda*, *tristeza*, *cerillas* and *petardo*. Every centre
  gives over 900.
- *gasolina* and *concierto*: letter sets already used.
- No ES set uses ñ (none ever has).

Pinned: *universe* (4, space), *mortgage* (9, boardroom), *memorial* (11),
*imagination* (18, theatre), *celebrate* (21, wedding), *domingos* (15, a Sunday).

EN (date, pangram, centre, dictionary words):
1 darkness d 203 · 2 surprised i 207 · 3 heritage r 196 · 4 universe s 209 · 5 paintings a 253 · 6 sleeping n 229 ·
7 mountain a 109 · 8 careful l 125 · 9 mortgage t 194 · 10 pleasure u 197 · 11 memorial l 129 · 12 strength s 185 ·
13 generous r 209 · 14 guardian g 124 · 15 literature e 201 · 16 foreign g 156 · 17 happiness p 170 · 18 imagination n 196 ·
19 graduate e 255 · 20 temperature t 165 · 21 celebrate c 140 · 22 furniture i 121 · 23 shopping o 133 · 24 household d 140 ·
25 passenger p 233 · 26 crossing o 178 · 27 apartment m 120 · 28 tourism u 104 · 29 patience c 119 · 30 newspaper w 123

ES:
1 fontanero f 495 · 2 aceituna i 363 · 3 invitado n 394 · 4 marinero i 692 · 5 deportes p 459 · 6 hoguera r 364 ·
7 castillo t 727 · 8 guantes g 530 · 9 camiseta m 679 · 10 mosquito s 136 · 11 fruteria e 528 · 12 bufandas a 327 ·
13 lechuza c 258 · 14 pasajero j 520 · 15 domingos o 232 · 16 chubasco s 411 · 17 longaniza a 284 · 18 gimnasio m 518 ·
19 zapatillas p 264 · 20 tenedores d 453 · 21 pendientes n 433 · 22 conductor o 174 · 23 granjero j 436 · 24 lagartija r 378 ·
25 medicina d 502 · 26 serpiente t 701 · 27 calcetin l 753 · 28 batidora b 567 · 29 cinturon c 257 · 30 zapateria e 770

**Wordle.** Read back from the DB:

- every answer is in `word_lists`;
- none has been used before, and none repeats within November;
- no consecutive same first letter;
- longest ascending run is 3.

ES answers are uppercase, with `display_word` for BALON → balón (the only accented
answer this month). SEÑAL keeps its Ñ in the word, as OTOÑO did. Pinned: blaze (EN 5),
tweed (EN 30); BRASA (ES 5), CERDO (ES 11, Sant Martí), GAITA (ES 30).

EN: chill, label, hurry, smell, blaze, charm, grain, arrow, delay, shine, dozen, cream, sheep, panic, trick, alert, craft, essay, cloth, shore, thumb, scary, globe, chest, slice, alarm, dress, flood, cargo, tweed
ES: BALON, SALTO, HUESO, ABAJO, BRASA, VAPOR, FAUNA, RISAS, CASCO, BARBA, CERDO, TRAER, RUMOR, CLAVE, GANAS, CALMA, POETA, ABRIR, SEÑAL, CREAR, GUAPO, POLVO, DOBLE, FIRMA, HUMOR, ALDEA, FRUTO, CABLE, PLATA, GAITA

## 6. Still to do

1. **James:** generate the Bluff audio (20 Oct §4).
2. **December** is the next cliff for every stream, Word Bluff included (returning
   words for 1–21 Dec come from 10–30 Nov). Same order as this month: Bluff,
   Connections, WOTD, crossword/wordsearch (James runs them), then Wordle and Bee.
   Target around 22 Nov. Christmas themes were deliberately left for December's boards.

## 7. Prompt for a new thread (December)

> December top-up, 1–31 December 2026, every daily stream. Read HANDOVER_21_10_26.md
> and HANDOVER_17_9_26.md first and follow the same order, rules and checks: Word
> Bluff (returning words from 10–30 Nov), Connections (overlap ≤7/16 against all
> boards, check before drafting), Word of the Day, then James runs the crossword and
> wordsearch (`generate_batch.py` now handles both clue types and star dedupe), then
> Wordle and Spelling Bee, which must avoid each day's board and WOTD. Verify
> everything from the DB and write HANDOVER_<date>.md to the repo root.

## Commit

```
git add scripts/crossword/generate_batch.py CLAUDE.md HANDOVER_20_10_26.md HANDOVER_21_10_26.md
git commit -m "Crossword generator: both clue types, star dedupe across runs; November handover"
git push
```
