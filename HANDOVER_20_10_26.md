# HANDOVER — 20 October 2026

A short content session while James was busy. No code changes. Re-verified
against the live DB before writing.

## 1. Deploy check

`Word Bluff: daily vocabulary game, launch 1 Nov` (commit `96e6caa`) built and
is READY in production on Vercel.

## 2. Word Bluff content: all of November now exists

- `bluff_words` = **450 rows, 1–30 November**, 5 per level A/B/C per day,
  positions 1–5 every set, one voice per set (Alice/Daniel rotation unchanged).
- **8–30 Nov written today**: 318 new words (106 per level) + 27 returning.
- **Recycling inside the game is live in the data**: from 22 Nov, position 5
  is a word from 21 days earlier (22 Nov ← 1 Nov ... 30 Nov ← 9 Nov), with the
  same real definition, a new sentence and new bluffs, `returning_from` set.
  The game already shows these with a "🔁 Seen before" badge. So 22–30 Nov sets
  are 4 new + 1 returning. Delete those 27 rows (`returning_from is not null`)
  if you'd rather not.
- No word is introduced twice anywhere (also checked across levels). Every
  `[[marker]]` matches its word. No asterisks or stray spaces.

## 3. Two test-design fixes, applied to all 450 rows (week 1 included)

1. **Length giveaway.** The real definition was the longest option in 83–95%
   of rows, so always picking the longest scored about 9/10. Every bluff was
   rewritten to match the real definition in length and detail. Now the real
   one is longest in 25% (A), 39% (B), 31% (C) of rows and almost never much
   longer. Two bluffs that were genuine other senses of the word were replaced
   along the way ('outgoing' = leaving a job; 'reticent' = reluctant), plus a
   few risky ones (jammy, sniffy, patron, handy, obsequious, trip, wipe, change).
2. **Answer-letter runs.** 14 sets had the same letter 4–5 times. Every set now
   uses a, b and c with none more than twice. Overall: A 49/52/49, B 52/50/48,
   C 52/46/52.

A checksum over id, word, real definition, correct letter, note and sentences
was identical before and after both fixes: only the bluffs and option order
changed. The approved week-1 sample therefore has new bluff wording; the words,
sentences, real definitions and notes are as approved.

Both rules are now in CLAUDE.md's Word Bluff section.

## 4. Still to do

1. **Audio:** none generated yet (0 of 450). The month is 25,953 sentence
   characters (Multilingual v2) + 3,426 word characters (Flash v2), so roughly
   28–29k credits. `sh scripts/bluff/run-bluff-audio.sh` (dry run), then
   `--commit --limit 3 --save-local ~/Desktop/bluff-test`, listen, then `--commit`.
2. **Review in the teacher view:** Play → Word Bluff, ‹ › steps through every
   day. Nothing is saved as teacher.
3. **Every other daily stream ends 31 October**: Wordle, Spelling Bee,
   Connections, Wordsearch, Crossword, WOTD all have their last row on 31 Oct.
   The November top-up is due before then.
4. Recycling into the other games (feeding Word Bluff words to the crossword
   clue bank, WOTD, Wordle) is still not built.
5. December Word Bluff content: needed before 1 Dec. Returning words for
   1–21 Dec come from 10–30 Nov.
