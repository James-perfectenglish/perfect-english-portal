# HANDOVER — 19 June 2026

One focused build arc this session: a **student-sentence harvesting + AI-tagging analysis system**. The goal you set — *"show me all of Carolina's sentences, good and bad, then analyse for progress and recurring errors"* — is now live end to end, and already producing real signal (including a clear, systematic marker-quality finding, below).

Everything below is verified against the live DB and filesystem this session, not memory.

**Build the picture in two layers:** (1) **harvesting** — every "serious" Sentence Challenge sentence is now persisted; (2) **analysis** — an LLM tagging pass classifies each one so genuine errors can be separated from marker noise and off-target answers.

---

## 🟢 Layer 1 — Harvesting (the corpus)

### The "serious vs fun" principle
Agreed framing: **Play-section games are a sandbox; everywhere else is the record.** So we harvest sentences from the non-game surfaces and (for now) skip the games.

- **Serious / harvested:** WOTD, GOTD, PVOTD (the daily cards, already had their own submission tables) **+** RPE, Topic Practice, Dictation, Listening, Matching, Pronunciation (newly wired this session).
- **Deferred to "1b" (games):** Wordle, Connections, Crossword, Wordsearch, Spelling Bee. These only ever stored a **pass/fail boolean** for the challenge — the sentence text was discarded. Harvesting them would need a write-side change per surface; not done.

> **Key discovery:** the old handover's SC-surface list was **incomplete**. A repo-wide check found Dictation / Listening / Matching / Pronunciation *also* fire the Sentence Challenge and were silently discarding sentences. They're now wired. (ErrorCorrection, OddOneOut, WordSnake, MemoryGame have no SC.)

### `sc_sentences` table (live)
The shared harvest table that all six newly-wired surfaces write to:
`id, student_id, source, target, sentence, is_correct, ai_feedback, input_method, language, level, submitted_at`. RLS: student insert/read own, teachers read all (mirrors the existing submission tables). Indexes on `(student_id, submitted_at desc)` and `(source)`.

Each surface writes a distinct **`source`**: `rpe`, `topic_practice`, `dictation`, `listening`, `matching`, `pronunciation`. (These match the star `source` names the SentenceChallenge already used.)

### Wiring pattern (reusable)
`SentenceChallenge` already calls `onMarkResult({ sentence, inputMethod, result })` after marking; the **parent owns persistence**. So each surface got the identical ~10-line treatment: a `challengeLevel` capture at the trigger site, an `onChallengeMarked` handler that inserts into `sc_sentences`, and `onMarkResult={onChallengeMarked}` on the SC element. **No change to `SentenceChallenge.jsx`, no new Vercel function** (direct client→Supabase insert, like the daily cards).

### WOTD `input_method` (live + code)
WOTD previously **never recorded** voice-vs-text. Added an `input_method` column to `word_of_the_day_submissions` and one line to `WordOfTheDay.jsx`'s `submitSentence` insert (`input_method: inputMethod || 'text'`). The 383 historical rows stay NULL (unrecoverable); new ones capture it. Closes the last blind spot so the voice-fairness logic (below) covers every serious surface.

### `student_sentences` view (live)
Unions all four text-bearing sources (wotd/gotd/pvotd submissions + `sc_sentences`), profile-joined. Columns: `source, student_id, student_name, student_level, language, item_level, target, sentence, is_correct, ai_feedback, input_method, submitted_at, row_id`. **Locked down** — `REVOKE`d from `anon`/`authenticated` (carries student names; teacher/SQL access only for now).

- **Identity handled generically:** `student_name = TRIM(full_name)`. This collapses Carolina's two profiles (one has a trailing space) with no hardcoding, and handles any future trailing-space dupe. *"Show me all Carolina's sentences"* = one `WHERE`.

---

## 🔵 Layer 2 — Analysis (the tagging pass)

### The taxonomy (your rulings, locked)
Every sentence gets a **`category`**, a **`subtype`**, and a one-line **`note`**. The classifier **re-judges independently** — it does *not* trust the marker's `is_correct` — which is how it catches marker mistakes both ways.

- `correct` · `genuine_error` · `off_target` (valid English that dodged the target structure) · `marker_noise` (not the student's fault) · `input_artifact` (voice mis-transcription)
- **subtypes** — errors: `verb_form, verb_tense, subject_verb_agreement, word_order, article, preposition, pronoun, plural, spelling, typo_function_word, word_meaning, word_choice, target_concept, other`; noise: `marker_fail, pos_overstrict, over_strict, cosmetic`; voice: `asr_substitution`.
- Confirmed rulings: regular/irregular confusion → `genuine_error/target_concept` (a real gap, not off-target); part-of-speech mismatch at low levels → `marker_noise/pos_overstrict` (not an error); "marker wanted more elaboration" on correct usage → `marker_noise/over_strict`; meaning confusion → `genuine_error/word_meaning`; multi-error → one primary subtype + note; **re-judge the marker** (override `is_correct`); cosmetic spacing/phone-typos → ignore.

### `sentence_tags` table (live)
`source, row_id, category, subtype, note, model, tagged_at`; PK `(source, row_id)`; `category` CHECK-constrained to the five values. RLS on, `REVOKE`d from API roles (service/SQL only).

### Views (live)
- **`student_sentences_tagged`** — everything in `student_sentences` + the tag + a derived **`marker_flag`**: `false_positive` (I say error, marker passed), `false_negative` (I say fine/noise, marker failed), `agree`. This *is* the marker-quality monitor. (`input_artifact` and `off_target` correctly map to `agree` — the marker judged the text it received correctly.)
- **`student_error_profile`** — genuine errors per student by subtype, **noise stripped** (`WHERE category='genuine_error'`). The at-a-glance "who needs what."

Both `REVOKE`d from API roles.

### `scripts/tag_sentences.py` (the tool)
Runs in the shell (like the crossword/wordsearch generators), **not** in Supabase. Reads untagged rows from `student_sentences_tagged`, classifies each via the Anthropic API, upserts into `sentence_tags`.
- **Model:** defaults to `claude-sonnet-4-6` (`--model claude-haiku-4-5` to cut cost). Sonnet chosen for classification nuance over the Haiku marker.
- **Flags:** dry-run by default; `--commit` writes; `--limit N`; `--student "Name"`; `--source`; `--retag` (re-judge already-tagged rows). Skips already-tagged rows by default.
- **Env:** `SUPABASE_DB_URL` (session-pooler URI) + `ANTHROPIC_API_KEY`. Dep: `requests` (installed on the Mac via `python3 -m pip install --user --break-system-packages requests` — the system Python is externally-managed).
- The classifier prompt encodes every ruling above, including **rule 8**: `input_artifact` only when `input_method='voice'` AND the intended word is obvious AND would make the sentence correct — biased to precision, so it never launders a real mistake.

---

## 📊 Phase 2 results — the backlog is tagged

The full backlog was tagged this session. **547 rows tagged, 12 failed** (classifier hiccups — still untagged, a plain `--commit` re-run retries just them).

| category | n |
|---|---|
| correct | 398 |
| genuine_error | 113 |
| off_target | 21 |
| marker_noise | 14 |
| input_artifact | 1 |

(Includes Belinda's **20 hand-tagged reference rows**, `model='manual-reference'`, which the script skips.)

### ⭐ The headline finding — two *systematic* marker biases
The marker disagreed with an independent re-judge **~56 times** (≈28 false-positive, ≈28 false-negative), and the disagreements cluster into two clear, fixable patterns. **This is a marker-tuning brief for next session** (mostly `api/mark-free.js`, the WOTD `handleSentence` path; connects to the 8 June "meaning-first" work):

1. **Over-strict — fails correct answers for lack of "elaboration."** It rejects perfectly correct, concise or idiomatic usage because it wants a more demonstrative sentence — and it hits the **strongest students hardest** (Carolina, Carmen, Jon, James, Sonia), because they write naturally. E.g. "You cannot undermine me!!!!", "I insist that you come" (correct mandative subjunctive — marker wrongly wanted "be"), "come to grief", "a deft decision", "That's not fair".
2. **Under-strict — passes errors *elsewhere* in the sentence.** It checks the target word/structure is present and ignores the rest, so real errors sail through: prepositions ("listening music", "thinking in other things", "pay a house", "arrived to"), spelling ("drees", "hinest", "play" for place), agreement ("Today are a cold day", "two cat"), verb form ("I walking to work"). **Arguably the priority** — students are told "correct!" on sentences with real mistakes, so they don't learn from them.

### Worth noting on Jon
Jon Cabañes is **voice-only** (100% of his recorded input) and had a high apparent error rate. Only **5 accounts** have *ever* used voice (Jon, Belinda occasionally, Marga once, + you/the demo account). So voice adoption is low overall, but for Jon specifically, ASR artifacts could be inflating his error count — watch his profile.

---

## ✅ Verified live state (queried this session)

| Metric | Value |
|---|---|
| `student_sentences` total | **559** (grew from 547 — new daily-card submissions during today's classes) |
| `sentence_tags` total | **547** (incl. 20 manual-reference) |
| Untagged remaining | **12** (the classifier failures) |
| `sc_sentences` rows | **1** (your TPE test — students hit TPE mid-class but the new bundle wasn't live for them yet) |
| WOTD rows with `input_method` | **0** (no WOTD submissions since that deploy) |
| Tag categories | correct 398 · genuine_error 113 · off_target 21 · marker_noise 14 · input_artifact 1 |
| New DB objects | `sc_sentences`, `sentence_tags` (tables); `student_sentences`, `student_sentences_tagged`, `student_error_profile` (views); `word_of_the_day_submissions.input_method` (column) |

---

## ⚠️ Deploy / git state

**Code pushed this session (two commits, both deployed — confirmed READY in Vercel):**
- *"Harvest sentence-challenge sentences from all serious surfaces; add tagging script"* — the 6 SC surfaces + `scripts/tag_sentences.py`.
- *"WOTD: capture input_method (voice/text) on sentence submissions"* — `WordOfTheDay.jsx`.

**All DB work is already live** (tables, views, column, Belinda's reference tags, the full backlog tagging).

**⚠️ One git item likely outstanding:** `scripts/tag_sentences.py` was **edited again after its first commit** (the `input_artifact` category + voice rule + `input_method` in the classifier payload). The version you ran locally has these changes; the committed copy may be the pre-`input_artifact` one. The script runs from local disk so this doesn't affect running it — but **re-commit `scripts/tag_sentences.py`** to keep git in sync.

```
git add scripts/tag_sentences.py
git commit -m "tagger: input_artifact category + voice-aware rule"
git push
```

**Smoke tests still to confirm (in class):**
- **RPE / the four exercises harvest** — TPE is proven (1 row landed); the other five run identical wiring, so confirm a row lands for each `source` as students hit them. (MacBook misses earlier were a stale service worker — the phone test worked first try.)
- **WOTD voice capture** — do a WOTD challenge by voice, check the new row's `input_method = 'voice'`.

---

## 🧩 Loose ends / next session

1. **Re-run the 12 failures:** `python3 scripts/tag_sentences.py --commit` (after re-exporting `SUPABASE_DB_URL` + `ANTHROPIC_API_KEY` in the terminal — they don't persist across windows). Retries only the untagged rows.
2. **Marker-tuning brief** (the big one) — fix the two systematic biases above in `api/mark-free.js`: stop failing correct answers for lack of elaboration; start catching errors beyond just the target word. Mostly the WOTD path. Review the full false-positive / false-negative lists together first (they're in `student_sentences_tagged WHERE marker_flag IN ('false_positive','false_negative')`).
3. **Two tagger calls to rule on / fix:**
   - Sonia, "Can you give my calendar please" — tagged `correct`; arguably `genuine_error` (missing "me").
   - `word_form` subtype slipped in **twice** (not in the vocabulary) — normalise to `verb_form`: `UPDATE sentence_tags SET subtype='verb_form' WHERE subtype='word_form';`
4. **Automate tagging** — fold `python3 scripts/tag_sentences.py --commit` into the **weekly DB-backup GitHub Action** (the `chore: weekly DB backup` job), pulling credentials from repo secrets. Then it's truly hands-off — no terminal, no password-in-window, no rebase. (Was agreed; not yet done. Would need a look at how that Action is wired.)
5. **Games harvesting ("1b")** — if/when you want it, add SC-text persistence to Connections/Crossword/Spelling Bee/Wordsearch (+Wordle, which has a barely-used `wordle_sentences` table already). They'd write to `sc_sentences` and flow into the views automatically.
6. **Teacher-facing UI (later)** — `student_error_profile` and `student_sentences_tagged` are currently SQL/service-only. A TeacherBrowse panel would need proper teacher-gating (RLS or a security-definer function), not just a view.

### Carried from 17 June (unchanged — see that handover)
- Themed wordsearch `--theme` flag · 2370 question batch (EC leading-word deletions) · standalone Sentence Building `acceptable_alternatives` parity · crossword cliff (next batch before 24 Jun) · grow PVOTD bank · Spanish GOTD B1/B2 + C1/C2 · ES WOTD B1+ · flashcard rebuild.

---

## 🛠️ Technical notes / learnings

- **`supabase-js` does NOT throw on RLS/permission denial or constraint violation** — it returns `{error}`. A handler that only `try/catch`es will fail **silently**. This was the suspected failure mode during the TPE debug; the real cause was a stale service worker (the new bundle hadn't loaded). Grants on `sc_sentences` were verified identical to the working tables.
- **PWA service-worker caching bites every code change.** A push can be READY in Vercel while the installed app still serves the old bundle. Always fully close/reopen (or hard-refresh) before testing — and test on a device that's actually pulled the new bundle. (MacBook kept serving old code; phone worked first try.)
- **`CREATE OR REPLACE VIEW` can only append columns at the end** — can't rename/reorder/retype/drop existing ones. `row_id` and the WOTD `input_method` swap (NULL → real column, same name/type) were both fine and didn't break the dependent `student_sentences_tagged` view.
- **`marker_flag` derivation:** `off_target` and `input_artifact` map to `agree` deliberately — the marker correctly judged the *text it received*; the issue was upstream (off-brief, or ASR). Keeping `marker_noise` as the *only* false-negative-on-fail category keeps it an honest marker-quality signal.
- **macOS system Python is externally-managed (PEP 668).** `pip install` is blocked; use `python3 -m pip install --user --break-system-packages <pkg>`. Use `python3`, not `python`.
- **The tagger re-judges independently and is biased to precision** on the lenient categories (`input_artifact`, `marker_noise`) — so worst case a little noise stays counted (visible, correctable) rather than a real gap getting hidden.

---

## 🪞 Bigger picture

**The platform now learns from its own data.** Every serious sentence a student writes is captured, and an LLM pass turns that raw pile into a per-student error profile with the noise stripped out. *"Show me Carolina's sentences"* became one query; *"what does Belinda actually need taught"* became a view.

**The analysis layer doubles as a marker auditor.** Because the tagger re-judges instead of trusting the marker, the very first full pass surfaced two systematic marker biases — over-strict on strong students, under-strict on errors away from the target word. That's a concrete improvement brief the marker couldn't have produced about itself.

**Same shape as always — small, named, verified, staged.** One shared harvest table + one reusable wiring pattern across six surfaces; a taxonomy agreed on a real sample before any bulk work; a script that dry-runs before it commits; and the speculative parts (games, teacher UI, automation) deliberately left as named next steps rather than built on spec.
