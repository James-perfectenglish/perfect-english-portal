# HANDOVER — 27 October 2026

Audio for Word of the Day and Phrasal Verb of the Day, the same way as Word Bluff: a 🔊
button by the word/phrasal verb and by the example sentence. Schema and code are done;
**no audio has been generated yet** (ElevenLabs is not reachable from Claude's sandbox,
so James runs the generator). Checked against the live DB and the repo at close.

## 1. State at close

| Piece | Status |
|---|---|
| Migration `wotd_pvotd_audio_columns` | applied: `voice`, `audio_word_url`, `audio_example_url`, `audio_check_pending` (bool, default false) on both tables; all rows still null/false |
| `scripts/audio/generate_daily_audio.py` + `run-daily-audio.sh` | new; reuses the Bluff helpers; text rules unit-tested; SQL run against live DB |
| `src/components/SpeakButton.jsx` | new: `SpeakButton` (moved out of BluffGame, adds `colour` prop) + `useAudioPlayer` hook |
| `src/BluffGame.jsx` | local `SpeakButton` removed, imports the shared one; nothing else changed |
| `src/WordOfTheDay.jsx`, `src/PhrasalVerbOfTheDay.jsx` | 🔊 by the word and the example (expanded card only) |
| `CLAUDE.md` | new "WOTD / PVOTD audio" section |
| Validation | esbuild parse + bundle (packages external) clean on all four JSX files |
| Code | **not committed** (`scripts/crossword/generate_batch.py` also has James's own uncommitted change; left alone) |

## 2. To finish

1. Commit and push the files above. Safe to ship first: no URL means no button.
2. `sh scripts/audio/run-daily-audio.sh` (dry run), then `--commit` for English: 105 WOTD rows (27 Oct–30 Nov) + 200 PVOTD, ≈ 13,300 credits.
3. Listen to the 4 flagged word clips in `~/Desktop/audio-check`: WOTD #1064 refund (30 Oct), #1237 upset (18 Nov); PVOTD #107 wind down, #112 live up to. Then `--table wotd --approve 1064,1237` and `--table pvotd --approve 107,112` (or redo with `--ids … --force --commit`).
4. Spanish: audition the two candidate Castilian voices (Carolina `UOIqAnmS11Reiei1Ytkc`, Alex `7ilYbYb99yBZGMUUKSaf`) in the ElevenLabs Voice Library and add them to My Voices; swap IDs in `ES_VOICES` if preferred. Then `--lang es --commit` (≈ 8,000 credits). 18 ES PVOTD patterns with `+` are flagged ("estar más gerundio") and need an approve.
5. Monthly content top-up: after loading a new month of WOTD, run `--lang both --commit`.

## 3. Decisions

- Back catalogue of past WOTD rows not voiced (≈ 55k credits); the app only shows today's word.
- Heteronym handling: flag and listen, not phoneme tags. The list is `HETERONYMS` in the script.
- ES words use `eleven_flash_v2_5` with `language_code: es` so short words that look English ("red", "pie") stay Spanish.
