# HANDOVER — 14 September 2026 (morning)

Crossword only. Three files changed — `src/CrosswordGame.jsx`,
`scripts/crossword/crossword_engine.py`, `scripts/crossword/generate_batch.py` —
plus substantial data work in `crossword_clue_bank` and `crossword_puzzles`.
**No schema change.** Nothing here touches Wordle, Connections, the tense engines
or the focus model.

Also folded in, unrelated: four fixes in `question_bank`, section 8.

## 1. B was the hardest puzzle in the app, and it was in the config

Reported from the field: the B crossword felt too hard, and a tired native
speaker couldn't finish it. The instinct was right but the diagnosis wasn't the
obvious one — the vocabulary is fine. CONNECT, BORROW, MANAGE, ARRANGE are all
solidly B1.

`LEVEL_CONFIGS` in `crossword_engine.py` had:

```
("en", "A"): 9  target,  6 min, 10 max_dim
("en", "B"): 19 target, 14 min, 15 max_dim
("en", "C"): 18 target, 13 min, 15 max_dim
```

**B was set to pack more words into the same 15x15 as C.** Measured over the
generated back catalogue, B averaged 17.8 entries against C's 15.8. So the three
tiers were really two, and the middle one was the top one.

Worse, neither target is reachable. A sweep of candidate configs against the real
287-word bank (30 trials each, engine run directly) showed current-B producing
16.1 entries on average and current-C 16.2 — the bank's word shapes cap output
around 16 regardless of what the target says. **Treat the `target_words` numbers
as aspirational, not descriptive.**

## 2. Retuned to 12 / 9 / 13, and why not 12x12

`("en", "B"): LevelConfig(12, 9, 13, "en-B")`.

12x12 was the first instinct and it does not work. The B bank has **no word
shorter than five letters** and a dozen at 11–12, so short connective words —
the things that let a dense grid close up — don't exist. At `max_dim 12` the
generator either thins out to 9.8 entries or fails outright a third of the time
(12/10/12 succeeded 7 times in 12). **13 is the floor for this bank.** If you
ever want a genuinely smaller grid, the fix is adding 3–4 letter words to the
bank, not tightening `max_dim`.

At 12/9/13 the generator succeeded 12/12 and hit its target 9 times. Live result
for 11 Sep – 31 Oct: A 9.0 entries at 9x10, B 12.0 at 13x13, C 16.2 at 15x15.
Monotonic for the first time, with the real step between B and C.

## 3. Puzzles regenerated

The 20 B puzzles for 11–30 Sep were deleted and rebuilt (all zero-score at the
time; checked individually, not just counted). Today's was deliberately left
alone as it was live. Clue-bank `used_count` was decremented for the deleted
puzzles and re-incremented for the new ones, and `last_used_date` recomputed from
puzzles that actually exist, so the freshness data didn't drift.

October was then generated normally with `generate_batch.py --start 2026-10-01
--days 31 --commit`. All four tracks, 31 days, no gaps.

Verification for both runs was read back from the database rather than trusted
from the insert: every clue re-spelled from its grid cells, no orphan lettered
cells (no phantom words), every clue carrying a real `bank_id`.

## 4. Clue style — and a mistake worth not repeating

The deeper problem was never density. The old B clues were dictionary definitions
that frequently used a word's **secondary sense**: CHALLENGE clued as "to question
whether something is true or right", COLLECT as "to go and fetch someone",
FAILURE as "when a machine stops working". A student who knows the primary sense
reads that and concludes they don't know the word.

Gap-fill sentences were written to replace them — and **that was the error.**
Swapping removed the definitions entirely instead of layering them, and a gap-fill
clue is not automatically easier: without a letter count it's strictly harder than
a definition, since the definition at least bounds the meaning. James caught this
immediately on seeing it live.

Current state: **both clue types exist for all three English levels**, stored
side by side, with a toggle. 696 gap-fill clues written — 139 at A, 287 at B, 270
at C. The definitions were never deleted.

## 5. Data model — read this before touching clue rendering

Every English clue in `crossword_puzzles.clues` now carries:

| key | meaning |
|---|---|
| `clue_text` | **that level's default** — gap-fill at B, definition at A and C |
| `clue_gapfill` + `gapfill_bank_id` | the sentence-with-a-blank version |
| `clue_definition` + `definition_bank_id` | the dictionary version |
| `bank_id` | legacy; equals the default's bank id |

`clue_text` is duplicated on purpose. It's the fallback, so anything that doesn't
know about the named fields still renders correctly, and Spanish (which has
neither new field) is unaffected.

The UI derives the default **from the data, not from the level**:
`clue_text === clue_gapfill ? 'gapfill' : 'definition'`. This is deliberate — it
means adding gap-fill clues to Spanish later requires no UI change at all.

`clueStyle` state is `null` until the student picks, meaning "use the default".
The toggle renders only when a puzzle has both fields populated.

## 6. Generator now prefers gap-fill at B

`PREFERRED_CLUE_TYPE = {("en", "B"): "gapfill"}` in `generate_batch.py`, applied
in `pick_pool`. Words with no clue of the preferred type fall back to whatever
they have, so it cannot break. `load_bank` now selects `clue_type`, which it
previously ignored entirely — the `text` / `definition` distinction in the bank
was inert and both were dictionary definitions in practice.

**A and C are intentionally not in that dict.** Their default stays the
definition; the gap-fills are there for the toggle only. See section 7.

## 7. Ambiguity — the real limit on gap-fill clues

A gap-fill clue fails when a different word fits the sentence. Two passes were
needed and the first was wrong.

**First pass checked only against other words in the same bank.** That caught
ACQUIRE/ACHIEVE, CONSUME/REQUIRE, EXTEND/EXPAND, HANDLE/MANAGE,
CONSIDER/EVALUATE, CREATE/DESIGN, CONSTANT/FREQUENT, INSPIRE/IMPRESS — all
rewritten around fixed collocations. But **students don't know what's in the
bank**, so the real test is ambiguity against all of English, which that pass
didn't apply. Live examples that slipped through at B: *"Nothing seems to ______
him any more"* (EXCITE, but BOTHER fits) and *"Who did the ______ for this
building?"* (DESIGN, but LAYOUT fits). Not yet fixed.

**At C this is structural, not fixable.** Advanced vocabulary exists to make fine
distinctions, so the bank is dense with same-length near-synonyms: APPEASE /
PLACATE at 7; AMBIGUOUS / EQUIVOCAL, EPHEMERAL / TRANSIENT, RESILIENT / TENACIOUS
at 9; FASTIDIOUS / METICULOUS / SCRUPULOUS at 10. The letter count doesn't
disambiguate when the rival is the same length. This is why **C defaults to the
definition** and the gap-fill is the optional layer, not the other way round.

An automated check is worth keeping: `position(lower(word) in lower(clue_text))`
caught three A-level clues hiding their own answer — *"Monday is my favourite
______ of the week"* (DAY), *"My bedroom is the biggest ______"* (ROOM), *"...says
three o'clock"* (CLOCK). It also caught a replacement clue written with no blank
in it.

## 8. question_bank fixes (unrelated to the crossword)

A student asked what "thois" meant. It was real — a typo in the explanation for
**question 1279**, in a sentence that was also garbled independently of it.
Rewritten. A full sweep of all 55 tables and all 3,113 questions then found:

- **689** — mismatched quote marks plus a comma splice. Fixed.
- **475** — space before a full stop in `hint2`. Fixed.
- **33 rows** — stray leading/trailing spaces and double spaces in `explanation`.
  Stripped.
- **No misspellings at all** across ~50 common typo patterns. "thois" was a
  one-off, not a symptom.

**Left deliberately, still open: 272 explanations use markdown bold (`**word**`),
all in questions 2370–2641, added 1–9 July.** Nothing else in the bank does this.
If the app renders explanations as plain text, every student hitting that range
has been seeing literal asterisks since July. Check how question 2448 renders
before deciding — stripping them is a one-line regex.

Also unfixed, by choice: **439** reads "verbs like like, hate, enjoy" (correct but
it stumbles) and four explanations at 146, 179, 184, 187 are far terser than the
house style.

## 9. Open

**Spanish gap-fill (166 words).** Not started, deliberately. The English levels
were written unsupervised; Spanish shouldn't be, because a slightly-off
preposition or a Peninsular/Latin American split passes every check available
here and still reads wrong to a fluent speaker. Needs ~20 minutes of review. No
UI or generator change required when it lands — see section 5.

**Whether the recalibration worked.** Too early. At the three-day mark B
completion appeared to fall from 83% to 33%, but that's 3 attempts by 2 players,
and C — which didn't change — moved the same direction, so it's noise. Give it to
roughly 25 Sep, use A and C as controls, and prefer `hints_used` over `completed`
as the early signal since completion lags. **The B1/B2 split is parked on this
result.** If B now behaves like a middle tier, a fourth daily puzzle is cost
without benefit.

**Star words repeat across generator runs.** Nine of October's B stars were also
September's, mostly ~3 weeks apart (CIRCUMSTANCE 15 Sep → 7 Oct, CONCENTRATE
16 Sep → 8 Oct, AUTHORITY 11 Sep → 20 Oct). `stars_seen` in `build_batch` only
dedupes within one run. Seeding it from the last 60 days of existing puzzles at
the start of a run would fix it.

**The B bank is effectively exhausted each month.** October's B puzzles used 283
of the 287 available words. The freshness weighting therefore has almost nothing
to choose between and every word recurs roughly monthly whatever the logic does.
More vocabulary is the only real lever — and 287 words split across B1 and B2
would leave each thinner than A is now, which is a second argument against the
split.

**C definitions have not had the sense-check the gap-fills got.** The two clue
types sometimes point at genuinely different senses of the same spelling — FAVOUR
gives the noun in the sentence and the verb in the definition; FORWARD gives
direction versus forwarding an email. That's good teaching material, but it's
unaudited.
