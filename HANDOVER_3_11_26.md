# HANDOVER — 3 November 2026

Question-bank freshness push, batch 1 of 4. Every claim below was checked against the
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

## 4. Remaining plan (one batch per session, sample first)

2. **A1/A2:** side types +15 each per level (odd one out, matching, error correction, sentence building), plus 30 more MC per level. About 180.
3. **Hotel vocabulary** up to about 20 per level; **business phrasal verbs** up to about 25 per level. About 130.
4. **B1/B2:** lighter top-up across the main types. About 80.

Skip Sentence Auction and the B1/B2 choosers: they are barely used.

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
