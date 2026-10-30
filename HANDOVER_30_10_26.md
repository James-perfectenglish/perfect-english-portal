# HANDOVER — 30 October 2026

Audio for Word of the Day and Phrasal Verb of the Day is now generated and live. This
finishes the work in HANDOVER_27_10_26.md. Everything below was checked against the
live DB and the repo at close.

## 1. State at close

| Piece | Status |
|---|---|
| WOTD audio | 192/192 rows from 30 Oct to 30 Nov have word + example clips (EN 96, ES 96). Rows before today were not voiced (not shown any more) |
| PVOTD audio | 290/290 active rows (EN 200, ES 90) |
| `audio_check_pending` | 0 rows in either table. All flagged clips listened to and approved by James (refund, upset, wind down, live up to; 18 ES "+" patterns) |
| PVOTD EN examples | 32 rows changed to natural contractions before voicing (Let's, I'll, it's, don't, can't, I'd, I'm, we've, we'll, wouldn't, doesn't). Ids 7, 11, 12, 13, 23, 33, 34, 36, 41, 48, 55, 56, 65, 70, 72, 74, 83, 89, 90, 95, 115, 116, 118, 123, 126, 157, 168, 176, 181, 184, 193, 199. #7 also split a comma splice ("Put on your jacket. It's cold outside.") |
| Script | `generate_daily_audio.py` stops at the first `quota_exceeded`, and no longer flags Spanish entries (the "+" patterns all read fine as "más") |
| Commits | `b4524da` feature, `0cc2308` script fixes; both pushed, `main` = `origin/main` |
| Uncommitted | `scripts/crossword/generate_batch.py` (James's own change, untouched) and this handover |

## 2. Lessons

- The ElevenLabs API key "Perfect English" had its own **40,000-credit cap**, separate from
  the 90,000/month plan. The first run hit it after 277 rows; James raised it to **90,000**
  (same as the plan) and re-ran. Plan credits renew on the billing date, not the 1st.
  ElevenLabs doesn't document whether a key's cap resets each cycle or is a lifetime total:
  check the key's usage on the API keys page just after the next renewal. If it hasn't gone
  back near zero, the cap is lifetime and needs raising from time to time.
- Uncontracted example sentences read aloud sound stilted, and "Let us…" sounds like asking
  permission. Check examples for this before voicing any new batch.

## 3. Next

- After each monthly WOTD top-up: `sh scripts/audio/run-daily-audio.sh --lang both` (dry
  run), then `--commit`. Listen to any flagged English word in `~/Desktop/audio-check` and
  `--approve`. Next one is due before 1 Dec (WOTD runs out on 30 Nov).
- New PVOTD rows get audio the same way. Already-voiced rows are skipped.
