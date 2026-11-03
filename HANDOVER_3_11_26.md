# HANDOVER — 3 November 2026

Question-bank freshness push, all 4 batches: 575 new qs, 3114–3688. Every claim below was checked against the
live DB and the files at close.

## 1. Why

Regular users have used up the bank. Belinda has seen 81–82% of the A1 and A2 pools,
each question about 17–20 times on average. Jon has seen 93–94% of C1 and C2. Weekly
practice answers fell from 1,000–1,800 (late Aug to early Sep) to under 100. Pools per
type were very uneven. The stalest were the C1/C2 side types: each item was served
12–19 times in 120 days, against 1.5–3.6 at B1/B2.

## 2. Shipped

| Piece | Status |
|---|---|
| Bathroom tiles | `Bathroom Vocabulary 🛁`, `Borrás Flashcards`, `Borrás Memory Game` set to `category = 'archived'` (James ran the UPDATE). To undo: set the first two back to `'learn'` and the Memory Game back to `'play'`. No bathroom content to be written for now. |
| `question_seen_map()` RPC | Live (migration `question_seen_map`). SECURITY INVOKER, filters on `auth.uid()`, returns one jsonb row. 17 ms for Belinda (16k answers). Tested as María: 164 keys, and access rules let her see only her own rows. |
| `qb_staging` table | Live (migration `qb_staging`). RLS on with no policies, so the app can't see it. Batch 1 rows are labelled `batch = 'b1'` and left in place. |
| Code commit `ce2a457` | **Committed, NOT pushed.** It changes `src/lib/questionFreshness.js` (uses the RPC, all-time history, falls back to the 30-day read), `src/components/SurvivalMode.jsx` (new `userTracks` prop; skips `bathroom_vocabulary` without the bathroom track) and `src/components/PracticePage.jsx` (passes the prop). All three parse with esbuild. James: `git push`. |
| Batch 1 content | **3114–3308 live, 195 rows.** Pool sizes after the batch are in §3. |
| CLAUDE.md | Updated: last question number, batch workflow, freshness, parked bathroom content. Not committed: it also holds the 30 Oct Verdad o farol notes. |

## 3. Batch 1 detail (3114–3308)

| Type | Level | New | Numbers | Pool now |
|---|---|---|---|---|
| odd_one_out | C1 | 20 | 3114–3133 | 41 |
| odd_one_out | C2 | 20 | 3134–3153 | 37 |
| matching | C1 | 20 | 3154–3173 | 44 |
| matching | C2 | 15 | 3174–3188 | 29 |
| error_correction | C1 | 30 | 3189–3218 | 73 |
| error_correction | C2 | 20 | 3219–3238 | 34 |
| sentence_building | C1 | 25 | 3239–3263 | 62 |
| sentence_building | C2 | 20 | 3264–3283 | 34 |
| multiple_choice | C2 | 25 | 3284–3308 | 63 |

**Checks run before the copy:**
- Error correction: every item fixable by exactly one tile, either replacing one token or removing one.
- Sentence building: every sentence can be built from its tiles; all tiles lowercase except I, I'm/I'd/I'll and proper nouns; 3 spare tiles each, chosen so they can't make a second valid sentence.
- MC and odd one out: the answer is in the options, with 4 distinct options.
- Matching: 4 pairs, with distinct right-hand sides.
- Duplicates: 2 error-correction items repeated lower-level qs (B2 2063, B1 839) and 2 matching pairs overlapped B-level sets (919, 3057). All four were replaced before insert.

**Topics:** mostly general (vocabulary, grammar, collocations, idioms, inversion, formal_register). Some are hotel_vocabulary or business_vocabulary, which only reach students with those tracks.

## 3b. Batch 2 detail (3309–3488, `qb_staging` batch `b2`)

| Type | Level | New | Numbers | Pool now |
|---|---|---|---|---|
| odd_one_out | A1 / A2 | 15 / 15 | 3309–3323 / 3324–3338 | 31 / 39 |
| matching | A1 / A2 | 15 / 15 | 3339–3353 / 3354–3368 | 36 / 53 |
| error_correction | A1 / A2 | 15 / 15 | 3369–3383 / 3384–3398 | 33 / 53 |
| sentence_building | A1 / A2 | 15 / 15 | 3399–3413 / 3414–3428 | 33 / 55 |
| multiple_choice | A1 / A2 | 30 / 30 | 3429–3458 / 3459–3488 | 235 / 317 |

- **Checks:** the same as batch 1, all clean. For MC, the duplicate check also matched near-copies (same answer plus the same first 18 characters). It caught 5 rewordings of existing qs (400, 2131, 301, 2889, 2175), which were replaced. One matching pair (arrive => leave) overlapped 1327 and 914 and was swapped.
- **A1 sport MC** went from 6 to 15.
- **Also fixed:** q 1594 ("Despite working hard all year, he failed to meeting…") was tagged A1; moved to B2.

## 3c. Batch 3 detail (3489–3608, batch `b3`): written without a sample, at James's request

- **hotel_vocabulary**, now exactly 20 per level: A1 +10 and A2 +10 (MC); B1 +4 MC/+4 GF; B2 +6 MC/+6 GF; C1 +8 GF; C2 +11 GF.
- **business_phrasal_verbs**, now exactly 25 per level: A1 +10 and A2 +10 (MC); B1 +4/+4; B2 +6/+6; C1 +10 GF; C2 +11 GF.
- **Format:** follows topic practice (A = MC, B = mix, C = gap fill).
- **Gap fills:** each has a `hint`, a `hint2` (letter count and first letter, or a "Two words: w___ o__." pattern), and `acceptable_alternatives` where another word genuinely works. Empty feedback (green) means a true synonym; filled feedback (amber) means "right meaning, but we're testing the phrasal verb".
- **Phrasal verb blanks** always contain the whole verb and particle.
- **Duplicates caught and replaced:** 504 (an exact copy), 2230 and 2236 (near-copies).

## 3d. Batch 4 detail (3609–3688, batch `b4`)

- **B1:** odd one out +8, matching +8, error correction +10, sentence building +8, gap fill +6.
- **B2:** odd one out +8, matching +10, error correction +8, sentence building +8, gap fill +6.
- **Two error-correction drafts** needed two tile changes. Both were rewritten before insert, and all 18 pass.
- **Batch 1 fix:** C1 sentence-building q 3241 (unanswered) was rewritten as "Having finished the report, she went home early." It had been a near-twin of a B2 item.

## 4. Pools now (EN, excluding bathroom)

| Type | A1 | A2 | B1 | B2 | C1 | C2 |
|---|---|---|---|---|---|---|
| odd_one_out | 31 | 39 | 27 | 29 | 41 | 37 |
| matching | 36 | 53 | 32 | 28 | 44 | 29 |
| error_correction | 33 | 53 | 32 | 47 | 73 | 34 |
| sentence_building | 33 | 55 | 34 | 38 | 62 | 34 |
| multiple_choice | 240 | 322 | 153 | 155 | 82 | 63 |
| gap_fill | 52 | 46 | 149 | 167 | 294 | 185 |

**Next time:** recheck per-question serve rates in about a month (the query that drives §1) to see whether the regulars come back.

## 5. Findings and lessons

- **There was no selection bug.** I wrongly said practice was skipping 88 A-level MC. They were added on 20 Aug, Belinda has answered only 98 A-level MC since, and 12 of those were new ones. The real problem was the 30-day window: new qs had to compete with everything she hadn't seen in a month.
- **The bathroom leak came from survival mode,** which never filtered by track. Random practice has filtered by track since March.
- **Track inconsistency still open:** survival mode serves hotel_vocabulary and business_* qs to students without those tracks. Random practice doesn't. It was left alone because only bathroom was asked for; it would be a one-line change.
- **Sentence-building marking:** an exact match (punctuation stripped, lowercased) is accepted first, and anything else goes to the AI marker (`mark-free` `word_order`). So a valid alternative order still gets credit, but each one costs an AI call.
- **Error-correction removals:** the UI supports removing a word, so "remove X" items are fine.

## 6. Tooling gotchas (cloud session linked to the Mac)

- The shell on the Mac's folders runs in a Linux VM:
  - The repo's `node_modules/.bin/esbuild` is a macOS binary. A Linux esbuild is installed at `~/eb/node_modules/.bin/esbuild` in the VM.
  - There is no SSH key, so the VM can't push to GitHub. It also can't reach supabase.co.
  - Commits need `-c user.name="James" -c user.email="james@perfect-english.org"`.
- Git in that shell needs delete permission for its lock files. It was granted this session.
