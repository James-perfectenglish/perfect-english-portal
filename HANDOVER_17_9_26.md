# HANDOVER — 17 September 2026

**Session type:** October daily content. **DB only — no code changed, nothing to push.**
Follows `HANDOVER_14_9_26_morning.md` (crossword recalibration, which also generated
October's crosswords).

## 1. State at close — read back from the database, not from the inserts

Every daily stream now runs to **31 October 2026**, 31 rows over 31 days, no gaps:

| Stream | October rows |
|---|---|
| Wordle | 31 EN + 31 ES |
| Spelling Bee | 31 EN + 31 ES |
| Connections | 31 + 31 boards, 124 + 124 groups |
| Word of the Day | 6 tracks × 31 = 186 (includes ES B1/B2 and C1/C2) |
| Crossword | en A/B/C + es A × 31 (14 Sep session) |
| Wordsearch | 31 EN + 31 ES (run by James during this session; seed not recorded here) |

Integrity checks run after insert, all zero:
- Spelling Bee: bad letter sets, pangrams missing from `word_lists`, pangrams reused.
- Wordle: answers missing from `word_lists`, reused answers.
- Word of the Day: words reused from earlier months, duplicates within October.
- Connections: boards without exactly 4 groups, 4 ranks and 16 distinct tiles.

**The next cliff is 31 October, and it takes every stream at once, crossword included.**

## 2. Spelling Bee — a word-count floor, finally

The September problem (EN days where Genius or Queen Bee was impossible) came from
choosing letter sets without counting. This time every candidate was counted against
`word_lists` before selection. The count covers words of 4+ letters containing the centre
letter and using only the seven letters.

**Rule applied: at least 100 dictionary words for the chosen centre**, so Queen Bee is
always reachable. Candidates also had to have enough *common* words (via the `wordfreq`
Python package, zipf ≥ 3), so the day is playable for learners and not just for Scrabble players.

- Other constraints: the centre never repeats on consecutive days and no centre is used
  more than twice. That gives 19 distinct centres in EN and 18 in ES.
- ES centres were chosen to keep daily counts at or below about 900.
- `valid_words` stays `'{}'` and `max_score` stays 0, as in September. The per-day counts
  below are therefore the only record of them, and they are what the thresholds work needs.

EN (pangram, centre, words): 1 harvest e 444 · 2 concierge c 108 · 3 pancakes a 174 ·
4 interview i 142 · 5 umbrella b 135 · 6 toiletries i 305 · 7 departure r 262 ·
8 chocolate o 117 · 9 strategy y 106 · 10 wardrobe d 189 · 11 chestnut s 168 ·
12 calendar n 151 · 13 cashier h 186 · 14 postcode p 165 · 15 vinegar v 131 ·
16 delivery r 147 · 17 cardigan g 106 · 18 bathrobe t 201 · 19 nervous u 111 ·
20 supplier l 186 · 21 porridge g 104 · 22 timetable m 111 · 23 cocktail l 102 ·
24 director c 158 · 25 snorkel s 184 · 26 chemist h 124 · 27 bonfire e 103 ·
28 witches t 157 · 29 costume m 119 · 30 skeleton o 174 · 31 haunted a 108

ES: 1 octubre b 158 · 2 vendimia v 249 · 3 bocadillo d 418 · 4 alumnos l 399 ·
5 recepcion r 625 · 6 zanahoria a 444 · 7 delfines e 322 · 8 gramatica g 181 ·
9 empleado o 428 · 10 periodico i 258 · 11 bicicleta c 348 · 12 aeropuerto u 253 ·
13 chimenea m 266 · 14 magdalena n 359 · 15 nervioso s 696 · 16 pelicula p 209 ·
17 fregadero d 481 · 18 servicio v 269 · 19 abuelos u 204 · 20 pimiento t 295 ·
21 ciruela i 575 · 22 chaqueta a 207 · 23 membrillo e 280 · 24 vecinos n 541 ·
25 golosinas g 360 · 26 desierto t 717 · 27 hojarasca o 667 · 28 chocolate h 258 ·
29 esqueleto s 230 · 30 vampiro m 226 · 31 disfraz r 503

Rejected pangrams, and why:
- **`halloween` is not in `word_lists`.** Players typing it in any bee get "Not a word".
- **Below 100 words at every centre:** pumpkins, colleague, promotion, crumble,
  cheerful, foliage, motorway, pavement (EN); equipaje, 88 words (ES).
- **Too productive:**
  - `trainers` (1,002 words, 56 pangrams). `aeinrst` is English's most prolific set.
  - `tormenta` (2,680), `ascensor` (4,372), `semaforo` (1,842), `ensaimada` (1,772),
    `caramelo` (1,682).
- **Letter set already used:** `temperatura` has the same set as 22 Sep's `permuta`.

## 3. Wordle

- **First Ñ answer: OTOÑO on 1 October.** I checked all three places that could break it
  before inserting. The ES keyboard has Ñ, `handleKeyDown` accepts it, and
  `export_wordle_words.py` keeps `[a-zñ]`.
- `display_word` is set on the five accented answers (salón, ratón, éxito, móvil, limón).
- RADIO keeps `display_word` null, because the dictionary also holds *radío*.
- Pinned dates: `witch` and BRUJA on 31 October.
- Ordering rules: no two consecutive answers share a first letter, and the longest
  ascending run is 3 in both languages.

## 4. Connections

**English, 12 structural boards:**
- Phrasal verbs: OUT by sense, and APART / ALONG / AHEAD / AFTER.
- Verb + particle: WITH / FOR / INTO / BY.
- Adjective + preposition.
- Silent L/T/G/P.
- Tricky plurals.
- Irregular past simple, with category names using "infinitive".
- Homophones ("Sounds like a…").
- British or American.
- Compounds (+BALL / FALL / PAPER / STORM).
- Prefixes (RE / MIS / PRE / OUT).
- Suffixes (-SHIP / -HOOD / -DOM / -ANCE).

**English, 19 topical boards:** autumn, café, hotel check-out, nature, work, sport,
island life, airport, science, office, spice rack, around town, moving house, back to
class, gym, outfits, celebrations, film night, Halloween.

**Spanish:**
- The topical boards are mirrored on the same dates, in A2-friendly vocabulary.
- There are 12 Spanish structural boards: special letters (CH/Z/RR/Ñ), stress and the
  written accent, POR/DE/EN/PARA expressions, irregular preterites (U/J/I/Y), short
  function words, singular/plural, word families (-ERÍA/-ERO/-ERA, fruit trees),
  verb + noun (PONER/TOMAR/SACAR/PERDER), prefixes (RE/IN/DES/SUPER), numbers, tense
  markers, and Spanish–English (false friends, anglicisms, false anglicisms).

**Overlap with the back catalogue**, checked from the database after insert:
- Every board is now at 7/16 or below.
- 16 October was a retread in both languages: music scored 9/16 against "Strike a chord"
  and 8/16 against "La música". Both were replaced with science boards, now at 4/16.
- Still at 7/16, within the July tolerance: EN 26 (vs "Learning English"), EN 28
  ("Colours and light"), ES 26 ("Aprender idiomas"), ES 28 ("Ropa y estilo").
- **Topical boards are now the ones that retread.** Everyday themes are close to spent,
  so check overlap before drafting next month, not after.

**Category names reused from earlier boards:** 17 EN and 21 ES generic names (Birds,
Flores, Tejidos…). The tiles differ. This is noted only because the August and September
handovers tracked it.

Particles now used as particle-first sets: AWAY, BACK, DOWN, IN, OFF, ON, OVER, THROUGH,
UP, OUT, APART, ALONG, AHEAD, AFTER, WITH, FOR, INTO, BY. Still unused: AROUND/ROUND,
ACROSS, TOGETHER, FORWARD, ASIDE.

## 5. Anti-spoiler rules applied across streams — keep these

**Same-day rules** (same language):
- **Connections vs Wordle and Bee.** The day's Wordle answer or bee pangram never appears
  on that day's Connections board, whether as a tile, the title or a category.
  - This forced two renames. ES 1 October was going to be "Días de otoño", with OTOÑO the
    Wordle answer; it is now "Cambio de estación".
  - ES 31 October's costume group was going to be "Disfraces", with *disfraz* the bee
    pangram; it is now "¿De qué vas vestido?".
- **The word itself.** A Word of the Day never equals the day's Wordle answer, bee
  pangram, a Connections tile or category word, or a combined form from a compound or
  affix board. For example, *refund* cannot run on the RE + FUND day.
- **Definitions and examples.** These never contain the day's Wordle answer, the bee
  pangram, or any Connections tile of 4+ letters.
- **Accepted exception:** *autumn* (A1/A2, 1 October) shares a word with that day's
  category names ("Autumn weather", "Picked in autumn"). It gives nothing away.

**Checks the automated rules miss:**
- The stem check does not catch inflections. The C1/C2 example for *crepúsculo* on
  10 October said *Paseamos…* on a PASEO Wordle day. It was reworded to *Caminamos por la
  orilla al crepúsculo* before insert. Read the examples yourself; don't rely on the check.
- **DÍMELO and DÁSELO are esdrújulas, not sobresdrújulas** (three syllables, stress on
  the antepenultimate). Both were caught and replaced before insert. The live group is
  CÓMPRATELO, EXPLÍCAMELO, DÍGAMELO, DEVUÉLVEMELO.

## 6. Word of the Day

186 rows. Every word is new to the table in its language, at any level.

**Seasonal words are pinned:**
- 1 October: autumn, seasonal, autumnal.
- 30–31 October: macabre and eerie (EN C1/C2); calabaza, escalofrío, escalofriante,
  asustar and macabro/a (ES).

**Spanish conventions followed:**
- Definition and example in Spanish.
- Part of speech in English, with gender marked.
- Variable adjectives written as `-o/a`.
- Multi-word entries (*echar de menos*, *darse cuenta*) follow the existing `a través`
  precedent.

Dates were shuffled under the rules in §5. No two consecutive words share a first letter,
and the longest ascending run is 3 (4 for ES B1/B2).

## 7. Open

1. **November content.** Every stream, crossword included, ends 31 October. Target
   around 22 October. The B crossword bank will again be close to exhausted (see
   14 September §9).
2. **Runway warning on the Teacher Dashboard** ("Wordle: 14 days left"), from the
   16 September review. It would stop this depending on memory.
3. **Spelling Bee thresholds.** The per-day counts in §2 are the data this was waiting
   for. Storing a word count per puzzle at generation time would make it permanent.
4. Carried and unchanged:
   - 272 explanations with literal `**bold**` (questions 2370–2641).
   - Wordle double-Enter (`locked` into `stateRef`).
   - PWA update check in `main.jsx`.
   - Spanish gap-fill crossword clues.
   - Crossword star-word dedupe across runs.

Working files for this session lived in Claude's sandbox and are not in the repo. The
content is in the database only.
