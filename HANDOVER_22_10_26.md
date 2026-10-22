# HANDOVER — 22 October 2026

Story Scramble: a new weekly activity in the Activities tab. Students put a jumbled
story back in order. Built, tested and loaded with week one; it goes live to students
on **Monday 2 November** (teachers can open it now). Everything below was read back
from the live DB and the repo at the end of the session.

## 1. State at close

| Piece | Status |
|---|---|
| `scramble_texts`, `scramble_sessions` | created (migration `story_scramble_tables`), RLS on: texts readable by any signed-in user, sessions own-row + teacher read |
| Week one content | 5 texts for 2 Nov: EN A2/B1/B2/C1 (James's class-tested worksheets) + ES A2 (new) |
| `src/StoryScramble.jsx` | new, written to the repo (md5 `ce707c67…` matches the tested copy) |
| `src/ExerciseList.jsx` | import, `ACTIVE_EXERCISES`, `EXERCISE_ICONS` 📜, routing, `LAUNCH_DATES` `2026-11-02` |
| `src/Progress.jsx` | `scramble` added to `NAMED`, its own 📜 star tile |
| `exercises` row | `Story Scramble`, `category 'practice'`, `type 'story_scramble'`, `level 'A2-C1'`, `tracks {general}`, order 8 |
| `CLAUDE.md` | new Story Scramble section; `scramble` added to star sources |
| Code | **not committed** (§6) |

## 2. How it works

- Opens at the student's level (A1/A2 → A2, C2 → C1). Level pills switch between
  A2/B1/B2/C1. Spanish-track learners get the Spanish text, with no pills while only one
  ES level exists.
- **Moving sentences:**
  - drag by the dotted grip, or press and hold anywhere on the card;
  - or tap one sentence, then tap where it should go (▲ ▼ appear on the selected card);
  - a quick swipe still scrolls the page;
  - auto-scroll near the screen edges, which handles the long C1 lists.
  - Touch uses native non-passive listeners, because iOS ignores HTML drag-and-drop.
    Mouse drag works on desktop.
- **Checks:** no feedback while arranging. There are **3 checks**, and each says
  "N of 9 links right" (adjacent correct pairs), never which ones. Check is disabled until
  something has moved since the last check.
- **Hint:** "Show me how it starts" locks sentence 1 at the top. It uses a check, after an
  inline confirm.
- **Out of checks:** "Show me the answer" puts the story in order, with no stars. Students
  can also give up earlier, with a confirm.
- **Solved:**
  - the cards go green one by one, top to bottom;
  - then the stars pop in: 3/2/1 for check 1/2/3, and the hint counts as a check;
  - then "How it fits together": the story as a paragraph with the clue words
    highlighted. Tapping any sentence shows its note, and "Show all the clues" lists them.
  - The answer is also shown in worksheet letters (e.g. `G B I D F J C H A E`).
- **Resume:** the order saves ~0.7s after each move, and checks, hint and outcome save
  immediately. A reload restores everything, so checks can't be reset Wordle-style.
- **More stories:** earlier weeks at the same level, with status (⭐⭐⭐ / Answer seen /
  In progress / New). Students never see future weeks.
- **Teachers:**
  - this applies to the `isTeacher` prop and also `profiles.is_teacher`, so Present Mode
    counts;
  - nothing is saved;
  - "↺ Start again";
  - future weeks are listed with "Goes live Mon, 2 Nov".

## 3. Content

- **The four English texts** are James's ChatGPT trial worksheets, word for word. A script
  checked every sentence against the .docx files. `start_order` is the worksheet's A–J
  order, so the letters in the app match the paper sheets.
- **Clues and notes:** clue words are marked `[[…]]`. Each note explains why that sentence
  sits where it does, written at or below the text's level.
- **The Spanish text** is new: *La caja equivocada*, pitched A2–B1, Peninsular, set in
  Mallorca (Sóller).
- **Blind solve:** all five were solved by a separate agent that had not seen the
  answers.
  - All four English texts came back SAFE, with the same orders as the teacher key.
  - The Spanish text first came back mildly ambiguous: "La caja era para Joaquín…" could
    also follow sentence 1. It was rewritten as "**Era el nombre de** Joaquín Ferrer…",
    which can only follow the sentence about the label. Sentence 8 was also reworded so
    that the apple cake is clearly a gift.
- **A2 pronoun fix (applied, at James's request):** the solver flagged that "the person who
  had ordered Lucy's cake" / "That person" is followed by "she brought it back", and A2
  learners may read "she" as Anna. Both sentences now say "woman" (sentences 6 and 7,
  letters H and A), and notes 7 and 8 were updated to match. The order is unchanged. The
  app now differs from the paper worksheet in those two words only.

## 4. Testing

- **Headless Chromium as an iPhone 13**, running the real component against a mock
  Supabase (in-memory, survives reloads): 51/51 checks pass. They cover:
  - grip drag, press-and-hold drag, auto-scroll drag, swipe-to-scroll, tap-to-move and
    ▲▼;
  - link counting, the disabled re-check, saves and resuming after reload;
  - hint lock (nothing can be dragged above it);
  - solve on the 3rd check = 1 star, solve on the 1st = 3 stars, no duplicate stars on
    reload;
  - reveal = no stars;
  - archive, level pills, empty state before launch;
  - teacher view saves nothing, teacher "Start again";
  - Spanish learner, desktop mouse drag.
- **The real repo (copy, Linux):**
  - `eslint src/StoryScramble.jsx` is clean;
  - `vite build` succeeds;
  - the errors eslint reports in `ExerciseList.jsx` / `Progress.jsx` were already there
    at HEAD (identical counts without these edits).
- **RLS:** as María (authenticated), all 5 texts are visible.
- **Not yet tried on a real phone.** James should open it as teacher on his iPhone before
  2 Nov: Activities → Story Scramble.

## 5. Next

1. **Content for 9 Nov onwards.** There is nothing after week one, so students will keep
   seeing the 2 Nov texts until new ones arrive. The proposal is a month at a time:
   4 weeks × 5 texts = 20, blind-solved, a sample for sign-off first.
   - Fold it into the monthly top-up (December is due around 22 Nov).
   - Ideas from the trial notes: B2/C1 non-narrative texts (argument, report) later;
     A2 could go to 8 sentences if 10 proves heavy (the component takes 6–12).
2. **New year:** separate ES A2 and ES B1 texts. Add rows with `level 'B1'` for `es`, and
   the pills appear on their own.
3. Watch `check_results` once students start, to see where texts are too easy or too
   hard (e.g. first-check solve rate per level).

## 6. Commit

Note: `scripts/crossword/generate_batch.py` still has uncommitted changes from this
morning's crossword session; it isn't in this commit.

```
git add src/StoryScramble.jsx src/ExerciseList.jsx src/Progress.jsx CLAUDE.md HANDOVER_22_10_26.md
git commit -m "Story Scramble: weekly jumbled-story activity, launches 2 Nov"
git push
```
