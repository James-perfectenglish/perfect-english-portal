# Handover — 24 August 2026

**Session type:** bug-fixing, with a short website tail. Continues the 23 August website session.
The main event was a genuine app bug: **Wordle was accepting non-words for anyone using a physical
keyboard**, and had been since guess validation shipped on 22 August.

---

## 1. The Wordle validation bug

### Symptom

Wordle rejected invalid guesses on iPad but accepted `GGGGG` and `HHHHH` on desktop Safari. Clearing
website data, quitting Safari and a private window all made no difference.

### Root cause — stale closure

`WordleGame.jsx` binds the physical-keyboard listener once on mount:

```js
useEffect(() => {
  initDaily()
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [])          // ← empty deps
```

so the `submitGuess` that `handleKeyDown` calls is permanently the one from the **first** render.
The component already worked around this by mirroring game state into `stateRef` — and `submitGuess`
correctly read `current`, `word`, `guesses`, `gameState` from that ref — **but `dictionary` was never
added to the mirror.** It was therefore read from the frozen closure, where it is still `null`
(the dictionary is a dynamic import that resolves after first render), so the guard

```js
if (dictionary && current !== word && !dictionary.has(...))
```

short-circuited on every keyboard-submitted guess.

The on-screen keyboard buttons are re-created every render, so their handlers saw the real
dictionary. **The axis was touch vs keyboard, not Spanish vs English and not caching.**

### Impact

Every student on a laptop or desktop had **no word validation from 22 to 24 August**. Phone and
tablet users were unaffected. Any Wordle sessions recorded in that window may contain nonsense
guesses — relevant if the star rate is being compared against the 66.3% pre-launch baseline.

### Fix (pushed)

`dictionary` added to the `stateRef` mirror and destructured from it inside `submitGuess`, matching
the pattern the file already used. Both input paths now read the same live value.

### Audit of the other games — clean

`SpellingBeeGame.jsx` and `CrosswordGame.jsx` bind keydown the same way with `[]` deps, but both
route through a ref of *handlers* (`handlersRef` / `keyFnRef`) rather than calling the function
directly, so they always invoke the current closure. No other component takes typed input.
**Wordle was the only one affected.** The `handlersRef` pattern is the safer idiom — worth reaching
for by default in any new game that accepts keyboard input.

---

## 2. Silent-failure note in Wordle (pushed)

The dictionary loader deliberately falls back to accepting anything if the chunk can't be fetched,
so a bad connection doesn't lock a student out. Reasonable, but it was completely invisible —
`console.warn` and nothing else.

Added `dictionaryFailed` state, set in the catch and cleared on a later success, surfacing a small
amber note above the keyboard: *"Couldn't load the word list, so guesses aren't being checked.
Reload the page to try again."* (Spanish string included.) The kindness is preserved; the silence
is gone.

---

## 3. `.single()` → `.maybeSingle()` sweep (pushed)

PostgREST returns **406 Not Acceptable** when `.single()` matches zero rows. Every affected call
site destructures only `data` and checks truthiness, so nothing was breaking — but the console was
filling with red that masked real errors.

**Twelve sites changed across five files**, all places where a miss is a *normal* outcome:

| File | Sites | Table(s) |
|---|---|---|
| `WordOfTheDay.jsx` | 6 | `word_of_the_day` ×5, `word_of_the_day_submissions` |
| `WordleGame.jsx` | 2 | `wordle_words`, `wordle_sessions` |
| `ConnectionsGame.jsx` | 2 | `connections_puzzles`, `connections_sessions` |
| `SpellingBeeGame.jsx` | 1 | `spelling_bee_puzzles` |
| `WordSearchGame.jsx` | 1 | `wordsearch_puzzles` |

The WOTD chain is the worst of them: its level fallback is *built* around misses (the code comment
says ES B1/B2 and C1/C2 aren't populated for every date), so **every Spanish B1/B2 and C1/C2 student
was throwing a 406 on every page load**.

**Deliberately left on `.single()`:** all `profiles` lookups — a logged-in user should always have a
profile, so a 406 there is a real signal worth keeping — and `WordOfTheDay.jsx:146`, an
insert-then-`.select().single()` which genuinely expects exactly one row. Roughly 20 other
`.single()` calls elsewhere (mostly `profiles`) were left alone for the same reason.

**Why this mattered now:** after 30 September every daily-content lookup starts missing for every
student. Without this change the console would have filled with 406s at precisely the moment it
needed to be readable.

---

## 4. Website (perfect-english.org)

**Note: a separate chat ran in parallel today** ("LinkedIn profile update") which also edited
`~/perfect-english/index.html`. Both sets of edits coexist in the file — verified, nothing was
clobbered — but the two threads changed overlapping things, so the state below is what the file
**actually** contains, not what either thread alone did.

- **"levelled to you" → "at your level"** in the Daily games subline. *Live and confirmed.*
  (Note for the record: `levelled` is the British spelling — `leveled` is the Americanism. What
  jarred was the edtech verb usage, which is what the rewrite fixed.)
- **`og:description` and `twitter:description`** — changed twice today. The **final** wording, from
  the LinkedIn thread, is: *"Daily games, real exercises with instant feedback, and tracked
  progress — built by your teacher, at your level, A1–C2."* (The comma before "and" is deliberate.)
  The earlier version from this thread, which ended "...in English and Spanish", is superseded.
  `<meta name="description">` was deliberately left alone.
- **Hero chip "10+ years teaching" → "Teaching since 2013"** (LinkedIn thread). Permanent phrasing:
  needs no future maintenance.
- **Nav breakpoint 760px → 900px** (this thread). On iPad portrait (~820pt) the five nav links tried
  to fit and wrapped into a cramped mess; phones were below the old cutoff and always looked fine.
  Tablet portrait now collapses to logo + button like the phone.
- **`og-image.png`** — kept as the existing Perfect English card in this thread; the LinkedIn thread
  then produced a **new 1200×630 version** to be saved over `~/perfect-english/og-image.png`.
  Confirm which file is actually in the repo before pushing.

**Pending on the website repo:** the LinkedIn thread listed three uncommitted changes (two meta
descriptions + the chip); the nav fix from this thread makes four. Verify all are pushed, then run
`https://perfect-english.org` through **LinkedIn's Post Inspector** to clear the cached February
preview card before sharing any link.

---

## 5. Corrections to the 23 August handover

Three things in yesterday's document were wrong and are corrected here:

1. **`skipWaiting` / `clientsClaim` / NetworkFirst navigation are already live.** `vite.config.js`
   on `main` is byte-identical to local. The PWA update mechanism is in place, not outstanding.
2. **The `WordleGame.jsx` star fix (`??` → `||`) is deployed**, not awaiting push.
3. The stale-bundle theory for the Wordle symptom was wrong — see §1.

---

## 6. Diagnostic lessons worth keeping

- **Absence of a warning is not proof of success.** No `dictionary failed to load` in the console
  was read as "the import worked". It is equally consistent with code that has no such warning in
  it. Ask what *else* would produce the same silence.
- **Safari's console filter defaults to Errors**, which hides `console.warn` entirely. Check the
  filter before concluding anything from an empty console.
- **A private window is the fastest cache test** — Safari doesn't run service workers there. It was
  the step that broke this open, and it should come first next time, not fifth.
- **When two devices differ, list every variable before picking one.** iPad vs desktop differed by
  language, input method, browser and install type simultaneously. Language was picked and reasoned
  from for several rounds; input method was the real axis. The first screenshot contained the
  answer.
- **Verify deployed code against local early.** `curl raw.githubusercontent.com/.../main/<file>` and
  diff. Cheap, decisive, and it collapses whole branches of speculation.

---

## 7. Open items

**From today:**
1. Confirm the website nav-breakpoint fix is pushed (§4).
2. Consider the `handlersRef` pattern as the standard for any new keyboard-driven game.
3. Wordle sessions from 22–24 Aug may contain junk guesses — worth a look before trusting the star
   rate. Belinda solved first try on 23 Aug (a genuine, lovely result, but a first-guess solve pays
   maximum stars and will flatter a small sample).

**Carried forward, still untouched:**
- **October + November content — all 14 daily streams end 2026-09-30.** Target ~22 September. Now
  doubly important: this is the date the daily lookups start missing across the board.
- **LinkedIn — profile DONE today** in a separate chat. Headline, About, both Experience entries,
  CELTA certification, Skills and Services all written and pasted; banner uploaded
  (`banner_alt_ielts.png`, the recommended variant). Framing agreed: it is a **credential page**,
  not a broadcast channel — coherent when someone looks him up after meeting him. Spanish teaching
  deliberately excluded throughout (sideline, and not teachable to C2). Freelance translation and
  proofreading also removed on James's instruction.
  **Still outstanding:** the **launch post**, to be drafted now the profile is live; and the Post
  Inspector run once the website repo is pushed (see §4).
- **GET21** — light no-ask touch mid-September, proper push late October.
- `/examples` — retire, redirect into the app, or leave. Dropped from the nav, not deleted.
- No Wordsearch clip exists; `RPE 4-3.mp4` sits trimmed and unused in `~/Desktop/picks`. Practice
  could go to a six-card grid with Error Correction and Pronunciation.
- Spanish version of the business section, for the late-October GET21 push.
- Feedback pending from the people sent the site link.
- Spelling Bee thresholds (pending the September word-count recount), `rank_label` Queen Bee fix +
  backfill, teacher UI for `spanish_level`, the `!isSpanish` sibling-gate audit.

**Before any insert: re-`SELECT MAX(question_number)` live.** It was 3113 at the close of
22 August and has drifted in every recent session.
