# HANDOVER — 19 October 2026

A feature session: the new daily game **Word Bluff** (a "Call My Bluff" format:
five words a day per level, three definitions, one real) went from content to a
playable screen. Planning and content were done on 9 October (no handover was
written then); this one covers both. Everything below was re-verified against
the live DB and the built code before writing.

**Not yet deployed.** The code is in the working tree; nothing is committed.
The DB changes are live (they are additive and harmless to the deployed app).

## 1. What exists now

**Database (live)**
- `bluff_words`: 105 rows, **1–7 November** only, 5 per level A/B/C per day.
  Audio columns all empty (`audio_word_url` null on all 105). Constraints:
  unique `(play_date, level, position)`; a word can be introduced only once per
  level (partial unique index where `returning_from is null`); `contexts` must
  contain a `[[marker]]`; exactly 3 `options`. RLS: authenticated read.
- `bluff_sessions` (new today): one row per student/date/level, `answers` jsonb
  keyed by `bluff_words.id`, `correct_count`, `completed`, `sentence_done`,
  `sentence_star`. RLS mirrors `connections_sessions` (own rows; teacher reads
  all). 0 rows.
- `exercises`: new row **Word Bluff**, category `play`, type `bluff`, level
  Everybody, tracks `{general}`, `recommended_order` 45 (between Connections
  and Crossword).

**Code (working tree, not committed)**
- `src/BluffGame.jsx` (new): the game. Route `/bluff`.
- `src/App.jsx`: `/bluff` route for students and teachers (+3 lines).
- `src/ExerciseList.jsx`: the three registration points, plus two small
  general mechanisms: `LAUNCH_DATES` (a tile shows "Soon" to students until its
  date; teachers can open it straight away; no deploy needed on the day) and
  `ENGLISH_ONLY` (hides a tile from Spanish-track learners). Word Bluff is in
  both, launch date **2026-11-01**.
- `src/Progress.jsx`: `bluff` added to `NAMED` and a 🃏 Word Bluff star tile.
- `CLAUDE.md`: `bluff` added to star sources; a Word Bluff section.
- `scripts/bluff/generate_bluff_audio.py` + `run-bluff-audio.sh` (written
  9 Oct): ElevenLabs audio, dry run by default.

## 2. How the game behaves

- Level from the profile (A*/B*/C*), with A/B/C pills to switch, as Crossword.
- Each word: big word + 🔊, part of speech, 1–2 context sentences with the word
  highlighted, each with 🔊 (buttons only appear when audio URLs exist). Three
  definitions; tap one → real one goes green, a wrong pick red, the reveal note
  appears, "Next word →". Answers are final.
- Saved to `bluff_sessions` after **every** answer, so a refresh resumes on the
  next unanswered word and an answer can't be changed (the Wordle lesson). If
  all five were answered but the app closed before the results screen, the set
  is finalised on reopen.
- Results: score, dots, stars, a sentence challenge (pick any of the five
  words; marked by `mark-free.js` in its existing `wotd` mode with the word's
  real definition, so no API change), and a review of all five with the real
  definition, "You chose: ~~…~~", sentences, audio and notes.
- **Stars** (source `bluff`): `complete` (finished the set), `sharp_eye`
  (4+ of 5 right), `sentence`. Dedupe `bluff:<date>:<level>:<subtype>`. Max 3
  per level per day, the same shape as Connections. Chosen so not knowing a word
  isn't punished: the point is meeting new words.
- **Teachers** (anyone with `is_teacher`, so Present Mode too) play without
  saving anything, can ↺ replay, and get a bar with ‹ › to step through every
  day's set ("Live today" / "Goes live Sun, 1 Nov"). Good for checking content
  and for class.
- **Not logged to `student_answers`**: its `question_id` is joined to
  `question_bank` in Progress, so bluff ids would corrupt the type breakdown.
  `bluff_sessions` holds everything needed for analysis and per-student recycling.

## 3. Verified

- Full `vite build` of the app passes; `eslint` clean on `BluffGame.jsx`; the
  three edited files have exactly the same lint count as before.
- The game was run in headless Chromium at phone width against a stand-in
  Supabase loaded with the real November words: 27/27 checks passed
  (answer/reveal, save after each answer, answers keyed by id, star subtypes and
  dedupe keys, resume, finalise-on-reopen, teacher writes nothing, teacher date
  stepping, "Seen before" badge, no audio buttons without audio, the "Soon" tile
  before 1 Nov, active from 1 Nov, hidden for Spanish track, active for teacher).
- Not tested against the real Supabase or on a real device yet.

## 4. To do before / around 1 November

1. **Deploy** (commands at the end).
2. **Generate audio:** `sh scripts/bluff/run-bluff-audio.sh --commit --limit 3 --save-local ~/Desktop/bluff-test`,
   listen, then `--commit` for the rest. Needs `ELEVENLABS_API_KEY` and
   `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. The game works without audio.
3. **Content runs out after 7 November.** From 8 Nov students see "New words on
   the way". The rest of November (8–30: 23 days × 15 = 345 words) is the next
   content job; same rules: definitions below the word's level, A/B lures from
   Spanish false friends, `[[markers]]`, plain-text notes, Alice/Daniel rotation
   by `(days since 1 Nov + level index) % 2`.
4. Check on a phone as the teacher now (Play → Word Bluff), and as María from
   1 November for the full student flow with stars.

## 5. Open / parked

- **Recycling** (agreed on 9 Oct, not built): (a) one returning word per set
  after ~3 weeks in a new context (`returning_from`); (b) the content script
  also feeds new words to `crossword_clue_bank`, later WOTD slots and Wordle's
  five-letter queue. Nothing automates this yet.
- 6 November B: *preservative* with the lure "a condom". A classic false
  friend; swap it if it's too cheeky for the group.
- Progress streak and the Teacher Dashboard don't read `bluff_sessions` yet.
- The name "Word Bluff" lives in `GAME_TITLE` in `BluffGame.jsx`, the
  `exercises.title`, and the three ExerciseList entries. Rename all together.
- ElevenLabs **Turbo v2 is deprecated**; Flash v2 is the English-only
  replacement (the bluff script uses it for single words). Worth knowing for any
  other audio work that used Turbo for isolated words.

## Deploy

```
git add src/BluffGame.jsx src/App.jsx src/ExerciseList.jsx src/Progress.jsx CLAUDE.md HANDOVER_19_10_26.md scripts/bluff
git commit -m "Word Bluff: daily vocabulary game, launch 1 Nov"
git push
```
