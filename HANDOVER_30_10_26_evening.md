# HANDOVER — 30 October 2026 (evening)

Story Scramble for 9 Nov is in the DB. The Spanish Word Bluff, **Verdad o farol**, is built
but not shipped. It is waiting on, in order: a migration approval, a push, the content insert
and the audio. Everything below was checked against the live DB and the files at close.

## 1. State at close

| Piece | Status |
|---|---|
| Story Scramble, 9 Nov | 5 texts live in `scramble_texts`: EN A2 "A Kind Stranger", B1 "The Lighthouse Painting", B2 "The Eleventh Name" (Remembrance week), C1 "A Rare Visitor", ES A2 "El paraguas rojo". **8 sentences each** (James is trialling the shorter length in class and will report back). Every jumble starts with 0 links. Two blind solves: on the first, A2 had a second valid order and was rewritten. |
| Story Scramble, 16/23/30 Nov | Not written yet. James wants class feedback on length first. |
| Migration `bluff_spanish_language` | **NOT applied.** The approval prompt timed out three times while James was away. The SQL is in §5. |
| Code (uncommitted) | `src/BluffGame.jsx`, `src/ExerciseList.jsx`, `scripts/bluff/generate_bluff_audio.py`. **Not esbuild-checked**: this session had file access to the Mac but no shell. |
| Spanish Bluff content | 300 rows (levels A and B, 1–30 Nov, 5 a day, returning words 22–30 Nov), saved as project doc `claude/verdad_o_farol_nov_2026.sql` in 5 chunks. **Not inserted.** |

## 2. Ship order (the order matters)

1. **Apply the migration.** Safe for the live app: it adds `language` (default `'en'`) to both
   tables, moves the bluff_words keys onto `language`, and adds a new sessions key. The old
   sessions key stays, because the live code upserts on it.
2. **esbuild both JSX files, then commit and push the three files. Do not push before step 1.**
   The new BluffGame filters every query on `language`, so without the column the English
   game would break.
3. **After the deploy is live, insert the 5 chunks in order.** The returning rows look up days
   1–9. Doing it before the deploy would mix Spanish words into the English game, because the
   old code doesn't filter on language. Then check: 150 rows per level, 5 per day, 9 returning
   per level.
4. **Audio:** `sh scripts/bluff/run-bluff-audio.sh --lang es` (dry run), then add `--commit`.
   It needs about 18k credits: about 4.7k word characters on flash v2.5 at half rate, plus
   15.4k sentence characters on multilingual v2. Check the API key's remaining credit first,
   because today's WOTD/PVOTD run used a lot.
5. **After the deploy,** drop the old key `bluff_sessions_student_id_play_date_level_key`.
6. **Update the Word Bluff section of CLAUDE.md** with: the language column, the Spanish
   levels A/B, `ENGLISH_ONLY` now empty, `SPANISH_TITLES`, and the es dedupe keys.

## 3. Code changes

**BluffGame**
- Spanish-track users (`tracks` includes `'spanish'`, or level `'Spanish'`) get language `es`.
- Spanish has levels A and B only. Profiles with level `Spanish` start at A. If a teacher
  flips the preview from C to Spanish, C drops to B.
- Every bluff_words and bluff_sessions query filters on `language`. The session upsert is
  `onConflict: 'student_id,play_date,language,level'`.
- Dedupe keys for stars and sentences are `bluff:<date>:es-<level>:<subtype>`. The English
  keys are unchanged.
- The title, breadcrumb and SentenceChallenge label read "Verdad o farol", and
  SentenceChallenge runs with `language="es"`.
- The help sheet has an extra line: definitions are in simple Spanish, 💡 notes in English.
- The "English only for now" screen is gone.
- The game reloads when a teacher flips the preview language.

**ExerciseList**
- Word Bluff is out of `ENGLISH_ONLY`, which is now empty.
- New `SPANISH_TITLES` shows "Verdad o farol" on the tile in the Spanish view. The title
  stays the join key everywhere.

**generate_bluff_audio.py**
- `es_f`/`es_m` (Carolina/Alex) are in `ES_VOICES`. `VOICES` stays English-only, because
  generate_daily_audio imports it as its English voices.
- Spanish words use `eleven_flash_v2_5` with `language_code: es`.
- `x/a` words are read as both forms, as in the WOTD script.
- Clips are stored at `bluff/<date>/es-<level><pos>-…`.
- New flag: `--lang en|es|all`.

## 4. Content decisions

- **Language:** definitions are in simple Spanish (like ES WOTD); notes are in English (like
  ES Story Scramble).
- **Level A:** false friends (embarazada, carpeta, éxito, constipado, sopa, once…) plus
  everyday Spanish words (vale, cortado, chiringuito, ensaimada…).
- **Level B:**
  - false friends: realizar, pretender, actualmente, sensible, suceso, preservativo…
  - colloquial Spain Spanish: cutre, majo, flipar, currar, pringado, guiri…
  - expat paperwork: empadronarse, cita previa, gestoría, fianza, nómina…
  - Mallorca: sobrasada, tramontana, calima.
- **Teach then test:** 17 B words and 3 A words are ES WOTD words from earlier in November,
  tested on a later day with the WOTD meaning.
- **Checks run:**
  - The real definition is the longest option in 32% (A) and 31% (B) of rows. Picking the
    longest wins 35–37% of the time (chance is 33%); picking the shortest wins 13% / 10%.
  - Every set uses a, b and c, with none more than twice.
  - No same-day clash with ES WOTD (word, definition or example), Wordle, the Bee pangrams
    or Connections tiles. This was checked with a query, and a positive control confirmed
    the query catches clashes.
- **Reviews:** two independent reviews; about 65 fixes applied, mostly bluffs that turned
  out to be genuine senses (celoso = zealous, probador = tester, coche autónomo, a lo loco,
  torpe = sluggish…).
- **preservativo** (B, 11 Nov) is defined as "un condón…". It is the classic false friend.
  Drop it if it's too cheeky.

## 5. Migration SQL (for step 1)

```sql
ALTER TABLE public.bluff_words
  ADD COLUMN language text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'es'));
ALTER TABLE public.bluff_words DROP CONSTRAINT bluff_words_play_date_level_position_key;
ALTER TABLE public.bluff_words
  ADD CONSTRAINT bluff_words_lang_date_level_position_key UNIQUE (language, play_date, level, position);
DROP INDEX public.bluff_words_one_intro_per_level;
CREATE UNIQUE INDEX bluff_words_one_intro_per_level
  ON public.bluff_words (language, level, lower(word)) WHERE returning_from IS NULL;
ALTER TABLE public.bluff_words DROP CONSTRAINT bluff_words_voice_check;
ALTER TABLE public.bluff_words
  ADD CONSTRAINT bluff_words_voice_check CHECK (voice IN ('alice', 'daniel', 'es_f', 'es_m'));
ALTER TABLE public.bluff_sessions
  ADD COLUMN language text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'es'));
CREATE UNIQUE INDEX bluff_sessions_student_date_lang_level_key
  ON public.bluff_sessions (student_id, play_date, language, level);
```

## 6. Lessons

- **Story Scramble dialogue lines move too easily.** In "A Kind Stranger", the line "Buy me a
  coffee instead" fitted both straight after Ben's promise and at the end. The fix was to
  anchor it to the line before ("Yes, it's me! Welcome to the team…").
- **Bluff length bias came back.** The first Spanish draft had the real definition as the
  longest option in about 70% of rows, the same as the English first draft. Write detailed
  bluffs from the start and run the length check straight away.
